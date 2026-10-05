import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';
import { createVoiceHandler, MODELS, ORT_VERSIONS, resolveVoiceFile } from '../server/voice.js';

const ENCODER = '/voice/models/onnx-community/whisper-tiny.en/resolve/main/onnx/encoder_model_quantized.onnx';

/* ---------- which files can be asked for ---------- */

test('only the speech runtime and the listed models can be requested', () => {
  assert.equal(resolveVoiceFile(ENCODER)?.url, 'https://huggingface.co/onnx-community/whisper-tiny.en/resolve/main/onnx/encoder_model_quantized.onnx');
  for (const repo of MODELS) {
    for (const file of ['config.json', 'tokenizer.json', 'preprocessor_config.json', 'generation_config.json', 'vocab.json', 'merges.txt', 'onnx/decoder_model_merged_quantized.onnx']) {
      assert.ok(resolveVoiceFile(`/voice/models/${repo}/resolve/main/${file}`), `${repo}/${file}`);
    }
  }
  const [version, ort] = Object.entries(ORT_VERSIONS)[0];
  assert.equal(resolveVoiceFile(`/voice/ort-${version}/ort-wasm-simd-threaded.wasm`)?.url, `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort}/dist/ort-wasm-simd-threaded.wasm`);

  for (const path of [
    '/voice/models/someone/else/resolve/main/config.json', // a repo that isn't ours to proxy
    '/voice/models/onnx-community/whisper-tiny.en/resolve/main/onnx/model.onnx', // the large unquantized weights
    '/voice/models/onnx-community/whisper-tiny.en/resolve/main/onnx/encoder_model_quantized.onnx.evil',
    '/voice/models/onnx-community/whisper-tiny.en/resolve/main/..%2Fsecret.json',
    '/voice/models/onnx-community/whisper-tiny.en/resolve/other/config.json',
    '/voice/models/onnx-community/whisper-tiny.en/resolve/main/sub/dir/config.json',
    '/voice/ort-9.9.9/ort-wasm-simd-threaded.wasm', // a runtime release we haven't pinned
    `/voice/ort-${version}/ort-wasm.wasm`,
    `/voice/ort-${version}/../server/index.js`,
    '/voice/transformers-4.3.0.js', // static file, not this handler's
  ]) assert.equal(resolveVoiceFile(path), null, path);
});

/* ---------- fetching once and keeping it ---------- */

function response(body, { status = 200, headers = {} } = {}) {
  return new Response(body, { status, headers });
}

function call(handler, path, method = 'GET') {
  const out = { status: 0, headers: {}, chunks: [] };
  const res = new Writable({ write(chunk, _enc, done) { out.chunks.push(chunk); done(); } });
  res.setHeader = (name, value) => { out.headers[name.toLowerCase()] = value; };
  res.writeHead = (status) => { out.status = status; };
  const finished = new Promise((resolve, reject) => { res.on('finish', resolve); res.on('error', reject); });
  return handler({ method }, res, path).then(async () => { await finished; return { ...out, body: Buffer.concat(out.chunks) }; });
}

