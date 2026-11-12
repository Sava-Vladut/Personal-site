// Saved TikToks: the library the downloader keeps in its own container (github.com/Sava-Vladut/tiktok-favorites-viewer),
// reached through the server's admin-only proxy at /api/tiktok/. The videos, thumbnails, stars and the download controls
// all come from there; this file only reads and asks.
import { formatDate } from './dates';

export const BASE = '/api/tiktok/';
export const LIB = BASE + 'library/';

export interface Video {
  id: string;
  url: string;
  favorited_at: string;
  liked: boolean;
  status: 'pending' | 'downloaded' | 'failed' | 'unavailable';
  file: string | null;
  thumb: string | null;
  title: string | null;
  description: string | null;
  author_username: string | null;
  author_name: string | null;
  hashtags: string[] | null;
  music: string | null;
  uploaded_at: string | null;
  duration: number | null;
  views: number | null;
  likes: number | null;
  filesize: number | null;
}

/** A downloaded video, with what the page sorts, groups and searches it by. */
export interface Rec {
  v: Video & { file: string };
  id: string;
  t: number;
  yr: number;
  mon: number;
  user: string;
  tags: string[];
  cap: string;
  hay: string;
}

export interface Library {
  all: Rec[];
  hidden: number;
  authors: Map<string, number>;
  tags: Map<string, number>;
}

export type Access = 'open' | 'locked' | 'down';

export const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pad = (n: number) => String(n).padStart(2, '0');
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function prep(v: Video & { file: string }): Rec {
  const t = Date.parse(v.favorited_at), d = new Date(t);
  const yr = d.getFullYear(), mon = d.getMonth();
  const user = v.author_username || '', tags = v.hashtags || [];
  const cap = v.description || v.title || '';
  // everything a person might type to find this video, in one folded string (dates in English and in the app's language)
  const hay = fold([
    cap, user && '@' + user, v.author_name, tags.map((x) => '#' + x).join(' '), v.music,
    `${yr}-${pad(mon + 1)}-${pad(d.getDate())}`, `${d.getDate()} ${EN_MONTHS[mon]} ${yr}`, EN_MONTHS[mon].slice(0, 3),
    formatDate(d, { day: 'numeric', month: 'long', year: 'numeric' }),
  ].filter(Boolean).join(' '));
  return { v, id: String(v.id), t, yr, mon, user, tags, cap, hay };
}

let opened = false;
/** Whether this device may see the videos: signed in as admin and the downloader's container answering. */
export async function access(): Promise<Access> {
  try {
    const r = await fetch(BASE + 'api/status', { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    opened = r.ok;
    return r.ok ? 'open' : r.status === 403 ? 'locked' : 'down';
  } catch {
    return 'down';
  }
}
/** Signed in and reachable the last time this page asked, so coming back skips the check. */
export const knownOpen = () => opened;

let library: Library | null = null;
let loading: Promise<Library> | null = null;

/** The catalog: only videos that are downloaded show. Kept for the visit, so coming back to the page is instant. */
export function loadLibrary(fresh = false): Promise<Library> {
  if (library && !fresh) return Promise.resolve(library);
  if (!loading) {
    loading = (async () => {
      const res = await fetch(LIB + 'index.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status === 404 ? 'no-library' : 'HTTP ' + res.status);
      const vids: Video[] = (await res.json()).videos || [];
      const all = vids
        .filter((v): v is Video & { file: string } => v.status === 'downloaded' && !!v.file && !isNaN(Date.parse(v.favorited_at)))
        .map(prep);
      const authors = new Map<string, number>(), tags = new Map<string, number>();
      for (const r of all) {
        if (r.user) authors.set(r.user, (authors.get(r.user) || 0) + 1);
        for (const x of r.tags) tags.set(x, (tags.get(x) || 0) + 1);
      }
      library = { all, hidden: vids.length - all.length, authors, tags };
      return library;
    })().finally(() => { loading = null; });
  }
  return loading;
}
export const cachedLibrary = () => library;

/* ---------- stars: kept on the server (library/starred.json), so every device agrees ---------- */

const stars = new Set<string>();
let starsLoaded = false;
export async function loadStars(): Promise<Set<string>> {
  try {
    const r = await fetch(BASE + 'api/stars', { cache: 'no-store' });
    const data = r.ok ? await r.json() : {};
    stars.clear();
    for (const id of Object.keys(data.starred || {})) stars.add(id);
    starsLoaded = true;
  } catch { /* keep what we had */ }
  return stars;
}
export const starSet = () => stars;
export const starsReady = () => starsLoaded;

/** Stars or unstars a video at once; puts it back if the server didn't keep it. */
export async function saveStar(id: string, on: boolean) {
  if (on) stars.add(id); else stars.delete(id);
  try {
    const data = await call('api/star', { id, on });
    if (!data.ok) throw new Error(String(data.error || 'not saved'));
  } catch (e) {
    if (on) stars.delete(id); else stars.add(id);
    throw e;
  }
}

/* ---------- the downloader ---------- */

/** One of the downloader's API calls. A body makes it a POST (a File is sent as it is). */
export async function call(path: string, body?: unknown): Promise<Record<string, any>> {
  const opt: RequestInit & { headers: Record<string, string> } = { headers: { 'X-Requested-With': 'saved-tiktoks' }, cache: 'no-store' };
  if (body !== undefined) {
    opt.method = 'POST';
    if (body instanceof Blob) opt.body = body;
    else { opt.body = JSON.stringify(body); opt.headers['Content-Type'] = 'application/json'; }
  }
  const res = await fetch(BASE + path, opt);
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('HTTP ' + res.status);
  return data;
}

export interface Status {
  state: 'idle' | 'running' | 'stopping' | 'external';
  can_stop?: boolean;
  now: number;
  library: { total: number; downloaded: number; waiting: number; failed: number; unavailable: number };
  sources: { likes: number; likes_only: number };
  settings: { include_likes: boolean; retry_failed: boolean; impersonate: boolean; workers: number; cookies_browser: string };
  run: null | { todo: number; finished: number; started_at: number; ended_at?: number; downloaded: number; failed: number; unavailable: number; exit_code?: number | null; message?: string };
  log: string[];
  events: { kind: 'ok' | 'fail' | 'gone'; id: string; error?: string }[];
}
