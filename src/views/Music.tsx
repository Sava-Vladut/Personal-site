import { memo } from 'preact/compat';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { navigate } from '../lib/router';
import { addedAt, blankPeriod, blankSong, findSong, getSongs, saveSong, toast, useEntries, usePeriods, useReady, useSongs, type Music, type Period, type Song } from '../lib/store';
import { artIn } from '../components/books';
import { GhostRows, MediaHead, More, Rail, showList, SortChip } from '../components/collection';
import { Icon } from '../components/icons';
import { Mark } from '../components/Mark';
import { usePref } from '../lib/prefs';
import { usePaged } from '../lib/inView';
import { usePlaylistSync } from '../lib/playlistSync';
import { isTape, MusicThing, musicSub, smallArt } from '../components/music';
import { addedLabel, duration, MusicWave, PeriodList, PeriodSheet, periodColor, periodName, spanLabel, spanOf } from '../components/periods';
import { SyncLine, SyncSheet } from '../components/PlaylistSync';
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

/** Music's orders: by date added, newest first (as Spotify lists a playlist), by title, or by your stars. */
type MusicSort = 'added' | 'title' | 'rating';
const MUSIC_SORTS: [MusicSort, string][] = [['added', t('Date added')], ['title', t('A–Z')], ['rating', t('Top rated')]];

/**
 * The Media page's music. First what's on now: today's song, what's on repeat, what you pick most and what's waiting in
 * your notes, each a row you swipe through (in a column at the right on a wide screen). Then your music over time as a
 * wave with the periods you named on it, and the whole collection as Spotify lists a playlist: number, title and
 * artists, album, date added and length, kept in step with the synced Spotify playlists.
 * Selecting songs (or dragging across the wave) makes a period: an era you name and give a feeling.
 */
