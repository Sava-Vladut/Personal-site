// Pasting plain text: it's read as the note's own Markdown (copying from a note gives Markdown, see serializeSlice), so
// lists, headings and styles come along. In code it goes in as it is. Pictures' lines are dropped unless the browser
// layer says it knows the picture (its photo or image is in the note's list). The DOM-side parts (HTML from Word and
// Google Docs) are in src/editor/paste.ts.
import { Fragment, Slice, type Node as PMNode, type ResolvedPos, type Schema } from '@tiptap/pm/model';
import type { Command } from '@tiptap/pm/state';
import { parseBody, serializeBody, type Body, type Media } from '../../body';
import { parseNote } from '../parse';
import { noteSchema } from '../schema';
import { deleteSelectionSafe } from './util';

export interface TextPasteOptions {
  /** what to do with a picture's line: the picture to keep (maybe changed), or null to drop it (the default) */
  media?: (m: Media) => Media | null;
}

/**
 * Plain text from the clipboard as a slice to paste at `$at` (ProseMirror's clipboardTextParser). A single line goes
 * into the line at the caret; of several, a first or last plain line joins the text before or after the caret, and
 * lines of other kinds (an item, a heading) stay what they are. In code, or for `plain` (Shift+paste), the text goes in
 * as it is.
 */
export function parseClipboardText(text: string, $at?: ResolvedPos | null, plain = false, opts: TextPasteOptions = {}, schema: Schema = $at?.doc.type.schema ?? noteSchema()): Slice {
  const t = text.replace(/\r\n?/g, '\n');
  if ($at?.parent.type.spec.code || plain) {
    if (!t) return Slice.empty;
    if ($at?.parent.type.spec.code) return new Slice(Fragment.from(schema.text(t)), 0, 0);
    // plain: each line a plain line
    const lines = t.split('\n').map((l) => schema.nodes.paragraph.create(null, l ? schema.text(l) : null));
    return new Slice(Fragment.from(lines), 1, 1);
  }
  // pictures dropped as body.ts removeMedia takes them out: their line goes, the text around joins
  const body = parseBody(t);
  const kept: Body = { texts: [body.texts[0]], media: [] };
  body.media.forEach((m, i) => {
    const keep = opts.media?.(m);
    if (keep) (kept.media.push(keep), kept.texts.push(body.texts[i + 1]));
    else kept.texts.push([kept.texts.pop(), body.texts[i + 1]].filter(Boolean).join('\n'));
  });
  const blocks: PMNode[] = [];
  parseNote(serializeBody(kept), schema).forEach((n) => blocks.push(n));
  if (blocks.length === 1 && blocks[0].type.name === 'paragraph' && !blocks[0].content.size) return Slice.empty;
  const open = (n: PMNode) => (n.type.name === 'paragraph' ? 1 : 0);
  return new Slice(Fragment.from(blocks), open(blocks[0]), open(blocks[blocks.length - 1]));
}

/** Pastes plain text at the selection, as parseClipboardText reads it (for tests, and where there's no clipboard). */
export const pasteText = (text: string, plain = false, opts: TextPasteOptions = {}): Command => (state, dispatch) => {
  const slice = parseClipboardText(text, state.selection.$from, plain, opts);
  if (!slice.size && state.selection.empty) return false;
  // (a selection from a quote into a callout is deleted first, apart: ProseMirror can't replace it in one go)
  dispatch?.(deleteSelectionSafe(state.tr).replaceSelection(slice).scrollIntoView());
  return true;
};
