import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync } from 'node:zlib';
import { createStaticHandler } from '../server/static.js';

// Real HTTP streams with isolated fixtures: no production files or external requests.
let directory, server, port;
const html = Buffer.from('<!doctype html><title>Static regression fixture</title>');
const javascript = Buffer.from('export const message = "unchanged application bytes";\n'.repeat(500));
const representations = { br: brotliCompressSync(javascript), gzip: gzipSync(javascript) };

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'personal-site-static-'));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), html);
  await writeFile(join(directory, 'assets', 'app-fixture123.js'), javascript);
  await writeFile(join(directory, 'assets', 'app-fixture123.js.br'), representations.br);
  await writeFile(join(directory, 'assets', 'app-fixture123.js.gz'), representations.gzip);
  await writeFile(join(directory, 'theme.js'), '/* fresh theme */');
  await writeFile(join(directory, 'theme.js.br'), brotliCompressSync(Buffer.from('/* stale theme */')));
  await utimes(join(directory, 'theme.js.br'), new Date(0), new Date(0));
  server = await listen(createStaticHandler(directory));
  port = server.address().port;
});

async function listen(serve) {
  const instance = http.createServer((req, res) => {
    serve(req, res, req.url.split('?')[0]).catch((error) => {
      if (res.headersSent) return res.destroy(error);
      res.removeHeader('Content-Length');
      res.removeHeader('Content-Encoding');
      res.writeHead(error.status || 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    });
  });
  await new Promise((resolve, reject) => {
    instance.once('error', reject);
    instance.listen(0, '127.0.0.1', resolve);
  });
  return instance;
}

async function withLimits(options, run) {
  const instance = await listen(createStaticHandler(directory, options));
  const localRequest = (path, headers, method) => request(path, headers, method, instance.address().port);
  try { await run(localRequest); }
  finally { await new Promise((resolve, reject) => instance.close((error) => error ? reject(error) : resolve())); }
}

after(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (directory) await rm(directory, { recursive: true, force: true });
});

function request(path = '/assets/app-fixture123.js', headers = {}, method = 'GET', destination = port) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: destination, path, method, headers, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Static test request timed out')));
    req.end();
  });
}

test('identity, Brotli and gzip preserve exact asset bytes and cache headers', async () => {
  let etag;
  for (const encoding of ['identity', 'br', 'gzip']) {
    const response = await request(undefined, { 'Accept-Encoding': encoding });
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal(response.headers['content-length'], String(response.body.length));
    assert.equal(response.headers.vary, 'Accept-Encoding');
    assert.equal(response.headers['cache-control'], 'public, max-age=31536000, immutable');
    assert.equal(response.headers['content-encoding'], encoding === 'identity' ? undefined : encoding);
    const decoded = encoding === 'br' ? brotliDecompressSync(response.body) : encoding === 'gzip' ? gunzipSync(response.body) : response.body;
    assert.deepEqual(decoded, javascript);
    etag ??= response.headers.etag;
    assert.equal(response.headers.etag, etag);
  }
});

test('encoding negotiation honors excluded representations and identity fallback', async () => {
  const cases = [
    ['', undefined],
    ['br, gzip', 'br'],
    ['br;q=0, gzip', 'gzip'],
    ['gzip;q=0, br;q=0', undefined],
    ['br;q=0.2, gzip;q=0.8, identity;q=0', 'gzip'],
    ['*;q=0.8, identity;q=0', 'br'],
    ['*;q=0, identity;q=1', undefined],
  ];
  for (const [value, expected] of cases) {
    const response = await request(undefined, { 'Accept-Encoding': value });
    assert.equal(response.status, 200, value);
    assert.equal(response.headers['content-encoding'], expected, value);
  }
  for (const value of ['identity;q=0', 'br;q=0, gzip;q=0, identity;q=0', '*;q=0']) {
    assert.equal((await request(undefined, { 'Accept-Encoding': value })).status, 406, value);
  }
  assert.equal((await request('/', { 'Accept-Encoding': 'br, identity;q=0' })).status, 406);
});

test('stale compressed sidecars cannot serve old application bytes', async () => {
  const response = await request('/theme.js', { 'Accept-Encoding': 'br' });
  assert.equal(response.status, 200);
  assert.equal(response.headers['content-encoding'], undefined);
  assert.equal(response.body.toString(), '/* fresh theme */');
  assert.equal((await request('/theme.js', { 'Accept-Encoding': 'br, identity;q=0' })).status, 406);
});

