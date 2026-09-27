import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EMOTION, coreOf, shortName } from '../data/emotions';
import { mentionsByBook, renameMentions, STATUS_LABEL } from '../lib/books';
import { dayLabel, todayKey } from '../lib/dates';
import { goBack, navigate } from '../lib/router';
import { BOOK_STATUSES, MAX_PERSON_EMOTIONS, deleteBook, getBooks, getEntries, saveBook, saveEntry, toast, useBooks, useEntries, type Book, type BookStatus, type Entry } from '../lib/store';
import { BookCover, Stars } from '../components/books';
import { EmotionChip, EmotionPicker } from '../components/emotion';
import { Icon } from '../components/icons';
import { PeopleSheet, PersonChip, usePeopleById } from '../components/people';
import { Sheet } from '../components/Sheet';
import { CheckInRow, NoteCard } from './Journal';
import { progressOf } from './Books';

type Open = null | 'emotion' | 'from';

function useAutosize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return ref;
}

const num = (v: string, max: number) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : null;
};

export function BookView({ id }: { id: string }) {
  const [draft, setDraft] = useState<Book | null>(() => getBooks().find((b) => b.id === id) ?? null);
  const [open, setOpen] = useState<Open>(null);
  const [status, setStatus] = useState('');
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(draft);
  latest.current = draft;
  const titleRef = useAutosize(draft?.title ?? '');
  const textRef = useAutosize(draft?.text ?? '');
  const entries = useEntries();
  const byId = usePeopleById();
  const shelf = useBooks();
  const notes = useMemo(() => mentionsByBook(entries, shelf).get(id) ?? [], [entries, shelf, id]);

  const flush = () => {
    clearTimeout(timer.current);
    const d = latest.current;
    if (!d || !dirty.current) return;
    dirty.current = false;
    saveBook(d);
    setStatus('Saved');
  };

  const update = (patch: Partial<Book>) => {
    if (!latest.current) return;
    latest.current = { ...latest.current, ...patch };
    setDraft(latest.current);
    dirty.current = true;
    setStatus('');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };

  // Renamed? Once you leave, the notes mentioning it by its old title are updated to the new one.
  const shelfBefore = useRef(getBooks());
  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      flush();
      const d = latest.current;
      const was = shelfBefore.current.find((b) => b.id === id);
      if (d && was && was.title.trim() !== d.title.trim() && d.title.trim())
        renameMentions(getEntries(), shelfBefore.current, d).forEach((e) => saveEntry(e));
    };
  }, []);

  // How the notes about it felt: the worlds of every feeling in the notes that mention it.
  const felt = useMemo(() => {
    const worlds = new Map<string, number>();
    for (const e of notes) for (const eid of e.emotions) worlds.set(coreOf(eid).id, (worlds.get(coreOf(eid).id) ?? 0) + 1);
    return { total: [...worlds.values()].reduce((a, b) => a + b, 0), worlds: [...worlds].sort((a, b) => b[1] - a[1]) };
  }, [notes]);

  const groups = useMemo(() => {
    const out: [string, Entry[]][] = [];
    for (const e of notes) {
      const last = out[out.length - 1];
      if (last && last[0] === e.date) last[1].push(e);
      else out.push([e.date, [e]]);
    }
    return out;
  }, [notes]);

  if (!draft)
    return (
      <div class="page">
        <div class="empty">
          <h2 class="title-s">This book isn’t on your shelf</h2>
          <p>It may have been deleted.</p>
          <button class="btn btn-primary" onClick={() => goBack('books')}>Back to books</button>
        </div>
      </div>
    );

  const remove = async () => {
    if (!confirm(`Remove “${draft.title.trim() || 'this book'}” from your shelf? Notes that mention it keep its title.`)) return;
    clearTimeout(timer.current);
    dirty.current = false;
    const removed = await deleteBook(draft.id);
    goBack('books');
    if (removed) toast('Book removed', { label: 'Undo', run: () => saveBook(removed) });
  };

  /** Moving between shelves fills in the dates you'd otherwise have to: started when you begin, finished when you're done. */
  const setShelf = (s: BookStatus) => {
    if (s === draft.status) return;
    const today = todayKey();
    const patch: Partial<Book> = { status: s };
    if (s === 'reading' && !draft.started) patch.started = today;
    if (s === 'reading') patch.finished = null;
    if ((s === 'read' || s === 'dnf') && !draft.finished) patch.finished = today;
    if (s === 'read' && draft.pages) patch.page = draft.pages;
    if (s === 'want') Object.assign(patch, { started: null, finished: null, page: null });
    update(patch);
    if (s === 'read') toast(`Finished ${draft.title.trim() || 'it'}!`, { label: 'Write about it', run: () => write() });
  };

  const addEmotion = (eid: string) => {
    const list = draft.emotions.filter((x) => x !== eid && !eid.startsWith(x + '/') && !x.startsWith(eid + '/'));
    update({ emotions: [...list, eid].slice(-MAX_PERSON_EMOTIONS) });
    setOpen(null);
  };

  /** Starts a note that already mentions the book. */
  const write = () => {
    flush();
    navigate(`note/new?book=${draft.id}`);
  };

  const from = draft.from ? byId.get(draft.from) : undefined;
  const pct = progressOf(draft);
  const main = draft.emotions[0] ? coreOf(draft.emotions[0]).id : null;

  return (
    <div class="page editor book-page">
      <div class="editor-bar">
        <button class="glass glass-btn round" onClick={() => { flush(); goBack('books'); }} aria-label="Back"><Icon name="arrow-left" /></button>
        <span class="editor-status" aria-live="polite">{status && <span class="glass">{status}</span>}</span>
        <button class="glass glass-btn round" onClick={remove} aria-label="Remove book"><Icon name="trash" /></button>
        <button class="glass glass-btn tinted" onClick={() => { flush(); goBack('books'); }}>Done</button>
      </div>

      <div class="book-head" style={{ '--c': main ? `var(--emo-${main})` : undefined }}>
        <BookCover b={draft} width={104} />
        <div class="grow">
          <textarea
            ref={titleRef}
            class="title-input"
            rows={1}
            placeholder="Title"
            value={draft.title}
            maxLength={300}
            onInput={(e) => update({ title: e.currentTarget.value.replace(/\n/g, ' ') })}
            aria-label="Title"
          />
          <input class="relation-input" placeholder="Author" value={draft.authors} maxLength={300} onInput={(e) => update({ authors: e.currentTarget.value })} aria-label="Author" />
          <div class="muted small book-facts">
            {[draft.year, draft.pages ? `${draft.pages} pages` : ''].filter(Boolean).join(' · ')}
            {draft.olid && <> · <a href={`https://openlibrary.org${draft.olid}`} target="_blank" rel="noopener noreferrer">Open Library</a></>}
          </div>
          <Stars value={draft.rating} onChange={(rating) => update({ rating })} size={24} />
        </div>
      </div>

      <div class="seg book-status" role="radiogroup" aria-label="Shelf">
        {BOOK_STATUSES.map((s) => (
          <button role="radio" aria-checked={draft.status === s} aria-selected={draft.status === s} onClick={() => setShelf(s)}>{STATUS_LABEL[s]}</button>
        ))}
      </div>

      {draft.status !== 'want' && (
        <div class="card list book-dates">
          <label class="list-row">
            <span>Started</span>
            <input class="input input-s" type="date" value={draft.started ?? ''} max={todayKey()} onInput={(e) => update({ started: e.currentTarget.value || null })} />
          </label>
          {draft.status !== 'reading' && (
            <label class="list-row">
              <span>{draft.status === 'dnf' ? 'Stopped' : 'Finished'}</span>
              <input class="input input-s" type="date" value={draft.finished ?? ''} min={draft.started ?? undefined} max={todayKey()} onInput={(e) => update({ finished: e.currentTarget.value || null })} />
            </label>
          )}
          {draft.status === 'reading' && (
            <div class="list-row book-progress">
              <span>Page</span>
              <span class="row gap-s">
                <input class="input input-s page-input" type="number" inputMode="numeric" min={0} value={draft.page ?? ''} onInput={(e) => update({ page: num(e.currentTarget.value, 100_000) })} aria-label="Current page" />
                <span class="muted">of</span>
                <input class="input input-s page-input" type="number" inputMode="numeric" min={1} value={draft.pages ?? ''} onInput={(e) => update({ pages: num(e.currentTarget.value, 100_000) })} aria-label="Pages" />
              </span>
            </div>
          )}
          {draft.status === 'reading' && pct !== null && (
            <div class="progress big" role="img" aria-label={`${pct}% read`}><i style={{ width: pct + '%' }} /></div>
          )}
        </div>
      )}

      <div class="eyebrow person-label">How it made you feel</div>
      <div class="meta person-meta">
        {draft.emotions.map((eid) => <EmotionChip id={eid} onRemove={() => update({ emotions: draft.emotions.filter((x) => x !== eid) })} />)}
        {draft.emotions.length < MAX_PERSON_EMOTIONS && (
          <button class="chip" onClick={() => setOpen('emotion')}>
            <Icon name="mood-plus" size={16} /> {draft.emotions.length ? 'Add' : 'Add a feeling'}
          </button>
        )}
      </div>
      {draft.emotions.length === 1 && EMOTION[draft.emotions[0]]?.depth === 2 && <p class="definition">{EMOTION[draft.emotions[0]].def}</p>}

      <div class="eyebrow person-label">Thinking of</div>
      <div class="meta person-meta">
        {from ? (
          <PersonChip p={from} onRemove={() => update({ from: null })} />
        ) : (
          <button class="chip" onClick={() => setOpen('from')}><Icon name="user-plus" size={16} /> Add someone</button>
        )}
      </div>

      <textarea
        ref={textRef}
        class="body-input person-text"
        rows={3}
        placeholder="Your thoughts: what stayed with you, favourite lines, what you’d tell a friend…"
        value={draft.text}
        onInput={(e) => update({ text: e.currentTarget.value })}
        aria-label="Your thoughts"
      />

      <section class="section">
        <div class="row between">
          <h2 class="section-title">In your journal</h2>
          {notes.length > 0 && <span class="muted small">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>}
        </div>
        <div class="row gap-s person-actions">
          <button class="btn btn-quiet grow" onClick={write}><Icon name="pencil" size={18} /> Write about it</button>
        </div>
        {felt.total > 0 && (
          <div class="card person-felt">
            <div class="chart-title">How your notes about it felt</div>
            <div class="split-bar" role="img" aria-label={felt.worlds.map(([c, n]) => `${shortName(c)} ${Math.round((n / felt.total) * 100)}%`).join(', ')}>
              {felt.worlds.map(([c, n]) => <i style={{ flex: n, background: `var(--emo-${c})` }} title={`${shortName(c)} · ${n}`} />)}
            </div>
          </div>
        )}
        {groups.length ? (
          groups.map(([date, list]) => (
            <section class="day">
              <h3 class="day-label">{dayLabel(date)}</h3>
              <div class="entries">{list.map((e) => (e.kind === 'checkin' ? <CheckInRow e={e} /> : <NoteCard e={e} />))}</div>
            </section>
          ))
        ) : (
          <p class="empty-note">Mention this book in a note (the <Icon name="books" size={14} /> button while writing) and the note shows up here — a reading journal as you go.</p>
        )}
      </section>

      <Sheet open={open === 'emotion'} onClose={() => setOpen(null)} title="How did it make you feel?">
        <EmotionPicker onPick={addEmotion} selected={draft.emotions} />
      </Sheet>
      <PeopleSheet
        open={open === 'from'}
        onClose={() => setOpen(null)}
        selected={draft.from ? [draft.from] : []}
        onChange={(ids) => { update({ from: ids.find((x) => x !== draft.from) ?? null }); setOpen(null); }}
      />
    </div>
  );
}
