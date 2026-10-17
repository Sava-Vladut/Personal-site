import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

// Exercise the real HTTP handler without opening a port or contacting Spotify.
const originalCreateServer = http.createServer;
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
// Saved sign-ins go to a scratch folder, never the app's data/.
const scratch = mkdtempSync(join(tmpdir(), 'mymind-server-'));
Object.assign(process.env, {
  ACCOUNTS_FILE: join(scratch, 'accounts'),
  SESSION_SECRET: 'server-regression-test',
  SPOTIFY_CLIENT_ID: 'test-client',
  SPOTIFY_CLIENT_SECRET: 'test-secret',
  GITHUB_CLIENT_ID: 'gh-client',
  GITHUB_CLIENT_SECRET: 'gh-secret',
  GITHUB_REDIRECT_URI: 'https://example.test/api/github/callback',
  PUBLIC_URL: 'https://example.test',
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
  rmSync(scratch, { recursive: true, force: true });
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

const key = crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest();
function sealedCookie(session, name = 'mm_sp') {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const sealed = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  return name + '=' + Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64url');
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
  const cookie = sealedCookie({ a: 'expired', r: 'shared-refresh', e: 1, u: 'concurrent-user' });
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

async function raw(url, cookie = '', method = 'GET', host) {
  const result = { status: 0, headers: {}, body: null };
  await handler({ url, method, headers: { cookie, host } }, {
    setHeader(name, value) { result.headers[name] = value; },
    writeHead(status, headers) { this.headersSent = true; result.status = status; Object.assign(result.headers, headers); },
    end(body) { result.body = body ? JSON.parse(body) : null; },
  });
  return result;
}

test('Spotify login hops to the redirect URI’s domain first, so the state cookie lands where Spotify returns', async () => {
  const hop = await raw('/api/spotify/connect?back=%23%2Fmedia', '', 'GET', 'other.test');
  assert.equal(hop.headers.Location, 'https://example.test/api/spotify/connect?back=%23%2Fmedia');
  assert.equal(hop.headers['Set-Cookie'].length, 0);

  const go = await raw('/api/spotify/connect?back=%23%2Fmedia', '', 'GET', 'example.test');
  const auth = new URL(go.headers.Location);
  assert.equal(auth.origin, 'https://accounts.spotify.com');
  assert.equal(auth.searchParams.get('redirect_uri'), 'https://example.test/api/spotify/callback');
  assert.equal(go.headers['Set-Cookie'].length, 1);
});

test('GitHub login sends you to GitHub asking for repo access, then stores the token in a sealed cookie', async () => {
  // started from another domain: hop to the callback's domain first
  const hop = await raw('/api/github/connect', '', 'GET', 'other.test');
  assert.equal(hop.headers.Location, 'https://example.test/api/github/connect');
  assert.equal(hop.headers['Set-Cookie'].length, 0);

  const go = await raw('/api/github/connect', '', 'GET', 'example.test');
  assert.equal(go.status, 302);
  const auth = new URL(go.headers.Location);
  assert.equal(auth.origin + auth.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(auth.searchParams.get('client_id'), 'gh-client');
  assert.equal(auth.searchParams.get('scope'), 'repo');
  assert.equal(auth.searchParams.get('redirect_uri'), 'https://example.test/api/github/callback');
  const state = auth.searchParams.get('state');
  const stateCookie = go.headers['Set-Cookie'][0].split(';')[0];

  // a callback whose state doesn't match is refused without contacting GitHub
  globalThis.fetch = async () => assert.fail('must not exchange a code for a bad state');
  const forged = await raw('/api/github/callback?code=abc&state=nope', stateCookie);
  assert.match(forged.headers.Location, /\?github=error$/);

  globalThis.fetch = async (url, options) => {
    // the account's id is asked for, so other devices can fall back on this sign-in
    if (String(url) === 'https://api.github.com/user') return Response.json({ id: 7, login: 'octo' });
    assert.equal(String(url), 'https://github.com/login/oauth/access_token');
    assert.equal(new URLSearchParams(options.body).get('code'), 'abc');
    return Response.json({ access_token: 'gho_secret', scope: 'repo' });
  };
  const back = await raw(`/api/github/callback?code=abc&state=${state}`, stateCookie);
  assert.match(back.headers.Location, /#\/settings\?github=connected$/);
  const login = back.headers['Set-Cookie'].find((c) => c.startsWith('mm_gh='));
  assert.ok(login && !login.includes('gho_secret'), 'the token is sealed');
  assert.match(login, /HttpOnly/);

  const cancelled = await raw(`/api/github/callback?error=access_denied&state=${state}`, stateCookie);
  assert.match(cancelled.headers.Location, /\?github=cancelled$/);
});

/** GitHub refusing every token, and confirming through its token check that they're gone. Records the tokens asked with. */
const revokedGithub = (asked = []) => async (url, options) => {
  if (String(url) === 'https://api.github.com/applications/gh-client/token') {
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('gh-client:gh-secret').toString('base64'));
    return Response.json({ message: 'Not Found' }, { status: 404 });
  }
  asked.push(options.headers.Authorization);
  return Response.json({ message: 'Bad credentials' }, { status: 401 });
};

test('GitHub status reports public and private repo counts, and whether private ones are visible', async () => {
  const cookie = sealedCookie({ a: 'gho_secret' }, 'mm_gh');
  assert.deepEqual((await raw('/api/github/status')).body, { configured: true, connected: false });

  const scoped = { headers: { 'x-oauth-scopes': 'repo' } };
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.github.com/user');
    assert.equal(options.headers.Authorization, 'Bearer gho_secret');
    return Response.json({ login: 'octo', public_repos: 12, owned_private_repos: 5 }, scoped);
  };
  assert.deepEqual((await raw('/api/github/status', cookie)).body, {
    configured: true, connected: true, user: { name: 'octo' }, public: 12, private: 5, privateVisible: true,
  });

  // repo scope but no count in the profile: count the private repos themselves
  globalThis.fetch = async (url) => String(url) === 'https://api.github.com/user'
    ? Response.json({ login: 'octo', public_repos: 12 }, scoped)
    : (assert.match(String(url), /\/user\/repos\?affiliation=owner&visibility=private&per_page=1$/),
      Response.json([{}], { headers: { link: '<https://api.github.com/user/repos?per_page=1&page=7>; rel="last"' } }));
  assert.equal((await raw('/api/github/status', cookie)).body.private, 7);

  // a token without the repo scope can't see private repos, whatever the profile says
  globalThis.fetch = async () => Response.json({ login: 'octo', public_repos: 12, owned_private_repos: 5 }, { headers: { 'x-oauth-scopes': 'read:user' } });
  const limited = (await raw('/api/github/status', cookie)).body;
  assert.equal(limited.privateVisible, false);
  assert.equal(limited.private, undefined);

  // a revoked token, which GitHub confirms is gone, signs the browser out
  globalThis.fetch = revokedGithub();
  const revoked = await raw('/api/github/status', cookie);
  assert.equal(revoked.body.connected, false);
  assert.match(revoked.headers['Set-Cookie'][0], /^mm_gh=; .*Max-Age=0/);

  const out = await raw('/api/github/disconnect', cookie, 'POST');
  assert.equal(out.status, 204);
  assert.match(out.headers['Set-Cookie'], /^mm_gh=; .*Max-Age=0/);
});

test('GitHub repos, commits and README are read with the sign-in cookie and trimmed down', async () => {
  const cookie = sealedCookie({ a: 'gho_secret' }, 'mm_gh');
  const repo = (id, name, extra = {}) => ({ id, name, full_name: 'octo/' + name, owner: { login: 'octo' }, description: 'd', language: 'Go', private: false, stargazers_count: 3, pushed_at: '2026-10-01T00:00:00Z', default_branch: 'main', html_url: `https://github.com/octo/${name}`, token: 'leak', ...extra });
  const seen = [];
  globalThis.fetch = async (raw, options) => {
    const url = new URL(raw);
    seen.push(url.pathname + url.search);
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(options.headers.Authorization, 'Bearer gho_secret');
    if (url.pathname === '/user/repos') {
      // two full pages, then a short one: every page is read
      const page = Number(url.searchParams.get('page'));
      assert.equal(url.searchParams.get('affiliation'), 'owner');
      return Response.json(Array.from({ length: page < 3 ? 100 : 1 }, (_, i) => repo(page * 1000 + i, 'r' + i, i === 0 ? { private: true } : {})));
    }
    if (url.pathname === '/repositories/42/commits') {
      return Response.json([{ sha: 'a'.repeat(40), html_url: 'https://github.com/octo/x/commit/a', commit: { message: 'Fix it\n\nbecause', author: { name: 'Octo', date: '2026-10-01T10:00:00Z' } } }], { headers: { link: '<https://api.github.com/x?page=2>; rel="next"' } });
    }
    if (url.pathname === '/repositories/43/commits') return Response.json({ message: 'Git Repository is empty.' }, { status: 409 });
    if (url.pathname === '/repositories/42/readme') {
      assert.equal(options.headers.Accept, 'application/vnd.github.raw+json');
      return new Response('# Hello', { status: 200 });
    }
    if (url.pathname === '/repositories/44/readme') return Response.json({ message: 'Not Found' }, { status: 404 });
    if (url.pathname === '/repositories/42') return Response.json(repo(42, 'x'));
    return Response.json({ message: 'Not Found' }, { status: 404 });
  };

  const list = await raw('/api/github/repos', cookie);
  assert.equal(list.status, 200);
  assert.equal(list.body.items.length, 201);
  assert.equal(list.body.items[0].private, true);
  assert.equal(list.body.items[0].token, undefined, 'only the fields the app uses are passed on');
  assert.deepEqual(Object.keys(list.body.items[1]).sort(), ['archived', 'branch', 'description', 'fork', 'id', 'language', 'name', 'owner', 'private', 'pushed', 'stars', 'url']);

  assert.equal((await raw('/api/github/repos/42', cookie)).body.name, 'x');
  const commits = await raw('/api/github/repos/42/commits?page=1', cookie);
  assert.deepEqual([commits.body.items[0].author, commits.body.items[0].sha.length, commits.body.next], ['Octo', 40, 2]);
  assert.deepEqual((await raw('/api/github/repos/43/commits', cookie)).body, { items: [] }, 'an empty repo has no commits to list');
  assert.equal((await raw('/api/github/repos/42/readme', cookie)).body.text, '# Hello');
  assert.deepEqual((await raw('/api/github/repos/44/readme', cookie)).body, { text: null });

  // not signed in, and ids that aren't numbers, never reach GitHub
  const before = seen.length;
  assert.equal((await raw('/api/github/repos')).status, 401);
  assert.equal((await raw('/api/github/repos/../../user', cookie)).status, 404);
  assert.equal((await raw('/api/github/repos/42/commits?page=0', cookie)).status, 400);
  assert.equal(seen.length, before);

  // a refused token signs this browser out
  globalThis.fetch = revokedGithub();
  const refused = await raw('/api/github/repos', cookie);
  assert.equal(refused.status, 401);
  assert.match(refused.headers['Set-Cookie'][0], /^mm_gh=; .*Max-Age=0/);
});

test('a Spotify access token refused before its expiry is renewed and the request tried again', async () => {
  const cookie = sealedCookie({ a: 'revoked-early', r: 'early-refresh', e: Date.now() + 3600_000, u: 'early-user', sc: 'x' });
  let exchanges = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://accounts.spotify.com/')) {
      exchanges++;
      assert.equal(new URLSearchParams(options.body).get('refresh_token'), 'early-refresh');
      return Response.json({ access_token: 'fresh', expires_in: 3600 });
    }
    if (options.headers.Authorization === 'Bearer revoked-early') return Response.json({ error: { message: 'expired' } }, { status: 401 });
    return Response.json({ id: 'early-user', display_name: 'Early' });
  };
  const status = await raw('/api/spotify/status', cookie);
  assert.equal(exchanges, 1);
  assert.equal(status.body.connected, true);
  assert.equal(status.body.user.name, 'Early');
  assert.ok(status.headers['Set-Cookie'].some((c) => c.startsWith('mm_sp=') && !c.includes('Max-Age=0')), 'the renewed session replaces the cookie');
});

test('a Spotify cookie whose refresh token was lost carries on with the account’s newest sign-in', async () => {
  // the phone renews its session; its answer is what the server now remembers for the account
  globalThis.fetch = async (url, options) => String(url).startsWith('https://accounts.spotify.com/')
    ? (assert.equal(new URLSearchParams(options.body).get('refresh_token'), 'phone-refresh'), Response.json({ access_token: 'phone-new', refresh_token: 'phone-rotated', expires_in: 3600 }))
    : Response.json({ tracks: { items: [] } });
  const phone = sealedCookie({ a: 'phone-old', r: 'phone-refresh', e: 1, u: 'shared-user' });
  assert.equal((await request('/api/spotify/search?q=x', phone)).status, 200);

  // the desktop's own tokens have since been turned down by Spotify
  const desktop = sealedCookie({ a: 'desktop-old', r: 'desktop-refresh', e: 1, u: 'shared-user' });
  const headers = {};
  globalThis.fetch = async (url, options) => {
    assert.ok(!String(url).startsWith('https://accounts.spotify.com/'), 'the newest sign-in is still valid, so nothing is renewed');
    assert.equal(options.headers.Authorization, 'Bearer phone-new');
    return Response.json({ tracks: { items: [] } });
  };
  assert.equal((await request('/api/spotify/search?q=x', desktop, headers)).status, 200);
  assert.ok(headers['Set-Cookie']?.[0].startsWith('mm_sp='), 'the desktop is handed the newest sign-in');

  // a cookie for another account never borrows it
  const stranger = sealedCookie({ a: 'other-old', r: 'other-refresh', e: 1, u: 'other-user' });
  globalThis.fetch = async () => Response.json({ error: 'invalid_grant' }, { status: 400 });
  assert.equal((await request('/api/spotify/search?q=x', stranger)).status, 401);
});

test('Spotify being unreachable while renewing reports the sign-in as kept, not signed out', async () => {
  const cookie = sealedCookie({ a: 'expired', r: 'flaky-refresh', e: 1, u: 'flaky-user' });
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  const status = await raw('/api/spotify/status', cookie);
  assert.equal(status.status, 200);
  assert.equal(status.body.connected, true);
  assert.match(status.body.error, /reach Spotify/);
  assert.ok(!status.headers['Set-Cookie']?.some((c) => c.startsWith('mm_sp=')), 'the cookie is left alone');
});

test('a GitHub token revoked by newer sign-ins elsewhere is swapped for the account’s newest one', async () => {
  // the phone signs in: the newest token for account 99
  const go = await raw('/api/github/connect', '', 'GET', 'example.test');
  const state = new URL(go.headers.Location).searchParams.get('state');
  globalThis.fetch = async (url) => String(url) === 'https://api.github.com/user'
    ? Response.json({ id: 99, login: 'octo' })
    : Response.json({ access_token: 'gho_phone' });
  await raw(`/api/github/callback?code=abc&state=${state}`, go.headers['Set-Cookie'][0].split(';')[0]);

  // the desktop's older token has been revoked by GitHub
  const desktop = sealedCookie({ a: 'gho_desktop', u: '99' }, 'mm_gh');
  globalThis.fetch = async (url, options) => options.headers.Authorization === 'Bearer gho_phone'
    ? Response.json({ id: 99, login: 'octo', public_repos: 1 }, { headers: { 'x-oauth-scopes': 'repo' } })
    : Response.json({ message: 'Bad credentials' }, { status: 401 });
  const status = await raw('/api/github/status', desktop);
  assert.equal(status.body.connected, true);
  assert.equal(status.body.user.name, 'octo');
  assert.ok(status.headers['Set-Cookie'].some((c) => c.startsWith('mm_gh=') && !c.includes('Max-Age=0')), 'the desktop is handed the newest token');

  // once every token for the account is refused, the browser is signed out and the saved one forgotten
  globalThis.fetch = revokedGithub();
  const gone = await raw('/api/github/repos', desktop);
  assert.equal(gone.status, 401);
  assert.match(gone.headers['Set-Cookie'][0], /^mm_gh=; .*Max-Age=0/);
  const asked = [];
  globalThis.fetch = revokedGithub(asked);
  await raw('/api/github/repos', desktop);
  assert.deepEqual(asked, ['Bearer gho_desktop'], 'nothing saved is left to try');
});

test('GitHub being unreachable reports the sign-in as kept, not signed out', async () => {
  const cookie = sealedCookie({ a: 'gho_secret', u: '5' }, 'mm_gh');
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  const status = await raw('/api/github/status', cookie);
  assert.equal(status.status, 200);
  assert.equal(status.body.connected, true);
  assert.match(status.body.error, /reach GitHub/);
  assert.ok(!status.headers['Set-Cookie']?.length, 'the cookie is left alone');
});

test('a GitHub refusal that GitHub can’t confirm keeps the sign-in instead of signing out', async () => {
  const cookie = sealedCookie({ a: 'gho_alive', u: '31', t: Date.now() }, 'mm_gh');
  // the token check says the token is still valid: the 401 was a hiccup
  globalThis.fetch = async (url) => String(url).includes('/applications/')
    ? Response.json({ id: 1 })
    : Response.json({ message: 'Bad credentials' }, { status: 401 });
  const status = await raw('/api/github/status', cookie);
  assert.equal(status.body.connected, true);
  assert.match(status.body.error, /Try again/);
  assert.ok(!status.headers['Set-Cookie']?.length, 'the cookie is left alone');
  const repos = await raw('/api/github/repos', cookie);
  assert.equal(repos.status, 503, 'a retryable error, not a sign-out');
  assert.ok(!repos.headers['Set-Cookie']?.length);

  // the token check itself can't be reached
  globalThis.fetch = async (url) => {
    if (String(url).includes('/applications/')) throw new TypeError('fetch failed');
    return Response.json({ message: 'Bad credentials' }, { status: 401 });
  };
  const unsure = await raw('/api/github/repos', cookie);
  assert.equal(unsure.status, 502);
  assert.ok(!unsure.headers['Set-Cookie']?.length);
});

test('a GitHub cookie in use is written again before it can expire, and an unreadable one is dropped', async () => {
  globalThis.fetch = async () => Response.json({ login: 'octo', id: 8 }, { headers: { 'x-oauth-scopes': 'repo' } });
  const stale = await raw('/api/github/status', sealedCookie({ a: 'gho_old', u: '8', t: Date.now() - 40 * 86400_000 }, 'mm_gh'));
  const renewed = stale.headers['Set-Cookie'].find((c) => c.startsWith('mm_gh='));
  assert.match(renewed, /Max-Age=31536000/);
  const fresh = await raw('/api/github/status', sealedCookie({ a: 'gho_new', u: '8', t: Date.now() }, 'mm_gh'));
  assert.ok(!fresh.headers['Set-Cookie']?.length, 'a recently written cookie is left as it is');

  globalThis.fetch = async () => assert.fail('an unreadable cookie never reaches GitHub');
  const broken = await raw('/api/github/status', 'mm_gh=not-a-sealed-value');
  assert.equal(broken.body.connected, false);
  assert.match(broken.headers['Set-Cookie'][0], /^mm_gh=; .*Max-Age=0/);
});
