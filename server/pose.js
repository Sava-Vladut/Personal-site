import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import { HttpError } from './http-error.js';
import { encodingFor } from './http-response.js';

// The push-up counter finds the body with MediaPipe's Pose Landmarker, in WebAssembly, on the device. This serves what
// it needs from our own origin, so the phone never contacts a third party and the CSP stays tight. Each file is fetched
// once from its public host (jsDelivr for the runtime, Google's model bucket for the weights) and then lives in data/pose.
// Only the files listed here can be requested, so nothing else can be pulled through it.

/** The @mediapipe/tasks-vision release the client pins; its runtime is served from /pose/<version>/. */
export const POSE_WASM_VERSION = '1.1.1';

const WASM_VERSIONS = [POSE_WASM_VERSION];
const WASM_FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'];
// The models' URLs carry a fixed version ("1"), so what they hold never changes.
const MODELS = {
  'pose_landmarker_lite.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  'pose_landmarker_full.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
};

const TYPES = { '.wasm': 'application/wasm', '.js': 'text/javascript; charset=utf-8', '.task': 'application/octet-stream' };
// The runtime shrinks to about a quarter with Brotli; model weights hardly shrink at all, so they go as they are.
const COMPRESSIBLE = new Set(['.wasm', '.js']);
const FAILED = 'Couldn’t fetch the pose model. Try again in a moment.';

/** Where a request comes from, or null when it isn't one we serve. `key` names the cached file. */
export function resolvePoseFile(pathname) {
  const match = /^\/pose\/([^/]+)\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  const [, folder, name] = match;
  if (folder === 'models') return Object.hasOwn(MODELS, name) ? { key: `model-float16-1-${name}`, name, url: MODELS[name] } : null;
  if (!WASM_VERSIONS.includes(folder) || !WASM_FILES.includes(name)) return null;
  return { key: `tasks-vision-${folder}-${name}`, name, url: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${folder}/wasm/${name}` };
}

export const isPosePath = (pathname) => pathname.startsWith('/pose/');

async function sizeOf(file) {
  try {
    const info = await stat(file);
    return info.isFile() ? info.size : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const partFor = (file) => `${file}.${crypto.randomBytes(8).toString('hex')}.part`;

/** One process owns this directory. Files are written beside their final name and renamed into place when whole. */
export function createPoseHandler({ directory, fetchFile = (url, init) => fetch(url, init), maxDownloads = 3, timeoutMs = 10 * 60_000 }) {
  const jobs = new Map();
  const waiting = [];
  let running = 0;
  let prepared;
  // runtime files whose Brotli copy couldn't be made: they go out plain, and it isn't tried again until a restart
  const plainOnly = new Set();

  // A file asked for by several requests at once is fetched (or compressed) once; they all wait for the same work.
  function once(key, work) {
    let job = jobs.get(key);
    if (!job) {
      job = work().finally(() => jobs.delete(key));
      jobs.set(key, job);
    }
    return job;
  }

  // Only a few downloads run at a time and the rest wait their turn.
  async function turn(work) {
    if (running >= maxDownloads) await new Promise((resolve) => waiting.push(resolve));
    else running++;
    try { return await work(); }
    finally { const next = waiting.shift(); if (next) next(); else running--; }
  }

  function prepare() {
    prepared ??= (async () => {
      await mkdir(directory, { recursive: true });
      // A forced shutdown cannot clean up after itself; drop only our own half-written files.
      for (const file of await readdir(directory)) if (/\.[a-f0-9]{16}\.part$/.test(file)) await rm(join(directory, file), { force: true });
    })().catch((error) => { prepared = undefined; throw error; });
    return prepared;
  }

  async function download(url, file) {
    let res;
    try { res = await fetchFile(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'my-mind-pose' } }); }
    catch { throw new HttpError(502, FAILED); }
    if (res.status === 404) throw new HttpError(404, 'Not found');
    if (!res.ok || !res.body) throw new HttpError(502, FAILED);
    const part = partFor(file);
    try {
      await pipeline(Readable.fromWeb(res.body), createWriteStream(part));
      // fetch undoes any Content-Encoding, so the length is only comparable when there was none.
      const expected = res.headers.get('content-encoding') ? 0 : Number(res.headers.get('content-length'));
      if (Number.isFinite(expected) && expected > 0 && (await stat(part)).size !== expected) throw new HttpError(502, 'The download was cut short. Try again.');
      await rename(part, file);
    } catch (error) {
      await rm(part, { force: true });
      throw error instanceof HttpError ? error : new HttpError(502, FAILED);
    }
  }

  // Compressed once, ahead of time, so quality can be high; it runs on libuv's threads, off the event loop.
  async function compress(file, size) {
    const part = partFor(`${file}.br`);
    try {
      const params = { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: size };
      await pipeline(createReadStream(file), zlib.createBrotliCompress({ params }), createWriteStream(part));
      await rename(part, `${file}.br`);
    } catch (error) {
      await rm(part, { force: true });
      throw error;
    }
  }

  return async (req, res, pathname) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    const source = resolvePoseFile(pathname);
    if (!source) throw new HttpError(404, 'Not found');
    await prepare();
    const file = join(directory, source.key);
    let size = await sizeOf(file);
    if (size === null) {
      await once(source.key, () => turn(() => download(source.url, file)));
      size = await sizeOf(file);
    }
    const compressible = COMPRESSIBLE.has(extname(source.name));
    let send = { file, size };
    if (compressible && encodingFor(req) === 'br') {
      let brSize = await sizeOf(`${file}.br`);
      if (brSize === null && !plainOnly.has(source.key)) {
        await once(`${source.key}.br`, () => compress(file, size).catch((error) => {
          plainOnly.add(source.key);
          console.error(`pose: couldn’t compress ${source.key}, serving it plain:`, error.message);
        }));
        brSize = await sizeOf(`${file}.br`);
      }
      if (brSize !== null) send = { file: `${file}.br`, size: brSize, encoding: 'br' };
    }
    res.setHeader('Content-Type', TYPES[extname(source.name)] || 'application/octet-stream');
    res.setHeader('Content-Length', send.size);
    if (send.encoding) res.setHeader('Content-Encoding', send.encoding);
    if (compressible) res.setHeader('Vary', 'Accept-Encoding');
    // The names carry their version, so a given URL never changes.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.writeHead(200);
    if (req.method === 'HEAD') return res.end();
    await pipeline(createReadStream(send.file), res);
  };
}
