// Minimal IndexedDB wrapper. Everything lives on this device; only sync (off by default) sends an encrypted copy out.
import { combineDeleted } from './deletions';

const NAME = 'my-mind';
let dbp: Promise<IDBDatabase> | null = null;
/** The connection dbp gave, while it's good: the browser can close it under the app (see transaction). */
let opened: IDBDatabase | null = null;
const forget = (db: IDBDatabase) => {
  if (opened !== db) return;
  opened = null;
  dbp = null;
};

/** Called when an older copy of the app (another tab, or the installed app) is holding the database open during an upgrade. */
let blockedHandler = () => {};
export const onBlocked = (f: () => void) => void (blockedHandler = f);

function open() {
  dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    };
    req.onblocked = () => blockedHandler();
    req.onsuccess = () => {
      const db = req.result;
      opened = db;
      // the browser closed it (iOS does for an app left in the background, and when storage is cleared): the next
      // read or write opens it again
      db.onclose = () => forget(db);
      // A newer version of the app wants to upgrade: let go and reload into it instead of blocking it.
      db.onversionchange = () => {
        db.close();
        dbp = null;
        location.reload();
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  }).catch((error) => {
    // A temporary failure (for example, unavailable browser storage) must be retryable.
    dbp = null;
    throw error;
  });
  return dbp;
}

/**
 * A transaction, on a connection opened again if the browser has let go of the old one. iOS can drop a page's
 * connection while the app sits in the background, without telling it (no close event): from then on every save would
 * fail until the page was reloaded, so a note's words written after it would be lost.
 */
async function transaction<T>(stores: string | string[], mode: IDBTransactionMode, use: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  let db = await open();
  let tx: IDBTransaction;
  try {
    tx = db.transaction(stores, mode);
  } catch (error) {
    if ((error as DOMException)?.name !== 'InvalidStateError') throw error;
    forget(db);
    db = await open();
    tx = db.transaction(stores, mode);
  }
  // used at once, in the same turn: a transaction with nothing asked of it by then can finish on its own
  return use(tx);
}

/** A transaction that failed because the connection was lost: the next one opens a new connection. */
function failed(tx: IDBTransaction) {
  if (tx.error?.name === 'UnknownError' || tx.error?.name === 'InvalidStateError') forget(tx.db);
  return tx.error;
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return transaction(store, mode, (tx) => new Promise<T>((resolve, reject) => {
    let req: IDBRequest<T> | void;
    tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
    tx.onerror = tx.onabort = () => reject(failed(tx));
    try {
      req = fn(tx.objectStore(store));
    } catch (error) {
      // A synchronous put failure halfway through a batch must roll back its earlier writes.
      tx.abort();
      reject(error);
    }
  }));
}

/** Read and change a shared value in one transaction, including writes from other tabs. */
async function update<T>(key: string, change: (current: T | undefined) => T): Promise<T> {
  return transaction('kv', 'readwrite', (tx) => new Promise<T>((resolve, reject) => {
    const store = tx.objectStore('kv');
    const req = store.get(key);
    let next: T;
    req.onsuccess = () => {
      try {
        next = change(req.result);
        store.put(next, key);
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = tx.onabort = () => reject(failed(tx));
  }));
}

/** Merge remote notes or a backup against durable records while holding one write transaction. */
async function reconcileEntries<T extends { id: string; updated: number }>(incoming: T[], deleted: Record<string, number>, normalize: (raw: any) => T | null = (raw) => raw, restore = false) {
  type Result = { entries: T[]; changed: T[]; removed: string[]; deleted: Record<string, number> };
  return transaction(['entries', 'kv'], 'readwrite', (tx) => new Promise<Result>((resolve, reject) => {
    const store = tx.objectStore('entries');
    const kv = tx.objectStore('kv');
    const req = store.getAll();
    const gone = kv.get('deleted');
    let entriesReady = false, deletedReady = false;
    let result: Result;
    const reconcile = () => {
      if (!entriesReady || !deletedReady) return;
      try {
        const tombstones = combineDeleted(combineDeleted(Object.create(null), gone.result), deleted);
        const current = new Map((req.result as unknown[]).map(normalize).filter((entry): entry is T => !!entry).map((entry) => [entry.id, entry]));
        const removed = restore ? [] : [...current.values()].filter((entry) => tombstones[entry.id] >= entry.updated).map((entry) => entry.id);
        for (const id of removed) { current.delete(id); store.delete(id); }
        const stamp = Date.now();
        const changed = incoming
          .filter((entry) => (restore || !(tombstones[entry.id] >= entry.updated)) && (!current.has(entry.id) || current.get(entry.id)!.updated < entry.updated))
          .map((entry) => restore && tombstones[entry.id] >= entry.updated ? { ...entry, updated: Math.max(stamp, tombstones[entry.id] + 1) } : entry);
        for (const entry of changed) { current.set(entry.id, entry); store.put(entry); }
        kv.put(tombstones, 'deleted');
        result = { entries: [...current.values()], changed, removed, deleted: tombstones };
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    req.onsuccess = () => { entriesReady = true; reconcile(); };
    gone.onsuccess = () => { deletedReady = true; reconcile(); };
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(failed(tx));
  }));
}

export const db = {
  update,
  reconcileEntries,
  all: <T>() => run<T[]>('entries', 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
  put: (value: unknown) => run('entries', 'readwrite', (s) => void s.put(value)),
  putMany: (values: unknown[]) => run('entries', 'readwrite', (s) => values.forEach((v) => s.put(v))),
  del: (id: string) => run('entries', 'readwrite', (s) => void s.delete(id)),
  clear: () => run('entries', 'readwrite', (s) => void s.clear()),
  get: <T>(key: string) => run<T | undefined>('kv', 'readonly', (s) => s.get(key)),
  set: (key: string, value: unknown) => run('kv', 'readwrite', (s) => void s.put(value, key)),
  photo: <T>(id: string) => run<T | undefined>('photos', 'readonly', (s) => s.get(id)),
  photos: <T>() => run<T[]>('photos', 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
  photoIds: () => run<string[]>('photos', 'readonly', (s) => s.getAllKeys() as IDBRequest<string[]>),
  putPhotos: (values: unknown[]) => run('photos', 'readwrite', (s) => values.forEach((v) => s.put(v))),
  delPhotos: (ids: string[]) => run('photos', 'readwrite', (s) => ids.forEach((id) => s.delete(id))),
  clearPhotos: () => run('photos', 'readwrite', (s) => void s.clear()),
};
