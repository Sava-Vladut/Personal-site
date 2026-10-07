import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createGithubHandler } from '../server/github.js';

const root = await mkdtemp(join(tmpdir(), 'mm-github-'));
after(() => rm(root, { recursive: true, force: true }));

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1);
const iso = (ms) => new Date(ms).toISOString();
const commit = (sha, at, m = `Commit ${sha}`) => ({ sha, commit: { message: `${m}\n\nMore words`, author: { date: iso(at), name: 'Me' } }, author: { login: 'me' } });

/** A small GitHub: two public repositories (one empty), a private one, sign-in, and a log of every request. */
function fakeGithub() {
  const state = {
    calls: [],
    pushed: { app: T0, empty: T0 - 10 * DAY },
    commits: { app: [commit('c3', T0), commit('c2', T0 - DAY), commit('c1', T0 - 3 * DAY)], secret: [commit('p1', T0 - DAY, 'Private work')] },
    limited: false,
    tokens: new Map([['code-me', 'tok-me'], ['code-other', 'tok-other']]),
    users: { 'tok-me': 'me', 'tok-other': 'someone-else', 'tok-new': 'me' },
    revoked: [],
    refresh: { 'r-1': { access_token: 'tok-new', expires_in: 28800, refresh_token: 'r-2' } },
  };
  const reply = (status, body, headers = {}) => ({ status, ok: status >= 200 && status < 300, headers: new Headers(headers), json: async () => body });
  const list = () => [
    { name: 'app', html_url: 'https://github.com/me/app', language: 'TypeScript', stargazers_count: 2, pushed_at: iso(state.pushed.app), created_at: iso(T0 - 30 * DAY), description: 'An app' },
    { name: 'empty', html_url: 'https://github.com/me/empty', pushed_at: iso(state.pushed.empty), created_at: iso(T0 - 10 * DAY) },
  ];
  const secret = { name: 'secret', private: true, html_url: 'https://github.com/me/secret', pushed_at: iso(T0 - DAY), created_at: iso(T0 - 5 * DAY) };
  state.request = async (url, init = {}) => {
    const u = new URL(url);
    const auth = new Headers(init.headers).get('authorization') || '';
    const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    state.calls.push(`${init.method || 'GET'} ${u.pathname}${u.search}${tok ? ' as ' + tok : ''}`);
    if (u.hostname === 'github.com' && u.pathname === '/login/oauth/access_token') {
      const p = new URLSearchParams(init.body);
      if (p.get('client_secret') !== 'shh') return reply(401, { error: 'incorrect_client_credentials' });
      if (p.get('grant_type') === 'refresh_token') return reply(200, state.refresh[p.get('refresh_token')] ?? { error: 'bad_refresh_token' });
      const t = state.tokens.get(p.get('code'));
      return reply(200, t ? { access_token: t, token_type: 'bearer', scope: 'repo,read:user' } : { error: 'bad_verification_code' });
    }
    if (init.method === 'DELETE' && u.pathname === '/applications/id-1/token') {
      state.revoked.push(JSON.parse(init.body).access_token);
      return reply(204, null);
    }
    if (state.limited) return reply(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.round((T0 + DAY) / 1000)) });
    if (tok && !state.users[tok]) return reply(401, { message: 'Bad credentials' });
    if (u.pathname === '/user') return tok ? reply(200, { login: state.users[tok], avatar_url: 'https://avatars.example/me' }) : reply(401, {});
    if (u.pathname === '/users/me') return reply(200, { login: 'me', name: 'Me Myself', avatar_url: 'https://avatars.example/me', html_url: 'https://github.com/me', followers: 3, created_at: iso(T0 - 400 * DAY) });
    if (u.pathname === '/users/me/repos') return reply(200, [...list(), secret]); // even if GitHub ever sent one, it's dropped
    if (u.pathname === '/user/repos') return tok ? reply(200, [list()[0], secret, list()[1]]) : reply(401, {});
    if (u.pathname === '/repos/me/app/commits') return reply(200, state.commits.app);
    if (u.pathname === '/repos/me/secret/commits') return tok ? reply(200, state.commits.secret) : reply(404, {});
    if (u.pathname === '/repos/me/empty/commits') return reply(409, { message: 'Git Repository is empty.' });
    if (u.pathname.endsWith('/languages')) return reply(200, u.pathname.includes('/app/') ? { TypeScript: 9000, CSS: 1000 } : {});
    return reply(404, { message: 'Not Found' });
  };
  return state;
}

