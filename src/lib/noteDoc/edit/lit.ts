// What the ribbon shows lit: the styles at the caret (or on all of the selection), the kind of line it's on, and
// whether there's anything to undo or redo.
import type { MarkType } from '@tiptap/pm/model';
import { redoDepth, undoDepth } from '@tiptap/pm/history';
import type { EditorState } from '@tiptap/pm/state';
import { alignAt, setAlign, type Style } from './blocks';
import { continueNumbering, restartNumbering } from './lists';
import { colorAt, markLit } from './marks';
import { painterOf } from './painter';
import { cellAlignAt, inTable } from './tables';

/** The kind of line the caret is on: a plain line, a heading, a list item of a kind, or code. */
export type LineKind = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'ul' | 'ol' | 'task' | 'code';

export interface Lit {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  sup: boolean;
  sub: boolean;
  highlight: boolean;
  code: boolean;
  /** the font colour at the caret (or of all the selection), null for Automatic or a mix */
  color: string | null;
  /** the highlight's colour there ('yellow' for ==words==), null for none or a mix */
  highlightColor: string | null;
  /** the Format Painter is on: 'once', or 'sticky' (double-clicked) */
  painter: 'once' | 'sticky' | null;
  link: boolean;
  block: LineKind;
  /** in a quote (a callout counts as one too) */
  quote: boolean;
  /** in a callout */
  callout: boolean;
  /** on a list item */
  inList: boolean;
  /** the style the gallery shows picked: a heading 1–6, Quote, Normal, or none (a callout, code) */
  style: Style | null;
  /** the selected lines' alignment ('left' for none), null when they differ or can't be aligned (lists, code) */
  align: 'left' | 'center' | 'right' | 'justify' | null;
  /** some of the selected lines can be aligned (paragraphs, headings) */
  canAlign: boolean;
  /** in a table (its Table tab comes up) */
  table: boolean;
  /** the alignment of the selected columns of a table ('left' for none), null when they differ or out of a table */
  cellAlign: 'left' | 'center' | 'right' | null;
  /** something is selected */
  ranged: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** on a numbered item that Restart numbering / Continue numbering would change */
  canRestart: boolean;
  canContinue: boolean;
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
  const style: Style | null = /^h[1-6]$/.test(block) ? (block as Style)
    : callout || block === 'code' ? null
    : quote ? 'quote'
    : 'normal';
  const painter = painterOf(state);
  const align = alignAt(state);
  return {
    // the styles lit exactly when their buttons would take them off
    bold: markLit(state, 'bold'),
    italic: markLit(state, 'italic'),
    underline: markLit(state, 'underline'),
    strike: markLit(state, 'strike'),
    sup: markLit(state, 'sup'),
    sub: markLit(state, 'sub'),
    highlight: markLit(state, 'highlight'),
    code: markLit(state, 'code'),
    color: colorAt(state, 'color'),
    highlightColor: colorAt(state, 'highlight'),
    painter: painter ? (painter.sticky ? 'sticky' : 'once') : null,
    link: has('link'),
    block,
    quote,
    callout,
    inList: block === 'ul' || block === 'ol' || block === 'task',
    style,
    align,
    canAlign: align !== null || setAlign('left')(state),
    table: inTable(state),
    cellAlign: cellAlignAt(state),
    ranged: !sel.empty,
    canUndo: undoDepth(state) > 0,
    canRedo: redoDepth(state) > 0,
    canRestart: block === 'ol' && restartNumbering(state),
    canContinue: block === 'ol' && continueNumbering(state),
  };
}

/** Whether two lit states show the same (so the ribbon needn't render again). */
export const sameLit = (a: Lit, b: Lit) => (Object.keys(a) as (keyof Lit)[]).every((k) => a[k] === b[k]);
