import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  listPlaylistItems, listPlaylists, nowPlaying, resolveSpotify, searchSpotify, spotifyStatus, type NowPlaying, type Playlist, type SpotifyStatus,
} from '../lib/spotify';
import type { Music } from '../lib/store';
import { ConnectSetup } from './ConnectSetup';
import { Icon } from './icons';
import { isTape, MusicEmbed, MusicThing, musicSub } from './music';
import { Sheet } from './Sheet';

type Tab = 'now' | 'search' | 'playlists';
const isLink = (q: string) => /^\s*(https?:\/\/|spotify:|(open\.)?spotify\.(com|link|app\.link)\/)/i.test(q);
const same = (a: Music, b: Music) => a.kind === b.kind && a.id === b.id;

/** One song/album/playlist row: the record or cassette it comes on, title, artists. Picked, the record slides out and spins. */
export function MusicRow({ m, pressed, onClick, end }: { m: Music; pressed?: boolean; onClick: () => void; end?: ComponentChildren }) {
  return (
    <button class={`track${isTape(m) ? ' is-tape' : ''}`} aria-pressed={pressed} onClick={onClick}>
      <span class="track-thing"><MusicThing m={m} size={46} /></span>
      <span class="track-main">
        <span class="track-title">{m.title}</span>
        <span class="track-sub">{musicSub(m)}</span>
      </span>
      <span class="track-end">{end}</span>
    </button>
  );
}

export function SpotifySheet({ open, onClose, onAdd, onConnect, addLabel = (n) => (n === 1 ? 'Add to note' : `Add ${n} to note`) }: {
  open: boolean;
  onClose: () => void;
  onAdd: (m: Music[]) => void;
  onConnect: () => void;
  addLabel?: (n: number) => string;
}) {
  const [tab, setTab] = useState<Tab>('now');
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [selected, setSelected] = useState<Music[]>([]);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    let active = true;
    spotifyStatus().then((next) => { if (active) setStatus(next); });
    return () => { active = false; };
  }, [open]);

  const toggle = (m: Music) => setSelected((s) => (s.some((x) => same(x, m)) ? s.filter((x) => !same(x, m)) : [...s, m]));
  const isSel = (m: Music) => selected.some((x) => same(x, m));
  const add = (m: Music[]) => {
    onAdd(m);
    onClose();
  };
  const row = (m: Music) => (
    <MusicRow m={m} pressed={isSel(m)} onClick={() => toggle(m)} end={<span class="track-check"><Icon name="check" size={14} stroke={2.5} /></span>} />
  );
  const gate = status && !status.connected ? <Gate status={status} onConnect={onConnect} /> : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title={<span class="row gap-s"><Icon name="brand-spotify" /> Spotify</span>}
      label="Add music from Spotify"
      footer={
        selected.length ? (
          <>
            <span class="foot-note">{selected.length} selected</span>
            <button class="btn btn-primary" onClick={() => add(selected)}>{addLabel(selected.length)}</button>
          </>
        ) : undefined
      }
    >
      <div class="seg" role="tablist">
        <button role="tab" aria-selected={tab === 'now'} onClick={() => setTab('now')}>Listening</button>
        <button role="tab" aria-selected={tab === 'search'} onClick={() => setTab('search')}>Search</button>
        <button role="tab" aria-selected={tab === 'playlists'} onClick={() => setTab('playlists')}>Playlists</button>
      </div>
      {status?.error && <p class="error">{status.error}</p>}
      {!status ? (
        <p class="hint">Checking Spotify…</p>
      ) : gate ? (
        <>
          {gate}
          <LinkTab onAdd={(m) => add([m])} label={addLabel(1)} />
        </>
      ) : (
        <>
          <div hidden={tab !== 'now'}><NowTab row={row} active={tab === 'now'} onConnect={onConnect} /></div>
          <div hidden={tab !== 'search'}><SearchTab row={row} /></div>
          <div hidden={tab !== 'playlists'}><PlaylistsTab row={row} /></div>
        </>
      )}
      <p class="attribution"><Icon name="brand-spotify" size={14} /> Music and artwork from Spotify</p>
    </Sheet>
  );
}

