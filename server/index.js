// My Mind — tiny server, no dependencies.
//  • serves the built app from dist/ (compressed, cached, with security headers)
//  • Spotify: resolves pasted song/album/playlist links (no key needed) and, when a client id is
//    configured, runs the authorization-code flow and proxies search and playlist listing.
//    Access tokens live in encrypted http-only cookies — per browser, never in JS, never on disk.
//  • sync: keeps an end-to-end encrypted copy of the journal, found by an id the browser derives from its sync code.
//    The server only ever sees ciphertext; the code (and so the key) never leaves the devices.
import http from 'node:http';
import crypto from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError } from './http-error.js';
import { createSyncHandler } from './sync.js';
import { createStaticHandler } from './static.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(join(ROOT, '.env'));

const PORT = Number(process.env.PORT) || 8085;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const APP_URL = (process.env.APP_URL || PUBLIC_URL).replace(/\/+$/, ''); // where to land after connecting
const SECURE = PUBLIC_URL.startsWith('https://');
const DIST = join(ROOT, 'dist');
const SYNC_DIR = join(ROOT, 'data', 'sync');
const KEY = crypto.createHash('sha256').update(sessionSecret()).digest();
const SP_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SP_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SP_SCOPES = 'playlist-read-private playlist-read-collaborative user-read-currently-playing user-read-recently-played';
// Spotify only accepts https or a loopback IP as a redirect URI — never "localhost".
const SP_REDIRECT = process.env.SPOTIFY_REDIRECT_URI || `${PUBLIC_URL.replace('://localhost', '://127.0.0.1')}/api/spotify/callback`;
const SP_API = 'https://api.spotify.com/v1';
const UA = 'Mozilla/5.0 (compatible; MyMind/1.0)';

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


function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

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
        return {};
      });
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

/** Returns a valid session (refreshing it if expired) or null. May queue a Set-Cookie. */
async function session(req, setCookies, name, path, refresh) {
  const s = unseal(cookies(req)[name] || '');
  if (!s?.a) return null;
  if (s.e > Date.now()) return s;
  if (!s.r) return null;
  try {
    const refreshKey = crypto.createHash('sha256').update(name + '\0' + s.r).digest('hex');
    let pending = pendingRefreshes.get(refreshKey);
    if (!pending) {
      if (pendingRefreshes.size >= MAX_PENDING_REFRESHES) throw new HttpError(503, 'Spotify is busy. Try again shortly.');
      pending = Promise.resolve().then(() => refresh({ grant_type: 'refresh_token', refresh_token: s.r }))
        .finally(() => pendingRefreshes.delete(refreshKey));
      pendingRefreshes.set(refreshKey, pending);
    }
    const next = { sc: s.sc, ...toSession(await pending, s.r), u: s.u };
    setCookies.push(cookie(name, seal(next), 365 * 86400, path));
    return next;
  } catch (error) {
    // A transient upstream failure must not look like a disconnected Spotify account.
    if (error instanceof HttpError && error.status >= 500) throw error;
    return null;
  }
}

/* ---------------- Spotify ---------------- */

