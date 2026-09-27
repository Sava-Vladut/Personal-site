// A note's text can hold its pictures inline: a line of its own that reads [[photo:<id>]] or [[image:<url>]].
// A picture made smaller carries its width (in % of the column) and side: [[photo:<id> 50 left]].
// Pictures dropped on each other make an album, one line listing them: [[album:photo:<id> image:<url> 50 left]].
// Split, the body is text, picture, text, picture, …, text — always one more text than pictures.
import type { Entry, WebImage } from './store';

export interface Layout {
  size?: number;              // % of the column's width, 100 when missing
  align?: 'left' | 'right';   // centred when missing; only matters below 100%
}
/** One picture: a photo from the device, or an image from the web. */
export type Item = { kind: 'photo'; id: string } | { kind: 'image'; url: string };
export type Media = (Item | { kind: 'album'; items: Item[] }) & Layout;
export interface Body { texts: string[]; media: Media[] }

export const MIN_SIZE = 20;
const MARKER = /^\[\[(photo|image):([^\]\s]+)((?: \w+)*)\]\]$/;
const ALBUM = /^\[\[album:((?:photo|image):[^\]\s]+(?: (?:photo|image):[^\]\s]+)*)((?: \w+)*)\]\]$/;

function layoutOf(opts: string): Layout {
  const out: Layout = {};
  for (const o of opts.split(' ')) {
    if (/^\d{1,3}$/.test(o) && +o < 100) out.size = Math.max(MIN_SIZE, +o);
    else if (o === 'left' || o === 'right') out.align = o;
  }
  if (!out.size) delete out.align;
  return out;
}

/** The layout part of a picture or album, without anything else. */
const layoutPart = (m: Layout): Layout => ({ ...(m.size !== undefined && { size: m.size }), ...(m.align && { align: m.align }) });

export const itemKey = (it: Item) => (it.kind === 'photo' ? 'photo:' + it.id : 'image:' + it.url);
const itemFrom = (token: string): Item => (token.startsWith('photo:') ? { kind: 'photo', id: token.slice(6) } : { kind: 'image', url: token.slice(6) });
/** The picture itself, without its layout. */
export const itemOf = (m: Item & Layout): Item => (m.kind === 'photo' ? { kind: 'photo', id: m.id } : { kind: 'image', url: m.url });
/** The pictures a picture or album holds. */
export const itemsOf = (m: Media): Item[] => (m.kind === 'album' ? m.items : [itemOf(m)]);
/** An album of `items` with `layout` — or just the picture, when there's only one. */
const albumOf = (items: Item[], layout: Layout): Media => (items.length === 1 ? { ...items[0], ...layoutPart(layout) } : { kind: 'album', items, ...layoutPart(layout) });

const marker = (m: Media) =>
  `[[${m.kind === 'album' ? 'album:' + m.items.map(itemKey).join(' ') : itemKey(m)}${m.size && m.size < 100 ? ` ${m.size}${m.align ? ' ' + m.align : ''}` : ''}]]`;
/** Names a picture or album while it's in the note. An album goes by its first picture. */
export const mediaKey = (m: Media) => (m.kind === 'album' ? 'album:' + itemKey(m.items[0]) : itemKey(m));
export const sameMedia = (a: Media, b: Media) => mediaKey(a) === mediaKey(b);

export function parseBody(text: string): Body {
  const texts: string[] = [];
  const media: Media[] = [];
  let cur: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(MARKER);
    const a = m ? null : line.match(ALBUM);
    if (!m && !a) {
      cur.push(line);
      continue;
    }
    texts.push(cur.join('\n'));
    cur = [];
    if (m) media.push({ ...itemFrom(m[1] + ':' + m[2]), ...layoutOf(m[3]) });
    else media.push({ kind: 'album', items: a![1].split(' ').map(itemFrom), ...layoutOf(a![2]) });
  }
  texts.push(cur.join('\n'));
  return { texts, media };
}

export const serializeBody = ({ texts, media }: Body) => texts.reduce((s, t, i) => s + (i ? '\n' + marker(media[i - 1]) + '\n' : '') + t, '');

// Dragging a picture onto the text used to drop its address in as words. Nobody writes these lines themselves.
const OPENVERSE = /^https:\/\/api\.openverse\.org\/v1\/images\/[0-9a-f-]+\/(thumb\/)?$/;

