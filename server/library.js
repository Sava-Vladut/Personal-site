// Docs: the PDFs in LIBRARY_DIR (docs/ by default), searchable page by page. Their text comes from poppler's
// pdftotext and is cached in CACHE_DIR until a file changes; pages are drawn by pdftoppm when they're opened and
// cached too. Everything here is for the signed-in admin only: the files never leave the server otherwise.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { HttpError } from './http-error.js';
import { json } from './http-response.js';

const RESULTS = 300;   // pages returned for one search, at most
const PER_DOC = 60;    // of which from one document
const SNIPPET = 90;    // characters either side of the first match
const PAGE_PX = 1400;  // the longer side of a drawn page
const RESCAN_MS = 30_000;

/** Lowercase, without accents (Romanian ș, ț, ă, î, â match s, t, a, i), ligatures split. */
const fold = (s) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** The words of a search; "quoted words" stay together as a phrase. */
export function terms(q) {
  const out = [];
  for (const m of String(q).matchAll(/"([^"]+)"|(\S+)/g)) {
    const t = fold((m[1] ?? m[2]).replace(/\s+/g, ' ').trim());
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 8);
}

function count(hay, needle) {
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) n++;
  return n;
}

/**
 * A piece of a page around its first match, as [text, isMatch] runs. The search runs on the folded text,
 * so each folded character is mapped back to the original one it came from.
 */
export function snippet(text, words) {
  let folded = '';
  const at = [];
  for (let i = 0; i < text.length; i++) {
    const f = fold(text[i]);
    folded += f;
    for (let k = 0; k < f.length; k++) at.push(i);
  }
  at.push(text.length);
  const spans = [];
  for (const w of words) for (let i = folded.indexOf(w); i !== -1; i = folded.indexOf(w, i + w.length)) spans.push([at[i], at[i + w.length - 1] + 1]);
  spans.sort((a, b) => a[0] - b[0]);
  const first = spans[0]?.[0] ?? 0;
  let from = Math.max(0, first - SNIPPET), to = Math.min(text.length, first + SNIPPET * 2);
  if (from > 0) from = text.indexOf(' ', from) + 1 || from;
  if (to < text.length) to = text.lastIndexOf(' ', to) > first ? text.lastIndexOf(' ', to) : to;
  const runs = [];
  let pos = from;
  for (const [a, b] of spans) {
    if (b <= pos || a >= to) continue;
    if (a > pos) runs.push([text.slice(pos, a), false]);
    runs.push([text.slice(Math.max(a, pos), Math.min(b, to)), true]);
    pos = Math.min(b, to);
  }
  if (pos < to) runs.push([text.slice(pos, to), false]);
  if (from > 0) runs.unshift(['…', false]);
  if (to < text.length) runs.push(['…', false]);
  return runs;
}

const run = (cmd, args, encoding = 'utf8') =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { encoding, maxBuffer: 64 * 1024 * 1024, timeout: 120_000 }, (e, out) => (e ? reject(e) : resolve(out))));

/** One at a time: drawing pages is the heaviest thing here, and the server is small. */
let queue = Promise.resolve();
const oneAtATime = (job) => {
  const next = queue.then(job, job);
  queue = next.catch(() => {});
  return next;
};

async function pdfFiles(root, dir = root) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await pdfFiles(root, full)));
    else if (e.isFile() && /\.pdf$/i.test(e.name)) out.push(full);
  }
  return out;
}

/** The size of each page, in points, from pdfinfo's list (turned pages swap width and height). */
function pageSizes(info) {
  const sizes = [];
  for (const m of info.matchAll(/^Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+)/gm)) sizes[Number(m[1]) - 1] = [Number(m[2]), Number(m[3])];
  for (const m of info.matchAll(/^Page\s+(\d+) rot:\s+(\d+)/gm)) if (Number(m[2]) % 180 && sizes[Number(m[1]) - 1]) sizes[Number(m[1]) - 1].reverse();
  return sizes;
}

