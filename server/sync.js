import crypto from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, readdir, rename, rm, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpError } from './http-error.js';
import { json } from './http-response.js';

const MAX_BYTES = 16 * 1024 * 1024;
const digest = (hash) => hash.digest('base64url').slice(0, 22);
const signature = (info) => `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;

/** One process owns this directory. The locks protect compare-and-swap across async I/O. */
export function createSyncHandler({ directory, maxConcurrentUploads = 4, maxConcurrentRequests = 128, revisionCacheEntries = 1024 }) {
  const locks = new Map();
  const revisions = new Map();
  let activeUploads = 0;
  let activeRequests = 0;
  let prepared;

  async function prepareUploads() {
    if (!prepared) {
      prepared = (async () => {
        await mkdir(directory, { recursive: true });
        // A forced shutdown cannot run upload cleanup. Remove only our abandoned
        // temporary files before any upload in this process creates a new one.
        const files = await readdir(directory, { withFileTypes: true });
        await Promise.all(files.filter((file) => file.isFile() && /^\.upload-[a-f0-9]{32}\.tmp$/.test(file.name)).map((file) => unlink(join(directory, file.name))));
      })().catch((error) => { prepared = undefined; throw error; });
    }
    return prepared;
  }

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

  function remember(file, info, rev) {
    revisions.delete(file);
    revisions.set(file, { signature: signature(info), rev });
    while (revisions.size > revisionCacheEntries) revisions.delete(revisions.keys().next().value);
  }

  async function revision(file, handle, info) {
    const cached = revisions.get(file);
    if (cached?.signature === signature(info)) return cached.rev;
    const hash = crypto.createHash('sha256');
    // Keep the descriptor open: the same inode supplies both the hash and response bytes.
    for await (const chunk of handle.createReadStream({ autoClose: false, start: 0 })) hash.update(chunk);
    const rev = digest(hash);
    remember(file, info, rev);
    return rev;
  }

  async function currentRevision(file) {
    let handle;
    try {
      handle = await open(file, 'r');
      return await revision(file, handle, await handle.stat());
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    } finally {
      await handle?.close();
    }
  }

  async function upload(req) {
    if (Number(req.headers['content-length']) > MAX_BYTES) {
      req.resume();
      throw new HttpError(413, 'That’s too big to sync.');
    }
    await prepareUploads();
    const temporary = join(directory, `.upload-${crypto.randomBytes(16).toString('hex')}.tmp`);
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    const input = new PassThrough();
    const limit = new Transform({
      transform(chunk, encoding, callback) {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) return callback(new HttpError(413, 'That’s too big to sync.'));
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    const aborted = () => input.destroy(new HttpError(400, 'Upload interrupted.'));
    const failed = (error) => input.destroy(error);
    req.once('aborted', aborted);
    req.once('error', failed);
    try {
      // Decouple pipeline failure from the socket so oversized chunked uploads can receive 413.
      const completed = pipeline(input, limit, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
      req.pipe(input);
      if (req.aborted || req.destroyed) aborted();
      await completed;
      return { temporary, bytes, rev: digest(hash) };
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw error;
    } finally {
      req.unpipe(input);
      req.off('aborted', aborted);
      req.off('error', failed);
      if (!req.complete && !req.destroyed) req.resume();
    }
  }

  async function download(req, res, dir, file, photo) {
    let handle;
    try {
      // Opening under the journal lock orders this snapshot against writes and deletion.
      handle = await locked(dir, () => open(file, 'r'));
      const info = await handle.stat();
      const rev = photo ? null : await revision(file, handle, info);
      const headers = { 'Cache-Control': 'no-store', ...(rev ? { 'X-Sync-Rev': rev } : {}) };
      if (rev && req.headers['x-sync-rev'] === rev) {
        res.writeHead(304, headers);
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': info.size, ...headers });
      await pipeline(handle.createReadStream({ autoClose: false, start: 0 }), res);
    } catch (error) {
      if (error.code === 'ENOENT') throw new HttpError(404, photo ? 'No such photo.' : 'Nothing is saved under that code.');
      // A client closing a streamed response is expected and must not become a server error.
      if (error.code !== 'ERR_STREAM_PREMATURE_CLOSE') throw error;
    } finally {
      await handle?.close();
    }
  }

  async function handle(req, res, path) {
    const match = path.match(/^\/api\/sync\/([a-f0-9]{64})(?:\/(p[a-z0-9]{6,40}))?$/);
    if (!match) throw new HttpError(404, 'Not found');
    const dir = join(directory, match[1]);
    const photo = Boolean(match[2]);
    const file = join(dir, match[2] || 'doc');

    if (req.method === 'GET') return download(req, res, dir, file, photo);
    if (req.method === 'DELETE' && !photo) {
      await locked(dir, async () => {
        await rm(dir, { recursive: true, force: true });
        revisions.delete(file);
      });
      res.writeHead(204);
      return res.end();
    }
    if (req.method !== 'PUT') throw new HttpError(405, 'Method not allowed');
    if (activeUploads >= maxConcurrentUploads) {
      req.resume();
      res.setHeader('Retry-After', '1');
      throw new HttpError(503, 'Sync is busy. Please try again shortly.');
    }

    activeUploads++;
    let pending;
    try {
      pending = await upload(req);
      if (!pending.bytes) throw new HttpError(400, photo ? 'Empty photo.' : 'Empty upload.');
      return await locked(dir, async () => {
        if (photo) {
          try {
            await stat(file);
            res.writeHead(204);
            return res.end();
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
        } else {
          const current = await currentRevision(file);
          if ((current ?? 'new') !== req.headers['x-sync-rev']) {
            return json(res, 409, { error: 'Changed on another device.', rev: current });
          }
        }
        await mkdir(dir, { recursive: true });
        await rename(pending.temporary, file);
        if (photo) {
          res.writeHead(204);
          return res.end();
        }
        remember(file, await stat(file), pending.rev);
        return json(res, 200, { rev: pending.rev });
      });
    } finally {
      if (pending) await unlink(pending.temporary).catch(() => {});
      activeUploads--;
    }
  }

  return async function sync(req, res, path) {
    if (activeRequests >= maxConcurrentRequests) {
      req.resume();
      res.setHeader('Retry-After', '1');
      throw new HttpError(503, 'Sync is busy. Please try again shortly.');
    }
    activeRequests++;
    try {
      return await handle(req, res, path);
    } finally {
      activeRequests--;
    }
  };
}
