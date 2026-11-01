// Streamer stats: a Twitch channel's broadcasts from the server (server/streamers.js), and what they add up to
// over a range of days, worked out here so switching the range doesn't ask the server again. Times are the
// viewer's own: a day is a local day and the hours are local hours.
import { useEffect, useState } from 'preact/hooks';
import { keyOf, timeLabel } from './dates';
import { LOCALE, count, t } from './i18n';

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
export interface Summary { avg: number | null; peak: number | null; hoursWatched: number | null; minutes: number | null; followers: number | null; followersTotal?: number | null; rank: number | null }
/** one of the channel's most-watched clips */
export interface Clip { slug: string; title: string; views: number; at: number; game: string; secs: number; thumb: string | null }
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
  /** TwitchTracker's 30 days as they stood each day: [midnight UTC, rank, average viewers, peak, followers] */
  trackerDays?: [number, number | null, number | null, number | null, number | null][];
  /** the 100 most-watched clips of all time, biggest first */
  clips?: Clip[];
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

/**
 * The games given a colour: the five streamed most over everything loaded, so a colour stays with its game whatever
 * the range, then the games of the biggest clips while colours are left, so the career wears the same ones.
 */
export const PALETTE = ['sadness', 'hope-interest', 'calm-safety', 'joy', 'love-connection', 'anger'];
export function gameColors(streams: Stream[], clips: Clip[] = []) {
  const ms = new Map<string, number>();
  for (const s of streams) for (const [g, , d] of s.segs) if (g) ms.set(g, (ms.get(g) ?? 0) + d);
  const top = [...ms].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
  const views = new Map<string, number>();
  for (const c of clips) if (c.game) views.set(c.game, (views.get(c.game) ?? 0) + c.views);
  for (const [g] of [...views].sort((a, b) => b[1] - a[1])) if (top.length < PALETTE.length && !top.includes(g)) top.push(g);
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

/* ---------- the whole career ---------- */

export interface Year { year: number; views: number; clips: number; games: Map<string, number> }
export interface Era { id: string; name: string; box: string | null; views: number; clips: Clip[]; first: number; last: number }

/**
 * A career as its most-watched clips tell it: each year since the channel was made with the views of the clips
 * made that year, and the games those clips came from. Clips only reach back to 2016, when Twitch added them.
 */
export function career(d: Streamer) {
  const clips = (d.clips ?? []).slice().sort((a, b) => b.views - a.views);
  const nowYear = new Date(d.now).getFullYear();
  const first = Math.min(d.createdAt ? new Date(d.createdAt).getFullYear() : nowYear, ...clips.map((c) => new Date(c.at).getFullYear()));
  const years: Year[] = [];
  for (let y = first; y <= nowYear; y++) years.push({ year: y, views: 0, clips: 0, games: new Map() });
  const eras = new Map<string, Era>();
  for (const c of clips) {
    const y = years[new Date(c.at).getFullYear() - first];
    if (y) {
      y.views += c.views;
      y.clips++;
      y.games.set(c.game, (y.games.get(c.game) ?? 0) + c.views);
    }
    const e = eras.get(c.game) ?? { id: c.game, name: c.game ? d.games[c.game]?.[0] ?? t('Unknown game') : t('No category'), box: c.game ? d.games[c.game]?.[1] ?? null : null, views: 0, clips: [], first: c.at, last: c.at };
    e.views += c.views;
    e.clips.push(c);
    e.first = Math.min(e.first, c.at);
    e.last = Math.max(e.last, c.at);
    eras.set(c.game, e);
  }
  const views = clips.reduce((a, c) => a + c.views, 0);
  const best = clips.length ? years.reduce((m, y) => (y.views > m.views ? y : m)) : null;
  return {
    clips,
    years,
    eras: [...eras.values()].sort((a, b) => b.views - a.views),
    views,
    best,
    /** the first of January of the first year shown */
    start: new Date(first, 0, 1).getTime(),
  };
}
export type Career = ReturnType<typeof career>;

/** How long since a date, as "12 years, 8 months". */
export function age(since: number, now: number) {
  const a = new Date(since), b = new Date(now);
  let y = b.getFullYear() - a.getFullYear(), m = b.getMonth() - a.getMonth();
  if (b.getDate() < a.getDate()) m--;
  if (m < 0) (y--, (m += 12));
  if (y <= 0) return count(Math.max(0, m), 'month', 'months');
  return m ? `${count(y, 'year', 'years')}, ${count(m, 'month', 'months')}` : count(y, 'year', 'years');
}

/* ---------- over time: everything known, a month (or week) at a time ---------- */

export interface Period {
  start: number;
  end: number;
  ms: number;
  games: Map<string, number>;
  streams: number;
  avg: number | null;
  peak: number | null;
  /** followers at its end, and gained over it */
  followers: number | null;
  gained: number | null;
  rank: number | null;
}

/** The last [day, value] at or before a time. */
const valueAt = (pts: [number, number][], at: number) => {
  let v: number | null = null;
  for (const [day, n] of pts) if (day <= at) v = n;
  return v;
};

/**
 * Every month since the first thing known of the channel (its oldest past stream, follower count or TwitchTracker
 * day), or every week while that's under four months: hours, streams, viewers and followers.
 */
export function overTime(d: Streamer) {
  const tracker = d.trackerDays ?? [];
  const firsts = [d.streams.at(-1)?.start, d.followerDays[0]?.[0], tracker[0]?.[0]].filter((x): x is number => x !== undefined);
  if (!firsts.length) return null;
  const from = Math.min(...firsts), now = d.now;
  const monthly = now - from > 120 * DAY;
  const at = new Date(from);
  at.setHours(0, 0, 0, 0);
  if (monthly) at.setDate(1);
  else at.setDate(at.getDate() - ((at.getDay() + 6) % 7));
  const periods: Period[] = [];
  while (at.getTime() < now) {
    const start = at.getTime();
    if (monthly) at.setMonth(at.getMonth() + 1);
    else at.setDate(at.getDate() + 7);
    periods.push({ start, end: at.getTime(), ms: 0, games: new Map(), streams: 0, avg: null, peak: null, followers: null, gained: null, rank: null });
  }
  for (const p of periods) {
    const mine = d.streams.filter((s) => s.start >= p.start && s.start < p.end);
    p.streams = mine.length;
    for (const s of d.streams) for (const x of pieces(s, p.start, Math.min(p.end, now))) {
      p.ms += x.b - x.a;
      p.games.set(x.game, (p.games.get(x.game) ?? 0) + x.b - x.a);
    }
    const watched = mine.filter((s) => s.avg !== undefined);
    if (watched.length) {
      const ms = watched.reduce((a, s) => a + (s.end - s.start), 0) || 1;
      p.avg = Math.round(watched.reduce((a, s) => a + s.avg! * (s.end - s.start), 0) / ms);
      p.peak = Math.max(...watched.map((s) => s.peak ?? s.avg!));
    }
    const inside = d.followerDays.filter(([day]) => day >= p.start && day < p.end);
    if (inside.length) {
      p.followers = inside[inside.length - 1][1];
      const before = valueAt(d.followerDays, p.start - 1);
      const base = before ?? (inside.length > 1 ? inside[0][1] : null);
      if (base !== null) p.gained = p.followers - base;
    }
    const ranks = tracker.filter(([day, rank]) => day >= p.start && day < p.end && rank !== null);
    if (ranks.length) p.rank = ranks[ranks.length - 1][1];
  }
  return { from, monthly, periods };
}

/** What a stretch of time adds up to, to set one range against the one before it. */
export function sums(d: Streamer, from: number, to: number) {
  let ms = 0;
  for (const s of d.streams) for (const p of pieces(s, from, to)) ms += p.b - p.a;
  const watched = d.streams.filter((s) => s.avg !== undefined && s.start >= from && s.start < to);
  const wms = watched.reduce((a, s) => a + (s.end - s.start), 0) || 1;
  const a = valueAt(d.followerDays, from + DAY), b = valueAt(d.followerDays, to);
  // the follower count has to be known from the start of the stretch
  const known = d.followerDays.length > 0 && d.followerDays[0][0] <= from + DAY;
  return {
    ms,
    avg: watched.length ? Math.round(watched.reduce((x, s) => x + s.avg! * (s.end - s.start), 0) / wms) : null,
    peak: watched.length ? Math.max(...watched.map((s) => s.peak ?? s.avg!)) : null,
    gained: known && a !== null && b !== null ? b - a : null,
    /** whether every stream of the stretch is known (the past ones Twitch lists, or recorded here) */
    whole: (d.streams.at(-1)?.start ?? Infinity) <= from || (d.recordingSince ?? Infinity) <= from,
    recorded: (d.recordingSince ?? Infinity) <= from,
  };
}
