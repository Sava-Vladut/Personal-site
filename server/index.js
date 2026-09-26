// My Mind — tiny server, no dependencies.
//  • serves the built app from dist/ (compressed, cached, with security headers)
//  • Pinterest: resolves pasted pin links (no key needed) and, when an app key is configured,
//    runs the OAuth flow from pinterest/api-quickstart and proxies board/pin listing.
//  • Spotify: resolves pasted song/album/playlist links (no key needed) and, when a client id is
//    configured, runs the authorization-code flow and proxies search and playlist listing.
//    Access tokens live in encrypted http-only cookies — per browser, never in JS, never on disk.
import http from 'node:http';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(join(ROOT, '.env'));

const PORT = Number(process.env.PORT) || 8085;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const APP_URL = (process.env.APP_URL || PUBLIC_URL).replace(/\/+$/, ''); // where to land after connecting
const APP_ID = process.env.PINTEREST_APP_ID || '';
const APP_SECRET = process.env.PINTEREST_APP_SECRET || '';
const SCOPES = process.env.PINTEREST_SCOPES || 'boards:read,pins:read,user_accounts:read';
const REDIRECT_URI = `${PUBLIC_URL}/api/pinterest/callback`;
const SECURE = PUBLIC_URL.startsWith('https://');
const DIST = join(ROOT, 'dist');
const KEY = crypto.createHash('sha256').update(sessionSecret()).digest();
const API = 'https://api.pinterest.com';
const SP_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SP_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SP_SCOPES = 'playlist-read-private playlist-read-collaborative';
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
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob: https://i.pinimg.com https://*.scdn.co https://*.spotifycdn.com; " +
    "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://i.pinimg.com; font-src 'self'; manifest-src 'self'; " +
    "worker-src 'self'; frame-src https://open.spotify.com; " +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

function redirect(res, location, cookies = []) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', 'Set-Cookie': cookies });
  res.end();
}

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const cookie = (name, value, maxAge, path = '/api/pinterest') =>
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

/* ---------------- Pinterest ---------------- */

const configured = () => Boolean(APP_ID && APP_SECRET);

async function tokenRequest(params, url = `${API}/v5/oauth/token`, id = APP_ID, secret = APP_SECRET) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, body.message || body.error_description || `Token request failed (${res.status})`);
  return body;
}

const toSession = (t, prevRefresh) => ({
  a: t.access_token,
  r: t.refresh_token || prevRefresh || null,
  e: Date.now() + (Number(t.expires_in) || 30 * 86400) * 1000 - 60_000,
});

/** Returns a valid session (refreshing it if expired) or null. May queue a Set-Cookie. */
async function session(req, setCookies, name = 'mm_pin', path = '/api/pinterest', refresh = tokenRequest) {
  const s = unseal(cookies(req)[name] || '');
  if (!s?.a) return null;
  if (s.e > Date.now()) return s;
  if (!s.r) return null;
  try {
    const next = { ...toSession(await refresh({ grant_type: 'refresh_token', refresh_token: s.r }), s.r), u: s.u };
    setCookies.push(cookie(name, seal(next), 365 * 86400, path));
    return next;
  } catch {
    return null;
  }
}

async function pinApi(s, path) {
  const res = await fetch(API + path, { headers: { Authorization: `Bearer ${s.a}` } });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) throw new HttpError(401, 'Your Pinterest connection expired. Connect again in Settings.');
  if (!res.ok) throw new HttpError(502, body.message || `Pinterest returned an error (${res.status})`);
  return body;
}

function pinOut(p) {
  const imgs = p.media?.images || {};
  const big = imgs['1200x'] || imgs['600x'];
  const mid = imgs['600x'] || big;
  const link = `https://www.pinterest.com/pin/${p.id}/`;
  const title = (p.title || p.description || '').slice(0, 200) || undefined;
  if (!big) {
    const cover = p.media?.cover_image_url || imgs['400x300']?.url || imgs['150x150']?.url;
    return cover ? { id: p.id, url: cover, thumb: cover, link, title } : null;
  }
  return { id: p.id, url: big.url, thumb: mid.url, w: mid.width, h: mid.height, link, title };
}

