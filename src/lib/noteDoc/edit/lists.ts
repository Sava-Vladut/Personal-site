// Lists, as the old editor kept them (lib/markdown.ts listKey, indentLines, renumber): flat, one item a line, how
// deep each sits written in its indent. Enter carries a list on, an empty item ends it (a nested one steps out a level
// first), Tab and Shift+Tab move items in and out, and numbered items are counted again after each change.
import type { Node as PMNode } from '@tiptap/pm/model';
import { TextSelection, type Command, type EditorState, type Transaction } from '@tiptap/pm/state';
import { AttrStep, Mapping, ReplaceAroundStep, type Step } from '@tiptap/pm/transform';
import { isHistoryTransaction } from '@tiptap/pm/history';
import { REPLACED } from '../diff';
import type { ListItemAttrs } from '../schema';
import type { ListKind } from '../syntax';
import { deleteSelectionSafe, inTwoSteps, lineText, selectedBlocks, type At } from './util';

const isItem = (n: PMNode | null | undefined) => n?.type.name === 'listItem';

/** How wide an indent is when counting levels for numbering: a tab is four spaces (the old editor's measure). */
const indentWidth = (indent: string) => [...indent].reduce((n, c) => n + (c === '\t' ? 4 : 1), 0);

/**
 * The run of list items around the item at `pos` (one after another in their container): its first and last index,
 * and where it starts and ends.
 */
function runAround(doc: PMNode, pos: number) {
  const $p = doc.resolve(pos);
  const parent = $p.parent;
  let a = $p.index(), b = a;
  let start = pos, end = pos + (parent.maybeChild(a)?.nodeSize ?? 0);
  while (a > 0 && isItem(parent.child(a - 1))) start -= parent.child(--a).nodeSize;
  while (b + 1 < parent.childCount && isItem(parent.child(b + 1))) end += parent.child(++b).nodeSize;
  return { $p, parent, a, b, start, end };
}

/**
 * Counts the numbered items again in the run of list items around the item at `pos` (the position before it): 1, 2,
 * 3… at each level. A list keeps the number it starts from, and one nested under an item starts from 1. With `from`,
 * the numbered items at `indent` (the item's at `pos` when not given) count on from it there: what's after a numbered
 * item that stopped being one goes on from its number. A number already right is left as written (`01` stays).
 */
export function renumber(tr: Transaction, pos: number, from?: number, indent?: string): Transaction {
  const { $p, parent, a, b, start } = runAround(tr.doc, pos);
  const at = $p.index();
  if (!isItem(parent.maybeChild(at))) return tr;
  let p = start;
  const next = new Map<number, number>(); // by indent: the number the next item there gets
  const delims = new Map<number, string>(); // by indent: the `.` or `)` the numbers there are written with
  let prev = -1;
  for (let k = a; k <= b; k++) {
    const node = parent.child(k);
    const attrs = node.attrs as ListItemAttrs;
    const w = indentWidth(attrs.indent);
    let forced = false;
    if (k === at && from !== undefined) {
      const level = indentWidth(indent ?? attrs.indent);
      for (const x of [...next.keys()]) if (x > level) next.delete(x);
      next.set(level, from);
      forced = level === w;
    }
    for (const x of [...next.keys()]) if (x > w) (next.delete(x), delims.delete(x));
    if (attrs.kind === 'ol') {
      // a number written with the other delimiter (1. then 1)) starts a list of its own there, as in CommonMark:
      // what Restart numbering leaves
      if (!forced && delims.has(w) && delims.get(w) !== attrs.delim) next.delete(w);
      const n = next.get(w) ?? (k > a && prev < w ? 1 : Number(attrs.num) || 1);
      // (an attribute step: it moves no position, so the caret and selection stay put)
      if (Number(attrs.num) !== n) tr.setNodeAttribute(p, 'num', String(n));
      next.set(w, n + 1);
      delims.set(w, attrs.delim);
    } else (next.delete(w), delims.delete(w));
    prev = w;
    p += node.nodeSize;
  }
  return tr;
}

