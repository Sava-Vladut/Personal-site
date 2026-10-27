// Photos from the device's gallery (or a desktop file browser). They're downscaled here and kept in IndexedDB next
// to the notes — nothing is uploaded. Notes only hold { id, w, h }; the image itself lives in the 'photos' store.
import { useEffect, useState } from 'preact/hooks';
import { db } from './db';

export interface Photo {
  id: string;
  w: number;
  h: number;
}
interface PhotoRecord extends Photo {
  blob: Blob;
  created: number;
  /** A smaller copy for cards (CARD_SIDE), made the first time a card shows the photo. Stays on this device. */
  card?: Blob;
}

const MAX_SIDE = 2048;
const KEEP_AS_IS = 1_500_000; // bytes: small, already-web images keep their original file (and any animation)
const WEB_TYPES = /^image\/(jpeg|png|webp|gif|avif)$/;
export const PHOTO_ID = /^p[a-z0-9]{6,40}$/;
const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function encode(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
}

/** WebP where the browser can write it, else JPEG with transparent areas on white instead of black. */
async function encodeWeb(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  let blob = await encode(canvas, 'image/webp');
  if (!blob || blob.type !== 'image/webp') {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    blob = await encode(canvas, 'image/jpeg');
  }
  return blob;
}

async function shrink(file: Blob): Promise<PhotoRecord> {
  const bmp = await createImageBitmap(file); // throws on formats this browser can't read (e.g. HEIC outside Safari)
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const base = { id: newId(), w, h, created: Date.now() };
  if (scale === 1 && file.size <= KEEP_AS_IS && WEB_TYPES.test(file.type)) {
    bmp.close();
    return { ...base, blob: file };
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  try {
    if (!ctx) throw new Error('Could not create image canvas');
    ctx.drawImage(bmp, 0, 0, w, h);
  } finally {
    bmp.close();
  }
  const blob = await encodeWeb(canvas, ctx); // no WebP encoder (older Safari): JPEG
  if (!blob) throw new Error('Could not encode image');
  return { ...base, blob };
}

/* ---------- object URLs, created once per photo ---------- */

const loaded = new Map<string, string>();
const loading = new Map<string, Promise<string | null>>();
const listeners = new Map<string, Set<() => void>>();

function cachePhoto(id: string, blob: Blob) {
  const previous = loaded.get(id);
  const card = loaded.get(cardKey(id)); // a new file for this photo: its card copy is made again from it
  if (card) URL.revokeObjectURL(card);
  loaded.delete(cardKey(id));
  loading.delete(cardKey(id));
  const url = URL.createObjectURL(blob);
  loaded.set(id, url);
  loading.set(id, Promise.resolve(url));
  listeners.get(id)?.forEach((notify) => notify());
  if (previous) URL.revokeObjectURL(previous);
}

export function photoUrl(id: string) {
  let p = loading.get(id);
  if (!p) {
    p = db.photo<PhotoRecord>(id).then(
      (r) => {
        // A download or clear may have replaced this request while IndexedDB was reading.
        if (loading.get(id) !== p) return loaded.get(id) ?? null;
        if (!r) {
          loading.delete(id); // may show up later (backup import)
          return null;
        }
        const url = URL.createObjectURL(r.blob);
        loaded.set(id, url);
        return url;
      },
      () => {
        if (loading.get(id) === p) loading.delete(id);
        return loaded.get(id) ?? null;
      },
    );
    loading.set(id, p);
  }
  return p;
}

/* ---------- card-sized copies ----------
   A journal card shows a photo a few hundred px wide, but photos are kept at up to 2048px: decoding those while a list
   scrolls is what makes it stutter on a phone. The first time a card shows a photo, a copy at most CARD_SIDE px is made
   (one at a time, so a fast scroll doesn't pile the work up) and kept next to the photo; it never syncs or exports. */

const CARD_SIDE = 960; // sharp across a phone's card at 3x, about a quarter of the pixels
const cardKey = (id: string) => id + ' card';
let making: Promise<unknown> = Promise.resolve();

async function cardBlob(r: PhotoRecord): Promise<Blob | null> {
  if (r.card) return r.card;
  // already small, or a GIF that would lose its animation: the photo itself is the card's
  if (Math.max(r.w, r.h) <= CARD_SIDE * 1.25 || r.blob.type === 'image/gif') return null;
  const made = making.then(async () => {
    const bmp = await createImageBitmap(r.blob);
    const scale = Math.min(1, CARD_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d');
    try {
      if (!ctx) return null;
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    } finally {
      bmp.close();
    }
    return encodeWeb(canvas, ctx);
  });
  making = made.catch(() => null);
  const card = await made;
  if (card) void db.putPhotos([{ ...r, card }]).catch(() => {}); // made once; next time it's just read
  return card;
}

/** The card-sized copy's address (the photo's own when it's small already). */
function photoCardUrl(id: string) {
  const key = cardKey(id);
  let p = loading.get(key);
  if (!p) {
    p = db.photo<PhotoRecord>(id).then(async (r) => {
      if (!r) { loading.delete(key); return null; }
      const card = await cardBlob(r).catch(() => null);
      if (!card) {
        // small already (or no copy could be made): the card shows the photo itself, from now on without asking again
        const url = await photoUrl(id);
        if (loading.get(key) !== p) return url;
        if (url) loaded.set(key, url);
        else loading.delete(key);
        return url;
      }
      if (loading.get(key) !== p) return loaded.get(key) ?? null;
      const url = URL.createObjectURL(card);
      loaded.set(key, url);
      return url;
    }, () => { loading.delete(key); return photoUrl(id); });
    loading.set(key, p);
  }
  return p;
}

/** A photo's address once `active` (it's near the screen); `card` asks for the card-sized copy. */
export function usePhotoUrl(id: string, active = true, card = false) {
  const key = card ? cardKey(id) : id;
  const [url, setUrl] = useState(() => loaded.get(key) ?? null);
  useEffect(() => {
    if (!active && !loaded.has(key)) { setUrl(null); return; }
    let live = true;
    let request = 0;
    const refresh = () => {
      const current = ++request;
      setUrl(loaded.get(key) ?? null);
      if (!loaded.has(key)) (card ? photoCardUrl(id) : photoUrl(id)).then((u) => live && current === request && setUrl(u));
    };
    const subs = listeners.get(id) ?? new Set<() => void>();
    listeners.set(id, subs);
    subs.add(refresh);
    refresh();
    return () => {
      live = false;
      subs.delete(refresh);
      if (!subs.size) listeners.delete(id);
    };
  }, [id, active, card]);
  return url;
}

/** Shrinks and stores the picked files. Files that aren't readable images are skipped and counted. */
export async function addPhotos(files: Iterable<File>) {
  const photos: Photo[] = [];
  let failed = 0;
  const records: PhotoRecord[] = [];
  for (const f of files) {
    try {
      records.push(await shrink(f));
    } catch {
      failed++;
    }
  }
  if (records.length) await db.putPhotos(records);
  for (const r of records) {
    cachePhoto(r.id, r.blob);
    photos.push({ id: r.id, w: r.w, h: r.h });
  }
  return { photos, failed };
}

/** Deletes photos no note refers to. Recent ones are kept: they may belong to a note still being written in another tab. */
export async function prunePhotos(keep: Set<string>) {
  // Runs on every start: read keys only, and whole records (with their blobs) just for the few no entry uses.
  const orphans = (await db.photoIds()).filter((id) => !keep.has(id));
  const cutoff = Date.now() - 86_400_000;
  const stale: string[] = [];
  for (const id of orphans) if (((await db.photo<PhotoRecord>(id))?.created ?? 0) < cutoff) stale.push(id);
  if (stale.length) await db.delPhotos(stale);
}

export async function clearPhotos() {
  await db.clearPhotos();
  loaded.forEach((url) => URL.revokeObjectURL(url));
  loaded.clear();
  loading.clear();
  listeners.forEach((subs) => subs.forEach((notify) => notify()));
}

/* ---------- sync: photos travel one by one as raw files ---------- */

export const photoBlob = async (id: string) => (await db.photo<PhotoRecord>(id))?.blob;
export const photoIds = async () => new Set(await db.photoIds());

export async function storePhotos(list: (Photo & { blob: Blob })[]) {
  if (!list.length) return;
  await db.putPhotos(list.map((p) => ({ ...p, created: Date.now() })));
  list.forEach((p) => cachePhoto(p.id, p.blob));
}

/* ---------- backup: photos travel inside the JSON as data URLs ---------- */

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.onabort = () => reject(new Error('Photo export cancelled'));
    r.readAsDataURL(blob);
  });

