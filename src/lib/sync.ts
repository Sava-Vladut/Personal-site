// Sync across devices, off by default. Turning it on makes a random code; the journal is encrypted here, in the
// browser, with a key derived from that code, and the server keeps only the ciphertext, filed under an id that is
// also derived from the code. So the server can't read the journal, and anyone with the code can.
// Each device merges what's on the server with what it has (newest edit wins, deletions stick) and sends the result back.
import { getDeleted, getEntries, getPeople, mergeSynced, observable, photosOf, onLocalChange, toast } from './store';
import { photoBlob, photoIds, storePhotos, type Photo } from './photos';
import { resolveIcon } from './icons';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to mix up; 12 characters = 60 random bits
const CODE_LEN = 12;
const STATE_KEY = 'mm-sync';
const IMAGE = /^image\/(jpeg|png|webp|gif|avif)$/;

interface State {
  code: string;
  rev: string | null; // server revision this device last saw
  dirty: boolean;     // changed here since then
  last: number;       // last successful sync
  sent: string[];     // photos already on the server
}

export interface SyncStatus {
  on: boolean;
  code?: string;
  busy: boolean;
  last: number;
  error?: string;
}

function loadState(): State | null {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
    return s && typeof s.code === 'string' ? { rev: null, dirty: false, last: 0, sent: [], ...s } : null;
  } catch {
    return null;
  }
}
let state = loadState();
function saveState() {
  try {
    if (state) localStorage.setItem(STATE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STATE_KEY);
  } catch {}
}

const status$ = observable<SyncStatus>({ on: !!state, code: state?.code, busy: false, last: state?.last ?? 0 });
export const useSync = status$.use;
const publish = (patch: Partial<SyncStatus>) => status$.set({ ...status$.get(), ...patch });

/* ---------- codes and keys ---------- */

export const formatCode = (c: string) => c.match(/.{1,4}/g)!.join('-');

export function parseCode(input: string) {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === CODE_LEN && [...c].every((ch) => ALPHABET.includes(ch)) ? c : null;
}

function newCode() {
  // 256 is a multiple of 32, so masking keeps every character equally likely.
  return [...crypto.getRandomValues(new Uint8Array(CODE_LEN))].map((b) => ALPHABET[b & 31]).join('');
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const keyCache = new Map<string, Promise<{ id: string; key: CryptoKey }>>();

function keys(code: string) {
  let k = keyCache.get(code);
  if (!k) {
    k = (async () => {
      if (!crypto.subtle) throw new Error('Sync only works over a secure (https) connection.');
      const base = await crypto.subtle.importKey('raw', enc.encode(code), 'HKDF', false, ['deriveBits', 'deriveKey']);
      const hkdf = (info: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('my-mind sync v1'), info: enc.encode(info) });
      const id = new Uint8Array(await crypto.subtle.deriveBits(hkdf('id'), base, 256));
      const key = await crypto.subtle.deriveKey(hkdf('key'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      return { id: [...id].map((b) => b.toString(16).padStart(2, '0')).join(''), key };
    })();
    keyCache.set(code, k);
  }
  return k;
}

async function encrypt(key: CryptoKey, data: Uint8Array<ArrayBuffer>) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

async function decrypt(key: CryptoKey, buf: ArrayBuffer) {
  const b = new Uint8Array(buf);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12) }, key, b.subarray(12)));
}

/* ---------- server ---------- */

async function call(path: string, init?: RequestInit) {
  try {
    return await fetch('/api/sync/' + path, { cache: 'no-store', ...init });
  } catch {
    throw new Error('Can’t reach the server. It’ll sync when you’re back online.');
  }
}

async function failure(res: Response) {
  const body = await res.json().catch(() => null);
  return new Error(body?.error || `The server couldn’t sync (${res.status}).`);
}

interface Doc {
  entries?: { id?: unknown; updated?: unknown }[];
  people?: { id?: unknown; updated?: unknown }[];
  deleted?: Record<string, number>;
}

async function download(id: string, key: CryptoKey, rev: string | null) {
  const res = await call(id, { headers: rev ? { 'X-Sync-Rev': rev } : {} });
  if (res.status === 304) return { rev, doc: null };
  if (res.status === 404) return { rev: null, doc: null };
  if (!res.ok) throw await failure(res);
  const doc: Doc = JSON.parse(dec.decode(await decrypt(key, await res.arrayBuffer())));
  return { rev: res.headers.get('X-Sync-Rev'), doc };
}

/** Whether this device has something the server's copy lacks. */
function aheadOf(doc: Doc) {
  const there = new Map([...(Array.isArray(doc.entries) ? doc.entries : []), ...(Array.isArray(doc.people) ? doc.people : [])].map((e) => [e?.id, Number(e?.updated)]));
  const gone = doc.deleted ?? {};
  return [...getEntries(), ...getPeople()].some((e) => !(there.get(e.id)! >= e.updated)) || Object.entries(getDeleted()).some(([id, t]) => !(gone[id] >= t));
}

const photosInUse = () => {
  const out = new Map<string, Photo>();
  getEntries().forEach((e) => photosOf(e).forEach((p) => out.set(p.id, p)));
  return out;
};

