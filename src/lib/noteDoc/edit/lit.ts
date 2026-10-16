// What the ribbon shows lit: the styles at the caret (or on all of the selection), the kind of line it's on, and
// whether there's anything to undo or redo.
import type { MarkType } from '@tiptap/pm/model';
import { redoDepth, undoDepth } from '@tiptap/pm/history';
import type { EditorState } from '@tiptap/pm/state';
import type { Style } from './blocks';

/** The kind of line the caret is on: a plain line, a heading, a list item of a kind, or code. */
export type LineKind = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'ul' | 'ol' | 'task' | 'code';

export interface Lit {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  highlight: boolean;
  code: boolean;
  link: boolean;
  block: LineKind;
  /** in a quote (a callout counts as one too) */
  quote: boolean;
  /** in a callout */
  callout: boolean;
  /** on a list item */
  inList: boolean;
  /** the style the gallery shows picked: a heading 1–3, Quote, Normal, or none (a callout, a smaller heading, code) */
  style: Style | null;
  /** something is selected */
  ranged: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

/** Whether all the text and chips of the selection carry `type`. */
function allHave(state: EditorState, type: MarkType): boolean {
  const { from, to } = state.selection;
  let any = false, all = true;
  state.doc.nodesBetween(from, to, (node) => {
    if (!all) return false;
    if (node.isInline) {
      any = true;
      if (!type.isInSet(node.marks)) all = false;
    }
    return true;
  });
  return any && all;
}

/** The ribbon's lit state for `state`. Undo and redo are read from the history plugin (none: nothing to undo). */
export function litOf(state: EditorState): Lit {
  const sel = state.selection;
  const { $from } = sel;
  const marks = sel.empty ? state.storedMarks ?? $from.marks() : null;
  const has = (name: string) => {
    const type = state.schema.marks[name];
    return marks ? !!type.isInSet(marks) : allHave(state, type);
  };
  const p = $from.parent;
  const block: LineKind = p.type.name === 'heading' ? (('h' + p.attrs.level) as LineKind)
    : p.type.name === 'listItem' ? p.attrs.kind
    : p.type.spec.code ? 'code'
    : 'p';
  let quote = false, callout = false;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d).type.name;
    if (n === 'blockquote') quote = true;
    if (n === 'callout') quote = callout = true;
  }
  const style: Style | null = /^h[1-3]$/.test(block) ? (block as Style)
    : callout || /^h[4-6]$/.test(block) || block === 'code' ? null
    : quote ? 'quote'
    : 'normal';
  return {
    bold: has('bold'),
    italic: has('italic'),
    strike: has('strike'),
    highlight: has('highlight'),
    code: has('code'),
    link: has('link'),
    block,
    quote,
    callout,
    inList: block === 'ul' || block === 'ol' || block === 'task',
    style,
    ranged: !sel.empty,
    canUndo: undoDepth(state) > 0,
    canRedo: redoDepth(state) > 0,
  };
}

/** Whether two lit states show the same (so the ribbon needn't render again). */
export const sameLit = (a: Lit, b: Lit) => (Object.keys(a) as (keyof Lit)[]).every((k) => a[k] === b[k]);
