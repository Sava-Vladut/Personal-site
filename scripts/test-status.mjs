import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { HttpError } from '../server/http-error.js';
import { json } from '../server/http-response.js';
import { createStatusHandler } from '../server/status.js';

// The real status handler behind a throwaway server; the admin is whoever sends "x-admin: yes".
const scratch = mkdtempSync(join(tmpdir(), 'mymind-status-'));
const directory = join(scratch, 'status');
const indexFile = join(scratch, 'index.html');
writeFileSync(indexFile, '<!doctype html><html><head><meta name="description" content="A private journal" /><title>My Mind</title></head><body></body></html>');

function start(adminConfigured) {
  const status = createStatusHandler({ directory, indexFile, isAdmin: (req) => req.headers['x-admin'] === 'yes', adminConfigured });
  const server = http.createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://x').pathname;
      if (path === '/api/countdown') return await status.countdownApi(req, res);
      return path.startsWith('/status/') ? await status.page(req, res, path) : await status.api(req, res, path);
    } catch (e) {
      json(res, e instanceof HttpError ? e.status : 500, { error: e.message });
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

let open, closed;
before(async () => {
  open = await start(true);
  closed = await start(false);
});
after(() => {
  open.server.close();
  closed.server.close();
  rmSync(scratch, { recursive: true, force: true });
});

const admin = { 'x-admin': 'yes' };
const send = (method, path, { body, headers = {} } = {}, who = () => open) =>
  fetch(who().base + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const details = {
  people: [{ name: 'Ana', icon: null, id: 'p1', text: 'private' }],
  place: { name: 'Home', lat: 46.77, lon: 23.59 },
  weather: { code: 2, temp: 21.44, daylight: 11, dark: false },
  music: [{ kind: 'track', id: 'abc', title: 'Song' }],
};
const checkin = (extra = {}) => ({ id: 'abc123', emotion: 'joy/content', name: 'Content', intensity: 4, time: Date.now() - 60_000, text: 'A good @[Ana] day', details, ...extra });
const ALL = { note: true, people: true, place: true, weather: true, countdown: true };

test('only the admin can turn the status on, read its settings or stop it', async () => {
  assert.equal((await send('GET', '/api/status')).status, 401);
  assert.equal((await send('PUT', '/api/status', { body: { show: ALL, checkin: checkin() } })).status, 401);
  assert.equal((await send('DELETE', '/api/status')).status, 401);
  const off = await send('PUT', '/api/status', { body: { checkin: checkin() }, headers: admin }, () => closed);
  assert.equal(off.status, 403);
  assert.equal(existsSync(directory), false);
  assert.deepEqual(await (await send('GET', '/api/status', { headers: admin })).json(), { token: null });
});

test('the public link shows only the whitelisted check-in, and the note only when chosen', async () => {
  const r = await send('PUT', '/api/status', { headers: admin, body: { show: { note: 'yes' }, checkin: checkin({ people: ['p1'], place: { lat: 1 } }) } });
  assert.equal(r.status, 200);
  const { token, show } = await r.json();
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  assert.deepEqual(show, { note: false, people: false, place: false, weather: false, countdown: false, trail: false }); // only exactly true turns one on

  const pub = await send('GET', '/api/status/' + token);
  assert.equal(pub.status, 200);
  assert.match(pub.headers.get('x-robots-tag'), /noindex/);
  const body = await pub.json();
  assert.deepEqual(Object.keys(body.checkin).sort(), ['emotion', 'intensity', 'name', 'time']); // no id, no note, nothing else
  assert.equal(body.checkin.emotion, 'joy/content');
  assert.equal(body.countdowns, undefined); // the countdowns only when chosen

  // showing more keeps the same link, and each detail comes in its narrow shape: names, no ids, no coordinates, no music
  const again = await (await send('PUT', '/api/status', { headers: admin, body: { show: ALL, owner: '  Sava   V ', checkin: checkin() } })).json();
  assert.equal(again.token, token);
  const full = await (await send('GET', '/api/status/' + token)).json();
  assert.equal(full.owner, 'Sava V');
  assert.deepEqual(Object.keys(full.countdowns[0]).sort(), ['end', 'name', 'start']); // the one from before it could be changed, until one is saved; no id
  assert.equal(full.checkin.text, 'A good @[Ana] day');
  // a comment in the note is private: the server leaves it out, whatever it's sent (the app does too, lib/share.ts plainTags)
  await send('PUT', '/api/status', { headers: admin, body: { show: ALL, owner: 'Sava V', checkin: checkin({ text: 'A <span class="comment">good</span><!-- comment: SECRET --> day <!-- comment: SECRET-->' }) } });
  assert.equal((await (await send('GET', '/api/status/' + token)).json()).checkin.text, 'A good day');
  assert.doesNotMatch(await (await send('GET', '/status/' + token)).text(), /SECRET/);
  await send('PUT', '/api/status', { headers: admin, body: { show: ALL, owner: 'Sava V', checkin: checkin() } });
  assert.deepEqual(full.checkin.details, { people: [{ name: 'Ana', icon: null }], place: { name: 'Home' }, weather: { code: 2, temp: 21.4, daylight: 11, dark: false } });

  // just the people: the rest stays private
  await send('PUT', '/api/status', { headers: admin, body: { show: { people: true }, owner: 'Sava', checkin: checkin() } });
  const some = (await (await send('GET', '/api/status/' + token)).json()).checkin;
  assert.equal(some.text, undefined);
  assert.deepEqual(Object.keys(some.details), ['people']);
  assert.equal((await (await send('GET', '/api/status/' + token)).json()).countdowns, undefined);

  // the page carries the feeling for link previews, and is never indexed
  const page = await send('GET', '/status/' + token);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<title>Sava · Content<\/title>/);
  assert.match(html, /noindex/);
  assert.doesNotMatch(html, /data-mm-lang/); // no language chosen: each reader's own

  // a chosen language marks the page, so it opens in it for everyone; anything else is no choice
  const ro = await (await send('PUT', '/api/status', { headers: admin, body: { show: { people: true }, owner: 'Sava', lang: 'ro', checkin: checkin() } })).json();
  assert.equal(ro.lang, 'ro');
  assert.match(await (await send('GET', '/status/' + token)).text(), /<html lang="ro" data-mm-lang="ro"/);
  assert.equal((await (await send('PUT', '/api/status', { headers: admin, body: { lang: 'xx"><script>', checkin: checkin() } })).json()).lang, '');
  assert.doesNotMatch(await (await send('GET', '/status/' + token)).text(), /data-mm-lang/);
});

test('a wrong token, a bad check-in and a stopped status are refused', async () => {
  const { token } = await (await send('GET', '/api/status', { headers: admin })).json();
  assert.equal((await send('GET', '/api/status/' + 'a'.repeat(32))).status, 404);
  assert.equal((await send('GET', '/status/' + 'a'.repeat(32))).status, 404);
  assert.equal((await send('PUT', '/api/status', { headers: admin, body: { checkin: checkin({ emotion: '<script>' }) } })).status, 400);
  assert.equal((await send('PUT', '/api/status', { headers: admin, body: { checkin: checkin({ time: Date.now() + 7 * 86_400_000 }) } })).status, 400);
  assert.equal((await send('PUT', '/api/status', { headers: admin, body: { checkin: checkin({ id: '../x' }) } })).status, 400);

  // no check-in yet is fine: the page says so
  assert.equal((await (await send('PUT', '/api/status', { headers: admin, body: { checkin: null } })).json()).checkin, null);
  assert.equal((await (await send('GET', '/api/status/' + token)).json()).checkin, null);

  assert.equal((await send('DELETE', '/api/status', { headers: admin })).status, 204);
  assert.equal((await send('GET', '/api/status/' + token)).status, 404);
  const fresh = await (await send('PUT', '/api/status', { headers: admin, body: { checkin: checkin() } })).json();
  assert.notEqual(fresh.token, token); // sharing again makes a new link
});

test('a status saved before the other details existed keeps showing its note', async () => {
  const token = 'Q'.repeat(32);
  writeFileSync(join(directory, 'status.json'), JSON.stringify({ token, note: true, checkin: { id: 'x1', emotion: 'joy', name: 'Joy', intensity: 3, time: 5, text: 'Hi' }, updated: 1 }));
  const own = await (await send('GET', '/api/status', { headers: admin })).json();
  assert.deepEqual(own.show, { note: true, people: false, place: false, weather: false, countdown: false, trail: false });
  assert.equal(own.owner, '');
  const pub = await (await send('GET', '/api/status/' + token)).json();
  assert.equal(pub.checkin.text, 'Hi');
  assert.equal(pub.owner, '');
});

test('the countdowns: only the admin reads or changes them, there can be several, and the public page shows those still running', async () => {
  assert.equal((await send('GET', '/api/countdown')).status, 401);
  assert.equal((await send('PUT', '/api/countdown', { body: { countdown: { start: 1, end: 2 } } })).status, 401);
  const now = Date.now();
  await send('DELETE', '/api/countdown?id=first', { headers: admin }); // the one from before
  const set = await send('PUT', '/api/countdown', { headers: admin, body: { countdown: { name: '  Trip   home ', start: now - 1000, end: now + 86_400_000, extra: 1 } } });
  assert.equal(set.status, 200);
  const { countdown: trip, countdowns } = await set.json();
  assert.match(trip.id, /^[A-Za-z0-9_-]{12}$/); // a new one gets an id
  assert.deepEqual(trip, { id: trip.id, name: 'Trip home', start: now - 1000, end: now + 86_400_000 });
  assert.deepEqual(countdowns, [trip]);
  assert.equal((await send('PUT', '/api/countdown', { headers: admin, body: { countdown: { start: now, end: now - 1 } } })).status, 400);
  assert.equal((await send('PUT', '/api/countdown', { headers: admin, body: { countdown: { start: 'x', end: now } } })).status, 400);
  assert.equal((await send('PUT', '/api/countdown', { headers: admin, body: {} })).status, 400);

  // a second one sits beside the first; changing the first keeps its place
  const exam = (await (await send('PUT', '/api/countdown', { headers: admin, body: { countdown: { id: 'exam', name: 'Exam', start: now, end: now + 3_600_000 } } })).json()).countdown;
  await send('PUT', '/api/countdown', { headers: admin, body: { countdown: { ...trip, name: 'Trip' } } });
  const list = (await (await send('GET', '/api/countdown', { headers: admin })).json()).countdowns;
  assert.deepEqual(list.map((c) => c.name), ['Trip', 'Exam']);

  // the public page shows the running ones, soonest first, without ids
  const { token } = await (await send('PUT', '/api/status', { headers: admin, body: { show: { countdown: true }, checkin: checkin() } })).json();
  assert.deepEqual((await (await send('GET', '/api/status/' + token)).json()).countdowns, [{ name: 'Exam', start: exam.start, end: exam.end }, { name: 'Trip', start: trip.start, end: trip.end }]);
  // once one's over, the public page drops it
  await send('PUT', '/api/countdown', { headers: admin, body: { countdown: { ...exam, start: now - 5000, end: now - 1000 } } });
  assert.deepEqual((await (await send('GET', '/api/status/' + token)).json()).countdowns.map((c) => c.name), ['Trip']);
  // removed: gone everywhere, and it stays gone
  assert.deepEqual((await (await send('DELETE', '/api/countdown?id=' + trip.id, { headers: admin })).json()).countdowns.map((c) => c.id), ['exam']);
  await send('DELETE', '/api/countdown?id=exam', { headers: admin });
  assert.deepEqual((await (await send('GET', '/api/countdown', { headers: admin })).json()).countdowns, []);
  assert.equal((await (await send('GET', '/api/status/' + token)).json()).countdowns, undefined);
});

test('the countdowns: a file from when there was only one becomes a list of it', async () => {
  const now = Date.now();
  writeFileSync(join(directory, 'countdown.json'), JSON.stringify({ countdown: { name: 'Old', start: now, end: now + 1000 } }));
  assert.deepEqual((await (await send('GET', '/api/countdown', { headers: admin })).json()).countdowns, [{ id: 'first', name: 'Old', start: now, end: now + 1000 }]);
  writeFileSync(join(directory, 'countdown.json'), JSON.stringify({ countdown: null }));
  assert.deepEqual((await (await send('GET', '/api/countdown', { headers: admin })).json()).countdowns, []);
});

test('the recent trail: off by default, only feelings and times, and only while chosen', async () => {
  const now = Date.now();
  const recent = [
    { emotion: 'joy/content', intensity: 4, time: now - 3_600_000, text: 'private', id: 'e1', details },
    { emotion: 'sad', intensity: 9, time: now - 2 * 86_400_000 },
    { emotion: '<script>', intensity: 2, time: now - 86_400_000 },
    { emotion: 'fear', intensity: 2, time: now + 7 * 86_400_000 },
    'nope',
  ];
  // not chosen: nothing is kept, and the page gets no trail
  const off = await (await send('PUT', '/api/status', { headers: admin, body: { checkin: checkin(), recent, trailBy: 'checkins' } })).json();
  assert.deepEqual(off.recent, []);
  assert.equal((await (await send('GET', '/api/status/' + off.token)).json()).trail, undefined);

  // chosen: each check-in narrowed to its feeling, strength and time, newest first; bad ones left out
  const on = await (await send('PUT', '/api/status', { headers: admin, body: { show: { trail: true }, checkin: checkin(), recent: [...recent].reverse(), trailBy: 'checkins' } })).json();
  assert.equal(on.token, off.token);
  assert.equal(on.trailBy, 'checkins');
  const { trail } = await (await send('GET', '/api/status/' + on.token)).json();
  assert.deepEqual(trail, { by: 'checkins', recent: [{ emotion: 'joy/content', intensity: 4, time: now - 3_600_000 }, { emotion: 'sad', intensity: 3, time: now - 2 * 86_400_000 }] });

  // anything but 'checkins' reads by day, and at most 60 are kept
  const many = Array.from({ length: 80 }, (_, i) => ({ emotion: 'joy', intensity: 3, time: now - i * 60_000 }));
  const days = await (await send('PUT', '/api/status', { headers: admin, body: { show: { trail: true }, checkin: checkin(), recent: many, trailBy: 'weeks' } })).json();
  assert.equal(days.trailBy, 'days');
  assert.equal(days.recent.length, 60);

  // a device on an older app sends no trail: the kept one stays
  const old = await (await send('PUT', '/api/status', { headers: admin, body: { show: { trail: true }, checkin: checkin() } })).json();
  assert.equal(old.recent.length, 60);
  assert.equal(old.trailBy, 'days');

  // switched off again: the kept trail goes with it
  const again = await (await send('PUT', '/api/status', { headers: admin, body: { show: {}, checkin: checkin(), recent: many } })).json();
  assert.deepEqual(again.recent, []);
  assert.equal((await (await send('GET', '/api/status/' + again.token)).json()).trail, undefined);
});
