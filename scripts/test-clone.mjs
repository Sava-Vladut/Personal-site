import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createCloner } from '../server/clone.js';

// A stand-in for git: it notes what it was given, then does what its script says. Nothing reaches GitHub.
const scratch = mkdtempSync(join(tmpdir(), 'mm-clone-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
function fakeGit(name, body) {
  const bin = join(scratch, 'bin-' + name);
  mkdirSync(bin, { recursive: true });
  const file = join(bin, 'git');
  writeFileSync(file, `#!/bin/sh\necho "$@" > "${bin}/args"\nenv > "${bin}/env"\n${body}\n`);
  chmodSync(file, 0o755);
  return { file, bin, args: () => readFileSync(join(bin, 'args'), 'utf8'), env: () => readFileSync(join(bin, 'env'), 'utf8') };
}
const works = 'mkdir -p "$5" && echo hi > "$5/README.md"';

const OWNER = 25954921;
const repo = (over = {}) => ({ id: 7, name: 'demo', owner: { id: OWNER }, size: 10, clone_url: 'https://github.com/Sava-Vladut/demo.git', ...over });
const user = { id: OWNER, login: 'Sava-Vladut' };
const make = (git, over = {}) => {
  const directory = mkdtempSync(join(scratch, 'repos-'));
  return { directory, cloner: createCloner({ directory, ownerId: String(OWNER), git: git.file, minFreeBytes: 0, ...over }) };
};
const rejects = (p, status) => assert.rejects(p, (e) => (assert.equal(e.status, status), true));

test('clones the owner’s repo into place, with the token only in git’s environment', async () => {
  const git = fakeGit('ok', works);
  const { directory, cloner } = make(git, { shownDirectory: '/root/repos' });
  const job = await cloner.start({ user, repo: repo(), token: 'gho_secret' });
  assert.equal(job.state, 'running');
  assert.equal(job.path, '/root/repos/demo');
  await cloner.idle();
  assert.equal(cloner.list()[0].state, 'done');
  assert.equal(readFileSync(join(directory, 'demo', 'README.md'), 'utf8'), 'hi\n');
  assert.deepEqual(readdirSync(directory), ['demo'], 'no hidden working folder is left behind');

  assert.match(git.args(), /^clone --quiet -- https:\/\/github\.com\/Sava-Vladut\/demo\.git /);
  assert.ok(!git.args().includes('gho_secret'), 'the token is not on the command line');
  const env = git.env();
  assert.match(env, /GIT_TERMINAL_PROMPT=0/);
  assert.match(env, /GIT_CONFIG_KEY_0=http\.https:\/\/github\.com\/\.extraHeader/);
  assert.ok(env.includes('GIT_CONFIG_VALUE_0=Authorization: Basic ' + Buffer.from('x-access-token:gho_secret').toString('base64')));
});

test('only the owner, and only their own repos, with a usable name and a GitHub clone URL', async () => {
  const { cloner } = make(fakeGit('rules', works));
  await rejects(cloner.start({ user: { id: 1 }, repo: repo(), token: 't' }), 403);
  await rejects(cloner.start({ user: undefined, repo: repo(), token: 't' }), 403);
  await rejects(cloner.start({ user, repo: repo({ owner: { id: 1 } }), token: 't' }), 403);
  for (const name of ['..', '.git', 'a/b', 'a b', '']) await rejects(cloner.start({ user, repo: repo({ name }), token: 't' }), 400);
  for (const clone_url of ['https://evil.test/x/y.git', 'file:///etc', 'https://github.com/a/b.git --upload-pack=x', undefined])
    await rejects(cloner.start({ user, repo: repo({ clone_url }), token: 't' }), 502);
  await rejects(cloner.start({ user, repo: repo({ size: 2 * 1024 * 1024 }), token: 't' }), 413);
  assert.deepEqual(cloner.list(), []);
  assert.equal(createCloner({ directory: '', ownerId: '1' }).enabled(), false);
  assert.equal(createCloner({ directory: scratch, ownerId: '' }).isOwner(''), false);
});

test('never overwrites a folder, runs one clone at a time and refuses a full disk', async () => {
  const slow = fakeGit('slow', `sleep 0.3; ${works}`);
  const { directory, cloner } = make(slow);
  mkdirSync(join(directory, 'taken'));
  await rejects(cloner.start({ user, repo: repo({ name: 'taken' }), token: 't' }), 409);
  // two at the same moment: the second is turned away
  const [first, second] = await Promise.allSettled([
    cloner.start({ user, repo: repo(), token: 't' }),
    cloner.start({ user, repo: repo({ id: 8, name: 'other' }), token: 't' }),
  ]);
  assert.equal(first.status, 'fulfilled');
  assert.equal(second.reason.status, 409);
  await cloner.idle();
  await rejects(cloner.start({ user, repo: repo(), token: 't' }), 409); // now it's there

  const full = make(slow, { minFreeBytes: Number.MAX_SAFE_INTEGER }).cloner;
  await rejects(full.start({ user, repo: repo(), token: 't' }), 507);
  await full.start({ user, repo: repo({ name: 'next' }), token: 't' }).catch(() => {});
  assert.equal(full.list().length, 0, 'a refused clone doesn’t hold the slot');
});

test('a failed or stalled clone is reported and cleaned up', async () => {
  const broken = fakeGit('broken', 'mkdir -p "$5"; echo "fatal: repository not found" >&2; exit 128');
  const a = make(broken);
  await a.cloner.start({ user, repo: repo(), token: 't' });
  await a.cloner.idle();
  assert.equal(a.cloner.list()[0].state, 'failed');
  assert.equal(a.cloner.list()[0].error, 'repository not found');
  assert.deepEqual(readdirSync(a.directory), []);

  const stuck = fakeGit('stuck', 'mkdir -p "$5"; sleep 5');
  const b = make(stuck, { timeoutMs: 100 });
  await b.cloner.start({ user, repo: repo(), token: 't' });
  await b.cloner.idle();
  assert.equal(b.cloner.list()[0].error, 'The clone took too long and was stopped.');
  assert.deepEqual(readdirSync(b.directory), []);

  const missing = make({ file: join(scratch, 'no-such-git') }).cloner;
  await missing.start({ user, repo: repo(), token: 't' });
  await missing.idle();
  assert.equal(missing.list()[0].error, 'git isn’t installed on the server.');
});

/* ---------- through the server: admin cookie, GitHub account, Origin ---------- */

const serverGit = fakeGit('server', works);
const cloneDir = join(scratch, 'server-repos');
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
Object.assign(process.env, {
  ACCOUNTS_FILE: join(scratch, 'accounts'),
  SHARE_DIR: join(scratch, 'shared'),
  SESSION_SECRET: 'clone-regression-test',
  ADMIN_PASSWORD: 'pw',
  GITHUB_CLIENT_ID: 'gh-client',
  GITHUB_CLIENT_SECRET: 'gh-secret',
  PUBLIC_URL: 'https://example.test',
  CLONE_DIR: cloneDir,
  CLONE_GITHUB_ID: String(OWNER),
  PATH: `${serverGit.bin}:${process.env.PATH}`,
});
let handler;
const originalCreateServer = http.createServer;
http.createServer = (callback) => ((handler = callback), { listen() {} });
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
function sealed(name, value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return `${name}=${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')}`;
}
const adminVersion = crypto.createHash('sha256').update('pw').digest().toString('base64url').slice(0, 8);
const admin = sealed('mm_admin', { v: adminVersion, exp: Date.now() + 3600_000 });
const gh = (u) => sealed('mm_gh', { a: 'gho_token', u: String(u) });

async function call(url, cookie, method = 'GET', origin = 'https://example.test') {
  const out = { status: 0, body: null };
  await handler({ url, method, headers: { cookie, origin } }, {
    setHeader() {},
    writeHead(status) { this.headersSent = true; out.status = status; },
    end(body) { out.body = body ? JSON.parse(body) : null; },
  });
  return out;
}
const github = (who) => {
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path === '/user') return Response.json({ id: who, login: 'someone' }, { headers: { 'x-oauth-scopes': 'repo' } });
    if (path === '/repositories/7') return Response.json(repo());
    return Response.json({}, { status: 404 });
  };
};

