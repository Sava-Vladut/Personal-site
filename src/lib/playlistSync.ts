// Keeps your records in step with the Spotify playlists you sync. Songs added there come in with Spotify's date
// added; songs taken off leave, unless you rated, wrote about or put them in a period (then they stay, off the list).
// Which playlists are synced travels with the songs themselves (each song's `lists`), so every device signed in to
// Spotify keeps them in step. A playlist just linked, with none of its songs in yet, is remembered on this device.
// Each check first asks for the playlist's snapshot (one small request), and reads its songs only when that changed.
import { useEffect } from 'preact/hooks';
import { listPlaylistItems, playlistInfo } from './spotify';
import { blankSong, deleteSong, getDeleted, getPeriods, getSongs, observable, saveSongs, type Music, type Song } from './store';

const KEY = 'mm-synced-playlists';
/** Where "Playlist order" remembered its playlist, before syncing: that playlist becomes the synced one. */
const OLD = 'mm-playlist-order';
/** How often an open records page asks Spotify whether a synced playlist changed. */
const EVERY = 45_000;

export interface Synced { id: string; name: string; cover?: string; snapshot?: string; pending?: boolean }
type Item = Music & { added?: string };

const keyOf = (m: Pick<Music, 'kind' | 'id'>) => m.kind + ':' + m.id;

function load(): Record<string, Synced> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    const old = JSON.parse(localStorage.getItem(OLD) || 'null');
    if (old && typeof old.id === 'string') return { [old.id]: { id: old.id, name: String(old.name || ''), pending: true } };
  } catch {}
  return {};
}
const meta$ = observable(load());
function setMeta(next: Record<string, Synced>) {
  meta$.set(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    localStorage.removeItem(OLD);
  } catch {}
}

export interface SyncStatus { busy: boolean; error: string | null; code?: number; at: number }
const status$ = observable<SyncStatus>({ busy: false, error: null, at: 0 });
export const useSyncStatus = status$.use;
export const useSyncedMeta = meta$.use;

/** The synced playlists: those your records are on, and any just linked here. */
export function syncedPlaylists(songs: Song[], metas = meta$.get()): Synced[] {
  const ids = new Set(Object.values(metas).filter((m) => m.pending).map((m) => m.id));
  for (const s of songs) for (const l of s.lists) ids.add(l);
  return [...ids].map((id) => metas[id] ?? { id, name: '' });
}

async function every<T>(page: (offset?: number) => Promise<{ items: T[]; next?: number }>) {
  const out: T[] = [];
  for (let offset: number | undefined = 0; offset !== undefined; ) {
    const p: { items: T[]; next?: number } = await page(offset || undefined);
    out.push(...p.items);
    offset = p.items.length ? p.next : undefined;
  }
  return out;
}

/** Nothing of yours on it: no stars, words, feelings, days, repeat or person. */
const untouched = (s: Song) => !s.rating && !s.text.trim() && !s.emotions.length && !s.days.length && !s.repeat && !s.from;
const same = (a: Song, b: Song) => a.added === b.added && a.lists.join() === b.lists.join() && JSON.stringify(a.music) === JSON.stringify(b.music);

