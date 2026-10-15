import { memo } from 'preact/compat';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { navigate } from '../lib/router';
import { blankSong, findSong, getSongs, saveSong, toast, useEntries, useReady, useSongs, type Music, type Song } from '../lib/store';
import { Stars } from '../components/books';
import { MediaFilters, type Sort } from './Books';
import { Icon } from '../components/icons';
import { usePref } from '../lib/prefs';
import { usePaged } from '../lib/inView';
import { isTape, MusicThing, musicSub } from '../components/music';
import { MostPicked, SongOfDay, type DayPick } from '../components/SongOfDay';
import { Sheet } from '../components/Sheet';
import { count as countOf, t } from '../lib/i18n';

type Kind = 'all' | 'repeat' | 'track' | 'album' | 'playlist' | 'podcast';

const KINDS: [Kind, string][] = [['track', t('Songs')], ['album', t('Albums')], ['playlist', t('Playlists')], ['podcast', t('Podcasts')]];
const kindOf = (m: Music): Kind => (m.kind === 'show' || m.kind === 'episode' ? 'podcast' : m.kind === 'artist' ? 'album' : m.kind);

/** How many records are drawn at first; scrolling near the end draws this many more (a whole row at 2, 3, 4 or 6 across). */
const PAGE = 48;
/** How many of the music in your notes the sheet lists. */
const WAITING = 60;
const keyOf = (m: Pick<Music, 'kind' | 'id'>) => m.kind + ':' + m.id;

/**
 * The Media page's music: today's song and the ways into what you pick most and what's waiting in your notes (all
 * of it on the side at the right on a wide screen), then your records and tapes in one dense grid.
 */
export function MusicTab({ q, onAdd, picker }: { q: string; onAdd: () => void; picker: DayPick }) {
  const songs = useSongs();
  const entries = useEntries();
  const ready = useReady();
  const [chosen, setKind] = usePref<Kind>('music-kind', 'all', ['all', 'repeat', ...KINDS.map(([k]) => k)]);
  const [sort, setSort] = usePref<Sort>('music-sort', 'recent', ['recent', 'title', 'rating']);
  const [notesOpen, setNotesOpen] = useState(false);
  const keeping = useRef(new Set<string>());

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

  // Only the first records are drawn; the rest come in as you scroll toward them, so a big collection opens quickly.
  const paged = usePaged(shown.length, PAGE, `${kind}|${sort}|${query}`);

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

  const aside = songs.length > 0 && !query;
  return (
    <>
      {aside && (
        <aside class="media-side">
          <SongOfDay songs={songs} picker={picker} />
          <div class="media-links">
            <MostPicked songs={songs} />
            {waiting.length > 0 && (
              <button class="media-link" onClick={() => setNotesOpen(true)} title={t('Music you added to notes. Keep it to rate it and say what it means to you.')}>
                <span class="media-link-icon"><Icon name="notebook" size={19} /></span>
                <span class="media-link-main">
                  <span class="media-link-title">{t('In your notes')}</span>
                  <span class="media-link-sub">{t('{n} to keep', { n: waiting.length })}</span>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
            )}
          </div>
        </aside>
      )}

      <div class="media-main">
        {songs.length > 0 && (
          <MediaFilters label={t('Kind and order')} sort={sort} onSort={setSort}>
            {chips.length > 0 && (
              <>
                <button class="chip" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>{t('All')} {songs.length}</button>
                {chips.map(([k, name]) => (
                  <button class="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                    {k === 'repeat' && <Icon name="repeat" size={14} stroke={2} />}
                    {name} {count(k)}
                  </button>
                ))}
              </>
            )}
          </MediaFilters>
        )}

        {!ready && !songs.length && (
          <div class="sleeves" aria-hidden="true">
            {Array.from({ length: 8 }, () => <span class="sleeve sleeve-ph" />)}
          </div>
        )}

        {ready && !songs.length && (
          <div class="empty">
            <h2 class="title-s">{t('No records yet')}</h2>
            <p>{t('Keep the songs, albums and playlists that mean something: rate them, say how they make you feel, and who they remind you of.')}</p>
            <button class="btn btn-primary" onClick={onAdd}><Icon name="vinyl" size={18} /> {t('Add music')}</button>
          </div>
        )}
        {!!songs.length && !shown.length && <p class="empty-note center">{t('No music matches.')}</p>}

        {shown.length > 0 && (
          <div class="sleeves">
            {/* each page's records come in on their own count, so a page drawn on scrolling doesn't wait behind the first */}
            {shown.slice(0, paged.n).map((s, k) => <Sleeve key={s.id} s={s} k={k % PAGE} />)}
          </div>
        )}
        {paged.more && <div ref={paged.ref} class="feed-more" aria-hidden="true" />}
      </div>

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
    </>
  );
}

type SleeveProps = { s: Song; k: number };
/** Every save reads the records back as new objects, so a record is the same while its id and last change are. */
const sameSleeve = (a: SleeveProps, b: SleeveProps) => a.k === b.k && a.s.id === b.s.id && a.s.updated === b.s.updated;

/** A record in the collection: the disc, its name and its rating; drawn again only when it (or its place) changes. */
const Sleeve = memo(function Sleeve({ s, k }: SleeveProps) {
  return (
    <button
      class={`sleeve${isTape(s.music) ? ' is-tape' : ''}`}
      style={{ '--k': k }}
      onClick={() => navigate('song/' + s.id)}
      aria-label={`${s.music.title}, ${musicSub(s.music)}${s.rating ? ', ' + t('{n} of 5 stars', { n: s.rating }) : ''}`}
    >
      <MusicThing m={s.music} />
      {s.repeat && <span class="sleeve-badge" title={t('On repeat')}><Icon name="repeat" size={11} stroke={2.2} /></span>}
      <span class="sleeve-title">{s.music.title}</span>
      {s.rating > 0 && <Stars value={s.rating} size={10} />}
    </button>
  );
}, sameSleeve);

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
