import { memo } from 'preact/compat';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { navigate } from '../lib/router';
import { monthLabel } from '../lib/dates';
import { blankSong, findSong, getSongs, saveSong, toast, useEntries, useReady, useSongs, type Music, type Song } from '../lib/store';
import { Stars } from '../components/books';
import { GhostRows, letterOf, MediaHead, More, Rail, Runs, runsOf, showList, SortChip, type Sort } from '../components/collection';
import { Icon } from '../components/icons';
import { Mark } from '../components/Mark';
import { usePref } from '../lib/prefs';
import { usePaged } from '../lib/inView';
import { isTape, MusicThing, musicSub } from '../components/music';
import { MostPickedSheet, SongOfDay, usePicked, type DayPick } from '../components/SongOfDay';
import { Sheet } from '../components/Sheet';
import { count as countOf, t } from '../lib/i18n';

type Kind = 'all' | 'repeat' | 'track' | 'album' | 'playlist' | 'podcast';

const KINDS: [Kind, string][] = [['track', t('Songs')], ['album', t('Albums')], ['playlist', t('Playlists')], ['podcast', t('Podcasts')]];
const kindOf = (m: Music): Kind => (m.kind === 'show' || m.kind === 'episode' ? 'podcast' : m.kind === 'artist' ? 'album' : m.kind);

/** How many rows of the collection are drawn at first; scrolling near the end draws this many more. */
const PAGE = 60;
/** How many records a rail holds before "See all". */
const RAIL = 12;
/** How many of the music in your notes the sheet lists. */
const WAITING = 60;
const keyOf = (m: Pick<Music, 'kind' | 'id'>) => m.kind + ':' + m.id;

/** The heading a record files under: the month it joined (newest first), its first letter, or its stars. */
const labelFor = (sort: Sort) => (s: Song) => {
  if (sort === 'title') return letterOf(s.music.title);
  if (sort === 'rating') return s.rating ? countOf(s.rating, 'star', 'stars') : t('Not rated');
  const d = new Date(s.created);
  return monthLabel(d.getFullYear(), d.getMonth());
};

/**
 * The Media page's music. First what's on now: today's song, what's on repeat, what you pick most and what's waiting in
 * your notes, each a row you swipe through (in a column at the right on a wide screen). Then the whole collection as a
 * list, in runs by the month it joined, its letter or its stars.
 */