function Gate({ status, onConnect }: { status: SpotifyStatus; onConnect: () => void }) {
  const [setup, setSetup] = useState(false);
  if (status.offline)
    return <p class="empty-note">Search and playlists need the app’s server. Start it with <code>npm start</code>, or paste a Spotify link instead.</p>;
  return (
    <div class="empty-note center">
      <p>Log in with Spotify to search music and pick songs from your playlists.</p>
      <button class="btn btn-primary" onClick={status.configured ? onConnect : () => setSetup(true)}><Icon name="brand-spotify" size={18} /> Log in with Spotify</button>
      {!status.configured && <p>Pasting a song link works without logging in.</p>}
      <ConnectSetup redirect={status.redirect} open={setup} onClose={() => setSetup(false)} />
    </div>
  );
}

/** Loads pages of results and appends "Load more". */
function usePaged<T>() {
  const [items, setItems] = useState<T[]>([]);
  const [next, setNext] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const req = useRef(0);
  useEffect(() => () => { req.current++; }, []);
  const load = async (fetchPage: (offset?: number) => Promise<{ items: T[]; next?: number }>, more = false) => {
    const n = ++req.current;
    setBusy(true);
    setError('');
    if (!more) {
      setItems([]);
      setNext(undefined);
    }
    try {
      const page = await fetchPage(more ? next : undefined);
      if (n !== req.current) return; // a newer search replaced this one
      setItems((x) => (more ? [...x, ...page.items] : page.items));
      setNext(page.next);
    } catch (e) {
      if (n === req.current) setError((e as Error).message);
    }
    if (n === req.current) setBusy(false);
  };
  const reset = () => {
    req.current++;
    setItems([]);
    setNext(undefined);
    setBusy(false);
    setError('');
  };
  const cancel = () => { req.current++; };
  return { items, next, busy, error, load, reset, cancel };
}

function SearchTab({ row }: { row: (m: Music) => preact.JSX.Element }) {
  const [q, setQ] = useState('');
  const res = usePaged<Music>();
  const fetchPage = (offset?: number) => (isLink(q) ? resolveSpotify(q).then((m) => ({ items: [m] })) : searchSpotify(q, offset));

  useEffect(() => {
    res.reset();
    if (!q.trim()) return;
    const t = setTimeout(() => res.load(fetchPage), 350);
    return () => {
      clearTimeout(t);
      res.cancel();
    };
  }, [q]);

  return (
    <div class="stack">
      <label class="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Songs, artists, or paste a link" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Search Spotify" />
      </label>
      <div class="tracks">{res.items.map(row)}</div>
      {res.busy && <p class="hint center">Searching…</p>}
      {res.error && <p class="error">{res.error}</p>}
      {!res.busy && res.next !== undefined && <button class="btn btn-quiet block" onClick={() => res.load(fetchPage, true)}>More results</button>}
      {!res.busy && !res.error && q.trim() && !res.items.length && <p class="hint center">No songs found.</p>}
      {res.items.length === 1 && isLink(q) && res.items[0].kind !== 'track' && <MusicEmbed m={res.items[0]} />}
      {!q.trim() && <p class="hint center">Find the song that goes with this moment.</p>}
    </div>
  );
}

function NowTab({ row, active, onConnect }: { row: (m: Music) => preact.JSX.Element; active: boolean; onConnect: () => void }) {
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const req = useRef(0);
  const refresh = async () => {
    const n = ++req.current;
    setBusy(true);
    setError('');
    try {
      const next = await nowPlaying();
      if (n === req.current) setNow(next);
    } catch (e) {
      if (n === req.current) setError((e as Error).message);
    }
    if (n === req.current) setBusy(false);
  };
  // Refresh on showing the tab, and every 20 seconds while it's open, so a new song shows up.
  useEffect(() => {
    if (!active) return;
    refresh();
    const t = setInterval(refresh, 20_000);
    return () => {
      clearInterval(t);
      req.current++;
      setBusy(false);
    };
  }, [active]);

  if (now?.reconnect)
    return (
      <div class="empty-note center">
        <p>Log in with Spotify again to see what you’re listening to.</p>
        <button class="btn btn-primary" onClick={onConnect}><Icon name="brand-spotify" size={18} /> Log in again</button>
      </div>
    );

  return (
    <div class="stack">
      <div class="row now-head">
        <span class="section-label">{now?.current ? (now.playing ? 'Playing now' : 'Paused') : 'Now'}</span>
        <button class="icon-btn" onClick={refresh} disabled={busy} aria-label="Refresh"><Icon name="refresh" size={18} /></button>
      </div>
      {now?.current ? (
        <div class="tracks">{row(now.current)}</div>
      ) : now ? (
        <p class="hint">Nothing playing right now. Play something in Spotify and it’ll show up here.</p>
      ) : null}
      {!now && busy && <p class="hint center">Loading…</p>}
      {error && <p class="error">{error}</p>}
      {!!now?.recent.length && (
        <>
          <span class="section-label">Recently played</span>
          <div class="tracks">{now.recent.map(row)}</div>
        </>
      )}
    </div>
  );
}