/**
 * After the numbered items `gone` (as they were before `tr`, first to last) stopped being numbered (made plain lines,
 * headings, bullets or tasks): the numbered items after each run of them count on from the run's first number, at its
 * level, as Backspace does it to one (1, 2 / 2, 3, as Word does it).
 */
export function countOnAfter(tr: Transaction, gone: At[]): Transaction {
  for (let k = 0; k < gone.length; k++) {
    const first = gone[k];
    while (k + 1 < gone.length && gone[k + 1].pos === gone[k].pos + gone[k].node.nodeSize) k++;
    const after = tr.mapping.map(gone[k].pos + gone[k].node.nodeSize);
    if (isItem(tr.doc.nodeAt(after))) renumber(tr, after, Number(first.node.attrs.num) || 1, first.node.attrs.indent);
  }
  return tr;
}

/**
 * Whether `step` only changes a line's attributes and leaves it the same kind of line at the same level (setNodeMarkup:
 * a task ticked, a number written, a picture sized).
 */
function sameLine(step: Step, doc: PMNode): boolean {
  if (step instanceof AttrStep) return step.attr !== 'kind' && step.attr !== 'indent';
  if (!(step instanceof ReplaceAroundStep) || step.gapFrom !== step.from + 1 || step.gapTo !== step.to - 1 || step.slice.content.childCount !== 1) return false;
  const was = doc.nodeAt(step.from), now = step.slice.content.firstChild!;
  return !!was && was.type === now.type && (!isItem(was) || (was.attrs.kind === now.attrs.kind && was.attrs.indent === now.attrs.indent));
}

/**
 * Where `trs` (one after another) changed which lines there are or what kind they are, as ranges in the last one's
 * document: lines put in, taken out, joined, split, made another kind or moved a level. Words typed or taken out within
 * a line, styles, and a task ticked don't count. Undo and redo don't either (they put the numbers back as they were),
 * nor a whole text put in with replaceDoc (it's kept as it's written).
 */
function linesChanged(trs: readonly Transaction[]): { from: number; to: number }[] {
  const inLine = (doc: PMNode, from: number, to: number) => {
    const $a = doc.resolve(from);
    return $a.parent.isTextblock && to <= $a.end();
  };
  let out: { from: number; to: number }[] = [];
  for (const tr of trs) {
    out = out.map((r) => ({ from: tr.mapping.map(r.from, -1), to: tr.mapping.map(r.to, 1) }));
    const root: Transaction = tr.getMeta('appendedTransaction') ?? tr;
    if (isHistoryTransaction(root) || root.getMeta(REPLACED)) continue;
    tr.steps.forEach((step, i) => {
      const rest = tr.mapping.slice(i + 1);
      const add = (from: number, to: number) => void out.push({ from: rest.map(from, -1), to: rest.map(to, 1) });
      const before = tr.docs[i], after = i + 1 < tr.steps.length ? tr.docs[i + 1] : tr.doc;
      if (sameLine(step, before)) return;
      if (step instanceof AttrStep) return add(step.pos, step.pos + 1);
      step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
        if (!inLine(before, oldStart, oldEnd) || !inLine(after, newStart, newEnd)) add(newStart, newEnd);
      });
    });
  }
  return out;
}

/**
 * The editor's numbering after each change (appendTransaction): the numbered lists whose lines the changes `trs`
 * touched are counted again, whatever made them (deleting a selection, joining lines, pasting, dragging, a rule). A
 * list keeps the number it started from, even when its first item went or another took its place. Null when every
 * number is right, or nothing changed the lines.
 */
