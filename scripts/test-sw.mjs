import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://example.test';
const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;

function worker({ fetch = async () => new Response('network'), entries = {}, failRead = false, failWrite = false } = {}) {
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
      };
    },
    // Matching across caches reproduces the browser's oldest-cache-first behavior.
    match: async (request) => {
      for (const store of stores.values()) if (store.has(key(request))) return store.get(key(request)).clone();
    },
  };
  runInNewContext(source, {
    self: { addEventListener: (type, handler) => { listeners[type] = handler; }, clients: { claim: async () => { claimed = true; } } },
    caches, fetch, URL, Response, location: { origin },
  });
  return {
    stores,
    claimed: () => claimed,
    request: async (path, mode = 'cors', method = 'GET') => {
      let response;
      listeners.fetch({ request: { url: key(path), method, mode }, respondWith: (promise) => { response = promise; } });
      return await response;
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

test('activation removes old app caches and keeps unrelated origin caches', async () => {
  const app = worker({ entries: { 'mm-app-old': {}, 'mm-app-dev': {}, 'mm-img-v1': {}, 'another-app': {} } });
  await app.activate();
  assert.deepEqual([...app.stores.keys()], ['mm-app-dev', 'mm-img-v1', 'another-app']);
  assert.equal(app.claimed(), true);
});

test('API and non-GET requests remain outside the service worker', async () => {
  const app = worker();
  assert.equal(await app.request('/api/health'), undefined);
  assert.equal(await app.request('/journal', 'cors', 'POST'), undefined);
});

test('voice typing: the runtime is cached on first use in its own cache, model files pass through, and updates keep the cache', async () => {
  let calls = 0;
  const app = worker({ entries: { 'mm-app-old': {}, 'mm-app-dev': {}, 'mm-voice-v1': {} }, fetch: async () => { calls++; return new Response('runtime'); } });
  for (const path of ['/voice/transformers-4.3.0.js', '/voice/ort-4.3.0/ort-wasm-simd-threaded.wasm']) {
    assert.equal(await (await app.request(path)).text(), 'runtime');
    assert.equal(await (await app.request(path)).text(), 'runtime');
  }
  assert.equal(calls, 2);
  assert.equal(app.stores.get('mm-voice-v1').size, 2);
  assert.equal(app.stores.get('mm-app-dev').size, 0);

  // the model's weights are large; the page keeps them itself, so the worker neither answers for them nor copies them
  assert.equal(await app.request('/voice/models/onnx-community/whisper-tiny.en/resolve/main/onnx/encoder_model_quantized.onnx'), undefined);
  assert.equal(app.stores.get('mm-app-dev').size, 0);

  await app.activate();
  assert.deepEqual([...app.stores.keys()], ['mm-app-dev', 'mm-voice-v1']);
});