export function MusicTab({ q, onAdd, picker }: { q: string; onAdd: () => void; picker: DayPick }) {
  const songs = useSongs();
  const entries = useEntries();
  const ready = useReady();
  const [chosen, setKind] = usePref<Kind>('music-kind', 'all', ['all', 'repeat', ...KINDS.map(([k]) => k)]);
  const [sort, setSort] = usePref<Sort>('music-sort', 'recent', ['recent', 'title', 'rating']);
  const [notesOpen, setNotesOpen] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const keeping = useRef(new Set<string>());
  const list = useRef<HTMLElement>(null);
  const picked = usePicked(songs);

  // what search looks through, lowercased once per change to the records rather than on every key
  const hay = useMemo(() => new Map(songs.map((s) => [s, `${s.music.title} ${s.music.sub ?? ''}`.toLowerCase()])), [songs]);
  const counts = useMemo(() => {
    const out = new Map<Kind, number>();
    const add = (k: Kind) => out.set(k, (out.get(k) ?? 0) + 1);
    for (const s of songs) {
      add(kindOf(s.music));
      if (s.repeat) add('repeat');
    }
    return out;
  }, [songs]);
  const count = (k: Kind) => counts.get(k) ?? 0;

  // a kind that has emptied since you picked it shows everything again
  const kind = chosen !== 'all' && !count(chosen) ? 'all' : chosen;
  // a kind is worth a chip when it would show something other than everything
  const chips = ([['repeat', t('On repeat')], ...KINDS] as [Kind, string][]).filter(([k]) => k === kind || (count(k) > 0 && count(k) < songs.length));

  const query = q.trim().toLowerCase();
  const shown = useMemo(() => {
    const words = query.split(/\s+/).filter(Boolean);
    const list = songs.filter((s) => (kind === 'all' || (kind === 'repeat' ? s.repeat : kindOf(s.music) === kind)) && (!words.length || words.every((w) => hay.get(s)!.includes(w))));
    if (sort === 'title') list.sort((a, b) => a.music.title.localeCompare(b.music.title, undefined, { sensitivity: 'base' }));
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating || b.created - a.created);
    return list;
  }, [songs, hay, kind, sort, query]);

  const repeat = useMemo(() => songs.filter((s) => s.repeat), [songs]);

  // Music attached to notes that isn't kept yet, newest first, each once.
  const waiting = useMemo(() => {
    const seen = new Set(songs.map((s) => keyOf(s.music)));
    const out: Music[] = [];
    for (const e of entries) {
      for (const m of e.music) {
        const key = keyOf(m);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(m);
      }
    }
    return out;
  }, [entries, songs]);
  useEffect(() => { if (!waiting.length) setNotesOpen(false); }, [waiting.length]);

  // Only the first rows are drawn; the rest come in as you scroll toward them, so a big collection opens quickly.
  const paged = usePaged(shown.length, PAGE, `${kind}|${sort}|${query}`);
  const runs = useMemo(() => runsOf(shown.slice(0, paged.n), labelFor(sort)), [shown, paged.n, sort]);

  const keep = async (m: Music) => {
    const key = keyOf(m);
    if (keeping.current.has(key)) return;
    keeping.current.add(key);
    try {
      if (!findSong(getSongs(), m)) await saveSong(blankSong(m));
      toast(t('{title} is in your records', { title: m.title }));
    } catch {
      toast(t('Couldn’t save this music. Try again.'));
    } finally {
      keeping.current.delete(key);
    }
  };

  const seeAll = (k: Kind) => {
    setKind(k);
    showList(list.current);
  };

  const now = songs.length > 0 && !query;
  return (
    <div class={`mx${now ? ' has-now' : ''}`}>
      {now && (
        <div class="mx-now">
          <SongOfDay songs={songs} picker={picker} />

          {repeat.length > 0 && (
            <Rail title={t('On repeat')} icon="repeat" count={repeat.length} action={repeat.length > RAIL && <More onClick={() => seeAll('repeat')} />}>
              {repeat.slice(0, RAIL).map((s) => <RecordItem key={s.id} s={s} />)}
            </Rail>
          )}

          {picked.ranked.length > 0 && (
            <Rail title={t('Most picked')} icon="crown" action={<More onClick={() => setRankOpen(true)} label={t('Ranking')} />}>
              {picked.ranked.slice(0, RAIL).map((s, i) => <RecordItem key={s.id} s={s} place={i + 1} />)}
            </Rail>
          )}

          {waiting.length > 0 && (
            <Rail title={t('In your notes')} icon="notebook" count={waiting.length} action={waiting.length > RAIL && <More onClick={() => setNotesOpen(true)} />}>
              {waiting.slice(0, RAIL).map((m) => (
                <button key={keyOf(m)} role="listitem" class="mx-item" onClick={() => keep(m)} aria-label={`${t('Keep')}: ${m.title}`} title={t('Music you added to notes. Keep it to rate it and say what it means to you.')}>
                  <span class="mx-art"><MusicThing m={m} size={84} /><span class="mini-keep mx-keep" aria-hidden="true"><Icon name="plus" size={16} stroke={2} /></span></span>
                  <span class="mx-title">{m.title}</span>
                  <span class="mx-sub">{musicSub(m)}</span>
                </button>
              ))}
            </Rail>
          )}
        </div>
      )}

      <section class="mx-list" ref={list}>
        {songs.length > 0 && (
          <>
            <MediaHead title={query ? t('Found') : t('All music')} count={shown.length}>
              <SortChip sort={sort} onSort={setSort} />
            </MediaHead>
            {chips.length > 0 && (
              <div class="chips scroll-x mx-chips" role="toolbar" aria-label={t('Kind and order')}>
                <button class="chip" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>{t('All')} {songs.length}</button>
                {chips.map(([k, name]) => (
                  <button class="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                    {k === 'repeat' && <Icon name="repeat" size={16} stroke={2} />}
                    {name} {count(k)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {!ready && !songs.length && <GhostRows />}

        {ready && !songs.length && (
          <div class="empty">
            <Mark id="spot:records" hue="love-connection" size={96} />
            <p>{t('No records yet')}</p>
            <button class="btn btn-quiet" onClick={onAdd}><Icon name="plus" size={18} /> {t('Add music')}</button>
          </div>
        )}
        {!!songs.length && !shown.length && <p class="empty-note center">{t('No music matches.')}</p>}

        {shown.length > 0 && <Runs runs={runs} row={(s: Song) => <SongLine key={s.id} s={s} />} />}
        {paged.more && <div ref={paged.ref} class="feed-more" aria-hidden="true" />}
      </section>

      <MostPickedSheet stats={picked} open={rankOpen} onClose={() => setRankOpen(false)} />
      <Sheet open={notesOpen} onClose={() => setNotesOpen(false)} title={<span class="row gap-s"><Icon name="notebook" /> {t('In your notes')}</span>} label={t('In your notes')} tall>
        <p class="hint">{t('Music you added to notes. Keep it to rate it and say what it means to you.')}</p>
        <div class="tracks">
          {waiting.slice(0, WAITING).map((m) => (
            <div key={keyOf(m)} class="track">
              <span class="track-thing"><MusicThing m={m} size={38} /></span>
              <span class="track-main">
                <span class="track-title">{m.title}</span>
                <span class="track-sub">{musicSub(m)}</span>
              </span>
              <button class="mini-keep" onClick={() => keep(m)} aria-label={`${t('Keep')}: ${m.title}`} title={t('Keep')}><Icon name="plus" size={16} stroke={2} /></button>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/** A record or tape in a rail: big enough to see its cover, its name and who it's by (or, ranked, its place and days). */
function RecordItem({ s, place }: { s: Song; place?: number }) {
  const days = s.days.length;
  return (
    <button
      role="listitem"
      class="mx-item"
      onClick={() => navigate('song/' + s.id)}
      aria-label={[place && `${place}.`, s.music.title, musicSub(s.music), place && countOf(days, 'day', 'days')].filter(Boolean).join(', ')}
    >
      <span class="mx-art">
        <MusicThing m={s.music} size={84} />
        {place && <span class={`sotd-place mx-place${place < 4 ? ' p' + place : ''}`} aria-hidden="true">{place === 1 ? <Icon name="crown" size={12} stroke={2} /> : place}</span>}
      </span>
      <span class="mx-title">{s.music.title}</span>
      <span class="mx-sub">{place ? countOf(days, 'day', 'days') : musicSub(s.music)}</span>
    </button>
  );
}

type LineProps = { s: Song };
/** Every save reads the records back as new objects, so a row is the same while its record's id and last change are. */
const sameLine = (a: LineProps, b: LineProps) => a.s.id === b.s.id && a.s.updated === b.s.updated;

/** A record in the collection: the disc or tape, its name, who it's by, and at the end its stars (and whether it's on repeat). */
const SongLine = memo(function SongLine({ s }: LineProps) {
  return (
    <button
      class={`book-row mx-row${isTape(s.music) ? ' is-tape' : ''}`}
      onClick={() => navigate('song/' + s.id)}
      aria-label={`${s.music.title}, ${musicSub(s.music)}${s.repeat ? ', ' + t('On repeat') : ''}${s.rating ? ', ' + t('{n} of 5 stars', { n: s.rating }) : ''}`}
    >
      <span class="mx-row-art"><MusicThing m={s.music} size={40} /></span>
      <span class="book-row-main">
        <span class="book-row-title">{s.music.title}</span>
        <span class="book-row-sub">{musicSub(s.music)}</span>
      </span>
      <span class="mx-row-end" aria-hidden="true">
        {s.repeat && <span class="mx-repeat"><Icon name="repeat" size={14} stroke={2} /></span>}
        {s.rating > 0 && <Stars value={s.rating} size={12} />}
      </span>
    </button>
  );
}, sameLine);

/** The line under the records' title: records, tapes, and the average rating. */
export function musicSummary(songs: Song[]): string {
  const tapes = songs.filter((s) => isTape(s.music)).length;
  const records = songs.length - tapes;
  const rated = songs.filter((s) => s.rating);
  return [
    records ? countOf(records, 'record', 'records') : '',
    tapes ? countOf(tapes, 'tape', 'tapes') : '',
    rated.length ? t('{n} ★ average', { n: (rated.reduce((n, s) => n + s.rating, 0) / rated.length).toFixed(1) }) : '',
  ].filter(Boolean).join(' · ');
}
