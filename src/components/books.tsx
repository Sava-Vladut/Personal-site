import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { coreOf } from '../data/emotions';
import { byline, resolveMention, searchBooks, STATUS_LABEL, type FoundBook } from '../lib/books';
import { todayKey } from '../lib/dates';
import { navigate } from '../lib/router';
import { blankBook, getBooks, saveBook, useBooks, type Book, type BookStatus } from '../lib/store';
import { Icon } from './icons';
import { Sheet } from './Sheet';

/** The book's cover, or a plain one with its title, tinted with the main feeling it left you with. */
export function BookCover({ b, width = 56 }: { b: Pick<Book, 'title' | 'cover'> & { emotions?: string[] }; width?: number }) {
  const [broken, setBroken] = useState(false);
  const main = b.emotions?.[0] ? coreOf(b.emotions[0]).id : null;
  return (
    <span class={`book-cover${main ? ' tinted' : ''}`} style={{ width, '--c': main ? `var(--emo-${main})` : undefined }} aria-hidden="true">
      {b.cover && !broken ? (
        <img src={b.cover} alt="" loading="lazy" referrerpolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        <span class="book-cover-title" style={{ fontSize: Math.max(8, Math.round(width / 7)) }}>{b.title.trim() || 'Untitled'}</span>
      )}
    </span>
  );
}

/** 1–5 stars. With `onChange`, tapping the current rating again clears it. */
export function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  if (!onChange)
    return (
      <span class="stars" role="img" aria-label={value ? `${value} out of 5 stars` : 'Not rated'}>
        {[1, 2, 3, 4, 5].map((n) => <Icon name="star" size={size} class={n <= value ? 'on' : ''} />)}
      </span>
    );
  return (
    <span class="stars is-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} onClick={() => onChange(value === n ? 0 : n)}>
          <Icon name="star" size={size} class={n <= value ? 'on' : ''} />
        </button>
      ))}
    </span>
  );
}

/** A [[wiki link]] in a note: a book on the shelf shows its cover and links to its page, anything else is just text. */
export function BookMention({ target, text }: { target?: string; text: string }) {
  const b = resolveMention(target, text, useBooks());
  if (!b) return <span class="md-wiki">{text}</span>;
  return (
    <a
      class="book-mention"
      href={'#/book/' + b.id}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('book/' + b.id); }}
    >
      <BookCover b={b} width={14} />
      <span>{text}</span>
    </a>
  );
}

/** A tagged book on a note card: tiny cover and title. */
export function BookChip({ b }: { b: Book }) {
  return (
    <span class="emo emo-sm book-chip">
      <BookCover b={b} width={12} />
      <span class="emo-name">{b.title.trim() || 'Untitled'}</span>
    </span>
  );
}

/** One book in a list: cover, title, author, and how it's going. */
export function BookRow({ b, onClick, end }: { b: Book; onClick: () => void; end?: preact.ComponentChildren }) {
  return (
    <button class="book-row" onClick={onClick}>
      <BookCover b={b} width={40} />
      <span class="book-row-main">
        <span class="book-row-title">{b.title.trim() || 'Untitled'}</span>
        <span class="book-row-sub">{byline(b) || STATUS_LABEL[b.status]}</span>
        {b.rating > 0 && <Stars value={b.rating} size={12} />}
      </span>
      <span class="track-end">{end}</span>
    </button>
  );
}

const sameWork = (b: Book, f: FoundBook) => b.olid === f.olid || (b.title.trim().toLowerCase() === f.title.toLowerCase() && b.authors === f.authors);

/**
 * Find a book: your shelf first, then Open Library, or add it by hand. A book picked from Open Library joins the
 * shelf (as `status`) before `onPick` gets it, so whatever picked it has a book to point to.
 */
export function BookSheet({ open, onClose, onPick, title = 'Add a book', status = 'want' }: {
  open: boolean;
  onClose: () => void;
  onPick: (b: Book) => void;
  title?: string;
  status?: BookStatus;
}) {
  const shelf = useBooks();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<FoundBook[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const req = useRef(0);
  const needle = q.trim();

  const load = async (p: number) => {
    const n = ++req.current;
    setBusy(true);
    setError('');
    try {
      const r = await searchBooks(needle, p);
      if (n !== req.current) return;
      setFound((f) => (p === 1 ? r.items : [...f, ...r.items]));
      setMore(r.more);
      setPage(p);
    } catch (e) {
      if (n === req.current) setError((e as Error).message);
    }
    if (n === req.current) setBusy(false);
  };

  useEffect(() => {
    req.current++;
    setFound([]);
    setMore(false);
    setError('');
    setBusy(false);
    if (needle.length < 2) return;
    const t = setTimeout(() => load(1), 400);
    return () => clearTimeout(t);
  }, [needle]);

  const words = needle.toLowerCase().split(/\s+/).filter(Boolean);
  const mine = useMemo(
    () => shelf
      .filter((b) => words.every((w) => `${b.title} ${b.authors}`.toLowerCase().includes(w)))
      .sort((a, b) => b.updated - a.updated)
      .slice(0, words.length ? 20 : 8),
    [shelf, needle],
  );

  const close = () => {
    setQ('');
    onClose();
  };
  const pick = (b: Book) => {
    setQ('');
    onPick(b);
  };
  const pickFound = async (f: FoundBook) => {
    const have = getBooks().find((b) => sameWork(b, f));
    pick(have ?? (await saveBook(blankBook({ ...f, status, started: status === 'reading' ? todayKey() : null }))));
  };
  const byHand = async () => pick(await saveBook(blankBook({ title: needle.slice(0, 300), status, started: status === 'reading' ? todayKey() : null })));

  return (
    <Sheet open={open} onClose={close} title={title} tall>
      <label class="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Title, author or ISBN" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Find a book" />
      </label>
      {mine.length > 0 && (
        <>
          <div class="section-label book-sheet-label">{words.length ? 'On your shelf' : 'Recent on your shelf'}</div>
          <div class="book-rows">{mine.map((b) => <BookRow b={b} onClick={() => pick(b)} />)}</div>
        </>
      )}
      {needle.length >= 2 && (
        <>
          <div class="section-label book-sheet-label">From Open Library</div>
          <div class="book-rows">
            {found.map((f) => {
              const have = shelf.find((b) => sameWork(b, f));
              return (
                <button class="book-row" onClick={() => pickFound(f)}>
                  <BookCover b={f} width={40} />
                  <span class="book-row-main">
                    <span class="book-row-title">{f.title}</span>
                    <span class="book-row-sub">{[byline(f), f.pages ? `${f.pages} pages` : ''].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span class="track-end">{have ? <span class="muted small">{STATUS_LABEL[have.status]}</span> : <Icon name="plus" size={18} />}</span>
                </button>
              );
            })}
          </div>
          {busy && <p class="hint center">Searching…</p>}
          {error && <p class="error">{error}</p>}
          {!busy && more && <button class="btn btn-quiet block" onClick={() => load(page + 1)}>More results</button>}
          {!busy && !error && !found.length && <p class="hint center">Open Library has nothing called that.</p>}
          <button class="btn btn-quiet block" onClick={byHand}><Icon name="pencil" size={18} /> Add “{needle}” by hand</button>
        </>
      )}
      {needle.length < 2 && !mine.length && <p class="hint center">Search millions of books from Open Library.</p>}
      <p class="attribution"><Icon name="books" size={14} /> Book data and covers from Open Library</p>
    </Sheet>
  );
}
