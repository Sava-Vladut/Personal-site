// Comments, as Word's Review tab: New comment (Ctrl+Alt+M) on the selection or the word at the caret, Delete comment,
// Previous and Next. A comment is a mark on the words it's on, saying what its `text` says (lib/comments.ts writes it
// in the note's text); a passage over several lines is one comment, a mark on each line. A new one is a draft until
// something's written in it (its box beside the text, components/CommentsPane.tsx): the words lit meanwhile, nothing in
// the document yet, so a comment never says nothing. The comment being written (or the one at the caret) is lit too.
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection, type Command, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { cleanComment } from '../../comments';
import { wordAround } from './util';

export interface Range { from: number; to: number }

/** A comment in the document: where its words start and end, what it says, and its words line by line. */
export interface Comment extends Range {
  text: string;
  ranges: Range[];
}

/** The comments in the document, in order. The pane knows each by where it starts (`from`). */
export function commentsOf(doc: PMNode): Comment[] {
  const type = doc.type.schema.marks.comment;
  const out: Comment[] = [];
  if (!doc.rangeHasMark(0, doc.content.size, type)) return out;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (node.type.spec.code) return false;
    let at = pos + 1;
    node.forEach((child) => {
      const from = at;
      at += child.nodeSize;
      const m = type.isInSet(child.marks);
      if (!m) return;
      const last = out[out.length - 1];
      const lr = last?.ranges[last.ranges.length - 1];
      if (last && last.text === m.attrs.text && lr!.to === from) lr!.to = at;
      // on from the end of one line to the start of the next: the same comment
      else if (last && last.text === m.attrs.text && doc.textBetween(lr!.to, from, '\n', '\0') === '\n') last.ranges.push({ from, to: at });
      else out.push({ from, to: at, text: m.attrs.text, ranges: [{ from, to: at }] });
      out[out.length - 1].to = at;
    });
    return false;
  });
  return out;
}

/** The comment at a position (the caret's by default): its words hold it, or it's just before or after them. */
export function commentAt(state: EditorState, pos = state.selection.from): Comment | null {
  const sel = state.selection;
  const list = commentsOf(state.doc);
  const touches = (c: Comment, a: number, b: number) => c.ranges.some((r) => r.from <= b && r.to >= a);
  if (pos === sel.from && !sel.empty) return list.find((c) => c.ranges.some((r) => r.from < sel.to && r.to > sel.from)) ?? null;
  return list.find((c) => touches(c, pos, pos)) ?? null;
}

/* ---------- the plugin: the draft, and the comment lit ---------- */

export interface CommentsState {
  /** a new comment's words, while it's being written (nothing in the document yet) */
  draft: Range | null;
  /** the comment whose box has the focus (by where it starts), lit in the text */
  focus: number | null;
}

export const commentsKey = new PluginKey<CommentsState>('comments');
const NONE: CommentsState = { draft: null, focus: null };

/** What the comments plugin knows (none when it isn't there, as in tests of the document alone). */
export const commentsState = (state: EditorState): CommentsState => commentsKey.getState(state) ?? NONE;

/** The draft and the comment lit, kept where they are as the document changes; the passage lit in the text. */
export function commentsPlugin(): Plugin<CommentsState> {
  return new Plugin<CommentsState>({
    key: commentsKey,
    state: {
      init: () => NONE,
      apply(tr, old) {
        const meta = tr.getMeta(commentsKey) as Partial<CommentsState> | undefined;
        let next = meta ? { ...old, ...meta } : old;
        if (tr.docChanged && (next.draft || next.focus !== null)) {
          const draft = next.draft && { from: tr.mapping.map(next.draft.from, 1), to: tr.mapping.map(next.draft.to, -1) };
          next = {
            draft: draft && draft.to > draft.from ? draft : null,
            focus: next.focus === null ? null : tr.mapping.mapResult(next.focus, 1).deleted ? null : tr.mapping.map(next.focus, 1),
          };
        }
        return next;
      },
    },
    props: {
      decorations(state) {
        const { draft, focus } = commentsState(state);
        const found: Decoration[] = [];
        if (draft) found.push(Decoration.inline(draft.from, draft.to, { class: 'cm-draft' }));
        const lit = focus !== null ? commentsOf(state.doc).find((c) => c.from === focus) : null;
        for (const r of lit?.ranges ?? []) found.push(Decoration.inline(r.from, r.to, { class: 'cm-active' }));
        return found.length ? DecorationSet.create(state.doc, found) : null;
      },
    },
  });
}

/* ---------- commands ---------- */

/**
 * Where a new comment goes: the selection, or the word at the caret, without spaces at either end; null where there's
 * nothing to comment on (no word at the caret, code).
 */
