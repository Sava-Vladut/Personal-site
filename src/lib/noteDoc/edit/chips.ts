// A tag already in the note (a chip: a person, a song, a [[link]]), as the keys and its card work with it: the arrows
// go past it as past a letter, Backspace or Delete next to it selects it first (the next press takes it out), and its
// card can take it out or put its @ (or [[) back for another to be picked.
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, TextSelection, type Command, type EditorState } from '@tiptap/pm/state';
import { LEAF } from './util';

const CHIPS = new Set(['person', 'song', 'wiki']);

/** Whether `node` is a tag's chip. */
export const isChip = (node: PMNode | null | undefined): node is PMNode => !!node && CHIPS.has(node.type.name);

/** The chip just before (dir -1) or after (dir 1) the caret, with the position before it; null without one. */
function chipBeside(state: EditorState, dir: -1 | 1): { node: PMNode; pos: number } | null {
  const sel = state.selection;
  if (!(sel instanceof TextSelection) || !sel.empty) return null;
  const $c = sel.$head;
  const node = $c.textOffset ? null : dir < 0 ? $c.nodeBefore : $c.nodeAfter;
  return isChip(node) ? { node, pos: dir < 0 ? $c.pos - node.nodeSize : $c.pos } : null;
}

/**
 * Left or Right with a chip beside the caret: past it, in one press, as past one letter. (ProseMirror's own selects
 * the chip on the first press and only goes past it on the second, so every tag took two.)
 */
export const stepOverChip = (dir: -1 | 1): Command => (state, dispatch) => {
  const at = chipBeside(state, dir);
  if (!at) return false;
  dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, dir < 0 ? at.pos : at.pos + at.node.nodeSize)).scrollIntoView());
  return true;
};

/**
 * Backspace (dir -1) or Delete (dir 1) with a chip beside the caret: the chip is selected, lit as one thing, and the
 * next press takes it out (a tag never goes by one stray key, as a picture doesn't).
 */
export const selectChip = (dir: -1 | 1): Command => (state, dispatch) => {
  const at = chipBeside(state, dir);
  if (!at) return false;
  dispatch?.(state.tr.setSelection(NodeSelection.create(state.doc, at.pos)).scrollIntoView());
  return true;
};

/** The one character at `pos` in its line ('' at either end of it), a chip as LEAF. */
const charAt = (state: EditorState, pos: number) => {
  const $p = state.doc.resolve(pos);
  return pos < $p.start() || pos >= $p.end() ? '' : state.doc.textBetween(pos, pos + 1, undefined, LEAF);
};

/**
 * Takes the chip at `pos` out of the note (its card's Remove), and one space with it so no two are left in a row:
 * the one after it ("met @Ann today" → "met today"), or the one before it when the sentence goes on with a full stop or
 * a comma, or ends ("with @Ann." → "with."). The caret goes where it was.
 */
export const removeChip = (pos: number): Command => (state, dispatch) => {
  const node = state.doc.nodeAt(pos);
  if (!isChip(node)) return false;
  let from = pos, to = pos + node.nodeSize;
  const before = charAt(state, pos - 1), after = charAt(state, to);
  if (after === ' ' && (!before || /\s/.test(before))) to++;
  else if (before === ' ' && (!after || /^[.,;:!?)\]}”’]/.test(after))) from--;
  if (dispatch) {
    const tr = state.tr.delete(from, to);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, from)).scrollIntoView());
  }
  return true;
};

/**
 * Puts the @ (a person, a book or a song) or [[ (a link) that made the chip at `pos` back in its place, with its
 * styles and the caret after it, so the suggestions come up and another can be picked (its card's Change). A space
 * goes before it when it would otherwise stick to a word, as the @ button does it.
 */
export const retypeChip = (pos: number): Command => (state, dispatch) => {
  const node = state.doc.nodeAt(pos);
  if (!isChip(node)) return false;
  const $p = state.doc.resolve(pos);
  if ($p.parent.type.spec.code) return false;
  const before = $p.parent.textBetween(0, $p.parentOffset, undefined, LEAF);
  const text = (before && !/[\s([{"'“‘]$/.test(before) ? ' ' : '') + (node.type.name === 'wiki' ? '[[' : '@');
  if (dispatch) {
    const tr = state.tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(text, node.marks));
    dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + text.length)).scrollIntoView());
  }
  return true;
};
