import { useEffect, useState } from 'preact/hooks';
import { db } from './db';
import { dropImageLinks, plainText } from './body';
import { todayKey } from './dates';
import { EMOTION } from '../data/emotions';
import { PHOTO_ID, clearPhotos, exportPhotos, importPhotos, prunePhotos, type Photo } from './photos';

/** An image from the web: found through Openverse, or saved from Pinterest by older versions. */
export interface WebImage {
  url: string;
  thumb?: string;
  w?: number;
  h?: number;
  link?: string;     // the page it came from
  title?: string;
  credit?: string;   // creator and license
}

/** A Spotify song, album, playlist or podcast attached to a note — a reference, played through Spotify's embed. */
export interface Music {
  kind: 'track' | 'album' | 'playlist' | 'episode' | 'show' | 'artist';
  id: string;
  title: string;
  sub?: string;      // artists, show or owner
  image?: string;
  link: string;      // https://open.spotify.com/<kind>/<id>
}
const MUSIC_KINDS = ['track', 'album', 'playlist', 'episode', 'show', 'artist'];

/** The picture a note is shown with: faintly behind its card in the journal, and at the top of the note. */
export type Cover = { photo: Photo } | { image: WebImage };

export interface Entry {
  id: string;
  kind: 'note' | 'checkin';
  title: string;
  icon: string | null;      // 't:mood-happy' (Tabler) or 'e:pensive-face' (Fluent emoji)
  text: string;
  emotions: string[];       // emotion ids at any depth, first one is the main feeling
  intensity: number;        // 1–5
  date: string;             // 'YYYY-MM-DD'
  dateEnd: string | null;   // set when the note covers a range
  time: number;             // when it happened (ms) — drives time-of-day stats
  images: WebImage[];
  photos: Photo[];          // from the device's gallery, stored locally (see photos.ts)
  music: Music[];
  people: string[];         // ids of the people it's about or who were there
  cover: Cover | null;
  created: number;
  updated: number;
}

/** Someone in your life: what you write about them and how they make you feel. */
export interface Person {
  id: string;
  name: string;
  icon: string | null;      // same ids as a note's icon
  relation: string;         // 'Friend', 'Mum', 'Coworker'…
  text: string;             // what you write about them
  emotions: string[];       // how they make you feel, first one is the main feeling
  created: number;
  updated: number;
}
export const MAX_PERSON_EMOTIONS = 5;

/* ---------- tiny observable ---------- */

export function observable<T>(initial: T) {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      subs.forEach((f) => f());
    },
    use(): T {
      const [, force] = useState(0);
      useEffect(() => {
        const f = () => force((n) => n + 1);
        subs.add(f);
        return () => void subs.delete(f);
      }, []);
      return value;
    },
  };
}

/* ---------- entries ---------- */

const byNewest = (a: Entry, b: Entry) =>
  a.date === b.date ? b.time - a.time : a.date < b.date ? 1 : -1;

const entries$ = observable<Entry[]>([]);
const ready$ = observable(false);
export const useEntries = entries$.use;
export const useReady = ready$.use;
export const getEntries = entries$.get;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function blankEntry(kind: Entry['kind'] = 'note'): Entry {
  const now = Date.now();
  return {
    id: uid(), kind, title: '', icon: null, text: '', emotions: [], intensity: 3,
    date: todayKey(), dateEnd: null, time: now, images: [], photos: [], music: [], people: [], cover: null, created: now, updated: now,
  };
}

/** Every photo a note uses: those in its text and its cover. */
export const photosOf = (e: Entry) => (e.cover && 'photo' in e.cover ? [...e.photos, e.cover.photo] : e.photos);

export const isEmpty = (e: Entry) => !e.title.trim() && !plainText(e.text).trim() && !e.emotions.length && !e.images.length && !e.photos.length && !e.music.length && !e.people.length && !e.cover;

/** Told about every change made on this device (sync uses it to know there's something to send). */
let changeHandler = () => {};
export const onLocalChange = (f: () => void) => void (changeHandler = f);

let persistAsked = false;
export async function saveEntry(e: Entry) {
  const next = { ...e, updated: Date.now() };
  const list = entries$.get().filter((x) => x.id !== e.id);
  list.push(next);
  entries$.set(list.sort(byNewest));
  await db.put(next);
  changeHandler();
  if (!persistAsked) {
    persistAsked = true;
    navigator.storage?.persist?.().catch(() => {});
  }
  return next;
}

