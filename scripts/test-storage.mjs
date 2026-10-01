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
    del: async (id) => { entries.delete(id); },
    clear: async () => { entries.clear(); },
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

test('invalid saved settings fall back to safe defaults', async () => {
  for (const saved of ['null', '[]', '3', '{"theme":"unknown"}']) {
    const store = await loadModule('src/lib/store.ts', storeMocks(memoryDB()), {
      localStorage: { getItem: () => saved },
    });
    assert.equal(store.getSettings().theme, 'system');
  }
});

test('observable hooks catch changes made before their subscription effect runs', async () => {
  const effects = [];
  let updates = 0;
  const mocks = storeMocks(memoryDB());
  mocks['preact/hooks'] = {
    useState: () => [0, () => updates++],
    useEffect: (effect) => effects.push(effect),
  };
  const store = await loadModule('src/lib/store.ts', mocks);
  const state = store.observable('Before');
  assert.equal(state.use(), 'Before');
  state.set('Changed before effects');
  const cleanup = effects[0]();
  assert.equal(updates, 1);
  state.set('Next change');
  assert.equal(updates, 2);
  cleanup();
});

test('backups and synced documents keep the newest duplicate record', async () => {
  for (const method of ['importJSON', 'mergeSynced']) {
    const store = await loadModule('src/lib/store.ts', storeMocks(memoryDB()));
    const data = {
      entries: [entry({ title: 'Newer', updated: 20 }), entry({ title: 'Older', updated: 10 })],
      people: [{ id: 'p', name: 'Newer', updated: 20 }, { id: 'p', name: 'Older', updated: 10 }],
    };
    await store[method](method === 'importJSON' ? JSON.stringify(data) : data);
    assert.equal(store.getEntries()[0].title, 'Newer');
    assert.equal(store.getPeople().length, 1);
    assert.equal(store.getPeople()[0].name, 'Newer');
  }
});

test('edits made while backup photos load survive the import', async () => {
  let finishPhotos;
  const db = memoryDB([entry()]);
  const store = await loadModule('src/lib/store.ts', storeMocks(db, () => new Promise((resolve) => { finishPhotos = resolve; })));
  await store.init();
  const importing = store.importJSON(JSON.stringify({ entries: [entry({ title: 'Backup', updated: 10 })] }));
  await store.saveEntry({ ...store.getEntries()[0], title: 'Edited during import' });
  finishPhotos(0);
  await importing;
  assert.equal(store.getEntries()[0].title, 'Edited during import');
  assert.equal((await db.all())[0].title, 'Edited during import');
});

test('restoring deleted records beats future deletion timestamps and hostile dictionary keys are safe', async () => {
  const db = memoryDB();
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  const future = Date.now() + 100_000;
  await store.mergeSynced({ deleted: JSON.parse(`{"note":${future},"person":${future},"__proto__":${future}}`) });
  await store.importJSON(JSON.stringify({ entries: [entry()], people: [{ id: 'person', name: 'Restored', updated: 1 }] }));
  assert.ok(store.getEntries()[0].updated > future);
  assert.ok(store.getPeople()[0].updated > future);
  assert.equal(store.getDeleted().__proto__, future);
  const saved = await store.saveEntry(entry({ id: 'constructor' }));
  assert.ok(Number.isFinite(saved.updated));
  await store.mergeSynced({});
  assert.equal(store.getEntries().length, 2);
});

test('a failed note write rolls back only that note and does not announce a saved change', async () => {
  const db = memoryDB([entry()]);
  db.put = async () => { throw new Error('Storage full'); };
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  let changes = 0;
  store.onLocalChange(() => changes++);
  await assert.rejects(store.saveEntry({ ...store.getEntries()[0], title: 'Not saved' }), /Storage full/);
  assert.equal(store.getEntries()[0].title, '');
  assert.equal(changes, 0);
});

test('concurrent failed saves restore the last persisted note rather than another failed edit', async () => {
  const db = memoryDB([entry()]);
  const rejectWrites = [];
  db.put = () => new Promise((_resolve, reject) => rejectWrites.push(reject));
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  const first = store.saveEntry({ ...store.getEntries()[0], title: 'First failed edit' });
  const second = store.saveEntry({ ...store.getEntries()[0], title: 'Second failed edit' });
  const failures = Promise.allSettled([first, second]);
  rejectWrites[0](new Error('Storage full'));
  await new Promise((resolve) => setImmediate(resolve));
  rejectWrites[1](new Error('Storage full'));
  await failures;
  assert.equal(store.getEntries()[0].title, '');
});

