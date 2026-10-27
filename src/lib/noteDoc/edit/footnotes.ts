// Footnotes, as Word's Insert › Footnote: a reference at the caret ([^1], shown as a small number) and its text at the
// end of the note ([^1]: words), the texts together there. Labels are written as they are; the numbers shown are by
// where each footnote is first referred to in the note (the reading view numbers them the same way,
// components/Markdown.tsx footnotesOf). A text nothing refers to any more is drawn faded, so it isn't left behind unseen.
import type { Node as PMNode } from '@tiptap/pm/model';
import { TextSelection, type Command } from '@tiptap/pm/state';
import { deleteSelectionSafe } from './util';

export interface Footnotes {
  /** each label's number, by where it's first referred to */
  num: Map<string, number>;
  /** the references, in order: where each is and its label */
  refs: { pos: number; label: string }[];
  /** the footnotes' texts, in order */
  defs: { pos: number; label: string; node: PMNode }[];
}

/** The note's footnotes: references, texts and the numbers they show. */
export function footnotesOf(doc: PMNode): Footnotes {
  const out: Footnotes = { num: new Map(), refs: [], defs: [] };
  doc.descendants((n, pos) => {
    if (n.type.spec.code) return false;
    if (n.type.name === 'footnoteRef') {
      const label = n.attrs.label as string;
      out.refs.push({ pos, label });
      if (!out.num.has(label)) out.num.set(label, out.num.size + 1);
    } else if (n.type.name === 'footnote') out.defs.push({ pos, label: n.attrs.label, node: n });
    return true;
  });
  return out;
}

/** Whether the document holds a footnote or a reference to one (most notes don't: nothing to number then). */
export function hasFootnotes(doc: PMNode): boolean {
  let found = false;
  doc.descendants((n) => {
    if (found) return false;
    if (n.type.name === 'footnoteRef' || n.type.name === 'footnote') found = true;
    return !found && !n.type.spec.code;
  });
  return found;
}

/** The next label free: one past the highest number used (a label that isn't a number doesn't count). */
export function nextLabel(doc: PMNode): string {
  const { refs, defs } = footnotesOf(doc);
  let max = 0;
  for (const { label } of [...refs, ...defs]) if (/^\d{1,6}$/.test(label)) max = Math.max(max, Number(label));
  return String(max + 1);
}

/**
 * Insert › Footnote (Ctrl+Alt+F): a reference at the caret (the selection is typed over), and its text at the end of
 * the note, after the footnotes there (after a blank line when there are none yet), the caret in it. Not in code, nor
 * in a footnote's own text.
 */
export const insertFootnote: Command = (state, dispatch) => {
  const { $from } = state.selection;
  const p = $from.parent;
  if (!p.inlineContent || p.type.spec.code || p.type.name === 'footnote' || $from.marks().some((m) => m.type.name === 'code')) return false;
  if (!dispatch) return true;
  const { footnoteRef, footnote, paragraph } = state.schema.nodes;
  const label = nextLabel(state.doc);
  const tr = state.tr;
  if (!state.selection.empty) deleteSelectionSafe(tr);
  const marks = (state.storedMarks ?? tr.selection.$from.marks()).filter((m) => footnoteRef.allowsMarkType(m.type));
  tr.insert(tr.selection.from, footnoteRef.create({ label }, null, marks));
  const doc = tr.doc;
  const last = doc.lastChild!;
  const def = footnote.create({ label, sep: ' ' });
  const end = doc.content.size;
  if (last.type === footnote) tr.insert(end, def);
  else if (last.type === paragraph && !last.content.size) {
    // an empty last line is the blank line before them: kept, the footnote after it
    tr.insert(end, def);
    // two empty lines at the end: the footnote takes the last one's place
    const before = doc.childCount > 1 ? doc.child(doc.childCount - 2) : null;
    if (before?.type === paragraph && !before.content.size) tr.delete(end - last.nodeSize, end);
  } else tr.insert(end, [paragraph.create(), def]);
  dispatch(tr.setSelection(TextSelection.create(tr.doc, tr.doc.content.size - 1)).scrollIntoView());
  return true;
};

/** Where a footnote's text is (the position just before it), or -1 when it has none. */
export function footnoteAt(doc: PMNode, label: string): number {
  return footnotesOf(doc).defs.find((d) => d.label === label)?.pos ?? -1;
}

/** Where a footnote is first referred to (the position just before the reference), or -1 when nowhere. */
export function footnoteRefAt(doc: PMNode, label: string): number {
  return footnotesOf(doc).refs.find((r) => r.label === label)?.pos ?? -1;
}

/** Goes to the footnote's text (the caret at its end), from a click on its reference. */
export const goToFootnote = (label: string): Command => (state, dispatch) => {
  const pos = footnoteAt(state.doc, label);
  if (pos < 0) return false;
  const node = state.doc.nodeAt(pos)!;
  dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, pos + node.nodeSize - 1)).scrollIntoView());
  return true;
};

/** Goes back to where a footnote is first referred to (the caret just after the reference), from a click on its number. */
export const goToReference = (label: string): Command => (state, dispatch) => {
  const pos = footnoteRefAt(state.doc, label);
  if (pos < 0) return false;
  dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, pos + 1)).scrollIntoView());
  return true;
};
