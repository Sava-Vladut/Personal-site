// The Global Ops dev page's server side: PORTING_LOG.md parsing, sessions from the activity hook, deploys from the
// backup folders, the admin gate, the snapshot of a port folder and its ETag, and that screenshots are only served by
// plain names.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createGlopsDevHandler, deployOf, parseLog, sessionsOf } from '../server/glopsdev.js';

const LOG = `# Port log

Goal: play it in the browser.

## Milestones

Tick one when it's done.

- [x] Menus
- [ ] A whole mission

## Status

- 2026-10-28 15:06 (no stats link): page published; backup /root/glops/backups/glops-dist-statslink-20261028-1506.
- 2026-10-25 (morning): mission 1 plays,
  with sound.
- 2026-10-24: menus.

## Build and run

\`\`\`sh
make
\`\`\`
`;

test('the porting log comes apart into sections, list items, dates, times and ticks', () => {
  const log = parseLog(LOG);
  assert.equal(log.title, 'Port log');
  assert.deepEqual(log.sections.map((s) => s.title), ['', 'Milestones', 'Status', 'Build and run']);
  assert.deepEqual(log.sections[1].items, [{ text: 'Menus', done: true }, { text: 'A whole mission', done: false }]);
  assert.deepEqual(log.sections[2].items[0], { text: 'page published; backup /root/glops/backups/glops-dist-statslink-20261028-1506.', date: '2026-10-28', when: 'no stats link', time: '15:06' });
  assert.deepEqual(log.sections[2].items[1], { text: 'mission 1 plays, with sound.', date: '2026-10-25', when: 'morning' });
  assert.equal(log.sections[2].items[2].when, '');
  assert.equal(log.sections[3].items, null);
  assert.equal(parseLog('## Notes\n\n- one\n\nthen prose\n').sections[0].items, null);
});

test('backup folders read as deploys: what kind, about what, when', () => {
  assert.deepEqual(deployOf('glops-dist-statslink-20261028-1506'), { name: 'glops-dist-statslink-20261028-1506', at: Date.UTC(2026, 9, 28, 15, 6), kind: 'page', topic: 'statslink' });
  assert.equal(deployOf('glops-mp-20261028-1122').kind, 'multiplayer');
  assert.equal(deployOf('glops-mp-20261028-1122').topic, '');
  assert.equal(deployOf('glopsd-bots-20261027-1653').kind, 'servers');
  assert.equal(deployOf('glops-relay-fastpath-20261027-2137').topic, 'fastpath');
  assert.equal(deployOf('global-ops-port-2026-10-22.bundle'), null);
  assert.equal(deployOf('activity-hook.sh.pre-dev-page'), null);
});

test('activity groups into sessions: working, waiting or idle, with what each was asked and said', () => {
  const now = Date.UTC(2026, 9, 28, 12);
  const min = 60_000;
  const s = sessionsOf([
    { t: now - 90 * min, ev: 'prompt', s: 'old', text: 'fix the crash' },
    { t: now - 89 * min, ev: 'tool', s: 'old', tool: 'Edit', text: 'port/a.c' },
    { t: now - 88 * min, ev: 'tool', s: 'old', tool: 'Edit', text: 'port/a.c' },
    { t: now - 80 * min, ev: 'stop', s: 'old', text: 'Fixed and deployed.' },
    { t: now - 30 * min, ev: 'tool', s: 'quiet', tool: 'Bash', text: 'Build' },
    { t: now - 2 * min, ev: 'tool', s: 'busy', tool: 'Bash', text: 'Run the tests' },
    { t: now - 4 * 86_400_000, ev: 'tool', s: 'ancient', tool: 'Bash', text: 'x' },
  ], now);
  assert.deepEqual(s.map((x) => [x.id, x.state]), [['busy', 'working'], ['quiet', 'idle'], ['old', 'waiting']]);
  const old = s[2];
  assert.deepEqual([old.tools, old.edits, old.turns, old.minutes], [2, 2, 1, 10]);
  assert.deepEqual(old.prompts.map((p) => p.text), ['fix the crash']);
  assert.equal(old.reply, 'Fixed and deployed.');
  assert.deepEqual(old.files, [{ path: 'port/a.c', n: 2 }]);
  assert.equal(s[0].action.text, 'Run the tests');
});

function fakeRes() {
  return {
    writeHead(status, headers) { this.status = status; this.headers = headers; return this; },
    end(body) { this.body = body; },
  };
}

