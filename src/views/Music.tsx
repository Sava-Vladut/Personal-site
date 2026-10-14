import { memo } from 'preact/compat';
import { useMemo, useRef } from 'preact/hooks';
import { coreOf } from '../data/emotions';
import { navigate } from '../lib/router';
import { blankSong, findSong, getSongs, saveSong, toast, useEntries, useReady, useSongs, type Music, type Song } from '../lib/store';
import { Stars } from '../components/books';
import { SortChip, type Sort } from './Books';
import { Icon } from '../components/icons';
import { usePref } from '../lib/prefs';
import { usePaged } from '../lib/inView';
import { isTape, MusicThing, musicSub } from '../components/music';
import { SongStats } from '../components/SongOfDay';
import { noun, t } from '../lib/i18n';

type Kind = 'all' | 'track' | 'album' | 'playlist' | 'podcast';

const KINDS: [Kind, string][] = [['track', t('Songs')], ['album', t('Albums')], ['playlist', t('Playlists')], ['podcast', t('Podcasts')]];
const kindOf = (m: Music): Kind => (m.kind === 'show' || m.kind === 'episode' ? 'podcast' : m.kind === 'artist' ? 'album' : m.kind);

/** How many records are drawn at first; scrolling near the end draws this many more (a whole row at 2, 3, 4 or 6 across). */
const PAGE = 48;
const keyOf = (m: Pick<Music, 'kind' | 'id'>) => m.kind + ':' + m.id;

