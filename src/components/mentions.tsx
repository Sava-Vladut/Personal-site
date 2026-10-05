// Tags in a note, shown: a chip for each person, book, piece of music or linked note, which opens a little card about it. And,
// while writing, the strip of suggestions an @ brings up, and the burst of colour a new tag lands with.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { coreOf } from '../data/emotions';
import { byline, progressOf, resolveMention, STATUS_LABEL } from '../lib/books';
import { plainText } from '../lib/body';
import { rangeLabel } from '../lib/dates';
import { noteLabel, resolveNote, type LinkSuggestion } from '../lib/links';
import { previewOf } from '../lib/markdown';
import { resolvePerson, resolveSong, songsIn, type MentionKind, type Suggestion } from '../lib/mentions';
import { navigate } from '../lib/router';
import { observable, useBooks, useEntries, usePeople, useSongs, type Person } from '../lib/store';
import { BookCover, Stars } from './books';
import { EmotionChip } from './emotion';
import { Icon, NoteIcon } from './icons';
import { MiniMusic, MusicEmbed, MusicThing, musicSub } from './music';
import { Avatar } from './people';
import '../styles/mentions.css';

const tint = (emotions: string[]) => (emotions[0] ? `var(--emo-${coreOf(emotions[0]).id})` : undefined);

/* ---------- the card a tag opens ---------- */