const spConfigured = () => Boolean(SP_ID && SP_SECRET);
const spToken = (params) => tokenRequest(params, 'https://accounts.spotify.com/api/token', SP_ID, SP_SECRET);
const spSession = (req, setCookies) => session(req, setCookies, 'mm_sp', '/api/spotify', spToken);
const spCookie = (name, value, maxAge) => cookie(name, value, maxAge, '/api/spotify');
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
      u = new URL(loc, u);
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
  const need = async () => {
    const s = await spSession(req, setCookies);
    if (!s) throw new HttpError(401, 'Connect Spotify in Settings first.');
    return s;
  };
  // Spotify limits search and playlist listings differently; playlist items have no documented cap.
  // Reject out-of-range offsets instead of clamping them and repeating the previous page.
  const maxOffset = p === '/api/spotify/search' ? 1000 : p === '/api/spotify/playlists' ? 100_000 : Number.MAX_SAFE_INTEGER;
  const offset = Number(url.searchParams.get('offset') || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > maxOffset) throw new HttpError(400, 'Invalid Spotify page offset.');

  if (p === '/api/spotify/status') {
    const status = { configured: spConfigured(), connected: false, redirect: SP_REDIRECT };
    const s = spConfigured() ? await spSession(req, setCookies) : null;
    if (s) {
      try {
        const u = await spApi(s, '/me');
        Object.assign(status, { connected: true, user: { name: u.display_name || u.id, image: pickImage(u.images) } });
      } catch (e) {
        if (e.status === 401) setCookies.push(spCookie('mm_sp', '', 0));
        else Object.assign(status, { connected: true, error: e.message });
      }
    }
    return out(status);
  }

  if (p === '/api/spotify/resolve') {
    const s = spConfigured() ? await spSession(req, setCookies) : null;
    return out(await resolveSpotify(url.searchParams.get('url'), s));
  }

  if (p === '/api/spotify/connect') {
    if (!spConfigured()) throw new HttpError(400, 'Spotify isn’t configured on this server.');
    const state = crypto.randomBytes(16).toString('hex');
    const back = url.searchParams.get('back') || '';
    const auth = new URL('https://accounts.spotify.com/authorize');
    auth.search = new URLSearchParams({ client_id: SP_ID, response_type: 'code', redirect_uri: SP_REDIRECT, scope: SP_SCOPES, state }).toString();
    return redirect(res, auth.href, [spCookie('mm_sstate', seal({ s: state, b: /^#\/[\w/-]*$/.test(back) ? back : '#/settings' }), 600)]);
  }

  if (p === '/api/spotify/callback') {
    // Spotify lands here on 127.0.0.1, which may not be the address the app runs on (cookies are per host),
    // so the result is sealed and handed to /finish on the app's own address, where the state cookie is checked.
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
    return redirect(res, back + 'connected', [clear, spCookie('mm_sp', seal(d.t), 365 * 86400)]);
  }

  if (p === '/api/spotify/disconnect' && req.method === 'POST') {
    res.writeHead(204, { 'Set-Cookie': spCookie('mm_sp', '', 0) });
    return res.end();
  }

  if (p === '/api/spotify/playlists') {
    const s = await need();
    const body = await spApi(s, `/me/playlists?limit=50&offset=${offset}`);
    // Spotify only lets apps read the songs of playlists you own or collaborate on, so only those are listed.
    const items = (body.items || []).filter((pl) => pl?.id && (pl.collaborative || !s.u || pl.owner?.id === s.u)).map(playlistOut);
    return out({ items, next: nextOffset(body, maxOffset) });
  }

  const pm = p.match(/^\/api\/spotify\/playlists\/([A-Za-z0-9]{10,40})\/items$/);
  if (pm) {
    const body = await spApi(await need(), `/playlists/${pm[1]}/items?limit=50&offset=${offset}&additional_types=track,episode`);
    return out({ items: (body.items || []).map((it) => musicOut(it?.item ?? it?.track)).filter(Boolean), next: nextOffset(body) });
  }

  if (p === '/api/spotify/now') {
    const s = await need();
    // Connected before listening history was asked for: Spotify needs a fresh sign-in to grant it.
    if (!/user-read-currently-playing/.test(s.sc || '') || !/user-read-recently-played/.test(s.sc || '')) return out({ reconnect: true, recent: [] });
    const [cur, rec] = await Promise.all([
      spApi(s, '/me/player/currently-playing?additional_types=track,episode'),
      spApi(s, '/me/player/recently-played?limit=30'),
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
    const body = await spApi(await need(), `/search?type=track&limit=10&offset=${offset}&q=${encodeURIComponent(q)}`);
    return out({ items: (body.tracks?.items || []).map(musicOut).filter(Boolean), next: nextOffset(body.tracks, maxOffset) });
  }

  throw new HttpError(404, 'Not found');
}

/* ---------------- sync ---------------- */

const sync = createSyncHandler({ directory: SYNC_DIR });

async function api(req, res, url) {
  const p = url.pathname.replace(/\/+$/, '');
  const setCookies = [];
  const out = (body) => json(res, 200, body, setCookies.length ? { 'Set-Cookie': setCookies } : {});

  try {
    if (p === '/api/health') return json(res, 200, { ok: true });
    if (p.startsWith('/api/spotify/')) return await spotify(req, res, url, p, setCookies, out);
    if (p.startsWith('/api/sync/')) return await sync(req, res, p);
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
      return await serveStatic(req, res, url.pathname);
    } catch (e) {
      if (req.aborted || res.destroyed) return;
      if (e.code === 'ERR_STREAM_PREMATURE_CLOSE' || e.code === 'ECONNRESET') return res.destroy();
      if (!(e instanceof HttpError)) console.error(e);
      if (res.headersSent) return res.destroy();
      if (!res.headersSent) json(res, e instanceof HttpError ? e.status : 500, { error: e instanceof HttpError ? e.message : 'Something went wrong on the server.' });
    }
  });
server.listen(PORT, () => {
    console.log(`My Mind → ${PUBLIC_URL}  (listening on :${PORT})`);
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
