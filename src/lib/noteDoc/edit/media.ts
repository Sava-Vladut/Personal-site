// Pictures in the note: putting them in, sizing them, standing them side by side in a row (an album, in the text) and
// apart again, moving them by dragging or a step at a time, a row's pictures within it or out of it, and taking them out.
// Each does to the document what lib/body.ts does to the note's text (the old editor's way), so the text written is the
// same: scripts/test-notedoc-edit.mjs checks
//
//   serializeNote(op(parseNote(t))) === serializeBody(bodyOp(parseBody(t)))
//
// A picture is a `media` node at the top level. A "stretch" is the blocks between two pictures (body.ts's text
// block); a stretch that's one empty line is body.ts's empty text. Positions given here are the position just before a
// media node (`pos`), or a place between top-level nodes (a drop place).
import type { Node as PMNode } from '@tiptap/pm/model';
import { EditorState, Selection, type Command, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import {
  albumOf, canStep as bodyCanStep, itemKey, itemOf, itemsOf, layoutPart, mediaKey, metaPart, parseBody, serializeBody, setLayout,
  stepMedia as bodyStep, tidyMeta, type Item, type Layout, type Media, type Meta,
} from '../../body';
import { replaceDoc } from '../diff';
import { normalizeTr } from '../normalize';
import { parseNote } from '../parse';
import { serializeNote } from '../serialize';

const isMedia = (n: PMNode | null | undefined): n is PMNode => n?.type.name === 'media';
const isEmptyLine = (n: PMNode | null | undefined) => n?.type.name === 'paragraph' && n.content.size === 0;

/** Every picture in the document, in order: the position before it and what it is. */
export function mediaList(doc: PMNode): { pos: number; media: Media }[] {
  const out: { pos: number; media: Media }[] = [];
  doc.forEach((node, pos) => isMedia(node) && out.push({ pos, media: node.attrs.media }));
  return out;
}

/** Where the picture (or album) named `key` (body.ts mediaKey) is, or -1. */
export function findMedia(doc: PMNode, key: string): number {
  return mediaList(doc).find((m) => mediaKey(m.media) === key)?.pos ?? -1;
}

/** The picture at `pos` (the position before it), or null. */
const mediaAt = (doc: PMNode, pos: number): PMNode | null => {
  if (pos < 0 || pos >= doc.content.size) return null;
  const $p = doc.resolve(pos);
  return $p.depth === 0 && isMedia($p.nodeAfter) ? $p.nodeAfter : null;
};

/** The top-level nodes of the stretch before and after the picture at top-level index `i`. */
function stretches(doc: PMNode, i: number): { before: PMNode[]; after: PMNode[] } {
  const before: PMNode[] = [], after: PMNode[] = [];
  for (let k = i - 1; k >= 0 && !isMedia(doc.child(k)); k--) before.unshift(doc.child(k));
  for (let k = i + 1; k < doc.childCount && !isMedia(doc.child(k)); k++) after.push(doc.child(k));
  return { before, after };
}
const emptyStretch = (s: PMNode[]) => s.length === 1 && isEmptyLine(s[0]);

/** Puts the document in shape after a change (a line between pictures, none first or last), in the same transaction. */
function tidy(tr: Transaction): Transaction {
  const fix = normalizeTr(EditorState.create({ doc: tr.doc }));
  if (fix) for (const step of fix.steps) tr.step(step);
  return tr;
}

/** Media nodes for `media`, an empty line between each two. */
function mediaNodes(tr: Transaction, media: Media[]): PMNode[] {
  const { media: type, paragraph } = tr.doc.type.schema.nodes;
  return media.flatMap((m, i) => (i ? [paragraph.create(), type.create({ media: m })] : [type.create({ media: m })]));
}

/**
 * Puts pictures in at top-level place `at`, as body.ts insertMedia does there. `start`: `at` is the start of the line
 * after it (an empty line there is taken by the pictures; so is an empty last line of a stretch just before it).
 * Otherwise `at` is the end of the line before it. Returns the place just after the last picture.
 */
function placeAt(tr: Transaction, at: number, media: Media[], start: boolean): number {
  const nodes = mediaNodes(tr, media);
  const size = nodes.reduce((n, x) => n + x.nodeSize, 0);
  const $a = tr.doc.resolve(at);
  if (start && isEmptyLine($a.nodeAfter)) {
    tr.replaceWith(at, at + $a.nodeAfter!.nodeSize, nodes);
    return at + size;
  }
  if (start && (!$a.nodeAfter || isMedia($a.nodeAfter)) && isEmptyLine($a.nodeBefore)) {
    const from = at - $a.nodeBefore!.nodeSize;
    tr.replaceWith(from, at, nodes);
    return from + size;
  }
  tr.insert(at, nodes);
  return at + size;
}

/** Puts the caret at the start of the first line after `end` (a place the document's last steps may have moved). */
function caretAfter(tr: Transaction, end: number, steps: number): Transaction {
  const at = tr.mapping.slice(steps).map(end, -1);
  return tr.setSelection(Selection.near(tr.doc.resolve(at), 1));
}

/**
 * Puts pictures in at `pos` (the caret when not given), as the old editor did at its caret: at the start of a line,
 * before it; at its end, after it; in its middle, splitting it (the words after go on a plain line). An empty line is
 * taken by them. In a quote, callout or code block they go after it (a picture is never inside one). The caret goes to
 * the line after them (the browser layer doesn't focus).
 */
export const insertMediaAt = (media: Media[], pos?: number): Command => (state, dispatch) => {
  if (!media.length) return false;
  if (!dispatch) return true;
  const tr = state.tr;
  const $p = state.doc.resolve(Math.min(Math.max(0, pos ?? state.selection.head), state.doc.content.size));
  let end: number;
  if ($p.depth === 0) end = placeAt(tr, $p.pos, media, true);
  else {
    const top = $p.node(1);
    const before = $p.before(1);
    const after = before + top.nodeSize;
    if ($p.depth > 1 || !top.isTextblock || top.type.spec.code) end = placeAt(tr, after, media, false);
    else if (!top.content.size || $p.parentOffset === 0) end = placeAt(tr, before, media, true);
    else if ($p.parentOffset === top.content.size) end = placeAt(tr, after, media, false);
    else {
      tr.split($p.pos, 1, [{ type: state.schema.nodes.paragraph }]);
      end = placeAt(tr, $p.pos + 1, media, false);
    }
  }
  const steps = tr.steps.length;
  tidy(tr);
  dispatch(caretAfter(tr, end, steps).scrollIntoView());
  return true;
};

/**
 * Takes the picture at `pos` out of `tr`, joining the text around it as body.ts removeMedia does (an empty stretch
 * beside it goes with it). Returns the place it was.
 */
function cut(tr: Transaction, pos: number): number {
  const $p = tr.doc.resolve(pos);
  const node = $p.nodeAfter!;
  const { before, after } = stretches(tr.doc, $p.index());
  let from = pos, to = pos + node.nodeSize;
  if (emptyStretch(before)) from -= before[0].nodeSize;
  else if (emptyStretch(after)) to += after[0].nodeSize;
  tr.delete(from, to);
  return from;
}

/** Takes the picture or album at `pos` out of the note (its line goes, the text around it joins). */
export const removeMedia = (pos: number): Command => (state, dispatch) => {
  if (!mediaAt(state.doc, pos)) return false;
  if (dispatch) {
    const tr = state.tr;
    cut(tr, pos);
    dispatch(tidy(tr));
  }
  return true;
};

/** Takes one picture out of the album at `pos` (it keeps the rest), or the picture at `pos` when it's on its own. */
export const removeItem = (pos: number, item: Item): Command => (state, dispatch) => {
  const node = mediaAt(state.doc, pos);
  if (!node) return false;
  const m = node.attrs.media as Media;
  const rest = itemsOf(m).filter((x) => itemKey(x) !== itemKey(item));
  if (rest.length === itemsOf(m).length) return false;
  if (!rest.length) return removeMedia(pos)(state, dispatch);
  dispatch?.(state.tr.setNodeMarkup(pos, null, { media: albumOf(rest, m) }));
  return true;
};

/** Changes how big the picture at `pos` is and which side it sits on (body.ts setLayout's rules: 100% is centred). */
export const setMediaLayout = (pos: number, layout: Layout): Command => (state, dispatch) => {
  const node = mediaAt(state.doc, pos);
  if (!node) return false;
  const media = setLayout({ texts: ['', ''], media: [node.attrs.media] }, 0, layout).media[0];
  if (JSON.stringify(media) === JSON.stringify(node.attrs.media)) return false;
  dispatch?.(state.tr.setNodeMarkup(pos, null, { media }));
  return true;
};

/**
 * The caption or alt text of the picture at `pos` (Picture › Caption, Alt text): the words given, tidied onto one line;
 * empty words take it off.
 */
export const setMediaMeta = (pos: number, meta: Meta): Command => (state, dispatch) => {
  const node = mediaAt(state.doc, pos);
  if (!node) return false;
  const media: Media = { ...node.attrs.media };
  for (const k of ['caption', 'alt'] as const) {
    if (!(k in meta)) continue;
    const v = tidyMeta(meta[k] ?? '');
    if (v) media[k] = v;
    else delete media[k];
  }
  if (JSON.stringify(media) === JSON.stringify(node.attrs.media)) return false;
  dispatch?.(state.tr.setNodeMarkup(pos, null, { media }));
  return true;
};

/** `items` with `add` put in at place `at` (after the last when not given). */
const withAt = (items: Item[], add: Item[], at?: number) => {
  const k = Math.min(Math.max(0, at ?? items.length), items.length);
  return [...items.slice(0, k), ...add, ...items.slice(k)];
};

/**
 * Drops the picture (or row) at `from` onto the one at `onto`: one row, in `onto`'s place and layout, its pictures at
 * place `at` among `onto`'s (after the last when not given).
 */
export const mergeMedia = (from: number, onto: number, at?: number): Command => (state, dispatch) => {
  const src = mediaAt(state.doc, from), dst = mediaAt(state.doc, onto);
  if (!src || !dst || from === onto) return false;
  if (dispatch) {
    const tr = state.tr.setNodeMarkup(onto, null, { media: albumOf(withAt(itemsOf(dst.attrs.media), itemsOf(src.attrs.media), at), dst.attrs.media) });
    cut(tr, from);
    dispatch(tidy(tr));
  }
  return true;
};

/** The row at `pos` and where `item` is in it, or null when it isn't one of its pictures. */
function inRow(doc: PMNode, pos: number, item: Item): { m: Media & { kind: 'album' }; k: number } | null {
  const m = mediaAt(doc, pos)?.attrs.media as Media | undefined;
  if (m?.kind !== 'album') return null;
  const k = m.items.findIndex((x) => itemKey(x) === itemKey(item));
  return k < 0 ? null : { m, k };
}

/** Puts `item` of the row at `pos` at place `at` among its pictures (counted with it still where it is). */
export const reorderItem = (pos: number, item: Item, at: number): Command => (state, dispatch) => {
  const row = inRow(state.doc, pos, item);
  if (!row || at === row.k || at === row.k + 1) return false;
  const items = row.m.items.filter((_, j) => j !== row.k);
  items.splice(at > row.k ? at - 1 : at, 0, row.m.items[row.k]);
  dispatch?.(state.tr.setNodeMarkup(pos, null, { media: albumOf(items, row.m) }));
  return true;
};

/**
 * Takes `item` out of the row at `pos` and drops it on its own at drop place `to` (dropPlaces), with `layout`: body.ts
 * moveItemOut. The row keeps the others; with one left, it's a picture on its own again.
 */
export const moveItemOut = (pos: number, item: Item, to: number, layout: Layout = {}): Command => (state, dispatch) => {
  const row = inRow(state.doc, pos, item);
  if (!row || to < 0 || to > state.doc.content.size || state.doc.resolve(to).depth !== 0) return false;
  if (dispatch) {
    const single = setLayout({ texts: ['', ''], media: [itemOf(item) as Media] }, 0, layout).media[0];
    // (the row stays one node, so the places after it stay where they were)
    const tr = state.tr.setNodeMarkup(pos, null, { media: albumOf(row.m.items.filter((_, j) => j !== row.k), row.m) });
    placeAt(tr, to, [single], true);
    dispatch(tidy(tr));
  }
  return true;
};

/**
 * Moves `item` of the row at `pos` onto the picture (or row) at `onto`, at place `at` among its pictures. The row it
 * leaves keeps the others.
 */
export const moveItemInto = (pos: number, item: Item, onto: number, at?: number): Command => (state, dispatch) => {
  const row = inRow(state.doc, pos, item);
  const dst = mediaAt(state.doc, onto);
  if (!row || !dst || onto === pos) return false;
  if (dispatch) {
    const tr = state.tr.setNodeMarkup(pos, null, { media: albumOf(row.m.items.filter((_, j) => j !== row.k), row.m) });
    tr.setNodeMarkup(onto, null, { media: albumOf(withAt(itemsOf(dst.attrs.media), [item], at), dst.attrs.media) });
    dispatch(tr);
  }
  return true;
};

/** Puts picture `next` where `item` is in the picture or row at `pos`, keeping its layout, caption and alt text. */
export const replaceItem = (pos: number, item: Item, next: Item): Command => (state, dispatch) => {
  const m = mediaAt(state.doc, pos)?.attrs.media as Media | undefined;
  if (!m || !itemsOf(m).some((x) => itemKey(x) === itemKey(item))) return false;
  if (mediaList(state.doc).some((x) => itemsOf(x.media).some((y) => itemKey(y) === itemKey(next)))) return false;
  const media: Media = m.kind === 'album'
    ? albumOf(m.items.map((x) => (itemKey(x) === itemKey(item) ? next : x)), m)
    : ({ ...next, ...layoutPart(m), ...metaPart(m) } as Media);
  dispatch?.(state.tr.setNodeMarkup(pos, null, { media }));
  return true;
};

/** Breaks the album at `pos` into its pictures, one after another (a line between), each with the album's layout. */
export const ungroupMedia = (pos: number): Command => (state, dispatch) => {
  const node = mediaAt(state.doc, pos);
  const m = node?.attrs.media as Media | undefined;
  if (!node || m?.kind !== 'album') return false;
  if (dispatch) {
    const tr = state.tr;
    tr.replaceWith(pos, pos + node.nodeSize, mediaNodes(tr, m.items.map((it) => albumOf([it], layoutPart(m)))));
    dispatch(tidy(tr));
  }
  return true;
};

/** Takes one picture out of the album at `pos` and puts it on its own line just below the album. */
export const takeOutItem = (pos: number, item: Item): Command => (state, dispatch) => {
  const node = mediaAt(state.doc, pos);
  const m = node?.attrs.media as Media | undefined;
  if (!node || m?.kind !== 'album' || !m.items.some((x) => itemKey(x) === itemKey(item))) return false;
  if (dispatch) {
    const rest = m.items.filter((x) => itemKey(x) !== itemKey(item));
    const tr = state.tr;
    if (!rest.length) tr.setNodeMarkup(pos, null, { media: albumOf([item], m) });
    else tr.replaceWith(pos, pos + node.nodeSize, mediaNodes(tr, [albumOf(rest, m), item]));
    dispatch(tidy(tr));
  }
  return true;
};

/* ---------- moving ---------- */

/** The places a picture can be dropped: before each top-level block (and picture), and the end of the note. */
export function dropPlaces(doc: PMNode): number[] {
  const out: number[] = [];
  doc.forEach((_, pos) => out.push(pos));
  out.push(doc.content.size);
  return out;
}

/** A drop place with its height on the page (page coordinates, like the pointer's plus scrollY). */
export interface DropTarget { pos: number; y: number }

/**
 * Every place a picture can be dropped, with its height on the page: the top of each top-level block, and the bottom
 * of the last. Needs the view's DOM (the browser layer); `scroll` is the page's scrollY.
 */
export function dropTargets(view: Pick<EditorView, 'state' | 'nodeDOM'>, scroll = typeof scrollY === 'number' ? scrollY : 0): DropTarget[] {
  const doc = view.state.doc;
  const out: DropTarget[] = [];
  for (const pos of dropPlaces(doc)) {
    const end = pos === doc.content.size;
    const el = view.nodeDOM(end ? pos - doc.lastChild!.nodeSize : pos) as HTMLElement | null;
    if (!el?.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    out.push({ pos, y: (end ? r.bottom : r.top) + scroll });
  }
  return out;
}

/**
 * Whether dropping the picture at `from` on place `to` leaves it where it is: just before or after it, or (as the
 * text has it) at the start of an empty last line of the stretch above, or past an empty stretch below.
 */
function stays(doc: PMNode, from: number, to: number): boolean {
  const node = doc.resolve(from).nodeAfter!;
  if (to === from || to === from + node.nodeSize) return true;
  const { before, after } = stretches(doc, doc.resolve(from).index());
  const last = before[before.length - 1];
  if (isEmptyLine(last) && to === from - last.nodeSize) return true;
  return emptyStretch(after) && to === from + node.nodeSize + after[0].nodeSize;
}

/**
 * Moves the picture at `from` to drop place `to` (from dropPlaces; both as they are before the move), as body.ts
 * moveMedia does, and gives it `layout` when one is given and it differs. The caret stays in its words.
 */
export const moveMedia = (from: number, to: number, layout?: Layout): Command => (state, dispatch) => {
  const node = mediaAt(state.doc, from);
  if (!node || to < 0 || to > state.doc.content.size || state.doc.resolve(to).depth !== 0) return false;
  const here = stays(state.doc, from, to);
  const tr = state.tr;
  let at = from;
  if (!here) {
    const steps = tr.steps.length;
    cut(tr, from);
    const end = placeAt(tr, tr.mapping.slice(steps).map(to), [node.attrs.media], true);
    at = end - node.nodeSize;
  }
  if (layout) {
    const sized = setLayout({ texts: ['', ''], media: [node.attrs.media] }, 0, layout).media[0];
    if (JSON.stringify(sized) !== JSON.stringify(node.attrs.media)) tr.setNodeMarkup(at, null, { media: sized });
  }
  if (!tr.docChanged) return false;
  dispatch?.(tidy(tr));
  return true;
};

/** Which picture (0-based, as body.ts counts them) is at `pos`. */
const indexAt = (doc: PMNode, pos: number) => mediaList(doc).findIndex((m) => m.pos === pos);

/** Whether the picture at `pos` can move a step up (-1) or down (1): body.ts canStep. */
export function canStep(state: EditorState, pos: number, dir: -1 | 1): boolean {
  const i = indexAt(state.doc, pos);
  return i >= 0 && bodyCanStep(parseBody(serializeNote(state.doc)), i, dir);
}

/**
 * Moves the picture at `pos` one step up or down: past the nearest paragraph of text, or past the next picture when
 * only blank lines are between (body.ts stepMedia, run on the note's text, the document then changed to match).
 */
export const stepMedia = (pos: number, dir: -1 | 1): Command => (state, dispatch) => {
  const i = indexAt(state.doc, pos);
  if (i < 0) return false;
  const body = parseBody(serializeNote(state.doc));
  const next = bodyStep(body, i, dir);
  if (next === body) return false;
  const doc = parseNote(serializeBody(next), state.schema);
  if (doc.eq(state.doc)) return false;
  dispatch?.(replaceDoc(state.tr, doc));
  return true;
};

/** The picture's position after a change, found by its key (pictures are named by what they show). */
export const mediaPosAfter = (tr: Transaction | EditorState, media: Media) => findMedia(tr.doc, mediaKey(media));
