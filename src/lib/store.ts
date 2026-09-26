import { useEffect, useState } from 'preact/hooks';
import { db } from './db';
import { todayKey } from './dates';
import { EMOTION } from '../data/emotions';

export interface PinImage {
  url: string;
  w?: number;
  h?: number;
  link?: string;
  title?: string;
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
  images: PinImage[];
  music: Music[];
  created: number;
  updated: number;
}

/* ---------- tiny observable ---------- */

function observable<T>(initial: T) {
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
    date: todayKey(), dateEnd: null, time: now, images: [], music: [], created: now, updated: now,
  };
}

export const isEmpty = (e: Entry) => !e.title.trim() && !e.text.trim() && !e.emotions.length && !e.images.length && !e.music.length;

let persistAsked = false;
export async function saveEntry(e: Entry) {
  const next = { ...e, updated: Date.now() };
  const list = entries$.get().filter((x) => x.id !== e.id);
  list.push(next);
  entries$.set(list.sort(byNewest));
  await db.put(next);
  if (!persistAsked) {
    persistAsked = true;
    navigator.storage?.persist?.().catch(() => {});
  }
  return next;
}

export async function deleteEntry(id: string) {
  const removed = entries$.get().find((x) => x.id === id);
  entries$.set(entries$.get().filter((x) => x.id !== id));
  await db.del(id);
  return removed;
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
  const [list, icons] = await Promise.all([db.all<Entry>(), db.get<Record<string, string>>('icons')]);
  entries$.set((list.map(normalize).filter(Boolean) as Entry[]).sort(byNewest));
  icons$.set(icons ?? {});
  ready$.set(true);
}

/* ---------- backup ---------- */

const KEY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 100_000) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Coerces untrusted input (imports) into a valid Entry, or null. */
function normalize(raw: any): Entry | null {
  if (!raw || typeof raw !== 'object' || !KEY.test(raw.date)) return null;
  const now = Date.now();
  return {
    id: str(raw.id, 40) || uid(),
    kind: raw.kind === 'checkin' ? 'checkin' : 'note',
    title: str(raw.title, 300),
    icon: typeof raw.icon === 'string' && /^[te]:[a-z0-9-]+$/.test(raw.icon) ? raw.icon : null,
    text: str(raw.text),
    emotions: Array.isArray(raw.emotions) ? raw.emotions.filter((x: unknown) => typeof x === 'string' && EMOTION[x]).slice(0, 3) : [],
    intensity: Math.min(5, Math.max(1, Math.round(Number(raw.intensity) || 3))),
    date: raw.date,
    dateEnd: KEY.test(raw.dateEnd) && raw.dateEnd > raw.date ? raw.dateEnd : null,
    time: Number.isFinite(raw.time) ? raw.time : now,
    images: Array.isArray(raw.images)
      ? raw.images
          .filter((i: any) => i && /^https:\/\//.test(i.url))
          .map((i: any) => ({ url: str(i.url, 2000), w: +i.w || undefined, h: +i.h || undefined, link: /^https:\/\//.test(i.link) ? str(i.link, 2000) : undefined, title: str(i.title, 300) || undefined }))
          .slice(0, 12)
      : [],
    music: Array.isArray(raw.music)
      ? raw.music
          .filter((m: any) => m && MUSIC_KINDS.includes(m.kind) && /^[A-Za-z0-9]{10,40}$/.test(m.id))
          .map((m: any) => ({
            kind: m.kind, id: m.id, title: str(m.title, 300) || 'Untitled', sub: str(m.sub, 300) || undefined,
            image: /^https:\/\//.test(m.image) ? str(m.image, 2000) : undefined, link: `https://open.spotify.com/${m.kind}/${m.id}`,
          }))
          .slice(0, 20)
      : [],
    created: Number.isFinite(raw.created) ? raw.created : now,
    updated: Number.isFinite(raw.updated) ? raw.updated : now,
  };
}

export function exportJSON() {
  return JSON.stringify({ app: 'my-mind', version: 1, exported: new Date().toISOString(), entries: entries$.get() }, null, 1);
}

/** Merges a backup: newer copies win, nothing is deleted. Returns number of entries added or updated. */
export async function importJSON(text: string) {
  const data = JSON.parse(text);
  const incoming = (Array.isArray(data) ? data : data?.entries ?? []).map(normalize).filter(Boolean) as Entry[];
  const current = new Map(entries$.get().map((e) => [e.id, e]));
  const changed = incoming.filter((e) => !current.has(e.id) || current.get(e.id)!.updated < e.updated);
  changed.forEach((e) => current.set(e.id, e));
  entries$.set([...current.values()].sort(byNewest));
  await db.putMany(changed);
  return { changed: changed.length, total: incoming.length, icons: [...new Set(changed.map((e) => e.icon).filter(Boolean))] as string[] };
}

export async function deleteAll() {
  entries$.set([]);
  await db.clear();
}

/* ---------- settings (small, synchronous → localStorage) ---------- */

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  weekStart: 0 | 1;
}
const SETTINGS_KEY = 'mm-settings';
function loadSettings(): Settings {
  let s: Partial<Settings> = {};
  try {
    s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {}
  return { theme: s.theme ?? 'system', weekStart: s.weekStart === 0 ? 0 : 1 };
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
