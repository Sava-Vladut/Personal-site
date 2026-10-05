// Tags in a note's words, written so they read naturally while writing (and can be typed by hand):
//   @[Ana]              someone in People       — @[person:<id>|Ana] when two people share the name
//   [[Dune]]            a book on your shelf     — see books.ts
//   ♪[Blinding Lights]  music in your records   — ♪[song:<id>|Title] when two share a title
//   [[note:<id>|Title]] another note             — see links.ts
import { coreOf } from '../data/emotions';
import { MENTION, resolveMention } from './books';
import type { Book, Entry, Person, Song } from './store';

export const PERSON = /@\[(?:person:([^\]|\n]+)\|)?([^\]\n]+)\]/g;
export const SONG = /♪\[(?:song:([^\]|\n]+)\|)?([^\]\n]+)\]/g;

const key = (t: string) => t.trim().normalize('NFC').toLowerCase();
/** Keyboard composition and iOS spaces should not change which names suggestions find. */
export const searchKey = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
const clean = (t: string) => (t.trim() || 'Untitled').replace(/[\]|\n]/g, ' ').slice(0, 120);

export function resolvePerson(target: string | undefined, text: string, people: Person[]) {
  if (target) return people.find((p) => p.id === target);
  const k = key(text);
  return people.find((p) => key(p.name) === k);
}
export function resolveSong(target: string | undefined, text: string, songs: Song[]) {
  if (target) return songs.find((s) => s.id === target);
  const k = key(text);
  return songs.find((s) => key(s.music.title) === k);
}

export function mentionOfPerson(p: Person, people: Person[]) {
  const n = clean(p.name);
  const unique = n === p.name.trim() && people.filter((x) => key(x.name) === key(n)).length <= 1;
  return unique ? `@[${n}]` : `@[person:${p.id}|${n}]`;
}
export function mentionOfSong(s: Song, songs: Song[]) {
  const t = clean(s.music.title);
  const unique = t === s.music.title.trim() && songs.filter((x) => key(x.music.title) === key(t)).length <= 1;
  return unique ? `♪[${t}]` : `♪[song:${s.id}|${t}]`;
}

/** Ids of the music a note's words mention. */
export const songsIn = (text: string, songs: Song[]) =>
  text.includes('♪[') ? [...new Set([...text.matchAll(SONG)].map((m) => resolveSong(m[1], m[2], songs)?.id).filter(Boolean) as string[])] : [];

export type MentionKind = 'person' | 'book' | 'song' | 'note';
export interface Found { start: number; end: number; kind: MentionKind; core: string | null }

