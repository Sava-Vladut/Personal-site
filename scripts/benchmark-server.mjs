import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

// Local synthetic comparison, not production capacity or browser-render measurements.
// Usage: node scripts/benchmark-server.mjs [app-root] [trials=3]
// Copies only server/ and dist/: never reads .env or existing user data.
const root = resolve(process.argv[2] || '.');
const trials = Number(process.argv[3] || 3);
if (!Number.isInteger(trials) || trials < 1 || trials > 20) throw new Error('Trials must be between 1 and 20');
const temporary = await mkdtemp(join(tmpdir(), 'personal-site-benchmark-'));
let child;

function request(port, path, headers = {}) {
  return new Promise((resolveRequest, reject) => {
    const started = performance.now();
    const req = http.get({ host: '127.0.0.1', port, path, headers, agent: false }, (res) => {
      let bytes = 0;
      res.on('data', (chunk) => { bytes += chunk.length; });
      res.on('error', reject);
      res.on('end', () => resolveRequest({ status: res.statusCode, bytes, encoding: res.headers['content-encoding'], ms: performance.now() - started }));
    });
    req.on('error', reject);
    req.setTimeout(30_000, () => req.destroy(new Error('Benchmark request timed out')));
  });
}

async function start() {
  child = spawn(process.execPath, [join(temporary, 'launch.mjs')], {
    cwd: temporary,
    env: { PATH: process.env.PATH || '', SESSION_SECRET: 'isolated-synthetic-benchmark-secret', PUBLIC_URL: 'http://127.0.0.1:8085' },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  let errors = '';
  child.stderr.on('data', (chunk) => { errors = (errors + chunk).slice(-4000); });
  return new Promise((resolveStart, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timed out: ' + errors)), 10_000);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Server exited (${code}): ${errors}`)); });
    child.once('message', ({ port }) => { clearTimeout(timeout); resolveStart(port); });
  });
}

async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const current = child;
  await new Promise((resolveStop) => {
    const timer = setTimeout(() => current.kill('SIGKILL'), 10_000);
    current.once('exit', () => { clearTimeout(timer); resolveStop(); });
    current.kill('SIGTERM');
  });
  child = undefined;
}

try {
  await cp(join(root, 'server'), join(temporary, 'server'), { recursive: true, preserveTimestamps: true });
  await cp(join(root, 'dist'), join(temporary, 'dist'), { recursive: true, preserveTimestamps: true });
  await writeFile(join(temporary, 'package.json'), '{"type":"module"}\n');
  // Intercept only the listen address so old and new servers use isolated ephemeral
  // loopback ports. The production request handler and response bodies are unchanged.
  await writeFile(join(temporary, 'launch.mjs'), `
import http from 'node:http';
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) {
  const callback = args.findLast((value) => typeof value === 'function');
  return listen.call(this, 0, '127.0.0.1', () => {
    callback?.();
    process.send({ port: this.address().port });
  });
};
await import('./server/index.js');
`);
  const asset = (await readdir(join(temporary, 'dist', 'assets'))).find((name) => /^index-.*\.js$/.test(name));
  if (!asset) throw new Error('Build dist/ before benchmarking');
  const samples = [];
  for (let trial = 0; trial < trials; trial++) {
    const port = await start();
    assert.equal((await request(port, '/api/health')).status, 200);
    const cold = request(port, '/assets/' + asset, { 'Accept-Encoding': 'br' });
    await delay(10);
    const health = request(port, '/api/health');
    const [first, during] = await Promise.all([cold, health]);
    assert.equal(first.status, 200);
    assert.equal(first.encoding, 'br', 'Brotli benchmark requires precompressed assets in the updated build');
    assert.equal(during.status, 200);
    let issued = 0;
    const began = performance.now();
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (issued++ < 100) {
        const response = await request(port, '/assets/' + asset, { 'Accept-Encoding': 'br' });
        assert.equal(response.status, 200);
        assert.equal(response.bytes, first.bytes);
      }
    }));
    samples.push({ coldAssetMs: first.ms, healthDuringColdMs: during.ms, warm100Concurrency8Ms: performance.now() - began, compressedBytes: first.bytes });
    await stop();
  }
  const median = (key) => [...samples].map((sample) => sample[key]).sort((a, b) => a - b)[Math.floor(samples.length / 2)];
  console.log(JSON.stringify({ root, asset, trials, node: process.version, note: 'Local synthetic localhost timings; fresh process per trial, OS file cache may be warm. No production throughput guarantee.', median: Object.fromEntries(Object.keys(samples[0]).map((key) => [key, Math.round(median(key) * 100) / 100])), samples }, null, 2));
} finally {
  await stop();
  await rm(temporary, { recursive: true, force: true });
}
