// The note editor's behaviour as plain ProseMirror commands, with no DOM: what Enter, Backspace, Tab and the ribbon do
// to the document, pictures, tags being typed, pasting text, and what the ribbon shows lit. scripts/test-notedoc-edit.mjs
// runs them in Node; src/editor wires them to keys, the ribbon, input rules and plugins.
//
// Keys (keymap, priority 1000):
//   Enter → enter · Shift-Enter → newLine · Backspace → backspace (after undoInputRule) · Delete → deleteForward
//   Tab / Shift-Tab → tab(false) / tab(true) · Mod-[ / Mod-] → noteCommands.indent(true / false) (always swallowed)
//   ArrowDown at the end of a code block → exitCode
//   Mod-b, Mod-i, Mod-Shift-x, Mod-Shift-h → noteCommands.mark('bold' | 'italic' | 'strike' | 'highlight')
//   Mod-Shift-l, Mod-Shift-7, Mod-Shift-9 → noteCommands.list('ul' | 'ol' | 'task') · Mod-Shift-. → toggleQuote
//   Mod-Alt-0…3, Mod-Shift-n → noteCommands.style('normal' | 'h1'…) · Mod-k → the link sheet (linkAt, setLink, removeLink)
// Typing: BLOCK_RULES as input rules; handleTextInput → tidyAfterTag(text); the suggest plugin reads typedAt(state) and
// picks with replaceTyped(typed, token). Paste: clipboardTextParser → parseClipboardText. Task boxes → toggleTask(pos).
// After each change (appendTransaction, beside normalizeTr): renumberChanged(trs, state) counts the lists it touched again.
import type { Command } from '@tiptap/pm/state';
import type { ListKind } from '../syntax';
import { insertBlock, setStyle, toggleQuote, type BlockKind, type Style } from './blocks';
import { indentList, toggleList } from './lists';
import { clearFormatting, removeLink, setLink, toggleMarkSmart, type MarkName } from './marks';

export {
  enter, newLine, backspace, deleteForward, tab, codeEnter, exitCode, fenceEnter, headingEnter, titleEnter, quoteEnter,
  setStyle, toggleQuote, insertBlock, type Style, type BlockKind,
} from './blocks';
export { renumber, renumberChanged, countOnAfter, indentList, itemToParagraph, listEnter, toggleTask, toggleList } from './lists';
export {
  toggleMarkSmart, clearFormatting, linkAt, setLink, removeLink, normalizeHref, tidyAfterTag, CLEARED,
  type MarkName, type LinkTarget,
} from './marks';
export {
  mediaList, findMedia, insertMediaAt, removeMedia, removeItem, setMediaLayout, mergeMedia, ungroupMedia, takeOutItem,
  dropPlaces, dropTargets, moveMedia, canStep, stepMedia, mediaPosAfter, type DropTarget,
} from './media';
export { typedAt, replaceTyped, insertAtom, insertTrigger, type Typed } from './mention';
export { litOf, sameLit, type Lit, type LineKind } from './lit';
export { parseClipboardText, pasteText, type TextPasteOptions } from './clipboard';
export { BLOCK_RULES, ruleFor, typeText, type BlockRule } from './rules';
export { isWordChar, wordAround, selectedBlocks, lineText, liftBlocks, unCallout, first, inTwoSteps, LEAF, type At } from './util';

/**
 * The ribbon's and shortcuts' commands, by what they do (src/editor/commands.ts binds them to a view as NoteCommands).
 * Each returns a ProseMirror Command: false when it doesn't apply there (nothing changes).
 *
 * Undo and redo aren't here: they're the history plugin's (Tiptap's UndoRedo: `undo` / `redo` from
 * @tiptap/pm/history, newGroupDelay 1000, depth 300; litOf reads canUndo / canRedo from it). Commands that should be
 * two steps to undo (Enter carrying a list on) close the history group themselves (closeHistory).
 */
export const noteCommands = {
  /** Bold, italic, strike, highlight, code: on the selection, the word at the caret, or what's typed next. */
  mark: (name: MarkName): Command => toggleMarkSmart(name),
  /** The link sheet's Done (`{ text, href }`) or Remove (null). */
  link: (to: { text?: string; href: string } | null): Command => (to ? setLink(to) : removeLink),
  clearFormatting: clearFormatting as Command,
  /** A style from the gallery: Normal, Heading 1–6, Quote. Applying the one the lines have leaves them be. */
  style: (s: Style): Command => setStyle(s),
  /** Bullet, numbered or task list on the selected lines, or off when they all are one already. */
  list: (kind: ListKind): Command => toggleList(kind),
  /** The Quote button and Mod-Shift-.: in or out of a quote. */
  quote: toggleQuote as Command,
  /** Increase / decrease indent: list items only (false elsewhere; the key is still swallowed). */
  indent: (out: boolean): Command => indentList(out),
  /** A divider, code block or callout at the caret. */
  insert: (kind: BlockKind): Command => insertBlock(kind),
};
export type NoteCommandSet = typeof noteCommands;
