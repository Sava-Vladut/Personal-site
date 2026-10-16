// Tags typed in the note: an @name (a person, a book, a song) or a [[note link being typed just before the caret,
// found the same way the old editor found them (lib/mentions.ts typedMention, lib/links.ts typedLink), and swapped
// for a chip once one is picked from the suggestions.
import type { Node as PMNode } from '@tiptap/pm/model';
import { TextSelection, type Command, type EditorState } from '@tiptap/pm/state';
import { typedLink } from '../../links';
import { typedMention } from '../../mentions';
import { parseInline } from '../parse';
import { LEAF, replaceSelectionText } from './util';

/** What's being typed: [from, to) holds the @ (or [[) and the query after it; `link` for a [[ link. */
export interface Typed {
  from: number;
  to: number;
  q: string;
  link: boolean;
}

/**
 * The @query or [[query typed just before the caret, or null. Only with nothing selected, and never in code. A chip
 * before it counts as one character, so the offsets are the document's positions.
 */
export function typedAt(state: EditorState): Typed | null {
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock || $from.parent.type.spec.code) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, LEAF);
  const t = typedMention(before, before.length) ?? typedLink(before, before.length);
  if (!t) return null;
  const start = $from.start();
  return { from: start + t.start, to: start + t.end, q: t.q, link: 'link' in t && !!t.link };
}

/**
 * Puts `atom` in place of [from, to), with a space after it unless one follows already, the styles there going on it.
 * The caret goes after it (and the space put in). `atom` is a chip's token (`@[person:p1|Ann]`, `♪[Song]`,
 * `[[note:n1|Title]]`) or a chip node.
 */
function putAtom(state: EditorState, from: number, to: number, atom: string | PMNode) {
  const tr = state.tr;
  const $f = state.doc.resolve(from);
  const marks = (state.storedMarks ?? $f.marks()).filter((m) => m.type.name !== 'link' && m.type.name !== 'code' && m.type.name !== 'escaped');
  const nodes = typeof atom === 'string'
    ? parseInline(atom, marks, state.schema)
    : [atom.marks.length ? atom : atom.mark(marks.filter((m) => atom.type.allowsMarkType(m.type)))];
  const after = state.doc.textBetween(to, $f.end(), undefined, LEAF);
  const space = /^\s/.test(after) ? [] : [state.schema.text(' ', marks)];
  tr.replaceWith(from, to, [...nodes, ...space]);
  const size = nodes.reduce((n, x) => n + x.nodeSize, 0) + space.length;
  // past the chip and the space put in after it (one already there stays after the caret)
  return tr.setSelection(TextSelection.create(tr.doc, from + size));
}

/**
 * Swaps the typed @query (or [[query) for the picked tag: `atom` is the chip's token (as lib/mentions.ts and
 * lib/links.ts write them) or a chip node. A link typed inside brackets already closed (`[[que|]]`) takes their place.
 * False when the text there isn't what was typed any more (it changed while a person was being made).
 */
export const replaceTyped = (typed: Typed, atom: string | PMNode): Command => (state, dispatch) => {
  const { from, to, q, link } = typed;
  if (from < 0 || to > state.doc.content.size || from > to) return false;
  const $f = state.doc.resolve(from);
  if (!$f.parent.isTextblock || $f.parent !== state.doc.resolve(to).parent) return false;
  if (state.doc.textBetween(from, to, undefined, LEAF) !== (link ? '[[' : '@') + q) return false;
  const end = link && state.doc.textBetween(to, Math.min(to + 2, $f.end()), undefined, LEAF) === ']]' ? to + 2 : to;
  dispatch?.(putAtom(state, from, end, atom).scrollIntoView());
  return true;
};

/** Puts a chip in at the selection (replacing it), with a space after it unless one follows. */
export const insertAtom = (atom: string | PMNode): Command => (state, dispatch) => {
  const { from, to, $from } = state.selection;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code || $from.parent !== state.selection.$to.parent) return false;
  dispatch?.(putAtom(state, from, to, atom).scrollIntoView());
  return true;
};

/**
 * The @ and link buttons: types `@` (or `[[`) at the selection, with a space before it when it would otherwise stick to
 * a word, so the suggestions come up (read typedAt right after). Not in code.
 */
export const insertTrigger = (sigil: '@' | '[['): Command => (state, dispatch) => {
  const { $from } = state.selection;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) return false;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, LEAF);
  const text = (before && !/[\s([{]$/.test(before) ? ' ' : '') + sigil;
  dispatch?.(replaceSelectionText(state.tr, text).scrollIntoView());
  return true;
};