export async function deleteEntry(id: string) {
  const removed = entries$.get().find((x) => x.id === id);
  entries$.set(entries$.get().filter((x) => x.id !== id));
  await Promise.all([db.del(id), forget([id])]);
  changeHandler();
  return removed;
}

/* ---------- people ---------- */

const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
const people$ = observable<Person[]>([]);
export const usePeople = people$.use;
export const getPeople = people$.get;

export function blankPerson(name = ''): Person {
  const now = Date.now();
  return { id: uid(), name, icon: null, relation: '', text: '', emotions: [], created: now, updated: now };
}

const savePeople = (list: Person[]) => {
  people$.set([...list].sort(byName));
  return db.set('people', people$.get());
};

export async function savePerson(p: Person) {
  const next = { ...p, updated: Date.now() };
  await savePeople([...people$.get().filter((x) => x.id !== p.id), next]);
  changeHandler();
  return next;
}

/** Deletes a person. Notes they were tagged in stay; the tag just stops showing. */
export async function deletePerson(id: string) {
  const removed = people$.get().find((x) => x.id === id);
  await Promise.all([savePeople(people$.get().filter((x) => x.id !== id)), forget([id])]);
  changeHandler();
  return removed;
}

/* ---------- deletions: remembered (id → when) so a synced device doesn't bring the entry back ---------- */

let deleted: Record<string, number> = {};
export const getDeleted = () => deleted;

async function forget(ids: string[]) {
  const now = Date.now();
  deleted = { ...deleted };
  ids.forEach((id) => (deleted[id] = now));
  await db.set('deleted', deleted);
}

/* ---------- icon cache: bodies of icons used by notes, so lists render without loading icon sets ---------- */

const icons$ = observable<Record<string, string>>({});
export const useIconCache = icons$.use;
export async function rememberIcon(id: string, body: string) {
  if (icons$.get()[id] === body) return;
  const next = { ...icons$.get(), [id]: body };
  icons$.set(next);
  await db.set('icons', next);
}

export async function init() {
  const [list, icons, gone, people] = await Promise.all([
    db.all<Entry>(), db.get<Record<string, string>>('icons'), db.get<Record<string, number>>('deleted'), db.get<unknown[]>('people'),
  ]);
  entries$.set((list.map(normalize).filter(Boolean) as Entry[]).sort(byNewest));
  people$.set(normalizePeople(people));
  icons$.set(icons ?? {});
  deleted = gone ?? {};
  ready$.set(true);
  prunePhotos(new Set(entries$.get().flatMap((e) => photosOf(e).map((p) => p.id)))).catch(() => {});
}

/* ---------- backup ---------- */

const KEY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 100_000) => (typeof v === 'string' ? v.slice(0, max) : '');

const webImage = (i: any): WebImage | null =>
  i && /^https:\/\//.test(i.url)
    ? {
        url: str(i.url, 2000),
        thumb: /^https:\/\//.test(i.thumb) ? str(i.thumb, 2000) : undefined,
        w: +i.w || undefined,
        h: +i.h || undefined,
        link: /^https:\/\//.test(i.link) ? str(i.link, 2000) : undefined,
        title: str(i.title, 300) || undefined,
        credit: str(i.credit, 300) || undefined,
      }
    : null;
const photo = (p: any): Photo | null =>
  p && typeof p.id === 'string' && PHOTO_ID.test(p.id) ? { id: p.id, w: Math.max(1, +p.w || 1), h: Math.max(1, +p.h || 1) } : null;