const boardOut = (b) => ({
  id: b.id,
  name: b.name,
  count: b.pin_count ?? 0,
  cover: b.media?.image_cover_url || b.media?.pin_thumbnail_urls?.[0],
});

const page = (body, map) => ({ items: (body.items || []).map(map).filter(Boolean), bookmark: body.bookmark || undefined });

const PIN_HOST = /^([a-z]{2}\.|www\.)?pinterest\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$/;

/** Turns any pasted Pinterest link into an image, using the public oEmbed endpoint (no key needed). */
async function resolvePin(raw) {
  raw = String(raw || '').trim();
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
  } catch {
    throw new HttpError(400, 'That doesn’t look like a link.');
  }
  if (u.hostname === 'i.pinimg.com') return { url: u.href.replace(/^http:/, 'https:') };

  // Short links (pin.it/…) redirect a couple of times; follow them, but only through Pinterest hosts.
  for (let hop = 0; u.hostname === 'pin.it' || u.hostname === 'api.pinterest.com'; hop++) {
    if (hop > 4) throw new HttpError(400, 'Couldn’t follow that pin.it link.');
    const r = await fetch(u.href, { redirect: 'manual', headers: { 'User-Agent': UA } });
    const loc = r.headers.get('location');
    if (!loc) throw new HttpError(400, 'Couldn’t follow that pin.it link.');
    u = new URL(loc, u);
    if (!(u.hostname === 'pin.it' || u.hostname === 'api.pinterest.com' || PIN_HOST.test(u.hostname)))
      throw new HttpError(400, 'That link doesn’t lead to Pinterest.');
  }
  if (!PIN_HOST.test(u.hostname)) throw new HttpError(400, 'Paste a link from pinterest.com or pin.it.');
  const id = u.pathname.match(/\/pin\/(?:[^/]*--)?(\d+)/)?.[1];
  if (!id) throw new HttpError(400, 'That isn’t a link to a single pin. Open the pin, then copy its link.');

  const link = `https://www.pinterest.com/pin/${id}/`;
  const res = await fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(link)}`, { headers: { 'User-Agent': UA } });
  const o = res.ok ? await res.json().catch(() => null) : null;
  if (!o?.thumbnail_url) throw new HttpError(404, 'Pinterest didn’t return that pin — it may be private or deleted.');
  const w = Number(o.thumbnail_width) || 0, h = Number(o.thumbnail_height) || 0;
  return {
    url: o.thumbnail_url.replace(/\/\d+x\//, '/736x/'),
    w: w ? 736 : undefined,
    h: w ? Math.round((h / w) * 736) : undefined,
    link,
    title: o.title || undefined,
  };
}

/* ---------------- Spotify ---------------- */

const spConfigured = () => Boolean(SP_ID && SP_SECRET);
const spToken = (params) => tokenRequest(params, 'https://accounts.spotify.com/api/token', SP_ID, SP_SECRET);
const spSession = (req, setCookies) => session(req, setCookies, 'mm_sp', '/api/spotify', spToken);
const spCookie = (name, value, maxAge) => cookie(name, value, maxAge, '/api/spotify');
const SP_KINDS = new Set(['track', 'album', 'playlist', 'episode', 'show', 'artist']);
const SP_SHORT = /^(spotify\.link|spotify\.app\.link)$/;

async function spApi(s, path) {
  const res = await fetch(SP_API + path, { headers: { Authorization: `Bearer ${s.a}` } });
  const body = await res.json().catch(() => ({}));
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
const nextOffset = (b) => (b?.next ? (b.offset || 0) + (b.limit || b.items?.length || 0) : undefined);

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
      const r = await fetch(u.href, { redirect: 'manual', headers: { 'User-Agent': UA } });
      const loc = r.headers.get('location') || (await r.text().catch(() => '')).match(/https:\/\/open\.spotify\.com\/[^"'\s<>\\]+/)?.[0];
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
  const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(link)}`, { headers: { 'User-Agent': UA } });
  const o = res.ok ? await res.json().catch(() => null) : null;
  if (!o?.title) throw new HttpError(404, 'Spotify didn’t return that — it may be private or unavailable.');
  return { kind, id, title: String(o.title).slice(0, 300), image: /^https:\/\//.test(o.thumbnail_url) ? o.thumbnail_url : undefined, link };
}

