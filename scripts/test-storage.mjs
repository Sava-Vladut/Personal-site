import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { rolldown } from 'rolldown';

const combineDeleted = (a, b) => {
  const merged = Object.assign(Object.create(null), a);
  for (const [id, time] of Object.entries(b ?? {})) if (!(merged[id] >= time)) merged[id] = time;
  return merged;
};

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
    reconcileEntries(incoming, deleted, normalize = (raw) => raw, restore = false) {
      const next = writes.then(() => {
        deleted = combineDeleted(kv.get('deleted'), deleted);
        const current = [...entries.values()].map(normalize).filter(Boolean);
        const removed = restore ? [] : current.filter((e) => deleted[e.id] >= e.updated).map((e) => e.id);
        removed.forEach((id) => entries.delete(id));
        const byId = new Map(current.map((e) => [e.id, e]));
        removed.forEach((id) => byId.delete(id));
        const changed = incoming
          .filter((e) => (restore || !(deleted[e.id] >= e.updated)) && (!byId.has(e.id) || byId.get(e.id).updated < e.updated))
          .map((e) => restore && deleted[e.id] >= e.updated ? { ...e, updated: Math.max(Date.now(), deleted[e.id] + 1) } : e);
        changed.forEach((e) => entries.set(e.id, e));
        changed.forEach((e) => byId.set(e.id, e));
        kv.set('deleted', deleted);
        return { entries: [...byId.values()], changed, removed, deleted };
      });
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

test('an older synced deletion or note cannot overwrite a newer note saved by another tab', async () => {
  const db = memoryDB([entry()]);
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  await db.put(entry({ title: 'Newer edit in another tab', updated: 100 }));
  await store.mergeSynced({ deleted: { note: 50 }, entries: [entry({ title: 'Older synced edit', updated: 75 })] });
  assert.equal((await db.all())[0].title, 'Newer edit in another tab');
  assert.equal(store.getEntries()[0].title, 'Newer edit in another tab');
  await store.mergeSynced({ deleted: { note: 100 } });
  assert.equal((await db.all()).length, 0);
  assert.equal(store.getEntries().length, 0);
});

test('a failed synced transaction leaves the visible journal and tombstones unchanged', async () => {
  const db = memoryDB([entry()]);
  db.reconcileEntries = async () => { throw new Error('Transaction aborted'); };
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  await assert.rejects(store.mergeSynced({ deleted: { note: 10 }, entries: [entry({ id: 'remote', updated: 20 })] }), /Transaction aborted/);
  assert.deepEqual(Array.from(store.getEntries(), (e) => e.id), ['note']);
  assert.deepEqual(Object.keys(store.getDeleted()), []);
});

test('local edits and deletions made during a synced transaction survive its older snapshot', async () => {
  for (const action of ['save', 'delete', 'deleteAll']) {
    const db = memoryDB([entry()]);
    let finishMerge;
    const reconcile = db.reconcileEntries;
    let held = false;
    db.reconcileEntries = (...args) => {
      if (held) return reconcile(...args);
      held = true;
      return new Promise((resolve) => { finishMerge = resolve; });
    };
    const store = await loadModule('src/lib/store.ts', storeMocks(db));
    await store.init();
    const merging = store.mergeSynced({});
    if (action === 'save') await store.saveEntry({ ...store.getEntries()[0], title: 'Edited during sync' });
    else if (action === 'delete') await store.deleteEntry('note');
    else await store.deleteAll();
    const tombstone = store.getDeleted().note;
    finishMerge({ entries: [entry()], changed: [], removed: [], deleted: {} });
    await merging;
    if (action === 'save') assert.equal(store.getEntries()[0].title, 'Edited during sync');
    else {
      assert.equal(store.getEntries().length, 0, action);
      assert.equal(store.getDeleted().note, tombstone, action);
      assert.equal((await db.get('deleted')).note, tombstone, action);
    }
  }
});

test('IndexedDB reconciliation commits durable timestamp comparisons atomically and rolls back aborted writes', async () => {
  const saved = new Map([['note', entry({ title: 'Durable', updated: 100 })]]);
  const kv = new Map();
  const transactions = [];
  let holdCommit = false, commit;
  const database = {
    transaction(name, mode) {
      transactions.push([name, mode]);
      const pending = new Map(saved);
      const pendingKv = new Map(kv);
      let aborted = false;
      let requests = 0;
      const request = (result) => {
        const req = { result };
        requests++;
        queueMicrotask(() => {
          req.onsuccess();
          if (--requests || aborted) return;
          const finish = () => {
            saved.clear();
            pending.forEach((value, id) => saved.set(id, value));
            kv.clear();
            pendingKv.forEach((value, key) => kv.set(key, value));
            tx.oncomplete();
          };
          if (holdCommit) commit = finish;
          else queueMicrotask(finish);
        });
        return req;
      };
      const tx = {
        error: null,
        abort() { aborted = true; queueMicrotask(() => tx.onabort?.()); },
        objectStore: (storeName) => storeName === 'kv' ? {
          get: (key) => request(pendingKv.get(key)),
          put: (value, key) => pendingKv.set(key, value),
        } : {
          getAll: () => request([...pending.values()]),
          put(value) {
            if (value.invalid) throw new Error('Data cannot be cloned');
            pending.set(value.id, value);
          },
          delete(id) { pending.delete(id); },
        },
      };
      return tx;
    },
  };
  const { db } = await loadModule('src/lib/db.ts', {}, {
    indexedDB: { open() {
      const request = { result: database };
      queueMicrotask(() => request.onsuccess());
      return request;
    } },
  });
  const stale = await db.reconcileEntries([entry({ title: 'Older remote', updated: 75 })], { note: 50 });
  assert.equal(stale.entries[0].title, 'Durable');
  assert.equal(stale.changed.length, 0);
  assert.equal(stale.removed.length, 0);
  const equal = await db.reconcileEntries([entry({ title: 'Equal timestamp', updated: 100 })], {});
  assert.equal(equal.entries[0].title, 'Durable');
  holdCommit = true;
  let settled = false;
  const writing = db.reconcileEntries([entry({ title: 'Newer remote', updated: 125 })], {}).then((result) => { settled = true; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false, 'success waits for transaction commit');
  assert.equal(saved.get('note').title, 'Durable');
  commit();
  const newer = await writing;
  assert.equal(newer.changed[0].title, 'Newer remote');
  assert.equal(saved.get('note').updated, 125);
  holdCommit = false;
  await assert.rejects(db.reconcileEntries([entry({ id: 'bad', invalid: true, updated: 150 })], { note: 125 }), /cannot be cloned/);
  assert.equal(saved.get('note').updated, 125, 'a later failed put rolls back preceding deletes');
  const removed = await db.reconcileEntries([], { note: 125 });
  assert.deepEqual(Array.from(removed.removed), ['note']);
  assert.equal(saved.size, 0, 'a tombstone wins when its timestamp equals the durable edit');
  const resurrection = await db.reconcileEntries([entry({ updated: 120 })], {});
  assert.equal(resurrection.entries.length, 0, 'durable tombstones prevent a stale tab resurrecting a note');
  const legacy = entry({ id: 'legacy', time: 100 });
  delete legacy.updated;
  saved.set('legacy', legacy);
  const normalized = await db.reconcileEntries([entry({ id: 'legacy', updated: 150 })], {}, (e) => ({ ...e, updated: e.updated ?? e.time }));
  assert.equal(normalized.changed[0].updated, 150, 'durable legacy timestamps are normalized before comparison');
  assert.ok(transactions.every(([names, mode]) => JSON.stringify(names) === '["entries","kv"]' && mode === 'readwrite'));
});

test('a stale tab cannot sync an old note back over a durable deletion from another tab', async () => {
  const db = memoryDB([entry()]);
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  await db.del('note');
  await db.set('deleted', { note: 100 });
  await store.mergeSynced({ entries: [entry({ updated: 75 })] });
  assert.equal((await db.all()).length, 0);
  assert.equal(store.getEntries().length, 0);
  assert.equal(store.getDeleted().note, 100);
});

test('backup import protects newer durable notes and can restore another tab’s deleted note', async () => {
  const db = memoryDB([entry()]);
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  await db.put(entry({ title: 'Newer edit in another tab', updated: 100 }));
  const stale = await store.importJSON(JSON.stringify({ entries: [entry({ title: 'Older backup', updated: 75 })] }));
  assert.equal(stale.changed, 0);
  assert.equal((await db.all())[0].title, 'Newer edit in another tab');
  assert.equal(store.getEntries()[0].title, 'Newer edit in another tab');
  const future = Date.now() + 100_000;
  await db.del('note');
  await db.set('deleted', { note: future });
  const restored = await store.importJSON(JSON.stringify({ entries: [entry({ updated: 125, title: 'Restored backup' })] }));
  assert.equal(restored.changed, 1);
  assert.equal(store.getEntries()[0].title, 'Restored backup');
  assert.ok(store.getEntries()[0].updated > future);
});

test('matching and older backups restore a note durably deleted by another tab', async () => {
  for (const updated of [100, 75]) {
    const db = memoryDB([entry({ title: 'Stale visible note', updated: 100 })]);
    const store = await loadModule('src/lib/store.ts', storeMocks(db));
    await store.init();
    const future = Date.now() + 100_000;
    await db.del('note');
    await db.set('deleted', { note: future });
    const restored = await store.importJSON(JSON.stringify({ entries: [entry({ title: 'Restored backup', updated })] }));
    assert.equal(restored.changed, 1);
    assert.equal(store.getEntries()[0].title, 'Restored backup');
    assert.ok(store.getEntries()[0].updated > future);
    assert.equal((await db.all())[0].updated, store.getEntries()[0].updated);
  }
});

test('a local edit still waiting to persist remains visible during backup reconciliation', async () => {
  const db = memoryDB([entry()]);
  const put = db.put;
  let finishSave;
  db.put = (value) => new Promise((resolve) => { finishSave = async () => { await put(value); resolve(); }; });
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  const saving = store.saveEntry({ ...store.getEntries()[0], title: 'Pending local edit' });
  await store.importJSON(JSON.stringify({ entries: [entry({ title: 'Older backup', updated: 10 })] }));
  assert.equal(store.getEntries()[0].title, 'Pending local edit');
  await finishSave();
  await saving;
  assert.equal((await db.all())[0].title, 'Pending local edit');
});

test('legacy notes without an edit timestamp use their saved creation time when syncing', async () => {
  const old = entry({ time: 50, created: 100 });
  delete old.updated;
  const db = memoryDB([old]);
  const store = await loadModule('src/lib/store.ts', storeMocks(db));
  await store.init();
  assert.equal(store.getEntries()[0].updated, 100);
  await store.mergeSynced({ entries: [entry({ updated: 150, title: 'Newer synced edit' })] });
  assert.equal(store.getEntries()[0].title, 'Newer synced edit');
});

test('delete all defeats unseen incoming notes and collections while preserving fresh local saves', async () => {
  for (const method of ['mergeSynced', 'importJSON']) for (const phase of ['entries', 'collections']) {
    const db = memoryDB([entry()]);
    let reached, release;
    const waiting = new Promise((resolve) => { reached = resolve; });
    let held = false;
    const original = phase === 'entries' ? db.reconcileEntries : db.update;
    const name = phase === 'entries' ? 'reconcileEntries' : 'update';
    db[name] = async (...args) => {
      const result = await original(...args);
      if (held || (phase === 'collections' && args[0] !== 'people')) return result;
      held = true;
      reached();
      await new Promise((resolve) => { release = resolve; });
      return result;
    };
    const store = await loadModule('src/lib/store.ts', storeMocks(db));
    await store.init();
    const future = Date.now() + 100_000;
    const data = {
      entries: [entry({ id: 'incoming', title: 'Incoming note', updated: future })],
      people: [{ id: 'incoming-person', name: 'Incoming person', updated: future }],
      books: [{ id: 'incoming-book', title: 'Incoming book', updated: future }],
      songs: [{ id: 'incoming-song', music: { kind: 'track', id: '4cOdK2wGLETKBW3PvgPWqT', title: 'Incoming song' }, updated: future }],
    };
    const pending = store[method](method === 'importJSON' ? JSON.stringify(data) : data);
    await waiting;
    await store.deleteAll();
    const put = db.put;
    db.put = async () => { throw new Error('Storage full'); };
    await assert.rejects(store.saveEntry({ ...data.entries[0], title: 'Failed save after wipe' }), /Storage full/);
    db.put = put;
    const freshNote = await store.saveEntry(store.blankEntry());
    const freshPerson = await store.savePerson(store.blankPerson('Fresh person'));
    release();
    await pending;
    assert.deepEqual(Array.from(store.getEntries(), (e) => e.id), [freshNote.id], `${method}/${phase}: note`);
    assert.deepEqual(Array.from(await db.all(), (e) => e.id), [freshNote.id], `${method}/${phase}: durable note`);
    assert.deepEqual(Array.from(store.getPeople(), (p) => p.id), [freshPerson.id], `${method}/${phase}: person`);
    assert.equal(store.getBooks().length, 0);
    assert.equal(store.getSongs().length, 0);
    for (const id of ['incoming', 'incoming-person', 'incoming-book', 'incoming-song'])
      assert.ok(store.getDeleted()[id] >= future, `${method}/${phase}: ${id} tombstone`);
    await store.mergeSynced(data);
    assert.deepEqual(Array.from(store.getEntries(), (e) => e.id), [freshNote.id], `${method}/${phase}: subsequent sync`);
    assert.deepEqual(Array.from(store.getPeople(), (p) => p.id), [freshPerson.id]);
  }
});

test('delete all interrupts a backup still loading photos and remembers its unseen records', async () => {
  let finishPhotos;
  const db = memoryDB([entry()]);
  const store = await loadModule('src/lib/store.ts', storeMocks(db, () => new Promise((resolve) => { finishPhotos = resolve; })));
  await store.init();
  const incoming = entry({ id: 'incoming', title: 'Pending backup', updated: Date.now() + 100_000 });
  const pending = store.importJSON(JSON.stringify({ entries: [incoming] }));
  await store.deleteAll();
  finishPhotos(0);
  const result = await pending;
  assert.equal(result.changed, 0);
  assert.equal(store.getEntries().length, 0);
  assert.equal((await db.all()).length, 0);
  assert.ok(store.getDeleted().incoming >= incoming.updated);
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

test('key dates come round each year, tags on pages count, and months show how it felt', async () => {
  const m = await loadModule('src/lib/people.ts', { './store': { getBooks: () => [] } });
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const ana = { id: 'p1', name: 'Ana Pop', relation: '', text: '', emotions: [], updated: 5, dates: [
    { id: 'd1', kind: 'birthday', label: '', md: '10-05', year: 1996 },
    { id: 'd2', kind: 'other', label: 'Name day', md: '02-29', year: null },
  ] };
  const now = new Date(2026, 9, 2);
  const soon = m.upcoming([ana], 14, now);
  assert.equal(soon.length, 1);
  assert.deepEqual([soon[0].days, soon[0].years], [3, 30]);
  assert.deepEqual(plain(m.whatsComing(soon[0])), { what: 'Ana’s birthday', years: 'turning 30' });
  assert.equal(m.nextOf(ana, ana.dates[1], now).on.getDate(), 28, '29 February falls on the 28th in other years');
  assert.equal(m.nextOf(ana, ana.dates[0], new Date(2026, 9, 5)).days, 0, 'today counts');

  const bo = { id: 'p2', name: 'Bo', text: 'Lunch with @[Ana Pop] and @[Bo]', updated: 9 };
  const book = { id: 'b1', title: 'Dune', text: 'Ana lent me this. @[Ana Pop]', updated: 7 };
  const pages = m.pagesByPerson([ana, bo], [book], []);
  assert.deepEqual(plain(pages.get('p1').map((p) => p.kind)), ['person', 'book']);
  assert.equal(pages.has('p2'), false, 'a page tagging itself does not count');

  const entries = [{ id: 'e1', people: [], text: 'Saw @[Ana Pop]', emotions: [], time: 1 }, { id: 'e2', people: ['p1'], text: '', emotions: [], time: 2 }];
  assert.equal(m.momentsByPerson(entries, [ana, bo]).get('p1').length, 2, 'tags in the words count as moments');

  const at = (month, emotions) => ({ date: `2026-${String(month + 1).padStart(2, '0')}-03`, time: new Date(2026, month, 3).getTime(), emotions });
  const months = m.monthsOf([at(9, ['joy']), at(8, ['joy']), at(2, ['sadness']), at(1, ['fear'])], 12, now);
  assert.equal(months.length, 12);
  assert.deepEqual([months.at(-1).m, months.at(-1).total, months.at(-1).warmth], [9, 1, 1]);
  assert.equal(m.trendOf(months), 'warmer');
});

test('People monthly feelings follow a backdated entry’s calendar day', async () => {
  const people = await loadModule('src/lib/people.ts', { './store': { getBooks: () => [] } });
  const months = people.monthsOf([
    entry({ date: '2026-08-31', time: new Date(2026, 9, 2).getTime(), emotions: ['joy'] }),
  ], 3, new Date(2026, 9, 2));
  assert.deepEqual(Array.from(months, (month) => [month.m, month.total]), [[7, 1], [8, 0], [9, 0]]);
});

test('books retain known zero progress and resolve canonical Unicode titles', async () => {
  const books = await loadModule('src/lib/books.ts', { './store': { getBooks: () => [] } });
  assert.equal(books.progressOf({ pages: 250, page: 0 }), 0);
  assert.equal(books.progressOf({ pages: 250, page: null }), null);
  assert.equal(books.progressOf({ pages: 0, page: 10 }), null);
  assert.equal(books.progressOf({ pages: 250, page: 300 }), 100);
  const first = { id: 'first', title: 'Émile' };
  const second = { id: 'second', title: 'E\u0301mile' };
  assert.equal(books.resolveMention(undefined, second.title, [first]).id, first.id);
  assert.equal(books.mentionOf(second, [first, second]), '[[book:second|E\u0301mile]]');
});

test('text exports follow journal dates and resolve tags consistently across collections', async () => {
  const people = [{ id: 'person', name: 'Ana', relation: '', dates: [], text: '', emotions: [] }];
  const books = [{ id: 'book', title: 'Dune', authors: '', status: 'reading', rating: 0, started: null, finished: null, page: 0, pages: 250, emotions: [], from: null, text: '' }];
  const songs = [{ id: 'song', music: { kind: 'track', title: 'Blue' }, repeat: false, rating: 0, emotions: [], from: null, text: 'Thanks @[Ana] for [[Dune]].' }];
  const entries = [
    entry({ id: 'today', title: 'Later day', date: '2026-10-02', time: 1, text: 'With @[Ana]', people: ['person'] }),
    entry({ id: 'earlier', title: 'Earlier day', date: '2026-09-30', time: 2, text: 'With @[Ana]' }),
  ];
  const exporter = await loadModule('src/lib/exportText.ts', {
    './store': { getEntries: () => entries, getPeople: () => people, getBooks: () => books, getSongs: () => songs },
  });
  const text = exporter.exportText();
  assert.ok(text.indexOf('Earlier day') < text.indexOf('Later day'), 'backdated notes retain calendar order');
  assert.ok(text.includes('Tagged in 2 entries'), 'inline tags count once alongside Thinking of tags');
  assert.ok(text.includes('On page 0 of 250'));
  assert.ok(text.includes('Thanks Ana for “Dune” (book).'));
  assert.ok(!text.includes('@[Ana]'));
});
