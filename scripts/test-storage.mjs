import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { rolldown } from 'rolldown';

// Execute the real modules with browser/storage boundaries supplied in memory.
async function loadModule(file, mocks, globals = {}) {
  const bundle = await rolldown({
    input: file,
    plugins: [{
      name: 'browser-boundaries',
      resolveId(id) { if (id in mocks) return '\0' + id; },
      load(id) {
        if (!id.startsWith('\0')) return;
        const key = id.slice(1);
        return Object.keys(mocks[key]).map((name) => `export const ${name} = globalThis.mocks[${JSON.stringify(key)}][${JSON.stringify(name)}];`).join('\n');
      },
    }],
  });
  const { output } = await bundle.generate({ format: 'cjs' });
  await bundle.close();
  const module = { exports: {} };
  vm.runInNewContext(output[0].code, {
    mocks, module, exports: module.exports, console, Blob, URL, TextEncoder, TextDecoder,
    Uint8Array, crypto: webcrypto, setTimeout: () => 0, clearTimeout: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }), navigator: {},
    ...globals,
  });
  return module.exports;
}

function memoryDB(initialEntries = []) {
  const entries = new Map(initialEntries.map((e) => [e.id, e]));
  const kv = new Map();
  let writes = Promise.resolve();
  return {
    all: async () => [...entries.values()],
    put: async (e) => { entries.set(e.id, e); },
    putMany: async (list) => { list.forEach((e) => entries.set(e.id, e)); },
    get: async (key) => kv.get(key),
    set: async (key, value) => { kv.set(key, value); },
    update(key, change) {
      const next = writes.then(() => { const value = change(kv.get(key)); kv.set(key, value); return value; });
      writes = next.catch(() => {});
      return next;
    },
  };
}

function storeMocks(db, importPhotos = async () => 0) {
  return {
    './db': { db },
    'preact/hooks': { useState() {}, useEffect() {} },
    './body': { plainText: (s) => s, dropImageLinks: (s) => s },
    './dates': { todayKey: () => '2026-09-27' },
    '../data/emotions': { EMOTION: {} },
    './photos': { PHOTO_ID: /^p[a-z0-9]{6,40}$/, clearPhotos: async () => {}, exportPhotos: async () => ({}), importPhotos, prunePhotos: async () => {} },
  };
}

function entry(overrides = {}) {
  return { id: 'note', kind: 'note', title: '', icon: null, text: '', date: '2026-09-27', dateEnd: null,
    time: 1, updated: 1, created: 1, intensity: 3, emotions: [], images: [], photos: [], music: [], people: [], cover: null, ...overrides };
}

test('independent tabs preserve both people when saving concurrently', async () => {
  const db = memoryDB();
  const a = await loadModule('src/lib/store.ts', storeMocks(db));
  const b = await loadModule('src/lib/store.ts', storeMocks(db));
  await Promise.all([a.init(), b.init()]);
  await Promise.all([a.savePerson(a.blankPerson('Alice')), b.savePerson(b.blankPerson('Bob'))]);
  assert.deepEqual(Array.from(await db.get('people'), (p) => p.name), ['Alice', 'Bob']);
});

test('long note and person bodies survive reload and backup import', async () => {
  const text = 'Long journal body. '.repeat(10_000);
  const db = memoryDB([entry({ text })]);
  await db.set('people', [{ id: 'person', name: 'Alice', text, updated: 1, created: 1 }]);
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  assert.equal(store.getEntries()[0].text, text);
  assert.equal(store.getPeople()[0].text, text);
  const imported = await loadModule('src/lib/store.ts', storeMocks(memoryDB()));
  await imported.importJSON(await store.exportJSON());
  assert.equal(imported.getEntries()[0].text, text);
  assert.equal(imported.getPeople()[0].text, text);
});

test('an older synced deletion cannot remove a newer person saved by another tab', async () => {
  const db = memoryDB();
  const person = { id: 'person', name: 'Alice', text: '', updated: 1, created: 1 };
  await db.set('people', [person]);
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  await db.set('people', [{ ...person, text: 'Newer edit in another tab', updated: 100 }]);
  await store.mergeSynced({ deleted: { person: 50 } });
  assert.equal((await db.get('people'))[0].text, 'Newer edit in another tab');
});

test('books survive backup import and follow synced deletions', async () => {
  const store = await loadModule('src/lib/store.ts', storeMocks(memoryDB()));
  await store.init();
  const book = await store.saveBook(store.blankBook({ title: 'Dune', authors: 'Frank Herbert', status: 'read', rating: 9, finished: '2026-09-01' }));
  assert.equal(book.rating, 9); // saved as given; clamped whenever it's read back
  const copy = await loadModule('src/lib/store.ts', storeMocks(memoryDB()));
  await copy.init();
  const result = await copy.importJSON(await store.exportJSON());
  assert.equal(result.books, 1);
  assert.deepEqual([copy.getBooks()[0].title, copy.getBooks()[0].rating, copy.getBooks()[0].finished], ['Dune', 5, '2026-09-01']);
  await copy.mergeSynced({ deleted: { [book.id]: book.updated + 1 } });
  assert.equal(copy.getBooks().length, 0);
  // a newer edit elsewhere wins over an older deletion
  await copy.mergeSynced({ books: [{ ...book, title: 'Dune (reread)', updated: book.updated + 5 }] });
  assert.equal(copy.getBooks()[0].title, 'Dune (reread)');
});