/** Takes out lines that are only the address of one of the note's images (or of any Openverse image). */
export function dropImageLinks(text: string, images: WebImage[]) {
  if (!text.includes('https://')) return text;
  const known = new Set(images.flatMap((i) => [i.url, i.thumb]));
  return text.split('\n').filter((l) => !(known.has(l.trim()) || OPENVERSE.test(l.trim()))).join('\n');
}

/** The words only, for excerpts, search and counts. */
export const plainText = (text: string) => parseBody(text).texts.filter((t) => t.trim()).join('\n\n');

/**
 * Drops markers whose picture is gone (an album keeps the pictures that are left), keeps each picture in one place
 * only, and places pictures that aren't in the text yet at its end.
 */
export function bodyOf(e: Entry): Body {
  const b = parseBody(e.text);
  const known = (it: Item) => (it.kind === 'photo' ? e.photos.some((p) => p.id === it.id) : e.images.some((i) => i.url === it.url));
  const seen = new Set<string>();
  const out: Body = { texts: [b.texts[0]], media: [] };
  b.media.forEach((m, i) => {
    const items = itemsOf(m).filter((it) => known(it) && !seen.has(itemKey(it)));
    items.forEach((it) => seen.add(itemKey(it)));
    if (items.length) {
      out.media.push(m.kind === 'album' || items.length > 1 ? albumOf(items, m) : m);
      out.texts.push(b.texts[i + 1]);
    } else {
      const t = out.texts.length - 1;
      out.texts[t] = [out.texts[t], b.texts[i + 1]].filter(Boolean).join('\n');
    }
  });
  const missing: Media[] = [
    ...e.photos.map((p) => ({ kind: 'photo' as const, id: p.id })),
    ...e.images.map((i) => ({ kind: 'image' as const, url: i.url })),
  ].filter((m) => !seen.has(itemKey(m)));
  for (const m of missing) {
    out.media.push(m);
    out.texts.push('');
  }
  return out;
}

/** Puts pictures into text block `at`, split at `pos`. */
export function insertMedia(b: Body, add: Media[], at: number, pos: number): Body {
  if (!add.length) return b;
  at = Math.min(Math.max(0, at), b.texts.length - 1);
  const t = b.texts[at];
  pos = Math.min(Math.max(0, pos), t.length);
  const before = t.slice(0, pos).replace(/\n$/, '');
  const after = t.slice(pos).replace(/^\n/, '');
  return {
    texts: [...b.texts.slice(0, at), before, ...add.slice(1).map(() => ''), after, ...b.texts.slice(at + 1)],
    media: [...b.media.slice(0, at), ...add, ...b.media.slice(at)],
  };
}

/** Takes a picture out and joins the text around it. */
export function removeMedia(b: Body, m: Media): Body {
  const i = b.media.findIndex((x) => sameMedia(x, m));
  if (i < 0) return b;
  const joined = [b.texts[i], b.texts[i + 1]].filter(Boolean).join('\n');
  return { texts: [...b.texts.slice(0, i), joined, ...b.texts.slice(i + 2)], media: [...b.media.slice(0, i), ...b.media.slice(i + 1)] };
}

/** Changes how big a picture is and which side it sits on. */
export function setLayout(b: Body, i: number, layout: Layout): Body {
  const { size: _, align: __, ...base } = b.media[i];
  const size = Math.round(layout.size ?? 100);
  const m = (size < 100 ? { ...base, size: Math.max(MIN_SIZE, size), ...(layout.align && { align: layout.align }) } : base) as Media;
  return { texts: b.texts, media: b.media.map((x, j) => (j === i ? m : x)) };
}

const blank = (l: string) => !l.trim();

export const canStep = (b: Body, i: number, dir: -1 | 1) =>
  dir < 0 ? i > 0 || !blank(b.texts[i]) : i < b.media.length - 1 || !blank(b.texts[i + 1]);

/**
 * Moves picture `i` one step: past the nearest paragraph (line) of text, or past the next picture when
 * only blank lines are in between. A moved paragraph takes the gap it had to its neighbour along with it.
 */