async function sendPhotos(s: State, id: string, key: CryptoKey) {
  const sent = new Set(s.sent);
  const have = await photoIds();
  for (const pid of photosInUse().keys()) {
    if (sent.has(pid) || !have.has(pid)) continue;
    const blob = await photoBlob(pid);
    if (!blob) continue;
    const head = enc.encode(blob.type + '\n');
    const bytes = new Uint8Array(head.length + blob.size);
    bytes.set(head);
    bytes.set(new Uint8Array(await blob.arrayBuffer()), head.length);
    const res = await call(`${id}/${pid}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: await encrypt(key, bytes) });
    if (!res.ok) throw await failure(res);
    sent.add(pid);
  }
  s.sent = [...sent];
}

/** Fetches photos that notes refer to but this device doesn't have yet. */
async function fetchPhotos(s: State, id: string, key: CryptoKey) {
  const have = await photoIds();
  const got: (Photo & { blob: Blob })[] = [];
  for (const p of photosInUse().values()) {
    if (have.has(p.id)) continue;
    const res = await call(`${id}/${p.id}`);
    if (!res.ok) continue; // not uploaded yet; tried again next time
    const bytes = await decrypt(key, await res.arrayBuffer());
    const nl = bytes.indexOf(10);
    const type = dec.decode(bytes.subarray(0, nl));
    if (nl < 0 || !IMAGE.test(type)) continue;
    got.push({ ...p, blob: new Blob([bytes.subarray(nl + 1)], { type }) });
  }
  await storePhotos(got);
  s.sent = [...new Set([...s.sent, ...got.map((p) => p.id)])];
}

/** One round: fetch the server's copy if it changed, merge it in, and send ours back if we have anything new. */
async function pass(s: State) {
  const { id, key } = await keys(s.code);
  for (let tries = 0; tries < 5; tries++) {
    const { rev, doc } = await download(id, key, s.rev);
    if (state !== s) return;
    if (!rev && s.rev) {
      // It was there and now it's gone: removed from another device.
      stopSync();
      toast('Sync was turned off from another device');
      return;
    }
    if (doc) {
      const r = await mergeSynced(doc);
      r.icons.forEach((i) => resolveIcon(i));
      await fetchPhotos(s, id, key);
    }
    if (!(rev ? (doc ? aheadOf(doc) : s.dirty) : true)) {
      s.rev = rev;
      s.dirty = false;
    } else {
      s.dirty = false; // edits made while uploading set it again
      try {
        await sendPhotos(s, id, key);
        const body = await encrypt(key, enc.encode(JSON.stringify({ app: 'my-mind', version: 1, entries: getEntries(), people: getPeople(), deleted: getDeleted() })));
        const res = await call(id, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'X-Sync-Rev': rev ?? 'new' }, body });
        if (res.status === 409) {
          s.dirty = true;
          continue; // another device got there first: merge its copy and try again
        }
        if (!res.ok) throw await failure(res);
        s.rev = (await res.json()).rev;
      } catch (e) {
        s.dirty = true;
        throw e;
      } finally {
        if (state === s) saveState();
      }
    }
    s.last = Date.now();
    if (state === s) saveState();
    return;
  }
  throw new Error('Lots of changes at once. Trying again shortly.');
}

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (!state) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  publish({ busy: true });
  running = (async () => {
    try {
      do {
        again = false;
        if (state) await pass(state);
      } while (again && state);
      publish({ busy: false, error: undefined, last: state?.last ?? 0 });
    } catch (e) {
      publish({ busy: false, error: (e as Error).message });
    } finally {
      running = null;
    }
  })();
  return running;
}

/* ---------- turning it on and off ---------- */

/** Starts syncing with a new code: everything on this device is uploaded. */
export function startSync() {
  state = { code: newCode(), rev: null, dirty: true, last: 0, sent: [] };
  saveState();
  publish({ on: true, code: state.code, last: 0, error: undefined });
  return syncNow();
}

/** Links this device to a code from another one: merges what's saved there, then keeps syncing. */
export async function joinSync(input: string) {
  const code = parseCode(input);
  if (!code) throw new Error('A code is 12 letters and numbers, like ABCD-EFGH-JKLM.');
  const { id, key } = await keys(code);
  const { rev } = await download(id, key, null);
  if (!rev) throw new Error('Nothing is saved under that code. Check it on the other device.');
  const before = new Set(getEntries().map((e) => e.id));
  state = { code, rev: null, dirty: true, last: 0, sent: [] };
  saveState();
  publish({ on: true, code, last: 0, error: undefined });
  await syncNow();
  const err = status$.get().error;
  if (err) throw new Error(err);
  return getEntries().filter((e) => !before.has(e.id)).length;
}

/** Stops syncing on this device. The server copy stays for the others. */
export function stopSync() {
  state = null;
  saveState();
  publish({ on: false, code: undefined, busy: false, error: undefined, last: 0 });
}

/** Deletes the server copy (every synced device stops syncing) and stops here. Entries on devices stay. */
export async function removeServerCopy() {
  if (!state) return;
  const { id } = await keys(state.code);
  const res = await call(id, { method: 'DELETE' });
  if (!res.ok) throw await failure(res);
  stopSync();
}

/* ---------- when to sync ---------- */

let timer: ReturnType<typeof setTimeout> | undefined;
export function initSync() {
  onLocalChange(() => {
    if (!state) return;
    state.dirty = true;
    saveState();
    clearTimeout(timer);
    timer = setTimeout(syncNow, 1500);
  });
  addEventListener('online', () => syncNow());
  // Pick up edits from other devices when coming back to the app; send pending ones when leaving it.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' || state?.dirty) syncNow();
  });
  setInterval(() => document.visibilityState === 'visible' && syncNow(), 60_000);
  syncNow();
}