async function spotify(req, res, url, p, setCookies, out) {
  const need = async () => {
    const s = await spSession(req, setCookies);
    if (!s) throw new HttpError(401, 'Connect Spotify in Settings first.');
    return s;
  };
  const offset = Math.max(0, Math.min(1000, parseInt(url.searchParams.get('offset') || '', 10) || 0));

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
    return out({ items, next: nextOffset(body) });
  }

  const pm = p.match(/^\/api\/spotify\/playlists\/([A-Za-z0-9]{10,40})\/items$/);
  if (pm) {
    const body = await spApi(await need(), `/playlists/${pm[1]}/items?limit=50&offset=${offset}&additional_types=track,episode`);
    return out({ items: (body.items || []).map((it) => musicOut(it?.item ?? it?.track)).filter(Boolean), next: nextOffset(body) });
  }

  if (p === '/api/spotify/search') {
    const q = (url.searchParams.get('q') || '').trim().slice(0, 200);
    if (!q) return out({ items: [] });
    const body = await spApi(await need(), `/search?type=track&limit=10&offset=${offset}&q=${encodeURIComponent(q)}`);
    return out({ items: (body.tracks?.items || []).map(musicOut).filter(Boolean), next: nextOffset(body.tracks) });
  }

  throw new HttpError(404, 'Not found');
}

async function api(req, res, url) {
  const p = url.pathname.replace(/\/+$/, '');
  const setCookies = [];
  const need = async () => {
    const s = await session(req, setCookies);
    if (!s) throw new HttpError(401, 'Connect Pinterest in Settings first.');
    return s;
  };
  const bm = url.searchParams.get('bookmark');
  const q = (path) => `${path}?page_size=50${bm ? `&bookmark=${encodeURIComponent(bm)}` : ''}`;
  const out = (body) => json(res, 200, body, setCookies.length ? { 'Set-Cookie': setCookies } : {});

  if (p === '/api/health') return json(res, 200, { ok: true });
  if (p.startsWith('/api/spotify/')) return spotify(req, res, url, p, setCookies, out);

  if (p === '/api/pinterest/status') {
    const status = { configured: configured(), connected: false, redirect: REDIRECT_URI };
    const s = configured() ? await session(req, setCookies) : null;
    if (s) {
      try {
        const u = await pinApi(s, '/v5/user_account');
        Object.assign(status, { connected: true, user: { username: u.username, image: u.profile_image } });
      } catch (e) {
        if (e.status === 401) setCookies.push(cookie('mm_pin', '', 0));
        else status.connected = true;
      }
    }
    return out(status);
  }

  if (p === '/api/pinterest/resolve') return out(await resolvePin(url.searchParams.get('url')));

  if (p === '/api/pinterest/connect') {
    if (!configured()) throw new HttpError(400, 'Pinterest isn’t configured on this server.');
    const state = crypto.randomBytes(16).toString('hex');
    const auth = new URL('https://www.pinterest.com/oauth/');
    auth.search = new URLSearchParams({ client_id: APP_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: SCOPES, state }).toString();
    return redirect(res, auth.href, [cookie('mm_state', state, 600)]);
  }

  if (p === '/api/pinterest/callback') {
    const clear = cookie('mm_state', '', 0);
    const expected = Buffer.from(cookies(req).mm_state || '');
    const got = Buffer.from(url.searchParams.get('state') || '');
    const code = url.searchParams.get('code');
    if (!code || !expected.length || expected.length !== got.length || !crypto.timingSafeEqual(expected, got))
      return redirect(res, `${APP_URL}/#/settings?pinterest=error`, [clear]);
    try {
      const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI });
      return redirect(res, `${APP_URL}/#/settings?pinterest=connected`, [clear, cookie('mm_pin', seal(toSession(t)), 365 * 86400)]);
    } catch (e) {
      console.error('Pinterest token exchange failed:', e.message);
      return redirect(res, `${APP_URL}/#/settings?pinterest=error`, [clear]);
    }
  }

  if (p === '/api/pinterest/disconnect' && req.method === 'POST') {
    res.writeHead(204, { 'Set-Cookie': cookie('mm_pin', '', 0) });
    return res.end();
  }

  if (p === '/api/pinterest/boards') return out(page(await pinApi(await need(), q('/v5/boards')), boardOut));
  if (p === '/api/pinterest/pins') return out(page(await pinApi(await need(), q('/v5/pins')), pinOut));
  const m = p.match(/^\/api\/pinterest\/boards\/(\d+)\/pins$/);
  if (m) return out(page(await pinApi(await need(), q(`/v5/boards/${m[1]}/pins`)), pinOut));

  throw new HttpError(404, 'Not found');
}

