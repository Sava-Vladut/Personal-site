// Public notes: a note you choose to share is copied here as plain text and pictures, and anyone with its link can read it.
// Feelings, people (by name), a place's name, the weather and music go too, but only those chosen for that note.
// Nothing else leaves the journal. Publishing, updating and stopping need the admin password; reading needs only the link.
//   data/shared/<token>/note.json     what the public page shows (rebuilt from a whitelist, whatever the browser sent)
//   data/shared/<token>/<photo>.<ext> the note's photos, as uploaded
// The token is 192 random bits, so a link can't be guessed, and stopping to share deletes the whole folder.
import crypto from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError } from './http-error.js';
import { readJson } from './http-request.js';
import { json } from './http-response.js';

const TOKEN = /^[A-Za-z0-9_-]{32}$/;
const PHOTO = /^p[a-z0-9]{6,40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTES = 200;
const MAX_PHOTOS = 40;
const MAX_TEXT = 100_000;
const MAX_NOTE_BYTES = 600 * 1024;
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
const NO_INDEX = { 'X-Robots-Tag': 'noindex, nofollow, noarchive' };

/** Which kind of picture these bytes are, from their first bytes (never from what the uploader claims). */
function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.toString('latin1', 0, 4) === 'GIF8') return 'gif';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (b.toString('latin1', 4, 8) === 'ftyp' && /^avi[fs]/.test(b.toString('latin1', 8, 12))) return 'avif';
  return null;
}

const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 100_000 ? Math.round(v) : undefined);
const https = (v) => (typeof v === 'string' && v.length <= 2000 && /^https:\/\/[^\s\]]+$/.test(v) ? v : undefined);

function photoOf(raw) {
  if (!raw || typeof raw.id !== 'string' || !PHOTO.test(raw.id)) return null;
  return { id: raw.id, w: num(raw.w) ?? 1, h: num(raw.h) ?? 1 };
}

function imageOf(raw) {
  const url = https(raw?.url);
  if (!url) return null;
  const out = { url };
  const thumb = https(raw.thumb), link = https(raw.link), title = text(raw.title, 300), credit = text(raw.credit, 300);
  const w = num(raw.w), h = num(raw.h);
  if (thumb) out.thumb = thumb;
  if (link) out.link = link;
  if (title) out.title = title;
  if (credit) out.credit = credit;
  if (w && h) Object.assign(out, { w, h });
  return out;
}

function cropOf(raw) {
  const n = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
  const x = n(raw?.x, 0, 1), y = n(raw?.y, 0, 1), zoom = n(raw?.zoom, 1, 4);
  return x === null || y === null || zoom === null ? undefined : { x, y, zoom };
}

const EMOTION_ID = /^[a-z0-9-]+(?:\/[a-z0-9-]+){0,2}$/;
const ICON_ID = /^[te]:[a-z0-9-]{1,60}$/;
const MUSIC_KINDS = ['track', 'album', 'playlist', 'episode', 'show', 'artist'];

function musicOf(raw) {
  if (!raw || !MUSIC_KINDS.includes(raw.kind) || typeof raw.id !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(raw.id)) return null;
  const title = text(raw.title, 300).trim();
  if (!title) return null;
  const out = { kind: raw.kind, id: raw.id, title, link: `https://open.spotify.com/${raw.kind}/${raw.id}` };
  const sub = text(raw.sub, 300), image = https(raw.image);
  if (sub) out.sub = sub;
  if (image) out.image = image;
  return out;
}

