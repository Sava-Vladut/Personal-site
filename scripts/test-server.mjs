import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { after, test } from 'node:test';

// Exercise the real HTTP handler without opening a port or contacting Spotify.
const originalCreateServer = http.createServer;
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
Object.assign(process.env, {
  SESSION_SECRET: 'server-regression-test',
  SPOTIFY_CLIENT_ID: 'test-client',
  SPOTIFY_CLIENT_SECRET: 'test-secret',
});
let handler;
http.createServer = (callback) => {
  handler = callback;
  return { listen() {} };
};
try {
  await import('../server/index.js');
} finally {
  http.createServer = originalCreateServer;
}
after(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

const iv = crypto.randomBytes(12);
const key = crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest();
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const sealed = Buffer.concat([
  cipher.update(JSON.stringify({ a: 'test-token', e: Date.now() + 3600_000, u: 'test-user' })),
  cipher.final(),
]);
const sessionCookie = 'mm_sp=' + Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64url');

async function request(url) {
  const result = { status: 0, body: null };
  await handler({ url, method: 'GET', headers: { cookie: sessionCookie } }, {
    setHeader() {},
    writeHead(status) { result.status = status; },
    end(body) { result.body = JSON.parse(body); },
  });
  return result;
}

function upstream(total, kind) {
  const offsets = [];
  globalThis.fetch = async (raw) => {
    const url = new URL(raw);
    assert.equal(url.origin, 'https://api.spotify.com');
    const offset = Number(url.searchParams.get('offset'));
    const limit = Number(url.searchParams.get('limit'));
    offsets.push(offset);
    const items = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => {
      const id = String(offset + i).padStart(22, '0');
      if (kind === 'playlists') return { id, name: `Playlist ${offset + i}`, owner: { id: 'test-user' } };
      const track = { id, name: `Track ${offset + i}`, type: 'track', artists: [] };
      return kind === 'search' ? track : { item: track };
    });
    const page = { offset, limit, items, next: offset + limit < total ? 'next-page' : null };
    return Response.json(kind === 'search' ? { tracks: page } : page);
  };
  return offsets;
}

test('malformed request URLs return 400 and the next health request succeeds', async () => {
  for (const url of ['//[', 'http://[', '//%']) {
    const response = await request(url);
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'Bad request URL');
  }
  assert.deepEqual(await request('/api/health'), { status: 200, body: { ok: true } });
});

test('playlist items paginate past 1050 without repeating songs', async () => {
  const offsets = upstream(1101, 'items');
  const ids = [];
  let offset = 1000;
  while (offset !== undefined) {
    assert.ok(offsets.length < 4, 'pagination must terminate');
    const response = await request(`/api/spotify/playlists/abcdefghijklmnopqrstuv/items?offset=${offset}`);
    assert.equal(response.status, 200);
    ids.push(...response.body.items.map((item) => item.id));
    offset = response.body.next;
  }
  assert.deepEqual(offsets, [1000, 1050, 1100]);
  assert.equal(ids.length, 101);
  assert.equal(new Set(ids).size, ids.length);
});

test('playlist listings pass through larger offsets and stop at their own limit', async () => {
  const offsets = upstream(100_100, 'playlists');
  const middle = await request('/api/spotify/playlists?offset=1050');
  assert.equal(middle.status, 200);
  assert.equal(middle.body.next, 1100);
  const last = await request('/api/spotify/playlists?offset=100000');
  assert.equal(last.status, 200);
  assert.equal(last.body.next, undefined);
  assert.equal((await request('/api/spotify/playlists?offset=100050')).status, 400);
  assert.deepEqual(offsets, [1050, 100_000]);
});

test('search stops advertising pages past its maximum offset', async () => {
  const offsets = upstream(2000, 'search');
  const middle = await request('/api/spotify/search?q=test&offset=990');
  assert.equal(middle.body.next, 1000);
  const last = await request('/api/spotify/search?q=test&offset=1000');
  assert.equal(last.status, 200);
  assert.equal(last.body.next, undefined);
  assert.equal((await request('/api/spotify/search?q=test&offset=1010')).status, 400);
  assert.deepEqual(offsets, [990, 1000]);
});

test('invalid offsets cannot silently replay a page or reach Spotify', async () => {
  const offsets = upstream(1101, 'items');
  for (const offset of ['-1', '1.5', 'Infinity', 'NaN', '9007199254740992', '10junk']) {
    assert.equal((await request(`/api/spotify/playlists/abcdefghijklmnopqrstuv/items?offset=${offset}`)).status, 400);
  }
  assert.deepEqual(offsets, []);
});
