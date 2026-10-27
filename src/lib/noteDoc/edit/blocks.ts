// What Enter, Shift+Enter, Backspace, Delete and Tab do, and the paragraph styles (Normal, the headings, Quote) and
// blocks (a divider, a code block, a callout) the ribbon puts in. Ported from the old editor (lib/markdown.ts listKey and
// deleteKey, components/ribbon/commands.ts setNormal): what it did to the lines of text, done to the blocks here.
//
// Pictures are never taken out by a stray key: Backspace just after one and Delete just before one do nothing (an
// empty line after a picture goes when it can, as long as the picture keeps a line of text below it).
import { NodeRange, type Node as PMNode, type ResolvedPos } from '@tiptap/pm/model';
import { EditorState, Selection, TextSelection, type Command, type Transaction } from '@tiptap/pm/state';
import { findWrapping } from '@tiptap/pm/transform';
import { closeHistory } from '@tiptap/pm/history';
import { normalizeTr } from '../normalize';
import { countOnAfter, indentList, itemToParagraph, listEnter } from './lists';
import { deleteSelectionSafe, first, inQuote, liftBlocks, lineText, replaceSelectionText, selectedBlocks, unCallout } from './util';

const named = (n: PMNode | null | undefined, ...names: string[]) => !!n && names.includes(n.type.name);
const isQuote = (n: PMNode | null | undefined) => named(n, 'blockquote', 'callout');

/** A code block's opening line typed on a line of its own: ``` or ~~~, maybe with what follows it (```js). */
const FENCE_LINE = /^[ \t]*(```|~~~)[^`~\n]*$/;

/* ---------- Enter ---------- */

/** The styles the caret had (Bold set with nothing selected, say) go on to the new line, as in Word. */
function keepMarks(tr: Transaction, state: EditorState): Transaction {
  const marks = (state.storedMarks ?? state.selection.$from.marks()).filter((m) => m.type.name !== 'escaped');
  if (marks.length && tr.selection.$from.parent.inlineContent) tr.ensureMarks(marks);
  return tr;
}

/** Enter in a code block: a new line, and out of the block after two empty lines at its end (a third Enter). */
export const codeEnter: Command = (state, dispatch) => {
  const { $from, $to } = state.selection;
  if (!$from.parent.type.spec.code || $from.parent !== $to.parent) return false;
  const text = $from.parent.textContent;
  // at the very start of code with no line above it to go to: a plain line opens above (else there'd be no way to
  // write before a note's first code block)
  if ($from.pos === $to.pos && $from.parentOffset === 0 && text && !lineBefore($from)) {
    dispatch?.(state.tr.insert($from.before(), state.schema.nodes.paragraph.create()).scrollIntoView());
    return true;
  }
  if ($from.pos === $to.pos && $from.parentOffset === text.length && text.endsWith('\n\n')) {
    const tr = state.tr.delete($from.pos - 2, $from.pos);
    if (dispatch) dispatch(leaveCode(tr, true).scrollIntoView());
    return true;
  }
  dispatch?.(state.tr.insertText('\n').scrollIntoView());
  return true;
};

/** Whether there's a line of text just before the block the position is in (in the same container). */
function lineBefore($p: ResolvedPos, depth = $p.depth): boolean {
  const i = $p.index(depth - 1);
  return i > 0 && $p.node(depth - 1).child(i - 1).isTextblock;
}

/** Puts the caret on a new line just after the code block it's in (or the line after it, unless `fresh`). */
function leaveCode(tr: Transaction, fresh: boolean): Transaction {
  const $c = tr.selection.$from;
  const after = $c.after();
  const next = tr.doc.resolve(after).nodeAfter;
  if (!fresh && next?.isTextblock) return tr.setSelection(TextSelection.create(tr.doc, after + 1));
  tr.insert(after, tr.doc.type.schema.nodes.paragraph.create());
  return tr.setSelection(TextSelection.create(tr.doc, after + 1));
}

/**
 * Out of a code block, onto the line after it, for ArrowDown on the block's last line (as drawn: a long line wraps).
 * A line is made only when there are no words after the block to go to; otherwise the arrow moves as it always does.
 */