async function withDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), 'mm-voice-'));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test('a file is fetched once, kept, and served from disk afterwards with long-lived caching', () => withDirectory(async (directory) => {
  const urls = [];
  const handler = createVoiceHandler({ directory: join(directory, 'voice'), fetchFile: async (url) => { urls.push(url); return response('weights', { headers: { 'content-length': '7' } }); } });
  const first = await call(handler, ENCODER);
  assert.equal(first.status, 200);
  assert.equal(first.body.toString(), 'weights');
  assert.equal(first.headers['content-type'], 'application/octet-stream');
  assert.equal(first.headers['content-length'], 7);
  assert.match(first.headers['cache-control'], /immutable/);
  assert.equal((await call(handler, ENCODER)).body.toString(), 'weights');
  const head = await call(handler, ENCODER, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.deepEqual(urls, ['https://huggingface.co/onnx-community/whisper-tiny.en/resolve/main/onnx/encoder_model_quantized.onnx']);
  assert.deepEqual(await readdir(join(directory, 'voice')), ['onnx-community--whisper-tiny.en--onnx--encoder_model_quantized.onnx']);
}));

test('the same file asked for at once is fetched once, and only a few different files are fetched at a time', () => withDirectory(async (directory) => {
  let running = 0, peak = 0;
  const urls = [];
  const handler = createVoiceHandler({
    directory,
    maxDownloads: 2,
    fetchFile: async (url) => {
      urls.push(url);
      peak = Math.max(peak, ++running);
      await new Promise((resolve) => setTimeout(resolve, 15));
      running--;
      return response('x');
    },
  });
  const model = (file) => `/voice/models/onnx-community/whisper-base.en/resolve/main/${file}`;
  const files = ['config.json', 'tokenizer.json', 'vocab.json', 'merges.txt', 'preprocessor_config.json'];
  const results = await Promise.all([...files, 'config.json', 'config.json'].map((file) => call(handler, model(file))));
  assert.ok(results.every((r) => r.status === 200 && r.body.toString() === 'x'));
  assert.equal(urls.length, files.length);
  assert.ok(peak <= 2, `at most 2 at once, saw ${peak}`);
}));

test('a failed or cut-short download leaves nothing behind and can be tried again', () => withDirectory(async (directory) => {
  let mode = 'cut';
  const handler = createVoiceHandler({
    directory,
    fetchFile: async () => {
      if (mode === 'cut') return response('half', { headers: { 'content-length': '999' } });
      if (mode === 'down') return response('', { status: 503 });
      if (mode === 'gone') return response('', { status: 404 });
      return response('whole', { headers: { 'content-length': '5' } });
    },
  });
  const attempt = (path = ENCODER) => call(handler, path).then(() => 200, (error) => error.status);
  assert.equal(await attempt(), 502);
  mode = 'down';
  assert.equal(await attempt(), 502);
  mode = 'gone';
  assert.equal(await attempt(), 404);
  assert.deepEqual(await readdir(directory), []);
  mode = 'ok';
  assert.equal(await attempt(), 200);
  assert.deepEqual(await readdir(directory), ['onnx-community--whisper-tiny.en--onnx--encoder_model_quantized.onnx']);
}));

test('a compressed upstream response is not mistaken for a short one', () => withDirectory(async (directory) => {
  // fetch() hands back the decoded body, so its length differs from the Content-Length that described the compressed bytes
  const handler = createVoiceHandler({ directory, fetchFile: async () => response('decoded body', { headers: { 'content-length': '3', 'content-encoding': 'br' } }) });
  const result = await call(handler, '/voice/ort-4.3.0/ort-wasm-simd-threaded.mjs');
  assert.equal(result.status, 200);
  assert.equal(result.body.toString(), 'decoded body');
  assert.equal(result.headers['content-type'], 'text/javascript; charset=utf-8');
}));

test('half-written files from a stopped server are cleared, finished ones are kept, and only reads are allowed', () => withDirectory(async (directory) => {
  await writeFile(join(directory, 'onnx-community--whisper-tiny.en--config.json.0123456789abcdef.part'), 'junk');
  await writeFile(join(directory, 'onnx-community--whisper-tiny.en--tokenizer.json'), 'kept');
  const handler = createVoiceHandler({ directory, fetchFile: async () => { throw new Error('not expected'); } });
  const kept = await call(handler, '/voice/models/onnx-community/whisper-tiny.en/resolve/main/tokenizer.json');
  assert.equal(kept.body.toString(), 'kept');
  assert.equal(kept.headers['content-type'], 'application/json');
  assert.deepEqual(await readdir(directory), ['onnx-community--whisper-tiny.en--tokenizer.json']);
  await assert.rejects(call(handler, ENCODER, 'POST'), { status: 405 });
  await assert.rejects(call(handler, '/voice/models/other/repo/resolve/main/config.json'), { status: 404 });
}));

/* ---------- the pure helpers the client uses ---------- */

async function load(file) {
  const bundle = await rolldown({ input: file });
  const { output } = await bundle.generate({ format: 'cjs' });
  await bundle.close();
  const module = { exports: {} };
  vm.runInNewContext(output[0].code, { module, exports: module.exports, Float32Array, Math, Number, String, Array });
  return module.exports;
}
const { cleanTranscript, clock, loudness, spaceBefore, toMono16k } = await load(new URL('../src/lib/voiceText.ts', import.meta.url).pathname);

test('Whisper’s notes about non-speech are removed and its spacing is tidied', () => {
  assert.equal(cleanTranscript(' [BLANK_AUDIO] '), '');
  assert.equal(cleanTranscript('(music) ♪ ♪'), '');
  assert.equal(cleanTranscript('Hello  there , world .'), 'Hello there, world.');
  assert.equal(cleanTranscript('I went [clears throat] home. (silence)'), 'I went home.');
  assert.equal(cleanTranscript(' Plain words stay. '), 'Plain words stay.');
});

test('spoken text gets a space before it only where typed text would', () => {
  assert.equal(spaceBefore('', 'Hello'), '');
  assert.equal(spaceBefore(undefined, 'Hello'), '');
  assert.equal(spaceBefore('Dear diary', 'today'), ' ');
  assert.equal(spaceBefore('Dear diary ', 'today'), '');
  assert.equal(spaceBefore('line one\n', 'today'), '');
  assert.equal(spaceBefore('He said (', 'hi'), '');
  assert.equal(spaceBefore('Dear diary', ', today'), '');
  assert.equal(spaceBefore('Dear diary', '. Today'), '');
});

test('recordings are mixed to one channel and brought to 16 kHz', () => {
  const same = new Float32Array([0.5, -0.5, 0.25]);
  assert.deepEqual([...toMono16k([same], 16000)], [...same]);
  assert.deepEqual([...toMono16k([new Float32Array([1, 1]), new Float32Array([0, -1])], 16000)], [0.5, 0]);
  const rate48 = Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i / 20));
  const down = toMono16k([rate48], 48000);
  assert.equal(down.length, 1600);
  assert.ok(Math.abs(down[100] - rate48[300]) < 1e-6);
  assert.equal(toMono16k([], 16000).length, 0);
});

test('silence is told from speech by its loudness, and times read as clocks', () => {
  assert.equal(loudness(new Float32Array(0)), 0);
  assert.equal(loudness(new Float32Array(100)), 0);
  assert.ok(Math.abs(loudness(new Float32Array(100).fill(0.5)) - 0.5) < 1e-6);
  assert.equal(clock(0), '0:00');
  assert.equal(clock(7.9), '0:07');
  assert.equal(clock(65), '1:05');
  assert.equal(clock(300), '5:00');
});

test('the committed runtime matches the version the client and server expect', async () => {
  const { VOICE_RUNTIME } = await load(new URL('../src/lib/voiceConfig.ts', import.meta.url).pathname);
  assert.ok(VOICE_RUNTIME in ORT_VERSIONS, 'server/voice.js pins an ONNX Runtime for the runtime release');
  const bundle = await readFile(new URL(`../public/voice/transformers-${VOICE_RUNTIME}.js`, import.meta.url), 'utf8');
  assert.ok(bundle.includes('export'), 'the bundle is an ES module');
  assert.ok(!bundle.includes('data:application/wasm'), 'the wasm is served separately, not inlined');
});
