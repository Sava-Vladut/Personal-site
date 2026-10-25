// Offline support. The whole build is cached on install. Pages: network first, cached copy when offline.
// Hashed assets: cache first. Web images (Openverse thumbnails, older Pinterest images): cache first, so notes keep their pictures offline.
// VERSION and PRECACHE are filled in by the build (see vite.config.ts).
const VERSION = 'dev';
const PRECACHE = [];
const APP = 'mm-app-' + VERSION;
const IMG = 'mm-img-v1';
// caches of the removed voice typing, cleared from devices that still have them
const RETIRED = ['mm-voice-v1', 'transformers-cache'];

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
      return Promise.all(keys.filter((k) => RETIRED.includes(k) || ((k.startsWith('mm-app-') || k.startsWith('mm-img-')) && k !== APP && k !== previous && k !== IMG)).map((k) => caches.delete(k)));
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
    if (url.pathname.startsWith('/api/')) return;
    // /game is a separate site served by Caddy: never cache it, and never let its page replace the app shell.
    if (url.pathname === '/game' || url.pathname.startsWith('/game/')) return;
    // A public note's, status's or shared Learn page carries its title in its head: never keep it as the app's own offline page.
    if (req.mode === 'navigate' && (url.pathname.startsWith('/s/') || url.pathname.startsWith('/status/') || /^\/learn(?:\/|$)/.test(url.pathname))) return e.respondWith(fetch(req).catch(async () => (await cached('/', APP)) || Response.error()));
    if (req.mode === 'navigate') return e.respondWith(networkFirst(req, '/'));
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
      const fingerprinted = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[^/]+$/.test(url.pathname);
      return e.respondWith(cacheFirst(req, APP, fingerprinted));
    }
    return e.respondWith(networkFirst(req));
  }
  if (url.hostname === 'i.pinimg.com' || (url.hostname === 'api.openverse.org' && url.pathname.endsWith('/thumb/'))) e.respondWith(cacheFirst(req, IMG));
});
