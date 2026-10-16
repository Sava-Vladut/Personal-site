// Lists, as the old editor kept them (lib/markdown.ts listKey, indentLines, renumber): flat, one item a line, how
// deep each sits written in its indent. Enter carries a list on, an empty item ends it (a nested one steps out a level
// first), Tab and Shift+Tab move items in and out, and numbered items are counted again after each change.
import type { Node as PMNode } from '@tiptap/pm/model';
import { TextSelection, type Command, type Transaction } from '@tiptap/pm/state';
import type { ListItemAttrs } from '../schema';
import type { ListKind } from '../syntax';
import { deleteSelectionSafe, inTwoSteps, lineText, selectedBlocks, type At } from './util';

const isItem = (n: PMNode | null | undefined) => n?.type.name === 'listItem';

/** How wide an indent is when counting levels for numbering: a tab is four spaces (the old editor's measure). */
const indentWidth = (indent: string) => [...indent].reduce((n, c) => n + (c === '\t' ? 4 : 1), 0);

/**
 * Counts the numbered items again in the run of list items around the item at `pos` (the position before it): 1, 2,
 * 3… at each level. A list keeps the number it starts from (or starts from `from`, when given), and one nested under
 * an item starts from 1. A number already right is left as written (`01` stays).
 */
export function renumber(tr: Transaction, pos: number, from?: number): Transaction {
  const $p = tr.doc.resolve(pos);
  const parent = $p.parent;
  const at = $p.index();
  if (!isItem(parent.maybeChild(at))) return tr;
  let a = at, b = at;
  while (a > 0 && isItem(parent.child(a - 1))) a--;
  while (b + 1 < parent.childCount && isItem(parent.child(b + 1))) b++;
  let p = $p.start();
  for (let k = 0; k < a; k++) p += parent.child(k).nodeSize;
  const next = new Map<number, number>(); // by indent: the number the next item there gets
  let prev = -1;
  for (let k = a; k <= b; k++) {
    const node = parent.child(k);
    const attrs = node.attrs as ListItemAttrs;
    const w = indentWidth(attrs.indent);
    for (const x of [...next.keys()]) if (x > w) next.delete(x);
    if (attrs.kind === 'ol') {
      const n = next.get(w) ?? (k === a && from !== undefined ? from : k > a && prev < w ? 1 : Number(attrs.num) || 1);
      if (Number(attrs.num) !== n) tr.setNodeMarkup(p, null, { ...attrs, num: String(n) });
      next.set(w, n + 1);
    } else next.delete(w);
    prev = w;
    p += node.nodeSize;
  }
  return tr;
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
  if (node.attrs.kind === 'ol' && isItem(tr.doc.nodeAt(after))) renumber(tr, after, Number(node.attrs.num) || 1);
  return tr;
}

/**
 * Enter in a list item, as in Word and Obsidian. Before the first word of an item, a plain line opens above it. On an
 * empty item, a nested one steps out a level and a top-level one becomes a plain line (the list ends there). Otherwise
 * the item splits, and the new one gets the same marker: a number counts on, a task starts unticked. The line break and
 * the new marker are two steps to undo, so undo leaves just the line.
 */
export const listEnter: Command = (state, dispatch, view) => {
  const sel = state.selection;
  if (!isItem(sel.$from.parent) || sel.$from.parent !== sel.$to.parent) return false;
  const tr = state.tr;
  if (!sel.empty) deleteSelectionSafe(tr);
  const $c = tr.selection.$from;
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
  const tr = state.tr;
  const { paragraph, listItem } = state.schema.nodes;
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
    tr.setNodeMarkup(pos, listItem, keep ? node.attrs : markerOf(kind, indent, n));
    n--;
  }
  if (!off && kind === 'ol') renumber(tr, tr.mapping.map(used[0].pos));
  dispatch(tr.scrollIntoView());
  return true;
};
