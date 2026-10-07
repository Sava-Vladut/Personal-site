import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createTwitchHandler } from '../server/twitch.js';

const DAY = 86_400_000;
const now = Date.now();
const root = await mkdtemp(join(tmpdir(), 'mm-twitch-'));
after(() => rm(root, { recursive: true, force: true }));

await mkdir(join(root, 'someone'));
await writeFile(join(root, 'someone', 'alpha.json'), JSON.stringify({
  series: [
    { x: now - 40 * DAY, y: 1000, z: 'Watch' },
    { x: now - 20 * DAY, y: 1500, z: 'Claim' },
    { x: now - 3 * DAY, y: 1950, z: 'Watch Streak' },
    { x: now - 2 * DAY, y: 1900, z: 'Watch' }, // a drop while watching: spent
    { x: now - 60_000, y: 2000, z: 'Raid' },
  ],
  annotations: [],
}));
await writeFile(join(root, 'someone', 'beta.json'), JSON.stringify({ series: [{ x: now - 100 * DAY, y: 500, z: 'Watch' }] }));
await writeFile(join(root, 'someone', 'broken.json'), '{ "series": [');

const call = async (dir, method = 'GET') => {
  let out;
  const res = { writeHead: (status) => (out = { status }), end: (body) => (out.body = JSON.parse(body)) };
  await createTwitchHandler({ directory: dir })({ method }, res, '/api/twitch');
  return out;
};

test('sums up every channel, newest balances first', async () => {
  const { status, body } = await call(root);
  assert.equal(status, 200);
  assert.equal(body.user, 'someone');
  assert.equal(body.total, 2500);
  assert.deepEqual(body.channels.map((c) => c.name), ['alpha', 'beta']);
  const alpha = body.channels[0];
  assert.equal(alpha.live, true);
  assert.equal(body.channels[1].live, false);
  assert.deepEqual(alpha.change, { day: 100, week: 500, month: 1000 });
  assert.deepEqual(alpha.reasons, { Claim: 500, 'Watch Streak': 450, Spent: -50, Raid: 100 });
  assert.equal(alpha.daily.length, 90);
  assert.equal(alpha.daily.at(-1), 2000);
  assert.equal(body.daily.at(-1), 2500);
  assert.deepEqual(body.recent.map((r) => r.reason), ['Raid', 'Spent', 'Watch Streak']);
});

test('says when it is not set up, and only answers GET', async () => {
  assert.equal((await call('')).status, 404);
  assert.equal((await call(join(root, 'missing'))).status, 404);
  assert.equal((await call(root, 'POST')).status, 405);
});
