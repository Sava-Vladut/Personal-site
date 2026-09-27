// Books come from Open Library (openlibrary.org): free, no key, called straight from the browser.
import { getBooks, type Book, type BookStatus, type Entry } from './store';

export interface FoundBook {
  olid: string;
  title: string;
  authors: string;
  year: number | null;
  pages: number | null;
  cover: string | null;
}

const OL = 'https://openlibrary.org';
const cover = (id: unknown) => (Number.isInteger(id) && (id as number) > 0 ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : null);

export async function searchBooks(q: string, page = 1): Promise<{ items: FoundBook[]; more: boolean }> {
  const url = `${OL}/search.json?q=${encodeURIComponent(q.trim())}&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median&limit=20&page=${page}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('Can’t reach Open Library. Check your connection, or add the book by hand.');
  }
  if (!res.ok) throw new Error(`Open Library didn’t answer (${res.status}). Try again in a moment.`);
  const body = await res.json();
  const items = (Array.isArray(body.docs) ? body.docs : [])
    .filter((d: any) => typeof d.key === 'string' && /^\/works\/OL\d+W$/.test(d.key) && typeof d.title === 'string')
    .map((d: any): FoundBook => ({
      olid: d.key,
      title: d.title.slice(0, 300),
      authors: Array.isArray(d.author_name) ? d.author_name.slice(0, 3).join(', ').slice(0, 300) : '',
      year: Number.isInteger(d.first_publish_year) ? d.first_publish_year : null,
      pages: Number.isInteger(d.number_of_pages_median) ? d.number_of_pages_median : null,
      cover: cover(d.cover_i),
    }));
  return { items, more: page * 20 < (Number(body.numFound) || 0) };
}

export const STATUS_LABEL: Record<BookStatus, string> = { reading: 'Reading', want: 'Want to read', read: 'Read', dnf: 'Didn’t finish' };

/* ---------- mentions ----------
   A note mentions a book as [[Title]], like a wiki link, so it reads naturally while writing and can be typed by hand.
   Only when two books on the shelf share a title does it name the one it means: [[book:<id>|Title]]. */

export const MENTION = /\[\[(?:([^\]|\n]+)\|)?([^\]\n]+)\]\]/g;
const key = (t: string) => t.trim().toLowerCase();
const clean = (t: string) => (t.trim() || 'Untitled').replace(/[\]|\n]/g, ' ');

/** The book a [[target|text]] link points to, if it's on the shelf. */
export function resolveMention(target: string | undefined, text: string, books: Book[]) {
  if (target?.startsWith('book:')) return books.find((b) => b.id === target.slice(5));
  const k = key(target ?? text);
  return books.find((b) => key(b.title) === k);
}

export function mentionOf(b: Book, books: Book[]) {
  const t = clean(b.title);
  const unique = t === b.title.trim() && books.filter((x) => key(x.title) === key(t)).length <= 1;
  return unique ? `[[${t}]]` : `[[book:${b.id}|${t}]]`;
}

/** Ids of the books a note mentions. */
export const booksIn = (text: string, books: Book[]) =>
  text.includes('[[') ? [...new Set([...text.matchAll(MENTION)].map((m) => resolveMention(m[1], m[2], books)?.id).filter(Boolean) as string[])] : [];

/** book id → the notes mentioning it, newest first. */
export function mentionsByBook(entries: Entry[], books: Book[]) {
  const m = new Map<string, Entry[]>();
  for (const e of entries)
    for (const id of booksIn(e.text, books)) {
      const list = m.get(id);
      if (list) list.push(e);
      else m.set(id, [e]);
    }
  return m;
}

/** After a book is renamed: its [[Old title]] mentions become [[New title]], so the notes still point to it. */
export function renameMentions(entries: Entry[], before: Book[], book: Book): Entry[] {
  const after = [...before.filter((b) => b.id !== book.id), book];
  const out: Entry[] = [];
  for (const e of entries) {
    if (!booksIn(e.text, before).includes(book.id)) continue;
    const text = e.text.replace(MENTION, (all, target, t) => (resolveMention(target, t, before)?.id === book.id ? mentionOf(book, after) : all));
    if (text !== e.text) out.push({ ...e, text });
  }
  return out;
}

export const findBook = (id: string) => getBooks().find((b) => b.id === id);

/** 'Frank Herbert · 1965' */
export const byline = (b: Pick<Book, 'authors' | 'year'>) => [b.authors, b.year].filter(Boolean).join(' · ');
