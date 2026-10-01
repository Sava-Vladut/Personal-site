import { useEffect, useState } from 'preact/hooks';
import { db } from './db';
import { dropImageLinks, plainText } from './body';
import { isDateKey, todayKey } from './dates';
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
export type Cover = ({ photo: Photo } | { image: WebImage }) & { crop?: Crop };

/**
 * How a cover sits in its box: the picture's point (0–1 across and down) that stays at the same place in the box,
 * and how far it's zoomed in (1 = just fills the box). Works for any box shape, so one crop fits every place it's shown.
 */
export interface Crop { x: number; y: number; zoom: number }
export const MAX_ZOOM = 4;

/** Where you were: rounded to about 100 m, with a short name like "Centru, Cluj-Napoca" ('' until it's looked up). */
export interface Place { lat: number; lon: number; name: string }

/** The weather on an entry's day, from Open-Meteo. */
export interface Weather {
  day: string;              // the day it describes; an entry moved to another day waits for that day's weather
  code: number;             // WMO weather code
  temp: number;             // °C at the time, or the day's high
  daylight: number;         // hours between sunrise and sunset
  dark?: boolean;           // whether it was dark out at the time, when that's known
}

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
  pinned: boolean;          // kept at the top of the journal
  place: Place | null;
  weather: Weather | null;
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

export type BookStatus = 'want' | 'reading' | 'read' | 'dnf';
/** A book on your shelf: found through Open Library (or typed in), rated, and mentioned in notes as [[book:id|Title]]. */
export interface Book {
  id: string;
  title: string;
  authors: string;          // 'Ursula K. Le Guin, …'
  year: number | null;      // first published
  pages: number | null;
  cover: string | null;     // https image
  olid: string | null;      // Open Library work, '/works/OL27448W'
  status: BookStatus;
  rating: number;           // 0 (not rated) to 5
  started: string | null;   // 'YYYY-MM-DD'
  finished: string | null;
  page: number | null;      // how far in, while reading
  text: string;             // your thoughts on it
  emotions: string[];       // how it made you feel, first one is the main feeling
  from: string | null;      // the person you're thinking of
  created: number;
  updated: number;
}
export const BOOK_STATUSES: BookStatus[] = ['reading', 'want', 'read', 'dnf'];

/** Music you keep: a song, album, playlist or podcast from Spotify, rated and written about like a book. */
export interface Song {
  id: string;
  music: Music;             // what it is on Spotify
  repeat: boolean;          // on repeat lately
  rating: number;           // 0 (not rated) to 5
  text: string;             // what it means to you
  emotions: string[];       // how it makes you feel, first one is the main feeling
  from: string | null;      // the person it brings to mind
  created: number;
  updated: number;
}

/* ---------- tiny observable ---------- */

