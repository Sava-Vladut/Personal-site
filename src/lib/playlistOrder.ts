// Music's "Playlist order": the order of the Spotify playlist your records came from, as Spotify lists it by date added,
// newest first. The playlist is found once (the one sharing the most songs with your records) and remembered; its songs
// are read again each time the order is shown, and the last order is kept on this device so the list stands at once.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { listPlaylistItems, listPlaylists, type Playlist } from './spotify';
import type { Music, Song } from './store';

const KEY = 'mm-playlist-order';
/** How many of your biggest playlists are looked through for the one your records came from. */
const LOOK = 10;

interface Saved { id: string; name: string; keys: string[] }
type Item = Music & { added?: string };

const keyOf = (m: Pick<Music, 'kind' | 'id'>) => m.kind + ':' + m.id;

function load(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && typeof v.id === 'string' && Array.isArray(v.keys) ? v : null;
  } catch {
    return null;
  }
}
function save(v: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

async function every<T>(page: (offset?: number) => Promise<{ items: T[]; next?: number }>, max = Infinity) {
  const out: T[] = [];
  for (let offset: number | undefined = 0; offset !== undefined && out.length < max; ) {
    const p: { items: T[]; next?: number } = await page(offset || undefined);
    out.push(...p.items);
    offset = p.items.length ? p.next : undefined;
  }
  return out;
}

/** Your playlist that shares the most songs with your records, judged by its first page. */
async function findPlaylist(songs: Song[]): Promise<Playlist | null> {
  const kept = new Set(songs.map((s) => keyOf(s.music)));
  const lists = (await every(listPlaylists, 500)).sort((a, b) => b.count - a.count).slice(0, LOOK);
  let best: Playlist | null = null;
  let most = 0;
  for (const pl of lists) {
    const { items } = await listPlaylistItems(pl.id);
    const n = items.filter((m) => kept.has(keyOf(m))).length;
    if (n > most) [best, most] = [pl, n];
  }
  return best;
}

/** The playlist's songs, newest added first (Spotify's own order where two were added together). */
async function readOrder(id: string) {
  const items = await every<Item>((o) => listPlaylistItems(id, o));
  return items
    .map((m, i) => ({ key: keyOf(m), added: m.added ?? '', i }))
    .sort((a, b) => (a.added === b.added ? a.i - b.i : a.added < b.added ? 1 : -1))
    .map((x) => x.key);
}

/** Where each record stands in the playlist (by `kind:id`), and the playlist's name; null until known. */
export function usePlaylistOrder(active: boolean, songs: Song[]) {
  const [saved, setSaved] = useState(load);
  const started = useRef(false);
  const has = songs.length > 0;

  useEffect(() => {
    if (!active || !has || started.current) return;
    started.current = true;
    (async () => {
      const id = saved?.id;
      const pl = id ? { id, name: saved!.name } : await findPlaylist(songs);
      if (!pl) return;
      const next = { id: pl.id, name: pl.name, keys: await readOrder(pl.id) };
      save(next);
      setSaved(next);
    })().catch(() => { started.current = false; }); // not connected to Spotify, or offline: the last order known stays
  }, [active, has]);

  const rank = useMemo(() => (saved ? new Map(saved.keys.map((k, i) => [k, i])) : null), [saved]);
  return { rank, name: saved?.name ?? null };
}
