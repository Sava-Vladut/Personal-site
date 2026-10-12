// My Mind — tiny server, no dependencies.
//  • serves the built app from dist/ (compressed, cached, with security headers)
//  • Spotify: resolves pasted song/album/playlist links (no key needed) and, when a client id is
//    configured, runs the authorization-code flow and proxies search and playlist listing.
//    Access tokens live in encrypted http-only cookies — per browser, never in JS.
//  • GitHub: signs you in (authorization-code flow) and reports how many public and private repos your account has.
//    The access token lives in an encrypted http-only cookie, like Spotify's.
//  • Each account's newest sign-in is also kept sealed in data/ (server/accounts.js), so a device whose token
//    was revoked or lost when signing in elsewhere picks up the newest one instead of dropping the connection.
//  • sync: keeps an end-to-end encrypted copy of the journal, found by an id the browser derives from its sync code.
//    The server only ever sees ciphertext; the code (and so the key) never leaves the devices.
//  • public notes: a note you choose to share is copied to data/shared/ and read by anyone with its /s/<token> link
//    (server/share.js). Only the admin (ADMIN_PASSWORD) can publish, update or stop sharing one.
//  • channel points: sums up the Twitch Channel Points Miner's analytics (TWITCH_ANALYTICS_DIR), read-only,
//    and lets the admin (ADMIN_PASSWORD) change which channels it watches (TWITCH_CHANNELS_FILE).
import http from 'node:http';
import crypto from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAccountStore } from './accounts.js';
import { HttpError } from './http-error.js';
import { readJson } from './http-request.js';
import { json } from './http-response.js';
import { createShareHandler } from './share.js';
import { createSyncHandler } from './sync.js';
import { createStaticHandler } from './static.js';
import { createTwitchHandler } from './twitch.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(join(ROOT, '.env'));

const PORT = Number(process.env.PORT) || 8085;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const APP_URL = (process.env.APP_URL || PUBLIC_URL).replace(/\/+$/, ''); // where to land after connecting
const SECURE = PUBLIC_URL.startsWith('https://');
const DIST = join(ROOT, 'dist');
const SYNC_DIR = join(ROOT, 'data', 'sync');
const SHARE_DIR = process.env.SHARE_DIR || join(ROOT, 'data', 'shared');
// the miner's analytics folder (the one holding a folder per account)
const TWITCH_DIR = process.env.TWITCH_ANALYTICS_DIR || '';
// the miner's settings/channels.json, the channels it watches (writable)
const TWITCH_CHANNELS = process.env.TWITCH_CHANNELS_FILE || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const KEY = crypto.createHash('sha256').update(sessionSecret()).digest();
const SP_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SP_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SP_SCOPES = 'playlist-read-private playlist-read-collaborative user-read-currently-playing user-read-recently-played';
// Spotify only accepts https or a loopback IP as a redirect URI — never "localhost".
const SP_REDIRECT = process.env.SPOTIFY_REDIRECT_URI || `${PUBLIC_URL.replace('://localhost', '://127.0.0.1')}/api/spotify/callback`;
// Cookies are per host, so the whole login happens on the redirect URI's domain.
const SP_ORIGIN = new URL(SP_REDIRECT).origin;
const SP_API = 'https://api.spotify.com/v1';
const UA = 'Mozilla/5.0 (compatible; MyMind/1.0)';
const GH_ID = process.env.GITHUB_CLIENT_ID || '';
const GH_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
// `repo` is the only scope that lets an OAuth App see private repositories (it also allows writing to them).
const GH_SCOPES = 'repo';
const GH_REDIRECT = process.env.GITHUB_REDIRECT_URI || `${PUBLIC_URL}/api/github/callback`;
// GitHub allows one callback host and cookies are per host, so the whole login happens there.
const GH_ORIGIN = new URL(GH_REDIRECT).origin;
const YEAR = 365 * 86400;
// Long enough to sign in on a phone, switching apps for a password or a 2FA code.
const STATE_AGE = 30 * 60;

/* ---------------- config helpers ---------------- */

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = join(ROOT, 'data', '.secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  mkdirSync(dirname(file), { recursive: true });
  const s = crypto.randomBytes(32).toString('hex');
  writeFileSync(file, s, { mode: 0o600 });
  return s;
}

/* ---------------- http helpers ---------------- */

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob: https:; " +
    "style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; manifest-src 'self'; " +
    "connect-src 'self' https://api.openverse.org https://openlibrary.org https://api.open-meteo.com https://archive-api.open-meteo.com " +
    'https://geocoding-api.open-meteo.com https://nominatim.openstreetmap.org; ' +
    "worker-src 'self'; frame-src https://open.spotify.com; " +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};


function redirect(res, location, cookies = []) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', 'Set-Cookie': cookies });
  res.end();
}

function cookies(req) {
  const out = Object.create(null);
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
      catch { /* Ignore malformed cookies without breaking other valid sessions. */ }
    }
  }
  return out;
}