/* ---------------- static files ---------------- */

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt']);
const cache = new Map();

function load(file) {
  const mtime = statSync(file).mtimeMs;
  const hit = cache.get(file);
  if (hit && hit.mtime === mtime) return hit;
  const raw = readFileSync(file);
  const entry = { mtime, raw, etag: '"' + crypto.createHash('sha1').update(raw).digest('base64url').slice(0, 16) + '"' };
  if (COMPRESSIBLE.has(extname(file)) && raw.length > 1024) {
    entry.br = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 10 } });
    entry.gz = zlib.gzipSync(raw, { level: 9 });
  }
  cache.set(file, entry);
  return entry;
}

function serveStatic(req, res, pathname) {
  if (!existsSync(join(DIST, 'index.html')))
    return json(res, 503, { error: 'App not built yet. Run "npm run build" (or use "npm run dev" while developing).' });
  let file;
  try {
    file = normalize(join(DIST, decodeURIComponent(pathname)));
  } catch {
    return json(res, 400, { error: 'Bad path' });
  }
  if (file !== DIST && !file.startsWith(DIST + sep)) return json(res, 404, { error: 'Not found' });
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (extname(pathname)) return json(res, 404, { error: 'Not found' });
    file = join(DIST, 'index.html'); // app routes live in the hash, so any other path gets the app
  }
  const f = load(file);
  const immutable = pathname.startsWith('/assets/');
  const headers = {
    'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    ETag: f.etag,
    Vary: 'Accept-Encoding',
  };
  if (!immutable && req.headers['if-none-match'] === f.etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  const accept = String(req.headers['accept-encoding'] || '');
  let body = f.raw;
  if (f.br && /\bbr\b/.test(accept)) (body = f.br), (headers['Content-Encoding'] = 'br');
  else if (f.gz && /\bgzip\b/.test(accept)) (body = f.gz), (headers['Content-Encoding'] = 'gzip');
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

/* ---------------- server ---------------- */

http
  .createServer(async (req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    const url = new URL(req.url || '/', 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
      return serveStatic(req, res, url.pathname);
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      if (!res.headersSent) json(res, e instanceof HttpError ? e.status : 500, { error: e instanceof HttpError ? e.message : 'Something went wrong on the server.' });
    }
  })
  .listen(PORT, () => {
    console.log(`My Mind → ${PUBLIC_URL}  (listening on :${PORT})`);
    console.log(configured() ? `Pinterest: configured · redirect URI ${REDIRECT_URI}` : 'Pinterest: pin links only (set PINTEREST_APP_ID / PINTEREST_APP_SECRET in .env to browse boards)');
    console.log(spConfigured() ? `Spotify: configured · redirect URI ${SP_REDIRECT}` : 'Spotify: links only (set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env to search and browse playlists)');
  });