test('collection saves always increase the stored timestamp across stale drafts and tabs', async () => {
  const future = Date.now() + 100_000;
  const db = memoryDB();
  await db.set('people', [{ id: 'person', name: 'Before', updated: future }]);
  const a = await loadModule('src/lib/store.ts', storeMocks(db));
  const b = await loadModule('src/lib/store.ts', storeMocks(db));
  await Promise.all([a.init(), b.init()]);
  const [first, second] = await Promise.all([
    a.savePerson({ ...a.getPeople()[0], name: 'First edit' }),
    b.savePerson({ ...b.getPeople()[0], name: 'Second edit' }),
  ]);
  assert.ok(first.updated > future);
  assert.ok(second.updated > first.updated);
  assert.equal((await db.get('people'))[0].name, 'Second edit');
});

test('deleting a collection item includes an earlier save still waiting to publish', async () => {
  const future = Date.now() + 100_000;
  const db = memoryDB();
  await db.set('people', [{ id: 'person', name: 'Before', updated: future }]);
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  const saving = store.savePerson({ ...store.getPeople()[0], name: 'Pending edit' });
  const deleting = store.deletePerson('person');
  const [saved] = await Promise.all([saving, deleting]);
  assert.equal(store.getPeople().length, 0);
  assert.equal((await db.get('people')).length, 0);
  assert.ok(store.getDeleted().person >= saved.updated);
  await store.mergeSynced({ people: [saved] });
  assert.equal(store.getPeople().length, 0);
});

test('delete all remembers timestamps newer than the local clock', async () => {
  const future = Date.now() + 100_000;
  const note = entry({ updated: future });
  const store = await loadModule('src/lib/store.ts', storeMocks(memoryDB([note])));
  await store.init();
  await store.deleteAll();
  await store.mergeSynced({ entries: [note] });
  assert.equal(store.getEntries().length, 0);
});

test('calendar validation handles leap days and years below 100 without century coercion', async () => {
  const dates = await loadModule('src/lib/dates.ts', {});
  assert.equal(dates.isDateKey('2024-02-29'), true);
  assert.equal(dates.isDateKey('2026-02-29'), false);
  assert.equal(dates.parseKey('0099-03-01').getFullYear(), 99);
  assert.equal(dates.isDateKey('0099-03-01'), true);
});

test('malformed backup dates, inherited emotion names and invalid image dimensions are cleaned', async () => {
  const store = await loadModule('src/lib/store.ts', storeMocks(memoryDB()));
  await store.importJSON(JSON.stringify({ entries: [
    entry({ id: 'bad-day', date: '2026-02-30' }),
    entry({ id: 'bad-month', date: '2026-00-01' }),
    entry({ photos: [{ id: 'p1234567', w: -5, h: null }], images: [{ url: 'https://example.com/photo', w: -4, h: 0 }], emotions: ['constructor', '__proto__'] }),
  ] }));
  assert.equal(store.getEntries().length, 1);
  assert.equal(store.getEntries()[0].emotions.length, 0);
  assert.equal(store.getEntries()[0].photos[0].w, 1);
  assert.equal(store.getEntries()[0].images[0].w, undefined);
  await assert.rejects(store.importJSON('{"entries":{}}'), /valid journal/);
});

test('album cleanup removes repeated pictures and removing its final item keeps valid body structure', async () => {
  const body = await loadModule('src/lib/body.ts', {});
  const picture = { kind: 'photo', id: 'p1234567' };
  const note = entry({ text: 'Before\n[[album:photo:p1234567 photo:p1234567]]\nAfter', photos: [{ id: picture.id, w: 1, h: 1 }] });
  const cleaned = body.bodyOf(note);
  assert.equal(cleaned.media[0].kind, 'photo');
  const singleton = body.parseBody('Before\n[[album:photo:p1234567]]\nAfter');
  assert.equal(body.serializeBody(body.removeItem(singleton, picture)), 'Before\nAfter');
  assert.equal(body.serializeBody(body.takeOut(singleton, 0, picture)), 'Before\n[[photo:p1234567]]\nAfter');
  const missing = body.bodyOf(entry({ photos: [note.photos[0], note.photos[0]] }));
  assert.equal(missing.media.length, 1);
});

test('IndexedDB opens can retry and failed batches abort their earlier writes', async () => {
  let opens = 0;
  const saved = [];
  const database = {
    transaction() {
      const pending = [];
      let aborted = false;
      const tx = {
        error: null,
        abort() { aborted = true; queueMicrotask(() => tx.onabort?.()); },
        objectStore: () => ({
          put(value) {
            if (value.invalid) throw new Error('Data cannot be cloned');
            pending.push(value);
          },
          getAll: () => ({ result: saved }),
        }),
      };
      queueMicrotask(() => {
        if (aborted) return;
        saved.push(...pending);
        tx.oncomplete?.();
      });
      return tx;
    },
  };
  const { db } = await loadModule('src/lib/db.ts', {}, {
    indexedDB: {
      open() {
        const request = { result: database, error: new Error('Temporary storage failure') };
        const first = ++opens === 1;
        queueMicrotask(() => first ? request.onerror() : request.onsuccess());
        return request;
      },
    },
  });
  await assert.rejects(db.all(), /Temporary storage failure/);
  assert.equal((await db.all()).length, 0);
  assert.equal(opens, 2);
  await assert.rejects(db.putMany([{ id: 'first' }, { id: 'second', invalid: true }]), /cannot be cloned/);
  assert.equal(saved.length, 0);
});