export function commentRange(state: EditorState): Range | null {
  const sel = state.selection;
  let { from, to } = sel.empty ? wordAround(state) : sel;
  if (from >= to) return null;
  const text = state.doc.textBetween(from, to, '\n', '\0');
  from += text.length - text.trimStart().length;
  to -= text.length - text.trimEnd().length;
  if (from >= to) return null;
  // somewhere in it a comment can go: words (or a tag) on a line that isn't code
  let any = false;
  state.doc.nodesBetween(from, to, (n, pos, parent) => {
    if (any || n.isBlock) return !any;
    if (parent?.type.allowsMarkType(state.schema.marks.comment) && pos + n.nodeSize > from && pos < to) any = true;
    return false;
  });
  return any ? { from, to } : null;
}

/** Puts a comment saying `text` on a range (in each of its lines that can take one), as one change. */
function markComment(tr: Transaction, r: Range, text: string): Transaction {
  const type = tr.doc.type.schema.marks.comment;
  return tr.removeMark(r.from, r.to, type).addMark(r.from, r.to, type.create({ text }));
}

/**
 * Review › New comment, Ctrl+Alt+M: a draft on the selection or the word at the caret, for its box to be written in.
 * With the caret in a comment already, that one is the one written in. False where none can go.
 */
export const newComment: Command = (state, dispatch) => {
  if (!commentsKey.getState(state)) return false;
  const at = state.selection.empty ? commentAt(state) : null;
  if (at) {
    dispatch?.(state.tr.setMeta(commentsKey, { draft: null, focus: at.from }));
    return true;
  }
  const r = commentRange(state);
  if (!r) return false;
  dispatch?.(state.tr.setMeta(commentsKey, { draft: r, focus: null }));
  return true;
};

/** A comment saying `text`, straight onto the selection or the word at the caret (no draft): for pasting, and tests. */
export const addComment = (text: string): Command => (state, dispatch) => {
  const words = cleanComment(text);
  const r = commentRange(state);
  if (!words || !r) return false;
  dispatch?.(markComment(state.tr, r, words));
  return true;
};

/**
 * A comment's box done with (Esc, or it lost the focus): the comment starting at `at` says `text` now, the draft
 * becoming one; saying nothing, it goes (a draft too). False when there's no such comment, or nothing changed.
 */
export const saveComment = (at: number, text: string): Command => (state, dispatch) => {
  const words = cleanComment(text);
  const { draft } = commentsState(state);
  if (draft && draft.from === at) {
    const tr = state.tr.setMeta(commentsKey, { draft: null, focus: null });
    if (words) markComment(tr, draft, words);
    dispatch?.(tr);
    return true;
  }
  const c = commentsOf(state.doc).find((x) => x.from === at);
  if (!c || c.text === words) return false;
  const tr = state.tr;
  if (!words) for (const r of c.ranges) tr.removeMark(r.from, r.to, state.schema.marks.comment);
  else for (const r of c.ranges) markComment(tr, r, words);
  dispatch?.(tr);
  return true;
};

/**
 * Review › Delete comment: the one starting at `at`, else the one at the caret (or in the selection), else the draft.
 * The words stay. False when there's none.
 */
export const deleteComment = (at?: number): Command => (state, dispatch) => {
  const { draft } = commentsState(state);
  const c = at !== undefined ? commentsOf(state.doc).find((x) => x.from === at) : commentAt(state);
  if (!c) {
    if (!draft || (at !== undefined && at !== draft.from)) return false;
    dispatch?.(state.tr.setMeta(commentsKey, { draft: null }));
    return true;
  }
  const tr = state.tr;
  for (const r of c.ranges) tr.removeMark(r.from, r.to, state.schema.marks.comment);
  if (commentsKey.getState(state)) tr.setMeta(commentsKey, { focus: null });
  dispatch?.(tr);
  return true;
};

/** The comment's words selected (a click on its box), lit as the one being looked at. */
export const selectComment = (at: number): Command => (state, dispatch) => {
  const c = commentsOf(state.doc).find((x) => x.from === at);
  if (!c) return false;
  const tr = state.tr.setSelection(TextSelection.create(state.doc, c.from, c.to)).scrollIntoView();
  if (commentsKey.getState(state)) tr.setMeta(commentsKey, { focus: c.from });
  dispatch?.(tr);
  return true;
};

/** Which comment's box has the focus (null: none), so its words are lit. */
export const focusComment = (at: number | null): Command => (state, dispatch) => {
  if (!commentsKey.getState(state) || commentsState(state).focus === at) return false;
  dispatch?.(state.tr.setMeta(commentsKey, { focus: at }));
  return true;
};

/**
 * Review › Next (1) and Previous (-1) comment: the next one after the caret (or before it), its words selected; past
 * the last it goes round to the first, as Word does once you say so. False when the note has none.
 */
export const stepComment = (dir: 1 | -1): Command => (state, dispatch) => {
  const list = commentsOf(state.doc);
  if (!list.length) return false;
  const here = state.selection.from;
  const c = dir > 0
    ? list.find((x) => x.from > here) ?? list[0]
    : [...list].reverse().find((x) => x.from < here) ?? list[list.length - 1];
  return selectComment(c.from)(state, dispatch);
};

/** Whether the note holds any comment. */
export const hasComments = (doc: PMNode) => doc.rangeHasMark(0, doc.content.size, doc.type.schema.marks.comment);
