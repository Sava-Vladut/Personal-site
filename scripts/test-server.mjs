import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
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

const key = crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest();
function sealedCookie(session) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const sealed = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  return 'mm_sp=' + Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64url');
}
const sessionCookie = sealedCookie({ a: 'test-token', e: Date.now() + 3600_000, u: 'test-user' });

async function request(url, cookie = sessionCookie, responseHeaders) {
  const result = { status: 0, body: null };
  await handler({ url, method: 'GET', headers: { cookie } }, {
    setHeader(name, value) { if (responseHeaders) responseHeaders[name] = value; },
    writeHead(status, headers) { this.headersSent = true; result.status = status; if (responseHeaders) Object.assign(responseHeaders, headers); },
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

test('voice files outside the allowlist are refused without contacting anyone, and the page may use the microphone', async () => {
  let fetched = 0;
  globalThis.fetch = async () => { fetched++; throw new Error('not expected'); };
  for (const path of ['/voice/models/someone/else/resolve/main/config.json', '/voice/models/onnx-community/whisper-tiny.en/resolve/main/onnx/model.onnx', '/voice/ort-9.9.9/ort-wasm-simd-threaded.wasm', '/voice/models/onnx-community/whisper-tiny.en/resolve/main/..%2Fsecret.json']) {
    const headers = {};
    const response = await request(path, undefined, headers);
    assert.equal(response.status, 404, path);
    assert.match(headers['Permissions-Policy'], /microphone=\(self\)/);
    assert.match(headers['Content-Security-Policy'], /script-src 'self' 'wasm-unsafe-eval'/);
  }
  assert.equal(fetched, 0);
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

test('malformed unrelated cookies do not break a valid Spotify session', async () => {
  upstream(1, 'search');
  assert.equal((await request('/api/spotify/search?q=test', `broken=%ZZ; ${sessionCookie}`)).status, 200);
  assert.equal((await request('/api/spotify/search?q=test', 'mm_sp=%ZZ')).status, 401);
});

test('concurrent expired sessions share one refresh and each receive the new cookie', async () => {
  const cookie = sealedCookie({ a: 'expired', r: 'shared-refresh', e: 1, u: 'test-user' });
  let exchanges = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://accounts.spotify.com/')) {
      exchanges++;
      await new Promise((resolve) => setImmediate(resolve));
      return Response.json({ access_token: 'renewed', refresh_token: 'rotated', expires_in: 3600 });
    }
    assert.equal(options.headers.Authorization, 'Bearer renewed');
    return Response.json({ tracks: { items: [] } });
  };
  const headers = Array.from({ length: 8 }, () => ({}));
  const results = await Promise.all(headers.map((h) => request('/api/spotify/search?q=test', cookie, h)));
  assert.equal(exchanges, 1);
  assert.ok(results.every((r) => r.status === 200));
  assert.ok(headers.every((h) => h['Set-Cookie']?.[0].startsWith('mm_sp=')));
});

test('failed refreshes are evicted and transient failures preserve the session', async () => {
  const cookie = sealedCookie({ a: 'expired', r: 'retry-refresh', e: 1 });
  let exchanges = 0;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('https://accounts.spotify.com/')) {
      exchanges++;
      return exchanges === 1 ? Response.json({ error: 'unavailable' }, { status: 503 })
        : Response.json({ access_token: 'renewed', expires_in: 3600 });
    }
    return Response.json({ tracks: { items: [] } });
  };
  assert.equal((await request('/api/spotify/search?q=test', cookie)).status, 502);
  assert.equal((await request('/api/spotify/search?q=test', cookie)).status, 200);
  assert.equal(exchanges, 2);
  globalThis.fetch = async () => Response.json({ error: 'invalid_grant' }, { status: 400 });
  assert.equal((await request('/api/spotify/search?q=test', cookie)).status, 401);
});

test('a refreshed cookie survives a subsequent Spotify API failure', async () => {
  const cookie = sealedCookie({ a: 'expired', r: 'rotating-refresh', e: 1 });
  const headers = {};
  globalThis.fetch = async (url) => String(url).startsWith('https://accounts.spotify.com/')
    ? Response.json({ access_token: 'renewed', refresh_token: 'rotated', expires_in: 3600 })
    : Response.json({ error: { message: 'Temporarily unavailable' } }, { status: 503 });
  assert.equal((await request('/api/spotify/search?q=test', cookie, headers)).status, 502);
  assert.ok(headers['Set-Cookie']?.[0].startsWith('mm_sp='));
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).startsWith('https://api.spotify.com/'), 'the renewed session must not refresh again');
    assert.equal(options.headers.Authorization, 'Bearer renewed');
    return Response.json({ tracks: { items: [] } });
  };
  assert.equal((await request('/api/spotify/search?q=test', headers['Set-Cookie'][0].split(';')[0])).status, 200);
});

