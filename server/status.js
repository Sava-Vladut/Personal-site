// The public status: one link that always shows your latest check-in, for anyone who has it. While it's on, the app sends
// that check-in's feeling, how strong it was and when; its note, the people you were thinking of (by name), the place's
// name and the weather only if you chose to show each, and the app's countdown (src/lib/countdown.ts) beside it if chosen.
// Nothing else leaves the journal. Turning it on, updating and
// stopping need the admin password; reading needs only the link.
//   data/status/status.json   { token, show, owner, lang, checkin, updated }: the link's secret, what shows, your name, the page's
//                             language ('en', 'ro', or '' for the reader's own), the check-in
// The token is 192 random bits, so the link can't be guessed. Stopping deletes the file, and turning it on again makes a new link.
import crypto from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError } from './http-error.js';
import { readJson } from './http-request.js';
import { json } from './http-response.js';
import { EMOTION_ID, cleanDetails, escapeHtml } from './share.js';

const TOKEN = /^[A-Za-z0-9_-]{32}$/;
const ENTRY_ID = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_NOTE = 2000;
const SHOW = ['note', 'people', 'place', 'weather', 'countdown'];
const NO_INDEX = { 'X-Robots-Tag': 'noindex, nofollow, noarchive' };

/** Which details the page shows: each off unless it's exactly true. An older status file only knew about the note. */
export function cleanShow(raw) {
  const out = {};
  for (const k of SHOW) out[k] = raw?.[k] === true;
  return out;
}

/** The name shown above the status ("Sava"), or ''. */
export const cleanOwner = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 40) : '');

/** The language the page is in for everyone ('en' or 'ro'), or '' to leave it to each reader's device. */
export const cleanLang = (v) => (v === 'en' || v === 'ro' ? v : '');

/** A check-in as the public page may show it: only these fields, and each detail only when `show` allows it. */
export function cleanCheckin(raw, show) {
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'That check-in can’t be shared.');
  const { id, emotion, intensity, time } = raw;
  if (typeof id !== 'string' || !ENTRY_ID.test(id)) throw new HttpError(400, 'That check-in can’t be shared.');
  if (typeof emotion !== 'string' || emotion.length > 80 || !EMOTION_ID.test(emotion)) throw new HttpError(400, 'That check-in can’t be shared.');
  if (typeof time !== 'number' || !Number.isFinite(time) || time <= 0 || time > Date.now() + 86_400_000) throw new HttpError(400, 'That check-in can’t be shared.');
  const out = {
    id,
    emotion,
    name: typeof raw.name === 'string' ? raw.name.trim().slice(0, 80) : '',
    intensity: Number.isInteger(intensity) && intensity >= 1 && intensity <= 5 ? intensity : 3,
    time: Math.round(time),
  };
  const text = show.note && typeof raw.text === 'string' ? raw.text.trim().slice(0, MAX_NOTE) : '';
  if (text) out.text = text;
  const all = cleanDetails(raw.details) || {};
  const details = {};
  if (show.people && all.people) details.people = all.people.slice(0, 12);
  if (show.place && all.place) details.place = all.place;
  if (show.weather && all.weather) details.weather = all.weather;
  if (Object.keys(details).length) out.details = details;
  return out;
}

/** What anyone with the link gets: never the entry's id. The countdown's dates are the app's own, so only whether it shows. */
const publicOf = (s) => ({ owner: s.owner || '', checkin: s.checkin && (({ id, ...rest }) => rest)(s.checkin), updated: s.updated, ...(s.show.countdown && { countdown: true }) });

