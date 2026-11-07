import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import zlib from 'node:zlib';
import { createPoseHandler, isPosePath, POSE_WASM_VERSION, resolvePoseFile } from '../server/pose.js';

const WASM = `/pose/${POSE_WASM_VERSION}/vision_wasm_internal.wasm`;
const LITE = '/pose/models/pose_landmarker_lite.task';
// compresses well, like the real runtime
const RUNTIME = Buffer.from('\0asm' + 'vision wasm internal '.repeat(20_000));

/* ---------- which files can be asked for ---------- */

test('the server serves the runtime release the client pins', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies['@mediapipe/tasks-vision'], POSE_WASM_VERSION);
});

test('only the pinned runtime and the two pose models can be requested', () => {
  assert.equal(resolvePoseFile(WASM)?.url, `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${POSE_WASM_VERSION}/wasm/vision_wasm_internal.wasm`);
  assert.equal(resolvePoseFile(LITE)?.url, 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task');
  assert.equal(resolvePoseFile('/pose/models/pose_landmarker_full.task')?.url, 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task');
  const keys = new Set();
  for (const name of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
    keys.add(resolvePoseFile(`/pose/${POSE_WASM_VERSION}/${name}`).key);
  }
  keys.add(resolvePoseFile(LITE).key);
  keys.add(resolvePoseFile('/pose/models/pose_landmarker_full.task').key);
  assert.equal(keys.size, 6, 'each file is kept under its own name');

  for (const path of [
    '/pose/1.1.0/vision_wasm_internal.wasm',
    `/pose/${POSE_WASM_VERSION}/vision_wasm_module_internal.js`,
    `/pose/${POSE_WASM_VERSION}/vision_wasm_internal.wasm.br`,
    `/pose/${POSE_WASM_VERSION}/..%2F..%2Fserver%2Findex.js`,
    `/pose/${POSE_WASM_VERSION}/sub/vision_wasm_internal.wasm`,
    '/pose/models/other.task',
    '/pose/models/constructor',
    '/pose/models/__proto__',
    '/pose/',
    '/pose',
  ]) assert.equal(resolvePoseFile(path), null, path);
  assert.equal(isPosePath('/pose/anything'), true);
  assert.equal(isPosePath('/posed'), false);
});

/* ---------- fetching once and keeping it ---------- */

function call(handler, path, { method = 'GET', encoding } = {}) {
  const out = { status: 0, headers: {}, chunks: [] };
  const res = new Writable({ write(chunk, _enc, done) { out.chunks.push(chunk); done(); } });
  res.setHeader = (name, value) => { out.headers[name.toLowerCase()] = value; };
  res.writeHead = (status) => { out.status = status; };
  const finished = new Promise((resolve, reject) => { res.on('finish', resolve); res.on('error', reject); });
  const req = { method, headers: encoding ? { 'accept-encoding': encoding } : {} };
  return handler(req, res, path).then(async () => { await finished; return { ...out, body: Buffer.concat(out.chunks) }; });
}

async function withDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), 'mm-pose-'));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test('a file is fetched once, kept, and served from disk afterwards with long-lived caching', () => withDirectory(async (directory) => {
  const urls = [];
  const handler = createPoseHandler({ directory, fetchFile: async (url) => { urls.push(url); return new Response(RUNTIME, { headers: { 'content-length': String(RUNTIME.length) } }); } });
  const first = await call(handler, WASM);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, RUNTIME);
  assert.equal(first.headers['content-type'], 'application/wasm');
  assert.equal(first.headers['content-length'], RUNTIME.length);
  assert.equal(first.headers['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal(first.headers.vary, 'Accept-Encoding');
  assert.equal(first.headers['content-encoding'], undefined);

  const again = await call(handler, WASM);
  assert.deepEqual(again.body, RUNTIME);
  const head = await call(handler, WASM, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.equal(head.headers['content-length'], RUNTIME.length);
  assert.deepEqual(urls, [`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${POSE_WASM_VERSION}/wasm/vision_wasm_internal.wasm`]);
  assert.deepEqual(await readdir(directory), [`tasks-vision-${POSE_WASM_VERSION}-vision_wasm_internal.wasm`]);
}));

test('a browser that takes Brotli gets the compressed copy, made once; one that doesn’t gets the plain bytes', () => withDirectory(async (directory) => {
  let fetched = 0;
  const handler = createPoseHandler({ directory, fetchFile: async () => { fetched++; return new Response(RUNTIME); } });
  const [br, alsoBr] = await Promise.all([call(handler, WASM, { encoding: 'gzip, deflate, br' }), call(handler, WASM, { encoding: 'br' })]);
  for (const r of [br, alsoBr]) {
    assert.equal(r.headers['content-encoding'], 'br');
    assert.equal(r.headers['content-type'], 'application/wasm');
    assert.equal(r.headers.vary, 'Accept-Encoding');
    assert.equal(r.headers['content-length'], r.body.length);
    assert.ok(r.body.length < RUNTIME.length / 10, `compressed (${r.body.length} bytes)`);
    assert.deepEqual(zlib.brotliDecompressSync(r.body), RUNTIME);
  }
  const plain = await call(handler, WASM, { encoding: 'gzip' });
  assert.equal(plain.headers['content-encoding'], undefined);
  assert.equal(plain.headers.vary, 'Accept-Encoding');
  assert.deepEqual(plain.body, RUNTIME);
  const head = await call(handler, WASM, { method: 'HEAD', encoding: 'br' });
  assert.equal(head.headers['content-encoding'], 'br');
  assert.equal(head.body.length, 0);
  assert.equal(fetched, 1);
  const name = `tasks-vision-${POSE_WASM_VERSION}-vision_wasm_internal.wasm`;
  assert.deepEqual((await readdir(directory)).sort(), [name, `${name}.br`]);

  // the runtime's loader is compressed too; model weights never are
  const loader = await call(handler, `/pose/${POSE_WASM_VERSION}/vision_wasm_nosimd_internal.js`, { encoding: 'br' });
  assert.equal(loader.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(loader.headers['content-encoding'], 'br');
  const model = await call(handler, LITE, { encoding: 'br' });
  assert.equal(model.headers['content-type'], 'application/octet-stream');
  assert.equal(model.headers['content-encoding'], undefined);
  assert.equal(model.headers.vary, undefined);
  assert.deepEqual(model.body, RUNTIME);
  assert.equal((await readdir(directory)).filter((f) => f.endsWith('.task.br')).length, 0);
}));

test('when the Brotli copy can’t be made, the plain file is served and it isn’t tried again', () => withDirectory(async (directory) => {
  const name = `tasks-vision-${POSE_WASM_VERSION}-vision_wasm_internal.wasm`;
  await writeFile(join(directory, name), RUNTIME);
  await mkdir(join(directory, `${name}.br`)); // nothing can be renamed over a folder
  const logged = [];
  const error = console.error;
  console.error = (...args) => logged.push(args);
  try {
    const handler = createPoseHandler({ directory, fetchFile: async () => { throw new Error('not expected'); } });
    for (let i = 0; i < 2; i++) {
      const r = await call(handler, WASM, { encoding: 'br' });
      assert.equal(r.status, 200);
      assert.equal(r.headers['content-encoding'], undefined);
      assert.deepEqual(r.body, RUNTIME);
    }
  } finally {
    console.error = error;
  }
  assert.equal(logged.length, 1);
  assert.deepEqual((await readdir(directory)).sort(), [name, `${name}.br`], 'no half-written copy is left');
}));

test('the same file asked for at once is fetched once, and only a few different files are fetched at a time', () => withDirectory(async (directory) => {
  let running = 0, peak = 0;
  const urls = [];
  const handler = createPoseHandler({
    directory,
    maxDownloads: 2,
    fetchFile: async (url) => {
      urls.push(url);
      peak = Math.max(peak, ++running);
      await new Promise((resolve) => setTimeout(resolve, 15));
      running--;
      return new Response('x');
    },
  });
  const paths = [WASM, `/pose/${POSE_WASM_VERSION}/vision_wasm_internal.js`, LITE, '/pose/models/pose_landmarker_full.task'];
  const results = await Promise.all([...paths, WASM, WASM, LITE].map((path) => call(handler, path)));
  assert.ok(results.every((r) => r.status === 200 && r.body.toString() === 'x'));
  assert.equal(urls.length, paths.length);
  assert.ok(peak <= 2, `at most 2 at once, saw ${peak}`);
}));

test('a failed or cut-short download is a 502 that leaves nothing behind, and can be tried again', () => withDirectory(async (directory) => {
  let mode = 'down';
  const handler = createPoseHandler({
    directory,
    fetchFile: async () => {
      if (mode === 'down') return new Response('oops', { status: 500 });
      if (mode === 'offline') throw new TypeError('fetch failed');
      if (mode === 'cut') return new Response('half', { headers: { 'content-length': '999' } });
      return new Response('whole', { headers: { 'content-length': '5' } });
    },
  });
  const attempt = () => call(handler, LITE).then(() => 200, (error) => [error.status, error.message]);
  for (mode of ['down', 'offline', 'cut']) {
    const [status, message] = await attempt();
    assert.equal(status, 502, mode);
    assert.ok(message.length < 80, 'a short message');
    assert.deepEqual(await readdir(directory), [], mode);
  }
  mode = 'ok';
  assert.equal(await attempt(), 200);
  assert.deepEqual(await readdir(directory), ['model-float16-1-pose_landmarker_lite.task']);
}));

test('half-written files from a stopped server are cleared, and only reads of listed files are allowed', () => withDirectory(async (directory) => {
  const name = `tasks-vision-${POSE_WASM_VERSION}-vision_wasm_internal.wasm`;
  await writeFile(join(directory, `${name}.0123456789abcdef.part`), 'junk');
  await writeFile(join(directory, `${name}.br.0123456789abcdef.part`), 'junk');
  await writeFile(join(directory, 'model-float16-1-pose_landmarker_full.task'), 'kept');
  let fetched = 0;
  const handler = createPoseHandler({ directory, fetchFile: async () => { fetched++; throw new Error('not expected'); } });
  const kept = await call(handler, '/pose/models/pose_landmarker_full.task');
  assert.equal(kept.body.toString(), 'kept');
  assert.deepEqual(await readdir(directory), ['model-float16-1-pose_landmarker_full.task']);
  await assert.rejects(call(handler, LITE, { method: 'POST' }), { status: 405 });
  await assert.rejects(call(handler, '/pose/models/other.task'), { status: 404 });
  await assert.rejects(call(handler, '/pose/9.9.9/vision_wasm_internal.wasm'), { status: 404 });
  assert.equal(fetched, 0);
}));
