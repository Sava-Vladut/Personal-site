// Talks to our own server (server/index.js), which holds the Spotify client secret and
// keeps the access token in an encrypted, http-only cookie. The browser never sees either.
import type { Music } from './store';

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

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/spotify' + path, { credentials: 'same-origin' });
  } catch {
    throw new Error('Can’t reach the server. Spotify needs the app’s server running (npm start).');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Spotify request failed (${res.status})`);
  return body as T;
}

const at = (offset?: number) => (offset ? `offset=${offset}` : '');

export const spotifyStatus = () =>
  get<SpotifyStatus>('/status').catch(() => ({ configured: false, connected: false, offline: true }) as SpotifyStatus);

export const resolveSpotify = (url: string) => get<Music>('/resolve?url=' + encodeURIComponent(url.trim()));
export const searchSpotify = (q: string, offset?: number) => get<Page<Music>>(`/search?q=${encodeURIComponent(q.trim())}&${at(offset)}`);
export const nowPlaying = () => get<NowPlaying>('/now');
export const listPlaylists = (offset?: number) => get<Page<Playlist>>('/playlists?' + at(offset));
export const listPlaylistItems = (id: string, offset?: number) => get<Page<Music>>(`/playlists/${encodeURIComponent(id)}/items?${at(offset)}`);

/** Leaves for Spotify's sign-in; comes back to the current screen (or `back`) with ?spotify=connected. */
export const connectSpotify = (back = location.hash) => {
  location.href = '/api/spotify/connect?back=' + encodeURIComponent(back.split('?')[0]);
};
export const disconnectSpotify = () => fetch('/api/spotify/disconnect', { method: 'POST' });

/** Spotify's own player. Signed in to Spotify in this browser → full songs, otherwise previews. */
export const embedUrl = (m: Music) => `https://open.spotify.com/embed/${m.kind}/${m.id}?utm_source=generator`;
export const embedHeight = (m: Music) => (m.kind === 'track' || m.kind === 'episode' ? 152 : 352);

export const KIND_LABEL: Record<Music['kind'], string> = {
  track: 'Song', album: 'Album', playlist: 'Playlist', episode: 'Episode', show: 'Podcast', artist: 'Artist',
};