export const exitCode: Command = (state, dispatch, view) => {
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.type.spec.code || $from.parent.textContent.includes('\n', $from.parentOffset)) return false;
  if (view && !view.endOfTextblock('down')) return false;
  const next = state.doc.resolve($from.after()).nodeAfter;
  if (!next?.isTextblock && Selection.findFrom(state.doc.resolve($from.after()), 1, true)) return false;
  dispatch?.(leaveCode(state.tr, false).scrollIntoView());
  return true;
};

/** Enter at the end of a line that's only a fence (```js) makes it a code block, with the caret inside. */
export const fenceEnter: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  const p = $from.parent;
  if (!empty || p.type.name !== 'paragraph' || $from.parentOffset !== p.content.size) return false;
  let plain = true;
  p.forEach((c) => (plain &&= c.isText && !c.marks.length));
  const text = p.textContent;
  if (!plain || !FENCE_LINE.test(text)) return false;
  const fence = text.trim().slice(0, 3);
  if (dispatch) {
    const pos = $from.before();
    const tr = state.tr.replaceWith(pos, pos + p.nodeSize, state.schema.nodes.codeBlock.create({ open: text, close: fence }));
    dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1)).scrollIntoView());
  }
  return true;
};

/**
 * Splits the textblock at the caret (the selection deleted first), the part after it becoming a plain paragraph in the
 * same place. At the start of a line with words, a plain line opens above instead and the line stays what it is.
 */
function splitPlain(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const tr = state.tr;
  if (!state.selection.empty) deleteSelectionSafe(tr);
  const $c = tr.selection.$from;
  const tb = $c.parent;
  if (!tb.isTextblock) return false;
  const p = state.schema.nodes.paragraph;
  if ($c.parentOffset === 0 && tb.content.size && tb.type !== p) tr.insert($c.before(), p.create());
  else keepMarks(tr.split($c.pos, 1, [{ type: p }]), state);
  dispatch?.(tr.scrollIntoView());
  return true;
}

/** Enter on a heading: before its words, a plain line opens above; elsewhere what's after the caret becomes a plain line. */
export const headingEnter: Command = (state, dispatch) => {
  if (state.selection.$from.parent.type.name !== 'heading') return false;
  return splitPlain(state, dispatch);
};

/** Enter in a callout's title: what's after the caret becomes the first line of its body, the caret going with it. */
export const titleEnter: Command = (state, dispatch) => {
  const { $from, $to } = state.selection;
  if ($from.parent.type.name !== 'calloutTitle' || $from.parent !== $to.parent) return false;
  const tr = state.tr;
  // before the title's words, with no line above the callout: a plain line opens above it
  if (state.selection.empty && $from.parentOffset === 0 && $from.parent.content.size && !lineBefore($from, $from.depth - 1)) {
    dispatch?.(tr.insert($from.before(-1), state.schema.nodes.paragraph.create()).scrollIntoView());
    return true;
  }
  if (!state.selection.empty) deleteSelectionSafe(tr);
  tr.split(tr.selection.from, 1, [{ type: state.schema.nodes.paragraph }]);
  dispatch?.(tr.scrollIntoView());
  return true;
};

/** Enter on an empty line of a quote or callout: the line comes out of it (splitting it), ending the quote there. */
export const quoteEnter: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  const p = $from.parent;
  if (!empty || p.type.name !== 'paragraph' || p.content.size || !isQuote($from.node(-1))) return false;
  const tr = state.tr;
  if (!liftBlocks(tr, [$from.before()])) return false;
  dispatch?.(tr.scrollIntoView());
  return true;
};

/** Enter: code, a fence line, list items, headings, callout titles and empty quote lines have their own; else a split. */
export const enter: Command = first(codeEnter, fenceEnter, listEnter, headingEnter, titleEnter, quoteEnter, (state, dispatch) => {
  const { $from, $to } = state.selection;
  if (!$from.parent.isTextblock || !$to.parent.isTextblock) return false;
  const tr = state.tr;
  if (!state.selection.empty) deleteSelectionSafe(tr);
  if (!tr.selection.$from.parent.isTextblock) return false;
  keepMarks(tr.split(tr.selection.from, 1, [{ type: state.schema.nodes.paragraph }]), state);
  dispatch?.(tr.scrollIntoView());
  return true;
});

/**
 * Shift+Enter: a plain new line in the same place (a heading's, item's or title's words after the caret go on a plain
 * line, never a new heading or item); in code, a new line of code.
 */
