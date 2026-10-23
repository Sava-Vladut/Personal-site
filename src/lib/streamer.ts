// Streamer stats: a Twitch channel's broadcasts from the server (server/streamers.js), and what they add up to
// over a range of days, worked out here so switching the range doesn't ask the server again. Times are the
// viewer's own: a day is a local day and the hours are local hours.
import { useEffect, useState } from 'preact/hooks';
import { keyOf, timeLabel } from './dates';
import { LOCALE, t } from './i18n';

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface Stream {
  start: number;
  end: number;
  title: string;
  /** the VOD's id, while Twitch keeps it */
  vod?: string;
  live?: boolean;
  /** [game id ('' for none), ms from the start, length in ms], in order */
  segs: [string, number, number][];
  /** viewers, when the server recorded this stream */
  avg?: number;
  peak?: number;
  /** [minutes from the start, viewers] */
  curve?: [number, number][];
}
export interface Summary { avg: number | null; peak: number | null; hoursWatched: number | null; minutes: number | null; followers: number | null; rank: number | null }
export interface Streamer {
  login: string;
  name: string;
  avatar: string | null;
  bio: string;
  createdAt: number | null;
  followers: number | null;
  partner: boolean;
  affiliate: boolean;
  language: string | null;
  live: { title: string; game: string | null; box: string | null; viewers: number; since: number } | null;
  /** one of the points miner's channels */
  mining: boolean;
  now: number;
  /** since when the server has been recording this channel's viewers */
  recordingSince: number | null;
  /** Twitch wouldn't list the VODs this time */
  vodsMissing: boolean;
  /** newest first */
  streams: Stream[];
  /** game id → [name, box art] */
  games: Record<string, [string, string | null]>;
  /** [midnight UTC, followers] */
  followerDays: [number, number][];
  /** TwitchTracker's last 30 days */
  summary: Summary | null;
}
export interface Choice { login: string; name: string; live: { game: string | null; viewers: number } | null; mining: boolean }

async function get<T>(path: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, { signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new Error(t('Couldn’t reach the server. Check your connection.'));
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || t('Something went wrong on the server.'));
  return body as T;
}

type Got<T> = { data: T | null; error: string | null; loading: boolean };

// a channel looked at a minute ago shows straight away, and is fetched again behind it
const cache = new Map<string, { at: number; data: Streamer }>();
const FRESH = 60_000;

/** Drop what's kept of a channel, so the next look asks the server again. */
export const forget = (login: string) => cache.delete(login);

/** A channel's report; changing `again` (after forget()) fetches it anew. */
export function useStreamer(login: string | null, again = 0): Got<Streamer> {
  const hit = login ? cache.get(login) : undefined;
  const [s, setS] = useState<Got<Streamer>>({ data: hit?.data ?? null, error: null, loading: !!login });
  useEffect(() => {
    if (!login) return setS({ data: null, error: null, loading: false });
    const had = cache.get(login);
    if (had && Date.now() - had.at < FRESH) return setS({ data: had.data, error: null, loading: false });
    setS({ data: had?.data ?? null, error: null, loading: true });
    let alive = true;
    get<Streamer>(`/api/streamers/${encodeURIComponent(login)}`).then(
      (data) => {
        cache.set(login, { at: Date.now(), data });
        if (alive) setS({ data, error: null, loading: false });
      },
      (e: Error) => alive && setS({ data: had?.data ?? null, error: e.message, loading: false }),
    );
    return () => void (alive = false);
  }, [login, again]);
  return s;
}

/** The channels to offer: the miner's, then the ones looked up lately. */
export function useChoices(again = 0): Got<Choice[]> {
  const [s, setS] = useState<Got<Choice[]>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    get<{ channels: Choice[] }>('/api/streamers').then(
      (r) => alive && setS({ data: r.channels, error: null, loading: false }),
      (e: Error) => alive && setS((p) => ({ data: p.data, error: e.message, loading: false })),
    );
    return () => void (alive = false);
  }, [again]);
  return s;
}

/* ---------- what it adds up to ---------- */

/** The games given a colour: the five streamed most over everything loaded, so a colour stays with its game whatever the range. */
export const PALETTE = ['sadness', 'hope-interest', 'calm-safety', 'joy', 'love-connection'];
export function gameColors(streams: Stream[]) {
  const ms = new Map<string, number>();
  for (const s of streams) for (const [g, , d] of s.segs) if (g) ms.set(g, (ms.get(g) ?? 0) + d);
  const top = [...ms].sort((a, b) => b[1] - a[1]).slice(0, PALETTE.length).map(([g]) => g);
  return new Map(top.map((g, i) => [g, PALETTE[i]]));
}

/** A stream's games as pieces of time, cut to [from, to). */
function pieces(s: Stream, from: number, to: number) {
  const out: { game: string; a: number; b: number }[] = [];
  for (const [game, at, d] of s.segs) {
    const a = Math.max(from, s.start + at), b = Math.min(to, s.start + at + d);
    if (b > a) out.push({ game, a, b });
  }
  return out;
}

/** Calls f for each local day (or hour) a stretch of time touches, with the part of it in that day (or hour). */
function split(a: number, b: number, unit: 'day' | 'hour', f: (at: Date, ms: number) => void) {
  while (a < b) {
    const d = new Date(a);
    if (unit === 'day') d.setHours(24, 0, 0, 0);
    else d.setMinutes(60, 0, 0);
    const next = Math.min(b, d.getTime());
    f(new Date(a), next - a);
    a = next;
  }
}

