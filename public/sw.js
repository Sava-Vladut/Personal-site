// Offline support. The whole build is cached on install. Pages: network first, cached copy when offline (or when the
// network is too slow to answer). Hashed assets: cache first. Web images (Openverse thumbnails, older Pinterest images):
// cache first, so notes keep their pictures offline. The push-up counter's pose model and its WebAssembly (/pose/) are
// cached first the first time they are used, in a cache of their own that updates never clear: their names carry their
// version, so they never change, and the 13 MB runtime isn't downloaded again with every update.
// VERSION, PRECACHE and REVISIONS are filled in by the build (see vite.config.ts).
const VERSION = 'dev';
const PRECACHE = [];
// the files without a hashed name, with their content's hash
const REVISIONS = {};
const APP = 'mm-app-' + VERSION;
const IMG = 'mm-img-v1';
// not mm-app-* or mm-img-*, so activation keeps it
const POSE = 'mm-pose-v1';
// caches of the removed voice typing, cleared from devices that still have them
const RETIRED = ['mm-voice-v1', 'transformers-cache'];
// where a build's cache keeps its REVISIONS, for the next update to compare with (never a real address)
const REVISIONS_KEY = '/__revisions';
// A connection that's there but hardly moves would leave the app blank until the browser gives up on it: after this
// long the saved copy opens instead, and the late answer still refreshes it for next time.
const SLOW_PAGE = 4000;

const FINGERPRINTED = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[^/]+$/;

self.addEventListener('install', (e) => {
  e.waitUntil(precache());
  self.skipWaiting();
});

// An update downloads only what changed: hashed files the running build already cached are copied across, and so are
// the other files whose content is the same as in that build. The rest is fetched at low priority, so it gives way to
// what the open page is loading (the app registers the worker only once its first screen is up).
async function precache() {
  const cache = await caches.open(APP);
  if (!PRECACHE.length) return cache.addAll(['/', '/theme.js', '/manifest.webmanifest', '/icon.svg']);
  const previous = (await caches.keys()).filter((k) => k.startsWith('mm-app-') && k !== APP).at(-1);
  const old = previous && (await caches.open(previous));
  const before = old ? await old.match(REVISIONS_KEY).then((r) => r?.json()).catch(() => undefined) : undefined;
  const fresh = [];
  await Promise.all(PRECACHE.map(async (url) => {
    const same = FINGERPRINTED.test(url) || (url in REVISIONS && before?.[url] === REVISIONS[url]);
    const hit = old && same && (await old.match(url));
    if (hit) await cache.put(url, hit);
    else fresh.push(url);
  }));
  await cache.addAll(fresh.map((url) => new Request(url, { priority: 'low' })));
  await cache.put(REVISIONS_KEY, new Response(JSON.stringify(REVISIONS), { headers: { 'Content-Type': 'application/json' } }));
}

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      // An open tab can still import a screen from the preceding build after an update.
      // Keep that build's immutable assets until the next update, with a bounded two-build cache.
      const previous = keys.filter((k) => k.startsWith('mm-app-') && k !== APP).at(-1);
      return Promise.all(keys.filter((k) => RETIRED.includes(k) || ((k.startsWith('mm-app-') || k.startsWith('mm-img-')) && k !== APP && k !== previous && k !== IMG)).map((k) => caches.delete(k)));
    }).then(() => Promise.all([
      self.clients.claim(),
      // the page request starts while the worker is still waking, instead of after
      self.registration?.navigationPreload?.enable().catch(() => {}),
    ])),
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

async function networkFirst(req, fallback, preload, waitUntil) {
  const network = (async () => {
    const res = (await preload) || (await fetch(req));
    // A navigation to an image or download must not replace the offline app shell.
    if (res.ok && (!fallback || /^text\/html(?:;|$)/i.test(res.headers.get('Content-Type') || ''))) await remember(fallback ?? req, res, APP);
    else if (res.status >= 500) return (await cached(fallback ?? req, APP)) || res;
    return res;
  })();
  // A page that's slow to come: the saved copy after SLOW_PAGE, while the worker stays up for the network's answer.
  let slow, timer;
  if (waitUntil) {
    waitUntil(network.catch(() => {}));
    slow = new Promise((resolve) => { timer = setTimeout(resolve, SLOW_PAGE); }).then(async () => (await cached(fallback ?? req, APP)) || network);
  }
  try {
    return await (slow ? Promise.race([network, slow]) : network);
  } catch {
    return (await cached(fallback ?? req, APP)) || Response.error();
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // A page load under /api/ is a login's hop (GitHub's or Spotify's callback). With navigation preload on, leaving it
    // to the browser sends it to the server a second time, and a login code works only once: answer with the preload.
    if (url.pathname.startsWith('/api/')) return req.mode === 'navigate' ? e.respondWith(Promise.resolve(e.preloadResponse).then((res) => res || fetch(req))) : undefined;
    // /game, /glops (the Global Ops port and its stats) and /cardwars (the Card Wars port) are separate sites served by
    // Caddy: never cache them, and never let their pages replace the app shell.
    if (/^\/(?:game|glops|cardwars)(?:\/|$)/.test(url.pathname)) return;
    if (url.pathname.startsWith('/pose/')) return e.respondWith(cacheFirst(req, POSE));
    // A public note's, status's or shared Learn page carries its title in its head: never keep it as the app's own offline page.
    if (req.mode === 'navigate' && (url.pathname.startsWith('/s/') || url.pathname.startsWith('/status/') || /^\/learn(?:\/|$)/.test(url.pathname))) return e.respondWith(Promise.resolve(e.preloadResponse).then((res) => res || fetch(req)).catch(async () => (await cached('/', APP)) || Response.error()));
    if (req.mode === 'navigate') return e.respondWith(networkFirst(req, '/', e.preloadResponse, e.waitUntil?.bind(e)));
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
      return e.respondWith(cacheFirst(req, APP, FINGERPRINTED.test(url.pathname)));
    }
    return e.respondWith(networkFirst(req));
  }
  if (url.hostname === 'i.pinimg.com' || (url.hostname === 'api.openverse.org' && url.pathname.endsWith('/thumb/'))) e.respondWith(cacheFirst(req, IMG));
});
