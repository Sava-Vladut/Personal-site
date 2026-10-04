import { useMemo, useRef } from 'preact/hooks';
import { navigate } from '../lib/router';
import { blankSong, findSong, getSongs, saveSong, toast, useEntries, useReady, useSongs, type Music, type Song } from '../lib/store';
import { Stars } from '../components/books';
import { SortChip, type Sort } from './Books';
import { Icon } from '../components/icons';
import { usePref } from '../lib/prefs';
import { isTape, MusicThing, musicSub } from '../components/music';

type Kind = 'all' | 'track' | 'album' | 'playlist' | 'podcast';

const KINDS: [Kind, string][] = [['track', 'Songs'], ['album', 'Albums'], ['playlist', 'Playlists'], ['podcast', 'Podcasts']];
const kindOf = (m: Music): Kind => (m.kind === 'show' || m.kind === 'episode' ? 'podcast' : m.kind === 'artist' ? 'album' : m.kind);

/** The Media page's music: what's on repeat, your records, your tapes, and what's waiting in your notes. */
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
  const records = rest.filter((s) => !isTape(s.music));
  const tapes = rest.filter((s) => isTape(s.music));
  const count = (k: Kind) => songs.filter((s) => kindOf(s.music) === k).length;

  const keep = async (m: Music) => {
    const key = m.kind + ':' + m.id;
    if (keeping.current.has(key)) return;
    keeping.current.add(key);
    try {
      if (!findSong(getSongs(), m)) await saveSong(blankSong(m));
      toast(`${m.title} is in your records`);
    } catch {
      toast('Couldn’t save this music. Try again.');
    } finally {
      keeping.current.delete(key);
    }
  };

  return (
    <>
      {songs.length > 0 && (
        <div class="chips scroll-x filters media-filters" role="toolbar" aria-label="Kind and order">
          <SortChip sort={sort} onSort={setSort} />
          <button class="chip" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>All {songs.length}</button>
          {KINDS.map(([k, name]) => count(k) > 0 && (
            <button class="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{name} {count(k)}</button>
          ))}
        </div>
      )}

      {ready && !songs.length && (
        <div class="empty">
          <h2 class="title-s">No records yet</h2>
          <p>Keep the songs, albums and playlists that mean something: rate them, say how they make you feel, and who they remind you of.</p>
          <button class="btn btn-primary" onClick={onAdd}><Icon name="vinyl" size={18} /> Add music</button>
        </div>
      )}
      {!!songs.length && !shown.length && <p class="empty-note center">No music matches.</p>}

      {repeat.length > 0 && (
        <section class="section">
          <h2 class="section-title"><Icon name="repeat" size={16} /> On repeat</h2>
          <div class="repeat-list">
            {repeat.map((s) => (
              <button key={s.id} class="repeat-row card is-repeat" onClick={() => navigate('song/' + s.id)}>
                <MusicThing m={s.music} size={44} />
                <span class="book-row-main">
                  <span class="book-row-title">{s.music.title}</span>
                  <span class="book-row-sub">{musicSub(s.music)}</span>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
            ))}
          </div>
        </section>
      )}

      {records.length > 0 && <Crate title={grouped ? 'Records' : ''} list={records} />}
      {tapes.length > 0 && <Crate title={grouped ? 'Tapes' : ''} list={tapes} tapes />}

      {waiting.length > 0 && grouped && (
        <section class="section">
          <h2 class="section-title">In your notes</h2>
          <p class="hint">Music you added to notes. Keep it to rate it and say what it means to you.</p>
          <div class="tracks">
            {waiting.map((m) => (
              <div key={m.kind + ':' + m.id} class={`track waiting${isTape(m) ? ' is-tape' : ''}`}>
                <span class="track-thing"><MusicThing m={m} size={38} /></span>
                <span class="track-main">
                  <span class="track-title">{m.title}</span>
                  <span class="track-sub">{musicSub(m)}</span>
                </span>
                <button class="btn btn-quiet btn-s" onClick={() => keep(m)}><Icon name="plus" size={16} /> Keep</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Records standing in a crate (or tapes in a rack), face out: sleeve, title, and its stars or who it's by. */
function Crate({ title, list, tapes }: { title: string; list: Song[]; tapes?: boolean }) {
  return (
    <section class="section">
      {title && <h2 class="section-title">{title} <span class="muted">{list.length}</span></h2>}
      <div class={`crate${tapes ? ' is-tapes' : ''}`}>
        {list.map((s, k) => (
          <button key={s.id} class="crate-item" style={{ '--k': k }} onClick={() => navigate('song/' + s.id)} aria-label={`${s.music.title}, ${musicSub(s.music)}${s.rating ? `, ${s.rating} of 5 stars` : ''}`}>
            <MusicThing m={s.music} />
            <span class="crate-title">{s.music.title}</span>
            {s.rating > 0 ? <Stars value={s.rating} size={11} /> : <span class="crate-sub">{s.music.sub ?? musicSub(s.music)}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

/** The numbers over the records: records, tapes, what's on repeat, and the average rating. */
export function musicStats(songs: Song[]): [string, string][] {
  const tapes = songs.filter((s) => isTape(s.music)).length;
  const records = songs.length - tapes;
  const rated = songs.filter((s) => s.rating);
  const out: [string, string][] = [
    [String(records), records === 1 ? 'record' : 'records'],
    [String(tapes), tapes === 1 ? 'tape' : 'tapes'],
    [String(songs.filter((s) => s.repeat).length), 'on repeat'],
  ];
  if (rated.length) out.push([(rated.reduce((n, s) => n + s.rating, 0) / rated.length).toFixed(1), 'average ★']);
  return out.filter(([v]) => v !== '0');
}