test('a port folder reads back as one snapshot, and only for the admin', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'glops-dev-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const port = join(dir, 'port');
  mkdirSync(port);
  const git = (...a) => execFileSync('git', ['-C', port, ...a], { stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  writeFileSync(join(port, 'PORTING_LOG.md'), LOG);
  writeFileSync(join(port, 'a.c'), 'x\n');
  writeFileSync(join(port, '.gitignore'), 'recomp/build_*/\n');
  git('add', '.');
  git('-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-qm', 'Start\n\nThe first one.\n\nCo-Authored-By: X <x@example.com>');
  writeFileSync(join(port, 'PORTING_LOG.md'), LOG + '\nmore\n');
  writeFileSync(join(port, 'new.c'), 'a\nb\n');
  mkdirSync(join(port, 'recomp', 'build_web', 'www'), { recursive: true });
  writeFileSync(join(port, 'recomp', 'build_web', 'www', 'game.wasm'), 'wasm');
  mkdirSync(join(dir, 'shots'));
  writeFileSync(join(dir, 'shots', 'a.png'), 'png');
  mkdirSync(join(dir, 'logs'));
  writeFileSync(join(dir, 'logs', 'build.log'), 'one\n\x1b[31mtwo\x1b[0m\n');
  mkdirSync(join(dir, 'backups', 'glops-dist-statslink-20261028-1506'), { recursive: true });
  mkdirSync(join(dir, 'backups', 'glops-mp-20261027-1122'));
  writeFileSync(join(dir, 'activity.jsonl'), [
    `{"t":${Date.now() - 1000},"ev":"prompt","s":"abc","text":"add a thing"}`,
    `{"t":${Date.now()},"ev":"tool","s":"abc","tool":"Edit","text":"port/new.c"}`,
    'not json',
  ].join('\n') + '\n');

  let admin = false;
  const h = createGlopsDevHandler({ directory: dir, isAdmin: () => admin });
  await assert.rejects(h({ method: 'GET', headers: {} }, fakeRes(), '/api/glops-dev'), { status: 403 });
  admin = true;

  const res = fakeRes();
  await h({ method: 'GET', headers: {} }, res, '/api/glops-dev');
  assert.equal(res.status, 200);
  const d = JSON.parse(res.body);
  assert.equal(d.live, true);
  assert.equal(d.repo.branch, 'main');
  assert.equal(d.repo.upstream, null);
  assert.equal(d.commits.length, 1);
  assert.equal(d.commits[0].subject, 'Start');
  assert.match(d.commits[0].body, /^The first one\./);
  assert.deepEqual(d.commits[0].paths.map((f) => f.path).sort(), ['.gitignore', 'PORTING_LOG.md', 'a.c']);
  assert.equal(d.commits[0].code, true);
  assert.equal(d.undeployed, 1, 'committed after the newest deploy');
  assert.deepEqual(d.changes.map((c) => [c.path, c.state, c.added]).sort(), [['PORTING_LOG.md', 'changed', 2], ['new.c', 'new', 3]]);
  assert.deepEqual(d.deploys.map((x) => [x.kind, x.title ?? null]), [['page', 'no stats link'], ['multiplayer', null]]);
  assert.deepEqual(d.builds.filter((b) => b.dir).map((b) => [b.name, b.dir]), [['browser', 'build_web']]);
  assert.deepEqual(d.logs[0].lines, ['one', 'two']);
  assert.deepEqual(d.shots.map((s) => s.name), ['a.png']);
  assert.deepEqual(d.activity.map((e) => e.ev), ['tool', 'prompt']);
  assert.deepEqual(d.sessions.map((s) => [s.id, s.state, s.prompts[0].text]), [['abc', 'working', 'add a thing']]);

  const again = fakeRes();
  await h({ method: 'GET', headers: { 'if-none-match': res.headers.ETag } }, again, '/api/glops-dev');
  assert.equal(again.status, 304);

  const zipped = fakeRes();
  await h({ method: 'GET', headers: { 'accept-encoding': 'gzip, br' } }, zipped, '/api/glops-dev');
  assert.equal(zipped.headers['Content-Encoding'], 'gzip');
  assert.equal(gunzipSync(zipped.body).toString(), res.body);

  const shot = fakeRes();
  await assert.rejects(h({ method: 'GET', headers: {} }, shot, '/api/glops-dev/shots/..%2Factivity.jsonl'), { status: 404 });
  await assert.rejects(h({ method: 'GET', headers: {} }, shot, '/api/glops-dev/shots/missing.png'), { status: 404 });
});

test('with no port folder configured the page says so', async () => {
  const h = createGlopsDevHandler({ directory: '', isAdmin: () => true });
  await assert.rejects(h({ method: 'GET', headers: {} }, fakeRes(), '/api/glops-dev'), { status: 404 });
});
