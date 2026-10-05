import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpError } from './http-error.js';

// Voice typing runs on the device: Whisper in WebAssembly. This serves what it needs from our own origin, so the
// phone never contacts a third party and the CSP stays tight. Each file is fetched once from its public host
// (jsDelivr for ONNX Runtime's wasm, Hugging Face for the model weights) and then lives in data/voice.
// Only the files listed here can be requested, so nothing else can be pulled through it.

/** transformers.js release (see scripts/build-voice.mjs) → the ONNX Runtime build it was bundled with. */
export const ORT_VERSIONS = { '4.3.0': '1.31.0-dev.20260914-8d85527a0' };

export const MODELS = ['onnx-community/whisper-tiny.en', 'onnx-community/whisper-base.en', 'onnx-community/whisper-base'];

const ORT_FILE = /^\/voice\/ort-(\d+\.\d+\.\d+)\/(ort-wasm-simd-threaded\.(?:mjs|wasm))$/;
const MODEL_FILE = /^\/voice\/models\/([A-Za-z0-9-]+\/[A-Za-z0-9.-]+)\/resolve\/main\/((?:[A-Za-z0-9_-]+\.(?:json|txt))|onnx\/(?:encoder_model|decoder_model_merged)_quantized\.onnx)$/;

const TYPES = { '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream' };

/** Where a request comes from, or null when it isn't one we serve. `key` names the cached file. */
export function resolveVoiceFile(pathname) {
  const ort = ORT_FILE.exec(pathname);
  if (ort) {
    const version = ORT_VERSIONS[ort[1]];
    if (!version) return null;
    return { key: `ort-${version}-${ort[2]}`, name: ort[2], url: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${version}/dist/${ort[2]}` };
  }
  const model = MODEL_FILE.exec(pathname);
  if (model && MODELS.includes(model[1])) {
    return { key: `${model[1].replace('/', '--')}--${model[2].replace('/', '--')}`, name: model[2], url: `https://huggingface.co/${model[1]}/resolve/main/${model[2]}` };
  }
  return null;
}

export const isVoicePath = (pathname) => /^\/voice\/(?:ort-|models\/)/.test(pathname);

/** One process owns this directory. Downloads are written beside the final file and renamed into place when whole. */
export function createVoiceHandler({ directory, fetchFile = (url, init) => fetch(url, init), maxDownloads = 3, timeoutMs = 10 * 60_000 }) {
  const downloads = new Map();
  const waiting = [];
  let running = 0;
  let prepared;

  // A device asks for all of a model's files at once; only a few are fetched at a time and the rest wait their turn.
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
    const res = await fetchFile(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'my-mind-voice' } });
    if (res.status === 404) throw new HttpError(404, 'Not found');
    if (!res.ok || !res.body) throw new HttpError(502, 'Couldn’t fetch the speech files. Try again in a moment.');
    const part = `${file}.${crypto.randomBytes(8).toString('hex')}.part`;
    try {
      await pipeline(Readable.fromWeb(res.body), createWriteStream(part));
      // fetch undoes any Content-Encoding, so the length is only comparable when there was none.
      const expected = res.headers.get('content-encoding') ? 0 : Number(res.headers.get('content-length'));
      if (Number.isFinite(expected) && expected > 0 && (await stat(part)).size !== expected) throw new HttpError(502, 'The download was cut short. Try again.');
      await rename(part, file);
    } catch (error) {
      await rm(part, { force: true });
      throw error instanceof HttpError ? error : new HttpError(502, 'Couldn’t fetch the speech files. Try again in a moment.');
    }
  }

  async function ensure(source) {
    const file = join(directory, source.key);
    try {
      const info = await stat(file);
      if (info.isFile()) return { file, size: info.size };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    let pending = downloads.get(source.key);
    if (!pending) {
      pending = turn(() => download(source.url, file)).finally(() => downloads.delete(source.key));
      downloads.set(source.key, pending);
    }
    await pending;
    return { file, size: (await stat(file)).size };
  }

  return async (req, res, pathname) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    const source = resolveVoiceFile(pathname);
    if (!source) throw new HttpError(404, 'Not found');
    await prepare();
    const found = await ensure(source);
    res.setHeader('Content-Type', TYPES[extname(source.name)] || 'application/octet-stream');
    res.setHeader('Content-Length', found.size);
    // The names carry their version, so a given URL never changes.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.writeHead(200);
    if (req.method === 'HEAD') return res.end();
    await pipeline(createReadStream(found.file), res);
  };
}
