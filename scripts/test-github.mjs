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

/** A small GitHub: two repositories, one of them empty, and a log of every request it answered. */
function fakeGithub() {
  const state = {
    calls: [],
    pushed: { app: T0, empty: T0 - 10 * DAY },
    commits: { app: [commit('c3', T0), commit('c2', T0 - DAY), commit('c1', T0 - 3 * DAY)] },
    limited: false,
  };
  const reply = (status, body, headers = {}) => ({ status, ok: status >= 200 && status < 300, headers: new Headers(headers), json: async () => body });
  state.request = async (url) => {
    const u = new URL(url);
    state.calls.push(u.pathname + u.search);
    if (state.limited) return reply(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.round((T0 + DAY) / 1000)) });
    if (u.pathname === '/users/me') return reply(200, { login: 'me', name: 'Me Myself', avatar_url: 'https://avatars.example/me', html_url: 'https://github.com/me', followers: 3, created_at: iso(T0 - 400 * DAY) });
    if (u.pathname === '/users/me/repos')
      return reply(200, [
        { name: 'app', html_url: 'https://github.com/me/app', language: 'TypeScript', stargazers_count: 2, pushed_at: iso(state.pushed.app), created_at: iso(T0 - 30 * DAY), description: 'An app' },
        { name: 'empty', html_url: 'https://github.com/me/empty', pushed_at: iso(state.pushed.empty), created_at: iso(T0 - 10 * DAY) },
        { name: 'secret', private: true, pushed_at: iso(T0) },
      ]);
    if (u.pathname === '/repos/me/app/commits') return reply(200, state.commits.app);
    if (u.pathname === '/repos/me/empty/commits') return reply(409, { message: 'Git Repository is empty.' });
    if (u.pathname.endsWith('/languages')) return reply(200, u.pathname.includes('/app/') ? { TypeScript: 9000, CSS: 1000 } : {});
    return reply(404, { message: 'Not Found' });
  };
  return state;
}

const call = async (handler, path, search = '') => {
  let out;
  const res = { writeHead: (status) => (out = { status }), end: (body) => (out.body = JSON.parse(body)) };
  await handler({ method: 'GET' }, res, path, new URL('http://x' + path + search));
  return out;
};

test('sums up the public repositories with their commits and languages', async () => {
  const gh = fakeGithub();
  let clock = T0 + 60_000;
  const handler = createGithubHandler({ user: 'me', cacheFile: join(root, 'a.json'), request: gh.request, now: () => clock });
  const { status, body } = await call(handler, '/api/github');
  assert.equal(status, 200);
  assert.equal(body.profile.name, 'Me Myself');
  assert.deepEqual(body.repos.map((r) => r.name), ['app', 'empty'], 'private repositories are never listed');
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
  assert.ok(!gh.calls.some((c) => c.startsWith('/repos/me/empty/')), 'an unchanged repository isn’t fetched again');
});

test('pages through commits, for one project or all of them', async () => {
  const gh = fakeGithub();
  gh.commits.app = Array.from({ length: 95 }, (_, i) => commit('s' + i, T0 - i * 3_600_000));
  const handler = createGithubHandler({ user: 'me', request: gh.request, now: () => T0 + 60_000 });
  const one = await call(handler, '/api/github/repos/app/commits');
  assert.equal(one.body.commits.length, 40);
  assert.equal(one.body.next, 1);
  assert.equal(one.body.total, 95);
  const last = await call(handler, '/api/github/repos/app/commits', '?page=2');
  assert.equal(last.body.commits.length, 15);
  assert.equal(last.body.next, null);
  assert.equal((await call(handler, '/api/github/commits')).body.commits[0].repo, 'app');
  await assert.rejects(call(handler, '/api/github/repos/nope/commits'), { status: 404 });
  await assert.rejects(call(handler, '/api/github/repos/..%2F..%2Fx/commits'), { status: 400 });
});

test('a used-up rate limit keeps what was kept, and says so when there is nothing', async () => {
  const gh = fakeGithub();
  gh.limited = true;
  const handler = createGithubHandler({ user: 'me', request: gh.request, now: () => T0 });
  await assert.rejects(call(handler, '/api/github'), { status: 429 });
  const calls = gh.calls.length;
  await assert.rejects(call(handler, '/api/github'), { status: 429 });
  assert.equal(gh.calls.length, calls, 'it waits for the limit to fill up instead of asking again');
});

test('says when it is not set up, and only answers GET', async () => {
  const off = await call(createGithubHandler({ user: '' }), '/api/github');
  assert.equal(off.status, 404);
  const handler = createGithubHandler({ user: 'me', request: fakeGithub().request });
  await assert.rejects(handler({ method: 'POST' }, {}, '/api/github', new URL('http://x/api/github')), { status: 405 });
});
