import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { rolldown } from 'rolldown';

// The whole note page (src/views/Editor.tsx: the editor, its ribbon, status bar, pictures and sheets) with a long note,
// in jsdom: how long it takes to open, what a key costs with the page around it, and what happens after a pause in
// typing (the words written back into the draft and the page drawn again; then the save into the store). The store
// runs on an in-memory database. Timers and frames run when this says so, each timed on its own.
//   node scripts/bench-editor-page.mjs [words]
// Not part of npm test: it prints numbers, it checks nothing. See also scripts/bench-editor.mjs (the editor alone).
const root = new URL('..', import.meta.url).pathname;
const WORDS = Number(process.argv[2]) || 20000;

const MEMORY_DB = `
  const stores = { entries: new Map(), kv: new Map(), photos: new Map() };
  const later = (fn) => Promise.resolve().then(fn);
  export const onBlocked = () => {};
  export const db = {
    update: (key, change) => later(() => { const next = change(stores.kv.get(key)); stores.kv.set(key, next); return next; }),
    reconcileEntries: async () => ({ entries: [...stores.entries.values()], changed: [], removed: [], deleted: {} }),
    all: () => later(() => [...stores.entries.values()]),
    put: (v) => later(() => void stores.entries.set(v.id, v)),
    putMany: (vs) => later(() => vs.forEach((v) => stores.entries.set(v.id, v))),
    del: (id) => later(() => void stores.entries.delete(id)),
    clear: () => later(() => stores.entries.clear()),
    get: (k) => later(() => stores.kv.get(k)),
    set: (k, v) => later(() => void stores.kv.set(k, v)),
    photo: (id) => later(() => stores.photos.get(id)),
    photos: () => later(() => [...stores.photos.values()]),
    photoIds: () => later(() => [...stores.photos.keys()]),
    putPhotos: (vs) => later(() => vs.forEach((v) => stores.photos.set(v.id, v))),
    delPhotos: (ids) => later(() => ids.forEach((id) => stores.photos.delete(id))),
    clearPhotos: () => later(() => stores.photos.clear()),
  };
`;

const bundle = await rolldown({
  input: 'bench:page',
  logLevel: 'silent',
  transform: { jsx: { runtime: 'automatic', importSource: 'preact' }, define: { __LATEST_RELEASE__: '{"version":"0","date":"","changes":[]}' } },
  plugins: [{
    name: 'bench-page',
    resolveId(id) {
      if (id === 'bench:page') return '\0' + id;
      if (id.endsWith('.css')) return '\0css';
      if (id.endsWith('?worker')) return '\0worker';
      if (/\/data\/(traps|laws|principles)$/.test(id)) return '\0learn-data';
    },
    load(id) {
      if (id === '\0css') return '';
      if (id === '\0worker') return 'export default class { postMessage() {} terminate() {} addEventListener() {} removeEventListener() {} };';
      if (id.endsWith('/src/lib/db.ts')) return MEMORY_DB;
      if (id.endsWith('/src/lib/i18n.ts')) return readFileSync(id, 'utf8').replace("await import('../data/ro')", 'null');
      if (id === '\0learn-data') return 'export const TRAPS = [], LAWS = [], PRINCIPLES = [], FAMILIES = {}, REALMS = {}, PARTS = {};';
      if (id === '\0bench:page') return `
        export { Editor } from '${root}src/views/Editor.tsx';
        export { saveEntry, savePerson, saveSong, blankSong, blankEntry, blankPerson, getEntries, onEntries } from '${root}src/lib/store.ts';
        export { h, render, options } from 'preact';
        export { act } from 'preact/test-utils';
      `;
    },
    transform(code, id) {
      // the editor's handle, for typing into it from here
      if (id.endsWith('/src/editor/NoteBody.tsx')) return code.replace('props.current.onReady(handle);', 'props.current.onReady(handle); globalThis.__note = handle;');
    },
  }],
});
const code = (await bundle.generate({ format: 'iife', name: 'NB' })).output[0].code;
await bundle.close();

