// Small pieces the editing commands share: the blocks a selection covers, the word at the caret, taking blocks out of
// a quote or callout, and running a command as two steps to undo.
import { NodeRange, type Node as PMNode } from '@tiptap/pm/model';
import { EditorState, Selection, TextSelection, type Command, type Transaction } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { liftTarget } from '@tiptap/pm/transform';
import type { EditorView } from '@tiptap/pm/view';

/** A letter of a word, the way the old editor counted them (an apostrophe or hyphen inside a word too). */
export const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}_'’-]/u.test(c);

/** What a chip counts as in a line's text, so the text's offsets are the document's positions. */
export const LEAF = '￼';

/** A textblock's text, a chip as one character. */
export const lineText = (node: PMNode, from = 0, to = node.content.size) => node.textBetween(from, to, undefined, LEAF);

/** A node with the position just before it. */
export interface At { node: PMNode; pos: number }

/**
 * The textblocks the selection is in, first to last. A selection that ends at the very start of a block leaves that
 * block out (as a selection of whole lines does), unless it's the only one.
 */
export function selectedBlocks(state: Pick<EditorState, 'doc' | 'selection'>): At[] {
  const { from, to, $from } = state.selection;
  if (from === to) return $from.parent.isTextblock ? [{ node: $from.parent, pos: $from.before() }] : [];
  const out: At[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      out.push({ node, pos });
      return false;
    }
    return true;
  });
  if (out.length > 1 && out[out.length - 1].pos + 1 === to) out.pop();
  return out;
}

/** The word around the caret in its textblock: [from, to) as positions, empty when the caret isn't in or by one. */
export function wordAround(state: EditorState, pos = state.selection.from): { from: number; to: number } {
  const $p = state.doc.resolve(pos);
  const text = lineText($p.parent);
  let a = $p.parentOffset, b = a;
  while (a > 0 && isWordChar(text[a - 1])) a--;
  while (b < text.length && isWordChar(text[b])) b++;
  return { from: $p.start() + a, to: $p.start() + b };
}

const isQuote = (n: PMNode) => n.type.name === 'blockquote' || n.type.name === 'callout';

/**
 * Takes children `i`…`j` of the quote or callout at `parentPos` out of it, one level: what's before them stays
 * in it, what's after becomes a quote of its own (a callout's title stays with the callout). Keeps the selection.
 */
export function liftChildren(tr: Transaction, parentPos: number, i: number, j: number): boolean {
  let parent = tr.doc.nodeAt(parentPos);
  if (!parent || !isQuote(parent) || (parent.type.name === 'callout' && i === 0)) return false;
  const childPos = (k: number) => {
    let p = parentPos + 1;
    for (let n = 0; n < k; n++) p += parent!.child(n).nodeSize;
    return p;
  };
  if (parent.type.name === 'callout' && j < parent.childCount - 1) {
    // what's after goes in a quote first, so the callout isn't split into one without a title
    const $a = tr.doc.resolve(childPos(j + 1));
    const $b = tr.doc.resolve(childPos(parent.childCount));
    tr.wrap(new NodeRange($a, $b, $a.depth), [{ type: tr.doc.type.schema.nodes.blockquote }]);
    parent = tr.doc.nodeAt(parentPos)!;
    j++;
  }
  const $a = tr.doc.resolve(childPos(i));
  const $b = tr.doc.resolve(childPos(j + 1));
  const range = new NodeRange($a, $b, $a.depth);
  const target = liftTarget(range);
  if (target === null) return false;
  tr.lift(range, target);
  return true;
}

/**
 * A callout back into plain lines: its title becomes a paragraph, its body a quote. Keeps the selection where it was
 * in the words.
 */
export function unCallout(tr: Transaction, pos: number): boolean {
  const callout = tr.doc.nodeAt(pos);
  if (callout?.type.name !== 'callout') return false;
  const { paragraph, blockquote } = tr.doc.type.schema.nodes;
  const title = callout.firstChild!;
  const body: PMNode[] = [];
  callout.forEach((c, _, k) => k && body.push(c));
  const out = [paragraph.create(null, title.content), ...(body.length ? [blockquote.create(null, body)] : [])];
  const { anchor, head } = tr.selection;
  const titleEnd = pos + 1 + title.nodeSize;
  const end = pos + callout.nodeSize;
  // the title's words move one place back; the body's stay put (the quote opens where the title closed)
  const move = (p: number) => (p <= pos ? p : p < titleEnd ? p - 1 : p < end ? p : p - (body.length ? 0 : 2));
  tr.replaceWith(pos, end, out);
  tr.setSelection(TextSelection.between(tr.doc.resolve(move(anchor)), tr.doc.resolve(move(head))));
  return true;
}

