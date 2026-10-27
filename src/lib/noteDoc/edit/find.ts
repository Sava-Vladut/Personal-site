// Find and Replace, as in Word (Ctrl+F, Ctrl+H): what's looked for, every place it's found (drawn highlighted, the
// current one apart), going from one to the next, replacing one or all. What's found lives in the editor's state
// (findPlugin), kept up to date as the note changes; the bar that asks is components/FindBar.tsx.
//
// It looks through each line's words on their own: never across two lines, nor into a tag, a footnote's number or a
// picture (they count as one letter nothing typed matches).
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection, type Command, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { closeHistory } from '@tiptap/pm/history';

export interface FindQuery {
  text: string;
  /** Match case */
  caseSensitive?: boolean;
  /** Find whole words only */
  wholeWord?: boolean;
}
export interface Match { from: number; to: number }

/** The search going on: what's looked for, where it's found, and which of those is the current one (-1: none yet). */
export interface FindState {
  query: FindQuery;
  matches: Match[];
  current: number;
}

/** At most this many are found (a one-letter search in a book-long note) */
const MAX = 5000;
const OTHER = '￼';
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The pattern for a query, or null when there's nothing to look for. */
export function findPattern(q: FindQuery): RegExp | null {
  if (!q.text) return null;
  const body = escape(q.text);
  const word = String.raw`[\p{L}\p{N}_]`;
  return new RegExp(q.wholeWord ? `(?<!${word})${body}(?!${word})` : body, 'gu' + (q.caseSensitive ? '' : 'i'));
}

/** Every place `q` is found in the document, in order. */
export function findMatches(doc: PMNode, q: FindQuery): Match[] {
  const re = findPattern(q);
  const out: Match[] = [];
  if (!re) return out;
  doc.descendants((node, pos) => {
    if (out.length >= MAX) return false;
    if (!node.isTextblock) return true;
    // the line's words, a tag or anything else not words standing for its size in the document (so an offset in this
    // is the same offset in the document)
    let text = '';
    node.forEach((child) => void (text += child.isText ? child.text! : OTHER.repeat(child.nodeSize)));
    const start = pos + 1;
    for (const m of text.matchAll(re)) {
      if (!m[0].length) continue;
      out.push({ from: start + m.index!, to: start + m.index! + m[0].length });
      if (out.length >= MAX) break;
    }
    return false;
  });
  return out;
}

interface Held { find: FindState | null; deco: DecorationSet }
export const findKey = new PluginKey<Held>('find');

type FindMeta = { query: FindQuery; from?: number } | { current: number } | null;

/** The first match at or after `pos` (the first of all past the last one), or -1 when there's none. */
const firstFrom = (matches: Match[], pos: number) => (matches.length ? Math.max(0, matches.findIndex((m) => m.from >= pos)) : -1);

function decorations(doc: PMNode, f: FindState | null): DecorationSet {
  if (!f || !f.matches.length) return DecorationSet.empty;
  return DecorationSet.create(doc, f.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === f.current ? 'find-match is-current' : 'find-match' })));
}

/** Holds the search while the find bar is open, and draws what it finds. */
export const findPlugin = () =>
  new Plugin<Held>({
    key: findKey,
    state: {
      init: () => ({ find: null, deco: DecorationSet.empty }),
      apply(tr, was) {
        const meta = tr.getMeta(findKey) as FindMeta | undefined;
        if (meta === null) return { find: null, deco: DecorationSet.empty };
        let find = was.find;
        if (meta && 'query' in meta) {
          const matches = findMatches(tr.doc, meta.query);
          find = { query: meta.query, matches, current: firstFrom(matches, meta.from ?? tr.selection.from) };
        } else {
          if (!find) return was;
          if (tr.docChanged) {
            // found again over the changed note; the current one stays the one at (or just after) where it was
            const matches = findMatches(tr.doc, find.query);
            const at = find.current >= 0 ? tr.mapping.map(find.matches[find.current].from, -1) : -1;
            find = { ...find, matches, current: at < 0 ? -1 : firstFrom(matches, at) };
          }
          if (meta && 'current' in meta) find = { ...find, current: meta.current };
          if (find === was.find) return was;
        }
        return { find, deco: decorations(tr.doc, find) };
      },
    },
    props: { decorations: (state) => findKey.getState(state)?.deco },
  });