/** Brings the records in step with one playlist's songs. */
async function apply(listId: string, items: Item[]) {
  const songs = getSongs();
  const inPeriods = new Set(getPeriods().flatMap((p) => p.songs));
  const drop = new Set<string>();

  // The same song kept twice (two devices synced before they'd seen each other's records): keep the one with
  // something of yours on it, else the older, and let an untouched copy go.
  const byKey = new Map<string, Song>();
  for (const s of [...songs].sort((a, b) => Number(untouched(a)) - Number(untouched(b)) || a.created - b.created)) {
    const k = keyOf(s.music);
    if (!byKey.has(k)) byKey.set(k, s);
    else if (untouched(s) && !inPeriods.has(s.id)) drop.add(s.id);
  }

  // each song once, at the first time it was added
  const on = new Map<string, Item>();
  for (const m of items) {
    const was = on.get(keyOf(m));
    if (!was || (m.added ?? '') < (was.added ?? '')) on.set(keyOf(m), m);
  }

  const gone = getDeleted();
  const now = Date.now();
  const changes: Song[] = [];
  for (const [k, item] of on) {
    const { added: at, ...music } = item;
    const added = (at && Date.parse(at)) || null;
    const s = byKey.get(k);
    if (s) {
      // on another synced playlist too: it joined your music at the earlier of the two
      const others = s.lists.some((x) => x !== listId);
      const next: Song = {
        ...s,
        music: { ...s.music, ...music },
        added: others && s.added && added ? Math.min(s.added, added) : added ?? s.added,
        lists: s.lists.includes(listId) ? s.lists : [...s.lists, listId],
      };
      if (!same(s, next)) changes.push(next);
    } else {
      // the same id on every device, so two devices syncing at once keep one copy
      const id = 'sp' + music.kind[0] + music.id;
      if (gone[id] && gone[id] >= (added ?? 0)) continue; // taken out of your records since it joined the playlist
      changes.push(blankSong(music as Music, { id, added, lists: [listId], created: added ?? now, updated: now }));
    }
  }

  // Taken off the playlist. An empty answer is more likely Spotify hiding the songs than the playlist emptied: then none leave.
  if (on.size) {
    for (const s of songs) {
      if (!s.lists.includes(listId) || on.has(keyOf(s.music)) || drop.has(s.id)) continue;
      const lists = s.lists.filter((x) => x !== listId);
      if (!lists.length && untouched(s) && !inPeriods.has(s.id)) drop.add(s.id);
      else changes.push({ ...s, lists });
    }
  }

  await saveSongs(changes);
  for (const id of drop) await deleteSong(id);
  return changes.length + drop.size;
}

let running: Promise<void> | null = null;

/** Checks every synced playlist, reading again those whose songs changed (all of them when `force`). */
export function syncPlaylists(force = false): Promise<void> {
  return (running ??= run(force).finally(() => { running = null; }));
}

async function run(force: boolean) {
  const lists = syncedPlaylists(getSongs());
  if (!lists.length) return;
  status$.set({ ...status$.get(), busy: true });
  try {
    for (const l of lists) {
      const info = await playlistInfo(l.id);
      if (force || l.pending || !info.snapshot || info.snapshot !== l.snapshot) await apply(l.id, await every<Item>((o) => listPlaylistItems(l.id, o)));
      // still pending while none of its songs are in (an empty playlist): only this device knows it's synced
      const pending = !getSongs().some((s) => s.lists.includes(l.id));
      setMeta({ ...meta$.get(), [l.id]: { id: l.id, name: info.name, cover: info.cover, snapshot: info.snapshot, ...(pending && { pending }) } });
    }
    status$.set({ busy: false, error: null, at: Date.now() });
  } catch (e) {
    status$.set({ ...status$.get(), busy: false, error: (e as Error).message, code: (e as { status?: number }).status });
  }
}

/** Starts syncing a playlist: its songs come into your records at once. */
export async function linkPlaylist(p: { id: string; name: string; cover?: string }) {
  setMeta({ ...meta$.get(), [p.id]: { id: p.id, name: p.name, cover: p.cover, pending: true } });
  await running;
  await syncPlaylists(true);
}

/** Stops syncing a playlist. Its songs stay in your records. */
export async function unlinkPlaylist(id: string) {
  const { [id]: _, ...rest } = meta$.get();
  setMeta(rest);
  await running;
  await saveSongs(getSongs().filter((s) => s.lists.includes(id)).map((s) => ({ ...s, lists: s.lists.filter((x) => x !== id) })));
}

/**
 * While the records are open (and loaded): syncs now, then checks again every 45 seconds and whenever you come back
 * to the tab, so a song added in Spotify shows up here within a minute. Not while Spotify refuses (not connected).
 */
export function usePlaylistSync(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let last = 0;
    const tick = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 15_000 || status$.get().code === 401) return;
      last = Date.now();
      syncPlaylists();
    };
    tick();
    const timer = setInterval(tick, EVERY);
    addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [active]);
  return status$.use();
}