/** Coerces untrusted input (imports) into a valid Entry, or null. */
function normalize(raw: any): Entry | null {
  if (!raw || typeof raw !== 'object' || !KEY.test(raw.date)) return null;
  const now = Date.now();
  const images: WebImage[] = Array.isArray(raw.images) ? raw.images.map(webImage).filter(Boolean).slice(0, 12) : [];
  const coverPhoto = photo(raw.cover?.photo);
  const coverImage = webImage(raw.cover?.image);
  return {
    id: str(raw.id, 40) || uid(),
    kind: raw.kind === 'checkin' ? 'checkin' : 'note',
    title: str(raw.title, 300),
    icon: typeof raw.icon === 'string' && /^[te]:[a-z0-9-]+$/.test(raw.icon) ? raw.icon : null,
    text: dropImageLinks(str(raw.text), images),
    emotions: Array.isArray(raw.emotions) ? raw.emotions.filter((x: unknown) => typeof x === 'string' && EMOTION[x]).slice(0, 3) : [],
    intensity: Math.min(5, Math.max(1, Math.round(Number(raw.intensity) || 3))),
    date: raw.date,
    dateEnd: KEY.test(raw.dateEnd) && raw.dateEnd > raw.date ? raw.dateEnd : null,
    time: Number.isFinite(raw.time) ? raw.time : now,
    images,
    photos: Array.isArray(raw.photos) ? raw.photos.map(photo).filter(Boolean).slice(0, 20) : [],
    music: Array.isArray(raw.music)
      ? raw.music
          .filter((m: any) => m && MUSIC_KINDS.includes(m.kind) && /^[A-Za-z0-9]{10,40}$/.test(m.id))
          .map((m: any) => ({
            kind: m.kind, id: m.id, title: str(m.title, 300) || 'Untitled', sub: str(m.sub, 300) || undefined,
            image: /^https:\/\//.test(m.image) ? str(m.image, 2000) : undefined, link: `https://open.spotify.com/${m.kind}/${m.id}`,
          }))
          .slice(0, 20)
      : [],
    people: Array.isArray(raw.people) ? [...new Set(raw.people.filter((x: unknown) => typeof x === 'string' && x.length <= 40) as string[])].slice(0, 20) : [],
    cover: coverPhoto ? { photo: coverPhoto } : coverImage ? { image: coverImage } : null,
    created: Number.isFinite(raw.created) ? raw.created : now,
    updated: Number.isFinite(raw.updated) ? raw.updated : now,
  };
}

/** Coerces untrusted input into a valid Person, or null. */
function normalizePerson(raw: any): Person | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id || raw.id.length > 40) return null;
  const now = Date.now();
  return {
    id: raw.id,
    name: str(raw.name, 120),
    icon: typeof raw.icon === 'string' && /^[te]:[a-z0-9-]+$/.test(raw.icon) ? raw.icon : null,
    relation: str(raw.relation, 60),
    text: str(raw.text),
    emotions: Array.isArray(raw.emotions) ? raw.emotions.filter((x: unknown) => typeof x === 'string' && EMOTION[x]).slice(0, MAX_PERSON_EMOTIONS) : [],
    created: Number.isFinite(raw.created) ? raw.created : now,
    updated: Number.isFinite(raw.updated) ? raw.updated : now,
  };
}
const normalizePeople = (raw: unknown) => (Array.isArray(raw) ? (raw.map(normalizePerson).filter(Boolean) as Person[]).sort(byName) : []);

export async function exportJSON() {
  const entries = entries$.get();
  const photos = await exportPhotos(new Set(entries.flatMap((e) => photosOf(e).map((p) => p.id))));
  return JSON.stringify({ app: 'my-mind', version: 1, exported: new Date().toISOString(), entries, people: people$.get(), photos }, null, 1);
}

/** Merges a backup: newer copies win, nothing is deleted. Returns number of entries added or updated. */
export async function importJSON(text: string) {
  const data = JSON.parse(text);
  const incoming = (Array.isArray(data) ? data : data?.entries ?? []).map(normalize).filter(Boolean) as Entry[];
  const current = new Map(entries$.get().map((e) => [e.id, e]));
  // Restoring an entry deleted here counts as a fresh edit, so it also comes back on synced devices.
  const now = Date.now();
  const changed = incoming
    .filter((e) => !current.has(e.id) || current.get(e.id)!.updated < e.updated)
    .map((e) => (deleted[e.id] >= e.updated ? { ...e, updated: now } : e));
  await importPhotos(data?.photos, new Set(changed.flatMap((e) => photosOf(e).map((p) => p.id))));
  changed.forEach((e) => current.set(e.id, e));
  entries$.set([...current.values()].sort(byNewest));
  await db.putMany(changed);

  const pNow = new Map(people$.get().map((p) => [p.id, p]));
  const pChanged = normalizePeople(data?.people)
    .filter((p) => !pNow.has(p.id) || pNow.get(p.id)!.updated < p.updated)
    .map((p) => (deleted[p.id] >= p.updated ? { ...p, updated: now } : p));
  pChanged.forEach((p) => pNow.set(p.id, p));
  if (pChanged.length) await savePeople([...pNow.values()]);

  if (changed.length || pChanged.length) changeHandler();
  return { changed: changed.length, people: pChanged.length, total: incoming.length, icons: iconsOf([...changed, ...pChanged]) };
}

