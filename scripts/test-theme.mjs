import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

// public/theme.js runs before the app on every page: the colour scheme, then the first screen's files fetched early.
// The build fills in the file lists (vite.config.ts); here they're small stand-ins.
const source = (await readFile(new URL('../public/theme.js', import.meta.url), 'utf8'))
  .replace('var FILES = [];', 'var FILES = ["Journal-aaaaaaaa.js","journal-bbbbbbbb.css","Stats-cccccccc.js","Shared-dddddddd.js","opening-eeeeeeee.js","ro-ffffffff.js","serif-latin-ext-gggggggg.woff2","Media-hhhhhhhh.js","Mind-iiiiiiii.js","Laws-jjjjjjjj.js"];')
  .replace('var SCREENS = {};', 'var SCREENS = {"journal":[0,1],"stats":[2],"/s":[3],"opening":[4],"media":[7],"mind":[8],"laws":[9]};')
  .replace('var ROMANIAN = [];', 'var ROMANIAN = [5,6];');

function open(url, { local = {}, session = {}, reduced = false, html = '<html>' } = {}) {
  const dom = new JSDOM(`<!doctype html>${html}<head><meta name="theme-color" content="#fafaf9"></head><body></body></html>`, { url, runScripts: 'outside-only' });
  const { window } = dom;
  for (const [k, v] of Object.entries(local)) window.localStorage.setItem(k, v);
  for (const [k, v] of Object.entries(session)) window.sessionStorage.setItem(k, v);
  window.matchMedia = (q) => ({ matches: q.includes('reduced-motion') ? reduced : false });
  window.eval(source);
  const links = [...window.document.head.querySelectorAll('link')].map((l) => [l.rel, l.getAttribute('href'), l.getAttribute('as') ?? '', l.getAttribute('crossorigin')]);
  return { window, links, hrefs: links.map((l) => l[1]) };
}

test('the journal\'s files are fetched with the same request the app makes for them, and the opening\'s too', () => {
  const { links } = open('https://example.test/');
  assert.deepEqual(links, [
    ['modulepreload', '/assets/Journal-aaaaaaaa.js', '', ''],
    ['preload', '/assets/journal-bbbbbbbb.css', 'style', ''],
    ['modulepreload', '/assets/opening-eeeeeeee.js', '', ''],
  ]);
});

test('no opening files once it has played in this visit, or with reduced motion', () => {
  assert.deepEqual(open('https://example.test/#/', { session: { 'mm-intro-seen': '1' } }).hrefs, ['/assets/Journal-aaaaaaaa.js', '/assets/journal-bbbbbbbb.css']);
  assert.deepEqual(open('https://example.test/', { reduced: true }).hrefs, ['/assets/Journal-aaaaaaaa.js', '/assets/journal-bbbbbbbb.css']);
});

test('a deep link fetches its own screen, and unknown or renamed places follow the router', () => {
  assert.deepEqual(open('https://example.test/#/stats?range=30d').hrefs, ['/assets/Stats-cccccccc.js']);
  assert.deepEqual(open('https://example.test/#/books').hrefs, ['/assets/Media-hhhhhhhh.js']);
  assert.deepEqual(open('https://example.test/#/people/mind').hrefs, ['/assets/Mind-iiiiiiii.js']);
  assert.deepEqual(open('https://example.test/#/nowhere', { session: { 'mm-intro-seen': '1' } }).hrefs, ['/assets/Journal-aaaaaaaa.js', '/assets/journal-bbbbbbbb.css']);
});

test('public pages fetch their own screen and nothing of the journal', () => {
  assert.deepEqual(open(`https://example.test/s/${'a'.repeat(32)}`).hrefs, ['/assets/Shared-dddddddd.js']);
  assert.deepEqual(open('https://example.test/learn/laws').hrefs, ['/assets/Laws-jjjjjjjj.js']);
});

test('Romanian: the dictionary and letters come along wherever the app will read Romanian', () => {
  const ro = open('https://example.test/#/stats', { local: { 'mm-lang': 'ro' } });
  assert.deepEqual(ro.links.slice(1), [
    ['modulepreload', '/assets/ro-ffffffff.js', '', ''],
    ['preload', '/assets/serif-latin-ext-gggggggg.woff2', 'font', ''],
  ]);
  assert.equal(ro.window.document.querySelector('link[as=font]').getAttribute('type'), 'font/woff2');
  // a public status page in the owner's language, whatever this device reads
  assert.deepEqual(open(`https://example.test/status/${'a'.repeat(32)}`, { html: '<html data-mm-lang="ro">' }).hrefs, ['/assets/ro-ffffffff.js', '/assets/serif-latin-ext-gggggggg.woff2']);
  assert.deepEqual(open(`https://example.test/status/${'a'.repeat(32)}`, { html: '<html data-mm-lang="en">', local: { 'mm-lang': 'ro' } }).hrefs, []);
  // a shared Learn link in the language it was shared in
  assert.deepEqual(open('https://example.test/learn/laws?lang=ro').hrefs, ['/assets/Laws-jjjjjjjj.js', '/assets/ro-ffffffff.js', '/assets/serif-latin-ext-gggggggg.woff2']);
  assert.deepEqual(open('https://example.test/#/stats').hrefs, ['/assets/Stats-cccccccc.js']);
});

test('the colour scheme is still set first, and nothing it declares lands on window', () => {
  const { window } = open('https://example.test/#/stats', { local: { 'mm-settings': JSON.stringify({ theme: 'dark' }) } });
  assert.equal(window.document.documentElement.dataset.theme, 'dark');
  assert.equal(window.document.querySelector('meta[name="theme-color"]').getAttribute('content'), '#141413');
  for (const name of ['FILES', 'SCREENS', 'ROMANIAN', 'want', 'lang', 'link', 'file', 'path', 'head']) assert.equal(name in window, false, name);
  assert.equal(typeof window.screen, 'object', 'window.screen is untouched');
});