/** The same long note as scripts/bench-editor.mjs. */
function longNote(words) {
  const vocab = 'the a quiet morning walk river light coffee friend talked about work tired happy because we went home later thought maybe tomorrow better slowly city rain window book'.split(' ');
  let seed = 7;
  // mulberry32: the same note every run
  const rnd = (n) => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
  const word = () => vocab[rnd(vocab.length)];
  const lines = [];
  let n = 0, k = 0;
  while (n < words) {
    k++;
    if (k % 25 === 1) lines.push(`## Part ${k}`);
    if (k % 9 === 0) {
      lines.push(`[[photo:p${k} 50 ${k % 2 ? 'left' : 'right'}]]`);
      continue;
    }
    if (k % 7 === 0) {
      for (let i = 0; i < 3; i++) lines.push(`${i === 1 ? '- [ ] ' : '- '}${word()} ${word()} ${word()} @[person:p${i}|Ann ${i}]`);
      n += 12;
      continue;
    }
    if (k % 11 === 0) lines.push(`> ${word()} ${word()} ${word()} ${word()}`);
    const len = 40 + rnd(40);
    const parts = [];
    for (let i = 0; i < len; i++) {
      const r = rnd(60);
      parts.push(r === 0 ? `@[person:p${rnd(30)}|Person ${rnd(30)}]` : r === 1 ? `[[note:n${rnd(50)}|Note ${rnd(50)}]]` : r === 2 ? `**${word()}**` : r === 3 ? `#tag${rnd(9)}` : r === 4 ? `♪[song:s${rnd(9)}|Song]` : r === 5 ? `[${word()}](https://example.com/${rnd(99)})` : word());
    }
    n += len;
    lines.push(parts.join(' ') + '.');
  }
  return lines.join('\n');
}
const text = longNote(WORDS);
const photoIds = [...text.matchAll(/\[\[photo:(p\d+)/g)].map((m) => m[1]);

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, runScripts: 'outside-only', url: 'https://example.com/#/note/note-1' });
const { window } = dom;
window.Range.prototype.getClientRects = () => [];
window.Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
window.document.elementFromPoint = () => null;
window.ClipboardEvent = class extends window.Event { constructor(type, o) { super(type, o); this.clipboardData = null; } };
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.CSS ??= { supports: () => false, escape: (s) => s };
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
window.fetch = () => new Promise(() => {});
// timers and frames run when asked
let clock = 0, nextId = 1;
const timers = new Map();
window.setTimeout = (fn, ms = 0) => (timers.set(nextId, { fn, at: clock + ms }), nextId++);
window.clearTimeout = (id) => timers.delete(id);
window.setInterval = () => 0;
window.clearInterval = () => {};
const frames = new Map();
window.requestAnimationFrame = (fn) => (frames.set(nextId, fn), nextId++);
window.cancelAnimationFrame = (id) => frames.delete(id);
window.eval(code);
const NB = window.NB;

const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
};
const runFrames = () => {
  const due = [...frames.values()];
  frames.clear();
  NB.act(() => due.forEach((fn) => fn(0)));
};
/** Moves the clock on `ms`, running what's due (each timed): what each took. */
const advance = (ms) => {
  clock += ms;
  const took = [];
  for (;;) {
    const due = [...timers.entries()].filter(([, t]) => t.at <= clock).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    timers.delete(due[0]);
    const a = performance.now();
    NB.act(() => due[1].fn());
    took.push(performance.now() - a);
  }
  return took;
};
const sum = (l) => l.reduce((a, b) => a + b, 0);
const ms = (x) => x.toFixed(2) + ' ms';
const stats = (list) => {
  const s = [...list].sort((a, b) => a - b);
  return `median ${ms(s[Math.floor(s.length / 2)])}, p95 ${ms(s[Math.floor(s.length * 0.95)])}, max ${ms(s[s.length - 1])}`;
};