export function observable<T>(initial: T) {
  let value = initial;
  let revision = 0;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      revision++;
      subs.forEach((f) => f());
    },
    use(): T {
      const renderedRevision = revision;
      const [, force] = useState(0);
      useEffect(() => {
        const f = () => force((n) => n + 1);
        subs.add(f);
        // Updates between render and this effect would otherwise be missed until a later change.
        if (revision !== renderedRevision) f();
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
    date: todayKey(), dateEnd: null, time: now, images: [], photos: [], music: [], people: [], cover: null, pinned: false, place: null, weather: null,
    created: now, updated: now,
  };
}

/** Every photo a note uses: those in its text and its cover. */
export const photosOf = (e: Entry) => (e.cover && 'photo' in e.cover ? [...e.photos, e.cover.photo] : e.photos);

export const isEmpty = (e: Entry) => !e.title.trim() && !plainText(e.text).trim() && !e.emotions.length && !e.images.length && !e.photos.length && !e.music.length && !e.people.length && !e.cover;

/** Told about every change made on this device (sync uses it to know there's something to send). */
let changeHandler = () => {};
export const onLocalChange = (f: () => void) => void (changeHandler = f);

let persistAsked = false;
const pendingPrevious = new WeakMap<Entry, Entry | undefined>();
const failedWrites = new WeakSet<Entry>();
export async function saveEntry(e: Entry) {
  const previous = entries$.get().find((x) => x.id === e.id);
  const next = { ...e, updated: Math.max(Date.now(), e.updated + 1, (previous?.updated ?? 0) + 1, (deleted[e.id] ?? 0) + 1) };
  const list = entries$.get().filter((x) => x.id !== e.id);
  list.push(next);
  entries$.set(list.sort(byNewest));
  pendingPrevious.set(next, previous);
  try {
    await db.put(next);
  } catch (error) {
    failedWrites.add(next);
    // Only roll back this edit: a later edit of the same note may already be visible.
    if (entries$.get().find((x) => x.id === e.id) === next) {
      const remaining = entries$.get().filter((x) => x.id !== e.id);
      let restored = previous;
      while (restored && failedWrites.has(restored)) restored = pendingPrevious.get(restored);
      if (restored) remaining.push(restored);
      entries$.set(remaining.sort(byNewest));
    }
    throw error;
  }
  pendingPrevious.delete(next);
  changeHandler();
  if (!persistAsked) {
    persistAsked = true;
    navigator.storage?.persist?.().catch(() => {});
  }
  return next;
}

/**
 * Adds details worked out afterwards (a day's weather) without counting as an edit: `updated` stays, so this can never
 * win over an edit made on another device, and other devices fill in their own copy the same way.
 */
export async function annotateEntries(patches: Map<string, Partial<Entry>>) {
  const changed: Entry[] = [];
  const list = entries$.get().map((e) => {
    const p = patches.get(e.id);
    if (!p) return e;
    const next = { ...e, ...p, updated: e.updated };
    changed.push(next);
    return next;
  });
  if (!changed.length) return;
  entries$.set(list);
  await db.putMany(changed);
}

export async function deleteEntry(id: string) {
  const removed = entries$.get().find((x) => x.id === id);
  entries$.set(entries$.get().filter((x) => x.id !== id));
  await Promise.all([db.del(id), forget([id], Math.max(Date.now(), removed?.updated ?? 0))]);
  changeHandler();
  return removed;
}

/* ---------- collections: people and books ----------
   Each is one list in the database. Saving merges into what's stored (newest edit of each wins), so two tabs
   can't overwrite each other's changes, and the other tabs are told to reload it. */

function collection<T extends { id: string; updated: number }>(key: string, normalizeOne: (raw: any) => T | null, order: (a: T, b: T) => number) {
  const list$ = observable<T[]>([]);
  const normalizeAll = (raw: unknown) => newestById(Array.isArray(raw) ? raw.map(normalizeOne).filter((x): x is T => !!x) : []).sort(order);
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('my-mind-' + key);
  channel?.addEventListener('message', () => {
    Promise.all([db.get(key), db.get<Record<string, number>>('deleted')]).then(([saved, gone]) => {
      list$.set(normalizeAll(saved));
      deleted = combineDeleted(deleted, gone ?? {});
      changeHandler();
    }).catch(() => {}); // A later notification or reload can retry a failed read.
  });
  const write = async (changes: T[], removed: Record<string, number> = {}, clear = false, broadcast = true, fresh = false) => {
    const list = await db.update<T[]>(key, (saved) => {
      const current = new Map((clear ? [] : normalizeAll(saved)).map((x) => [x.id, x]));
      for (const [id, time] of Object.entries(removed)) {
        const item = current.get(id);
        if (item && item.updated <= time) current.delete(id);
      }
      changes.forEach((x) => {
        const next = fresh ? { ...x, updated: Math.max(Date.now(), x.updated + 1, (current.get(x.id)?.updated ?? 0) + 1, (deleted[x.id] ?? 0) + 1) } : x;
        if (!current.has(next.id) || current.get(next.id)!.updated <= next.updated) current.set(next.id, next);
      });
      return [...current.values()].sort(order);
    });
    list$.set(list);
    if (broadcast) channel?.postMessage(null);
    return list;
  };
  const save = async (x: T) => {
    const list = await write([x], {}, false, true, true);
    changeHandler();
    return list.find((item) => item.id === x.id)!;
  };
  const remove = async (id: string) => {
    let removed = list$.get().find((x) => x.id === id);
    let time = Math.max(Date.now(), removed?.updated ?? 0);
    // Include pending saves and edits from other tabs in the deletion's timestamp. Unlike
    // a remote deletion, this is a fresh local action and must remove the currently stored copy.
    const list = await db.update<T[]>(key, (saved) => normalizeAll(saved).filter((item) => {
      if (item.id !== id) return true;
      time = Math.max(time, item.updated);
      removed = item;
      return false;
    }));
    list$.set(list);
    await forget([id], time);
    channel?.postMessage(null);
    changeHandler();
    return removed;
  };
  /** Merges another copy (a backup or a synced device) — `restore`: a deleted item comes back as a fresh edit. */
  const merge = (raw: unknown, gone: Record<string, number>, restore: boolean) => {
    const now = new Map(list$.get().map((x) => [x.id, x]));
    const removed = restore ? [] : [...now.values()].filter((x) => gone[x.id] >= x.updated).map((x) => x.id);
    removed.forEach((id) => now.delete(id));
    const stamp = Date.now();
    const changed = normalizeAll(raw)
      .filter((x) => (restore || !(gone[x.id] >= x.updated)) && (!now.has(x.id) || now.get(x.id)!.updated < x.updated))
      .map((x) => (restore && gone[x.id] >= x.updated ? { ...x, updated: Math.max(stamp, gone[x.id] + 1) } : x));
    return { changed, removed };
  };
  return { key, list$, normalizeAll, write, save, remove, merge, channel };
}

const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
const people = collection<Person>('people', (raw) => normalizePerson(raw), byName);
export const usePeople = people.list$.use;
export const getPeople = people.list$.get;

export function blankPerson(name = ''): Person {
  const now = Date.now();
  return { id: uid(), name, icon: null, relation: '', text: '', emotions: [], created: now, updated: now };
}
export const savePerson = people.save;
/** Deletes a person. Notes they were tagged in stay; the tag just stops showing. */
export const deletePerson = people.remove;

const byTitle = (a: Book, b: Book) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
const books = collection<Book>('books', (raw) => normalizeBook(raw), byTitle);
export const useBooks = books.list$.use;
export const getBooks = books.list$.get;

export function blankBook(patch: Partial<Book> = {}): Book {
  const now = Date.now();
  return {
    id: uid(), title: '', authors: '', year: null, pages: null, cover: null, olid: null, status: 'want', rating: 0,
    started: null, finished: null, page: null, text: '', emotions: [], from: null, created: now, updated: now, ...patch,
  };
}
export const saveBook = books.save;
/** Deletes a book. Notes that mention it keep the mention's title. */
export const deleteBook = books.remove;

const byAdded = (a: Song, b: Song) => b.created - a.created;
const songs = collection<Song>('songs', (raw) => normalizeSong(raw), byAdded);
export const useSongs = songs.list$.use;
export const getSongs = songs.list$.get;

export function blankSong(music: Music, patch: Partial<Song> = {}): Song {
  const now = Date.now();
  return { id: uid(), music, repeat: false, rating: 0, text: '', emotions: [], from: null, created: now, updated: now, ...patch };
}
export const saveSong = songs.save;
/** Takes music out of your collection. Notes it's attached to keep it. */
export const deleteSong = songs.remove;
/** The kept copy of a piece of music, if it's in your collection. */
export const findSong = (list: Song[], m: Pick<Music, 'kind' | 'id'>) => list.find((x) => x.music.kind === m.kind && x.music.id === m.id);

type Collection = ReturnType<typeof collection<any>>;
const COLLECTIONS: Collection[] = [people, books, songs];

/* ---------- deletions: remembered (id → when) so a synced device doesn't bring the entry back ---------- */

let deleted: Record<string, number> = Object.create(null);
export const getDeleted = () => deleted;

function combineDeleted(a: Record<string, number>, b: Record<string, number>) {
  const merged: Record<string, number> = Object.assign(Object.create(null), a);
  if (b && typeof b === 'object' && !Array.isArray(b))
    for (const [id, time] of Object.entries(b))
      if (id.length <= 40 && Number.isFinite(time) && time >= 0 && !(merged[id] >= time)) merged[id] = time;
  return merged;
}

async function persistDeleted() {
  const changes = deleted;
  deleted = await db.update<Record<string, number>>('deleted', (saved) => combineDeleted(saved ?? {}, changes));
}

async function forget(ids: string[], now = Date.now()) {
  deleted = Object.assign(Object.create(null), deleted);
  ids.forEach((id) => (deleted[id] = Math.max(deleted[id] ?? 0, now)));
  await persistDeleted();
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
  const [list, icons, gone, ...saved] = await Promise.all([
    db.all<Entry>(), db.get<Record<string, string>>('icons'), db.get<Record<string, number>>('deleted'), ...COLLECTIONS.map((c) => db.get<unknown[]>(c.key)),
  ]);
  entries$.set(newestById(list.map(normalize).filter(Boolean) as Entry[]).sort(byNewest));
  COLLECTIONS.forEach((c, i) => c.list$.set(c.normalizeAll(saved[i])));
  icons$.set(icons ?? {});
  deleted = combineDeleted(Object.create(null), gone ?? {});
  ready$.set(true);
  prunePhotos(new Set(entries$.get().flatMap((e) => photosOf(e).map((p) => p.id)))).catch(() => {});
}

/* ---------- backup ---------- */

const str = (v: unknown, max = 100_000) => (typeof v === 'string' ? v.slice(0, max) : '');
const dimension = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
const normalizeEmotions = (raw: unknown, max: number) => Array.isArray(raw)
  ? [...new Set(raw.filter((id): id is string => typeof id === 'string' && Object.hasOwn(EMOTION, id)))].slice(0, max)
  : [];

/** Duplicate records in a backup or remote copy must never let an older edit win. */
function newestById<T extends { id: string; updated: number }>(list: T[]): T[] {
  const newest = new Map<string, T>();
  for (const item of list) if (!newest.has(item.id) || newest.get(item.id)!.updated <= item.updated) newest.set(item.id, item);
  return [...newest.values()];
}

const webImage = (i: any): WebImage | null =>
  i && /^https:\/\//.test(i.url)
    ? {
        url: str(i.url, 2000),
        thumb: /^https:\/\//.test(i.thumb) ? str(i.thumb, 2000) : undefined,
        w: dimension(i.w),
        h: dimension(i.h),
        link: /^https:\/\//.test(i.link) ? str(i.link, 2000) : undefined,
        title: str(i.title, 300) || undefined,
        credit: str(i.credit, 300) || undefined,
      }
    : null;
const photo = (p: any): Photo | null =>
  p && typeof p.id === 'string' && PHOTO_ID.test(p.id) ? { id: p.id, w: dimension(p.w) ?? 1, h: dimension(p.h) ?? 1 } : null;

const unit = (v: unknown) => Math.min(1, Math.max(0, Number(v)));
const crop = (c: any): Crop | null =>
  c && [c.x, c.y, c.zoom].every(Number.isFinite) ? { x: unit(c.x), y: unit(c.y), zoom: Math.min(MAX_ZOOM, Math.max(1, +c.zoom)) } : null;

const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

export function normalizePlace(p: any): Place | null {
  const lat = num(p?.lat, -90, 90), lon = num(p?.lon, -180, 180);
  return lat === null || lon === null ? null : { lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000, name: str(p.name, 120) };
}

export function normalizeWeather(w: any): Weather | null {
  const code = num(w?.code, 0, 99), temp = num(w?.temp, -90, 60), daylight = num(w?.daylight, 0, 24);
  if (!w || !isDateKey(w.day) || code === null || temp === null || daylight === null) return null;
  return { day: w.day, code: Math.round(code), temp: Math.round(temp * 10) / 10, daylight: Math.round(daylight * 100) / 100, ...(typeof w.dark === 'boolean' ? { dark: w.dark } : {}) };
}

function normalizeMusic(m: any): Music | null {
  if (!m || !MUSIC_KINDS.includes(m.kind) || !/^[A-Za-z0-9]{10,40}$/.test(m.id)) return null;
  return {
    kind: m.kind, id: m.id, title: str(m.title, 300) || 'Untitled', sub: str(m.sub, 300) || undefined,
    image: /^https:\/\//.test(m.image) ? str(m.image, 2000) : undefined, link: `https://open.spotify.com/${m.kind}/${m.id}`,
  };
}

/** Coerces untrusted input (imports) into a valid Entry, or null. */
function normalize(raw: any): Entry | null {
  if (!raw || typeof raw !== 'object' || !isDateKey(raw.date)) return null;
  const now = Date.now();
  const images: WebImage[] = Array.isArray(raw.images) ? raw.images.map(webImage).filter(Boolean).slice(0, 12) : [];
  const coverPhoto = photo(raw.cover?.photo);
  const coverImage = webImage(raw.cover?.image);
  const coverPic: Cover | null = coverPhoto ? { photo: coverPhoto } : coverImage ? { image: coverImage } : null;
  const coverCrop = crop(raw.cover?.crop);
  return {
    id: str(raw.id, 40) || uid(),
    kind: raw.kind === 'checkin' ? 'checkin' : 'note',
    title: str(raw.title, 300),
    icon: typeof raw.icon === 'string' && /^[te]:[a-z0-9-]+$/.test(raw.icon) ? raw.icon : null,
    text: dropImageLinks(typeof raw.text === 'string' ? raw.text : '', images),
    emotions: normalizeEmotions(raw.emotions, 3),
    intensity: Math.min(5, Math.max(1, Math.round(Number(raw.intensity) || 3))),
    date: raw.date,
    dateEnd: isDateKey(raw.dateEnd) && raw.dateEnd > raw.date ? raw.dateEnd : null,
    time: Number.isFinite(raw.time) ? raw.time : now,
    images,
    photos: Array.isArray(raw.photos) ? raw.photos.map(photo).filter(Boolean).slice(0, 20) : [],
    music: Array.isArray(raw.music) ? (raw.music.map(normalizeMusic).filter(Boolean) as Music[]).slice(0, 20) : [],
    people: Array.isArray(raw.people) ? [...new Set(raw.people.filter((x: unknown) => typeof x === 'string' && x.length <= 40) as string[])].slice(0, 20) : [],
    cover: coverPic && (coverCrop ? { ...coverPic, crop: coverCrop } : coverPic),
    pinned: raw.kind !== 'checkin' && raw.pinned === true,
    place: normalizePlace(raw.place),
    weather: normalizeWeather(raw.weather),
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
    text: typeof raw.text === 'string' ? raw.text : '',
    emotions: normalizeEmotions(raw.emotions, MAX_PERSON_EMOTIONS),
    created: Number.isFinite(raw.created) ? raw.created : now,
    updated: Number.isFinite(raw.updated) ? raw.updated : now,
  };
}

const httpsUrl = (v: unknown) => (typeof v === 'string' && /^https:\/\//.test(v) ? v.slice(0, 2000) : null);
const dayOrNull = (v: unknown) => (isDateKey(v) ? v : null);
const intOrNull = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : null);

/** Coerces untrusted input into a valid Book, or null. */
function normalizeBook(raw: any): Book | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id || raw.id.length > 40) return null;
  const now = Date.now();
  return {
    id: raw.id,
    title: str(raw.title, 300),
    authors: str(raw.authors, 300),
    year: intOrNull(raw.year, 9999),
    pages: intOrNull(raw.pages, 100_000),
    cover: httpsUrl(raw.cover),
    olid: typeof raw.olid === 'string' && /^\/works\/OL\d+W$/.test(raw.olid) ? raw.olid : null,
    status: BOOK_STATUSES.includes(raw.status) ? raw.status : 'want',
    rating: Math.min(5, Math.max(0, Math.round(Number(raw.rating) || 0))),
    started: dayOrNull(raw.started),
    finished: dayOrNull(raw.finished),
    page: intOrNull(raw.page, 100_000),
    text: typeof raw.text === 'string' ? raw.text : '',
    emotions: normalizeEmotions(raw.emotions, MAX_PERSON_EMOTIONS),
    from: typeof raw.from === 'string' && raw.from.length <= 40 ? raw.from : null,
    created: Number.isFinite(raw.created) ? raw.created : now,
    updated: Number.isFinite(raw.updated) ? raw.updated : now,
  };
}