interface Target { kind: MentionKind; id: string; x: number; top: number; bottom: number }
const peek$ = observable<Target | null>(null);
const visibleViewport = () => {
  const v = window.visualViewport;
  return { left: v?.offsetLeft ?? 0, top: v?.offsetTop ?? 0, width: v?.width ?? innerWidth, height: v?.height ?? innerHeight };
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export function openPeek(kind: MentionKind, id: string, el: Element) {
  const r = el.getBoundingClientRect();
  const now = peek$.get();
  peek$.set(now && now.kind === kind && now.id === id ? null : { kind, id, x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
}
export const closePeek = () => void (peek$.get() && peek$.set(null));

function Chip({ kind, id, c, children }: { kind: MentionKind; id: string; c?: string; children: ComponentChildren }) {
  return (
    <button
      type="button"
      class={`mention is-${kind}`}
      style={c ? { '--c': c } : undefined}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPeek(kind, id, e.currentTarget); }}
      aria-haspopup="dialog"
    >
      {children}
    </button>
  );
}

export function PersonMention({ target, text }: { target?: string; text: string }) {
  const p = resolvePerson(target, text, usePeople());
  if (!p) return <span class="mention is-missing">@{text}</span>;
  return <Chip kind="person" id={p.id} c={tint(p.emotions)}><Avatar p={p} size={18} /><span>{p.name || text}</span></Chip>;
}

/** A [[wiki link]]: a book on the shelf, or another note. */
export function WikiLink({ target, text }: { target?: string; text: string }) {
  const books = useBooks();
  const entries = useEntries();
  const isNote = !!target?.startsWith('note:');
  const b = isNote ? undefined : resolveMention(target, text, books);
  if (b) return <Chip kind="book" id={b.id} c={tint(b.emotions)}><BookCover b={b} width={13} /><span>{text}</span></Chip>;
  const n = resolveNote(target, text, entries, books);
  if (n) return <Chip kind="note" id={n.id} c={tint(n.emotions)}>{n.icon ? <NoteIcon id={n.icon} size={14} /> : <Icon name="notebook" size={14} />}<span>{noteLabel(n)}</span></Chip>;
  return isNote ? <span class="mention is-missing" title="This note was deleted">{text}</span> : <span class="md-wiki">{text}</span>;
}

export function SongMention({ target, text }: { target?: string; text: string }) {
  const s = resolveSong(target, text, useSongs());
  if (!s) return <span class="mention is-missing">♪ {text}</span>;
  return <Chip kind="song" id={s.id} c={tint(s.emotions)}><MiniMusic m={s.music} /><span>{s.music.title}</span></Chip>;
}

const go = (to: string) => {
  closePeek();
  navigate(to);
};

/** The card itself, floating by the tag that opened it, with a tail pointing back at it. */
export function PeekLayer() {
  const t = peek$.use();
  const people = usePeople();
  const books = useBooks();
  const songs = useSongs();
  const entries = useEntries();
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(visibleViewport);
  const [height, setHeight] = useState(0);

  useEffect(() => setPlaying(false), [t?.kind, t?.id]);
  useEffect(() => {
    if (!t) return;
    const away = (e: PointerEvent) => !(e.target as Element).closest?.('.peek, .mention') && closePeek();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && closePeek();
    const scroll = (e: Event) => !(e.target instanceof Element && e.target.closest('.peek')) && closePeek();
    const resize = () => setViewport(visibleViewport());
    addEventListener('pointerdown', away, true);
    addEventListener('keydown', key);
    addEventListener('scroll', scroll, { capture: true, passive: true });
    addEventListener('hashchange', closePeek);
    addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    resize();
    return () => {
      removeEventListener('pointerdown', away, true);
      removeEventListener('keydown', key);
      removeEventListener('scroll', scroll, { capture: true });
      removeEventListener('hashchange', closePeek);
      removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
    };
  }, [t]);
  useLayoutEffect(() => {
    if (!t || !ref.current) return;
    setHeight(ref.current.offsetHeight);
  }, [t, playing, viewport, people, books, songs, entries]);
  useEffect(() => {
    if (!t || !ref.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => ref.current && setHeight(ref.current.offsetHeight));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [t]);

  if (!t) return null;
  const W = Math.max(0, Math.min(320, viewport.width - 24));
  const left = clamp(t.x - W / 2, viewport.left + 12, viewport.left + viewport.width - W - 12);
  const availableHeight = Math.max(0, viewport.height - 24);
  const h = Math.min(height, availableHeight);
  const above = t.bottom + 10 + h > viewport.top + viewport.height - 12 && t.top - viewport.top > viewport.top + viewport.height - t.bottom;
  const top = clamp(above ? t.top - 10 - h : t.bottom + 10, viewport.top + 12, viewport.top + viewport.height - h - 12);
  let c: string | undefined;
  let body: ComponentChildren = null;

  if (t.kind === 'person') {
    const p = people.find((x) => x.id === t.id);
    if (!p) return null;
    c = tint(p.emotions);
    body = <PersonPeek p={p} moments={entries.filter((e) => e.people.includes(p.id)).length} last={entries.find((e) => e.people.includes(p.id))?.date} />;
  } else if (t.kind === 'book') {
    const b = books.find((x) => x.id === t.id);
    if (!b) return null;
    c = tint(b.emotions);
    const pct = progressOf(b);
    body = (
      <>
        <div class="peek-head">
          <BookCover b={b} width={54} />
          <div class="peek-who">
            <b class="peek-name">{b.title.trim() || 'Untitled'}</b>
            <span class="peek-sub">{byline(b) || STATUS_LABEL[b.status]}</span>
            <span class="peek-sub">{STATUS_LABEL[b.status]}{pct !== null ? ` · ${pct}% read` : ''}</span>
          </div>
        </div>
        {b.status === 'reading' && pct !== null && <span class="progress" role="img" aria-label={`${pct}% read`}><i style={{ width: pct + '%' }} /></span>}
        {b.rating > 0 && <Stars value={b.rating} size={14} />}
        <div class="peek-actions">
          <button class="btn btn-quiet btn-s grow" onClick={() => go('note/new?book=' + b.id)}><Icon name="pencil" size={15} /> Write</button>
          <button class="btn btn-primary btn-s grow" onClick={() => go('book/' + b.id)}>Open <Icon name="arrow-up-right" size={15} /></button>
        </div>
      </>
    );
  } else if (t.kind === 'note') {
    const n = entries.find((x) => x.id === t.id);
    if (!n) return null;
    c = tint(n.emotions);
    const { heading, preview } = previewOf(plainText(n.text), n.title, 160);
    body = (
      <>
        <div class="peek-head">
          <span class="peek-note-icon">{n.icon ? <NoteIcon id={n.icon} size={24} /> : <Icon name="notebook" size={22} />}</span>
          <div class="peek-who">
            <b class="peek-name">{heading || 'Untitled'}</b>
            <span class="peek-sub">{rangeLabel(n.date, n.dateEnd)}</span>
          </div>
        </div>
        {preview && <p class="peek-text">{preview}</p>}
        {n.emotions.length > 0 && <div class="peek-feelings">{n.emotions.slice(0, 3).map((id) => <EmotionChip id={id} size="sm" />)}</div>}
        <div class="peek-actions">
          <button class="btn btn-primary btn-s grow" onClick={() => go('note/' + n.id)}>Open <Icon name="arrow-up-right" size={15} /></button>
        </div>
      </>
    );
  } else {
    const s = songs.find((x) => x.id === t.id);
    if (!s) return null;
    c = tint(s.emotions);
    const notes = entries.filter((e) => e.music.some((m) => m.kind === s.music.kind && m.id === s.music.id) || songsIn(e.text, songs).includes(s.id)).length;
    body = (
      <>
        <div class={`peek-head${playing ? ' is-on' : ' is-repeat'}`}>
          <MusicThing m={s.music} size={58} />
          <div class="peek-who">
            <b class="peek-name">{s.music.title}</b>
            <span class="peek-sub">{musicSub(s.music)}</span>
            <span class="peek-sub">{notes} {notes === 1 ? 'note' : 'notes'}{s.repeat ? ' · on repeat' : ''}</span>
          </div>
        </div>
        {s.rating > 0 && <Stars value={s.rating} size={14} />}
        {playing && <MusicEmbed m={s.music} />}
        <div class="peek-actions">
          <button class="btn btn-quiet btn-s grow" onClick={() => setPlaying(!playing)}><Icon name={playing ? 'player-pause' : 'player-play'} size={15} /> {playing ? 'Stop' : 'Play'}</button>
          <button class="btn btn-primary btn-s grow" onClick={() => go('song/' + s.id)}>Open <Icon name="arrow-up-right" size={15} /></button>
        </div>
      </>
    );
  }

  return (
    <div
      ref={ref}
      class={`peek${above ? ' is-above' : ''}`}
      role="dialog"
      aria-label="About this tag"
      style={{ left: `${left}px`, top: `${top}px`, width: `${W}px`, maxHeight: `${availableHeight}px`, '--peek-height': `${availableHeight}px`, '--tail': `${clamp(t.x - left, 20, W - 20)}px`, ...(c ? { '--c': c } : {}) }}
    >
      <div class="peek-content">{body}</div>
    </div>
  );
}

function PersonPeek({ p, moments, last }: { p: Person; moments: number; last?: string }) {
  return (
    <>
      <div class="peek-head">
        <Avatar p={p} size={48} />
        <div class="peek-who">
          <b class="peek-name">{p.name || 'Unnamed'}</b>
          {p.relation && <span class="peek-sub">{p.relation}</span>}
          <span class="peek-sub">{moments ? `${moments} ${moments === 1 ? 'moment' : 'moments'}${last ? ` · last ${new Date(last + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}` : 'No moments yet'}</span>
        </div>
      </div>
      {p.emotions.length > 0 && <div class="peek-feelings">{p.emotions.slice(0, 3).map((id) => <EmotionChip id={id} size="sm" />)}</div>}
      <div class="peek-actions">
        <button class="btn btn-quiet btn-s grow" onClick={() => go('note/new?person=' + p.id)}><Icon name="pencil" size={15} /> Write</button>
        <button class="btn btn-primary btn-s grow" onClick={() => go('person/' + p.id)}>Open <Icon name="arrow-up-right" size={15} /></button>
      </div>
    </>
  );
}

/* ---------- while writing: what an @ suggests ---------- */

/** The strip that takes the toolbar's place while an @ (or a [[ link) is being typed. Arrow keys move through it, Enter picks. */
export function MentionStrip<S extends Suggestion | LinkSuggestion>({ items, active, q, canAdd, onPick, onAdd, listId = 'mention-suggestions', link }: {
  items: S[];
  active: number;
  q: string;
  canAdd: boolean;
  onPick: (s: S) => void;
  onAdd: () => void;
  listId?: string;
  /** a [[ link to a note (or a book), not an @tag */
  link?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const touch = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const handledTouch = useRef(false);
  const activeKey = active < items.length ? `${items[active]?.kind}:${items[active]?.item.id}` : canAdd ? 'new' : '';
  useLayoutEffect(() => {
    const strip = ref.current;
    const scroller = strip?.closest<HTMLElement>('.format-scroll') ?? strip;
    const selected = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!scroller || !selected) return;
    const bounds = scroller.getBoundingClientRect(), item = selected.getBoundingClientRect();
    // scrollIntoView can move the whole editor behind iOS's keyboard. Move only the strip.
    if (item.left < bounds.left + 8) scroller.scrollLeft += item.left - bounds.left - 8;
    else if (item.right > bounds.right - 24) scroller.scrollLeft += item.right - bounds.right + 24;
  }, [activeKey, q]);
  const pick = (onSelect: () => void) => ({
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault(); // Keep the editor caret and keyboard in place.
      handledTouch.current = false;
      touch.current = e.pointerType !== 'mouse' ? { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false } : null;
    },
    onPointerMove: (e: PointerEvent) => {
      const t = touch.current;
      if (t && t.id === e.pointerId && Math.hypot(e.clientX - t.x, e.clientY - t.y) > 8) t.moved = true;
    },
    onPointerCancel: () => { touch.current = null; },
    onPointerUp: (e: PointerEvent) => {
      const t = touch.current;
      touch.current = null;
      if (!t || t.id !== e.pointerId) return;
      handledTouch.current = true;
      if (!t.moved && Math.hypot(e.clientX - t.x, e.clientY - t.y) <= 8) {
        e.preventDefault();
        onSelect();
      }
    },
    onMouseDown: (e: MouseEvent) => e.preventDefault(),
    onClick: (e: MouseEvent) => {
      if (handledTouch.current && e.detail !== 0) {
        handledTouch.current = false;
        e.preventDefault();
        return;
      }
      onSelect();
    },
  });
  return (
    <div id={listId} ref={ref} class={`mention-strip${link ? ' is-link' : ''}`} role="listbox" aria-label={link ? 'Link a note or a book' : 'Tag someone, a book or music'}>
      <span class="mention-at" aria-hidden="true">{link ? '[[' : '@'}</span>
      {items.map((s: Suggestion | LinkSuggestion, i) => {
        const [label, sub, thumb, c] =
          s.kind === 'person' ? [s.item.name || 'Unnamed', s.item.relation || 'Person', <Avatar p={s.item} size={26} />, tint(s.item.emotions)]
          : s.kind === 'book' ? [s.item.title.trim() || 'Untitled', s.item.authors || 'Book', <BookCover b={s.item} width={19} />, tint(s.item.emotions)]
          : s.kind === 'note' ? [noteLabel(s.item), rangeLabel(s.item.date, s.item.dateEnd), s.item.icon ? <NoteIcon id={s.item.icon} size={20} /> : <Icon name="notebook" size={18} />, tint(s.item.emotions)]
          : [s.item.music.title, s.item.music.sub ?? 'Music', <MiniMusic m={s.item.music} />, tint(s.item.emotions)];
        return (
          <button key={`${s.kind}:${s.item.id}`} id={`${listId}-option-${i}`} type="button" role="option" tabIndex={-1} aria-selected={i === active} class={`mention-pick is-${s.kind}`} style={c ? { '--c': c } : undefined} {...pick(() => onPick(s as S))}>
            <span class="mention-thumb">{thumb}</span>
            <span class="mention-text"><b>{label}</b><small>{sub}</small></span>
          </button>
        );
      })}
      {canAdd && (
        <button key="new" id={`${listId}-option-${items.length}`} type="button" role="option" tabIndex={-1} aria-selected={active === items.length} class="mention-pick is-new" {...pick(onAdd)}>
          <span class="mention-thumb"><Icon name="user-plus" size={16} /></span>
          <span class="mention-text"><b>{q.trim()}</b><small>New person</small></span>
        </button>
      )}
      {!items.length && !canAdd && <span class="mention-empty">{link ? 'No note with that title' : 'Type a name, a book or a song'}</span>}
    </div>
  );
}

/** Keep the burst in the note's coordinate space, including during iOS keyboard panning. */
export function burst(range: Range, host: HTMLElement, color = 'var(--ink)') {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !host.isConnected) return;
  const origin = host.getBoundingClientRect();
  if (![origin.left, origin.top].every(Number.isFinite)) return;
  // A union box can span empty space between wrapped lines. Animate each text
  // fragment, subtracting the host measured in the same frame and coordinate space.
  // Let the browser clip it with the note instead of mixing visual-viewport
  // offsets into these measurements (Safari can report a different origin).
  for (const rect of range.getClientRects()) {
    if (rect.width <= 0 || rect.height <= 0 || ![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) continue;
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const el = document.createElement('span');
    el.className = 'mention-burst';
    el.setAttribute('aria-hidden', 'true');
    const left = x - origin.left - host.clientLeft + host.scrollLeft;
    const top = y - origin.top - host.clientTop + host.scrollTop;
    el.style.cssText = `left:${left}px;top:${top}px;--c:${color};--w:${rect.width}px;--h:${rect.height}px`;
    for (let i = 0; i < 10; i++) {
      const dot = document.createElement('i');
      dot.style.setProperty('--a', `${i * 36 + Math.random() * 20}deg`);
      dot.style.setProperty('--d', `${18 + Math.random() * 16}px`);
      el.append(dot);
    }
    host.append(el);
    setTimeout(() => el.remove(), 900);
  }
}