function syncMocks() {
  return {
    './store': {
      getDeleted: () => ({}), getEntries: () => [], getPeople: () => [], getBooks: () => [], getSongs: () => [], mergeSynced: async () => ({ icons: [] }),
      observable: (value) => ({ get: () => value, set: (next) => { value = next; }, use: () => value }),
      photosOf: (e) => e.photos, onLocalChange() {}, toast() {},
    },
    './photos': { photoIds: async () => new Set(), photoBlob: async () => null, storePhotos: async () => {} },
    './icons': { resolveIcon() {} },
  };
}

test('stopping sync during a pending photo read prevents a document upload', async () => {
  const mocks = syncMocks();
  let readPhotos, finishPhotos;
  const reachedPhotos = new Promise((resolve) => { readPhotos = resolve; });
  mocks['./photos'].photoIds = () => new Promise((resolve) => { finishPhotos = resolve; readPhotos(); });
  let uploads = 0;
  const sync = await loadModule('src/lib/sync.ts', mocks, {
    fetch: async (_url, init) => {
      if (init?.method === 'PUT') uploads++;
      return new Response(null, { status: 404 });
    },
  });
  const running = sync.startSync();
  await reachedPhotos;
  sync.stopSync();
  finishPhotos(new Set());
  await running;
  assert.equal(uploads, 0);
  assert.equal(sync.useSync().on, false);
  assert.equal(sync.useSync().error, undefined);
});

test('replacing a sync session continues even if the stopped session fails', async () => {
  let reachedDownload, failDownload;
  const firstDownload = new Promise((resolve) => { reachedDownload = resolve; });
  let downloads = 0, uploads = 0;
  const sync = await loadModule('src/lib/sync.ts', syncMocks(), {
    fetch: async (_url, init) => {
      if (init?.method === 'PUT') {
        uploads++;
        return Response.json({ rev: 'new-revision' });
      }
      if (++downloads === 1) return new Promise((_resolve, reject) => { failDownload = reject; reachedDownload(); });
      return new Response(null, { status: 404 });
    },
  });
  const running = sync.startSync();
  await firstDownload;
  sync.stopSync();
  const replacement = sync.startSync();
  failDownload(new Error('Old request failed'));
  await Promise.all([running, replacement]);
  assert.equal(downloads, 2);
  assert.equal(uploads, 1);
  assert.equal(sync.useSync().on, true);
  assert.equal(sync.useSync().error, undefined);
});