export function MusicTab({ q, onClearSearch, onAdd, picker }: { q: string; onClearSearch: () => void; onAdd: () => void; picker: DayPick }) {
  const songs = useSongs();
  const entries = useEntries();
  const ready = useReady();
  const [chosen, setKind] = usePref<Kind>('music-kind', 'all', ['all', 'repeat', ...KINDS.map(([k]) => k)]);
  const [sort, setSort] = usePref<MusicSort>('music-sort-v3', 'added', MUSIC_SORTS.map(([s]) => s));
  const [notesOpen, setNotesOpen] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const keeping = useRef(new Set<string>());
  const list = useRef<HTMLElement>(null);
  const picked = usePicked(songs);
  const sync = usePlaylistSync(ready);
  const periods = usePeriods();
  // songs picked for a period (null: not picking), the period open in its sheet, and the one whose songs the list shows
  const [sel, setSel] = useState<Set<string> | null>(null);
  const [period, setPeriod] = useState<Period | null>(null);
  const [only, setOnly] = useState<string | null>(null);
  const showing = only ? periods.find((p) => p.id === only) ?? null : null;
  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

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
    const inPeriod = showing ? new Set(showing.songs) : null;
    const list = songs.filter((s) => (kind === 'all' || (kind === 'repeat' ? s.repeat : kindOf(s.music) === kind)) && (!inPeriod || inPeriod.has(s.id)) && (!words.length || words.every((w) => hay.get(s)!.includes(w))));
    if (sort === 'title') list.sort((a, b) => a.music.title.localeCompare(b.music.title, undefined, { sensitivity: 'base' }));
    else if (sort === 'rating') list.sort((a, b) => b.rating - a.rating || addedAt(b) - addedAt(a));
    else list.sort((a, b) => addedAt(b) - addedAt(a));
    return list;
  }, [songs, hay, kind, sort, query, showing]);

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
  const paged = usePaged(shown.length, PAGE, `${kind}|${sort}|${query}|${only}`);

  // Picking songs for a period: a tap picks one, shift picks every row up to the last one picked.
  const last = useRef<number | null>(null);
  const pick = useRef<(s: Song, shift: boolean) => void>(() => {});
  pick.current = (s, shift) => {
    const next = new Set(sel ?? []);
    const at = shown.indexOf(s);
    if (shift && last.current !== null) {
      const [a, b] = [Math.min(at, last.current), Math.max(at, last.current)];
      shown.slice(a, b + 1).forEach((x) => next.add(x.id));
    } else if (next.has(s.id)) next.delete(s.id);
    else next.add(s.id);
    last.current = at;
    setSel(next);
    setStretch(null);
  };
  const onPick = useMemo(() => (s: Song, shift: boolean) => pick.current(s, shift), []);
  // a stretch dragged on the wave: every song that joined in it. It stays as dragged (shown on the wave, kept with the
  // period) until songs are picked or unpicked by hand.
  const [stretch, setStretch] = useState<{ start: number; end: number } | null>(null);
  const pickSpan = useMemo(() => (sel?.size ? spanOf({ songs: [...sel], ...stretch }, byId) : null), [sel, byId, stretch]);
  const pickStretch = (from: number, to: number) => {
    const ids = songs.filter((s) => addedAt(s) >= from && addedAt(s) <= to).map((s) => s.id);
    if (!ids.length) return toast(t('No songs joined then.'));
    setSel(new Set(ids));
    setStretch({ start: from, end: to });
    last.current = null;
  };
  const stopPicking = () => { setSel(null); setStretch(null); last.current = null; };
  const makePeriod = () => sel?.size && setPeriod(blankPeriod({ songs: [...sel], ...stretch }));
  useEffect(() => { if (only && !showing) setOnly(null); }, [only, showing]);

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
  const at = Date.now();
  return (
    <div class={`mx${now ? ' has-now' : ''}`}>
      {now && (
        <div class="mx-now fade-arrive-soft">
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

      <section class={`mx-list${sel ? ' is-picking' : ''}`} ref={list}>
        {songs.length > 0 && !query && (
          <section class="mx-time fade-arrive-soft" aria-label={t('Your music over time')}>
            <MediaHead title={t('Over time')} icon="chart-dots">
              <span class="hint mx-time-hint">{sel ? countOf(sel.size, 'song picked', 'songs picked') : t('Drag across the wave to pick a period')}</span>
            </MediaHead>
            <MusicWave songs={songs} periods={periods} picked={pickSpan} onPick={pickStretch} onOpen={setPeriod} />
            {periods.length > 0 && <PeriodList periods={periods} songs={songs} onOpen={setPeriod} />}
          </section>
        )}

        {songs.length > 0 && (
          <>
            <MediaHead title={query ? t('Found') : showing ? periodName(showing) : t('All music')} count={shown.length}>
              <div class="row gap-s">
                <button class="btn btn-quiet btn-s" aria-pressed={!!sel} onClick={() => (sel ? stopPicking() : setSel(new Set()))}>
                  <Icon name="list-check" size={16} /> {sel ? t('Done') : t('Select')}
                </button>
                <SortChip<MusicSort> sort={sort} onSort={setSort} options={MUSIC_SORTS} />
              </div>
            </MediaHead>
            <SyncLine status={sync} onOpen={() => setSyncOpen(true)} />
            {(chips.length > 0 || showing) && (
              <div class="chips scroll-x mx-chips fade-arrive-soft" role="toolbar" aria-label={t('Kind and order')}>
                {showing && (
                  <button class="chip mx-period-chip" aria-pressed="true" onClick={() => setOnly(null)} style={{ '--c': periodColor(showing) }} aria-label={`${t('Show all music')}: ${periodName(showing)}`}>
                    <i aria-hidden="true" /> {periodName(showing)} <Icon name="x" size={14} stroke={2} />
                  </button>
                )}
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
            <button class="btn btn-primary" onClick={onAdd}><Icon name="plus" size={18} /> {t('Add music')}</button>
            <button class="btn btn-quiet" onClick={() => setSyncOpen(true)}><Icon name="brand-spotify" size={18} /> {t('Sync a Spotify playlist')}</button>
          </div>
        )}
        {!!songs.length && !shown.length && (
          <div class="empty-note center">
            <p>{t('No music matches.')}</p>
            <button class="btn btn-quiet" onClick={() => { onClearSearch(); setKind('all'); setOnly(null); }}>{t('Clear filters')}</button>
          </div>
        )}

        {shown.length > 0 && (
          <div class="mx-table" role="list" aria-label={t('All music')}>
            <div class="mx-thead" aria-hidden="true">
              <span class="mx-n">#</span>
              <button class="mx-th" aria-pressed={sort === 'title'} onClick={() => setSort('title')} tabIndex={-1}>{t('Title')}</button>
              <span class="mx-album">{t('Album')}</span>
              <button class="mx-th mx-date" aria-pressed={sort === 'added'} onClick={() => setSort('added')} tabIndex={-1}>{t('Date added')}</button>
              <button class="mx-th mx-rate-h" aria-pressed={sort === 'rating'} onClick={() => setSort('rating')} tabIndex={-1} title={t('Top rated')}><Icon name="star" size={15} /></button>
              <span class="mx-dur"><Icon name="clock" size={16} /></span>
            </div>
            {shown.slice(0, paged.n).map((s, i) => (
              <TrackRow key={s.id} s={s} n={i + 1} at={at} picking={!!sel} picked={!!sel?.has(s.id)} onPick={onPick} />
            ))}
          </div>
        )}
        {paged.more && <div ref={paged.ref} class="feed-more" aria-hidden="true" />}

        {sel && (
          <div class="mx-selbar fade-arrive-soft" role="toolbar" aria-label={t('Picked songs')}>
            <span class="mx-selbar-text">
              <b>{countOf(sel.size, 'song', 'songs')}</b>
              <span>{pickSpan ? spanLabel(pickSpan) : t('Tap songs, or drag across the wave')}</span>
            </span>
            {sel.size > 0 && <button class="btn btn-quiet btn-s" onClick={() => { setSel(new Set()); setStretch(null); }}>{t('Clear selection')}</button>}
            <button class="btn btn-primary btn-s" onClick={makePeriod} disabled={!sel.size}><Icon name="sparkles" size={16} /> {t('Make a period')}</button>
            <button class="icon-btn" onClick={stopPicking} aria-label={t('Stop selecting')}><Icon name="x" size={18} /></button>
          </div>
        )}
      </section>

      <PeriodSheet period={period} songs={songs} onClose={() => setPeriod(null)} onSaved={stopPicking} onShow={(p) => { setOnly(p.id); setKind('all'); showList(list.current); }} />
      <SyncSheet open={syncOpen} onClose={() => setSyncOpen(false)} />
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

type RowProps = { s: Song; n: number; at: number; picking: boolean; picked: boolean; onPick: (s: Song, shift: boolean) => void };
/** Every save reads the records back as new objects, so a row is the same while its record's id and last change are. */
const sameRow = (a: RowProps, b: RowProps) =>
  a.s.id === b.s.id && a.s.updated === b.s.updated && a.n === b.n && a.picking === b.picking && a.picked === b.picked && Math.floor(a.at / 6e4) === Math.floor(b.at / 6e4);

/**
 * A song as Spotify lists it in a playlist: its number, cover, title and artists, album, date added and length (with
 * your rating as a small badge and the length; on repeat is marked by the artists. Every column has a fixed width, so
 * the rows line up whatever they hold. Narrow, the album and date fold under the title.
 * While picking songs for a period, the number is a tick box and a tap picks the song.
 */
const TrackRow = memo(function TrackRow({ s, n, at, picking, picked, onPick }: RowProps) {
  const m = s.music;
  const when = addedLabel(addedAt(s), at);
  return (
    <button
      role="listitem"
      class={`mx-tr${picked ? ' is-picked' : ''}`}
      onClick={(e) => (picking ? onPick(s, e.shiftKey) : navigate('song/' + s.id))}
      aria-pressed={picking ? picked : undefined}
      aria-label={`${m.title}, ${musicSub(m)}, ${t('added {when}', { when })}${s.repeat ? ', ' + t('On repeat') : ''}${s.rating ? ', ' + t('{n} of 5 stars', { n: s.rating }) : ''}`}
    >
      <span class="mx-n" aria-hidden="true">{picking ? <span class="mx-tick">{picked && <Icon name="check" size={13} stroke={2.75} />}</span> : n}</span>
      <span class="mx-t">
        <span class={`mx-cover${isTape(m) ? ' is-tape' : ''}`}>{m.image && <img class="art-fade" src={smallArt(m.image)} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable={false} onLoad={artIn} />}</span>
        <span class="mx-t-text">
          <span class="mx-t-title">{m.title}</span>
          <span class="mx-t-sub">
            {s.repeat && <span class="mx-repeat" title={t('On repeat')}><Icon name="repeat" size={12} stroke={2.25} /></span>}
            {musicSub(m)}<span class="mx-t-when"> · {when}</span>
          </span>
        </span>
      </span>
      <span class="mx-album">{m.album ?? ''}</span>
      <span class="mx-date">{when}</span>
      <span class="mx-rate-cell">{s.rating > 0 && <span class={`mx-rate r${s.rating}`} style={{ '--r': s.rating }}><Icon name="star" size={11} stroke={2} />{s.rating}</span>}</span>
      <span class="mx-dur">{duration(m.ms)}</span>
    </button>
  );
}, sameRow);

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
