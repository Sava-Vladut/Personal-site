import crypto from 'node:crypto';
import zlib from 'node:zlib';

// JSON answers are compressed here, since Caddy passes the app's answers on as they are: a streamer's history goes
// from 440 KB to about 120 KB, the Card Wars stats from 44 KB to 9 KB. Brotli at quality 4 is about as quick as gzip
// and smaller; the default (11) is meant for files compressed once, ahead of time.
const COMPRESS_FROM = 1024;      // smaller answers aren't worth it
const OFF_THREAD_FROM = 64 * 1024; // bigger ones are compressed on libuv's threads, so other requests aren't kept waiting
const brotli = (size) => ({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: size } });

/**
 * For answers that pages ask for again and again (stats polled every 30 seconds, a channel's history while it loads):
 * the browser keeps a copy but checks it every time, and an unchanged one comes back as a 304 with no body. Never on
 * anything tied to a sign-in: those stay no-store.
 */
export const REVALIDATE = { 'Cache-Control': 'private, no-cache' };

/** The compression this browser takes: 'br', 'gzip', or null. Brotli first, unless it's turned down with q=0. */
export function encodingFor(req) {
  const header = String(req?.headers?.['accept-encoding'] || '').toLowerCase();
  if (!header) return null;
  const q = {};
  for (const part of header.split(',')) {
    const [name, ...params] = part.split(';').map((s) => s.trim());
    const given = params.find((p) => p.startsWith('q='));
    if (name) q[name] = given === undefined ? 1 : Number(given.slice(2)) || 0;
  }
  const takes = (name) => (q[name] ?? q['*'] ?? 0) > 0;
  return takes('br') ? 'br' : takes('gzip') ? 'gzip' : null;
}

/** Whether the browser's If-None-Match already names this ETag (compared weakly, as RFC 9110 asks for it). */
const unchanged = (req, etag) =>
  String(req.headers['if-none-match'] || '').split(',').some((v) => (v = v.trim()) === '*' || v.replace(/^W\//, '') === etag.replace(/^W\//, ''));

/**
 * Sends JSON that's already a string. An answer the browser may keep (any Cache-Control but no-store) gets an ETag, so
 * a page asking again only gets "304, nothing changed" while it is the same. The ETag is weak: the same JSON, however
 * it was compressed.
 */
export function sendJson(res, status, text, headers = {}) {
  const req = res.req;
  const head = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers };
  const compressible = text.length >= COMPRESS_FROM;
  if (compressible) head.Vary = head.Vary ? `${head.Vary}, Accept-Encoding` : 'Accept-Encoding';
  if (status === 200 && req && (req.method === 'GET' || req.method === 'HEAD') && !/no-store/i.test(head['Cache-Control'])) {
    head.ETag = `W/"${crypto.createHash('sha1').update(text).digest('base64url')}"`;
    if (unchanged(req, head.ETag)) {
      delete head['Content-Type'];
      res.writeHead(304, head);
      return res.end();
    }
  }
  const encoding = compressible ? encodingFor(req) : null;
  if (!encoding) {
    res.writeHead(status, head);
    return res.end(text);
  }
  head['Content-Encoding'] = encoding;
  if (req.method === 'HEAD') {
    res.writeHead(status, head);
    return res.end();
  }
  if (text.length < OFF_THREAD_FROM) {
    // well under a millisecond: done here, so the answer keeps its Content-Length
    const body = encoding === 'br' ? zlib.brotliCompressSync(text, brotli(text.length)) : zlib.gzipSync(text);
    res.writeHead(status, { ...head, 'Content-Length': body.length });
    return res.end(body);
  }
  // the head goes now, so nothing else answers this request while the body is being compressed
  res.writeHead(status, head);
  return new Promise((resolve) => {
    const done = (error, body) => {
      if (error) res.destroy(error);
      else res.end(body);
      resolve();
    };
    if (encoding === 'br') zlib.brotliCompress(text, brotli(text.length), done);
    else zlib.gzip(text, done);
  });
}

export function json(res, status, body, headers = {}) {
  return sendJson(res, status, JSON.stringify(body), headers);
}
