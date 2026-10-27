// The note as a document for the editor (ProseMirror): the schema, reading the note's Markdown into it
// and writing it back, keeping it in shape, and putting a new version in place. Pure: runs in Node as in the browser.
// Only the editor (src/views/Editor.tsx and src/editor) imports this; the rest of the app reads the text with
// components/Markdown.tsx and lib/inline.ts, which read it the same way.
//
//   parseNote(text) → doc            serializeNote(doc) → text      serializeNote(parseNote(t)) === t
//
// The few texts that come back different are listed in scripts/test-notedoc.mjs (`>x` → `> x` and the like).
export {
  noteSchema, atomToken, listItemLook, STYLE_MARKS, ATOM_MARKS, FOOTNOTE_LABEL,
  type HeadingAttrs, type ParagraphAttrs, type FootnoteAttrs, type PageBreakAttrs, type ListItemAttrs, type CodeBlockAttrs, type CalloutAttrs, type HorizontalRuleAttrs,
  type MediaAttrs, type AtomAttrs, type CodeMarkAttrs, type LinkAttrs, type ColorAttrs, type HighlightAttrs, type CellAttrs,
} from './schema';
export { parseNote, parseBlocks, parseInline } from './parse';
export { serializeNote, serializeBlocks, serializeInline, serializeSlice, writtenAttrs, docKey, sameDoc } from './serialize';
export { normalizeDoc, normalizeTr, inShape } from './normalize';
export { replaceDoc } from './diff';
export {
  classifyLine, calloutOf, closesFence, fenceOf, depthOf, olMarker, calloutTone, calloutIcon, calloutDefaultTitle,
  HR, FENCE, HEAD, ITEM, QUOTE, CALLOUT, PAGEBREAK, FOOTNOTE, ALIGN, ALIGNS, SAFE, BARE, CALLOUT_ICON, alignOf, alignSuffix, isAlign,
  splitRow, delimRow, tableAt, mapTables, isCellAlign,
  type Line, type ItemParts, type ListKind, type Align, type CellAlign, type TableLines,
} from './syntax';
