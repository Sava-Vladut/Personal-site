import { useMemo, useRef } from 'preact/hooks';
import { coreOf } from '../data/emotions';
import { navigate } from '../lib/router';
import { blankSong, findSong, getSongs, saveSong, toast, useEntries, useReady, useSongs, type Music, type Song } from '../lib/store';
import { Stars } from '../components/books';
import { SortChip, type Sort } from './Books';
import { Icon } from '../components/icons';
import { usePref } from '../lib/prefs';
import { isTape, MusicThing, musicSub } from '../components/music';
import { SongStats } from '../components/SongOfDay';
import { noun, t } from '../lib/i18n';

type Kind = 'all' | 'track' | 'album' | 'playlist' | 'podcast';

const KINDS: [Kind, string][] = [['track', t('Songs')], ['album', t('Albums')], ['playlist', t('Playlists')], ['podcast', t('Podcasts')]];
const kindOf = (m: Music): Kind => (m.kind === 'show' || m.kind === 'episode' ? 'podcast' : m.kind === 'artist' ? 'album' : m.kind);

/** The Media page's music (the song of the day sits on its sky): what you pick most, what's on repeat, your records and tapes in one dense grid, and what's waiting in your notes. */
export function MusicTab({ q, onAdd }: { q: string; onAdd: () => void }) {
  const songs = useSongs();
  const entries = useEntries();
  const ready = useReady();
  const [kind, setKind] = usePref<Kind>('music-kind', 'all', ['all', ...KINDS.map(([k]) => k)]);
  const [sort, setSort] = usePref<Sort>('music-sort', 'recent', ['recent', 'title', 'rating']);
  const keeping = useRef(new Set<string>());

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = songs.filter((s) => (kind === 'all' || kindOf(s.music) === kind) && words.every((w) => `${s.music.title} ${s.music.sub ?? ''}`.toLowerCase().includes(w)));
    if (sort === 'title') list.sort((a, b) => a.music.title.localeCompare(b.music.title, undefined, { sensitivity: 'base' }));
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating || b.created - a.created);
    return list;
  }, [songs, kind, sort, q]);

  // Music attached to notes that isn't kept yet, newest first, each once.
  const waiting = useMemo(() => {
    const seen = new Set<string>();
    const out: Music[] = [];
    for (const e of entries)
      for (const m of e.music) {
        const key = m.kind + ':' + m.id;
        if (seen.has(key) || findSong(songs, m)) continue;
        seen.add(key);
        out.push(m);
      }
    return out.slice(0, 12);
  }, [entries, songs]);

  const grouped = kind === 'all' && !q.trim();
  const repeat = grouped ? shown.filter((s) => s.repeat) : [];
  const rest = grouped ? shown.filter((s) => !s.repeat) : shown;
    const count = (k: Kind) => songs.filter((s) => kindOf(s.music) === k).length;

  const keep = async (m: Music) => {
    const key = m.kind + ':' + m.id;
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
          {rest.map((s, k) => {
            const core = s.emotions[0] && coreOf(s.emotions[0])?.id;
            return (
              <button
                key={s.id}
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
          })}
        </div>
      )}

      {waiting.length > 0 && grouped && (
        <section class="section" title={t('Music you added to notes. Keep it to rate it and say what it means to you.')}>
          <h2 class="section-title"><Icon name="notebook" size={16} /> {t('In your notes')}</h2>
          <div class="mini-strip">
            {waiting.map((m) => (
              <div key={m.kind + ':' + m.id} class="mini-card">
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
