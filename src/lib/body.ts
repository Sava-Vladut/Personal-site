// A note's text can hold its pictures inline: a line of its own that reads [[photo:<id>]] or [[image:<url>]].
// A picture made smaller carries its width (in % of the column) and side: [[photo:<id> 50 left]].
// Split, the body is text, picture, text, picture, …, text — always one more text than pictures.
import type { Entry, WebImage } from './store';

export interface Layout {
  size?: number;              // % of the column's width, 100 when missing
  align?: 'left' | 'right';   // centred when missing; only matters below 100%
}
export type Media = ({ kind: 'photo'; id: string } | { kind: 'image'; url: string }) & Layout;
export interface Body { texts: string[]; media: Media[] }

export const MIN_SIZE = 20;
const MARKER = /^\[\[(photo|image):([^\]\s]+)((?: \w+)*)\]\]$/;

function layoutOf(opts: string): Layout {
  const out: Layout = {};
  for (const o of opts.split(' ')) {
    if (/^\d{1,3}$/.test(o) && +o < 100) out.size = Math.max(MIN_SIZE, +o);
    else if (o === 'left' || o === 'right') out.align = o;
  }
  if (!out.size) delete out.align;
  return out;
}

const marker = (m: Media) =>
  `[[${m.kind}:${m.kind === 'photo' ? m.id : m.url}${m.size && m.size < 100 ? ` ${m.size}${m.align ? ' ' + m.align : ''}` : ''}]]`;
export const mediaKey = (m: Media) => (m.kind === 'photo' ? 'photo:' + m.id : 'image:' + m.url);
export const sameMedia = (a: Media, b: Media) => a.kind === b.kind && (a.kind === 'photo' ? a.id === (b as typeof a).id : a.url === (b as typeof a).url);

export function parseBody(text: string): Body {
  const texts: string[] = [];
  const media: Media[] = [];
  let cur: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(MARKER);
    if (!m) {
      cur.push(line);
      continue;
    }
    texts.push(cur.join('\n'));
    cur = [];
    media.push({ ...(m[1] === 'photo' ? { kind: 'photo', id: m[2] } : { kind: 'image', url: m[2] }), ...layoutOf(m[3]) } as Media);
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

/** Drops markers whose picture is gone, and places pictures that aren't in the text yet at its end. */
export function bodyOf(e: Entry): Body {
  const b = parseBody(e.text);
  const known = (m: Media) => (m.kind === 'photo' ? e.photos.some((p) => p.id === m.id) : e.images.some((i) => i.url === m.url));
  const out: Body = { texts: [b.texts[0]], media: [] };
  b.media.forEach((m, i) => {
    if (known(m) && !out.media.some((x) => sameMedia(x, m))) {
      out.media.push(m);
      out.texts.push(b.texts[i + 1]);
    } else {
      const t = out.texts.length - 1;
      out.texts[t] = [out.texts[t], b.texts[i + 1]].filter(Boolean).join('\n');
    }
  });
  const missing: Media[] = [
    ...e.photos.map((p) => ({ kind: 'photo' as const, id: p.id })),
    ...e.images.map((i) => ({ kind: 'image' as const, url: i.url })),
  ].filter((m) => !out.media.some((x) => sameMedia(x, m)));
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