// stand-ins for the server's sealed cookies
const seal = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const unseal = (s) => { try { return JSON.parse(Buffer.from(s, 'base64url').toString()); } catch { return null; } };
const readCookies = (req) => Object.fromEntries((req.headers?.cookie || '').split(';').filter(Boolean).map((p) => p.trim().split('=')).map(([k, v]) => [k, decodeURIComponent(v)]));
const cookie = (name, value, maxAge, path) => `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}`;
const auth = { clientId: 'id-1', clientSecret: 'shh', redirectUri: 'https://site/api/github/callback', appUrl: 'https://site', seal, unseal, readCookies, cookie };

const call = async (handler, path, { search = '', method = 'GET', jar = '' } = {}) => {
  let out;
  const res = {
    writeHead: (status, headers = {}) => (out = { status, headers }),
    end: (body) => (out.body = body ? JSON.parse(body) : null),
  };
  await handler({ method, headers: { cookie: jar } }, res, path, new URL('http://x' + path + search));
  out.cookies = [].concat(out.headers['Set-Cookie'] ?? []);
  return out;
};
/** The cookie a response sets, as a browser would send it back ('' when it clears it). */
const jarOf = (out, name) => {
  const c = out.cookies.find((x) => x.startsWith(name + '='));
  return c && !c.includes('Max-Age=0') ? c.split(';')[0] : '';
};

test('sums up the public repositories with their commits and languages', async () => {
  const gh = fakeGithub();
  let clock = T0 + 60_000;
  const handler = createGithubHandler({ user: 'me', cacheFile: join(root, 'a.json'), request: gh.request, now: () => clock });
  const { status, body } = await call(handler, '/api/github');
  assert.equal(status, 200);
  assert.equal(body.profile.name, 'Me Myself');
  assert.deepEqual(body.repos.map((r) => r.name), ['app', 'empty'], 'private repositories are never listed');
  assert.equal(body.viewer, null);
  assert.equal(body.signIn, false);
  const app = body.repos[0];
  assert.equal(app.commits, 3);
  assert.deepEqual(app.times, [T0 / 1000, (T0 - DAY) / 1000, (T0 - 3 * DAY) / 1000]);
  assert.deepEqual(app.languages, { TypeScript: 9000, CSS: 1000 });
  assert.equal(app.last.m, 'Commit c3', 'only the first line of a message');
  assert.equal(body.repos[1].commits, 0);
  assert.deepEqual(body.recent.map((c) => c.sha), ['c3', 'c2', 'c1']);
  assert.ok(JSON.parse(await readFile(join(root, 'a.json'), 'utf8')).repos.app, 'kept on disk');

  // within five minutes nothing is asked again
  const before = gh.calls.length;
  clock += 60_000;
  await call(handler, '/api/github');
  assert.equal(gh.calls.length, before);
});

test('after a push only the new commits are fetched, and a restart reads the disk instead of GitHub', async () => {
  const gh = fakeGithub();
  let clock = T0 + 60_000;
  const file = join(root, 'b.json');
  const first = createGithubHandler({ user: 'me', cacheFile: file, request: gh.request, now: () => clock });
  await call(first, '/api/github');

  gh.pushed.app = T0 + DAY;
  gh.commits.app = [commit('c4', T0 + DAY, 'Newest'), ...gh.commits.app];
  clock += 10 * 60_000;
  const restarted = createGithubHandler({ user: 'me', cacheFile: file, request: gh.request, now: () => clock });
  gh.calls.length = 0;
  // the kept copy is answered at once while the refresh runs behind it
  const stale = await call(restarted, '/api/github');
  assert.equal(stale.body.repos[0].commits, 3);
  await new Promise((r) => setTimeout(r, 20));
  const fresh = await call(restarted, '/api/github');
  assert.equal(fresh.body.repos[0].commits, 4);
  assert.equal(fresh.body.repos[0].last.m, 'Newest');
  assert.ok(!gh.calls.some((c) => c.includes('/repos/me/empty/')), 'an unchanged repository isn’t fetched again');
});