export const newLine: Command = (state, dispatch) => {
  const { $from } = state.selection;
  if ($from.parent.type.spec.code) {
    dispatch?.(replaceSelectionText(state.tr, '\n').scrollIntoView());
    return true;
  }
  if (!$from.parent.isTextblock) return false;
  if ($from.parent.type.name === 'calloutTitle') return titleEnter(state, dispatch);
  return splitPlain(state, dispatch);
};

/* ---------- Backspace and Delete ---------- */

/** Backspace or Delete on a selection: it goes, as ProseMirror deletes it where it can (deleteSelectionSafe). */
const deleteSelected: Command = (state, dispatch) => {
  dispatch?.(deleteSelectionSafe(state.tr).scrollIntoView());
  return true;
};

/** The top-level block a position is in, and whether the position is at its very start / end (nested blocks included). */
function topEdge($c: ResolvedPos, end: boolean): number | null {
  for (let d = $c.depth; d > 0; d--) {
    const edge = end ? $c.index(d) === $c.node(d).childCount - 1 || d === $c.depth : $c.index(d) === 0 || d === $c.depth;
    if (!edge) return null;
  }
  return $c.index(0);
}

/**
 * Backspace at the start of a line, as in Notion and Word: a nested item steps out a level, an item, heading or quote
 * line turns back into plain text (numbers after it count again), a callout's title takes the callout with it (its
 * body stays a quote). Just after a picture, an empty line goes when the picture keeps text below it; nothing else does.
 * Otherwise (and anywhere but a line's start) it's the usual Backspace. A selection is taken out safely (deleteSelectionSafe:
 * ProseMirror's own throws on one from a quote into a callout).
 */
export const backspace: Command = (state, dispatch) => {
  const sel = state.selection;
  if (!sel.empty) return deleteSelected(state, dispatch);
  if (!(sel instanceof TextSelection) || sel.$from.parentOffset > 0) return false;
  const $c = sel.$from;
  const tb = $c.parent;
  const pos = $c.before();
  const tr = state.tr;
  if (tb.type.name === 'listItem') {
    if (tb.attrs.indent) indentList(true)(state, dispatch);
    else dispatch?.(itemToParagraph(tr, pos));
    return true;
  }
  if (tb.type.name === 'heading') {
    dispatch?.(tr.setNodeMarkup(pos, state.schema.nodes.paragraph, null));
    return true;
  }
  if (tb.type.name === 'calloutTitle') {
    if (dispatch && unCallout(tr, $c.before(-1))) dispatch(tr);
    return true;
  }
  if (isQuote($c.node(-1))) {
    if (dispatch && liftBlocks(tr, [pos])) dispatch(tr);
    return true;
  }
  // next to code, lines never run into each other (code would take the words' styles and tags off, and a code
  // block's lines would run together into one): the caret just goes over, and an empty line goes
  const prev = $c.index(-1) > 0 ? $c.node(-1).child($c.index(-1) - 1) : null;
  const caret = (at: number) => dispatch?.(tr.setSelection(TextSelection.create(tr.doc, at)).scrollIntoView());
  if (tb.type.spec.code) {
    if (!tb.content.size) dispatch?.(tr.setNodeMarkup(pos, state.schema.nodes.paragraph, null));
    else if (prev?.isTextblock) caret(pos - 1);
    return true;
  }
  if (prev?.type.spec.code && tb.type.name === 'paragraph') {
    if (!tb.content.size) tr.delete(pos, pos + tb.nodeSize);
    caret(pos - 1);
    return true;
  }
  // a line just after a quote or callout joins its last line (it went out of it with one Backspace; a second one
  // doesn't put it back in as a line of its own, it runs on from the line above, as anywhere else)
  if (tb.type.name === 'paragraph' && $c.depth === 1 && isQuote(prev)) {
    const end = Selection.findFrom(state.doc.resolve(pos), -1, true);
    if (!end || end.$from.parent.type.spec.code) return true;
    if (!tb.content.size) tr.delete(pos, pos + tb.nodeSize);
    else tr.delete(end.from, $c.pos);
    dispatch?.(tr.setSelection(TextSelection.create(tr.doc, end.from)).scrollIntoView());
    return true;
  }
  const top = topEdge($c, false);
  if (top !== null && top > 0 && state.doc.child(top - 1).type.name === 'media') {
    // only an empty line on its own goes, and only when the picture keeps something other than a picture below it
    const next = state.doc.maybeChild(top + 1);
    if ($c.depth === 1 && tb.type.name === 'paragraph' && !tb.content.size && next && next.type.name !== 'media' && dispatch) {
      tr.delete(pos, pos + tb.nodeSize);
      dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos))).scrollIntoView());
    }
    return true;
  }
  return false;
};