export function createStatusHandler({ directory, indexFile, isAdmin, adminConfigured }) {
  const file = join(directory, 'status.json');
  let queue = Promise.resolve();
  let shell = null; // index.html, re-read when the build changes

  /** One change at a time, so two devices updating together can't interleave. */
  const locked = (work) => {
    const current = queue.catch(() => {}).then(work);
    queue = current;
    return current;
  };

  async function read() {
    try {
      const s = JSON.parse(await readFile(file, 'utf8'));
      if (!s || !TOKEN.test(s.token)) return null;
      return { ...s, show: cleanShow(s.show ?? { note: s.note }), owner: cleanOwner(s.owner), lang: cleanLang(s.lang) };
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return null;
      throw error;
    }
  }

  async function write(s) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(file + '.tmp', JSON.stringify(s), { mode: 0o600 });
    await rename(file + '.tmp', file);
  }

  function needAdmin(req) {
    if (!adminConfigured) throw new HttpError(403, 'Sharing is off: this server has no admin password. Set ADMIN_PASSWORD in .env.');
    if (!isAdmin(req)) throw new HttpError(401, 'Sign in with the admin password to share your status.');
  }

  const own = (s) => (s ? { token: s.token, show: s.show, owner: s.owner, lang: s.lang, checkin: s.checkin, updated: s.updated } : { token: null });

  /** The /api/status routes. Reading /api/status/<token> is public; everything else is the admin's. */
  async function api(req, res, path) {
    const m = path.match(/^\/api\/status(?:\/([^/]+))?$/);
    if (!m) throw new HttpError(404, 'Not found');
    const [, token] = m;

    if (token) {
      if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
      const s = TOKEN.test(token) ? await read() : null;
      // compared in constant time, so the answer's timing says nothing about the secret
      if (!s || !crypto.timingSafeEqual(Buffer.from(s.token), Buffer.from(token))) throw new HttpError(404, 'This status isn’t shared.');
      return json(res, 200, publicOf(s), NO_INDEX);
    }

    needAdmin(req);
    if (req.method === 'GET') return json(res, 200, own(await read()));
    if (req.method === 'PUT') {
      const body = await readJson(req, 16 * 1024);
      const show = cleanShow(body?.show);
      const owner = cleanOwner(body?.owner);
      const lang = cleanLang(body?.lang);
      const checkin = cleanCheckin(body?.checkin ?? null, show);
      const s = await locked(async () => {
        const old = await read();
        const next = { token: old?.token ?? crypto.randomBytes(24).toString('base64url'), show, owner, lang, checkin, updated: Date.now() };
        await write(next);
        return next;
      });
      return json(res, 200, own(s));
    }
    if (req.method === 'DELETE') {
      await locked(() => rm(file, { force: true }));
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      return res.end();
    }
    throw new HttpError(405, 'Method not allowed');
  }

  /** /status/<token>: the app's own page, with the feeling in its title for link previews. Never indexed. */
  async function page(req, res, path) {
    const token = path.match(/^\/status\/([^/]+)\/?$/)?.[1];
    if (!token || !TOKEN.test(token)) throw new HttpError(404, 'Not found');
    const info = await stat(indexFile).catch(() => null);
    if (!info) throw new HttpError(503, 'App not built yet. Run "npm run build" (or use "npm run dev" while developing).');
    if (!shell || shell.mtime !== info.mtimeMs) shell = { mtime: info.mtimeMs, html: await readFile(indexFile, 'utf8') };
    const s = await read();
    const shared = !!s && crypto.timingSafeEqual(Buffer.from(s.token), Buffer.from(token));
    let html = shell.html;
    if (shared) {
      const ro = s.lang === 'ro';
      const title = [s.owner, s.checkin?.name].filter(Boolean).join(' · ') || (ro ? 'Stare' : 'Status');
      const blurb = s.checkin?.text ? (s.checkin.text.length > 160 ? s.checkin.text.slice(0, 157).trimEnd() + '…' : s.checkin.text) : ro ? 'Ultimul meu check-in' : 'My latest check-in';
      const meta = [
        '<meta name="robots" content="noindex, nofollow, noarchive" />',
        '<meta property="og:type" content="profile" />',
        `<meta property="og:title" content="${escapeHtml(title)}" />`,
        `<meta property="og:description" content="${escapeHtml(blurb)}" />`,
      ].join('\n    ');
      html = html
        .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>\n    ${meta}`)
        .replace(/(<meta name="description" content=")[^"]*(")/, (_, a, b) => a + escapeHtml(blurb) + b);
      // the page opens in the language chosen for it, whatever the reader's device uses (src/lib/i18n.ts)
      if (s.lang) html = html.replace(/<html\b[^>]*>/, `<html lang="${s.lang}" data-mm-lang="${s.lang}">`);
    } else {
      html = html.replace(/<title>[^<]*<\/title>/, () => '<title>Not shared</title>\n    <meta name="robots" content="noindex, nofollow" />');
    }
    const body = Buffer.from(html);
    res.writeHead(shared ? 200 : 404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      ...NO_INDEX,
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  return { api, page };
}