export function renumberChanged(trs: readonly Transaction[], state: EditorState): Transaction | null {
  if (!trs.some((tr) => tr.docChanged)) return null;
  const { doc } = state;
  const tr = state.tr;
  const done: { start: number; end: number }[] = [];
  // the number a list starting at `pos` started from before the changes, when a numbered list started there
  const before = trs[0].before;
  const back = new Mapping();
  for (const t of trs) back.appendMapping(t.mapping);
  const inverse = back.invert();
  const startedAt = (pos: number) => {
    const was = inverse.map(pos, -1);
    if (!isItem(before.resolve(was).nodeAfter)) return undefined;
    const run = runAround(before, was);
    const first = run.parent.child(run.a);
    return run.start === was && first.attrs.kind === 'ol' ? Number(first.attrs.num) || 1 : undefined;
  };
  for (const { from, to } of linesChanged(trs)) {
    // where lines were only taken out, the ones on either side of the gap
    const a = Math.max(0, from === to ? from - 1 : from);
    const b = Math.min(doc.content.size, Math.max(a, from === to ? to + 1 : to));
    doc.nodesBetween(a, b, (node, pos) => {
      if (!isItem(node)) return !node.isTextblock;
      if (done.some((r) => pos >= r.start && pos < r.end)) return false;
      const run = runAround(doc, pos);
      done.push(run);
      renumber(tr, run.start, startedAt(run.start));
      return false;
    });
  }
  return tr.docChanged ? tr : null;
}

/** The indent one level in (a tab before it) or out (a tab or up to four spaces off). */
const shifted = (indent: string, out: boolean) => (out ? indent.replace(/^(\t| {1,4})/, '') : '\t' + indent);

/** Moves the items in `items` a level in or out, and counts numbered ones again. Returns whether anything moved. */
function shiftItems(tr: Transaction, items: At[], out: boolean): boolean {
  let moved = false;
  for (const { node, pos } of items) {
    const indent = shifted(node.attrs.indent, out);
    if (indent === node.attrs.indent) continue;
    tr.setNodeMarkup(pos, null, { ...node.attrs, indent });
    moved = true;
  }
  // the levels it left and joined are one run: counting it again from its first item does both
  if (moved && items.some((i) => i.node.attrs.kind === 'ol')) renumber(tr, items[0].pos);
  return moved;
}

/**
 * Tab and Shift+Tab (and Ctrl+] / Ctrl+[) on list items: the selected items move a level in or out. True whenever
 * the selection holds a list item, even one that can't go further out, so the key never leaves the note.
 */
export const indentList = (out: boolean): Command => (state, dispatch) => {
  const items = selectedBlocks(state).filter((b) => isItem(b.node));
  if (!items.length) return false;
  const tr = state.tr;
  if (shiftItems(tr, items, out) && dispatch) dispatch(tr);
  return true;
}

/**
 * A list item back into a plain line: its marker goes. Numbered items after it count again, from its number on (so
 * a list split in two reads 1, 2 / 2, 3 as Word does it).
 */
export function itemToParagraph(tr: Transaction, pos: number): Transaction {
  const node = tr.doc.nodeAt(pos)!;
  tr.setNodeMarkup(pos, tr.doc.type.schema.nodes.paragraph, null);
  const after = pos + node.nodeSize;
  if (node.attrs.kind === 'ol' && isItem(tr.doc.nodeAt(after))) renumber(tr, after, Number(node.attrs.num) || 1, node.attrs.indent);
  return tr;
}

/**
 * Enter in a list item, as in Word and Obsidian. Before the first word of an item, a plain line opens above it. On an
 * empty item, a nested one steps out a level and a top-level one becomes a plain line (the list ends there). Otherwise
 * the item splits, and the new one gets the same marker: a number counts on, a task starts unticked. The line break and
 * the new marker are two steps to undo, so undo leaves just the line. A selection is deleted first: one starting in an
 * item and running on into other lines leaves the rest of the last one in the item, so the list carries on as well.
 */
