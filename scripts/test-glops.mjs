// The Global Ops port page's server side: PORTING_LOG.md parsing, the admin gate, the snapshot of a port folder and
// its ETag, and that screenshots are only served by plain names.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createGlopsHandler, parseLog } from '../server/glops.js';

const LOG = `# Port log

Goal: play it in the browser.

## Milestones

Tick one when it's done.

- [x] Menus
- [ ] A whole mission

## Status

- 2026-10-25 (morning): mission 1 plays,
  with sound.
- 2026-10-24: menus.

## Build and run

\`\`\`sh
make
\`\`\`
`;

test('the porting log comes apart into sections, list items, dates and ticks', () => {
  const log = parseLog(LOG);
  assert.equal(log.title, 'Port log');
  assert.deepEqual(log.sections.map((s) => s.title), ['', 'Milestones', 'Status', 'Build and run']);
  assert.deepEqual(log.sections[1].items, [{ text: 'Menus', done: true }, { text: 'A whole mission', done: false }]);
  assert.deepEqual(log.sections[2].items[0], { text: 'mission 1 plays, with sound.', date: '2026-10-25', when: 'morning' });
  assert.equal(log.sections[2].items[1].when, '');
  assert.equal(log.sections[3].items, null);
  assert.equal(parseLog('## Notes\n\n- one\n\nthen prose\n').sections[0].items, null);
});

function fakeRes() {
  return {
    writeHead(status, headers) { this.status = status; this.headers = headers; return this; },
    end(body) { this.body = body; },
  };
}

test('a port folder reads back as one snapshot, and only for the admin', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'glops-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const port = join(dir, 'port');
  mkdirSync(port);
  const git = (...a) => execFileSync('git', ['-C', port, ...a], { stdio: 'pipe' });
  git('init', '-q');
  writeFileSync(join(port, 'PORTING_LOG.md'), LOG);
  git('add', '.');
  git('-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-qm', 'Start\n\nThe first one.');
  writeFileSync(join(port, 'PORTING_LOG.md'), LOG + '\nmore\n');
  writeFileSync(join(port, 'new.c'), 'a\nb\n');
  mkdirSync(join(dir, 'shots'));
  writeFileSync(join(dir, 'shots', 'a.png'), 'png');
  mkdirSync(join(dir, 'logs'));
  writeFileSync(join(dir, 'logs', 'build.log'), 'one\n\x1b[31mtwo\x1b[0m\n');
  writeFileSync(join(dir, 'activity.jsonl'), `{"t":${Date.now()},"ev":"tool","s":"abc","tool":"Edit","text":"port/new.c"}\nnot json\n`);

  let admin = false;
  const h = createGlopsHandler({ directory: dir, isAdmin: () => admin });
  await assert.rejects(h({ method: 'GET', headers: {} }, fakeRes(), '/api/glops'), { status: 403 });
  admin = true;

  const res = fakeRes();
  await h({ method: 'GET', headers: {} }, res, '/api/glops');
  assert.equal(res.status, 200);
  const d = JSON.parse(res.body);
  assert.equal(d.live, true);
  assert.equal(d.commits.length, 1);
  assert.equal(d.commits[0].subject, 'Start');
  assert.equal(d.commits[0].body, 'The first one.');
  assert.deepEqual(d.changes.map((c) => [c.path, c.state, c.added]).sort(), [['PORTING_LOG.md', 'changed', 2], ['new.c', 'new', 3]]);
  assert.deepEqual(d.logs[0].lines, ['one', 'two']);
  assert.deepEqual(d.shots.map((s) => s.name), ['a.png']);
  assert.deepEqual(d.activity.map((e) => e.text), ['port/new.c']);
  assert.equal(d.log.sections[1].items.length, 2);

  const again = fakeRes();
  await h({ method: 'GET', headers: { 'if-none-match': res.headers.ETag } }, again, '/api/glops');
  assert.equal(again.status, 304);

  const shot = fakeRes();
  await assert.rejects(h({ method: 'GET', headers: {} }, shot, '/api/glops/shots/..%2Factivity.jsonl'), { status: 404 });
  await assert.rejects(h({ method: 'GET', headers: {} }, shot, '/api/glops/shots/missing.png'), { status: 404 });
});

test('with no port folder configured the page says so', async () => {
  const h = createGlopsHandler({ directory: '', isAdmin: () => true });
  await assert.rejects(h({ method: 'GET', headers: {} }, fakeRes(), '/api/glops'), { status: 404 });
});
