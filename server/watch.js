// Watch a live Twitch stream in the app (#/watch, views/Watch.tsx), played by hls.js instead of Twitch's own player.
// Twitch answers the playlists only to its own pages (any other Origin gets a 403), so they come through here; the
// video segments they list are open to any page, so the browser fetches those straight from Twitch's CDN.
//  • GET /api/watch/<login>.m3u8 — a playback token from Twitch's public GraphQL API (the web player's public client
//    id, as in server/streamers.js), then Usher's list of qualities, each pointed back at /api/watch/playlist.
//  • GET /api/watch/playlist?u=<url> — one quality's live playlist, as Twitch wrote it. Only *.ttvnw.net is fetched.
// Low latency (?ll=1 on the first, passed on to the rest): Twitch also lists the next two segments, still being made,
// as #EXT-X-TWITCH-PREFETCH. Its own player fetches them early, and the CDN sends each one as it's made (the first
// is done ~1.5 s after it's listed, ~2 s before it would turn up as an ordinary segment). Other players skip the tag,
// so here they become ordinary segments, which puts the newest video ~4 s closer to live.
// How far behind that the video sits is the page's choice (hls.js's liveSyncDuration), not this file's.
import { randomBytes } from 'node:crypto';
import { HttpError } from './http-error.js';

const GQL = 'https://gql.twitch.tv/gql';
const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const LOGIN = /^[a-z0-9_]{2,25}$/;
const TOKEN = `query($login: String!) { streamPlaybackAccessToken(channelName: $login, params: {platform: "web", playerBackend: "mediaplayer", playerType: "site"}) { value signature } }`;
const TIMEOUT = 10_000;

/** Twitch's playlist servers, and nothing else: this must not become a proxy for anything on the web. */
export function twitchPlaylist(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && url.hostname.endsWith('.ttvnw.net') && !url.username && !url.port ? url.href : null;
  } catch {
    return null;
  }
}

/** Usher's list of qualities, with each quality's playlist fetched through /api/watch/playlist. */
export const pointQualities = (m3u8, low = false) =>
  m3u8.split('\n').map((line) => (/^https:\/\//.test(line.trim()) ? `/api/watch/playlist?u=${encodeURIComponent(line.trim())}${low ? '&ll=1' : ''}` : line)).join('\n');

/** Twitch's prefetch entries as ordinary segments, as long as the newest ordinary one (Twitch's are 2 s). */
export function withPrefetch(m3u8) {
  let last = '2.000';
  return m3u8.split('\n').map((line) => {
    const inf = /^#EXTINF:([\d.]+)/.exec(line);
    if (inf) last = inf[1];
    const pre = /^#EXT-X-TWITCH-PREFETCH:(https:\/\/\S+)/.exec(line.trim());
    return pre ? `#EXTINF:${last},live\n${pre[1]}` : line;
  }).join('\n');
}

function sendPlaylist(res, text) {
  res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  res.end(text);
}

export function createWatchHandler({ fetch = globalThis.fetch } = {}) {
  const get = async (url, init) => {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
    } catch {
      throw new HttpError(502, 'Twitch can’t be reached right now.');
    }
  };

  async function qualities(login, low) {
    const r = await get(GQL, {
      method: 'POST',
      headers: { 'Client-ID': CLIENT_ID, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: TOKEN, variables: { login } }),
    });
    const token = r.ok ? (await r.json().catch(() => null))?.data?.streamPlaybackAccessToken : null;
    if (!token?.value || !token.signature) throw new HttpError(404, 'That channel doesn’t exist.');
    const usher = `https://usher.ttvnw.net/api/v2/channel/hls/${login}.m3u8?` + new URLSearchParams({
      sig: token.signature,
      token: token.value,
      allow_source: 'true',
      fast_bread: 'true',
      platform: 'web',
      player_backend: 'mediaplayer',
      playlist_include_framerate: 'true',
      play_session_id: randomBytes(16).toString('hex'),
      p: String(Math.floor(Math.random() * 1e6)),
    });
    const u = await get(usher);
    if (u.status === 404) throw new HttpError(404, 'offline');
    if (!u.ok) throw new HttpError(502, 'Twitch wouldn’t give out this stream right now.');
    return pointQualities(await u.text(), low);
  }

  return async function api(req, res, p, url) {
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
    if (p === '/api/watch/playlist') {
      const u = twitchPlaylist(url.searchParams.get('u') ?? '');
      if (!u) throw new HttpError(400, 'Not a Twitch playlist.');
      const r = await get(u);
      if (!r.ok) throw new HttpError(r.status === 403 || r.status === 404 ? 410 : 502, 'The stream ended or moved.');
      const text = await r.text();
      return sendPlaylist(res, url.searchParams.get('ll') === '1' ? withPrefetch(text) : text);
    }
    const login = /^\/api\/watch\/([^/]+)\.m3u8$/.exec(p)?.[1]?.toLowerCase();
    if (!login || !LOGIN.test(login)) throw new HttpError(404, 'Not found');
    return sendPlaylist(res, await qualities(login, url.searchParams.get('ll') === '1'));
  };
}