export const listEnter: Command = (state, dispatch, view) => {
  const sel = state.selection;
  if (!isItem(sel.$from.parent)) return false;
  const tr = state.tr;
  if (!sel.empty) deleteSelectionSafe(tr);
  const $c = tr.selection.$from;
  if (!tr.selection.empty || !isItem($c.parent)) return false;
  const item = $c.parent;
  const pos = $c.before();
  const attrs = item.attrs as ListItemAttrs;
  const empty = !lineText(item).trim();
  if ($c.parentOffset === 0 && !empty) {
    tr.insert(pos, state.schema.nodes.paragraph.create());
    dispatch?.(tr.scrollIntoView());
    return true;
  }
  if (empty) {
    if (attrs.indent) shiftItems(tr, [{ node: item, pos }], true);
    else {
      tr.replaceWith(pos + 1, pos + 1 + item.content.size, []);
      itemToParagraph(tr, pos);
      tr.setSelection(TextSelection.create(tr.doc, pos + 1));
    }
    dispatch?.(tr.scrollIntoView());
    return true;
  }
  // first the line break (the part after the caret on a line of its own), then its marker
  tr.split($c.pos, 1, [{ type: state.schema.nodes.paragraph }]);
  return inTwoSteps(state, dispatch, view, tr.scrollIntoView(), (s) => {
    const $n = s.selection.$from;
    if ($n.parent.type.name !== 'paragraph') return null;
    const at = $n.before();
    const marker: ListItemAttrs = {
      ...attrs,
      checked: false,
      check: ' ',
      num: attrs.kind === 'ol' ? String((Number(attrs.num) || 0) + 1) : attrs.num,
    };
    const t = s.tr.setNodeMarkup(at, s.schema.nodes.listItem, marker);
    return attrs.kind === 'ol' ? renumber(t, at) : t;
  });
};

/** Ticks or unticks the task at `pos` (the position before it). The caret stays where it is. */
export const toggleTask = (pos: number): Command => (state, dispatch) => {
  const node = pos >= 0 && pos < state.doc.content.size ? state.doc.nodeAt(pos) : null;
  if (!isItem(node) || node!.attrs.kind !== 'task') return false;
  const checked = !node!.attrs.checked;
  dispatch?.(state.tr.setNodeMarkup(pos, null, { ...node!.attrs, checked, check: checked ? 'x' : ' ' }));
  return true;
};

/** A new list item's marker of `kind`, at `indent`. */
const markerOf = (kind: ListKind, indent: string, num = 1): Partial<ListItemAttrs> => ({
  kind, indent, bullet: '-', num: String(num), delim: '.', checked: false, check: ' ', gap: ' ', sep: ' ',
});

/**
 * The selected lines into a bullet, numbered or task list, or back into plain lines when they all already are one.
 * Of several lines, blank ones are left be. Headings become items too; a numbered list counts on from one above it.
 */
export const toggleList = (kind: ListKind): Command => (state, dispatch) => {
  const blocks = selectedBlocks(state).filter((b) => /^(paragraph|heading|listItem)$/.test(b.node.type.name));
  if (!blocks.length) return false;
  const used = blocks.filter((b, i) => blocks.length === 1 || i === 0 || b.node.type.name !== 'paragraph' || lineText(b.node).trim());
  const off = used.every((b) => isItem(b.node) && b.node.attrs.kind === kind);
  if (!dispatch) return true;
  const gone = used.filter((b) => isItem(b.node) && b.node.attrs.kind === 'ol' && (off || kind !== 'ol'));
  const tr = state.tr;
  const { paragraph, listItem } = state.schema.nodes;
  // new numbers go on from a numbered item just above, written as it is (1) stays 1))
  const above = state.doc.resolve(used[0].pos).nodeBefore;
  const delim = isItem(above) && above!.attrs.kind === 'ol' ? above!.attrs.delim : '.';
  let n = used.length;
  for (const { node, pos } of [...used].reverse()) {
    if (off) {
      // a nested item's indent stays, as the spaces before the line's words (the old editor kept them)
      tr.setNodeMarkup(pos, paragraph, null);
      if (node.attrs.indent) tr.insertText(node.attrs.indent, pos + 1);
      continue;
    }
    let indent = '';
    if (isItem(node)) indent = node.attrs.indent;
    else if (node.type === paragraph) {
      // spaces before a line's words are its indent
      indent = lineText(node).match(/^[ \t]*/)![0];
      if (indent) tr.delete(pos + 1, pos + 1 + indent.length);
    }
    const keep = isItem(node) && node.attrs.kind === kind;
    tr.setNodeMarkup(pos, listItem, keep ? node.attrs : { ...markerOf(kind, indent, n), delim });
    n--;
  }
  if (!off && kind === 'ol') renumber(tr, tr.mapping.map(used[0].pos));
  // numbered items made plain lines, bullets or tasks: the numbers after them go on from theirs
  countOnAfter(tr, gone);
  dispatch(tr.scrollIntoView());
  return true;
};