/**
 * Delete at the end of the line just before a picture does nothing (the picture never goes by a stray key). Next to
 * code, lines don't run into each other either (as with Backspace): an empty line goes, else nothing. At the end of a
 * quote or callout, the line after it runs on from its last line (an empty one just goes), as Backspace at that line's
 * start does: it never goes into the quote as a line of its own. A selection is taken out as Backspace does it.
 */
export const deleteForward: Command = (state, dispatch) => {
  const sel = state.selection;
  if (!sel.empty) return deleteSelected(state, dispatch);
  if (!(sel instanceof TextSelection) || sel.$from.parentOffset < sel.$from.parent.content.size) return false;
  const $c = sel.$from;
  const tb = $c.parent;
  const next = $c.node(-1).maybeChild($c.index(-1) + 1);
  if (next && (tb.type.spec.code ? next.isTextblock : next.type.spec.code)) {
    const pos = $c.before(), after = $c.after();
    if (tb.type.spec.code && !next.content.size) dispatch?.(state.tr.delete(after, after + next.nodeSize));
    else if (!tb.type.spec.code && !tb.content.size && tb.type.name === 'paragraph') {
      const tr = state.tr.delete(pos, after);
      dispatch?.(tr.setSelection(TextSelection.create(tr.doc, pos + 1)).scrollIntoView());
    }
    return true;
  }
  const top = topEdge($c, true);
  const after = top === null ? null : state.doc.maybeChild(top + 1);
  if (top !== null && isQuote(state.doc.child(top)) && after?.isTextblock) {
    if (!tb.type.spec.code && !after.type.spec.code && dispatch) {
      const at = $c.after(1);
      dispatch((after.content.size ? state.tr.delete($c.pos, at + 1) : state.tr.delete(at, at + after.nodeSize)).scrollIntoView());
    }
    return true;
  }
  return after?.type.name === 'media';
};

/* ---------- Tab ---------- */

/** One tab or up to four spaces off the start of `s`. */
const OUTDENT = /^(\t| {1,4})/;

/**
 * Tab and Shift+Tab: list items move a level in or out; elsewhere Tab puts in a tab (at the start of each selected
 * line, for several) and Shift+Tab takes one off. Always handled, so the key never takes the caret out of the note.
 */
export const tab = (out: boolean): Command => (state, dispatch) => {
  if (indentList(out)(state, dispatch)) return true;
  const { $from, $to, from, to, empty } = state.selection;
  const tr = state.tr;
  if ($from.parent.type.spec.code) {
    if (!out) replaceSelectionText(tr, '\t');
    else {
      // the code line the caret is on
      const text = $from.parent.textContent;
      const start = text.lastIndexOf('\n', $from.parentOffset - 1) + 1;
      const m = text.slice(start).match(OUTDENT);
      if (m) tr.delete($from.start() + start, $from.start() + start + m[0].length);
    }
  } else {
    const blocks = selectedBlocks(state).filter((b) => b.node.type.name === 'paragraph');
    // a selection of lines (even one, up to the start of the next) moves them; one within a line is typed over
    if (!empty && $from.parent !== $to.parent) {
      for (const { node, pos } of blocks.reverse()) {
        if (!out) tr.insertText('\t', pos + 1);
        else {
          const m = lineText(node).match(OUTDENT);
          if (m) tr.delete(pos + 1, pos + 1 + m[0].length);
        }
      }
    } else if (out) {
      const m = $from.parent.type.name === 'paragraph' ? lineText($from.parent).match(OUTDENT) : null;
      if (m) tr.delete($from.start(), $from.start() + m[0].length);
    } else if (!($from.parentOffset === 0 && /^(heading|calloutTitle)$/.test($from.parent.type.name)) && $from.parent.isTextblock) {
      // a tab before a heading's words would read as part of its marker
      tr.insertText('\t', from, to);
    }
  }
  if (tr.docChanged) dispatch?.(tr.scrollIntoView());
  return true;
};

/* ---------- paragraph styles ---------- */

export type Style = 'normal' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'quote';