test('book mentions resolve by title, disambiguate duplicates, and follow a rename', async () => {
  const books = await loadModule('src/lib/books.ts', { './store': { getBooks: () => [] } });
  const dune = { id: 'd1', title: 'Dune' }, hobbit = { id: 'h1', title: 'The Hobbit' }, dune2 = { id: 'd2', title: 'dune' };
  assert.equal(books.mentionOf(dune, [dune, hobbit]), '[[Dune]]');
  assert.equal(books.mentionOf(dune, [dune, dune2]), '[[book:d1|Dune]]');
  const text = 'Loved [[dune]] and [[The Hobbit]], not [[Nothing]]. Also [[book:d2|dune]].';
  assert.deepEqual([...books.booksIn(text, [dune, hobbit])], ['d1', 'h1']);
  assert.deepEqual([...books.booksIn(text, [dune, hobbit, dune2])].sort(), ['d1', 'd2', 'h1']);
  const note = { id: 'n', text: 'Reading [[Dune]] again' };
  const renamed = books.renameMentions([note, { id: 'm', text: 'no books' }], [dune, hobbit], { ...dune, title: 'Dune (1965)' });
  assert.deepEqual(Array.from(renamed, (e) => e.text), ['Reading [[Dune (1965)]] again']);
});

test('a matching backup repairs a missing photo without requiring a newer note', async () => {
  const note = entry({ photos: [{ id: 'p1234567', w: 1, h: 1 }] });
  let restored = [];
  const store = await loadModule('src/lib/store.ts', storeMocks(memoryDB([note]), async (_raw, ids) => {
    restored = [...ids];
    return restored.length;
  }));
  await store.init();
  const result = await store.importJSON(JSON.stringify({ entries: [note], photos: { p1234567: { data: 'data:image/png;base64,AAAA' } } }));
  assert.deepEqual(restored, ['p1234567']);
  assert.equal(result.changed, 0);
  assert.equal(result.photos, 1);
});

test('a mounted photo updates when its downloaded blob arrives', async () => {
  let rendered;
  let cleanup;
  const records = new Map();
  const photos = await loadModule('src/lib/photos.ts', {
    './db': { db: { photo: async (id) => records.get(id), putPhotos: async (list) => list.forEach((p) => records.set(p.id, p)) } },
    'preact/hooks': {
      useState(initial) { rendered = initial(); return [rendered, (value) => { rendered = value; }]; },
      useEffect(effect) { cleanup = effect(); },
    },
  });
  photos.usePhotoUrl('p1234567');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rendered, null);
  await photos.storePhotos([{ id: 'p1234567', w: 1, h: 1, blob: new Blob(['image'], { type: 'image/png' }) }]);
  assert.match(rendered, /^blob:/);
  cleanup();
});

test('a pending photo read cannot undo a clear or replace a downloaded image', async () => {
  let finishRead;
  const photos = await loadModule('src/lib/photos.ts', {
    './db': { db: {
      photo: () => new Promise((resolve) => { finishRead = resolve; }),
      putPhotos: async () => {}, clearPhotos: async () => {},
    } },
    'preact/hooks': { useState() {}, useEffect() {} },
  });
  const old = { id: 'p1234567', w: 1, h: 1, blob: new Blob(['old']) };
  const pending = photos.photoUrl(old.id);
  await photos.clearPhotos();
  finishRead(old);
  assert.equal(await pending, null);
  const anotherRead = photos.photoUrl(old.id);
  await photos.storePhotos([{ ...old, blob: new Blob(['new']) }]);
  const downloadedUrl = await photos.photoUrl(old.id);
  finishRead(old);
  assert.equal(await anotherRead, downloadedUrl);
});

test('an unchanged sync document still retries a failed photo download', async () => {
  const code = 'ABCDEFGHJKLM';
  const enc = new TextEncoder();
  const base = await webcrypto.subtle.importKey('raw', enc.encode(code), 'HKDF', false, ['deriveKey']);
  const key = await webcrypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('my-mind sync v1'), info: enc.encode('key') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const encrypt = async (text) => {
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)));
    const out = new Uint8Array(iv.length + data.length);
    out.set(iv); out.set(data, iv.length);
    return out;
  };
  const note = entry({ photos: [{ id: 'p1234567', w: 1, h: 1 }] });
  const have = new Set();
  let documents = 0, attempts = 0;
  const sync = await loadModule('src/lib/sync.ts', {
    './store': {
      getDeleted: () => ({}), getEntries: () => [note], getPeople: () => [], getBooks: () => [], mergeSynced: async () => ({ icons: [] }),
      observable: (value) => ({ get: () => value, set: (next) => { value = next; }, use: () => value }),
      photosOf: (e) => e.photos, onLocalChange() {}, toast() {},
    },
    './photos': { photoIds: async () => have, photoBlob: async () => null, storePhotos: async (list) => list.forEach((p) => have.add(p.id)) },
    './icons': { resolveIcon() {} },
  }, {
    localStorage: { getItem: () => JSON.stringify({ code, rev: null, dirty: false, last: 0, sent: [] }), setItem() {} },
    fetch: async (url) => {
      if (url.endsWith('/p1234567')) return ++attempts === 1 ? new Response(null, { status: 503 }) : new Response(await encrypt('image/png\nimage'));
      return ++documents === 1 ? new Response(await encrypt(JSON.stringify({ entries: [note] })), { headers: { 'X-Sync-Rev': 'rev1' } }) : new Response(null, { status: 304 });
    },
  });
  await sync.syncNow();
  await sync.syncNow();
  assert.equal(attempts, 2);
  assert.ok(have.has('p1234567'));
  assert.equal(sync.useSync().error, undefined);
});
