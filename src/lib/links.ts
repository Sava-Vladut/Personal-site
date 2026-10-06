// A note links to another note like a wiki link: [[note:<id>|Title]]. It points at the note itself, so the link
// survives the note being renamed; the title after the | is only there to read while writing, and links show the
// note's current title. A plain [[Title]] typed by hand works too: it's a book's when one on the shelf has that title,
// otherwise the newest note with it.
import { MENTION, resolveMention } from './books';
import { stripMarkdown } from './markdown';
import { score, searchKey } from './mentions';
import type { Book, Entry } from './store';
import { t } from './i18n';

const NOTE = 'note:';
const key = (t: string) => t.trim().normalize('NFC').toLowerCase();
const clean = (t: string) => t.replace(/[\]|\n]/g, ' ').trim().slice(0, 120) || 'Untitled';
const cut = (s: string, max: number) => (Array.from(s).length > max ? Array.from(s).slice(0, max - 1).join('').trimEnd() + '…' : s);
const PICTURE = /^\s*\[\[(?:photo|image|album):/;

/** What a note is called: its title, or its first line when it has none. */
export function noteLabel(e: Pick<Entry, 'title' | 'text'>) {
  const title = e.title.trim();
  if (title) return title;
  for (const l of e.text.split('\n')) {
    if (!l.trim() || PICTURE.test(l)) continue;
    const s = stripMarkdown(l).trim();
    if (s) return cut(s, 70);
  }
  return t('Untitled');
}

/** The note a [[target|text]] link points to, if it's still there. */
export function resolveNote(target: string | undefined, text: string, entries: Entry[], books: Book[]) {
  if (target !== undefined) return target.startsWith(NOTE) ? entries.find((e) => e.id === target.slice(NOTE.length)) : undefined;
  if (PICTURE.test('[[' + text) || resolveMention(undefined, text, books)) return undefined;
  const k = key(text);
  return entries.find((e) => e.kind === 'note' && key(e.title) === k);
}

export const linkOf = (e: Entry) => `[[${NOTE}${e.id}|${clean(noteLabel(e))}]]`;

/** Every note link in a stretch of text, with where it sits and where its note:<id>| part ends: for colouring them while writing. */
export function linkRanges(text: string, entries: Entry[], books: Book[]) {
  const out: { start: number; end: number; label: number }[] = [];
  if (!text.includes('[[')) return out;
  for (const m of text.matchAll(MENTION)) {
    if (!resolveNote(m[1], m[2], entries, books)) continue;
    const start = m.index!;
    out.push({ start, end: start + m[0].length, label: start + 2 + (m[1] === undefined ? 0 : m[1].length + 1) });
  }
  return out;
}

/** The notes that link to note `id`, newest first, each with the line the link sits on. */
export function linkedFrom(id: string, entries: Entry[], books: Book[]) {
  const out: { entry: Entry; context: string }[] = [];
  for (const e of entries) {
    if (e.id === id || !e.text.includes('[[')) continue;
    const line = e.text.split('\n').find((l) => l.includes('[[') && [...l.matchAll(MENTION)].some((m) => resolveNote(m[1], m[2], entries, books)?.id === id));
    if (line === undefined) continue;
    const context = stripMarkdown(line.replace(MENTION, (all, target, text) => {
      const n = resolveNote(target, text, entries, books);
      return n ? `[[${clean(noteLabel(n))}]]` : all;
    })).trim();
    out.push({ entry: e, context: cut(context, 160) });
  }
  return out;
}

/** The [[query being typed just before the caret, if any: where its [[ is and what follows it. */
export function typedLink(text: string, caret: number) {
  if (!Number.isFinite(caret)) return null;
  caret = Math.max(0, Math.min(Math.trunc(caret), text.length));
  const before = text.slice(0, caret);
  const m = /\[\[([^[\]|\r\n]{0,120})$/.exec(before);
  if (!m || m.index + m[0].length !== before.length || /\s{2}$/.test(m[1]) || /^(?:photo|image|album|note|book):/.test(m[1])) return null;
  return { start: m.index, end: caret, q: m[1], link: true as const };
}

export type LinkSuggestion = { kind: 'note'; item: Entry } | { kind: 'book'; item: Book };

/**
 * What a [[ suggests: with nothing typed yet, your latest notes and the books you're reading; otherwise the best
 * matches by title (or first line), notes first when they match as well. Never the note being written.
 */
export function suggestLinks(q: string, entries: Entry[], books: Book[], self: string, max = 8): LinkSuggestion[] {
  const notes = entries.filter((e) => e.kind === 'note' && e.id !== self);
  const needle = searchKey(q);
  if (!needle)
    return [
      ...notes.slice(0, 6).map((item): LinkSuggestion => ({ kind: 'note', item })),
      ...books.filter((b) => b.status === 'reading').slice(0, 2).map((item): LinkSuggestion => ({ kind: 'book', item })),
    ].slice(0, max);
  const all: [number, number, LinkSuggestion][] = [];
  const least = needle.length < 3 ? 2 : 1; // a letter or two only matches the start of a word
  notes.forEach((item, i) => { const s = score(needle, noteLabel(item)); if (s >= least) all.push([s + 0.2, -i, { kind: 'note', item }]); });
  books.forEach((item, i) => { const s = score(needle, item.title, item.authors); if (s >= least) all.push([s, -i, { kind: 'book', item }]); });
  return all.sort((a, b) => b[0] - a[0] || b[1] - a[1]).slice(0, max).map((x) => x[2]);
}