// the store: the note, other notes linking about, people
for (let i = 0; i < 40; i++) await NB.savePerson({ ...NB.blankPerson('Person ' + i), id: 'p' + i });
for (let i = 0; i < 9; i++) await NB.saveSong({ ...NB.blankSong({ kind: 'track', id: 'spotifytrack' + i, title: 'Song ' + i, link: 'https://open.spotify.com/track/spotifytrack' + i }), id: 's' + i });
const others = [];
for (let i = 0; i < 300; i++) others.push(NB.saveEntry({ ...NB.blankEntry('note'), id: 'n' + i, title: 'Note ' + i, text: 'words about the day '.repeat(30) + (i % 10 ? '' : '[[note:note-1|Long]]'), date: '2026-10-' + String(1 + (i % 28)).padStart(2, '0') }));
await Promise.all(others);
await NB.saveEntry({ ...NB.blankEntry('note'), id: 'note-1', title: 'Long', text, photos: photoIds.map((id) => ({ id, w: 1200, h: 800 })) });
await settle();

console.log(`note: ${WORDS} words, ${text.length} characters; ${NB.getEntries().length} notes in the store`);
const host = window.document.createElement('div');
window.document.body.append(host);
const t0 = performance.now();
NB.act(() => NB.render(NB.h(NB.Editor, { id: 'note-1' }), host));
const t1 = performance.now();
// (BENCH_STOP=open: only the opening, e.g. to profile it with --cpu-prof)
if (process.env.BENCH_STOP === 'open') {
  console.log('open:', (t1 - t0).toFixed(1), 'ms');
  process.exit(0);
}
runFrames();
const t2 = performance.now();
console.log('open (first render, before paint):', ms(t1 - t0), '| first frame after:', ms(t2 - t1));
await settle();
advance(2000);
runFrames();
await settle();

const count = (sel) => window.document.querySelectorAll(sel).length;
console.log(`  tags: ${count('.note-chip')} (people ${count('.mention.is-person')}, note links ${count('.mention.is-note')}, songs ${count('.mention.is-song')}), pictures: ${count('.media-node')}`);
const note = window.__note;
const view = note.view;
// a tap under the words: writing, as the page switches to it
const t3 = performance.now();
NB.act(() => window.document.querySelector('.read-tail').click());
console.log('switch to writing (tap under the words):', ms(performance.now() - t3));
const TextSelection = view.state.selection.constructor;
let at = Math.floor(view.state.doc.content.size / 2);
while (!view.state.doc.resolve(at).parent.isTextblock) at++;
view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
runFrames();

// which components draw, and how often: counted by name
const drawn = new Map();
const prevDiffed = NB.options.diffed;
NB.options.diffed = (v) => {
  if (typeof v.type === 'function') drawn.set(v.type.displayName || v.type.name || '?', (drawn.get(v.type.displayName || v.type.name || '?') ?? 0) + 1);
  prevDiffed?.(v);
};
const top = (n = 12) => [...drawn].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k}×${v}`).join(' ');
const keys = [], after = [], pauses = [], saves = [];
const typed = 'and then we walked home slowly ';
for (let round = 0; round < 4; round++) {
  for (const ch of typed) {
    const { from, to } = view.state.selection;
    const a = performance.now();
    NB.act(() => {
      if (!view.someProp('handleTextInput', (f) => f(view, from, to, ch))) view.dispatch(view.state.tr.insertText(ch, from, to));
    });
    const b = performance.now();
    runFrames();
    after.push(performance.now() - b);
    keys.push(b - a);
    advance(80); // a fast typist: a key every 80 ms (the 2 s most a change waits still comes due)
  }
  // a pause: the words go back into the draft (300 ms), then it's saved (500 ms after that)
  if (round === 0) console.log('  drawn while typing:', top());
  drawn.clear();
  const p = advance(320);
  pauses.push(sum(p));
  if (round === 0) console.log('  drawn on the pause:', top());
  drawn.clear();
  const s0 = performance.now();
  advance(520);
  await settle();
  runFrames();
  saves.push(performance.now() - s0);
  if (round === 0) console.log('  drawn on the save:', top());
  drawn.clear();
}
console.log(`key with the page (transaction, editor and page updates), ${keys.length} keys:`, stats(keys));
console.log('frame after a key:', stats(after));
console.log('pause: words written back into the draft, page drawn again:', stats(pauses));
console.log('save after the pause (store, page drawn again):', stats(saves));
process.exit(0);
