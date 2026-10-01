import { open, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { HttpError } from './http-error.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

async function fileStat(file) {
  try { return await stat(file); }
  catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null; throw error; }
}

function encodings(header = '') {
  const values = new Map();
  for (const part of header.toLowerCase().split(',')) {
    const [name, ...params] = part.trim().split(';');
    const quality = params.find((p) => p.trim().startsWith('q='));
    const q = quality === undefined ? 1 : Number(quality.trim().slice(2));
    if (name) values.set(name, Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0);
  }
  const quality = (name) => values.get(name) ?? (name === 'identity' ? (values.get('*') === 0 ? 0 : 1) : values.get('*') ?? 0);
  return ['br', 'gzip', 'identity'].map((name) => ({ name, q: quality(name) })).filter((v) => v.q > 0).sort((a, b) => b.q - a.q);
}

// Compression happens at build time; response bodies stream with backpressure instead
// of keeping every raw/gzip/Brotli asset in process memory.
export function createStaticHandler(directory, { maxConcurrent = 128, maxCacheBytes = 16 * 1024 * 1024, maxCacheEntries = 256, maxCacheEntryBytes = 1024 * 1024 } = {}) {
  let active = 0;
  let cacheBytes = 0;
  const cache = new Map();
  function remember(key, value) {
    if (value.body.length > maxCacheBytes || maxCacheEntries <= 0) return;
    if (cache.has(key)) { cacheBytes -= cache.get(key).body.length; cache.delete(key); }
    cache.set(key, value);
    cacheBytes += value.body.length;
    while (cacheBytes > maxCacheBytes || cache.size > maxCacheEntries) {
      const oldest = cache.keys().next().value;
      cacheBytes -= cache.get(oldest).body.length;
      cache.delete(oldest);
    }
  }
  function respond(req, res, headers, body) {
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    const matches = String(req.headers['if-none-match'] || '').split(',').map((v) => v.trim().replace(/^W\//, ''));
    if (matches.includes('*') || matches.includes(headers.ETag.slice(2))) {
      res.removeHeader('Content-Length');
      res.writeHead(304);
      res.end();
      return true;
    }
    res.writeHead(200);
    if (req.method === 'HEAD' || body) {
      res.end(req.method === 'HEAD' ? undefined : body);
      return true;
    }
    return false;
  }
  return async (req, res, pathname) => {
    if (active >= maxConcurrent) {
      res.setHeader('Retry-After', '1');
      throw new HttpError(503, 'Server is busy. Please try again.');
    }
    active++;
    let handle;
    try {
      let file;
      try { file = normalize(join(directory, decodeURIComponent(pathname))); }
      catch { throw new HttpError(400, 'Bad path'); }
      if (file.includes('\0')) throw new HttpError(400, 'Bad path');
      if ((file !== directory && !file.startsWith(directory + sep)) || /\.(?:br|gz)$/.test(file)) throw new HttpError(404, 'Not found');
      // Only content-fingerprinted assets can bypass revalidation. The bounded LRU
      // keeps common requests off disk without retaining an ever-growing asset set.
      const fingerprinted = file.startsWith(join(directory, 'assets') + sep) && /-[A-Za-z0-9_-]{8,}\.[^./]+$/.test(file);
      const cacheKey = file + '\0' + String(req.headers['accept-encoding'] || '').toLowerCase();
      const cached = fingerprinted && cache.get(cacheKey);
      if (cached) {
        cache.delete(cacheKey); cache.set(cacheKey, cached);
        respond(req, res, cached.headers, cached.body);
        return;
      }
      let source = await fileStat(file);
      if (!source?.isFile()) {
        if (extname(file)) throw new HttpError(404, 'Not found');
        file = join(directory, 'index.html');
        source = await fileStat(file);
      }
      if (!source?.isFile()) throw new HttpError(503, 'App not built yet. Run "npm run build" (or use "npm run dev" while developing).');

      let encoding;
      let length;
      for (const candidate of encodings(String(req.headers['accept-encoding'] || ''))) {
        const selected = candidate.name === 'identity' ? file : `${file}.${candidate.name === 'gzip' ? 'gz' : 'br'}`;
        try { handle = await open(selected, 'r'); }
        catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        const info = await handle.stat();
        if (!info.isFile() || (candidate.name !== 'identity' && info.mtimeMs < source.mtimeMs)) {
          await handle.close(); handle = undefined; continue;
        }
        source = candidate.name === 'identity' ? info : source;
        encoding = candidate.name;
        length = info.size;
        break;
      }
      if (!handle) throw new HttpError(406, 'No acceptable content encoding.');
      // A weak validator describes the resource across its compressed representations.
      const etag = `W/"${source.ino.toString(16)}-${source.size.toString(16)}-${source.mtimeMs.toString(16)}-${source.ctimeMs.toString(16)}"`;
      const headers = {
        'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
        'Cache-Control': fingerprinted ? 'public, max-age=31536000, immutable' : 'no-cache',
        ETag: etag,
        Vary: 'Accept-Encoding',
        'Content-Length': length,
        ...(encoding !== 'identity' ? { 'Content-Encoding': encoding } : {}),
      };
      let body;
      if (fingerprinted && length <= maxCacheEntryBytes && length <= maxCacheBytes && req.method !== 'HEAD') {
        body = await handle.readFile();
        remember(cacheKey, { headers, body });
      }
      if (respond(req, res, headers, body)) return;
      await pipeline(handle.createReadStream({ autoClose: false }), res);
    } finally {
      await handle?.close();
      active--;
    }
  };
}
