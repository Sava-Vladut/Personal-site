import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// The data layer's shortcuts for long journals (cached and incremental work, fast paths) must give exactly what the
// plain way gives. Each is checked against the plain way, written out here, on many inputs.

const src = (p) => new URL(`../src/${p}`, import.meta.url).pathname;

/** Bundles `entry` (a module's source) with the given ids replaced, and runs it in a fresh context with `globals`. */
async function load(entry, mocks = {}, globals = {}) {
  const bundle = await rolldown({
    input: 'datalayer:entry',
    logLevel: 'silent',
    plugins: [{
      name: 'datalayer-test-boundaries',
      resolveId(id) {
        if (id === 'datalayer:entry') return '\0entry';
        if (id in mocks) return '\0mock:' + id;
      },
      load(id) {
        if (id === '\0entry') return entry;
        if (id.startsWith('\0mock:')) return mocks[id.slice(6)];
        // English only: the Romanian dictionary arrives by top-level await
        if (id.endsWith('/src/lib/i18n.ts')) return readFileSync(id, 'utf8').replace("await import('../data/ro')", 'null');
      },
    }],
  });
  const { output } = await bundle.generate({ format: 'cjs', codeSplitting: false });
  await bundle.close();
  const module = { exports: {} };
  vm.runInNewContext(output[0].code, {
    module, exports: module.exports, console, URL, TextEncoder, TextDecoder, Intl, structuredClone, queueMicrotask,
    setTimeout, clearTimeout, setImmediate, performance,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }), navigator: {},
    ...globals,
  });
  return module.exports;
}

const lib = await load(`
  export * from '${src('lib/dates.ts')}';
  export { parseBody, plainText, serializeBody } from '${src('lib/body.ts')}';
  export { dropTags, tablesIn } from '${src('lib/inline.ts')}';
  export { stripMarkdown } from '${src('lib/markdown.ts')}';
  export { mapTables } from '${src('lib/noteDoc/syntax.ts')}';
  export { dropComments } from '${src('lib/comments.ts')}';
  export { countWords, wordsOf } from '${src('lib/stats.ts')}';
  export { momentsByPerson, peopleIn } from '${src('lib/people.ts')}';
  export { booksIn, booksOf, mentionsByBook } from '${src('lib/books.ts')}';
  export { CORE, EMOTION, coreOf } from '${src('data/emotions.ts')}';
`, { './store': 'export const getBooks = () => [], getEntries = () => [], getPeople = () => [], getSongs = () => [];' });

/** A value from the module's context as a plain one of this context, for deepEqual (arrays there have their own prototype). */
const js = (x) => JSON.parse(JSON.stringify(x));

let seed = 1;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];

/* ---------- days ---------- */

// the days apart, weekdays and day-after as a Date works them out, in the time zone the test runs in
const ref = {
  parseKey: (k) => { const [y, m, d] = k.split('-').map(Number); const date = new Date(0); date.setFullYear(y, m - 1, d); date.setHours(0, 0, 0, 0); return date; },
  keyOf: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
};
ref.addDays = (k, n) => { const d = ref.parseKey(k); d.setDate(d.getDate() + n); return ref.keyOf(d); };
ref.diffDays = (a, b) => Math.round((ref.parseKey(b).getTime() - ref.parseKey(a).getTime()) / 864e5);
ref.weekday = (k) => (ref.parseKey(k).getDay() + 6) % 7;
ref.isDateKey = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [year, month, day] = v.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const pad = (n, w = 2) => String(n).padStart(w, '0');
function someKeys() {
  const keys = ['2024-02-29', '2023-02-29', '2000-02-29', '1900-02-29', '0000-02-29', '0099-12-31', '0050-01-01', '9999-12-31',
    '2024-03-31', '2024-10-27', '2024-04-31', '2023-02-30', '2024-12-31', '2025-01-01', '1970-01-01', '1969-12-31', '2026-03-29'];
  for (let i = 0; i < 400; i++) keys.push(`${pad(1950 + Math.floor(rnd() * 150), 4)}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 31))}`);
  return keys;
}

