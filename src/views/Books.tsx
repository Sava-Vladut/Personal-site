import { useMemo, useRef } from 'preact/hooks';
import { byline, mentionsByBook, progressOf, STATUS_LABEL } from '../lib/books';
import { navigate } from '../lib/router';
import { BOOK_STATUSES, useBooks, useEntries, useReady, type Book, type BookStatus } from '../lib/store';
import { BookCover, BookSpine, Stars } from '../components/books';
import { GhostRows, letterOf, MediaHead, More, Rail, Runs, runsOf, showList, SortChip, SORTS, type Sort } from '../components/collection';
import { Icon } from '../components/icons';
import { Mark } from '../components/Mark';
import { usePref } from '../lib/prefs';
import { count as countOf, noun, t } from '../lib/i18n';

/** How many books a rail holds before "See all"; the shelf stands more, as spines are thin. */
const RAIL = 12;
const SHELF = 40;

/** When a book was last moving: finished, else started ('' for neither, which sorts last). */
const lastDay = (b: Book) => b.finished ?? b.started ?? '';
const byRecent = (a: Book, b: Book) => lastDay(b).localeCompare(lastDay(a)) || b.updated - a.updated;

/**
 * The Media page's books. First what's on now: what you're reading, what's next, and the books you've finished standing
 * on one shelf you swipe along (in a column at the right on a wide screen). Then every book as a list, in runs by
 * where it is (reading, to read, read), its letter or its stars.
 */
