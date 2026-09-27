// A note's text can hold its pictures inline: a line of its own that reads [[photo:<id>]] or [[image:<url>]].
// Split, the body is text, picture, text, picture, …, text — always one more text than pictures.
import type { Entry, WebImage } from './store';

export type Media = { kind: 'photo'; id: string } | { kind: 'image'; url: string };
export interface Body { texts: string[]; media: Media[] }

const MARKER = /^\[\[(photo|image):([^\]\n]+)\]\]$/;

const marker = (m: Media) => `[[${m.kind}:${m.kind === 'photo' ? m.id : m.url}]]`;
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
    media.push(m[1] === 'photo' ? { kind: 'photo', id: m[2] } : { kind: 'image', url: m[2] });
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
