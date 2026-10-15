import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { mentionsByBook, progressOf, STATUS_LABEL } from '../lib/books';
import { navigate } from '../lib/router';
import { BOOK_STATUSES, useBooks, useEntries, useReady, type Book, type BookStatus } from '../lib/store';
import { BookCover, Shelf } from '../components/books';
import { Icon } from '../components/icons';
import { usePref } from '../lib/prefs';
import { count as countOf, noun, t } from '../lib/i18n';

export type Sort = 'recent' | 'title' | 'rating';
const SORTS: [Sort, string][] = [['recent', t('Recent')], ['title', t('A–Z')], ['rating', t('Top rated')]];

/** One chip for the order: each tap moves to the next. */
export function SortChip({ sort, onSort }: { sort: Sort; onSort: (s: Sort) => void }) {
  const at = SORTS.findIndex(([s]) => s === sort);
  const next = SORTS[(at + 1) % SORTS.length];
  return (
    <button class="chip sort-chip" onClick={() => onSort(next[0])} aria-label={t('Order: {now}. Change to {next}', { now: SORTS[at][1], next: next[1] })} title={t('Order by {next}', { next: next[1] })}>
      <Icon name="arrow-down" size={15} />
      <span key={sort}>{SORTS[at][1]}</span>
    </button>
  );
}

/** The row over a collection: what to show on the left (only when there's something to choose between), the order on the right. */
export function MediaFilters({ label, sort, onSort, children }: { label: string; sort: Sort; onSort: (s: Sort) => void; children?: ComponentChildren }) {
  return (
    <div class="media-tools">
      {children && <div class="chips scroll-x" role="toolbar" aria-label={label}>{children}</div>}
      <SortChip sort={sort} onSort={onSort} />
    </div>
  );
}

/** The Media page's books: what you're reading, then a shelf for each status. */
export function BooksTab({ q, onAdd }: { q: string; onAdd: () => void }) {
  const books = useBooks();
  const entries = useEntries();
  const ready = useReady();
  const [chosen, setShelf] = usePref<BookStatus | 'all'>('books-shelf', 'all', ['all', ...BOOK_STATUSES]);
  const [sort, setSort] = usePref<Sort>('books-sort', 'recent', SORTS.map(([s]) => s));
  const mentions = useMemo(() => mentionsByBook(entries, books), [entries, books]);

  const reading = books.filter((b) => b.status === 'reading');
  const count = (s: BookStatus) => books.filter((b) => b.status === s).length;
  // a shelf that has emptied since you picked it shows everything again
  const shelf = chosen !== 'all' && !count(chosen) ? 'all' : chosen;
  // a shelf is worth a chip when it would show something other than everything
  const chips = BOOK_STATUSES.filter((s) => s === shelf || (count(s) > 0 && count(s) < books.length));

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = books.filter((b) => (shelf === 'all' || b.status === shelf) && words.every((w) => `${b.title} ${b.authors}`.toLowerCase().includes(w)));
    if (sort === 'recent') list.sort((a, b) => (b.finished ?? b.started ?? '').localeCompare(a.finished ?? a.started ?? '') || b.updated - a.updated);
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating || b.updated - a.updated);
    return list;
  }, [books, shelf, sort, q]);

  // Everything at once stands on one shelf per status; books you're reading are already up top.
  const grouped = shelf === 'all' && !q.trim();
  const showReading = grouped && reading.length > 0;
  const shelves: [BookStatus | 'all', Book[]][] = grouped
    ? BOOK_STATUSES.filter((s) => !(s === 'reading' && showReading)).map((s): [BookStatus, Book[]] => [s, shown.filter((b) => b.status === s)]).filter(([, l]) => l.length > 0)
    : shown.length ? [[shelf, shown]] : [];

  return (
    <>
      {showReading && (
        <section class="section reading-now">
          <h2 class="section-title"><Icon name="bookmark" size={16} /> {t('Reading now')}</h2>
          <div class="reading-list">
            {reading.map((b) => {
              const pct = progressOf(b);
              const notes = mentions.get(b.id)?.length ?? 0;
              return (
                <button key={b.id} class="reading-card card" onClick={() => navigate('book/' + b.id)}>
                  <BookCover b={b} width={40} />
                  <span class="book-row-main">
                    <span class="book-row-title">{b.title.trim() || t('Untitled')}</span>
                    <span class="book-row-sub">{[b.authors, notes ? `${notes} ${noun(notes, 'note', 'notes')}` : ''].filter(Boolean).join(' · ')}</span>
                    {pct !== null && (
                      <span class="progress" role="img" aria-label={t('{pct}% read', { pct })}><i style={{ width: pct + '%' }} /></span>
                    )}
                  </span>
                  {pct !== null && <span class="muted small">{pct}%</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {books.length > 0 && (
        <MediaFilters label={t('Shelf and order')} sort={sort} onSort={setSort}>
          {chips.length > 0 && (
            <>
              <button class="chip" aria-pressed={shelf === 'all'} onClick={() => setShelf('all')}>{t('All')} {books.length}</button>
              {chips.map((s) => <button class="chip" aria-pressed={shelf === s} onClick={() => setShelf(s)}>{STATUS_LABEL[s]} {count(s)}</button>)}
            </>
          )}
        </MediaFilters>
      )}

      {ready && !books.length && (
        <div class="empty">
          <h2 class="title-s">{t('No books yet')}</h2>
          <p>{t('Add what you’re reading, what you’ve loved, and what you want to read next. Mention them in notes to keep a reading journal.')}</p>
          <button class="btn btn-primary" onClick={onAdd}><Icon name="books" size={18} /> {t('Add a book')}</button>
        </div>
      )}
      {!!books.length && !shown.length && <p class="empty-note center">{t('No books match.')}</p>}

      {shelves.map(([s, list]) => (
        <section class="shelf-group" key={s}>
          {grouped && <h2 class="shelf-name">{STATUS_LABEL[s as BookStatus]} <span class="muted">{list.length}</span></h2>}
          <Shelf books={list} />
        </section>
      ))}
    </>
  );
}

/** The line under the shelf's title: reading, read this year, still to read, and the average rating. */
export function bookSummary(books: Book[]): string {
  const year = new Date().getFullYear();
  const of = (status: BookStatus) => books.filter((b) => b.status === status);
  const read = of('read').filter((b) => b.finished?.startsWith(String(year))).length;
  const rated = books.filter((b) => b.rating);
  return [
    of('reading').length ? `${of('reading').length} ${t('reading')}` : '',
    read ? `${read} ${t('read in {year}', { year })}` : '',
    of('want').length ? `${of('want').length} ${t('to read')}` : '',
    rated.length ? t('{n} ★ average', { n: (rated.reduce((n, b) => n + b.rating, 0) / rated.length).toFixed(1) }) : '',
  ].filter(Boolean).join(' · ') || countOf(books.length, 'book', 'books');
}