/** Every tag in a stretch of text that points at something you have, with where it sits: for colouring them while writing. */
export function mentionsIn(text: string, people: Person[], books: Book[], songs: Song[]): Found[] {
  const out: Found[] = [];
  if (!/@\[|\[\[|♪\[/.test(text)) return out;
  for (const m of text.matchAll(PERSON)) {
    const p = resolvePerson(m[1], m[2], people);
    if (p) out.push({ start: m.index!, end: m.index! + m[0].length, kind: 'person', core: p.emotions[0] ? coreOf(p.emotions[0])?.id ?? null : null });
  }
  for (const m of text.matchAll(MENTION)) {
    if (resolveMention(m[1], m[2], books)) out.push({ start: m.index!, end: m.index! + m[0].length, kind: 'book', core: null });
  }
  for (const m of text.matchAll(SONG)) {
    if (resolveSong(m[1], m[2], songs)) out.push({ start: m.index!, end: m.index! + m[0].length, kind: 'song', core: null });
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** After someone is renamed: their @[Old name] tags become @[New name], so the words still point to them. */
export function retagPerson(text: string, before: Person[], person: Person) {
  if (!text.includes('@[')) return text;
  const after = [...before.filter((p) => p.id !== person.id), person];
  const mention = mentionOfPerson(person, after);
  return text.replace(PERSON, (all, target, name) => (resolvePerson(target, name, before)?.id === person.id ? mention : all));
}

/** The notes (or pages) whose tags change after someone is renamed, changed. */
export function renamePersonMentions<T extends { text: string }>(items: T[], before: Person[], person: Person): T[] {
  const out: T[] = [];
  for (const e of items) {
    const text = retagPerson(e.text, before, person);
    if (text !== e.text) out.push({ ...e, text });
  }
  return out;
}

/** The @query being typed just before the caret, if any: where its @ is and what follows it. */
export function typedMention(text: string, caret: number) {
  if (!Number.isFinite(caret)) return null;
  caret = Math.max(0, Math.min(Math.trunc(caret), text.length));
  const before = text.slice(0, caret);
  const m = /(?:^|[\s([{"'“‘])@([^\r\n\t@[\].,!?;:]{0,120})$/.exec(before); // sentence endings end the query too
  // JavaScript's $ also matches before a final newline, which must actually end a tag.
  if (!m || m.index + m[0].length !== before.length || /\s{2}$/.test(m[1])) return null;
  const start = caret - m[1].length - 1;
  // Moving the caret into an existing tag's label must not offer a nested tag.
  if (/(?:@\[|♪\[|\[\[)[^\]\r\n]*$/.test(before.slice(0, start))) return null;
  return { start, end: caret, q: m[1] };
}

/* ---------- what an @ can find ---------- */

export type Suggestion =
  | { kind: 'person'; item: Person }
  | { kind: 'book'; item: Book }
  | { kind: 'song'; item: Song };

/** How well `q` matches some words: 3 for the start of the whole, 2 for the start of a word, 1 anywhere, 0 not at all. */
export function score(q: string, ...texts: string[]) {
  let best = 0;
  for (const t of texts) {
    const s = searchKey(t);
    if (!s) continue;
    if (s.startsWith(q)) return 3;
    if (s.split(/[\s\-–—,.'’()]+/).some((w) => w.startsWith(q))) best = Math.max(best, 2);
    else if (s.includes(q)) best = Math.max(best, 1);
  }
  return best;
}

/**
 * What an @ suggests: with nothing typed yet, the people you've tagged lately, the books you're reading and the music
 * on repeat; otherwise the best matches across all three, people first when they match as well.
 */
export function suggest(q: string, people: Person[], books: Book[], songs: Song[], entries: Entry[], max = 8): Suggestion[] {
  const needle = searchKey(q);
  if (!needle) {
    const recent = new Set<string>();
    for (const e of entries) for (const id of e.people) recent.add(id);
    const byId = new Map(people.map((p) => [p.id, p]));
    const ps = [...[...recent].map((id) => byId.get(id)).filter(Boolean) as Person[], ...people.filter((p) => !recent.has(p.id))].slice(0, 4);
    return [
      ...ps.map((item): Suggestion => ({ kind: 'person', item })),
      ...books.filter((b) => b.status === 'reading').slice(0, 2).map((item): Suggestion => ({ kind: 'book', item })),
      ...[...songs.filter((s) => s.repeat), ...songs.filter((s) => !s.repeat)].slice(0, 2).map((item): Suggestion => ({ kind: 'song', item })),
    ].slice(0, max);
  }
  const all: [number, number, Suggestion][] = [];
  const least = needle.length < 3 ? 2 : 1; // a letter or two only matches the start of a word
  people.forEach((item, i) => { const s = score(needle, item.name, item.relation); if (s >= least) all.push([s + 0.3, -i, { kind: 'person', item }]); });
  books.forEach((item, i) => { const s = score(needle, item.title, item.authors); if (s >= least) all.push([s + 0.1, -i, { kind: 'book', item }]); });
  songs.forEach((item, i) => { const s = score(needle, item.music.title, item.music.sub ?? ''); if (s >= least) all.push([s, -i, { kind: 'song', item }]); });
  return all.sort((a, b) => b[0] - a[0] || b[1] - a[1]).slice(0, max).map((x) => x[2]);
}
