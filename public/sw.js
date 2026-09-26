// Offline support. The whole build is cached on install. Pages: network first, cached copy when offline.
// Hashed assets: cache first. Pinterest images: cache first, so notes keep their pictures offline.
// VERSION and PRECACHE are filled in by the build (see vite.config.ts).
const VERSION = 'dev';
const PRECACHE = [];
const APP = 'mm-app-' + VERSION;
const IMG = 'mm-img-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(PRECACHE.length ? PRECACHE : ['/', '/theme.js', '/manifest.webmanifest', '/icon.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== IMG).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function cacheFirst(req, name) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') (await caches.open(name)).put(req, res.clone());
  return res;
}

async function networkFirst(req, fallback) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(APP)).put(fallback ?? req, res.clone());
    return res;
  } catch {
    return (await caches.match(fallback ?? req)) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    if (req.mode === 'navigate') return e.respondWith(networkFirst(req, '/'));
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) return e.respondWith(cacheFirst(req, APP));
    return e.respondWith(networkFirst(req));
  }
  if (url.hostname === 'i.pinimg.com') e.respondWith(cacheFirst(req, IMG));
});