test('pages through commits, for one project or all of them', async () => {
  const gh = fakeGithub();
  gh.commits.app = Array.from({ length: 95 }, (_, i) => commit('s' + i, T0 - i * 3_600_000));
  const handler = createGithubHandler({ user: 'me', request: gh.request, now: () => T0 + 60_000 });
  const one = await call(handler, '/api/github/repos/app/commits');
  assert.equal(one.body.commits.length, 40);
  assert.equal(one.body.next, 1);
  assert.equal(one.body.total, 95);
  const last = await call(handler, '/api/github/repos/app/commits', { search: '?page=2' });
  assert.equal(last.body.commits.length, 15);
  assert.equal(last.body.next, null);
  assert.equal((await call(handler, '/api/github/commits')).body.commits[0].repo, 'app');
  assert.equal((await call(handler, '/api/github/repos/nope/commits')).status, 404);
  assert.equal((await call(handler, '/api/github/repos/secret/commits')).status, 404, 'a private repository’s commits aren’t there for everyone');
  await assert.rejects(call(handler, '/api/github/repos/..%2F..%2Fx/commits'), { status: 400 });
});

test('a used-up rate limit keeps what was kept, and says so when there is nothing', async () => {
  const gh = fakeGithub();
  gh.limited = true;
  const handler = createGithubHandler({ user: 'me', request: gh.request, now: () => T0 });
  assert.equal((await call(handler, '/api/github')).status, 429);
  const calls = gh.calls.length;
  assert.equal((await call(handler, '/api/github')).status, 429);
  assert.equal(gh.calls.length, calls, 'it waits for the limit to fill up instead of asking again');
});

test('says when it is not set up, and only answers GET', async () => {
  const off = await call(createGithubHandler({ user: '' }), '/api/github');
  assert.equal(off.status, 404);
  assert.equal(off.body.signIn, false);
  const handler = createGithubHandler({ user: 'me', request: fakeGithub().request });
  await assert.rejects(call(handler, '/api/github', { method: 'POST' }), { status: 405 });
});