const iconsOf = (list: { icon: string | null }[]) => [...new Set(list.map((e) => e.icon).filter(Boolean))] as string[];

/**
 * Merges another device's copy: the newest edit of each entry wins, and a deletion wins over edits made before it.
 * Returns the entries that were added or updated here (their photos may still need fetching) and how many were removed.
 */
export async function mergeSynced(raw: { entries?: unknown; people?: unknown; deleted?: unknown }) {
  const incoming = (Array.isArray(raw.entries) ? raw.entries : []).map(normalize).filter(Boolean) as Entry[];
  const gone: Record<string, number> = {};
  if (raw.deleted && typeof raw.deleted === 'object')
    for (const [id, t] of Object.entries(raw.deleted)) if (Number.isFinite(t) && id.length <= 40) gone[id] = t as number;

  const nextDeleted = { ...deleted };
  for (const [id, t] of Object.entries(gone)) if (!(nextDeleted[id] >= t)) nextDeleted[id] = t;
  const current = new Map(entries$.get().map((e) => [e.id, e]));
  const removed = [...current.values()].filter((e) => nextDeleted[e.id] >= e.updated).map((e) => e.id);
  removed.forEach((id) => current.delete(id));
  const changed = incoming.filter((e) => !(nextDeleted[e.id] >= e.updated) && (!current.has(e.id) || current.get(e.id)!.updated < e.updated));
  changed.forEach((e) => current.set(e.id, e));

  // People follow the same rules. Older app versions don't send them: then nothing changes here.
  const pNow = new Map(people$.get().map((p) => [p.id, p]));
  const pRemoved = [...pNow.values()].filter((p) => nextDeleted[p.id] >= p.updated).map((p) => p.id);
  pRemoved.forEach((id) => pNow.delete(id));
  const pChanged = normalizePeople(raw.people).filter((p) => !(nextDeleted[p.id] >= p.updated) && (!pNow.has(p.id) || pNow.get(p.id)!.updated < p.updated));
  pChanged.forEach((p) => pNow.set(p.id, p));

  deleted = nextDeleted;
  if (changed.length || removed.length) entries$.set([...current.values()].sort(byNewest));
  await Promise.all([
    db.putMany(changed), ...removed.map((id) => db.del(id)), db.set('deleted', deleted),
    pChanged.length || pRemoved.length ? savePeople([...pNow.values()]) : null,
  ]);
  return { changed, removed: removed.length, icons: iconsOf([...changed, ...pChanged]) };
}

export async function deleteAll() {
  const ids = [...entries$.get().map((e) => e.id), ...people$.get().map((p) => p.id)];
  entries$.set([]);
  await Promise.all([db.clear(), clearPhotos(), savePeople([]), forget(ids)]);
  changeHandler();
}

/* ---------- settings (small, synchronous → localStorage) ---------- */

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  weekStart: 0 | 1;
  picker: 'grid' | 'wheel';
}
const SETTINGS_KEY = 'mm-settings';
function loadSettings(): Settings {
  let s: Partial<Settings> = {};
  try {
    s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {}
  return { theme: s.theme ?? 'system', weekStart: s.weekStart === 0 ? 0 : 1, picker: s.picker === 'wheel' ? 'wheel' : 'grid' };
}
const settings$ = observable<Settings>(loadSettings());
export const useSettings = settings$.use;
export const getSettings = settings$.get;
export function setSettings(patch: Partial<Settings>) {
  settings$.set({ ...settings$.get(), ...patch });
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings$.get()));
  } catch {}
  applyTheme();
}

const darkMq = matchMedia('(prefers-color-scheme: dark)');
export function applyTheme() {
  const t = settings$.get().theme;
  const dark = t === 'dark' || (t === 'system' && darkMq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141413' : '#fafaf9');
}
darkMq.addEventListener('change', applyTheme);

/* ---------- toasts ---------- */

export interface Toast { id: number; text: string; action?: { label: string; run: () => void } }
const toasts$ = observable<Toast[]>([]);
export const useToasts = toasts$.use;
let toastId = 0;
export function toast(text: string, action?: Toast['action']) {
  const t = { id: ++toastId, text, action };
  toasts$.set([...toasts$.get().slice(-2), t]);
  setTimeout(() => toasts$.set(toasts$.get().filter((x) => x.id !== t.id)), action ? 5000 : 2600);
}
export const dismissToast = (id: number) => toasts$.set(toasts$.get().filter((x) => x.id !== id));