/** The selected lines that take a style: of several, blank lines are left be. */
function styled(state: EditorState, types: RegExp) {
  const blocks = selectedBlocks(state).filter((b) => types.test(b.node.type.name));
  return blocks.filter((b, i) => blocks.length === 1 || i === 0 || b.node.type.name !== 'paragraph' || lineText(b.node).trim());
}

/** Whether every selected line is in a quote or a callout. */
const allQuoted = (state: EditorState) => {
  const blocks = selectedBlocks(state);
  return blocks.length > 0 && blocks.every((b) => inQuote(state.doc.resolve(b.pos + 1)));
};

/** Puts the selected blocks in a quote (pictures can't go in one: the blocks around them get one each). */
function wrapQuote(state: EditorState, tr: Transaction): boolean {
  const { $from, $to } = state.selection;
  let range = $from.blockRange($to);
  // a callout's title can't go in a quote on its own: the whole callout does
  while (range && range.parent.type.name === 'callout' && range.startIndex === 0 && range.depth > 0) {
    const d = range.depth;
    range = new NodeRange(state.doc.resolve(range.$from.before(d)), state.doc.resolve(range.$to.after(d)), d - 1);
  }
  if (!range) return false;
  // the blocks between pictures, and between quotes and callouts (their lines are quoted already: they stay as they are)
  const runs: [number, number][] = [];
  let pos = range.start;
  for (let i = range.startIndex; i < range.endIndex; i++) {
    const child = range.parent.child(i);
    if (child.type.name === 'media' || isQuote(child)) runs.push([pos + child.nodeSize, pos + child.nodeSize]);
    else if (!runs.length) runs.push([pos, pos + child.nodeSize]);
    else runs[runs.length - 1][1] = pos + child.nodeSize;
    pos += child.nodeSize;
  }
  let done = false;
  for (const [a, b] of runs.reverse()) {
    if (a === b) continue;
    const r = new NodeRange(tr.doc.resolve(a), tr.doc.resolve(b), range.depth);
    const wrapping = findWrapping(r, state.schema.nodes.blockquote);
    if (!wrapping) continue;
    tr.wrap(r, wrapping);
    done = true;
  }
  // the new quotes join the quotes beside them, and get an empty line from a callout beside them (normalize.ts)
  const fix = done ? normalizeTr(EditorState.create({ doc: tr.doc })) : null;
  if (fix) for (const step of fix.steps) tr.step(step);
  return done;
}

/** Quote: puts the selected lines in a quote, or takes them out of theirs when they're all in one already. */
export const toggleQuote: Command = (state, dispatch) => {
  const tr = state.tr;
  const done = allQuoted(state) ? liftBlocks(tr, selectedBlocks(state).map((b) => b.pos)) : wrapQuote(state, tr);
  if (done) dispatch?.(tr.scrollIntoView());
  return done;
};

/**
 * Normal: the selected lines stop being headings, and come out of quotes and callouts (one level), as plain lines.
 * Lists stay lists. False when they were plain already.
 */
const setNormal: Command = (state, dispatch) => {
  const tr = state.tr;
  const blocks = selectedBlocks(state);
  for (const { node, pos } of blocks) if (node.type.name === 'heading') tr.setNodeMarkup(pos, state.schema.nodes.paragraph, null);
  const quoted = blocks.filter((b) => isQuote(state.doc.resolve(b.pos).parent)).map((b) => b.pos);
  liftBlocks(tr, quoted);
  if (!tr.docChanged) return false;
  dispatch?.(tr.scrollIntoView());
  return true;
};

/**
 * A style from the gallery (or its shortcut), on the selected lines: Normal, a heading (from a line, an item or a
 * heading of another level), or Quote. Applying the style the lines have already leaves them be (returns false).
 */
export const setStyle = (style: Style): Command => (state, dispatch) => {
  if (style === 'normal') return setNormal(state, dispatch);
  if (style === 'quote') return allQuoted(state) ? false : toggleQuote(state, dispatch);
  const level = Number(style[1]);
  const blocks = styled(state, /^(paragraph|heading|listItem)$/);
  if (!blocks.length || blocks.every((b) => b.node.type.name === 'heading' && b.node.attrs.level === level)) return false;
  if (!dispatch) return true;
  const tr = state.tr;
  const { heading } = state.schema.nodes;
  for (const { node, pos } of [...blocks].reverse()) tr.setNodeMarkup(pos, heading, { level, sep: node.type === heading ? node.attrs.sep : ' ' });
  // numbered items after them count again from their number, as when Backspace takes an item's marker off
  countOnAfter(tr, blocks.filter((b) => b.node.type.name === 'listItem' && b.node.attrs.kind === 'ol'));
  dispatch(tr.scrollIntoView());
  return true;
};