test('the server lets only Sava-Vladut, signed in as admin, start a clone from the site', async () => {
  github(OWNER);
  const both = `${admin}; ${gh(OWNER)}`;
  assert.equal((await call('/api/github/status', both)).body.canClone, true);
  assert.equal((await call('/api/github/status', gh(OWNER))).body.canClone, undefined, 'no admin cookie, no button');

  assert.equal((await call('/api/github/repos/7/clone', gh(OWNER), 'POST')).status, 403, 'needs the admin cookie');
  assert.equal((await call('/api/github/repos/7/clone', admin, 'POST')).status, 401, 'needs a GitHub sign-in');
  assert.equal((await call('/api/github/repos/7/clone', both, 'POST', 'https://evil.test')).status, 403, 'needs the site’s Origin');
  assert.equal((await call('/api/github/repos/7/clone', both, 'GET')).status, 405);

  // the cookie claims the owner, but GitHub says the token is someone else's
  github(1);
  assert.equal((await call('/api/github/repos/7/clone', both, 'POST')).status, 403);
  assert.equal((await call('/api/github/clones', `${admin}; ${gh(1)}`)).status, 403);
  assert.equal(existsSync(join(cloneDir, 'demo')), false);

  github(OWNER);
  const started = await call('/api/github/repos/7/clone', both, 'POST');
  assert.equal(started.status, 200);
  assert.equal(started.body.state, 'running');
  for (let i = 0; i < 100 && (await call('/api/github/clones', both)).body.items[0].state === 'running'; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal((await call('/api/github/clones', both)).body.items[0].state, 'done');
  assert.ok(existsSync(join(cloneDir, 'demo', 'README.md')));
  assert.ok(!serverGit.args().includes('gho_token'));
});
