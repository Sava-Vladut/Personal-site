// Talks to our own server (server/index.js), which holds the Spotify client secret and
// keeps the access token in an encrypted, http-only cookie. The browser never sees either.
import type { Music } from './store';
import { t } from './i18n';
import { recall, remember } from './lastLogin';
import { retry } from './retry';

export interface SpotifyStatus {
  configured: boolean;   // server has SPOTIFY_CLIENT_ID / SECRET
  connected: boolean;    // this browser has signed in to Spotify
  user?: { name: string; image?: string };
  error?: string;        // connected, but Spotify refused (e.g. account not added to a development-mode app)
  offline?: boolean;
  redirect?: string;     // the redirect URI to register in the Spotify dashboard
}
export interface Playlist { id: string; name: string; count: number; cover?: string }
export interface Page<T> { items: T[]; next?: number }
export interface NowPlaying { current?: Music; playing?: boolean; recent: Music[]; reconnect?: boolean }

// Every request here only reads, so one that couldn't get through is safely tried again.
const get = <T>(path: string) => retry(() => once<T>(path));

async function once<T>(path: string): Promise<T> {
  let res: Response;
  try {
    // a little past the server's own 15 s deadline on Spotify, so its answer comes first; a stalled connection would spin forever
    res = await fetch('/api/spotify' + path, { credentials: 'same-origin', signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    // 504, like the server's own timeout, so it isn't tried again after such a long wait
    if ((e as Error)?.name === 'TimeoutError') throw Object.assign(new Error(t('Spotify took too long to respond. Try again.')), { status: 504 });
    throw new Error(t('Can’t reach the server. Spotify needs the app’s server running (npm start).'));
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ? t(body.error) : t('Spotify request failed ({status})', { status: res.status })), { status: res.status });
  return body as T;
}

const at = (offset?: number) => (offset ? `offset=${offset}` : '');

// The app start (Notices), Settings and the music picker each ask whether Spotify is connected, which the server asks
// Spotify: one clear answer serves them all for a minute (not offline, nor one where Spotify refused). Disconnecting asks
// again; connecting is a trip to Spotify and back, a fresh page.
const STATUS_FRESH = 60_000;
let lastStatus: { at: number; p: Promise<SpotifyStatus> } | null = null;

export const spotifyStatus = (): Promise<SpotifyStatus> => {
  if (lastStatus && Date.now() - lastStatus.at < STATUS_FRESH) return lastStatus.p;
  const entry = { at: Date.now(), p: null as unknown as Promise<SpotifyStatus> };
  const drop = () => { if (lastStatus === entry) lastStatus = null; };
  entry.p = get<SpotifyStatus>('/status').then(
    (s) => {
      if (s.error) drop();
      return remember('spotify', s);
    },
    () => {
      drop();
      return recall('spotify', { configured: false, connected: false, offline: true } as SpotifyStatus);
    },
  );
  lastStatus = entry;
  return entry.p;
};

export const resolveSpotify = (url: string) => get<Music>('/resolve?url=' + encodeURIComponent(url.trim()));
export const searchSpotify = (q: string, offset?: number) => get<Page<Music>>(`/search?q=${encodeURIComponent(q.trim())}&${at(offset)}`);
export const nowPlaying = () => get<NowPlaying>('/now');
export const listPlaylists = (offset?: number) => get<Page<Playlist>>('/playlists?' + at(offset));
export const listPlaylistItems = (id: string, offset?: number) => get<Page<Music & { added?: string }>>(`/playlists/${encodeURIComponent(id)}/items?${at(offset)}`);
/** A playlist's name, cover and snapshot (which changes whenever its songs do). */
export const playlistInfo = (id: string) => get<{ id: string; name: string; cover?: string; snapshot?: string }>(`/playlists/${encodeURIComponent(id)}`);

/** Leaves for Spotify's sign-in; comes back to the current screen (or `back`) with ?spotify=connected. */
export const connectSpotify = (back = location.hash) => {
  location.href = '/api/spotify/connect?back=' + encodeURIComponent(back.split('?')[0]);
};
export const disconnectSpotify = () => {
  lastStatus = null;
  return fetch('/api/spotify/disconnect', { method: 'POST' });
};

/** Spotify's own player. Signed in to Spotify in this browser → full songs, otherwise previews. */
export const embedUrl = (m: Music) => `https://open.spotify.com/embed/${m.kind}/${m.id}?utm_source=generator`;
export const embedHeight = (m: Music) => (m.kind === 'track' || m.kind === 'episode' ? 152 : 352);

export const KIND_LABEL: Record<Music['kind'], string> = {
  track: t('Song'), album: t('Album'), playlist: t('Playlist'), episode: t('Episode'), show: t('Podcast'), artist: t('Artist'),
};