/** Coerces untrusted input into a valid Song, or null. */
function normalizeSong(raw: any): Song | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id || raw.id.length > 40) return null;
  const music = normalizeMusic(raw.music);
  if (!music) return null;
  const now = Date.now();
  return {
    id: raw.id,
    music,
    repeat: raw.repeat === true,
    rating: Math.min(5, Math.max(0, Math.round(Number(raw.rating) || 0))),
    text: typeof raw.text === 'string' ? raw.text : '',
    emotions: normalizeEmotions(raw.emotions, MAX_PERSON_EMOTIONS),
    from: typeof raw.from === 'string' && raw.from.length <= 40 ? raw.from : null,
    created: Number.isFinite(raw.created) ? raw.created : now,
    updated: Number.isFinite(raw.updated) ? raw.updated : now,
  };
}

export async function exportJSON() {
  const entries = entries$.get();
  const photos = await exportPhotos(new Set(entries.flatMap((e) => photosOf(e).map((p) => p.id))));
  return JSON.stringify({ app: 'my-mind', version: 1, exported: new Date().toISOString(), entries, people: getPeople(), books: getBooks(), songs: getSongs(), photos }, null, 1);
}

/** Merges a backup: newer copies win, nothing is deleted. Returns number of entries added or updated. */
export async function importJSON(text: string) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || (!Array.isArray(data) && data.entries !== undefined && !Array.isArray(data.entries)))
    throw new Error('This backup does not contain a valid journal.');
  const incoming = newestById((Array.isArray(data) ? data : data.entries ?? []).map(normalize).filter(Boolean) as Entry[]);
  // Photos can be missing even when the note itself is already up to date. Read the current
  // journal afterwards, so edits made while those photos are loading are kept.
  const restoredPhotos = await importPhotos(data?.photos, new Set(incoming.flatMap((e) => photosOf(e).map((p) => p.id))));
  const current = new Map(entries$.get().map((e) => [e.id, e]));
  // Restoring an entry deleted here counts as a fresh edit, so it also comes back on synced devices.
  const now = Date.now();
  const changed = incoming
    .filter((e) => !current.has(e.id) || current.get(e.id)!.updated < e.updated)
    .map((e) => (deleted[e.id] >= e.updated ? { ...e, updated: Math.max(now, deleted[e.id] + 1) } : e));
  changed.forEach((e) => current.set(e.id, e));
  entries$.set([...current.values()].sort(byNewest));
  await db.putMany(changed);

  const merged = COLLECTIONS.map((c) => c.merge(data?.[c.key], deleted, true).changed);
  await Promise.all(COLLECTIONS.map((c, i) => merged[i].length && c.write(merged[i])));
  const [pChanged, bChanged, sChanged] = merged;

  if (changed.length || pChanged.length || bChanged.length || sChanged.length || restoredPhotos) changeHandler();
  return {
    changed: changed.length, people: pChanged.length, books: bChanged.length, songs: sChanged.length, photos: restoredPhotos, total: incoming.length,
    icons: iconsOf([...changed, ...pChanged]),
  };
}