/* ---------- blocks ---------- */

export type BlockKind = 'hr' | 'code' | 'callout';

/**
 * Puts a divider, code block or callout in at the caret: in place of an empty line, or before or after the line at
 * its start or end, or splitting it (the words after go on a plain line below). A divider leaves the caret on the line
 * after it; a code block or callout takes the caret inside. Not in code.
 */
export const insertBlock = (kind: BlockKind): Command => (state, dispatch) => {
  const tr = state.tr;
  if (!state.selection.empty) deleteSelectionSafe(tr);
  const $c = tr.selection.$from;
  const tb = $c.parent;
  if (!tb.isTextblock || tb.type.spec.code) return false;
  if (!dispatch) return true;
  const n = state.schema.nodes;
  const node = kind === 'hr' ? n.horizontalRule.create()
    : kind === 'code' ? n.codeBlock.create({ open: '```', close: '```' })
    : n.callout.create({ kind: 'note', fold: '', sep: ' ' }, n.calloutTitle.create());
  let at: number;
  if (!tb.content.size && tb.type.name !== 'calloutTitle') tr.replaceWith((at = $c.before()), $c.after(), node);
  else {
    if (tb.type.name === 'calloutTitle') at = $c.after(); // the first thing in the callout's body
    else if ($c.parentOffset === 0) at = $c.before();
    else if ($c.parentOffset === tb.content.size) at = $c.after();
    else {
      tr.split($c.pos, 1, [{ type: n.paragraph }]);
      at = $c.pos + 1;
    }
    tr.insert(at, node);
  }
  if (kind !== 'hr') tr.setSelection(TextSelection.create(tr.doc, at + (kind === 'callout' ? 2 : 1)));
  else {
    const next = tr.doc.resolve(at + node.nodeSize).nodeAfter;
    if (!next?.isTextblock) tr.insert(at + node.nodeSize, n.paragraph.create());
    tr.setSelection(TextSelection.create(tr.doc, at + node.nodeSize + 1));
  }
  dispatch(tr.scrollIntoView());
  return true;
};

/* ---------- moving lines ---------- */

/**
 * Alt+Shift+Up / Down, as in Word: the line the caret is on (or the lines selected, a quote or list item with them)
 * swaps places with the block before or after it, the caret staying in its words. A line that's all of its quote takes
 * the quote with it; a callout's title moves the whole callout. One step to undo each. False at the top or bottom.
 */
export const moveBlocks = (dir: -1 | 1): Command => (state, dispatch) => {
  const blocks = selectedBlocks(state);
  if (!blocks.length) return false;
  const last = blocks[blocks.length - 1];
  let $a = state.doc.resolve(blocks[0].pos), $b = state.doc.resolve(last.pos + last.node.nodeSize);
  // the children of one parent the lines are in (a selection running into a quote takes the whole quote)
  const range = $a.blockRange($b);
  if (!range) return false;
  let { depth, startIndex: i, endIndex: j } = range;
  let parent = range.parent;
  // all of a quote, or a callout's title: the quote or callout moves
  while (depth > 0 && ((i === 0 && j === parent.childCount) || (parent.type.name === 'callout' && i === 0))) {
    $a = state.doc.resolve($a.before(depth));
    depth--;
    parent = $a.node(depth);
    i = $a.index(depth);
    j = i + 1;
  }
  const k = dir < 0 ? i - 1 : j;
  if (k < 0 || k >= parent.childCount || (parent.type.name === 'callout' && k === 0)) return false;
  if (!dispatch) return true;
  const start = $a.posAtIndex(i, depth), end = $a.posAtIndex(j, depth);
  const other = parent.child(k);
  const tr = state.tr;
  // the block beside them goes to their other side: the lines themselves never move in the document, so the caret
  // and the selection map along unchanged
  if (dir < 0) {
    const at = start - other.nodeSize;
    tr.delete(at, start).insert(end - other.nodeSize, other);
  } else {
    tr.delete(end, end + other.nodeSize).insert(start, other);
  }
  dispatch(closeHistory(tr).scrollIntoView());
  return true;
};