/** The time of day most of a set of times fall around, on a 24-hour clock (so 23:00 and 01:00 average to midnight). */
function usualTime(times: number[]) {
  if (!times.length) return null;
  let x = 0, y = 0;
  for (const ms of times) {
    const d = new Date(ms);
    const a = ((d.getHours() * 60 + d.getMinutes()) / 1440) * 2 * Math.PI;
    x += Math.cos(a);
    y += Math.sin(a);
  }
  // spread out over the whole day, there's no usual time
  if (Math.hypot(x, y) / times.length < 0.35) return null;
  const m = Math.round((((Math.atan2(y, x) / (2 * Math.PI)) * 1440) + 1440) % 1440);
  return Math.round(m / 15) * 15 % 1440;
}

export interface GameRow { id: string; name: string; box: string | null; ms: number; streams: number; last: number }
export interface Bucket { start: number; key: string; ms: number; games: Map<string, number> }

export function analyse(data: Streamer, days: number | null) {
  const now = data.now;
  const oldest = data.streams.length ? data.streams[data.streams.length - 1].start : now;
  const from = days ? now - days * DAY : Math.min(oldest, now - DAY);
  const streams = data.streams.filter((s) => s.end > from && s.start < now);

  const gameMs = new Map<string, { ms: number; streams: Set<number>; last: number }>();
  let total = 0;
  const dayKeys = new Set<string>();
  // one bucket per local day, or per week when the range is long
  const weekly = (now - from) / DAY > 62;
  const first = new Date(from);
  first.setHours(0, 0, 0, 0);
  if (weekly) first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const buckets: Bucket[] = [];
  for (const d = new Date(first); d.getTime() < now; d.setDate(d.getDate() + (weekly ? 7 : 1))) {
    buckets.push({ start: d.getTime(), key: keyOf(d), ms: 0, games: new Map() });
  }
  const bucketOf = (ms: number) => {
    let lo = 0, hi = buckets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (buckets[mid].start <= ms) lo = mid;
      else hi = mid - 1;
    }
    return buckets[lo];
  };
  // how much of each weekday-hour they were live: rows Monday first, 24 columns
  const heat = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));

  streams.forEach((s, i) => {
    for (const p of pieces(s, from, now)) {
      const d = p.b - p.a;
      total += d;
      const g = gameMs.get(p.game) ?? { ms: 0, streams: new Set(), last: 0 };
      g.ms += d;
      g.streams.add(i);
      g.last = Math.max(g.last, p.b);
      gameMs.set(p.game, g);
      split(p.a, p.b, 'day', (at, ms) => {
        if (ms >= 60_000) dayKeys.add(keyOf(at));
        const b = bucketOf(at.getTime());
        b.ms += ms;
        b.games.set(p.game, (b.games.get(p.game) ?? 0) + ms);
      });
      split(p.a, p.b, 'hour', (at, ms) => (heat[(at.getDay() + 6) % 7][at.getHours()] += ms));
    }
  });

  // each weekday-hour as the share of its hours in the range they were live
  const slots = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  split(from, now, 'hour', (at, ms) => (slots[(at.getDay() + 6) % 7][at.getHours()] += ms));
  const often = heat.map((row, d) => row.map((ms, h) => (slots[d][h] ? Math.min(1, ms / slots[d][h]) : 0)));
  const byWeekday = heat.map((row, d) => {
    const weeks = slots[d].reduce((a, b) => a + b, 0) / DAY;
    return weeks ? row.reduce((a, b) => a + b, 0) / weeks : 0;
  });

  const games: GameRow[] = [...gameMs]
    .map(([id, g]) => ({ id, name: id ? data.games[id]?.[0] ?? t('Unknown game') : t('No category'), box: id ? data.games[id]?.[1] ?? null : null, ms: g.ms, streams: g.streams.size, last: g.last }))
    .sort((a, b) => b.ms - a.ms);

  const lengths = streams.map((s) => s.end - s.start);
  const longest = streams.reduce<Stream | null>((m, s) => (!m || s.end - s.start > m.end - m.start ? s : m), null);
  const watched = streams.filter((s) => s.avg !== undefined);
  const watchedMs = watched.reduce((a, s) => a + (s.end - s.start), 0);
  const span = Math.max(1, Math.round((now - from) / DAY));

  return {
    from,
    span,
    streams,
    total,
    count: streams.length,
    average: lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0,
    longest,
    daysLive: dayKeys.size,
    games,
    buckets,
    weekly,
    often,
    /** average hours live on each weekday, Monday first */
    byWeekday: byWeekday.map((ms) => ms / HOUR),
    starts: usualTime(streams.filter((s) => s.start >= from).map((s) => s.start)),
    ends: usualTime(streams.filter((s) => !s.live && s.end <= now).map((s) => s.end)),
    viewers: watched.length
      ? {
          streams: watched.length,
          // weighted by how long each stream ran
          avg: Math.round(watched.reduce((a, s) => a + s.avg! * (s.end - s.start), 0) / (watchedMs || 1)),
          peak: Math.max(...watched.map((s) => s.peak ?? 0)),
          hoursWatched: Math.round(watched.reduce((a, s) => a + (s.avg! * (s.end - s.start)) / HOUR, 0)),
        }
      : null,
  };
}
export type Analysis = ReturnType<typeof analyse>;

/** 5 h 28 min, 45 min, or 142 h once it's long. */
export function hours(ms: number) {
  const m = Math.round(ms / 60_000);
  if (m < 60) return t('{m} min', { m });
  const h = Math.floor(m / 60);
  if (h >= 24 || m % 60 === 0) return t('{h} h', { h: Math.round(m / 60).toLocaleString(LOCALE) });
  return t('{h} h {m} min', { h, m: m % 60 });
}

/** A time of day given in minutes after midnight, the local way. */
export const clock = (min: number) => timeLabel(new Date(2000, 0, 1, Math.floor(min / 60), min % 60).getTime());