test('HEAD returns representation metadata without a response body', async () => {
  for (const encoding of ['identity', 'br', 'gzip']) {
    const headers = { 'Accept-Encoding': encoding };
    const get = await request(undefined, headers);
    const head = await request(undefined, headers, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
    for (const name of ['etag', 'content-type', 'content-length', 'content-encoding', 'cache-control', 'vary']) {
      assert.equal(head.headers[name], get.headers[name], name);
    }
  }
});

test('conditional requests accept weak, strong, list and wildcard ETags including immutable assets', async () => {
  const initial = await request();
  for (const validator of [initial.headers.etag, initial.headers.etag.replace(/^W\//, ''), `"different", ${initial.headers.etag}`, '*']) {
    const response = await request(undefined, { 'Accept-Encoding': 'br', 'If-None-Match': validator });
    assert.equal(response.status, 304, validator);
    assert.equal(response.body.length, 0);
    assert.equal(response.headers['content-length'], undefined);
    assert.equal(response.headers.etag, initial.headers.etag);
    assert.equal(response.headers['cache-control'], 'public, max-age=31536000, immutable');
  }
  assert.equal((await request(undefined, { 'If-None-Match': '"different"' })).status, 200);
});

test('repeated cached immutable requests keep encodings, HEAD and conditional bodies separate', async () => {
  for (let round = 0; round < 3; round++) {
    for (const encoding of ['br', 'identity', 'gzip']) {
      const headers = { 'Accept-Encoding': encoding };
      const get = await request(undefined, headers);
      assert.equal(get.status, 200);
      assert.deepEqual(get.body, encoding === 'identity' ? javascript : representations[encoding]);
      assert.equal(get.headers['content-encoding'], encoding === 'identity' ? undefined : encoding);
      const head = await request(undefined, headers, 'HEAD');
      assert.equal(head.status, 200);
      assert.equal(head.body.length, 0);
      assert.equal(head.headers['content-length'], String(get.body.length));
      const conditional = await request(undefined, { ...headers, 'If-None-Match': get.headers.etag });
      assert.equal(conditional.status, 304);
      assert.equal(conditional.body.length, 0);
      assert.equal(conditional.headers['content-length'], undefined);
      assert.deepEqual((await request(undefined, headers)).body, get.body);
    }
  }
});

for (const [kind, options] of [
  ['entry count', { maxCacheEntries: 1, maxCacheBytes: 1024 }],
  ['total bytes', { maxCacheEntries: 100, maxCacheBytes: 48 }],
]) {
  test(`immutable cache evicts older assets when its ${kind} budget is reached`, async () => {
    await withLimits(options, async (get) => {
      const names = ['first', 'second'].map((label) => `/assets/${kind.replace(' ', '-')}-${label}-12345678.js`);
      const bodies = names.map((_, index) => Buffer.alloc(32, index + 65));
      for (let i = 0; i < names.length; i++) {
        await writeFile(join(directory, names[i]), bodies[i]);
        assert.deepEqual((await get(names[i])).body, bodies[i]);
      }
      // Content-fingerprinted names are immutable. Removing the fixtures lets
      // HTTP responses distinguish an evicted entry from a retained one.
      for (const name of names) await rm(join(directory, name));
      assert.equal((await get(names[0])).status, 404);
      const retained = await get(names[1]);
      assert.equal(retained.status, 200);
      assert.deepEqual(retained.body, bodies[1]);
    });
  });
}

test('oversized assets stream successfully without entering the immutable cache', async () => {
  await withLimits({ maxCacheEntryBytes: 32, maxCacheBytes: 1024 }, async (get) => {
    const path = '/assets/large-12345678.js';
    const body = Buffer.alloc(64, 65);
    await writeFile(join(directory, path), body);
    assert.deepEqual((await get(path)).body, body);
    await rm(join(directory, path));
    assert.equal((await get(path)).status, 404);
  });
});

test('static admission limit responds with a retryable error', async () => {
  await withLimits({ maxConcurrent: 0 }, async (get) => {
    const response = await get('/');
    assert.equal(response.status, 503);
    assert.equal(response.headers['retry-after'], '1');
  });
});

test('SPA navigation falls back to revalidated HTML while absent asset paths return 404', async () => {
  for (const path of ['/', '/journal', '/notes/example', '/assets/no-extension']) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.deepEqual(response.body, html);
    assert.equal(response.headers['cache-control'], 'no-cache');
    assert.match(response.headers['content-type'], /^text\/html/);
    assert.equal((await request(path, { 'If-None-Match': response.headers.etag })).status, 304);
  }
  assert.equal((await request('/assets/missing.js')).status, 404);
  assert.equal((await request('/missing.png')).status, 404);
});

test('traversal, malformed paths and direct compression sidecar requests are rejected', async () => {
  for (const path of ['/../outside.txt', '/%2e%2e/outside.txt', '/%2e%2e%2foutside.txt']) {
    assert.equal((await request(path)).status, 404, path);
  }
  for (const path of ['/%', '/%ZZ', '/%E0%A4%A', '/%00', '/assets/app-fixture123.js%00']) {
    assert.equal((await request(path)).status, 400, path);
  }
  for (const path of ['/assets/app-fixture123.js.br', '/assets/app-fixture123.js.gz', '/assets/app-fixture123.js%2ebr']) {
    assert.equal((await request(path)).status, 404, path);
  }
  assert.equal((await request('/')).status, 200);
});
