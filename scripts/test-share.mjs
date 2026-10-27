import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { HttpError } from '../server/http-error.js';
import { json } from '../server/http-response.js';
import { createShareHandler, cleanNote, excerpt } from '../server/share.js';

// The real share handler behind a throwaway server; the admin is whoever sends "x-admin: yes".
const scratch = mkdtempSync(join(tmpdir(), 'mymind-share-'));
const directory = join(scratch, 'shared');
const indexFile = join(scratch, 'index.html');
writeFileSync(indexFile, '<!doctype html><html><head><meta name="description" content="A private journal" /><title>My Mind</title></head><body></body></html>');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f0300', 'hex');

function start(adminConfigured) {
  const share = createShareHandler({ directory, indexFile, isAdmin: (req) => req.headers['x-admin'] === 'yes', adminConfigured });
  const server = http.createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://x').pathname;
      return path.startsWith('/s/') ? await share.page(req, res, path) : await share.api(req, res, path);
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
const send = (method, path, { body, headers = {}, type = 'application/json', raw } = {}, who = () => open) =>
  fetch(who().base + path, { method, headers: { ...(body !== undefined || raw ? { 'Content-Type': type } : {}), ...headers }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
const note = (extra = {}) => ({ title: 'A walk', text: 'Some **words**', date: '2026-10-12', dateEnd: null, images: [], photos: [], cover: null, ...extra });

test('only the admin can publish, update, list or stop sharing', async () => {
  assert.equal((await send('POST', '/api/share', { body: note() })).status, 401);
  assert.equal((await send('GET', '/api/share')).status, 401);
  assert.equal((await send('DELETE', '/api/share/' + 'a'.repeat(32))).status, 401);
  assert.equal((await send('PUT', '/api/share/' + 'a'.repeat(32), { body: note() })).status, 401);
  const off = await send('POST', '/api/share', { body: note(), headers: admin }, () => closed);
  assert.equal(off.status, 403); // no admin password on the server: sharing is off, whoever asks
  assert.match((await off.json()).error, /ADMIN_PASSWORD/);
  assert.equal(existsSync(directory), false); // nothing was written
});

test('a published note is readable by anyone, and only holds what the whitelist allows', async () => {
  const r = await send('POST', '/api/share', {
    headers: admin,
    body: note({
      emotions: ['joy'], people: ['p1'], place: { lat: 1, lon: 2, name: 'Home' }, weather: { code: 1 }, music: [{ id: 'x' }], intensity: 5, time: 5, pinned: true, share: { token: 'x' },
      images: [{ url: 'https://example.com/a.jpg', credit: 'Someone · CC BY', secret: 1 }, { url: 'javascript:alert(1)' }, { url: 'http://insecure.example/a.jpg' }, { url: 'https://example.com/a b.jpg' }],
    }),
  });
  assert.equal(r.status, 200);
  const { token, missing } = await r.json();
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  assert.deepEqual(missing, []);
  const pub = await send('GET', '/api/share/' + token); // no admin header
  assert.equal(pub.status, 200);
  assert.match(pub.headers.get('x-robots-tag'), /noindex/);
  const body = await pub.json();
  assert.deepEqual(Object.keys(body).sort(), ['cover', 'date', 'dateEnd', 'images', 'photos', 'shared', 'text', 'title']);
  assert.deepEqual(body.images, [{ url: 'https://example.com/a.jpg', credit: 'Someone · CC BY' }]);
  assert.equal(body.title, 'A walk');
  assert.deepEqual((await (await send('GET', '/api/share', { headers: admin })).json()).notes.map((n) => n.token), [token]);
  await send('DELETE', '/api/share/' + token, { headers: admin });
});

test('chosen details are kept in their narrow shape, and anything else in them is dropped', async () => {
  const details = {
    feelings: { emotions: ['joy', 'fear/anxiety/worried', '<script>', 5], intensity: 9, secret: 1 },
    people: [{ name: ' Ana ', icon: 't:heart', id: 'p1', text: 'private' }, { name: 'Bo', icon: 'javascript:x' }, { name: '' }, 'p2'],
    place: { name: 'Home', lat: 44.4, lon: 26.1 },
    weather: { code: 3, temp: 21.44, daylight: 11.5, dark: true, day: '2026-10-12', extra: 1 },
    music: [
      { kind: 'track', id: 'abcdefghij', title: 'Blue', sub: 'Someone', image: 'https://i.scdn.co/a.jpg', link: 'https://evil.example/' },
      { kind: 'bad', id: 'abcdefghij', title: 'X' },
      { kind: 'album', id: '../../x', title: 'Y' },
    ],
    mood: 'secret',
  };
  const { token } = await (await send('POST', '/api/share', { headers: admin, body: note({ details }) })).json();
  const body = await (await send('GET', '/api/share/' + token)).json();
  assert.deepEqual(body.details, {
    feelings: { emotions: ['joy', 'fear/anxiety/worried'], intensity: 3 },
    people: [{ name: 'Ana', icon: 't:heart' }, { name: 'Bo', icon: null }],
    place: { name: 'Home' },
    weather: { code: 3, temp: 21.4, daylight: 11.5, dark: true },
    music: [{ kind: 'track', id: 'abcdefghij', title: 'Blue', link: 'https://open.spotify.com/track/abcdefghij', sub: 'Someone', image: 'https://i.scdn.co/a.jpg' }],
  });
  assert.equal(cleanNote(note({ details: { place: { name: ' ' }, people: [] } })).details, undefined);
  assert.equal('details' in cleanNote(note()), false);
  await send('DELETE', '/api/share/' + token, { headers: admin });
});

test('links that were not issued (or are malformed) show nothing', async () => {
  for (const path of ['/api/share/' + 'b'.repeat(32), '/api/share/short', '/api/share/..%2f..%2fsecret', '/api/share/' + 'b'.repeat(32) + '/pabcdef12']) {
    assert.equal((await send('GET', path)).status, 404, path);
  }
  assert.equal((await send('PUT', '/api/share/' + 'b'.repeat(32), { body: note(), headers: admin })).status, 404); // updating can't invent a link
});

test('photos: only pictures the note lists, only real images, gone when the note drops them', async () => {
  const { token, missing } = await (await send('POST', '/api/share', { headers: admin, body: note({ photos: [{ id: 'pabc123456', w: 10, h: 5 }, { id: 'pdef123456', w: 1, h: 1 }] }) })).json();
  assert.deepEqual(missing.sort(), ['pabc123456', 'pdef123456']);
  const put = (id, raw, type = 'image/png', headers = admin) => send('PUT', `/api/share/${token}/${id}`, { raw, type, headers });
  assert.equal((await put('pabc123456', PNG, 'image/png', {})).status, 401);
  assert.equal((await put('pabc123456', Buffer.from('<svg onload=alert(1)>'), 'image/png')).status, 415); // claimed png, isn't
  assert.equal((await put('pabc123456', PNG, 'text/html')).status, 415);
  assert.equal((await put('pzzz123456', PNG)).status, 400); // not in the note
  assert.equal((await put('pabc123456', PNG)).status, 204);

  // only the uploaded photo is shown; the other one never arrived
  const shown = await (await send('GET', '/api/share/' + token)).json();
  assert.deepEqual(shown.photos.map((p) => p.id), ['pabc123456']);
  const image = await send('GET', `/api/share/${token}/pabc123456`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), PNG);
  assert.equal((await send('GET', `/api/share/${token}/pdef123456`)).status, 404);

  // updating the note without the photo removes the file
  const updated = await (await send('PUT', '/api/share/' + token, { headers: admin, body: note({ photos: [{ id: 'pdef123456', w: 1, h: 1 }] }) })).json();
  assert.deepEqual(updated.missing, ['pdef123456']);
  assert.equal((await send('GET', `/api/share/${token}/pabc123456`)).status, 404);
  assert.deepEqual(readdirSync(join(directory, token)).sort(), ['note.json']);
  await send('DELETE', '/api/share/' + token, { headers: admin });
});

test('stopping to share deletes the public copy, link and pictures', async () => {
  const { token } = await (await send('POST', '/api/share', { headers: admin, body: note({ photos: [{ id: 'pabc123456', w: 1, h: 1 }] }) })).json();
  await send('PUT', `/api/share/${token}/pabc123456`, { raw: PNG, type: 'image/png', headers: admin });
  assert.equal((await send('DELETE', '/api/share/' + token, { headers: admin })).status, 204);
  assert.equal((await send('GET', '/api/share/' + token)).status, 404);
  assert.equal((await send('GET', `/api/share/${token}/pabc123456`)).status, 404);
  assert.equal(readdirSync(directory).includes(token), false);
  assert.equal((await send('DELETE', '/api/share/' + token, { headers: admin })).status, 204); // stopping twice is fine
});

test('a note that is too long or has no day is refused', () => {
  assert.throws(() => cleanNote({ ...note(), text: 'x'.repeat(100_001) }), /too long/);
  assert.throws(() => cleanNote({ ...note(), date: 'yesterday' }), /can’t be shared/);
  assert.throws(() => cleanNote(null), /can’t be shared/);
  assert.equal(cleanNote({ ...note(), dateEnd: '2026-10-01' }).dateEnd, null); // a range ends after it starts
});

test('the note’s page carries its title for link previews, escaped, and is never indexed', async () => {
  const { token } = await (await send('POST', '/api/share', { headers: admin, body: note({ title: '"><script>alert(1)</script> & co', text: '# Hello\n[[photo:pabc123456]]\nfirst words' }) })).json();
  const page = await send('GET', '/s/' + token);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(page.headers.get('x-robots-tag'), /noindex/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  const html = await page.text();
  assert.ok(!html.includes('<script>alert(1)'));
  assert.match(html, /<title>&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; co<\/title>/);
  assert.match(html, /og:description" content="Hello first words"/);
  assert.match(html, /name="robots" content="noindex/);
  await send('DELETE', '/api/share/' + token, { headers: admin });
  const gone = await send('GET', '/s/' + token);
  assert.equal(gone.status, 404);
  assert.ok(!(await gone.text()).includes('first words'));
  assert.equal((await send('GET', '/s/not-a-token')).status, 404);
});

test('link previews show a few plain words', () => {
  assert.equal(excerpt({ text: '## Title\n[[image:https://x.example/a.jpg 50 left]]\n**bold** and [a link](https://x.example) here' }), 'Title bold and a link here');
  assert.ok(excerpt({ text: 'word '.repeat(100) }).length <= 160);
  assert.equal(excerpt({ text: '<u>Under</u> x<sup>2</sup> <span style="color:red">red</span> <mark style="background:pink">pink</mark>' }), 'Under x2 red pink');
});