export async function exportPhotos(ids: Set<string>) {
  const out: Record<string, { w: number; h: number; data: string }> = {};
  for (const p of await db.photos<PhotoRecord>()) {
    if (ids.has(p.id)) out[p.id] = { w: p.w, h: p.h, data: await toDataUrl(p.blob) };
  }
  return out;
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif|avif));base64,([A-Za-z0-9+/=]+)$/;

/** Stores photos from a backup (only the ones asked for). Returns how many were stored. */
export async function importPhotos(raw: unknown, ids: Set<string>) {
  if (!raw || typeof raw !== 'object') return 0;
  const have = await photoIds();
  const records: (Photo & { blob: Blob })[] = [];
  for (const [id, p] of Object.entries(raw as Record<string, any>)) {
    if (have.has(id)) continue;
    const m = ids.has(id) && PHOTO_ID.test(id) && typeof p?.data === 'string' ? DATA_URL.exec(p.data) : null;
    if (!m) continue;
    // A damaged photo should not stop the remaining pictures and entries importing.
    let bin: string;
    try { bin = atob(m[2]); } catch { continue; }
    if (!bin.length) continue;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dimension = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;
    records.push({ id, w: dimension(p.w), h: dimension(p.h), blob: new Blob([bytes], { type: m[1] }) });
  }
  await storePhotos(records);
  return records.length;
}