/** The details chosen for the public page, each in its own narrow shape: names but no ids, a place's name but no coordinates. */
export function cleanDetails(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out = {};
  const f = raw.feelings;
  if (f && Array.isArray(f.emotions)) {
    const emotions = f.emotions.filter((id) => typeof id === 'string' && id.length <= 80 && EMOTION_ID.test(id)).slice(0, 3);
    const intensity = Number.isInteger(f.intensity) && f.intensity >= 1 && f.intensity <= 5 ? f.intensity : 3;
    if (emotions.length) out.feelings = { emotions, intensity };
  }
  if (Array.isArray(raw.people)) {
    const people = raw.people
      .map((p) => ({ name: text(p?.name, 80).trim(), icon: typeof p?.icon === 'string' && ICON_ID.test(p.icon) ? p.icon : null }))
      .filter((p) => p.name)
      .slice(0, 30);
    if (people.length) out.people = people;
  }
  const place = text(raw.place?.name, 200).trim();
  if (place) out.place = { name: place };
  const w = raw.weather;
  if (w && Number.isInteger(w.code) && w.code >= 0 && w.code < 100 && typeof w.temp === 'number' && Math.abs(w.temp) < 100) {
    const daylight = typeof w.daylight === 'number' && w.daylight >= 0 && w.daylight <= 24 ? w.daylight : 0;
    out.weather = { code: w.code, temp: Math.round(w.temp * 10) / 10, daylight, ...(typeof w.dark === 'boolean' && { dark: w.dark }) };
  }
  if (Array.isArray(raw.music)) {
    const music = raw.music.map(musicOf).filter(Boolean).slice(0, 20);
    if (music.length) out.music = music;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The public copy of a note: only these fields, only these shapes. Feelings, people, place, weather and music only as cleanDetails allows. */
export function cleanNote(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.date !== 'string' || !DAY.test(raw.date)) throw new HttpError(400, 'That note can’t be shared.');
  if (typeof raw.text === 'string' && raw.text.length > MAX_TEXT) throw new HttpError(413, 'That note is too long to share.');
  const photos = (Array.isArray(raw.photos) ? raw.photos : []).map(photoOf).filter(Boolean);
  const unique = [...new Map(photos.map((p) => [p.id, p])).values()].slice(0, MAX_PHOTOS);
  const images = (Array.isArray(raw.images) ? raw.images : []).map(imageOf).filter(Boolean).slice(0, 12);
  let cover = null;
  if (raw.cover && typeof raw.cover === 'object') {
    const pic = photoOf(raw.cover.photo);
    const img = pic ? null : imageOf(raw.cover.image);
    const crop = cropOf(raw.cover.crop);
    if (pic) cover = { photo: pic, ...(crop && { crop }) };
    else if (img) cover = { image: img, ...(crop && { crop }) };
  }
  if (cover?.photo && !unique.some((p) => p.id === cover.photo.id) && unique.length < MAX_PHOTOS) unique.push(cover.photo);
  const details = cleanDetails(raw.details);
  return {
    title: text(raw.title, 300),
    text: text(raw.text, MAX_TEXT),
    date: raw.date,
    dateEnd: typeof raw.dateEnd === 'string' && DAY.test(raw.dateEnd) && raw.dateEnd > raw.date ? raw.dateEnd : null,
    images,
    photos: unique,
    cover,
    ...(details && { details }),
  };
}

/** A few words for a link preview: the note's first lines without its markup. */
export function excerpt(note) {
  const plain = note.text
    .replace(/^\s*\[\[(?:photo|image|album):[^\]]*\]\]\s*$/gm, ' ')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
    .replace(/[#>*_~`=]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 160 ? plain.slice(0, 157).trimEnd() + '…' : plain;
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createShareHandler({ directory, indexFile, isAdmin, adminConfigured }) {
  const locks = new Map();
  let shell = null; // index.html, re-read when the build changes

  async function locked(key, work) {
    const previous = locks.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(work);
    locks.set(key, current);
    try {
      return await current;
    } finally {
      if (locks.get(key) === current) locks.delete(key);
    }
  }

  const folder = (token) => join(directory, token);

  async function readNote(token) {
    try {
      return JSON.parse(await readFile(join(folder(token), 'note.json'), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return null;
      throw error;
    }
  }

  async function photoFiles(token) {
    try {
      const out = new Map();
      for (const name of await readdir(folder(token))) {
        const m = name.match(/^(p[a-z0-9]{6,40})\.(jpg|png|webp|gif|avif)$/);
        if (m) out.set(m[1], m[2]);
      }
      return out;
    } catch (error) {
      if (error.code === 'ENOENT') return new Map();
      throw error;
    }
  }

  async function writeNote(token, note) {
    await mkdir(folder(token), { recursive: true, mode: 0o700 });
    const file = join(folder(token), 'note.json');
    await writeFile(file + '.tmp', JSON.stringify(note), { mode: 0o600 });
    await rename(file + '.tmp', file);
  }

  /** Photos the note lists that aren't here yet; files the note no longer lists are removed. */
  async function reconcilePhotos(token, note) {
    const have = await photoFiles(token);
    const wanted = new Set(note.photos.map((p) => p.id));
    for (const [id, ext] of have) if (!wanted.has(id)) await rm(join(folder(token), `${id}.${ext}`), { force: true });
    return note.photos.map((p) => p.id).filter((id) => !have.has(id));
  }

  function needAdmin(req) {
    if (!adminConfigured) throw new HttpError(403, 'Sharing is off: this server has no admin password. Set ADMIN_PASSWORD in .env.');
    if (!isAdmin(req)) throw new HttpError(401, 'Sign in with the admin password to share notes.');
  }

  async function list() {
    let names = [];
    try {
      names = (await readdir(directory)).filter((n) => TOKEN.test(n));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const out = [];
    for (const token of names) {
      const note = await readNote(token);
      if (note) out.push({ token, title: note.title, date: note.date, dateEnd: note.dateEnd, shared: note.shared, excerpt: excerpt(note) });
    }
    return out.sort((a, b) => b.shared - a.shared);
  }

  async function publish(token, note) {
    const clean = { ...cleanNote(note), shared: Date.now() };
    const missing = await locked(token, async () => {
      await writeNote(token, clean);
      return reconcilePhotos(token, clean);
    });
    return { token, missing };
  }

  async function uploadPhoto(req, res, token, id) {
    const type = String(req.headers['content-type'] || '');
    if (!/^image\//i.test(type)) throw new HttpError(415, 'Expected a picture.');
    if (Number(req.headers['content-length']) > MAX_PHOTO_BYTES) {
      req.resume();
      throw new HttpError(413, 'That photo is too big to share.');
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_PHOTO_BYTES) throw new HttpError(413, 'That photo is too big to share.');
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const ext = sniff(body);
    if (!ext) throw new HttpError(415, 'That isn’t a picture the page can show.');
    await locked(token, async () => {
      const note = await readNote(token);
      if (!note) throw new HttpError(404, 'That note isn’t shared.');
      // only pictures the note really lists, so the folder can't be filled with anything else
      if (!note.photos.some((p) => p.id === id)) throw new HttpError(400, 'The note doesn’t use that photo.');
      for (const other of Object.keys(TYPES)) if (other !== ext) await rm(join(folder(token), `${id}.${other}`), { force: true });
      const file = join(folder(token), `${id}.${ext}`);
      await writeFile(file + '.tmp', body, { mode: 0o600 });
      await rename(file + '.tmp', file);
    });
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
  }

  /** The /api/share routes. Reading a note or photo is public; everything else is the admin's. */
  async function api(req, res, path) {
    const m = path.match(/^\/api\/share(?:\/([^/]+))?(?:\/([^/]+))?$/);
    if (!m) throw new HttpError(404, 'Not found');
    const [, token, photo] = m;
    if (token && !TOKEN.test(token)) throw new HttpError(404, 'That note isn’t shared.');
    if (photo && !PHOTO.test(photo)) throw new HttpError(404, 'No such photo.');

    if (req.method === 'GET' && token) {
      const note = await readNote(token);
      if (!note) throw new HttpError(404, 'That note isn’t shared.');
      if (!photo) {
        // a picture that never finished uploading is left out rather than shown broken
        const have = await photoFiles(token);
        const photos = note.photos.filter((p) => have.has(p.id));
        const cover = note.cover?.photo && !have.has(note.cover.photo.id) ? null : note.cover;
        return json(res, 200, { ...note, photos, cover }, NO_INDEX);
      }
      const ext = (await photoFiles(token)).get(photo);
      if (!ext) throw new HttpError(404, 'No such photo.');
      const info = await stat(join(folder(token), `${photo}.${ext}`));
      res.writeHead(200, { 'Content-Type': TYPES[ext], 'Content-Length': info.size, 'Cache-Control': 'private, max-age=300', ...NO_INDEX });
      return res.end(await readFile(join(folder(token), `${photo}.${ext}`)));
    }

    needAdmin(req);
    if (!token) {
      if (req.method === 'GET') return json(res, 200, { notes: await list() });
      if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
      if ((await list()).length >= MAX_NOTES) throw new HttpError(409, 'That’s as many public notes as this server keeps. Stop sharing one first.');
      const note = await readJson(req, MAX_NOTE_BYTES);
      return json(res, 200, await publish(crypto.randomBytes(24).toString('base64url'), note));
    }
    if (photo) {
      if (req.method !== 'PUT') throw new HttpError(405, 'Method not allowed');
      return uploadPhoto(req, res, token, photo);
    }
    if (req.method === 'PUT') {
      if (!(await readNote(token))) throw new HttpError(404, 'That note isn’t shared.');
      return json(res, 200, await publish(token, await readJson(req, MAX_NOTE_BYTES)));
    }
    if (req.method === 'DELETE') {
      await locked(token, () => rm(folder(token), { recursive: true, force: true }));
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      return res.end();
    }
    throw new HttpError(405, 'Method not allowed');
  }

  /** /s/<token>: the app's own page, with the note's title and first words for link previews. Never indexed. */
  async function page(req, res, path) {
    const token = path.match(/^\/s\/([^/]+)\/?$/)?.[1];
    if (!token || !TOKEN.test(token)) throw new HttpError(404, 'Not found');
    const info = await stat(indexFile).catch(() => null);
    if (!info) throw new HttpError(503, 'App not built yet. Run "npm run build" (or use "npm run dev" while developing).');
    if (!shell || shell.mtime !== info.mtimeMs) shell = { mtime: info.mtimeMs, html: await readFile(indexFile, 'utf8') };
    const note = await readNote(token);
    let html = shell.html;
    if (note) {
      const title = note.title.trim() || 'A note';
      const blurb = excerpt(note);
      const meta = [
        '<meta name="robots" content="noindex, nofollow, noarchive" />',
        `<meta property="og:type" content="article" />`,
        `<meta property="og:title" content="${escapeHtml(title)}" />`,
        blurb && `<meta property="og:description" content="${escapeHtml(blurb)}" />`,
      ].filter(Boolean).join('\n    ');
      html = html
        .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>\n    ${meta}`)
        .replace(/(<meta name="description" content=")[^"]*(")/, (_, a, b) => a + escapeHtml(blurb || title) + b);
    } else {
      html = html.replace(/<title>[^<]*<\/title>/, () => '<title>Not shared</title>\n    <meta name="robots" content="noindex, nofollow" />');
    }
    const body = Buffer.from(html);
    res.writeHead(note ? 200 : 404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      ...NO_INDEX,
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  return { api, page };
}
