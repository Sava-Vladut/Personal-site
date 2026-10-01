import { useEffect, useMemo, useState } from 'preact/hooks';
import { mentionsByBook, progressOf, STATUS_LABEL } from '../lib/books';
import { navigate, navigateAfterSheet } from '../lib/router';
import { BOOK_STATUSES, useBooks, useEntries, useReady, type Book, type BookStatus } from '../lib/store';
import { BookCover, BookSheet, Shelf } from '../components/books';
import { Icon } from '../components/icons';

type Sort = 'recent' | 'title' | 'rating';

export function Books({ query }: { query: URLSearchParams }) {
  const books = useBooks();
  const entries = useEntries();
  const ready = useReady();
  const [adding, setAdding] = useState(false);
  const [shelf, setShelf] = useState<BookStatus | 'all'>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [q, setQ] = useState('');
  const mentions = useMemo(() => mentionsByBook(entries, books), [entries, books]);

  // "+ → Book" lands here with ?add
  useEffect(() => {
    if (!query.has('add')) return;
    history.replaceState(history.state, '', '#/books');
    setAdding(true);
  }, []);

  const year = new Date().getFullYear();
  const readThisYear = books.filter((b) => b.status === 'read' && b.finished?.startsWith(String(year)));
  const rated = readThisYear.filter((b) => b.rating);
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
    <div class="page">
      <header class="page-head">
        <div class="eyebrow">Books</div>
        <div class="row between">
          <h1 class="title">Your shelf</h1>
          <button class="icon-btn" onClick={() => setAdding(true)} aria-label="Add a book" title="Add a book">
            <Icon name="plus" />
          </button>
        </div>
        <p class="subtitle">
          {books.length
            ? `${readThisYear.length} read in ${year}${rated.length ? ` · average ${(rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1)} ★` : ''}`
            : 'Keep the books you read, rate them, and mention them in your notes.'}
        </p>
      </header>

      {showReading && (
        <section class="section reading-now">
          <h2 class="section-title">Reading now</h2>
          <div class="reading-list">
            {reading.map((b) => {
              const pct = progressOf(b);
              const notes = mentions.get(b.id)?.length ?? 0;
              return (
                <button class="reading-card card" onClick={() => navigate('book/' + b.id)}>
                  <BookCover b={b} width={52} />
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
        <>
          <label class="search">
            <Icon name="search" size={18} />
            <input type="search" placeholder="Search your books" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Search your books" />
          </label>
          <div class="chips filters" role="toolbar" aria-label="Shelf">
            <button class="chip" aria-pressed={shelf === 'all'} onClick={() => setShelf('all')}>All {books.length}</button>
            {BOOK_STATUSES.map((s) => count(s) > 0 && (
              <button class="chip" aria-pressed={shelf === s} onClick={() => setShelf(s)}>{STATUS_LABEL[s]} {count(s)}</button>
            ))}
          </div>
          <div class="chips filters" role="toolbar" aria-label="Sort">
            <button class="chip" aria-pressed={sort === 'recent'} onClick={() => setSort('recent')}>Recent</button>
            <button class="chip" aria-pressed={sort === 'title'} onClick={() => setSort('title')}>A–Z</button>
            <button class="chip" aria-pressed={sort === 'rating'} onClick={() => setSort('rating')}>Top rated</button>
          </div>
        </>
      )}

      {ready && !books.length && (
        <div class="empty">
          <h2 class="title-s">No books yet</h2>
          <p>Add what you’re reading, what you’ve loved, and what you want to read next. Mention them in notes to keep a reading journal.</p>
          <button class="btn btn-primary" onClick={() => setAdding(true)}><Icon name="books" size={18} /> Add a book</button>
        </div>
      )}
      {!!books.length && !shown.length && <p class="empty-note center">No books match.</p>}

      {shelves.map(([s, list]) => (
        <section class="shelf-group" key={s}>
          {grouped && <h2 class="shelf-name">{STATUS_LABEL[s as BookStatus]} <span class="muted">{list.length}</span></h2>}
          <Shelf books={list} />
        </section>
      ))}

      <BookSheet open={adding} onClose={() => setAdding(false)} onPick={(b) => { setAdding(false); navigateAfterSheet('book/' + b.id); }} />
    </div>
  );
}