test('days apart, weekdays and the day after match what a Date gives, in several time zones', () => {
  const keys = someKeys();
  const was = process.env.TZ;
  try {
    for (const tz of ['UTC', 'Europe/Bucharest', 'America/New_York', 'America/Santiago', 'Australia/Lord_Howe', 'Asia/Kathmandu']) {
      process.env.TZ = tz;
      for (const k of keys) {
        assert.equal(lib.weekday(k), ref.weekday(k), `weekday ${k} ${tz}`);
        for (const n of [-400, -31, -7, -1, 0, 1, 2, 30, 366]) assert.equal(lib.addDays(k, n), ref.addDays(k, n), `addDays ${k} ${n} ${tz}`);
        const other = pick(keys);
        assert.equal(lib.diffDays(k, other), ref.diffDays(k, other), `diffDays ${k} ${other} ${tz}`);
      }
      // keys not written YYYY-MM-DD still go through a Date, as before
      for (const k of ['2024-1-5', '2024-13-01', '2024-00-10', '2024-01-00', '24-01-05']) {
        assert.equal(lib.addDays(k, 3), ref.addDays(k, 3), k);
        assert.equal(lib.weekday(k), ref.weekday(k), k);
        assert.equal(lib.diffDays(k, '2024-02-01'), ref.diffDays(k, '2024-02-01'), k);
      }
      assert.equal(lib.addDays('2024-03-30', 0.5), ref.addDays('2024-03-30', 0.5));
    }
    // Samoa skipped 30 December 2011: a Date put the 29th and the 31st a day apart, the calendar (and now this) two
    process.env.TZ = 'Pacific/Apia';
    assert.equal(ref.diffDays('2011-12-29', '2011-12-31'), 1);
    assert.equal(lib.diffDays('2011-12-29', '2011-12-31'), 2);
    assert.equal(lib.addDays('2011-12-29', 1), '2011-12-30');
  } finally {
    if (was === undefined) delete process.env.TZ;
    else process.env.TZ = was;
  }
});

test('calendar day checks match the Date-based ones', () => {
  const values = [...someKeys(), '2024-2-29', '2024-02-29T', ' 2024-02-29', '２０２４-01-01', 20240101, null, undefined, {}, '0000-00-00', '2024-06-31'];
  for (const v of values) assert.equal(lib.isDateKey(v), ref.isDateKey(v), String(v));
});

/* ---------- feelings ---------- */

test("each feeling's world is the one its id names", () => {
  for (const id of [...Object.keys(lib.EMOTION), 'joy/unknown', 'nothing', '', 'constructor', 'toString/x']) assert.equal(lib.coreOf(id), lib.CORE[id.split('/')[0]], id);
});

/* ---------- words ---------- */

const WORDS = ['a', 'word', 'șir', '日本', '😀', '**bold**', '[[photo:p1234567]]', '@[person:p1|Ana]', '|', '-', '---', ':--', '>', '<u>', '<!-- align:center -->'];
const SPACES = [' ', '  ', '\t', '\n', '\n\n', '\r\n', ' ', ' ', '　', '﻿', ' ', '​'];
const words = (n) => Array.from({ length: n }, () => pick(WORDS) + pick(SPACES)).join('');

test('word counts match splitting at spaces', () => {
  const split = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  for (let i = 0; i < 2000; i++) {
    const s = (rnd() < 0.3 ? pick(SPACES) : '') + words(Math.floor(rnd() * 12));
    assert.equal(lib.countWords(s), split(s), JSON.stringify(s));
  }
});

test("an entry's word count is kept per version of it", () => {
  const e = { text: 'one two <span class="comment">three</span><!-- comment: hidden words --> four' };
  assert.equal(lib.wordsOf(e), 4);
  assert.equal(lib.wordsOf(e), 4);
  assert.equal(lib.wordsOf({ ...e, text: e.text + ' five' }), 5, 'a saved entry is a new object, counted again');
  assert.equal(lib.wordsOf({ text: '' }), 0);
});

/* ---------- a note's words ---------- */

test('a note without pictures in its text is its own words', () => {
  for (let i = 0; i < 500; i++) {
    const s = words(Math.floor(rnd() * 20)).replaceAll('[[', '[ [');
    assert.deepEqual(js(lib.parseBody(s)), { texts: [s], media: [] });
    assert.equal(lib.plainText(s), s.trim() ? s : '');
  }
});

