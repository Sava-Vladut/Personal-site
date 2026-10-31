// The note editor's behaviour as plain ProseMirror commands, with no DOM: what Enter, Backspace, Tab and the ribbon do
// to the document, pictures, tags being typed, pasting text, and what the ribbon shows lit. scripts/test-notedoc-edit.mjs
// runs them in Node; src/editor wires them to keys, the ribbon, input rules and plugins.
//
// Keys (keymap, priority 1000):
//   Enter → enter · Shift-Enter → newLine · Backspace → backspace (after undoInputRule) · Delete → deleteForward
//   (beside a tag, both select it first: selectChip) · ArrowLeft / ArrowRight beside a tag → stepOverChip(-1 / 1)
//   Tab / Shift-Tab → tab(false) / tab(true) · Mod-[ / Mod-] → noteCommands.indent(true / false) (always swallowed)
//   ArrowDown at the end of a code block → exitCode · Alt-Shift-ArrowUp / ArrowDown → moveBlocks(-1 / 1)
//   In a table: Tab / Shift-Tab → cellTab (the next / previous cell; Tab in the last adds a row), Enter and Shift-Enter →
//   cellEnter (the cell below, a row added at the bottom); the arrows, cell selection and pasting cells are
//   prosemirror-tables' (tableEditing, before the keymap)
//   Mod-b, Mod-i, Mod-u, Mod-Shift-x, Mod-Shift-h → noteCommands.mark('bold' | 'italic' | 'underline' | 'strike' | 'highlight')
//   Mod-Shift-= (Mod-+) / Mod-= → noteCommands.mark('sup' / 'sub') · Esc while the Format Painter is on → stopPainter
//   Mod-Shift-l, Mod-Shift-7, Mod-Shift-9 → noteCommands.list('ul' | 'ol' | 'task') · Mod-Shift-. → toggleQuote
//   Mod-Alt-0…6, Mod-Shift-n → noteCommands.style('normal' | 'h1'…) · Mod-k → the link sheet (linkAt, setLink, removeLink)
//   Mod-s → the note saved now (KeyOptions.save) · Mod-p → the browser's print, the note alone (styles/document.css)
//   Mod-l, Mod-e, Mod-r, Mod-j → noteCommands.align('left' | 'center' | 'right' | 'justify', true) · Mod-Shift-e → mark('code')
//   Mod-Enter → noteCommands.insert('pagebreak') (in code, a new line) · Mod-Alt-f → noteCommands.footnote
//   Mod-f / Mod-h → the find bar (KeyOptions.find 'find' | 'replace') · F3 / Shift-F3 while it's open → findStep(1 / -1)
//   Mod-Alt-m → noteCommands.comment (a draft, its box focused by the page: KeyOptions.comment)
// Typing: BLOCK_RULES as input rules, then AUTOCORRECT (after the inline Markdown and autolink rules); handleTextInput →
// tidyAfterTag(text); a mouse let go of in the text (or Shift let go of) while the Format Painter is on → paint; the suggest plugin reads typedAt(state) and picks with replaceTyped(typed, token). Paste: clipboardTextParser → parseClipboardText. Task boxes → toggleTask(pos).
// After each change (appendTransaction, beside normalizeTr): renumberChanged(trs, state) counts the lists it touched again.
import type { Command } from '@tiptap/pm/state';
import type { ListKind } from '../syntax';
import { insertBlock, setAlign, setStyle, toggleQuote, type BlockKind, type Style } from './blocks';
import { insertFootnote } from './footnotes';
import type { Align } from '../syntax';
import { continueNumbering, indentList, restartNumbering, toggleList } from './lists';
import { clearFormatting, removeLink, setLink, setMarkSmart, toggleMarkSmart, type MarkName } from './marks';
import { togglePainter } from './painter';
import { insertTable, tableCommand, type TableAction } from './tables';
import { deleteComment, newComment, stepComment } from './comments';