export function stepMedia(b: Body, i: number, dir: -1 | 1): Body {
  const texts = [...b.texts];
  const media = [...b.media];
  if (dir < 0) {
    const lines = texts[i].split('\n');
    let k = lines.length - 1;
    while (k >= 0 && blank(lines[k])) k--;
    if (k < 0) {
      if (i === 0) return b;
      [media[i - 1], media[i]] = [media[i], media[i - 1]];
      return { texts, media };
    }
    let j = k - 1;
    while (j >= 0 && blank(lines[j])) j--;
    texts[i] = lines.slice(0, j + 1).join('\n');
    const below = texts[i + 1];
    texts[i + 1] = blank(below) ? lines[k] : lines[k] + '\n'.repeat(j >= 0 ? k - j : 1) + below;
  } else {
    const lines = texts[i + 1].split('\n');
    let k = 0;
    while (k < lines.length && blank(lines[k])) k++;
    if (k === lines.length) {
      if (i === media.length - 1) return b;
      [media[i], media[i + 1]] = [media[i + 1], media[i]];
      return { texts, media };
    }
    let j = k + 1;
    while (j < lines.length && blank(lines[j])) j++;
    texts[i + 1] = lines.slice(j).join('\n');
    const above = texts[i];
    texts[i] = blank(above) ? lines[k] : above + '\n'.repeat(j < lines.length ? j - k : 1) + lines[k];
  }
  return { texts, media };
}

/** Moves picture `i` into text block `seg`, split at `pos` (both counted before the move). */
export function moveMedia(b: Body, i: number, seg: number, pos: number): Body {
  if ((seg === i && pos >= b.texts[i].length) || (seg === i + 1 && pos === 0)) return b; // already there
  const m = b.media[i];
  const out = removeMedia(b, m);
  if (seg === i + 1) {
    seg = i;
    pos += b.texts[i].length + (b.texts[i] && b.texts[i + 1] ? 1 : 0);
  } else if (seg > i + 1) seg--;
  return insertMedia(out, [m], seg, pos);
}

/* ---------- albums ---------- */

/** Drops picture (or album) `from` onto picture `onto`: they become one album, in `onto`'s place and layout. */
export function mergeMedia(b: Body, from: number, onto: number): Body {
  if (from === onto) return b;
  const src = b.media[from], dst = b.media[onto];
  const out = removeMedia(b, src);
  const media = out.media.map((m) => (sameMedia(m, dst) ? albumOf([...itemsOf(dst), ...itemsOf(src)], dst) : m));
  return { texts: out.texts, media };
}

/** Breaks album `i` back into its pictures, one after another, each with the album's layout. */
export function ungroup(b: Body, i: number): Body {
  const m = b.media[i];
  if (m.kind !== 'album') return b;
  const singles = m.items.map((it) => ({ ...it, ...layoutPart(m) }) as Media);
  return {
    texts: [...b.texts.slice(0, i + 1), ...singles.slice(1).map(() => ''), ...b.texts.slice(i + 1)],
    media: [...b.media.slice(0, i), ...singles, ...b.media.slice(i + 1)],
  };
}

/** Takes one picture out of album `i` and puts it on its own line just below the album. */
export function takeOut(b: Body, i: number, it: Item): Body {
  const m = b.media[i];
  if (m.kind !== 'album') return b;
  const rest = m.items.filter((x) => itemKey(x) !== itemKey(it));
  return {
    texts: [...b.texts.slice(0, i + 1), '', ...b.texts.slice(i + 1)],
    media: [...b.media.slice(0, i), albumOf(rest, m), it, ...b.media.slice(i + 1)],
  };
}

/** Where a picture is: its place in the body, and in its album (0 for a picture on its own). -1 when it isn't there. */
export function findItem(b: Body, it: Item) {
  const k = itemKey(it);
  for (let i = 0; i < b.media.length; i++) {
    const j = itemsOf(b.media[i]).findIndex((x) => itemKey(x) === k);
    if (j >= 0) return { i, j };
  }
  return { i: -1, j: -1 };
}

/** Takes a picture out of the note: on its own, its line goes; in an album, the album keeps the others. */
export function removeItem(b: Body, it: Item): Body {
  const { i } = findItem(b, it);
  if (i < 0) return b;
  const m = b.media[i];
  if (m.kind !== 'album') return removeMedia(b, m);
  const rest = m.items.filter((x) => itemKey(x) !== itemKey(it));
  return { texts: b.texts, media: b.media.map((x, k) => (k === i ? albumOf(rest, m) : x)) };
}
