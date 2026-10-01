// Tags in a note, shown: a chip for each person, book or piece of music, which opens a little card about it. And,
// while writing, the strip of suggestions an @ brings up, and the burst of colour a new tag lands with.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { coreOf } from '../data/emotions';
import { byline, progressOf, resolveMention, STATUS_LABEL } from '../lib/books';
import { resolvePerson, resolveSong, songsIn, type MentionKind, type Suggestion } from '../lib/mentions';
import { navigate } from '../lib/router';
import { observable, useBooks, useEntries, usePeople, useSongs, type Person } from '../lib/store';
import { BookCover, Stars } from './books';
import { EmotionChip } from './emotion';
import { Icon } from './icons';
import { MiniMusic, MusicEmbed, MusicThing, musicSub } from './music';
import { Avatar } from './people';
import '../styles/mentions.css';

const tint = (emotions: string[]) => (emotions[0] ? `var(--emo-${coreOf(emotions[0]).id})` : undefined);

/* ---------- the card a tag opens ---------- */

interface Target { kind: MentionKind; id: string; x: number; top: number; bottom: number }
const peek$ = observable<Target | null>(null);

export function openPeek(kind: MentionKind, id: string, el: Element) {
  const r = el.getBoundingClientRect();
  const now = peek$.get();
  peek$.set(now && now.kind === kind && now.id === id ? null : { kind, id, x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
}
export const closePeek = () => void (peek$.get() && peek$.set(null));

function Chip({ kind, id, c, children }: { kind: MentionKind; id: string; c?: string; children: ComponentChildren }) {
  return (
    <button
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

export function BookMention({ target, text }: { target?: string; text: string }) {
  const b = resolveMention(target, text, useBooks());
  if (!b) return <span class="md-wiki">{text}</span>;
  return <Chip kind="book" id={b.id} c={tint(b.emotions)}><BookCover b={b} width={13} /><span>{text}</span></Chip>;
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
  const [above, setAbove] = useState(false);

  useEffect(() => setPlaying(false), [t?.kind, t?.id]);
  useEffect(() => {
    if (!t) return;
    const away = (e: PointerEvent) => !(e.target as Element).closest?.('.peek, .mention') && closePeek();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && closePeek();
    const scroll = (e: Event) => !(e.target instanceof Element && e.target.closest('.peek')) && closePeek();
    addEventListener('pointerdown', away, true);
    addEventListener('keydown', key);
    addEventListener('scroll', scroll, { capture: true, passive: true });
    addEventListener('hashchange', closePeek);
    return () => {
      removeEventListener('pointerdown', away, true);
      removeEventListener('keydown', key);
      removeEventListener('scroll', scroll, { capture: true });
      removeEventListener('hashchange', closePeek);
    };
  }, [t]);
  // below the tag, unless it won't fit there and fits better above
  useLayoutEffect(() => {
    if (!t || !ref.current) return;
    const h = ref.current.offsetHeight;
    setAbove(t.bottom + 12 + h > innerHeight - 12 && t.top - 12 - h > 12);
  }, [t, playing]);

  if (!t) return null;
  const W = Math.min(320, innerWidth - 24);
  const left = Math.min(Math.max(12, t.x - W / 2), innerWidth - W - 12);
  const place = above ? { bottom: `${innerHeight - t.top + 10}px` } : { top: `${t.bottom + 10}px` };
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
      style={{ left: `${left}px`, width: `${W}px`, ...place, '--tail': `${t.x - left}px`, ...(c ? { '--c': c } : {}) }}
    >
      {body}
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

/** The strip that takes the toolbar's place while an @ is being typed. Arrow keys move through it, Enter picks. */
export function MentionStrip({ items, active, q, canAdd, onPick, onAdd }: {
  items: Suggestion[];
  active: number;
  q: string;
  canAdd: boolean;
  onPick: (s: Suggestion) => void;
  onAdd: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, items]);
  const keep = { onPointerDown: (e: Event) => e.preventDefault(), onMouseDown: (e: Event) => e.preventDefault() };
  return (
    <div ref={ref} class="mention-strip" role="listbox" aria-label="Tag someone, a book or music">
      <span class="mention-at" aria-hidden="true">@</span>
      {items.map((s, i) => {
        const [label, sub, thumb, c] =
          s.kind === 'person' ? [s.item.name || 'Unnamed', s.item.relation || 'Person', <Avatar p={s.item} size={26} />, tint(s.item.emotions)]
          : s.kind === 'book' ? [s.item.title.trim() || 'Untitled', s.item.authors || 'Book', <BookCover b={s.item} width={19} />, tint(s.item.emotions)]
          : [s.item.music.title, s.item.music.sub ?? 'Music', <MiniMusic m={s.item.music} />, tint(s.item.emotions)];
        return (
          <button role="option" aria-selected={i === active} class={`mention-pick is-${s.kind}`} style={{ '--k': i, ...(c ? { '--c': c } : {}) }} onClick={() => onPick(s)} {...keep}>
            <span class="mention-thumb">{thumb}</span>
            <span class="mention-text"><b>{label}</b><small>{sub}</small></span>
          </button>
        );
      })}
      {canAdd && (
        <button role="option" aria-selected={active === items.length} class="mention-pick is-new" style={{ '--k': items.length }} onClick={onAdd} {...keep}>
          <span class="mention-thumb"><Icon name="user-plus" size={16} /></span>
          <span class="mention-text"><b>{q.trim()}</b><small>New person</small></span>
        </button>
      )}
      {!items.length && !canAdd && <span class="mention-empty">Type a name, a book or a song</span>}
    </div>
  );
}

/** A little burst of colour where a new tag lands. */
export function burst(rect: DOMRect, color = 'var(--ink)') {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !rect.width) return;
  const el = document.createElement('span');
  el.className = 'mention-burst';
  el.style.cssText = `left:${rect.left + rect.width / 2}px;top:${rect.top + rect.height / 2}px;--c:${color};--w:${rect.width}px;--h:${rect.height}px`;
  for (let i = 0; i < 10; i++) {
    const dot = document.createElement('i');
    dot.style.setProperty('--a', `${i * 36 + Math.random() * 20}deg`);
    dot.style.setProperty('--d', `${18 + Math.random() * 16}px`);
    el.append(dot);
  }
  document.body.append(el);
  setTimeout(() => el.remove(), 900);
}
