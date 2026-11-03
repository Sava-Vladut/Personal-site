// Chat logs (views/ChatLogs.tsx): what one Twitch user wrote in one channel's chat, from server/chatlogs.js, which
// reads the public log archives, the last day of chat, and the channels recorded on this server.
import { useEffect, useState } from 'preact/hooks';
import { t } from './i18n';

export interface TwitchUser { login: string; id: string; name: string; logo: string | null; banned: boolean; color: string | null }
export interface Lookup {
  channel: TwitchUser;
  user: TwitchUser;
  /** archives that hold this user in this channel, and which months (YYYY-MM) */
  sources: { host: string; months: string[] }[];
  /** an archive logs the channel but this user asked to be left out */
  optedOut: boolean;
  /** the channel is recorded on this server, since then */
  recorded: { since: number } | null;
  recordedDays: number;
  /** their lines in the last day of the channel's chat */
  lately: number;
  /** every month with something in it, oldest first */
  months: string[];
}
/** One line: when (ms), user id, login, display name, colour, text, kind. */
export interface Line { t: number; i: string; u: string; n: string; c: string; m: string; k: 'msg' | 'me' | 'ban' | 'sub' }
export interface Month { month: string; total: number; messages: Line[]; sources: string[] }
export interface Activity { year: number; days: Record<string, number>; total: number }
export interface Found { q: string; year: number; messages: Line[]; more: boolean }
export interface Watched { login: string; id: string; name: string; since: number; days: number; bytes: number; today: number; last: number | null }
export interface WatchList { watched: Watched[]; connected: boolean; admin: boolean; max: number }

const TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
})();

async function call<T>(path: string, method = 'GET'): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, { method, signal: AbortSignal.timeout(90_000) });
  } catch {
    throw new Error(t('Couldn’t reach the server. Check your connection.'));
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || t('Something went wrong on the server.'));
  return body as T;
}

const qs = (o: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();

export const lookup = (channel: string, user: string, fresh = false) => call<Lookup>(`/api/chatlogs/lookup?${qs({ channel, user, fresh: fresh ? 1 : undefined })}`);
export const loadMonth = (channel: string, user: string, month: string) => call<Month>(`/api/chatlogs/month?${qs({ channel, user, month })}`);
export const loadActivity = (channel: string, user: string, year: number) => call<Activity>(`/api/chatlogs/activity?${qs({ channel, user, year, tz: TZ })}`);
export const search = (channel: string, user: string, year: number, q: string) => call<Found>(`/api/chatlogs/search?${qs({ channel, user, year, q })}`);
export const watchList = () => call<WatchList>('/api/chatlogs/watch');
export const watch = (channel: string) => call<WatchList>(`/api/chatlogs/watch?${qs({ channel })}`, 'POST');
export const unwatch = (channel: string, keep: boolean) => call<WatchList>(`/api/chatlogs/watch/${channel}?${qs({ keep: keep ? 1 : 0 })}`, 'DELETE');

export type Got<T> = { data: T | null; error: string | null; loading: boolean };

/** Run `work` whenever `key` changes (null: nothing to load); the last answer stays while the next one loads. */
export function useLoad<T>(key: string | null, work: () => Promise<T>): Got<T> {
  const [got, setGot] = useState<Got<T> & { key: string | null }>({ data: null, error: null, loading: !!key, key: null });
  useEffect(() => {
    if (!key) return setGot({ data: null, error: null, loading: false, key });
    let live = true;
    setGot((g) => ({ ...g, error: null, loading: true }));
    work().then(
      (data) => live && setGot({ data, error: null, loading: false, key }),
      (e: Error) => live && setGot({ data: null, error: e.message, loading: false, key }),
    );
    return () => { live = false; };
  }, [key]);
  return got;
}

/* ---------- recent lookups, on this device ---------- */

const RECENT_KEY = 'mm-chatlogs-recent';
export type Pair = { channel: string; user: string };

export function recentPairs(): Pair[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((p) => p && typeof p.channel === 'string' && typeof p.user === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function rememberPair(p: Pair) {
  const list = [p, ...recentPairs().filter((x) => x.channel !== p.channel || x.user !== p.user)].slice(0, 8);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
  return list;
}

/** A login, link or @name as a Twitch login; '' when it isn't one. */
export function cleanLogin(s: string) {
  const n = s.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.|m\.)?twitch\.tv\//i, '').replace(/[/?#].*$/, '').toLowerCase();
  return /^[a-z0-9_]{2,25}$/.test(n) ? n : '';
}

/** Where a line came from, in words. */
export const sourceName = (s: string) => (s === 'here' ? t('Recorded here') : s === 'lately' ? t('Last 24 hours') : s);
