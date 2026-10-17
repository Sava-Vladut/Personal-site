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
const checkin = (extra = {}) => ({ id: 'abc123', emotion: 'joy/content', name: 'Content', intensity: 4, time: Date.now() - 60_000, text: 'A good @[Ana] day', ...extra });

test('only the admin can turn the status on, read its settings or stop it', async () => {
  assert.equal((await send('GET', '/api/status')).status, 401);
  assert.equal((await send('PUT', '/api/status', { body: { note: true, checkin: checkin() } })).status, 401);
  assert.equal((await send('DELETE', '/api/status')).status, 401);
  const off = await send('PUT', '/api/status', { body: { checkin: checkin() }, headers: admin }, () => closed);
  assert.equal(off.status, 403);
  assert.equal(existsSync(directory), false);
  assert.deepEqual(await (await send('GET', '/api/status', { headers: admin })).json(), { token: null });
});

test('the public link shows only the whitelisted check-in, and the note only when chosen', async () => {
  const r = await send('PUT', '/api/status', { headers: admin, body: { note: false, checkin: checkin({ people: ['p1'], place: { lat: 1 } }) } });
  assert.equal(r.status, 200);
  const { token, note } = await r.json();
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(note, false);

  const pub = await send('GET', '/api/status/' + token);
  assert.equal(pub.status, 200);
  assert.match(pub.headers.get('x-robots-tag'), /noindex/);
  const body = await pub.json();
  assert.deepEqual(Object.keys(body.checkin).sort(), ['emotion', 'intensity', 'name', 'time']); // no id, no note, nothing else
  assert.equal(body.checkin.emotion, 'joy/content');

  // showing the note keeps the same link
  const again = await (await send('PUT', '/api/status', { headers: admin, body: { note: true, checkin: checkin() } })).json();
  assert.equal(again.token, token);
  assert.equal((await (await send('GET', '/api/status/' + token)).json()).checkin.text, 'A good @[Ana] day');

  // the page carries the feeling for link previews, and is never indexed
  const page = await send('GET', '/status/' + token);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<title>Status: Content<\/title>/);
  assert.match(html, /noindex/);
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