export function createLibraryHandler({ directory, cacheDir, isAdmin }) {
  const indexFile = join(cacheDir, 'index.json');
  const pagesDir = join(cacheDir, 'pages');
  /** path → { id, path, title, folder, size, mtime, sizes, text, folded } */
  let docs = new Map();
  let loaded = false;
  let scanning = null;
  let scannedAt = 0;
  let tools = null;

  const hasTools = async () => {
    if (tools === null) tools = await run('pdftotext', ['-v']).then(() => true, (e) => e.code !== 'ENOENT');
    return tools;
  };

  async function load() {
    if (loaded) return;
    loaded = true;
    try {
      const saved = JSON.parse(await readFile(indexFile, 'utf8'));
      for (const d of saved.docs ?? []) docs.set(d.path, { ...d, folded: d.text.map(fold) });
    } catch {}
  }

  async function save() {
    await mkdir(cacheDir, { recursive: true });
    const body = JSON.stringify({ docs: [...docs.values()].map(({ folded, ...d }) => d) });
    await writeFile(indexFile + '.tmp', body);
    await rename(indexFile + '.tmp', indexFile);
  }

  async function extract(file) {
    const [text, info] = await Promise.all([
      run('pdftotext', ['-q', '-enc', 'UTF-8', file, '-']),
      run('pdfinfo', ['-f', '1', '-l', '100000', file]),
    ]);
    const sizes = pageSizes(info);
    // pdftotext ends every page with a form feed, so the last piece is empty
    const pages = text.split('\f').slice(0, sizes.length || undefined).map((p) => p.replace(/\s+/g, ' ').trim());
    return { pages, sizes };
  }

  /** Looks for new, changed and removed PDFs, and reads the text of the new and changed ones. */
  function scan(force = false) {
    if (scanning) return scanning;
    if (!force && Date.now() - scannedAt < RESCAN_MS) return Promise.resolve();
    scanning = (async () => {
      await load();
      const files = await pdfFiles(directory);
      const next = new Map();
      let changed = files.length !== docs.size;
      for (const path of files) {
        const rel = relative(directory, path).split(sep).join('/');
        const s = await stat(path).catch(() => null);
        if (!s) continue;
        const old = docs.get(rel);
        if (old && old.size === s.size && old.mtime === s.mtimeMs) {
          next.set(rel, old);
          continue;
        }
        changed = true;
        try {
          const { pages, sizes } = await oneAtATime(() => extract(path));
          next.set(rel, {
            id: createHash('sha256').update(rel).digest('base64url').slice(0, 12),
            path: rel,
            title: basename(rel).replace(/\.pdf$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim(),
            folder: dirname(rel) === '.' ? '' : dirname(rel),
            size: s.size,
            mtime: s.mtimeMs,
            sizes,
            text: pages,
            folded: pages.map(fold),
          });
        } catch (e) {
          console.error(`Docs: couldn’t read ${rel}:`, e.message);
        }
      }
      docs = next;
      scannedAt = Date.now();
      if (changed) await save().catch((e) => console.error('Docs: couldn’t save the index:', e.message));
    })().finally(() => (scanning = null));
    return scanning;
  }

  const byId = (id) => {
    for (const d of docs.values()) if (d.id === id) return d;
    throw new HttpError(404, 'That document isn’t here any more.');
  };
  const summary = (d) => ({ id: d.id, title: d.title, folder: d.folder, pages: d.text.length, size: d.size, ratio: d.sizes[0] ? d.sizes[0][1] / d.sizes[0][0] : 1.414 });

  function search(q, only) {
    const words = terms(q);
    if (!words.length) return { results: [], pages: 0 };
    const results = [];
    let total = 0;
    for (const d of docs.values()) {
      if (only && d.id !== only) continue;
      const hits = [];
      d.folded.forEach((f, i) => {
        let n = 0;
        for (const w of words) {
          const c = count(f, w);
          if (!c) return;
          n += c;
        }
        hits.push({ page: i + 1, hits: n });
      });
      if (!hits.length) continue;
      total += hits.length;
      const titleHit = words.every((w) => fold(d.title).includes(w));
      results.push({ doc: summary(d), hits: hits.reduce((s, h) => s + h.hits, 0), count: hits.length, titleHit, pages: hits });
    }
    // documents with the most matches first; within one, pages in order
    results.sort((a, b) => b.titleHit - a.titleHit || b.hits - a.hits);
    let room = RESULTS;
    for (const r of results) {
      const keep = only ? r.pages : r.pages.slice(0, Math.min(PER_DOC, Math.max(room, 3)));
      room -= keep.length;
      const d = byId(r.doc.id);
      r.pages = keep.map((p) => ({ ...p, snippet: snippet(d.text[p.page - 1], words) }));
      r.more = r.count - keep.length;
    }
    return { results, pages: total, words };
  }

  /** Where the words of a search are on a page, as fractions of its width and height. */
  async function boxes(d, page, q) {
    const words = terms(q).flatMap((w) => w.split(' '));
    if (!words.length) return [];
    const html = await oneAtATime(() => run('pdftotext', ['-q', '-bbox', '-f', String(page), '-l', String(page), join(directory, d.path), '-']));
    const size = html.match(/<page width="([\d.]+)" height="([\d.]+)">/);
    if (!size) return [];
    const [w, h] = [Number(size[1]), Number(size[2])];
    const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    const out = [];
    for (const m of html.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)) {
      const word = fold(unescape(m[5]));
      if (!words.some((t) => word.includes(t) || (t.length > 3 && t.includes(word) && word.length > 2))) continue;
      const [x0, y0, x1, y1] = m.slice(1, 5).map(Number);
      out.push([x0 / w, y0 / h, (x1 - x0) / w, (y1 - y0) / h].map((v) => Math.round(v * 10000) / 10000));
    }
    return out.slice(0, 400);
  }

  async function image(d, page) {
    const file = join(pagesDir, `${d.id}-${Math.round(d.mtime)}-${page}.jpg`);
    if (!existsSync(file)) {
      await mkdir(pagesDir, { recursive: true });
      const prefix = join(pagesDir, `.tmp-${d.id}-${page}-${process.pid}`);
      await oneAtATime(() => run('pdftoppm', ['-q', '-jpeg', '-jpegopt', 'quality=82', '-scale-to', String(PAGE_PX), '-singlefile', '-f', String(page), '-l', String(page), join(directory, d.path), prefix]));
      await rename(prefix + '.jpg', file);
    }
    return file;
  }

  function sendFile(req, res, file, type, size, extra = {}) {
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    let start = 0, end = size - 1, status = 200;
    if (range && (range[1] || range[2])) {
      start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start > end || start >= size) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` });
        return res.end();
      }
      status = 206;
    }
    res.writeHead(status, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=86400',
      ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
      ...extra,
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file, { start, end }).pipe(res);
  }

  /** GET /api/library, …/search?q=&doc=, …/:id/file, …/:id/page/:n?q=, …/:id/page/:n/image */
  return async function library(req, res, p, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    if (!isAdmin(req)) throw new HttpError(403, 'Sign in to the site to read the docs.');
    if (!(await hasTools())) throw new HttpError(503, 'This server can’t read PDFs: install poppler-utils (pdftotext, pdftoppm).');
    const parts = p.split('/').slice(3); // after /api/library
    await scan(parts.length === 0 && url.searchParams.has('fresh'));

    if (!parts.length) {
      const list = [...docs.values()].map(summary).sort((a, b) => a.folder.localeCompare(b.folder) || a.title.localeCompare(b.title, undefined, { numeric: true }));
      return json(res, 200, { docs: list, pages: list.reduce((s, d) => s + d.pages, 0) }, { 'Cache-Control': 'no-store' });
    }
    if (parts[0] === 'search' && parts.length === 1) {
      return json(res, 200, search(url.searchParams.get('q') ?? '', url.searchParams.get('doc')), { 'Cache-Control': 'no-store' });
    }

    const d = byId(parts[0]);
    if (parts[1] === 'file' && parts.length === 2) {
      const name = basename(d.path).replace(/[^\w .()-]/g, '_');
      // the browser's own PDF viewer runs scripts of its own, which the app's policy would stop
      res.removeHeader('Content-Security-Policy');
      return sendFile(req, res, join(directory, d.path), 'application/pdf', d.size, {
        'Content-Disposition': `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(basename(d.path))}`,
      });
    }
    if (parts[1] === 'page' && /^\d+$/.test(parts[2] ?? '')) {
      const page = Number(parts[2]);
      if (page < 1 || page > d.text.length) throw new HttpError(404, 'There’s no such page.');
      if (parts.length === 3) {
        const [w, h] = d.sizes[page - 1] ?? d.sizes[0] ?? [1, 1.414];
        return json(res, 200, { page, ratio: h / w, boxes: await boxes(d, page, url.searchParams.get('q') ?? '') }, { 'Cache-Control': 'no-store' });
      }
      if (parts[3] === 'image' && parts.length === 4) {
        const file = await image(d, page);
        const s = await stat(file);
        return sendFile(req, res, file, 'image/jpeg', s.size);
      }
    }
    throw new HttpError(404, 'Not found');
  };
}
