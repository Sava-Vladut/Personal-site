// Offline support. The whole build is cached on install. Pages: network first, cached copy when offline.
// Hashed assets: cache first. Web images (Openverse thumbnails, older Pinterest images): cache first, so notes keep their pictures offline.
// Voice typing's runtime and WebAssembly (/voice/transformers-*, /voice/ort-*) are cached first the first time they are used, in a cache of their
// own that updates never clear. Its model files (/voice/models/) are large and are kept by the page itself, so they pass straight through.
// VERSION and PRECACHE are filled in by the build (see vite.config.ts).
const VERSION = 'dev';
const PRECACHE = [];
const APP = 'mm-app-' + VERSION;
const IMG = 'mm-img-v1';
const VOICE = 'mm-voice-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(PRECACHE.length ? PRECACHE : ['/', '/theme.js', '/manifest.webmanifest', '/icon.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      // An open tab can still import a screen from the preceding build after an update.
      // Keep that build's immutable assets until the next update, with a bounded two-build cache.
      const previous = keys.filter((k) => k.startsWith('mm-app-') && k !== APP).at(-1);
      return Promise.all(keys.filter((k) => (k.startsWith('mm-app-') || k.startsWith('mm-img-')) && k !== APP && k !== previous && k !== IMG).map((k) => caches.delete(k)));
    }).then(() => self.clients.claim()),
  );
});

// Cache storage can fail when a device is full or private browsing blocks it.
// It must never prevent a successful network response from reaching the app.
async function cached(req, name) {
  try { return await (await caches.open(name)).match(req); }
  catch { return undefined; }
}

async function remember(req, res, name) {
  try { await (await caches.open(name)).put(req, res.clone()); }
  catch { /* Keep the network response usable when offline storage is unavailable. */ }
}

async function cacheFirst(req, name, previousBuild = false) {
  let hit = await cached(req, name);
  if (!hit && previousBuild) {
    try {
      const previous = (await caches.keys()).filter((k) => k.startsWith('mm-app-') && k !== APP).at(-1);
      if (previous) hit = await cached(req, previous);
    } catch { /* Network remains usable when cache storage is unavailable. */ }
  }
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') await remember(req, res, name);
  return res;
}

async function networkFirst(req, fallback) {
  try {
    const res = await fetch(req);
    // A navigation to an image or download must not replace the offline app shell.
    if (res.ok && (!fallback || /^text\/html(?:;|$)/i.test(res.headers.get('Content-Type') || ''))) await remember(fallback ?? req, res, APP);
    else if (res.status >= 500) return (await cached(fallback ?? req, APP)) || res;
    return res;
  } catch {
    return (await cached(fallback ?? req, APP)) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/voice/models/')) return;
    if (/^\/voice\/(?:transformers-|ort-)/.test(url.pathname)) return e.respondWith(cacheFirst(req, VOICE));
    if (req.mode === 'navigate') return e.respondWith(networkFirst(req, '/'));
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
      const fingerprinted = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[^/]+$/.test(url.pathname);
      return e.respondWith(cacheFirst(req, APP, fingerprinted));
    }
    return e.respondWith(networkFirst(req));
  }
  if (url.hostname === 'i.pinimg.com' || (url.hostname === 'api.openverse.org' && url.pathname.endsWith('/thumb/'))) e.respondWith(cacheFirst(req, IMG));
});