test('invalid saved sync state is discarded and incomplete legacy state is repaired', async () => {
  const invalid = await loadModule('src/lib/sync.ts', syncMocks(), {
    localStorage: { getItem: () => '{"code":"wrong"}' },
  });
  assert.equal(invalid.useSync().on, false);
  const repaired = await loadModule('src/lib/sync.ts', syncMocks(), {
    localStorage: { getItem: () => '{"code":"abcd-efgh-jklm","sent":null,"last":"never","rev":"revision"}', setItem() {} },
    fetch: async () => new Response(null, { status: 304 }),
  });
  await repaired.syncNow();
  assert.equal(repaired.useSync().code, 'ABCDEFGHJKLM');
  assert.equal(repaired.useSync().error, undefined);
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
      getDeleted: () => ({}), getEntries: () => [note], getPeople: () => [], getBooks: () => [], getSongs: () => [], mergeSynced: async () => ({ icons: [] }),
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

test('places and weather are cleaned on load, survive a backup, and filled-in weather is not an edit', async () => {
  const weather = { day: '2026-09-27', code: 2, temp: 18.43, daylight: 11.904, dark: false };
  const db = memoryDB([
    entry({ place: { lat: 46.76912, lon: 23.58999, name: 'Centru, Cluj-Napoca' }, weather }),
    entry({ id: 'bad', place: { lat: 200, lon: 0, name: 'Nowhere' }, weather: { ...weather, day: 'soon' } }),
    entry({ id: 'old' }),
  ]);
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  // the store runs in its own realm: compare plain copies
  const byId = (id) => JSON.parse(JSON.stringify(store.getEntries().find((e) => e.id === id)));
  assert.deepEqual(byId('note').place, { lat: 46.769, lon: 23.59, name: 'Centru, Cluj-Napoca' });
  assert.deepEqual(byId('note').weather, { day: '2026-09-27', code: 2, temp: 18.4, daylight: 11.9, dark: false });
  assert.deepEqual([byId('bad').place, byId('bad').weather, byId('old').place, byId('old').weather], [null, null, null, null]);

  await store.annotateEntries(new Map([['old', { weather: { ...weather, code: 61, temp: 9.5, daylight: 11.5 } }]]));
  assert.equal(byId('old').weather.code, 61);
  assert.equal(byId('old').updated, 1, 'filling in weather keeps the edit time');
  assert.equal((await db.all()).find((e) => e.id === 'old').weather.code, 61);

  const copy = await loadModule('src/lib/store.ts', storeMocks(memoryDB()));
  await copy.importJSON(await store.exportJSON());
  const copied = (id) => JSON.parse(JSON.stringify(copy.getEntries().find((e) => e.id === id)));
  assert.deepEqual(copied('note').place, byId('note').place);
  assert.deepEqual(copied('old').weather, byId('old').weather);
});

test('kept music is cleaned on load, survives a backup, and follows synced deletions', async () => {
  const music = { kind: 'track', id: '4cOdK2wGLETKBW3PvgPWqT', title: 'Never Gonna Give You Up', sub: 'Rick Astley', image: 'https://i.scdn.co/image/x', link: 'https://evil.example' };
  const db = memoryDB();
  await db.set('songs', [
    { id: 'song', music, repeat: true, rating: 9, text: 'Every time.', emotions: [], from: 'p1', updated: 5, created: 5 },
    { id: 'bad', music: { kind: 'track', id: 'nope' }, updated: 5, created: 5 },
  ]);
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  const kept = JSON.parse(JSON.stringify(store.getSongs()));
  assert.equal(kept.length, 1, 'music with an invalid Spotify id is dropped');
  assert.equal(kept[0].music.link, 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT', 'links are rebuilt from the id');
  assert.deepEqual([kept[0].rating, kept[0].repeat, kept[0].from], [5, true, 'p1']);
  assert.ok(store.findSong(store.getSongs(), music));

  const copy = await loadModule('src/lib/store.ts', storeMocks(memoryDB()));
  const result = await copy.importJSON(await store.exportJSON());
  assert.equal(result.songs, 1);
  assert.equal(copy.getSongs()[0].text, 'Every time.');

  await copy.mergeSynced({ deleted: { song: 10 } });
  assert.equal(copy.getSongs().length, 0, 'a newer deletion from another device removes it');
});

test('@tags are spotted while typing, suggested across people, books and music, and follow a rename', async () => {
  const m = await loadModule('src/lib/mentions.ts', { './store': { getBooks: () => [] } });
  const plain = (x) => JSON.parse(JSON.stringify(x));
  assert.deepEqual(plain(m.typedMention('Coffee with @an', 15)), { start: 12, end: 15, q: 'an' });
  assert.equal(m.typedMention('write to x@an', 13), null, 'an @ inside a word is not a tag');
  assert.equal(m.typedMention('@ana went  ', 11), null, 'two spaces end it');

  const people = [{ id: 'p1', name: 'Ana', relation: 'Friend', emotions: ['joy'] }, { id: 'p2', name: 'Andrei', relation: '', emotions: [] }];
  const books = [{ id: 'b1', title: 'Anna Karenina', authors: 'Leo Tolstoy', status: 'want', emotions: [] }];
  const songs = [{ id: 's1', music: { kind: 'track', id: 'x', title: 'Angel', sub: 'Massive Attack' }, repeat: false, emotions: [] }];
  const found = m.suggest('an', people, books, songs, []).map((s) => `${s.kind}:${s.item.name ?? s.item.title ?? s.item.music.title}`);
  assert.equal(found[0], 'person:Ana');
  assert.ok(found.includes('book:Anna Karenina') && found.includes('song:Angel'));

  const text = `Met ${m.mentionOfPerson(people[0], people)} and played ${m.mentionOfSong(songs[0], songs)}`;
  assert.equal(text, 'Met @[Ana] and played ♪[Angel]');
  assert.deepEqual(plain(m.mentionsIn(text, people, books, songs).map((f) => [f.kind, f.core, text.slice(f.start, f.end)])), [['person', 'joy', '@[Ana]'], ['song', null, '♪[Angel]']]);
  assert.deepEqual(plain(m.songsIn(text, songs)), ['s1']);
  assert.equal(m.renamePersonMentions([{ id: 'e', text }], people, { ...people[0], name: 'Ana Maria' })[0].text, 'Met @[Ana Maria] and played ♪[Angel]');
});