test("only a line that starts with [[ can be a picture, and a body reads back as it was written", () => {
  const body = lib.parseBody('words\n[[photo:pabcdefg 50 left]]\n more [[photo:pabcdefg]]\n [[photo:pabcdefg]]\n[[album:photo:pabcdefg image:https://x.org/a.jpg]]\nend');
  assert.equal(body.media.length, 2);
  assert.deepEqual(js(body.texts), ['words', ' more [[photo:pabcdefg]]\n [[photo:pabcdefg]]', 'end']);
  for (let i = 0; i < 300; i++) {
    const lines = Array.from({ length: 1 + Math.floor(rnd() * 8) }, () => (rnd() < 0.3 ? pick(['[[photo:pabcdefg]]', '[[image:https://x.org/a.jpg 40 right]]', '[[album:photo:pabcdefg photo:phijklm]]', '[[not a picture]]', '[[photo:pabcdefg|caption=Sea]]']) : words(3).replace(/\n/g, ' ')));
    const text = lines.join('\n');
    const parsed = lib.parseBody(text);
    assert.equal(parsed.texts.length, parsed.media.length + 1);
    assert.equal(lib.plainText(text), parsed.texts.filter((t) => t.trim()).join('\n\n'));
  }
});

test("tables are found exactly where mapTables finds them, and texts that can't hold one come back as they were", () => {
  const row = (cells, line) => `<${cells.join('·')}|${line.length}>`;
  const samples = [
    '| a | b |\n| --- | :-: |\n| 1 | 2 |', 'a | b\n--- | ---\n1 | 2', '> | a |\n> | --- |\n> | 1 |', '> > | a |\n> > |---|',
    '```\n| a |\n| --- |\n```', '| a |\n|---|\r\n| 1 |', '| a |\n| --- | ', '- | a |\n- | --- |', '@[person:p1|Ana] said\n---', 'x|y\n-|-',
    '| a | b |\n| --- |', '|a|\n|:--|\n', 'not | a table\nat - all', '> [!note] | a |\n> | --- |',
  ];
  for (let i = 0; i < 1500; i++) {
    const parts = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => (rnd() < 0.4 ? pick(samples) : words(4)));
    samples.push(parts.join(pick(['\n', '\n\n', ' '])));
  }
  for (const s of samples) {
    assert.equal(lib.tablesIn(s, row), lib.mapTables(s, row), JSON.stringify(s));
  }
  assert.equal(lib.stripMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |\nafter @[person:p1|Ana]'), 'a · b\n1 · 2\nafter Ana');
  // dropTags as it was: mapTables over the text without comments, then the tags taken out
  const tagged = '<u>under</u> <span style="color:red">red</span> x <!-- align:center -->\n| a |\n| --- |\n<div style="page-break-after: always;"></div>\nend';
  assert.equal(lib.dropTags(tagged), 'under red x\n| a |\nend');
  assert.equal(lib.dropTags('no tags | here\n- a'), 'no tags | here\n- a');
});

/* ---------- people's moments ---------- */