export function BooksTab({ q, onAdd }: { q: string; onAdd: () => void }) {
  const books = useBooks();
  const entries = useEntries();
  const ready = useReady();
  const [chosen, setShelf] = usePref<BookStatus | 'all'>('books-shelf', 'all', ['all', ...BOOK_STATUSES]);
  const [sort, setSort] = usePref<Sort>('books-sort', 'recent', SORTS.map(([s]) => s));
  const mentions = useMemo(() => mentionsByBook(entries, books), [entries, books]);
  const list = useRef<HTMLElement>(null);

  const of = useMemo(() => {
    const out = new Map<BookStatus, Book[]>(BOOK_STATUSES.map((s) => [s, []]));
    for (const b of books) out.get(b.status)!.push(b);
    for (const l of out.values()) l.sort(byRecent);
    return out;
  }, [books]);
  const count = (s: BookStatus) => of.get(s)!.length;
  // a shelf that has emptied since you picked it shows everything again
  const shelf = chosen !== 'all' && !count(chosen) ? 'all' : chosen;
  // a shelf is worth a chip when it would show something other than everything
  const chips = BOOK_STATUSES.filter((s) => s === shelf || (count(s) > 0 && count(s) < books.length));

  const query = q.trim();
  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = books.filter((b) => (shelf === 'all' || b.status === shelf) && words.every((w) => `${b.title} ${b.authors}`.toLowerCase().includes(w)));
    const at = (b: Book) => BOOK_STATUSES.indexOf(b.status);
    if (sort === 'recent') list.sort((a, b) => at(a) - at(b) || byRecent(a, b));
    if (sort === 'title') list.sort((a, b) => (a.title.trim() || t('Untitled')).localeCompare(b.title.trim() || t('Untitled'), undefined, { sensitivity: 'base' }));
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating || b.updated - a.updated);
    return list;
  }, [books, shelf, sort, query]);

  // the most recent order runs by where each book is; the others by letter or stars, with where it is beside it
  const byStatus = sort === 'recent';
  const runs = useMemo(() => runsOf(shown, (b) =>
    sort === 'title' ? letterOf(b.title.trim() || t('Untitled')) : sort === 'rating' ? (b.rating ? countOf(b.rating, 'star', 'stars') : t('Not rated')) : STATUS_LABEL[b.status]), [shown, sort]);

  const seeAll = (s: BookStatus) => {
    setShelf(s);
    showList(list.current);
  };

  const reading = of.get('reading')!;
  const want = of.get('want')!;
  const read = of.get('read')!;
  const now = books.length > 0 && !query;
  return (
    <div class={`mx${now ? ' has-now' : ''}`}>
      {now && (
        <div class="mx-now">
          {reading.length > 0 && (
            <section class="mx-rail">
              <MediaHead title={t('Reading now')} icon="book" count={reading.length > 1 ? reading.length : undefined} />
              <div class={`mx-reading-list${reading.length > 1 ? ' is-many' : ''}`}>
                {reading.map((b) => {
                  const pct = progressOf(b);
                  const notes = mentions.get(b.id)?.length ?? 0;
                  return (
                    <button key={b.id} class="mx-reading card" onClick={() => navigate('book/' + b.id)}>
                      <BookCover b={b} width={52} />
                      <span class="mx-reading-main">
                        <span class="mx-reading-title">{b.title.trim() || t('Untitled')}</span>
                        <span class="mx-sub">{[b.authors, notes ? `${notes} ${noun(notes, 'note', 'notes')}` : ''].filter(Boolean).join(' · ')}</span>
                        {pct !== null && (
                          <span class="mx-progress" role="img" aria-label={t('{pct}% read', { pct })}>
                            <span class="meter"><i style={{ width: pct + '%' }} /></span>
                            <span class="mx-pct">{pct}%</span>
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {want.length > 0 && (
            <Rail title={STATUS_LABEL.want} icon="bookmark" count={want.length} action={want.length > RAIL && <More onClick={() => seeAll('want')} />}>
              {want.slice(0, RAIL).map((b) => (
                <button key={b.id} role="listitem" class="mx-item mx-book" onClick={() => navigate('book/' + b.id)} aria-label={[b.title.trim() || t('Untitled'), b.authors].filter(Boolean).join(', ')}>
                  <span class="mx-art"><BookCover b={b} width={76} /></span>
                  <span class="mx-title">{b.title.trim() || t('Untitled')}</span>
                  {b.authors && <span class="mx-sub">{b.authors}</span>}
                </button>
              ))}
            </Rail>
          )}

          {read.length > 0 && (
            <section class="mx-rail">
              <MediaHead title={STATUS_LABEL.read} icon="books" count={read.length}>
                {read.length > SHELF && <More onClick={() => seeAll('read')} />}
              </MediaHead>
              {/* the books you've finished, newest at the left, on one plank you swipe along */}
              <div class="shelf mx-shelf" role="list" aria-label={STATUS_LABEL.read}>
                {read.slice(0, SHELF).map((b, i) => <span class="shelf-slot" role="listitem" key={b.id}><BookSpine b={b} k={i} /></span>)}
              </div>
            </section>
          )}
        </div>
      )}

      <section class="mx-list" ref={list}>
        {books.length > 0 && (
          <>
            <MediaHead title={query ? t('Found') : t('All books')} count={shown.length}>
              <SortChip sort={sort} onSort={setSort} />
            </MediaHead>
            {chips.length > 0 && (
              <div class="chips scroll-x mx-chips" role="toolbar" aria-label={t('Shelf and order')}>
                <button class="chip" aria-pressed={shelf === 'all'} onClick={() => setShelf('all')}>{t('All')} {books.length}</button>
                {chips.map((s) => <button class="chip" aria-pressed={shelf === s} onClick={() => setShelf(s)}>{STATUS_LABEL[s]} {count(s)}</button>)}
              </div>
            )}
          </>
        )}

        {!ready && !books.length && <GhostRows tall />}

        {ready && !books.length && (
          <div class="empty">
            <Mark id="spot:shelf" hue="hope-interest" size={96} />
            <p>{t('No books yet')}</p>
            <button class="btn btn-quiet" onClick={onAdd}><Icon name="plus" size={18} /> {t('Add a book')}</button>
          </div>
        )}
        {!!books.length && !shown.length && <p class="empty-note center">{t('No books match.')}</p>}

        {shown.length > 0 && <Runs runs={runs} row={(b: Book) => <BookLine key={b.id} b={b} status={!byStatus} />} />}
      </section>
    </div>
  );
}

/** A book in the list: its cover, title, who wrote it (and where it is, when the list isn't in runs by that), and at the end how far in or its stars. */
function BookLine({ b, status }: { b: Book; status: boolean }) {
  const pct = b.status === 'reading' ? progressOf(b) : null;
  const sub = [byline(b), status && STATUS_LABEL[b.status]].filter(Boolean).join(' · ') || STATUS_LABEL[b.status];
  return (
    <button
      class={`book-row mx-row is-${b.status}`}
      onClick={() => navigate('book/' + b.id)}
      aria-label={[b.title.trim() || t('Untitled'), sub, pct !== null && t('{pct}% read', { pct }), b.rating && t('{n} of 5 stars', { n: b.rating })].filter(Boolean).join(', ')}
    >
      <span class="mx-row-art"><BookCover b={b} width={34} /></span>
      <span class="book-row-main">
        <span class="book-row-title">{b.title.trim() || t('Untitled')}</span>
        <span class="book-row-sub">{sub}</span>
      </span>
      <span class="mx-row-end" aria-hidden="true">
        {pct !== null ? <span class="mx-pct">{pct}%</span> : b.rating > 0 && <Stars value={b.rating} size={12} />}
      </span>
    </button>
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