export {
  enter, newLine, backspace, deleteForward, tab, codeEnter, exitCode, fenceEnter, headingEnter, titleEnter, quoteEnter,
  setStyle, toggleQuote, insertBlock, moveBlocks, setAlign, alignAt, type Style, type BlockKind,
} from './blocks';
export {
  footnotesOf, hasFootnotes, nextLabel, insertFootnote, footnoteAt, footnoteRefAt, goToFootnote, goToReference, type Footnotes,
} from './footnotes';
export {
  renumber, renumberChanged, countOnAfter, indentList, itemToParagraph, listEnter, toggleTask, toggleList, restartNumbering, continueNumbering,
} from './lists';
export {
  toggleMarkSmart, setMarkSmart, colorAt, copyMarks, paintMarks, clearFormatting, linkAt, setLink, removeLink, normalizeHref, tidyAfterTag,
  CLEARED, type MarkName, type LinkTarget,
} from './marks';
export { findPlugin, findOf, findMatches, findPattern, setFind, clearFind, findStep, replaceCurrent, replaceAll, type FindQuery, type FindState, type Match } from './find';
export { headingsOf, headingAt, type Heading } from './outline';
export {
  commentsOf, commentAt, commentsPlugin, commentsKey, commentsState, commentRange, newComment, addComment, saveComment, deleteComment,
  selectComment, focusComment, stepComment, hasComments, type Comment, type CommentsState,
} from './comments';
export { painterKey, painterPlugin, painterOf, togglePainter, stopPainter, paint, type Painter } from './painter';
export {
  mediaList, findMedia, insertMediaAt, removeMedia, removeItem, setMediaLayout, setMediaMeta, mergeMedia, ungroupMedia, takeOutItem,
  dropPlaces, dropTargets, moveMedia, canStep, stepMedia, mediaPosAfter, type DropTarget,
} from './media';
export { typedAt, replaceTyped, insertAtom, insertTrigger, type Typed } from './mention';
export { isChip, stepOverChip, selectChip, removeChip, retypeChip } from './chips';
export {
  insertTable, tableCommand, cellTab, cellEnter, tableEnter, deleteTable, cellAlignAt, inTable, isCell, emptyTable, isCellsSlice, oneLine, TABLE_MAX, type TableAction,
} from './tables';
export { litOf, sameLit, type Lit, type LineKind } from './lit';
export { parseClipboardText, pasteText, type TextPasteOptions } from './clipboard';
export { BLOCK_RULES, TYPING_RULES, ruleFor, typeText, type BlockRule } from './rules';
export { AUTOCORRECT } from './autocorrect';
export { isWordChar, wordAround, selectedBlocks, lineText, liftBlocks, unCallout, first, inTwoSteps, placeBlock, LEAF, type At } from './util';

/**
 * The ribbon's and shortcuts' commands, by what they do (src/editor/commands.ts binds them to a view as NoteCommands).
 * Each returns a ProseMirror Command: false when it doesn't apply there (nothing changes).
 *
 * Undo and redo aren't here: they're the history plugin's (Tiptap's UndoRedo: `undo` / `redo` from
 * @tiptap/pm/history, newGroupDelay 1000, depth 300; litOf reads canUndo / canRedo from it). Commands that should be
 * two steps to undo (Enter carrying a list on) close the history group themselves (closeHistory).
 */
export const noteCommands = {
  /**
   * Bold, italic, underline, strike, superscript, subscript, highlight, code: on the selection, the word at the caret,
   * or what's typed next. A highlight in a colour of lib/palette.ts with `color` (its button applies the last one).
   */
  mark: (name: MarkName, color?: string | null): Command => toggleMarkSmart(name, color === undefined ? undefined : { color }),
  /** Font colour: one of lib/palette.ts TEXT_COLORS, or null for Automatic. */
  color: (color: string | null): Command => setMarkSmart('color', color ? { color } : null),
  /** Text highlight colour: one of HIGHLIGHTS, null for yellow, false for No colour. */
  highlight: (color: string | null | false): Command => setMarkSmart('highlight', color === false ? null : { color }),
  /** The Format Painter's button: once, or `sticky` (a double click) until Esc. */
  painter: (sticky: boolean): Command => togglePainter(sticky),
  /** The link sheet's Done (`{ text, href }`) or Remove (null). */
  link: (to: { text?: string; href: string } | null): Command => (to ? setLink(to) : removeLink),
  clearFormatting: clearFormatting as Command,
  /** A style from the gallery: Normal, Heading 1–6, Quote. Applying the one the lines have leaves them be. */
  style: (s: Style): Command => setStyle(s),
  /** Bullet, numbered or task list on the selected lines, or off when they all are one already. */
  list: (kind: ListKind): Command => toggleList(kind),
  /** The Quote button and Mod-Shift-.: in or out of a quote. */
  quote: toggleQuote as Command,
  /** Restart numbering (from 1) or Continue numbering (from the list before), on the numbered item at the caret. */
  numbering: (restart: boolean): Command => (restart ? restartNumbering : continueNumbering),
  /** Increase / decrease indent: list items only (false elsewhere; the key is still swallowed). */
  indent: (out: boolean): Command => indentList(out),
  /** A divider, page break, code block or callout at the caret. */
  insert: (kind: BlockKind): Command => insertBlock(kind),
  /** Align left, centre, right or justify on the selected paragraphs and headings; `toggle` (the keys) back to left. */
  align: (align: Align | 'left', toggle = false): Command => setAlign(align, toggle),
  /** Insert › Footnote: a reference at the caret, its text at the end of the note. */
  footnote: insertFootnote as Command,
  /** Insert › Table: an empty table, `rows` (its header row among them) by `cols`, the caret in its first cell. */
  insertTable: (rows: number, cols: number): Command => insertTable(rows, cols),
  /** The Table tab: rows and columns in and out, the table taken out, a column aligned. */
  table: (action: TableAction): Command => tableCommand(action),
  /** Review › New comment: a draft on the selection or the word at the caret (the one at the caret, if it has one). */
  comment: newComment,
  /** Review › Delete comment: the one at the caret (or in the selection); its words stay. */
  deleteComment: deleteComment() as Command,
  /** Review › Previous (-1) and Next (1) comment: its words selected. */
  stepComment: (dir: 1 | -1): Command => stepComment(dir),
};
export type NoteCommandSet = typeof noteCommands;