/**
 * Takes the textblocks at `blocks` (last first, as positions) out of the quote or callout each sits in, one level; a
 * callout's title undoes the callout. Blocks next to each other in one quote come out together.
 */
export function liftBlocks(tr: Transaction, blocks: number[]): boolean {
  let done = false;
  const sorted = [...blocks].sort((a, b) => b - a);
  for (let k = 0; k < sorted.length; ) {
    const $b = tr.doc.resolve(sorted[k]);
    const parent = $b.parent;
    if (!isQuote(parent)) {
      k++;
      continue;
    }
    if ($b.nodeAfter?.type.name === 'calloutTitle') {
      done = unCallout(tr, $b.before()) || done;
      k++;
      continue;
    }
    // the run of selected children of this parent, ending at this one
    let j = $b.index(), i = j;
    let m = k + 1;
    while (m < sorted.length) {
      const $c = tr.doc.resolve(sorted[m]);
      if ($c.depth !== $b.depth || $c.before() !== $b.before() || $c.index() !== i - 1 || $c.nodeAfter?.type.name === 'calloutTitle') break;
      i--;
      m++;
    }
    done = liftChildren(tr, $b.before(), i, j) || done;
    k = m;
  }
  return done;
}

/** Whether a textblock sits in a quote or a callout. */
export const inQuote = ($pos: { depth: number; node(d: number): PMNode }) => {
  for (let d = $pos.depth; d > 0; d--) if (isQuote($pos.node(d))) return true;
  return false;
};

/**
 * Runs a change as two steps to undo: `first`, then what `then` makes of the state after it (null for nothing).
 * The second needs the state the first left, so with a view it's read from the view (plugins may have added to it).
 */
export function inTwoSteps(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, view: EditorView | undefined,
  first: Transaction, then: (s: EditorState) => Transaction | null): boolean {
  if (!dispatch) return true;
  dispatch(closeHistory(first));
  const next = view ? view.state : state.apply(first);
  const tr = then(next);
  if (tr?.docChanged) dispatch(closeHistory(tr));
  return true;
}

/** A command that runs the first of `cmds` that applies. */
export const first = (...cmds: Command[]): Command => (state, dispatch, view) => cmds.some((c) => c(state, dispatch, view));

/** Whether a change made by `change` to a copy of `tr`'s document and selection goes through (ProseMirror can throw). */
function works(tr: Transaction, change: (t: Transaction) => void): boolean {
  try {
    change(EditorState.create({ doc: tr.doc, selection: tr.selection }).tr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes the selection, as tr.deleteSelection() does. Where ProseMirror can't (a selection from inside a quote into a
 * callout throws "Cannot join callout onto blockquote"), the selected words at both ends go and the blocks between, the
 * two lines left apart; failing that too, nothing goes and the caret goes to the selection's start. Returns `tr`.
 */
export function deleteSelectionSafe(tr: Transaction): Transaction {
  const sel = tr.selection;
  if (sel.empty) return tr;
  if (works(tr, (t) => t.deleteSelection())) return tr.deleteSelection();
  const { from, to, $from, $to } = sel;
  const apart = (t: Transaction) => {
    if (!$from.parent.isTextblock || !$to.parent.isTextblock) throw new Error('not in text');
    t.delete($to.start(), to);
    if ($from.after() < $to.before()) t.deleteRange($from.after(), t.mapping.map($to.before()));
    t.delete(from, $from.end());
    t.setSelection(TextSelection.create(t.doc, from));
  };
  if (works(tr, apart)) apart(tr);
  else tr.setSelection(Selection.near(tr.doc.resolve(from)));
  return tr;
}

/** Puts `text` in place of the selection (tr.insertText), the selection deleted safely first (deleteSelectionSafe). */
export function replaceSelectionText(tr: Transaction, text: string): Transaction {
  deleteSelectionSafe(tr);
  return text ? tr.insertText(text) : tr;
}