test('Spotify deadlines cover stalled headers and stalled response bodies', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => originalSetTimeout(callback, delay === 15_000 ? 20 : delay, ...args);
  try {
    for (const stalledBody of [false, true]) {
      let signal;
      globalThis.fetch = async (_url, options) => {
        signal = options.signal;
        if (!stalledBody) return new Promise(() => {});
        return { json: () => new Promise(() => {}) };
      };
      const response = await request('/api/spotify/search?q=test');
      assert.equal(response.status, 504);
      assert.equal(signal.aborted, true);
      assert.equal((await request('/api/health')).status, 200);
    }
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});

test('Spotify short-link redirects cancel unused bodies and preserve public resolution', async () => {
  let cancelled = false;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('https://spotify.link/')) return {
      headers: new Headers({ location: 'https://open.spotify.com/track/abcdefghijklmnopqrstuv' }),
      body: { cancel: async () => { cancelled = true; } },
    };
    assert.ok(cancelled);
    return Response.json({ title: 'Test track', thumbnail_url: 'https://example.com/cover.jpg' });
  };
  const response = await request('/api/spotify/resolve?url=https://spotify.link/example', '');
  assert.equal(response.status, 200);
  assert.equal(response.body.title, 'Test track');
});

test('malformed successful Spotify responses fail cleanly instead of returning empty results or server errors', async () => {
  for (const body of ['null', '[]', '"unexpected"', '<html>upstream failure</html>']) {
    globalThis.fetch = async () => new Response(body);
    assert.equal((await request('/api/spotify/search?q=test')).status, 502, body);
    const cookie = sealedCookie({ a: 'expired', r: 'invalid-response-refresh', e: 1 });
    assert.equal((await request('/api/spotify/search?q=test', cookie)).status, 502, body);
  }
  globalThis.fetch = async () => new Response('Service unavailable', { status: 503 });
  assert.equal((await request('/api/spotify/search?q=test')).status, 502);
});

test('an invalid Spotify short-link redirect returns a client error', async () => {
  globalThis.fetch = async () => ({ headers: new Headers({ location: 'http://[' }), body: { cancel: async () => {} } });
  assert.equal((await request('/api/spotify/resolve?url=https://spotify.link/example', '')).status, 400);
});

test('a Spotify 204 response still represents no currently playing item', async () => {
  globalThis.fetch = async (url) => String(url).includes('/currently-playing')
    ? new Response(null, { status: 204 }) : Response.json({ items: [] });
  const cookie = sealedCookie({ a: 'test-token', e: Date.now() + 3600_000, sc: 'user-read-currently-playing user-read-recently-played' });
  const response = await request('/api/spotify/now', cookie);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { playing: false, recent: [] });
});

test('SIGTERM lets an in-flight API response finish before exiting', { timeout: 10_000 }, async (t) => {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import http from 'node:http';
    import { once } from 'node:events';
    const createServer = http.createServer;
    http.createServer = (...args) => {
      const server = createServer(...args);
      const listen = server.listen;
      server.listen = (_port, ready) => listen.call(server, 0, '127.0.0.1', () => {
        ready();
        process.send({ port: server.address().port });
      });
      return server;
    };
    globalThis.fetch = async () => {
      const release = once(process, 'message');
      process.send({ fetching: true });
      await release;
      return Response.json({ tracks: { items: [] } });
    };
    await import('./server/index.js');
    process.on('SIGTERM', () => process.send({ stopping: true }));
  `], { cwd: new URL('..', import.meta.url), env: { ...process.env, PUBLIC_URL: 'http://localhost' }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  const exited = once(child, 'exit');
  const [{ port }] = await Promise.race([once(child, 'message'), exited.then(([code]) => { throw new Error(`Server exited before listening (${code}): ${stderr}`); })]);
  const fetching = once(child, 'message');
  const response = originalFetch(`http://127.0.0.1:${port}/api/spotify/search?q=test`, {
    headers: { cookie: sessionCookie }, signal: AbortSignal.timeout(5_000),
  });
  assert.equal((await fetching)[0].fetching, true);
  const stopping = once(child, 'message');
  child.kill('SIGTERM');
  assert.equal((await stopping)[0].stopping, true);
  child.send({ release: true });
  const result = await response;
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { items: [] });
  assert.deepEqual(await exited, [0, null]);
});
