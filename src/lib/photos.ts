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
}

const MAX_SIDE = 2048;
const KEEP_AS_IS = 1_500_000; // bytes: small, already-web images keep their original file (and any animation)
const WEB_TYPES = /^image\/(jpeg|png|webp|gif|avif)$/;
export const PHOTO_ID = /^p[a-z0-9]{6,40}$/;
const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function encode(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
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
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  let blob = await encode(canvas, 'image/webp');
  if (!blob || blob.type !== 'image/webp') {
    // No WebP encoder (older Safari): JPEG, with transparent areas on white instead of black.
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    blob = await encode(canvas, 'image/jpeg');
  }
  if (!blob) throw new Error('Could not encode image');
  return { ...base, blob };
}

/* ---------- object URLs, created once per photo ---------- */

const loaded = new Map<string, string>();
const loading = new Map<string, Promise<string | null>>();
const listeners = new Map<string, Set<() => void>>();

function cachePhoto(id: string, blob: Blob) {
  const previous = loaded.get(id);
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

export function usePhotoUrl(id: string) {
  const [url, setUrl] = useState(() => loaded.get(id) ?? null);
  useEffect(() => {
    let live = true;
    let request = 0;
    const refresh = () => {
      const current = ++request;
      setUrl(loaded.get(id) ?? null);
      if (!loaded.has(id)) photoUrl(id).then((u) => live && current === request && setUrl(u));
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
  }, [id]);
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
  const all = await db.photos<PhotoRecord>();
  const cutoff = Date.now() - 86_400_000;
  const stale = all.filter((p) => !keep.has(p.id) && p.created < cutoff).map((p) => p.id);
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
  const records: PhotoRecord[] = [];
  for (const [id, p] of Object.entries(raw as Record<string, any>)) {
    if (have.has(id)) continue;
    const m = ids.has(id) && PHOTO_ID.test(id) && typeof p?.data === 'string' ? DATA_URL.exec(p.data) : null;
    if (!m) continue;
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    records.push({ id, w: +p.w || 1, h: +p.h || 1, blob: new Blob([bytes], { type: m[1] }), created: Date.now() });
  }
  await storePhotos(records);
  return records.length;
}