/** Signs in as whoever `code` belongs to, the way a browser goes through it; returns the cookie jar and the landing page. */
async function signIn(handler, code) {
  const go = await call(handler, '/api/github/connect', { search: '?back=%23%2Fprojects' });
  assert.equal(go.status, 302);
  const to = new URL(go.headers.Location);
  assert.equal(to.origin + to.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(to.searchParams.get('client_id'), 'id-1');
  assert.equal(to.searchParams.get('login'), 'me', 'GitHub suggests the right account');
  const back = await call(handler, '/api/github/callback', { search: `?code=${code}&state=${to.searchParams.get('state')}`, jar: jarOf(go, 'mm_ghstate') });
  assert.equal(back.status, 302);
  return { jar: jarOf(back, 'mm_gh'), landing: back.headers.Location };
}

test('signing in with GitHub shows that browser the private repositories, and only that browser', async () => {
  const gh = fakeGithub();
  const handler = createGithubHandler({ user: 'me', cacheFile: join(root, 'c.json'), request: gh.request, now: () => T0 + 60_000, ...auth });
  const { jar, landing } = await signIn(handler, 'code-me');
  assert.equal(landing, 'https://site/#/projects?github=connected');
  assert.ok(jar);

  const mine = await call(handler, '/api/github', { jar });
  assert.deepEqual(mine.body.repos.map((r) => r.name).sort(), ['app', 'empty', 'secret']);
  assert.equal(mine.body.repos.find((r) => r.name === 'secret').private, true);
  assert.deepEqual(mine.body.viewer, { login: 'me', avatar: 'https://avatars.example/me' });
  assert.equal(mine.body.signIn, true);
  assert.ok(gh.calls.includes('GET /user/repos?per_page=100&sort=pushed&affiliation=owner&visibility=all as tok-me'));
  assert.equal((await call(handler, '/api/github/repos/secret/commits', { jar })).body.commits[0].m, 'Private work');

  const everyone = await call(handler, '/api/github');
  assert.deepEqual(everyone.body.repos.map((r) => r.name), ['app', 'empty'], 'everyone else still sees public ones only');
  assert.equal(everyone.body.viewer, null);
  assert.ok(!(await readFile(join(root, 'c.json'), 'utf8')).includes('secret'), 'private repositories never reach the disk');

  const st = await call(handler, '/api/github/status', { jar });
  assert.deepEqual(st.body, { configured: true, connected: true, viewer: { login: 'me', avatar: 'https://avatars.example/me' }, owner: 'me', redirect: 'https://site/api/github/callback' });

  const out = await call(handler, '/api/github/disconnect', { method: 'POST', jar });
  assert.equal(jarOf(out, 'mm_gh'), '', 'signing out clears the cookie');
  assert.deepEqual(gh.revoked, ['tok-me'], 'and takes the token back from GitHub');
});

test('only the site’s own account can sign in', async () => {
  const gh = fakeGithub();
  const handler = createGithubHandler({ user: 'me', request: gh.request, now: () => T0 + 60_000, ...auth });
  const { jar, landing } = await signIn(handler, 'code-other');
  assert.equal(landing, 'https://site/#/projects?github=wrong-account');
  assert.equal(jar, '');
  assert.deepEqual(gh.revoked, ['tok-other']);

  // a forged state, or none, never signs anyone in
  const go = await call(handler, '/api/github/connect');
  const forged = await call(handler, '/api/github/callback', { search: '?code=code-me&state=nope', jar: jarOf(go, 'mm_ghstate') });
  assert.equal(forged.headers.Location, 'https://site/#/projects?github=error');
  assert.equal(jarOf(forged, 'mm_gh'), '');
  const cancelled = await call(handler, '/api/github/callback', { search: `?error=access_denied&state=${new URL(go.headers.Location).searchParams.get('state')}`, jar: jarOf(go, 'mm_ghstate') });
  assert.equal(cancelled.headers.Location, 'https://site/#/projects?github=cancelled');
});

test('an expiring token is renewed once, and one that stops working signs the browser out', async () => {
  const gh = fakeGithub();
  let clock = T0 + 60_000;
  const handler = createGithubHandler({ user: 'me', request: gh.request, now: () => clock, ...auth });
  const old = 'mm_gh=' + encodeURIComponent(seal({ a: 'tok-old', r: 'r-1', e: clock - 1000, u: 'me', av: '' }));
  const [a, b] = await Promise.all([call(handler, '/api/github', { jar: old }), call(handler, '/api/github/status', { jar: old })]);
  assert.equal(gh.calls.filter((c) => c.startsWith('POST /login/oauth/access_token')).length, 1, 'two requests at once renew it once');
  assert.equal(a.body.viewer.login, 'me');
  assert.equal(b.body.connected, true);
  assert.equal(unseal(decodeURIComponent(jarOf(a, 'mm_gh').slice(6))).a, 'tok-new');

  // the token is taken back on GitHub: the next look falls back to the public repositories, signed out
  const jar = jarOf(a, 'mm_gh');
  delete gh.users['tok-new'];
  clock += 10 * 60_000;
  await call(handler, '/api/github', { jar });
  await new Promise((r) => setTimeout(r, 20));
  const after = await call(handler, '/api/github', { jar });
  assert.equal(after.body.viewer, null);
  assert.deepEqual(after.body.repos.map((r) => r.name), ['app', 'empty']);
  assert.equal(jarOf(after, 'mm_gh'), '', 'the cookie is cleared');
});