/* ---------- restarting and continuing numbers ---------- */

/** The numbered item the caret is on: the node, the position before it, and how deep it is. */
function olAt(state: EditorState) {
  const $f = state.selection.$from;
  const node = $f.parent;
  if (!isItem(node) || node.attrs.kind !== 'ol') return null;
  return { node, pos: $f.before(), w: indentWidth(node.attrs.indent), $f };
}

/**
 * The numbered item the one at index `i` of `parent` counts on from, at its level (width `w`): back past deeper items,
 * and past plain lines into the list before. Null at a shallower item or a bullet there. `inRun`: no line between.
 */
function countsFrom(parent: PMNode, i: number, w: number): { node: PMNode; inRun: boolean } | null {
  let inRun = true;
  for (let k = i - 1; k >= 0; k--) {
    const n = parent.child(k);
    if (!isItem(n)) {
      inRun = false;
      continue;
    }
    const x = indentWidth(n.attrs.indent);
    if (x > w) continue;
    return x === w && n.attrs.kind === 'ol' ? { node: n, inRun } : null;
  }
  return null;
}

/** The item at index `i` of `parent` and the numbered ones after it at its level written the same way: [pos, node]. */
function sameRun(parent: PMNode, i: number, start: number): [number, PMNode][] {
  const first = parent.child(i);
  const w = indentWidth(first.attrs.indent);
  const out: [number, PMNode][] = [];
  let p = start;
  for (let k = i; k < parent.childCount; k++) {
    const n = parent.child(k);
    if (k > i) {
      if (!isItem(n)) break;
      const x = indentWidth(n.attrs.indent);
      if (x < w || (x === w && (n.attrs.kind !== 'ol' || n.attrs.delim !== first.attrs.delim))) break;
      if (x === w) out.push([p, n]);
    } else out.push([p, n]);
    p += n.nodeSize;
  }
  return out;
}

/**
 * Restart numbering, as Word's: the numbered item at the caret becomes 1 and those after it at its level count on
 * from it. In the middle of a list, the item and the rest are written with the other delimiter (`1)` after `2.`), so
 * the text keeps the new list apart as CommonMark reads it. False off a numbered item, or when it's 1 already and
 * counts from nothing before.
 */
export const restartNumbering: Command = (state, dispatch) => {
  const at = olAt(state);
  if (!at) return false;
  const { node, pos, w, $f } = at;
  const from = countsFrom($f.node(-1), $f.index(-1), w);
  const joined = !!from?.inRun && from.node.attrs.delim === node.attrs.delim;
  if (!joined && node.attrs.num === '1') return false;
  if (!dispatch) return true;
  const tr = state.tr;
  if (joined) {
    const other = node.attrs.delim === '.' ? ')' : '.';
    for (const [p] of sameRun($f.node(-1), $f.index(-1), pos)) tr.setNodeAttribute(p, 'delim', other);
  }
  tr.setNodeAttribute(pos, 'num', '1');
  dispatch(renumber(tr, pos, 1));
  return true;
};

/**
 * Continue numbering, as Word's: the numbered item at the caret (and the ones after it at its level) counts on from
 * the numbered list before it, across plain lines too. False when there's none, or it counts on already.
 */
export const continueNumbering: Command = (state, dispatch) => {
  const at = olAt(state);
  if (!at) return false;
  const { node, pos, w, $f } = at;
  const from = countsFrom($f.node(-1), $f.index(-1), w);
  if (!from) return false;
  const n = (Number(from.node.attrs.num) || 1) + 1;
  if (from.inRun ? from.node.attrs.delim === node.attrs.delim : Number(node.attrs.num) === n) return false;
  if (!dispatch) return true;
  const tr = state.tr;
  // in the same list, written as the numbers before; after plain lines, a list's first number is kept as written
  if (from.inRun) for (const [p] of sameRun($f.node(-1), $f.index(-1), pos)) tr.setNodeAttribute(p, 'delim', from.node.attrs.delim);
  dispatch(renumber(tr, pos, n));
  return true;
};
