import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createSyncHandler } from '../server/sync.js';
import { HttpError } from '../server/http-error.js';

let directory, server, base;
const id = 'a'.repeat(64);
const orphan = `.upload-${'a'.repeat(32)}.tmp`;
const hash = (body) => crypto.createHash('sha256').update(body).digest('base64url').slice(0, 22);
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'my-mind-sync-test-'));
  await writeFile(join(directory, orphan), 'interrupted upload');
  await writeFile(join(directory, 'unrelated-file'), 'preserved');
  const sync = createSyncHandler({ directory, maxConcurrentUploads: 2, revisionCacheEntries: 2 });
  server = http.createServer(async (req, res) => {
    try {
      await sync(req, res, req.url);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) {
        res.writeHead(error instanceof HttpError ? error.status : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api/sync/`;
});
after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
});

const put = (key, body, rev = 'new') => fetch(base + key, { method: 'PUT', headers: { 'X-Sync-Rev': rev }, body });

test('the first upload removes temporary files abandoned by a previous process', async () => {
  assert.ok((await readdir(directory)).includes(orphan));
  const key = '9'.repeat(64);
  assert.equal((await put(key, 'new upload')).status, 200);
  assert.equal((await readdir(directory)).includes(orphan), false);
  assert.equal(await readFile(join(directory, 'unrelated-file'), 'utf8'), 'preserved');
  assert.equal(await (await fetch(base + key)).text(), 'new upload');
});

test('document revisions, conflict responses, conditional downloads, and deletion preserve the protocol', async () => {
  assert.equal((await fetch(base + id)).status, 404);
  const first = await put(id, 'encrypted first document');
  assert.equal(first.status, 200);
  const { rev } = await first.json();
  assert.equal(rev, hash('encrypted first document'));
  const read = await fetch(base + id);
  assert.equal(read.headers.get('x-sync-rev'), rev);
  assert.equal(await read.text(), 'encrypted first document');
  assert.equal((await fetch(base + id, { headers: { 'X-Sync-Rev': rev } })).status, 304);
  const conflict = await put(id, 'stale overwrite');
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).rev, rev);
  assert.equal((await put(id, 'updated document', rev)).status, 200);
  assert.equal((await fetch(base + id, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(base + id)).status, 404);
  assert.equal((await put(id, 'recreated')).status, 200);
});

test('concurrent compare-and-swap writes admit exactly one winner', async () => {
  const key = 'b'.repeat(64);
  const responses = await Promise.all([put(key, 'first contender'), put(key, 'second contender')]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const winner = responses.findIndex((response) => response.status === 200);
  const { rev } = await responses[winner].json();
  const snapshot = await fetch(base + key);
  const bytes = await snapshot.text();
  assert.equal(bytes, winner === 0 ? 'first contender' : 'second contender');
  assert.equal(snapshot.headers.get('x-sync-rev'), hash(bytes));
  assert.equal(hash(bytes), rev);
});

test('photos remain immutable and journal deletion removes their files', async () => {
  const key = 'c'.repeat(64);
  const photo = key + '/pabcdef123';
  assert.equal((await put(photo, 'original photo')).status, 204);
  assert.equal((await put(photo, 'replacement photo')).status, 204);
  assert.equal(await (await fetch(base + photo)).text(), 'original photo');
  assert.equal((await fetch(base + key, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(base + photo)).status, 404);
});

test('empty, oversized, and malformed uploads fail without leaving temporary files', async () => {
  const key = 'd'.repeat(64);
  assert.equal((await put(key, '')).status, 400);
  assert.equal((await put(key + '/pabcdef123', '')).status, 400);
  assert.equal((await put('invalid-key', 'data')).status, 404);
  const status = await new Promise((resolve, reject) => {
    const req = http.request(base + key, { method: 'PUT', headers: { 'Content-Length': 16 * 1024 * 1024 + 1 } }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
  assert.equal(status, 413);
  assert.deepEqual((await readdir(directory)).filter((file) => file.startsWith('.upload-')), []);
});

test('streamed downloads keep their revision and bytes consistent during replacement', async () => {
  const key = 'e'.repeat(64);
  const original = Buffer.alloc(2 * 1024 * 1024, 42);
  const initial = await put(key, original);
  const { rev } = await initial.json();
  const read = await fetch(base + key);
  assert.equal((await put(key, 'new version', rev)).status, 200);
  const bytes = Buffer.from(await read.arrayBuffer());
  assert.deepEqual(bytes, original);
  assert.equal(read.headers.get('x-sync-rev'), hash(bytes));
  assert.equal(await readFile(join(directory, key, 'doc'), 'utf8'), 'new version');
});

test('aborted uploads release capacity and remove partial temporary files', async () => {
  const key = 'f'.repeat(64);
  const req = http.request(base + key, { method: 'PUT', headers: { 'X-Sync-Rev': 'new' } });
  req.on('error', () => {});
  req.write(Buffer.alloc(64 * 1024, 7));
  for (let attempts = 0; attempts < 100; attempts++) {
    if ((await readdir(directory)).some((file) => file.startsWith('.upload-'))) break;
    await delay(10);
  }
  req.destroy();
  for (let attempts = 0; attempts < 100; attempts++) {
    if (!(await readdir(directory)).some((file) => file.startsWith('.upload-'))) break;
    await delay(10);
  }
  assert.deepEqual((await readdir(directory)).filter((file) => file.startsWith('.upload-')), []);
  assert.equal((await put(key, 'after abort')).status, 200);
});

test('chunked uploads over the limit receive 413 and clean up their temporary files', async () => {
  const status = await new Promise((resolve, reject) => {
    const req = http.request(base + '1'.repeat(64), {
      method: 'PUT', headers: { 'Transfer-Encoding': 'chunked', 'X-Sync-Rev': 'new' },
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end(Buffer.alloc(16 * 1024 * 1024 + 1, 3));
  });
  assert.equal(status, 413);
  assert.deepEqual((await readdir(directory)).filter((file) => file.startsWith('.upload-')), []);
});

test('upload admission is bounded, keeps reads available, and recovers after clients abort', async () => {
  const held = ['2', '3'].map((character) => {
    const req = http.request(base + character.repeat(64), { method: 'PUT', headers: { 'X-Sync-Rev': 'new' } });
    req.on('error', () => {});
    req.write(Buffer.alloc(1024, 1));
    return req;
  });
  try {
    for (let attempts = 0; attempts < 100; attempts++) {
      if ((await readdir(directory)).filter((file) => file.startsWith('.upload-')).length === 2) break;
      await delay(10);
    }
    assert.equal((await readdir(directory)).filter((file) => file.startsWith('.upload-')).length, 2);
    const busy = await put('4'.repeat(64), 'over capacity');
    assert.equal(busy.status, 503);
    assert.equal(busy.headers.get('retry-after'), '1');
    assert.equal((await fetch(base + id)).status, 200);
  } finally {
    for (const req of held) req.destroy();
  }
  for (let attempts = 0; attempts < 100; attempts++) {
    if (!(await readdir(directory)).some((file) => file.startsWith('.upload-'))) break;
    await delay(10);
  }
  assert.equal((await put('4'.repeat(64), 'capacity recovered')).status, 200);
});