const cookie = (name, value, maxAge, path) =>
  `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`;

/** Queues a Set-Cookie, replacing one queued earlier for the same cookie (concurrent renewals in one request). */
function queueCookie(setCookies, value) {
  const name = value.slice(0, value.indexOf('=') + 1);
  const i = setCookies.findIndex((c) => c.startsWith(name));
  if (i >= 0) setCookies[i] = value;
  else setCookies.push(value);
}

/* ---------------- sealed session cookie (AES-256-GCM) ---------------- */

function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64url');
}

function unseal(str) {
  try {
    const buf = Buffer.from(str, 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

const accounts = createAccountStore({ file: process.env.ACCOUNTS_FILE || join(ROOT, 'data', 'accounts'), seal, unseal });

/* ---------------- OAuth ---------------- */

// Keep the deadline active until the response body has been consumed, not just its headers.
async function spotifyRequest(url, options = {}, format = 'json') {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new HttpError(504, 'Spotify took too long to respond. Try again.'));
      controller.abort();
    }, 15_000);
  });
  try {
    return await Promise.race([deadline, (async () => {
      const res = await fetch(url, { ...options, signal: controller.signal });
      let body;
      if (format === 'redirect' && res.headers.get('location')) {
        await res.body?.cancel();
        body = '';
      } else if (format === 'redirect') body = await res.text();
      else body = await res.json().catch((error) => {
        if (controller.signal.aborted) throw error;
        if (res.ok && res.status !== 204) throw new HttpError(502, 'Spotify returned an invalid response. Try again.');
        return {};
      });
      if (format === 'json' && (!body || typeof body !== 'object' || Array.isArray(body))) {
        if (res.ok) throw new HttpError(502, 'Spotify returned an invalid response. Try again.');
        body = {};
      }
      return { res, body };
    })()]);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'Could not reach Spotify. Try again.');
  } finally {
    clearTimeout(timer);
  }
}