const iconsOf = (list: { icon: string | null }[]) => [...new Set(list.map((e) => e.icon).filter(Boolean))] as string[];

/**
 * Merges another device's copy: the newest edit of each entry wins, and a deletion wins over edits made before it.
 * Returns the entries that were added or updated here (their photos may still need fetching) and how many were removed.
 */
export async function mergeSynced(raw: { entries?: unknown; people?: unknown; books?: unknown; songs?: unknown; deleted?: unknown }) {
  const incoming = newestById((Array.isArray(raw.entries) ? raw.entries : []).map(normalize).filter(Boolean) as Entry[]);
  const nextDeleted = combineDeleted(deleted, raw.deleted as Record<string, number>);
  const current = new Map(entries$.get().map((e) => [e.id, e]));
  const removed = [...current.values()].filter((e) => nextDeleted[e.id] >= e.updated).map((e) => e.id);
  removed.forEach((id) => current.delete(id));
  const changed = incoming.filter((e) => !(nextDeleted[e.id] >= e.updated) && (!current.has(e.id) || current.get(e.id)!.updated < e.updated));
  changed.forEach((e) => current.set(e.id, e));

  // People, books and songs follow the same rules. Older app versions don't send them: then nothing changes here.
  const merged = COLLECTIONS.map((c) => ({ c, ...c.merge(raw[c.key as 'people' | 'books' | 'songs'], nextDeleted, false) }));

  deleted = nextDeleted;
  if (changed.length || removed.length) entries$.set([...current.values()].sort(byNewest));
  await Promise.all([
    db.putMany(changed), ...removed.map((id) => db.del(id)), persistDeleted(),
    ...merged.map((m) => (m.changed.length || m.removed.length ? m.c.write(m.changed, Object.fromEntries(m.removed.map((id) => [id, nextDeleted[id]])), false, false) : null)),
  ]);
  merged.forEach((m) => (m.changed.length || m.removed.length) && m.c.channel?.postMessage(null));
  return { changed, removed: removed.length, icons: iconsOf([...changed, ...merged[0].changed]) };
}