/** The Media page's music (the song of the day sits on its sky): what you pick most, what's on repeat, your records and tapes in one dense grid, and what's waiting in your notes. */
export function MusicTab({ q, onAdd }: { q: string; onAdd: () => void }) {
  const songs = useSongs();
  const entries = useEntries();
  const ready = useReady();
  const [kind, setKind] = usePref<Kind>('music-kind', 'all', ['all', ...KINDS.map(([k]) => k)]);
  const [sort, setSort] = usePref<Sort>('music-sort', 'recent', ['recent', 'title', 'rating']);
  const keeping = useRef(new Set<string>());

  // what search looks through, lowercased once per change to the records rather than on every key
  const hay = useMemo(() => new Map(songs.map((s) => [s, `${s.music.title} ${s.music.sub ?? ''}`.toLowerCase()])), [songs]);
  const counts = useMemo(() => {
    const out = new Map<Kind, number>();
    for (const s of songs) out.set(kindOf(s.music), (out.get(kindOf(s.music)) ?? 0) + 1);
    return out;
  }, [songs]);

  const query = q.trim().toLowerCase();
  const shown = useMemo(() => {
    const words = query.split(/\s+/).filter(Boolean);
    const list = songs.filter((s) => (kind === 'all' || kindOf(s.music) === kind) && (!words.length || words.every((w) => hay.get(s)!.includes(w))));
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
      if (out.length >= 12) break;
    }
    return out.slice(0, 12);
  }, [entries, songs]);

  const grouped = kind === 'all' && !query;
  const repeat = useMemo(() => (grouped ? shown.filter((s) => s.repeat) : []), [grouped, shown]);
  const rest = useMemo(() => (grouped ? shown.filter((s) => !s.repeat) : shown), [grouped, shown]);
  const count = (k: Kind) => counts.get(k) ?? 0;

  // Only the first records are drawn; the rest come in as you scroll toward them, so a big collection opens quickly.
  const paged = usePaged(rest.length, PAGE, `${kind}|${sort}|${query}`);

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

  return (
    <>
      {songs.length > 0 && !q.trim() && <SongStats songs={songs} />}

      {repeat.length > 0 && (
        <section class="section">
          <h2 class="section-title"><Icon name="repeat" size={16} /> {t('On repeat')}</h2>
          <div class="mini-strip">
            {repeat.map((s) => (
              <button key={s.id} class="mini-card is-repeat" onClick={() => navigate('song/' + s.id)}>
                <MusicThing m={s.music} size={34} />
                <span class="mini-main">
                  <span class="mini-title">{s.music.title}</span>
                  <span class="mini-sub">{musicSub(s.music)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {songs.length > 0 && (
        <div class="chips scroll-x filters media-filters" role="toolbar" aria-label={t('Kind and order')}>
          <SortChip sort={sort} onSort={setSort} />
          <button class="chip" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>{t('All')} {songs.length}</button>
          {KINDS.map(([k, name]) => count(k) > 0 && (
            <button class="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{name} {count(k)}</button>
          ))}
        </div>
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

      {rest.length > 0 && (
        <div class="sleeves">
          {/* each page's records come in on their own count, so a page drawn on scrolling doesn't wait behind the first */}
          {rest.slice(0, paged.n).map((s, k) => <Sleeve key={s.id} s={s} k={k % PAGE} />)}
        </div>
      )}
      {paged.more && <div ref={paged.ref} class="feed-more" aria-hidden="true" />}

      {waiting.length > 0 && grouped && (
        <section class="section" title={t('Music you added to notes. Keep it to rate it and say what it means to you.')}>
          <h2 class="section-title"><Icon name="notebook" size={16} /> {t('In your notes')}</h2>
          <div class="mini-strip">
            {waiting.map((m) => (
              <div key={keyOf(m)} class="mini-card">
                <MusicThing m={m} size={34} />
                <span class="mini-main">
                  <span class="mini-title">{m.title}</span>
                  <span class="mini-sub">{musicSub(m)}</span>
                </span>
                <button class="mini-keep" onClick={() => keep(m)} aria-label={`${t('Keep')}: ${m.title}`} title={t('Keep')}><Icon name="plus" size={16} stroke={2} /></button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

type SleeveProps = { s: Song; k: number };
/** Every save reads the records back as new objects, so a record is the same while its id and last change are. */
const sameSleeve = (a: SleeveProps, b: SleeveProps) => a.k === b.k && a.s.id === b.s.id && a.s.updated === b.s.updated;

/** A record in the collection, tinted by the first feeling it brings; drawn again only when it (or its place) changes. */
const Sleeve = memo(function Sleeve({ s, k }: SleeveProps) {
  const core = s.emotions[0] && coreOf(s.emotions[0])?.id;
  return (
    <button
      class={`sleeve${isTape(s.music) ? ' is-tape' : ''}`}
      style={{ '--k': k, '--t': core ? `var(--emo-${core})` : 'var(--line-2)' }}
      onClick={() => navigate('song/' + s.id)}
      aria-label={`${s.music.title}, ${musicSub(s.music)}${s.rating ? ', ' + t('{n} of 5 stars', { n: s.rating }) : ''}`}
    >
      <MusicThing m={s.music} size={50} />
      {s.repeat && <span class="sleeve-badge" title={t('On repeat')}><Icon name="repeat" size={11} stroke={2.2} /></span>}
      <span class="sleeve-title">{s.music.title}</span>
      {s.rating > 0 ? <Stars value={s.rating} size={10} /> : <span class="sleeve-sub">{s.music.sub ?? musicSub(s.music)}</span>}
    </button>
  );
}, sameSleeve);

/** The numbers over the records: records, tapes, what's on repeat, and the average rating. */
export function musicStats(songs: Song[]): [string, string][] {
  const tapes = songs.filter((s) => isTape(s.music)).length;
  const records = songs.length - tapes;
  const rated = songs.filter((s) => s.rating);
  const out: [string, string][] = [
    [String(records), noun(records, 'record', 'records')],
    [String(tapes), noun(tapes, 'tape', 'tapes')],
    [String(songs.filter((s) => s.repeat).length), t('on repeat')],
  ];
  if (rated.length) out.push([(rated.reduce((n, s) => n + s.rating, 0) / rated.length).toFixed(1), t('average ★')]);
  return out.filter(([v]) => v !== '0');
}
