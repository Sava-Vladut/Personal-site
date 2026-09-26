// Minimal IndexedDB wrapper. Everything lives on this device; nothing is sent anywhere.

const NAME = 'my-mind';
let dbp: Promise<IDBDatabase> | null = null;

/** Called when an older copy of the app (another tab, or the installed app) is holding the database open during an upgrade. */
let blockedHandler = () => {};
export const onBlocked = (f: () => void) => void (blockedHandler = f);

function open() {
  dbp ??= new Promise((resolve, reject) => {
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
      // A newer version of the app wants to upgrade: let go and reload into it instead of blocking it.
      db.onversionchange = () => {
        db.close();
        location.reload();
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

export const db = {
  all: <T>() => run<T[]>('entries', 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
  put: (value: unknown) => run('entries', 'readwrite', (s) => void s.put(value)),
  putMany: (values: unknown[]) => run('entries', 'readwrite', (s) => values.forEach((v) => s.put(v))),
  del: (id: string) => run('entries', 'readwrite', (s) => void s.delete(id)),
  clear: () => run('entries', 'readwrite', (s) => void s.clear()),
  get: <T>(key: string) => run<T | undefined>('kv', 'readonly', (s) => s.get(key)),
  set: (key: string, value: unknown) => run('kv', 'readwrite', (s) => void s.put(value, key)),
  photo: <T>(id: string) => run<T | undefined>('photos', 'readonly', (s) => s.get(id)),
  photos: <T>() => run<T[]>('photos', 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
  putPhotos: (values: unknown[]) => run('photos', 'readwrite', (s) => values.forEach((v) => s.put(v))),
  delPhotos: (ids: string[]) => run('photos', 'readwrite', (s) => ids.forEach((id) => s.delete(id))),
  clearPhotos: () => run('photos', 'readwrite', (s) => void s.clear()),
};