test("people's moments are worked out again only for what changed, and always as from scratch", () => {
  const people = [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Ion' }, { id: 'p3', name: 'Maria' }];
  const fresh = (entries, people) => {
    const m = new Map();
    for (const e of entries) for (const id of new Set([...e.people, ...lib.peopleIn(e.text, people)])) (m.get(id) ?? m.set(id, []).get(id)).push(e);
    return m;
  };
  const same = (a, b) => assert.deepEqual(js([...a].map(([id, l]) => [id, l.map((e) => e.id)])), js([...b].map(([id, l]) => [id, l.map((e) => e.id)])));
  let entries = Array.from({ length: 300 }, (_, i) => ({
    id: 'e' + i, people: rnd() < 0.3 ? [pick(people).id] : [],
    text: rnd() < 0.4 ? `with @[person:${pick(people).id}|${pick(people).name}] and @[${pick(['Ana', 'Ion', 'Nobody'])}]` : words(5),
  }));
  same(lib.momentsByPerson(entries, people), fresh(entries, people));
  same(lib.momentsByPerson(entries, people), fresh(entries, people));
  entries = entries.map((e, i) => (i % 7 ? e : { ...e, text: '@[Maria] now' }));
  same(lib.momentsByPerson(entries, people), fresh(entries, people));
  // a rename changes who a name-only tag points at: every note is read again for the new list
  const renamed = people.map((p) => (p.id === 'p3' ? { ...p, name: 'Nobody' } : p));
  same(lib.momentsByPerson(entries, renamed), fresh(entries, renamed));
});

test("the books a note mentions are read once per version of it and of the shelf, and always as from scratch", () => {
  let shelf = [{ id: 'b1', title: 'Dune' }, { id: 'b2', title: 'Emma' }];
  const notes = [
    { id: 'a', text: 'reading [[book:b1|Dune]] and [[Emma]]' }, { id: 'b', text: 'no books' }, { id: 'c', text: '[[photo:pabcdefg]]\n[[Dune]]' }, { id: 'd', text: '[[Nothing]]' },
  ];
  const check = () => {
    for (const e of notes) assert.deepEqual(js(lib.booksOf(e, shelf)), js(lib.booksIn(e.text, shelf)), e.id);
    const fresh = new Map();
    for (const e of notes) for (const id of lib.booksIn(e.text, shelf)) (fresh.get(id) ?? fresh.set(id, []).get(id)).push(e.id);
    assert.deepEqual(js([...lib.mentionsByBook(notes, shelf)].map(([id, l]) => [id, l.map((e) => e.id)])), js([...fresh]));
  };
  check();
  assert.deepEqual(js([...lib.mentionsByBook(notes, shelf)].map(([id, l]) => [id, l.map((e) => e.id)])), [['b1', ['a', 'c']], ['b2', ['a']]]);
  check();
  // a renamed book: [[Emma]] no longer finds it, on the new shelf
  shelf = shelf.map((b) => (b.id === 'b2' ? { ...b, title: 'Persuasion' } : b));
  assert.deepEqual(js(lib.booksOf(notes[0], shelf)), ['b1']);
  check();
});

/* ---------- sync ---------- */

test('the synced copy is written exactly as JSON.stringify writes it, also after an edit', async () => {
  const state = { entries: [], people: [], deleted: Object.create(null) };
  const sync = await load(`export { docJSON } from '${src('lib/sync.ts')}';`, {
    './store': `
      const s = globalThis.state;
      export const getEntries = () => s.entries, getPeople = () => s.people, getBooks = () => [], getSongs = () => [{ id: 's', music: { kind: 'track', title: 'x"y' }, days: [] }], getRepos = () => [], getPeriods = () => [], getRoutines = () => [], getWorkouts = () => [], getWeighIns = () => [], getMyMoves = () => [];
      export const getDeleted = () => s.deleted, mergeSynced = async () => ({ icons: [] }), photosOf = (e) => e.photos, onLocalChange = () => {}, toast = () => {};
      export const observable = (value) => ({ get: () => value, set: (next) => { value = next; }, use: () => value });`,
    './photos': 'export const photoIds = async () => new Set(), photoBlob = async () => null, storePhotos = async () => {};',
    './icons': 'export const resolveIcon = () => {};',
  }, { state });
  const plain = () => JSON.stringify({ app: 'my-mind', version: 1, entries: state.entries, people: state.people, books: [], songs: [{ id: 's', music: { kind: 'track', title: 'x"y' }, days: [] }], repos: [], periods: [], routines: [], workouts: [], weighins: [], moves: [], deleted: state.deleted });
  assert.equal(sync.docJSON(), plain());
  state.entries = Array.from({ length: 50 }, (_, i) => ({ id: 'e' + i, title: `“${i}”\n `, text: words(6), weather: i % 2 ? null : { day: '2024-01-01', temp: -1.5 }, place: undefined, photos: [] }));
  state.people = [{ id: 'p', name: 'Ana', dates: [] }];
  state.deleted.gone = 5;
  assert.equal(sync.docJSON(), plain());
  state.entries = state.entries.map((e, i) => (i === 3 ? { ...e, text: 'edited' } : e));
  state.deleted = Object.assign(Object.create(null), state.deleted, { other: 9 });
  assert.equal(sync.docJSON(), plain());
});

/** IndexedDB in memory: requests answer in order, a transaction completes once nothing is left to do. */
function memoryIndexedDB() {
  const stores = { entries: new Map(), kv: new Map(), photos: new Map() };
  const database = {
    objectStoreNames: { contains: () => true },
    transaction() {
      let pending = 0, done = false;
      const tx = { error: null, db: database, abort() { done = true; queueMicrotask(() => tx.onabort?.()); } };
      const finish = () => setImmediate(() => { if (!done && !pending) { done = true; tx.oncomplete?.(); } });
      const request = (run) => {
        const req = {};
        pending++;
        queueMicrotask(() => { req.result = structuredClone(run()); pending--; req.onsuccess?.(); finish(); });
        return req;
      };
      tx.objectStore = (name) => {
        const m = stores[name];
        return {
          getAll: () => request(() => [...m.values()]), getAllKeys: () => request(() => [...m.keys()]), get: (k) => request(() => m.get(k)),
          put: (v, k) => request(() => void m.set(k ?? v.id, structuredClone(v))), delete: (k) => request(() => void m.delete(k)), clear: () => request(() => m.clear()),
        };
      };
      finish();
      return tx;
    },
  };
  return { stores, indexedDB: { open() { const req = { result: database }; queueMicrotask(() => req.onsuccess?.()); return req; } } };
}

const note = (o = {}) => ({ id: 'note', kind: 'note', title: '', icon: null, text: '', emotions: [], intensity: 3, date: '2026-09-27', dateEnd: null, time: 1, images: [], photos: [], music: [],
  people: [], cover: null, pinned: false, highlighted: false, share: null, place: null, weather: null, created: 1, updated: 1, ...o });

async function storeOn(idb) {
  return load(`export * from '${src('lib/store.ts')}';`, {
    'preact/hooks': 'export const useState = () => [0, () => {}], useEffect = () => {};',
    './photos': 'export const PHOTO_ID = /^p[a-z0-9]{6,40}$/; export const clearPhotos = async () => {}, exportPhotos = async () => ({}), importPhotos = async () => 0, prunePhotos = async () => {};',
  }, { indexedDB: idb.indexedDB });
}

test('a sync merge reads in full only the stored notes this page needs, and ends where reading all of them would', async () => {
  const idb = memoryIndexedDB();
  const put = (e) => idb.stores.entries.set(e.id, structuredClone(e));
  for (let i = 0; i < 30; i++) put(note({ id: 'n' + i, title: 'Stored ' + i, updated: 100 + i }));
  // a record from an older version: its id is cut to 40 letters, its edit time comes from when it was made
  put({ ...note({ title: 'Old shape', created: 70 }), id: 'x'.repeat(45), updated: undefined });
  const store = await storeOn(idb);
  await store.init();
  const before = new Map(store.getEntries().map((e) => [e.id, e]));
  assert.equal(before.get('x'.repeat(40))?.updated, 70);

  // another tab wrote n1 again and added n50 since this one loaded; it also deleted n2
  put(note({ id: 'n1', title: 'Other tab', updated: 500 }));
  put(note({ id: 'n50', title: 'Added in another tab', updated: 300 }));
  idb.stores.kv.set('deleted', { n2: 1000 });
  const merged = await store.mergeSynced({
    entries: [note({ id: 'n3', title: 'Remote edit', updated: 400 }), note({ id: 'n4', title: 'Older remote', updated: 1 }), note({ id: 'n60', title: 'Remote new', updated: 50 })],
    deleted: { n5: 2000 },
  });
  const after = new Map(store.getEntries().map((e) => [e.id, e]));
  assert.deepEqual(js(merged.changed.map((e) => e.id).sort()), ['n3', 'n60']);
  assert.equal(after.get('n1').title, 'Other tab');
  assert.equal(after.get('n50').title, 'Added in another tab');
  assert.equal(after.get('n3').title, 'Remote edit');
  assert.equal(after.get('n4').title, 'Stored 4');
  assert.equal(after.get('n60').title, 'Remote new');
  assert.equal(after.has('n2'), false);
  assert.equal(after.has('n5'), false);
  assert.equal(idb.stores.entries.has('n5'), false, 'the stored copy of a remotely deleted note goes');
  assert.equal(after.get('x'.repeat(40)).title, 'Old shape');
  // the notes nothing happened to are the very same objects: nothing redraws for them
  for (const id of ['n0', 'n4', 'n7', 'n29', 'x'.repeat(40)]) assert.equal(after.get(id), before.get(id), id);
  assert.equal(after.size, 30 + 1 + 1 + 1 - 2);
});

test('a skimmed merge still compares every stored note, and leaves out of its answer only the ones not needed', async () => {
  const idb = memoryIndexedDB();
  for (let i = 0; i < 10; i++) idb.stores.entries.set('n' + i, note({ id: 'n' + i, updated: 10 + i }));
  const { db } = await load(`export { db } from '${src('lib/db.ts')}';`, {}, { indexedDB: idb.indexedDB });
  let read = 0;
  const normalize = (raw) => (read++, raw);
  const skim = { plain: (raw) => raw, wanted: (id) => id === 'n9' };
  const r = await db.reconcileEntries([note({ id: 'n3', updated: 99 }), note({ id: 'n4', updated: 1 })], { n5: 50 }, normalize, false, skim);
  assert.equal(read, 1, 'only the wanted stored note is read in full');
  assert.deepEqual(js(r.entries.map((e) => e.id).sort()), ['n3', 'n9']);
  assert.deepEqual(js(r.changed.map((e) => e.id)), ['n3']);
  assert.deepEqual(js(r.removed), ['n5']);
  assert.equal(idb.stores.entries.get('n3').updated, 99);
  assert.equal(idb.stores.entries.has('n5'), false);
});