export async function deleteAll() {
  const records: { id: string; updated: number }[] = [...entries$.get(), ...COLLECTIONS.flatMap((c) => c.list$.get())];
  const ids = records.map((record) => record.id);
  const stamp = records.reduce((latest, record) => Math.max(latest, record.updated), Date.now());
  entries$.set([]);
  await Promise.all([db.clear(), clearPhotos(), ...COLLECTIONS.map((c) => c.write([], {}, true, false)), forget(ids, stamp)]);
  COLLECTIONS.forEach((c) => c.channel?.postMessage(null));
  changeHandler();
}

/* ---------- settings (small, synchronous → localStorage) ---------- */

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  weekStart: 0 | 1;
  picker: 'grid' | 'wheel';
  density: 'cards' | 'compact';
  weather: boolean;         // add the weather to entries
  places: boolean;          // save where you are with new entries
  home: Place | null;       // the weather's place when yours isn't saved, and for older entries
}
const SETTINGS_KEY = 'mm-settings';
function loadSettings(): Settings {
  let s: Partial<Settings> = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) s = parsed;
  } catch {}
  return {
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system', weekStart: s.weekStart === 0 ? 0 : 1, picker: s.picker === 'wheel' ? 'wheel' : 'grid', density: s.density === 'compact' ? 'compact' : 'cards',
    weather: s.weather === true, places: s.places === true, home: normalizePlace(s.home),
  };
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