function PlaylistsTab({ row }: { row: (m: Music) => preact.JSX.Element }) {
  const [open, setOpen] = useState<Playlist | null>(null);
  const lists = usePaged<Playlist>();
  const songs = usePaged<Music>();

  useEffect(() => {
    lists.load(listPlaylists);
  }, []);
  useEffect(() => {
    if (open) songs.load((o) => listPlaylistItems(open.id, o));
    else songs.reset();
  }, [open?.id]);

  if (open)
    return (
      <div class="stack">
        <button class="back-link" onClick={() => setOpen(null)}><Icon name="chevron-left" size={18} /> {open.name}</button>
        <div class="tracks">{songs.items.map(row)}</div>
        {songs.busy && <p class="hint center">Loading…</p>}
        {songs.error && <p class="error">{songs.error}</p>}
        {!songs.busy && songs.next !== undefined && <button class="btn btn-quiet block" onClick={() => songs.load((o) => listPlaylistItems(open.id, o), true)}>Load more</button>}
        {!songs.busy && !songs.error && !songs.items.length && <p class="hint center">This playlist is empty.</p>}
      </div>
    );

  return (
    <div class="stack">
      <div class="board-grid">
        {lists.items.map((p) => (
          <button class="board" onClick={() => setOpen(p)}>
            <span class="board-cover">{p.cover ? <img src={p.cover} alt="" loading="lazy" referrerpolicy="no-referrer" /> : <Icon name="playlist" size={22} />}</span>
            <span class="board-name">{p.name}</span>
            <span class="board-count">{p.count} {p.count === 1 ? 'song' : 'songs'}</span>
          </button>
        ))}
      </div>
      {lists.busy && <p class="hint center">Loading…</p>}
      {lists.error && <p class="error">{lists.error}</p>}
      {!lists.busy && lists.next !== undefined && <button class="btn btn-quiet block" onClick={() => lists.load(listPlaylists, true)}>Load more</button>}
      {!lists.busy && !lists.error && !lists.items.length && lists.next === undefined && (
        <p class="hint center">No playlists of your own yet. Spotify only lets apps open playlists you made or collaborate on.</p>
      )}
    </div>
  );
}

function LinkTab({ onAdd, label }: { onAdd: (m: Music) => void; label: string }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Music | null>(null);
  const req = useRef(0);
  useEffect(() => () => { req.current++; }, []);
  const changeUrl = (value: string) => {
    req.current++;
    setUrl(value);
    setPreview(null);
    setBusy(false);
    setError('');
  };

  const fetchLink = async (e?: Event) => {
    e?.preventDefault();
    if (!url.trim()) return;
    const n = ++req.current;
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const next = await resolveSpotify(url);
      if (n === req.current) setPreview(next);
    } catch (err) {
      if (n === req.current) setError((err as Error).message);
    }
    if (n === req.current) setBusy(false);
  };
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) changeUrl(t.trim());
    } catch {}
  };

  return (
    <form class="stack" onSubmit={fetchLink}>
      <p class="hint">Or, without logging in: in Spotify, tap <b>Share → Copy link</b> on a song, album or playlist, then paste it here.</p>
      <div class="row gap-s">
        <input
          class="input grow"
          type="url"
          inputMode="url"
          placeholder="open.spotify.com/track/…"
          value={url}
          onInput={(e) => changeUrl(e.currentTarget.value)}
          aria-label="Spotify link"
        />
        {'clipboard' in navigator && !url && <button type="button" class="btn btn-quiet" onClick={paste}>Paste</button>}
      </div>
      <button class="btn btn-primary block" disabled={busy || !url.trim()}>{busy ? 'Finding it…' : 'Get music'}</button>
      {error && <p class="error">{error}</p>}
      {preview && (
        <div class="stack">
          <MusicEmbed m={preview} />
          <button type="button" class="btn btn-primary block" onClick={() => onAdd(preview)}>{label}</button>
        </div>
      )}
    </form>
  );
}
