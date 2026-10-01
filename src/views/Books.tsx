import { useMemo, useState } from 'preact/hooks';
import { mentionsByBook, progressOf, STATUS_LABEL } from '../lib/books';
import { navigate } from '../lib/router';
import { BOOK_STATUSES, useBooks, useEntries, useReady, type Book, type BookStatus } from '../lib/store';
import { BookCover, Shelf } from '../components/books';
import { Icon } from '../components/icons';

export type Sort = 'recent' | 'title' | 'rating';
const SORTS: [Sort, string][] = [['recent', 'Recent'], ['title', 'A–Z'], ['rating', 'Top rated']];

/** One chip for the order: each tap moves to the next. */
export function SortChip({ sort, onSort }: { sort: Sort; onSort: (s: Sort) => void }) {
  const at = SORTS.findIndex(([s]) => s === sort);
  const next = SORTS[(at + 1) % SORTS.length];
  return (
    <button class="chip sort-chip" onClick={() => onSort(next[0])} aria-label={`Order: ${SORTS[at][1]}. Change to ${next[1]}`} title={`Order by ${next[1]}`}>
      <Icon name="arrow-down" size={15} />
      <span key={sort}>{SORTS[at][1]}</span>
    </button>
  );
}

/** The Media page's books: what you're reading, then a shelf for each status. */
export function BooksTab({ q, onAdd }: { q: string; onAdd: () => void }) {
  const books = useBooks();
  const entries = useEntries();
  const ready = useReady();
  const [shelf, setShelf] = useState<BookStatus | 'all'>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const mentions = useMemo(() => mentionsByBook(entries, books), [entries, books]);

  const reading = books.filter((b) => b.status === 'reading');
  const count = (s: BookStatus) => books.filter((b) => b.status === s).length;

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
          <h2 class="section-title"><Icon name="bookmark" size={16} /> Reading now</h2>
          <div class="reading-list">
            {reading.map((b) => {
              const pct = progressOf(b);
              const notes = mentions.get(b.id)?.length ?? 0;
              return (
                <button class="reading-card card" onClick={() => navigate('book/' + b.id)}>
                  <BookCover b={b} width={40} />
                  <span class="book-row-main">
                    <span class="book-row-title">{b.title.trim() || 'Untitled'}</span>
                    <span class="book-row-sub">{[b.authors, notes ? `${notes} ${notes === 1 ? 'note' : 'notes'}` : ''].filter(Boolean).join(' · ')}</span>
                    {pct !== null && (
                      <span class="progress" role="img" aria-label={`${pct}% read`}><i style={{ width: pct + '%' }} /></span>
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
        <div class="chips scroll-x filters media-filters" role="toolbar" aria-label="Shelf and order">
          <SortChip sort={sort} onSort={setSort} />
          <button class="chip" aria-pressed={shelf === 'all'} onClick={() => setShelf('all')}>All {books.length}</button>
          {BOOK_STATUSES.map((s) => count(s) > 0 && (
            <button class="chip" aria-pressed={shelf === s} onClick={() => setShelf(s)}>{STATUS_LABEL[s]} {count(s)}</button>
          ))}
        </div>
      )}

      {ready && !books.length && (
        <div class="empty">
          <h2 class="title-s">No books yet</h2>
          <p>Add what you’re reading, what you’ve loved, and what you want to read next. Mention them in notes to keep a reading journal.</p>
          <button class="btn btn-primary" onClick={onAdd}><Icon name="books" size={18} /> Add a book</button>
        </div>
      )}
      {!!books.length && !shown.length && <p class="empty-note center">No books match.</p>}

      {shelves.map(([s, list]) => (
        <section class="shelf-group" key={s}>
          {grouped && <h2 class="shelf-name">{STATUS_LABEL[s as BookStatus]} <span class="muted">{list.length}</span></h2>}
          <Shelf books={list} />
        </section>
      ))}
    </>
  );
}

/** The numbers over the shelf: reading, read this year, still to read, and the average rating. */
export function bookStats(books: Book[]): [string, string][] {
  const year = new Date().getFullYear();
  const read = books.filter((b) => b.status === 'read' && b.finished?.startsWith(String(year))).length;
  const rated = books.filter((b) => b.rating);
  const out: [string, string][] = [
    [String(books.filter((b) => b.status === 'reading').length), 'reading'],
    [String(read), `read in ${year}`],
    [String(books.filter((b) => b.status === 'want').length), 'to read'],
  ];
  if (rated.length) out.push([(rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1), 'average ★']);
  return out.filter(([v]) => v !== '0');
}
