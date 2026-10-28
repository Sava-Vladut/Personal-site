import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://example.test';
const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;

function worker({ fetch = async () => new Response('network'), entries = {}, failRead = false, failWrite = false, precache = [] } = {}) {
  const listeners = {};
  const stores = new Map(Object.entries(entries).map(([name, responses]) => [name, new Map(Object.entries(responses).map(([path, body]) => [key(path), new Response(body)]))]));
  let claimed = false;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    open: async (name) => {
      if (failRead) throw new Error('Cache storage unavailable');
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        match: async (request) => store.get(key(request))?.clone(),
        put: async (request, response) => {
          if (failWrite) throw new Error('Quota exceeded');
          store.set(key(request), response);
        },
        addAll: async (urls) => { for (const url of urls) store.set(key(url), await fetch({ url: key(url) })); },
      };
    },
    // Matching across caches reproduces the browser's oldest-cache-first behavior.
    match: async (request) => {
      for (const store of stores.values()) if (store.has(key(request))) return store.get(key(request)).clone();
    },
  };
  runInNewContext(source.replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(precache)};`), {
    self: { addEventListener: (type, handler) => { listeners[type] = handler; }, skipWaiting() {}, clients: { claim: async () => { claimed = true; } } },
    caches, fetch, URL, Response, location: { origin },
  });
  return {
    stores,
    claimed: () => claimed,
    request: async (path, mode = 'cors', method = 'GET', preloadResponse) => {
      let response;
      listeners.fetch({ request: { url: key(path), method, mode }, preloadResponse, respondWith: (promise) => { response = promise; } });
      return await response;
    },
    install: async () => {
      let completion;
      listeners.install({ waitUntil: (promise) => { completion = promise; } });
      await completion;
    },
    activate: async () => {
      let completion;
      listeners.activate({ waitUntil: (promise) => { completion = promise; } });
      await completion;
    },
  };
}

test('cache-first requests use the current build and retain fetched responses', async () => {
  let calls = 0;
  const app = worker({
    entries: { 'mm-app-old': { '/icons/book.svg': 'stale' }, 'mm-app-dev': { '/icons/book.svg': 'current' } },
    fetch: async () => { calls++; return new Response('downloaded'); },
  });
  assert.equal(await (await app.request('/icons/book.svg')).text(), 'current');
  assert.equal(await (await app.request('/assets/new.js')).text(), 'downloaded');
  assert.equal(await (await app.request('/assets/new.js')).text(), 'downloaded');
  assert.equal(calls, 1);
});

test('cache read and write failures preserve successful network responses', async () => {
  for (const failure of [{ failRead: true }, { failWrite: true }]) {
    const app = worker(failure);
    for (const [path, mode] of [['/assets/main.js', 'cors'], ['/', 'navigate'], ['/theme.js', 'cors']]) {
      const response = await app.request(path, mode);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'network');
    }
  }
});

test('offline navigation uses the current app cache and cache failures produce a controlled response', async () => {
  const fetch = async () => { throw new Error('Offline'); };
  const app = worker({ fetch, entries: { 'mm-app-old': { '/': 'stale' }, 'mm-app-dev': { '/': 'current' } } });
  assert.equal(await (await app.request('/journal', 'navigate')).text(), 'current');
  const unavailable = worker({ fetch, failRead: true });
  assert.equal((await unavailable.request('/journal', 'navigate')).type, 'error');
});

test('temporary server failures fall back to cached pages while client errors remain visible', async () => {
  for (const status of [503, 404]) {
    const app = worker({ fetch: async () => new Response('server response', { status }), entries: { 'mm-app-dev': { '/': 'cached page' } } });
    const response = await app.request('/journal', 'navigate');
    assert.equal(response.status, status === 503 ? 200 : 404);
    assert.equal(await response.text(), status === 503 ? 'cached page' : 'server response');
  }
});

test('successful HTML navigation refreshes the offline shell without asset navigations replacing it', async () => {
  let online = true;
  const app = worker({
    entries: { 'mm-app-dev': { '/': 'old shell' } },
    fetch: async (req) => {
      if (!online) throw new Error('Offline');
      return req.url.endsWith('/icon.svg')
        ? new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } })
        : new Response('fresh shell', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    },
  });
  assert.equal(await (await app.request('/journal', 'navigate')).text(), 'fresh shell');
  assert.equal(await (await app.request('/icon.svg', 'navigate')).text(), '<svg/>');
  online = false;
  assert.equal(await (await app.request('/journal', 'navigate')).text(), 'fresh shell');
});

test('activation keeps the preceding build for open tabs, removes older builds and keeps unrelated origin caches', async () => {
  const app = worker({ entries: { 'mm-app-older': {}, 'mm-app-old': {}, 'mm-app-dev': {}, 'mm-img-v1': {}, 'another-app': {} } });
  await app.activate();
  assert.deepEqual([...app.stores.keys()], ['mm-app-old', 'mm-app-dev', 'mm-img-v1', 'another-app']);
  assert.equal(app.claimed(), true);
});

test('API and non-GET requests remain outside the service worker', async () => {
  const app = worker();
  assert.equal(await app.request('/api/health'), undefined);
  assert.equal(await app.request('/glops/', 'navigate'), undefined, 'the game’s page is its own site');
  assert.equal(await app.request('/glops/net/analytics'), undefined, 'live player stats are never cached');
  assert.equal(await app.request('/journal', 'cors', 'POST'), undefined);
});

test('caches left by the removed voice typing are deleted on activation', async () => {
  const app = worker({ entries: { 'mm-app-dev': {}, 'mm-voice-v1': {}, 'transformers-cache': {} } });
  await app.activate();
  assert.deepEqual([...app.stores.keys()], ['mm-app-dev']);
});

test('open tabs can import a preceding build screen offline without using its shell or mutable icons', async () => {
  const app = worker({
    entries: {
      'mm-app-old': { '/assets/Editor-12345678.js': 'old screen', '/': 'old shell', '/icons/book.svg': 'old icon' },
      'mm-app-dev': { '/': 'current shell' },
    },
    fetch: async () => { throw new Error('Offline'); },
  });
  await app.activate();
  assert.equal(await (await app.request('/assets/Editor-12345678.js')).text(), 'old screen');
  assert.equal(await (await app.request('/', 'navigate')).text(), 'current shell');
  await assert.rejects(app.request('/icons/book.svg'), /Offline/);
});

test('a public note page never replaces the offline app shell', async () => {
  const html = { headers: { 'Content-Type': 'text/html; charset=utf-8' } };
  const token = 'a'.repeat(32);
  const app = worker({ entries: { 'mm-app-dev': { '/': 'app shell' } }, fetch: async () => new Response('note page with a title', html) });
  assert.equal(await (await app.request(`/s/${token}`, 'navigate')).text(), 'note page with a title');
  assert.equal(await app.stores.get('mm-app-dev').get(new URL('/', origin).href).text(), 'app shell');
  const offline = worker({ entries: { 'mm-app-dev': { '/': 'app shell' } }, fetch: async () => { throw new Error('Offline'); } });
  assert.equal(await (await offline.request(`/s/${token}`, 'navigate')).text(), 'app shell');
});

test('an update copies unchanged hashed files from the running build and downloads the rest', async () => {
  const fetched = [];
  const app = worker({
    precache: ['/', '/theme.js', '/assets/Editor-12345678.js', '/assets/Journal-abcdefgh.js'],
    entries: { 'mm-app-old': { '/assets/Editor-12345678.js': 'kept screen', '/theme.js': 'old theme' } },
    fetch: async (req) => { fetched.push(new URL(req.url).pathname); return new Response('downloaded'); },
  });
  await app.install();
  assert.deepEqual(fetched.sort(), ['/', '/assets/Journal-abcdefgh.js', '/theme.js']);
  assert.equal(await app.stores.get('mm-app-dev').get(key('/assets/Editor-12345678.js')).text(), 'kept screen');
});

test('navigations use the preloaded response instead of fetching again', async () => {
  let calls = 0;
  const html = { headers: { 'Content-Type': 'text/html; charset=utf-8' } };
  const app = worker({ fetch: async () => { calls++; return new Response('fetched', html); } });
  assert.equal(await (await app.request('/journal', 'navigate', 'GET', Promise.resolve(new Response('preloaded', html)))).text(), 'preloaded');
  assert.equal(await (await app.request('/journal', 'navigate', 'GET', Promise.resolve(undefined))).text(), 'fetched');
  assert.equal(calls, 1);
});