async function tokenRequest(params, url, id, secret) {
  const { res, body } = await spotifyRequest(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new HttpError(body.error === 'invalid_grant' ? 401 : 502, body.message || body.error_description || `Token request failed (${res.status})`);
  if (typeof body.access_token !== 'string' || !body.access_token) throw new HttpError(502, 'Spotify returned an invalid session. Try again.');
  return body;
}

const toSession = (t, prevRefresh) => ({
  a: t.access_token,
  r: t.refresh_token || prevRefresh || null,
  e: Date.now() + (Number(t.expires_in) || 30 * 86400) * 1000 - 60_000,
  ...(t.scope ? { sc: t.scope } : {}),
});

const pendingRefreshes = new Map();
const MAX_PENDING_REFRESHES = 128;

/** Swaps a refresh token for a new session, sharing one exchange between concurrent requests. */
function renew(name, s, refresh) {
  const refreshKey = crypto.createHash('sha256').update(name + '\0' + s.r).digest('hex');
  let pending = pendingRefreshes.get(refreshKey);
  if (!pending) {
    if (pendingRefreshes.size >= MAX_PENDING_REFRESHES) throw new HttpError(503, 'Spotify is busy. Try again shortly.');
    pending = Promise.resolve().then(() => refresh({ grant_type: 'refresh_token', refresh_token: s.r }))
      .then((t) => ({ sc: s.sc, ...toSession(t, s.r), u: s.u }))
      .finally(() => pendingRefreshes.delete(refreshKey));
    pendingRefreshes.set(refreshKey, pending);
  }
  return pending;
}

/* ---------------- Spotify ---------------- */

const spConfigured = () => Boolean(SP_ID && SP_SECRET);
const spToken = (params) => tokenRequest(params, 'https://accounts.spotify.com/api/token', SP_ID, SP_SECRET);
const spCookie = (name, value, maxAge) => cookie(name, value, maxAge, '/api/spotify');

/** Makes `next` this browser's Spotify session, and the account's newest sign-in if nothing newer is saved. */
function keepSp(setCookies, own, next) {
  if (next !== own) queueCookie(setCookies, spCookie('mm_sp', seal(next), YEAR));
  if (next.u && !(accounts.get('spotify', next.u)?.e >= next.e)) accounts.set('spotify', next.u, next);
  return next;
}

/**
 * This browser's Spotify session, renewed when it has expired (or Spotify `refused` its access token), or null when signed out.
 * When this cookie's tokens are refused, the account's newest sign-in takes over: another device signed in,
 * or a renewal's new cookie never reached this browser (a phone put the page away mid-request).
 */
async function spSession(req, setCookies, refused) {
  const own = unseal(cookies(req).mm_sp || '');
  if (!own?.a) return null;
  const saved = accounts.get('spotify', own.u);
  const options = saved?.a && saved.a !== own.a ? [own, saved] : [own];
  const live = options.find((x) => x.e > Date.now() && x.a !== refused?.a);
  if (live) return keepSp(setCookies, own, live);
  let transient;
  for (const x of options) {
    if (!x.r || (x === saved && x.r === own.r)) continue;
    try {
      return keepSp(setCookies, own, await renew('mm_sp', x, spToken));
    } catch (error) {
      // A transient upstream failure must not look like a disconnected Spotify account.
      if (error instanceof HttpError && error.status >= 500) transient ??= error;
      else if (x === saved) accounts.forget('spotify', own.u, (v) => v.r === x.r);
    }
  }
  if (transient) throw transient;
  return null;
}
const SP_KINDS = new Set(['track', 'album', 'playlist', 'episode', 'show', 'artist']);
const SP_SHORT = /^(spotify\.link|spotify\.app\.link)$/;

async function spApi(s, path) {
  const { res, body } = await spotifyRequest(SP_API + path, { headers: { Authorization: `Bearer ${s.a}` } });
  if (res.status === 401) throw new HttpError(401, 'Your Spotify connection expired. Connect again in Settings.');
  if (res.status === 429)
    throw new HttpError(429, `Spotify asked us to slow down — try again in ${Number(res.headers.get('retry-after')) || 30} seconds.`);
  if (!res.ok) throw new HttpError(res.status === 403 || res.status === 404 ? res.status : 502, body.error?.message || `Spotify returned an error (${res.status})`);
  return body;
}

/** Spotify lists images largest first, sometimes without sizes; pick one around 300px. */
function pickImage(list) {
  if (!list?.length) return undefined;
  const sized = list.filter((i) => i.width).sort((a, b) => a.width - b.width);
  return (sized.find((i) => i.width >= 200) || sized[sized.length - 1] || list[0]).url;
}

const names = (artists) => artists?.map((a) => a.name).join(', ') || undefined;

function musicOut(t) {
  if (!t?.id || t.is_local || !SP_KINDS.has(t.type)) return null;
  const sub = { track: names(t.artists), album: names(t.artists), episode: t.show?.name, playlist: t.owner?.display_name, show: t.publisher }[t.type];
  return {
    kind: t.type,
    id: t.id,
    title: String(t.name || '').slice(0, 300),
    sub: sub ? String(sub).slice(0, 300) : undefined,
    image: pickImage(t.album?.images || t.images || t.show?.images),
    link: `https://open.spotify.com/${t.type}/${t.id}`,
  };
}

const playlistOut = (p) => ({ id: p.id, name: p.name, count: p.items?.total ?? p.tracks?.total ?? 0, cover: pickImage(p.images) });
const nextOffset = (b, max = Number.MAX_SAFE_INTEGER) => {
  if (!b?.next) return undefined;
  const current = b.offset || 0;
  const next = current + (b.limit || b.items?.length || 0);
  return Number.isSafeInteger(next) && next > current && next <= max ? next : undefined;
};

function sameState(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Turns a pasted Spotify link or URI into a music item. Uses the API when signed in, else the public oEmbed endpoint. */
async function resolveSpotify(raw, s) {
  raw = String(raw || '').trim();
  let m = raw.match(/^spotify:(track|album|playlist|episode|show|artist):([A-Za-z0-9]{10,40})$/);
  if (!m) {
    let u;
    try {
      u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
    } catch {
      throw new HttpError(400, 'That doesn’t look like a link.');
    }
    // Short links (spotify.link/…) redirect a couple of times; follow them, but only through Spotify hosts.
    for (let hop = 0; SP_SHORT.test(u.hostname); hop++) {
      if (hop > 4) throw new HttpError(400, 'Couldn’t follow that spotify.link link.');
      const { res: r, body } = await spotifyRequest(u.href, { redirect: 'manual', headers: { 'User-Agent': UA } }, 'redirect');
      const loc = r.headers.get('location') || body.match(/https:\/\/open\.spotify\.com\/[^"'\s<>\\]+/)?.[0];
      if (!loc) throw new HttpError(400, 'Couldn’t follow that spotify.link link.');
      try { u = new URL(loc, u); }
      catch { throw new HttpError(400, 'Couldn’t follow that spotify.link link.'); }
      if (!(SP_SHORT.test(u.hostname) || u.hostname === 'open.spotify.com')) throw new HttpError(400, 'That link doesn’t lead to Spotify.');
    }
    if (u.hostname !== 'open.spotify.com') throw new HttpError(400, 'Paste a link from open.spotify.com or spotify.link.');
    m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{10,40})/);
    if (!m) throw new HttpError(400, 'That isn’t a link to a song, album, playlist or podcast. In Spotify, use Share → Copy link.');
  }
  const [, kind, id] = m;
  if (s) {
    try {
      const item = musicOut(await spApi(s, `/${kind}s/${id}`));
      if (item) return item;
    } catch {}
  }
  const link = `https://open.spotify.com/${kind}/${id}`;
  const { res, body } = await spotifyRequest(`https://open.spotify.com/oembed?url=${encodeURIComponent(link)}`, { headers: { 'User-Agent': UA } });
  const o = res.ok ? body : null;
  if (!o?.title) throw new HttpError(404, 'Spotify didn’t return that — it may be private or unavailable.');
  return { kind, id, title: String(o.title).slice(0, 300), image: /^https:\/\//.test(o.thumbnail_url) ? o.thumbnail_url : undefined, link };
}

async function spotify(req, res, url, p, setCookies, out) {
  let current = null;
  const need = async () => {
    current ??= await spSession(req, setCookies);
    if (!current) throw new HttpError(401, 'Connect Spotify in Settings first.');
    return current;
  };
  // A refused access token gets one more try, renewed or swapped for the account's newest sign-in,
  // before this browser counts as signed out.
  const api = async (path) => {
    const s = await need();
    try {
      return await spApi(s, path);
    } catch (e) {
      if (e.status !== 401) throw e;
      current = await spSession(req, setCookies, s);
      if (!current) throw e;
      return spApi(current, path);
    }
  };
  // Spotify limits search and playlist listings differently; playlist items have no documented cap.
  // Reject out-of-range offsets instead of clamping them and repeating the previous page.
  const maxOffset = p === '/api/spotify/search' ? 1000 : p === '/api/spotify/playlists' ? 100_000 : Number.MAX_SAFE_INTEGER;
  const offset = Number(url.searchParams.get('offset') || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > maxOffset) throw new HttpError(400, 'Invalid Spotify page offset.');

  if (p === '/api/spotify/status') {
    const status = { configured: spConfigured(), connected: false, redirect: SP_REDIRECT };
    if (!spConfigured() || !cookies(req).mm_sp) return out(status);
    try {
      const u = await api('/me');
      Object.assign(status, { connected: true, user: { name: u.display_name || u.id, image: pickImage(u.images) } });
      // Signed in before accounts were remembered: note whose this is, so it can recover later.
      if (current && !current.u && typeof u.id === 'string') keepSp(setCookies, null, { ...current, u: u.id });
    } catch (e) {
      // Only a refusal signs this browser out; Spotify being slow or down is reported, and the sign-in kept.
      if (e.status === 401) queueCookie(setCookies, spCookie('mm_sp', '', 0));
      else Object.assign(status, { connected: true, error: e.message });
    }
    return out(status);
  }

  if (p === '/api/spotify/resolve') {
    // Links resolve without a sign-in too, so a Spotify hiccup only means using the public endpoint.
    const s = spConfigured() ? await spSession(req, setCookies).catch(() => null) : null;
    return out(await resolveSpotify(url.searchParams.get('url'), s));
  }

  if (p === '/api/spotify/connect') {
    if (!spConfigured()) throw new HttpError(400, 'Spotify isn’t configured on this server.');
    // Started from another domain (or the loopback address): move to the redirect URI's domain first, so the state cookie lands where Spotify returns.
    if (req.headers.host && `${SECURE ? 'https' : 'http'}://${req.headers.host}` !== SP_ORIGIN && SP_ORIGIN.startsWith('https://')) return redirect(res, `${SP_ORIGIN}/api/spotify/connect${url.search}`);
    const state = crypto.randomBytes(16).toString('hex');
    const back = url.searchParams.get('back') || '';
    const auth = new URL('https://accounts.spotify.com/authorize');
    auth.search = new URLSearchParams({ client_id: SP_ID, response_type: 'code', redirect_uri: SP_REDIRECT, scope: SP_SCOPES, state }).toString();
    return redirect(res, auth.href, [spCookie('mm_sstate', seal({ s: state, b: /^#\/[\w/-]*$/.test(back) ? back : '#/settings' }), STATE_AGE)]);
  }

  if (p === '/api/spotify/callback') {
    // Spotify may land here on a different address than the app's own (cookies are per host),
    // so the result is sealed and handed to /finish on the app's address, where the state cookie is checked.
    const done = { st: url.searchParams.get('state') || '', x: Date.now() + 120_000 };
    const code = url.searchParams.get('code');
    if (!code) done.err = url.searchParams.get('error') === 'access_denied' ? 'cancelled' : 'error';
    else {
      try {
        const t = toSession(await spToken({ grant_type: 'authorization_code', code, redirect_uri: SP_REDIRECT }));
        try {
          t.u = (await spApi(t, '/me')).id;
        } catch {}
        done.t = t;
      } catch (e) {
        console.error('Spotify token exchange failed:', e.message);
        done.err = 'error';
      }
    }
    return redirect(res, `${APP_URL}/api/spotify/finish?d=${seal(done)}`);
  }

  if (p === '/api/spotify/finish') {
    const d = unseal(url.searchParams.get('d') || '');
    const st = unseal(cookies(req).mm_sstate || '');
    const clear = spCookie('mm_sstate', '', 0);
    if (!d || !st || !(d.x > Date.now()) || !sameState(d.st, st.s)) return redirect(res, `${APP_URL}/#/settings?spotify=error`, [clear]);
    const back = `${APP_URL}/${st.b}${st.b.includes('?') ? '&' : '?'}spotify=`;
    if (!d.t) return redirect(res, back + d.err, [clear]);
    if (d.t.u) accounts.set('spotify', d.t.u, d.t);
    return redirect(res, back + 'connected', [clear, spCookie('mm_sp', seal(d.t), YEAR)]);
  }

  if (p === '/api/spotify/disconnect' && req.method === 'POST') {
    // Other devices keep their own sign-ins; this one's is forgotten if it's the one saved.
    const own = unseal(cookies(req).mm_sp || '');
    if (own?.u) accounts.forget('spotify', own.u, (v) => v.a === own.a || (own.r && v.r === own.r));
    res.writeHead(204, { 'Set-Cookie': spCookie('mm_sp', '', 0) });
    return res.end();
  }

  if (p === '/api/spotify/playlists') {
    const body = await api(`/me/playlists?limit=50&offset=${offset}`);
    const { u } = await need();
    // Spotify only lets apps read the songs of playlists you own or collaborate on, so only those are listed.
    const items = (body.items || []).filter((pl) => pl?.id && (pl.collaborative || !u || pl.owner?.id === u)).map(playlistOut);
    return out({ items, next: nextOffset(body, maxOffset) });
  }

  const pm = p.match(/^\/api\/spotify\/playlists\/([A-Za-z0-9]{10,40})\/items$/);
  if (pm) {
    const body = await api(`/playlists/${pm[1]}/items?limit=50&offset=${offset}&additional_types=track,episode`);
    return out({ items: (body.items || []).map((it) => musicOut(it?.item ?? it?.track)).filter(Boolean), next: nextOffset(body) });
  }

  if (p === '/api/spotify/now') {
    const s = await need();
    // Connected before listening history was asked for: Spotify needs a fresh sign-in to grant it.
    if (!/user-read-currently-playing/.test(s.sc || '') || !/user-read-recently-played/.test(s.sc || '')) return out({ reconnect: true, recent: [] });
    const [cur, rec] = await Promise.all([
      api('/me/player/currently-playing?additional_types=track,episode'),
      api('/me/player/recently-played?limit=30'),
    ]);
    const current = musicOut(cur?.item);
    const seen = new Set(current ? [current.id] : []);
    const recent = [];
    for (const it of rec.items || []) {
      const m = musicOut(it?.track);
      if (m && !seen.has(m.id)) seen.add(m.id), recent.push(m);
    }
    return out({ current: current || undefined, playing: !!(current && cur.is_playing), recent });
  }

  if (p === '/api/spotify/search') {
    const q = (url.searchParams.get('q') || '').trim().slice(0, 200);
    if (!q) return out({ items: [] });
    const body = await api(`/search?type=track&limit=10&offset=${offset}&q=${encodeURIComponent(q)}`);
    return out({ items: (body.tracks?.items || []).map(musicOut).filter(Boolean), next: nextOffset(body.tracks, maxOffset) });
  }

  throw new HttpError(404, 'Not found');
}

/* ---------------- GitHub ---------------- */

const ghConfigured = () => Boolean(GH_ID && GH_SECRET);
const ghCookie = (name, value, maxAge) => cookie(name, value, maxAge, '/api/github');

async function ghRequest(url, options = {}, text = false) {
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': UA, ...options.headers },
    });
    if (text) return { res, body: res.ok ? await res.text() : '' };
    const body = await res.json().catch(() => ({}));
    return { res, body: body && typeof body === 'object' ? body : {} };
  } catch (error) {
    throw new HttpError(error?.name === 'TimeoutError' ? 504 : 502, error?.name === 'TimeoutError' ? 'GitHub took too long to respond. Try again.' : 'Could not reach GitHub. Try again.');
  }
}

const repoCount = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : undefined);

/** Counts the account's own private repos by asking for one per page and reading the last page number. */
async function privateRepos(token) {
  const { res, body } = await ghRequest('https://api.github.com/user/repos?affiliation=owner&visibility=private&per_page=1', { headers: { Authorization: `Bearer ${token}` } })
    .catch(() => ({ res: { ok: false } }));
  if (!res.ok) return undefined;
  const last = (res.headers.get('link') || '').match(/[?&]page=(\d+)>;\s*rel="last"/);
  return last ? Number(last[1]) : Array.isArray(body) ? body.length : undefined;
}

/** This browser's GitHub sign-in ({ a: token, u: account id }), or null. */
const ghSession = (req) => {
  const s = ghConfigured() ? unseal(cookies(req).mm_gh || '') : null;
  return s?.a ? s : null;
};

/**
 * Asks GitHub for something of the signed-in account's. GitHub keeps only an account's ten newest tokens,
 * so signing in on other devices can revoke this browser's: then the account's newest token takes over,
 * and only if that's refused too is this browser signed out. Returns the session the answer came with.
 */
async function ghGet(s, path, setCookies, text = false) {
  if (!s) throw new HttpError(401, 'Log in with GitHub in Settings first.');
  const ask = (token) => ghRequest('https://api.github.com' + path, {
    headers: { Authorization: `Bearer ${token}`, ...(text ? { Accept: 'application/vnd.github.raw+json' } : {}) },
  }, text);
  let { res, body } = await ask(s.a);
  if (res.status === 401) {
    const saved = accounts.get('github', s.u);
    if (saved?.a && saved.a !== s.a) {
      ({ res, body } = await ask(saved.a));
      if (res.status !== 401) {
        s = { ...saved, u: s.u };
        queueCookie(setCookies, ghCookie('mm_gh', seal(s), YEAR));
      }
    }
    if (res.status === 401) {
      accounts.forget('github', s.u, (v) => v.a === s.a || v.a === saved?.a);
      queueCookie(setCookies, ghCookie('mm_gh', '', 0));
      throw new HttpError(401, 'Your GitHub connection expired. Log in again in Settings.');
    }
  }
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') throw new HttpError(429, 'GitHub asked us to slow down. Try again in a few minutes.');
  return { res, body, s };
}

const ghUrl = (v) => (typeof v === 'string' && v.startsWith('https://github.com/') ? v.slice(0, 500) : '');
const ghText = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

function repoOut(r) {
  if (!r || !Number.isSafeInteger(r.id) || typeof r.full_name !== 'string') return null;
  return {
    id: r.id,
    name: ghText(r.name, 100),
    owner: ghText(r.owner?.login, 60),
    description: ghText(r.description, 400),
    language: ghText(r.language, 40),
    private: r.private === true,
    fork: r.fork === true,
    archived: r.archived === true,
    stars: Number.isSafeInteger(r.stargazers_count) ? r.stargazers_count : 0,
    pushed: ghText(r.pushed_at, 40),
    branch: ghText(r.default_branch, 100) || 'main',
    url: ghUrl(r.html_url),
  };
}

function commitOut(c) {
  if (!c || typeof c.sha !== 'string') return null;
  return {
    sha: ghText(c.sha, 40),
    message: ghText(c.commit?.message, 4000),
    author: ghText(c.commit?.author?.name || c.author?.login, 120),
    date: ghText(c.commit?.author?.date || c.commit?.committer?.date, 40),
    url: ghUrl(c.html_url),
  };
}

async function githubRepos(req, p, url, setCookies, out) {
  // Requests made in parallel each recover on their own; later ones in this request use what the first settled on.
  let s = ghSession(req);
  const get = async (path, text) => {
    const answer = await ghGet(s, path, setCookies, text);
    s = answer.s;
    return answer;
  };

  if (p === '/api/github/repos') {
    // The repos you own, public and private, most recently pushed first (up to 1000).
    const items = [];
    for (let page = 1; page <= 10; page++) {
      const { res, body } = await get(`/user/repos?affiliation=owner&sort=pushed&per_page=100&page=${page}`);
      if (!res.ok || !Array.isArray(body)) throw new HttpError(502, 'GitHub didn’t answer. Try again.');
      items.push(...body.map(repoOut).filter(Boolean));
      if (body.length < 100) break;
    }
    return out({ items });
  }

  const m = p.match(/^\/api\/github\/repos\/(\d{1,15})(?:\/(commits|readme))?$/);
  if (!m) throw new HttpError(404, 'Not found');
  const [, id, what] = m;

  if (!what) {
    const { res, body } = await get(`/repositories/${id}`);
    if (res.status === 404) throw new HttpError(404, 'That repo isn’t available.');
    const repo = res.ok ? repoOut(body) : null;
    if (!repo) throw new HttpError(502, 'GitHub didn’t answer. Try again.');
    return out(repo);
  }

  if (what === 'commits') {
    const page = Number(url.searchParams.get('page') || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000) throw new HttpError(400, 'Invalid page.');
    const { res, body } = await get(`/repositories/${id}/commits?per_page=30&page=${page}`);
    // an empty repo has no commits to list (409), and one that's gone says 404
    if (res.status === 409) return out({ items: [] });
    if (res.status === 404) throw new HttpError(404, 'That repo isn’t available.');
    if (!res.ok || !Array.isArray(body)) throw new HttpError(502, 'GitHub didn’t answer. Try again.');
    return out({ items: body.map(commitOut).filter(Boolean), next: /rel="next"/.test(res.headers.get('link') || '') ? page + 1 : undefined });
  }

  const { res, body } = await get(`/repositories/${id}/readme`, true);
  if (res.status === 404) return out({ text: null });
  if (!res.ok) throw new HttpError(502, 'GitHub didn’t answer. Try again.');
  return out({ text: body.slice(0, 200_000) });
}

async function github(req, res, url, p, setCookies, out) {
  if (p === '/api/github/status') {
    const status = { configured: ghConfigured(), connected: false };
    let s = ghSession(req);
    if (!s) return out(status);
    let r, body;
    try {
      ({ res: r, body, s } = await ghGet(s, '/user', setCookies));
    } catch (e) {
      // Only a refusal signs this browser out; GitHub being slow or down is reported, and the sign-in kept.
      if (e.status === 401) return out(status);
      return out({ ...status, connected: true, error: e.message });
    }
    if (!r.ok || typeof body.login !== 'string') return out({ ...status, connected: true, error: 'GitHub didn’t answer. Try again.' });
    // Signed in before accounts were remembered: note whose this is, so it can recover later.
    if (!s.u && Number.isSafeInteger(body.id)) {
      s = { ...s, u: String(body.id) };
      queueCookie(setCookies, ghCookie('mm_gh', seal(s), YEAR));
    }
    if (s.u && !accounts.get('github', s.u)) accounts.set('github', s.u, { a: s.a });
    // Private repos are only readable with the `repo` scope; GitHub lists the scopes it granted in a header.
    const scopes = (r.headers.get('x-oauth-scopes') || '').split(',').map((x) => x.trim()).filter(Boolean);
    let priv;
    if (scopes.includes('repo')) {
      priv = repoCount(body.owned_private_repos);
      if (priv === undefined) priv = await privateRepos(s.a);
    } else console.log(`GitHub token has no repo scope (granted: ${scopes.join(', ') || 'none'})`);
    return out({
      ...status,
      connected: true,
      user: { name: body.login },
      public: repoCount(body.public_repos),
      private: priv,
      privateVisible: priv !== undefined,
    });
  }

  if (p === '/api/github/repos' || p.startsWith('/api/github/repos/')) return githubRepos(req, p, url, setCookies, out);

  if (p === '/api/github/connect') {
    if (!ghConfigured()) throw new HttpError(400, 'GitHub isn’t configured on this server.');
    // Started from the site's other domain: move to the callback's domain first, so the state cookie lands where GitHub returns.
    if (req.headers.host && `${SECURE ? 'https' : 'http'}://${req.headers.host}` !== GH_ORIGIN && GH_ORIGIN.startsWith('https://')) return redirect(res, `${GH_ORIGIN}/api/github/connect`);
    const state = crypto.randomBytes(16).toString('hex');
    const auth = new URL('https://github.com/login/oauth/authorize');
    auth.search = new URLSearchParams({ client_id: GH_ID, redirect_uri: GH_REDIRECT, scope: GH_SCOPES, state }).toString();
    return redirect(res, auth.href, [ghCookie('mm_gstate', seal({ s: state }), STATE_AGE)]);
  }

  if (p === '/api/github/callback') {
    const st = unseal(cookies(req).mm_gstate || '');
    const clear = ghCookie('mm_gstate', '', 0);
    const back = `${GH_ORIGIN}/#/settings?github=`;
    if (!st || !sameState(url.searchParams.get('state'), st.s)) return redirect(res, back + 'error', [clear]);
    const code = url.searchParams.get('code');
    if (!code) return redirect(res, back + (url.searchParams.get('error') === 'access_denied' ? 'cancelled' : 'error'), [clear]);
    try {
      const { body } = await ghRequest('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: GH_ID, client_secret: GH_SECRET, code, redirect_uri: GH_REDIRECT }),
      });
      if (typeof body.access_token !== 'string' || !body.access_token) throw new HttpError(502, body.error_description || 'GitHub returned no token.');
      const s = { a: body.access_token };
      try {
        const { res: r, body: user } = await ghRequest('https://api.github.com/user', { headers: { Authorization: `Bearer ${s.a}` } });
        if (r.ok && Number.isSafeInteger(user.id)) s.u = String(user.id);
      } catch {}
      // The newest sign-in is the one GitHub will keep longest, so other devices fall back on it.
      if (s.u) accounts.set('github', s.u, { a: s.a });
      return redirect(res, back + 'connected', [clear, ghCookie('mm_gh', seal(s), YEAR)]);
    } catch (e) {
      console.error('GitHub token exchange failed:', e.message);
      return redirect(res, back + 'error', [clear]);
    }
  }

  if (p === '/api/github/disconnect' && req.method === 'POST') {
    // Other devices keep their own sign-ins; this one's is forgotten if it's the one saved.
    const own = ghSession(req);
    if (own?.u) accounts.forget('github', own.u, (v) => v.a === own.a);
    res.writeHead(204, { 'Set-Cookie': ghCookie('mm_gh', '', 0) });
    return res.end();
  }

  throw new HttpError(404, 'Not found');
}

/* ---------------- admin ---------------- */

// ADMIN_PASSWORD unlocks the few things that change the server rather than the journal (the miner's channels).
// Signing in leaves a sealed cookie; changing the password signs every browser out.
const ADMIN_COOKIE = 'mm_admin';
const ADMIN_DAYS = 90;
const adminHash = ADMIN_PASSWORD && crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
const adminVersion = adminHash ? adminHash.toString('base64url').slice(0, 8) : '';
const attempts = new Map(); // client → { n, until }

function isAdmin(req) {
  if (!adminHash) return false;
  const s = unseal(cookies(req)[ADMIN_COOKIE] || '');
  return !!s && s.v === adminVersion && s.exp > Date.now();
}

// Caddy sets X-Forwarded-For to the visitor's address; the app is only reachable through it.
const clientOf = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

async function admin(req, res) {
  if (req.method === 'GET') return json(res, 200, { configured: !!adminHash, admin: isAdmin(req) });
  if (req.method === 'DELETE') return json(res, 200, { configured: !!adminHash, admin: false }, { 'Set-Cookie': cookie(ADMIN_COOKIE, '', 0, '/api') });
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  if (!adminHash) throw new HttpError(404, 'There’s no admin password on this server. Set ADMIN_PASSWORD in .env.');

  const who = clientOf(req), now = Date.now();
  const tries = attempts.get(who);
  if (tries && tries.until > now && tries.n >= 8) throw new HttpError(429, 'Too many tries. Wait a few minutes.');
  const { password } = await readJson(req, 1024);
  const given = crypto.createHash('sha256').update(String(password ?? '')).digest();
  if (!crypto.timingSafeEqual(given, adminHash)) {
    attempts.set(who, { n: tries && tries.until > now ? tries.n + 1 : 1, until: now + 15 * 60_000 });
    if (attempts.size > 1000) attempts.delete(attempts.keys().next().value);
    await new Promise((r) => setTimeout(r, 400));
    throw new HttpError(401, 'That’s not the password.');
  }
  attempts.delete(who);
  const value = seal({ v: adminVersion, exp: now + ADMIN_DAYS * 86_400_000 });
  return json(res, 200, { configured: true, admin: true }, { 'Set-Cookie': cookie(ADMIN_COOKIE, value, ADMIN_DAYS * 86_400, '/api') });
}

/* ---------------- sync ---------------- */

const sync = createSyncHandler({ directory: SYNC_DIR });
const share = createShareHandler({ directory: SHARE_DIR, indexFile: join(DIST, 'index.html'), isAdmin, adminConfigured: !!adminHash });
const twitch = createTwitchHandler({ directory: TWITCH_DIR, channelsFile: TWITCH_CHANNELS, isAdmin });

async function api(req, res, url) {
  const p = url.pathname.replace(/\/+$/, '');
  const setCookies = [];
  const out = (body) => json(res, 200, body, setCookies.length ? { 'Set-Cookie': setCookies } : {});

  try {
    if (p === '/api/health') return json(res, 200, { ok: true });
    if (p.startsWith('/api/spotify/')) return await spotify(req, res, url, p, setCookies, out);
    if (p.startsWith('/api/github/')) return await github(req, res, url, p, setCookies, out);
    if (p.startsWith('/api/sync/')) return await sync(req, res, p);
    if (p === '/api/admin') return await admin(req, res);
    if (p === '/api/share' || p.startsWith('/api/share/')) return await share.api(req, res, p);
    if (p === '/api/twitch' || p.startsWith('/api/twitch/')) return await twitch(req, res, p);
    throw new HttpError(404, 'Not found');
  } finally {
    // A refresh can rotate its token even when the following API call fails.
    if (setCookies.length && !res.headersSent) res.setHeader('Set-Cookie', setCookies);
  }
}

/* ---------------- static files ---------------- */

const serveStatic = createStaticHandler(DIST);

/* ---------------- server ---------------- */

const server = http.createServer(async (req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    try {
      let url;
      try {
        url = new URL(req.url || '/', 'http://localhost');
      } catch {
        throw new HttpError(400, 'Bad request URL');
      }
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
      if (url.pathname.startsWith('/s/')) return await share.page(req, res, url.pathname);
      return await serveStatic(req, res, url.pathname);
    } catch (e) {
      if (req.aborted || res.destroyed) return;
      if (e.code === 'ERR_STREAM_PREMATURE_CLOSE' || e.code === 'ECONNRESET') return res.destroy();
      if (!(e instanceof HttpError)) console.error(e);
      if (res.headersSent) return res.destroy();
      json(res, e instanceof HttpError ? e.status : 500, { error: e instanceof HttpError ? e.message : 'Something went wrong on the server.' });
    }
  });
server.listen(PORT, () => {
    console.log(`My Mind → ${PUBLIC_URL}  (listening on :${PORT})`);
    console.log(ghConfigured() ? `GitHub: configured · callback URL ${GH_REDIRECT}` : 'GitHub: login off (set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET in .env)');
    console.log(spConfigured() ? `Spotify: configured · redirect URI ${SP_REDIRECT}` : 'Spotify: links only (set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env to search and browse playlists)');
  });

// Let in-flight uploads finish during deployment, within Docker's default stop grace period.
if (typeof server.close === 'function') {
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const timer = setTimeout(() => {
      server.closeAllConnections();
      process.exit(0);
    }, 8_000);
    timer.unref();
    server.close(() => {
      clearTimeout(timer);
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