/** The search going on, or null when the find bar isn't open. */
export const findOf = (state: EditorState): FindState | null => findKey.getState(state)?.find ?? null;

/** Looks for `q` (from the caret on, or from `from`): every match lit, the next one current. False without the plugin. */
export const setFind = (q: FindQuery, from?: number): Command => (state, dispatch) => {
  if (!findKey.get(state)) return false;
  dispatch?.(state.tr.setMeta(findKey, { query: q, from } satisfies FindMeta));
  return true;
};

/** Ends the search (the find bar closed): nothing lit any more. */
export const clearFind: Command = (state, dispatch) => {
  if (!findOf(state)) return false;
  dispatch?.(state.tr.setMeta(findKey, null));
  return true;
};

/** Makes match `i` the current one: selected, and brought into view. */
function goTo(tr: Transaction, f: FindState, i: number): Transaction {
  const m = f.matches[i];
  return tr.setSelection(TextSelection.create(tr.doc, m.from, m.to)).setMeta(findKey, { current: i } satisfies FindMeta).scrollIntoView();
}

/**
 * Find Next (1) or Previous (-1), round the note's end: the match after (or before) the current one, or the first one
 * after the caret when none is current yet. False when nothing's found.
 */
export const findStep = (dir: 1 | -1): Command => (state, dispatch) => {
  const f = findOf(state);
  if (!f || !f.matches.length) return false;
  const n = f.matches.length;
  let i: number;
  if (f.current < 0) {
    const head = state.selection.from;
    let before = -1;
    f.matches.forEach((m, k) => void (m.to <= head && (before = k)));
    i = dir > 0 ? firstFrom(f.matches, head) : (before + n) % n;
  } else {
    // the first step lands on the current match itself when it isn't selected yet (just found, as Word does)
    const m = f.matches[f.current];
    const on = state.selection.from === m.from && state.selection.to === m.to;
    i = on ? (f.current + dir + n) % n : f.current;
  }
  dispatch?.(goTo(state.tr, f, i));
  return true;
};

/**
 * Replace: the current match becomes `text` (keeping the styles it had), and the next one is selected. The first press
 * on a match not selected yet only selects it, as Word does. False when nothing's found.
 */
export const replaceCurrent = (text: string): Command => (state, dispatch) => {
  const f = findOf(state);
  if (!f || !f.matches.length) return false;
  const m = f.current >= 0 ? f.matches[f.current] : null;
  if (!m || state.selection.from !== m.from || state.selection.to !== m.to) return findStep(1)(state, dispatch);
  if (!dispatch) return true;
  const tr = state.tr;
  if (text) tr.insertText(text, m.from, m.to);
  else tr.delete(m.from, m.to);
  // the next match is the first after what was put in (as the plugin will find them again over the changed note)
  const end = m.from + text.length;
  const after = findMatches(tr.doc, f.query);
  if (after.length) {
    const i = firstFrom(after, end);
    tr.setSelection(TextSelection.create(tr.doc, after[i].from, after[i].to)).setMeta(findKey, { current: i } satisfies FindMeta);
  } else tr.setSelection(TextSelection.create(tr.doc, end));
  // each Replace its own undo, never one with the typing just before
  dispatch(closeHistory(tr).scrollIntoView());
  return true;
};

/** Replace All: every match becomes `text`, in one change (one undo). How many were replaced, 0 when none. */
export function replaceAll(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, text: string): number {
  const f = findOf(state);
  if (!f || !f.matches.length) return 0;
  if (!dispatch) return f.matches.length;
  const tr = state.tr;
  // from the end back, so the places before stay where they were
  for (let i = f.matches.length - 1; i >= 0; i--) {
    const m = f.matches[i];
    if (text) tr.insertText(text, m.from, m.to);
    else tr.delete(m.from, m.to);
  }
  dispatch(closeHistory(tr).scrollIntoView());
  return f.matches.length;
}
