// Streamer stats: a Twitch channel's broadcasts from the server (server/streamers.js), and what they add up to
// over a range of days, worked out here so switching the range doesn't ask the server again. Times are the
// viewer's own: a day is a local day and the hours are local hours.
import { useEffect, useState } from 'preact/hooks';
import { keyOf, timeLabel } from './dates';
import { LOCALE, count, t } from './i18n';

const MIN = 60_000;
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
  /** the VOD's views on Twitch */
  views?: number;
}
export interface Summary { avg: number | null; peak: number | null; hoursWatched: number | null; minutes: number | null; followers: number | null; followersTotal?: number | null; rank: number | null; streams?: number | null; days?: number | null }
/** a stretch from Streams Charts: hours watched, viewers, minutes live, followers gained, streams, days live, top games */
export interface ScStats {
  hw: number | null; avg: number | null; peak: number | null; airMin: number | null; gained: number | null; followers: number | null;
  streams: number | null; days: number | null; gamesCount: number | null;
  /** [game name, hours watched, % of the hours watched] */
  games: [string, number, number][];
}
/** months as ['YYYY-MM', stats], and the range asked for with the one before it */
export interface History { on: boolean; months: [string, ScStats][]; range: ScStats | null; prev: ScStats | null }
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
  /** TwitchTracker's 30 days as they stood each day: [midnight UTC, rank, average viewers, peak, followers, hours watched, minutes streamed] */
  trackerDays?: [number, number | null, number | null, number | null, number | null, (number | null)?, (number | null)?][];
  /** the 100 most-watched clips of all time, biggest first */
  clips?: Clip[];
  /** the last 30 days, from Streams Charts or TwitchTracker */
  summary: Summary | null;
  /** whether Streams Charts can be asked for this channel's history */
  history?: boolean;
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

const histories = new Map<string, { at: number; data: History }>();

/** Streams Charts' history for a range (null days: all of it), once the report says it can be asked for. */
export function useHistory(login: string | null, days: number | null, on: boolean): { data: History | null; loading: boolean } {
  const key = `${login} ${days ?? 'all'}`;
  const [s, setS] = useState<{ key: string; data: History | null; loading: boolean }>({ key, data: histories.get(key)?.data ?? null, loading: false });
  useEffect(() => {
    if (!login || !on) return setS({ key, data: null, loading: false });
    const had = histories.get(key);
    if (had && Date.now() - had.at < 10 * FRESH) return setS({ key, data: had.data, loading: false });
    setS({ key, data: had?.data ?? null, loading: true });
    let alive = true;
    get<History>(`/api/streamers/${encodeURIComponent(login)}/history?days=${days ?? 'all'}`).then(
      (data) => {
        histories.set(key, { at: Date.now(), data });
        if (alive) setS({ key, data, loading: false });
      },
      () => alive && setS({ key, data: had?.data ?? null, loading: false }),
    );
    return () => void (alive = false);
  }, [key, on]);
  return s.key === key ? s : { data: null, loading: true };
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

/** Streams Charts names its games: one Twitch also named is that game, any other is kept as 'name:…'; the rest as OTHER_GAMES. */
export const OTHER_GAMES = 'other:';
export function gameIdOf(d: Streamer, name: string) {
  const want = name.trim().toLowerCase();
  for (const [id, [n]] of Object.entries(d.games)) if (n.toLowerCase() === want) return id;
  return `name:${name}`;
}
export const gameName = (d: Streamer, g: string) =>
  g === OTHER_GAMES ? t('Other games') : g.startsWith('name:') ? g.slice(5) : g ? d.games[g]?.[0] ?? t('Unknown game') : t('No category');

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

/**
 * How many watched a stream between a and b, in viewer-ms: its average over its length, shared out along its viewer
 * line where there is one (so a game played to a bigger crowd gets more of it). null when nobody was counted.
 */
export function watchedIn(s: Stream, a: number, b: number): number | null {
  if (s.avg === undefined) return null;
  const len = s.end - s.start;
  a = Math.max(a, s.start);
  b = Math.min(b, s.end);
  if (b <= a || len <= 0) return 0;
  const whole = s.avg * len;
  const c = s.curve;
  if (!c || c.length < 2 || (a === s.start && b === s.end)) return whole * ((b - a) / len);
  // each point of the line holds until the next
  let part = 0, all = 0;
  for (let i = 0; i < c.length; i++) {
    const p0 = i ? s.start + c[i][0] * MIN : s.start, p1 = i + 1 < c.length ? s.start + c[i + 1][0] * MIN : s.end;
    all += c[i][1] * Math.max(0, p1 - p0);
    part += c[i][1] * Math.max(0, Math.min(b, p1) - Math.max(a, p0));
  }
  return all ? whole * (part / all) : whole * ((b - a) / len);
}

export interface GameRow {
  id: string;
  name: string;
  box: string | null;
  ms: number;
  streams: number;
  first: number;
  last: number;
  /** viewer-ms over the streams where viewers were counted, and how long it was played in those */
  watched: number;
  recMs: number;
  /** [when, how long] each time it was played */
  hits: [number, number][];
}

/** The longest run of days in a row among 'YYYY-MM-DD' keys. */
function streakOf(keys: Iterable<string>) {
  const days = [...keys].sort().map((k) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  });
  let best = 0, run = 0;
  days.forEach((ms, i) => {
    run = i && Math.round((ms - days[i - 1]) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export function analyse(data: Streamer, days: number | null) {
  const now = data.now;
  const oldest = data.streams.length ? data.streams[data.streams.length - 1].start : now;
  const from = days ? now - days * DAY : Math.min(oldest, now - DAY);
  const streams = data.streams.filter((s) => s.end > from && s.start < now);

  const gameMs = new Map<string, Omit<GameRow, 'id' | 'name' | 'box' | 'streams'> & { streams: Set<number> }>();
  let total = 0;
  const dayKeys = new Set<string>();
  // how much of each weekday-hour they were live: rows Monday first, 24 columns
  const heat = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));

  streams.forEach((s, i) => {
    for (const p of pieces(s, from, now)) {
      const d = p.b - p.a;
      total += d;
      const g = gameMs.get(p.game) ?? { ms: 0, streams: new Set(), first: p.a, last: 0, watched: 0, recMs: 0, hits: [] };
      g.ms += d;
      g.streams.add(i);
      g.first = Math.min(g.first, p.a);
      g.last = Math.max(g.last, p.b);
      g.hits.push([p.a, d]);
      const w = watchedIn(s, p.a, p.b);
      if (w !== null) (g.watched += w), (g.recMs += d);
      gameMs.set(p.game, g);
      split(p.a, p.b, 'day', (at, ms) => ms >= 60_000 && dayKeys.add(keyOf(at)));
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
    .map(([id, g]) => ({ ...g, id, name: id ? data.games[id]?.[0] ?? t('Unknown game') : t('No category'), box: id ? data.games[id]?.[1] ?? null : null, streams: g.streams.size }))
    .sort((a, b) => b.ms - a.ms);

  const lengths = streams.map((s) => s.end - s.start);
  const longest = streams.reduce<Stream | null>((m, s) => (!m || s.end - s.start > m.end - m.start ? s : m), null);
  const watched = streams.filter((s) => s.avg !== undefined);
  const watchedMs = watched.reduce((a, s) => a + (s.end - s.start), 0);
  const span = Math.max(1, Math.round((now - from) / DAY));
  // the longest time off between two streams of the range
  const inOrder = streams.slice().reverse();
  let gap: { ms: number; from: number; to: number } | null = null;
  for (let i = 1; i < inOrder.length; i++) {
    const ms = inOrder[i].start - inOrder[i - 1].end;
    if (ms > 0 && (!gap || ms > gap.ms)) gap = { ms, from: inOrder[i - 1].end, to: inOrder[i].start };
  }
  const withViews = streams.filter((s) => s.views !== undefined);

  return {
    from,
    span,
    streams,
    total,
    count: streams.length,
    average: lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0,
    longest,
    daysLive: dayKeys.size,
    streak: streakOf(dayKeys),
    gap,
    /** games played in a stream, on average */
    perStream: streams.length ? streams.reduce((a, s) => a + new Set(s.segs.map((x) => x[0])).size, 0) / streams.length : 0,
    vodViews: withViews.length ? { views: withViews.reduce((a, s) => a + s.views!, 0), vods: withViews.length } : null,
    games,
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

/* ---------- over time: any stretch, a day, week or month at a time ---------- */

export type Unit = 'day' | 'week' | 'month';
/** Days while a stretch is under seven weeks or so, weeks while it's under ten months, then months. */
export const unitFor = (ms: number): Unit => (ms <= 45 * DAY ? 'day' : ms <= 300 * DAY ? 'week' : 'month');

export interface Period {
  start: number;
  end: number;
  ms: number;
  games: Map<string, number>;
  streams: number;
  avg: number | null;
  peak: number | null;
  /** viewer-hours, over the streams where viewers were counted */
  watched: number | null;
  /** views of the VODs of the streams that started in it */
  views: number | null;
  /** followers at its end, and gained over it */
  followers: number | null;
  gained: number | null;
  rank: number | null;
  /** its figures are Streams Charts' for the whole month */
  full?: boolean;
}

/** The last [day, value] at or before a time. */
const valueAt = (pts: [number, number][], at: number) => {
  let v: number | null = null;
  for (const [day, n] of pts) if (day <= at) v = n;
  return v;
};

/** The first thing known of the channel: its oldest past stream, follower count or TwitchTracker day. */
export function knownFrom(d: Streamer, h: History | null = null) {
  const first = h?.months[0]?.[0];
  const firsts = [d.streams.at(-1)?.start, d.followerDays[0]?.[0], d.trackerDays?.[0]?.[0], first ? new Date(+first.slice(0, 4), +first.slice(5, 7) - 1, 1).getTime() : undefined]
    .filter((x): x is number => x !== undefined);
  return firsts.length ? Math.min(...firsts) : null;
}

/** The local day, Monday or first of the month a time falls in. */
export function unitStart(ms: number, unit: Unit) {
  const at = new Date(ms);
  at.setHours(0, 0, 0, 0);
  if (unit === 'month') at.setDate(1);
  else if (unit === 'week') at.setDate(at.getDate() - ((at.getDay() + 6) % 7));
  return at.getTime();
}

/**
 * Every day, week or month that touches [from, to): hours, streams, viewers, VOD views and followers. A month Streams
 * Charts knows takes its figures, which count every stream; its games keep the hours seen here when those cover it,
 * else they're shared out by hours watched.
 */
export function overTime(d: Streamer, from: number, to: number, unit: Unit, h: History | null = null) {
  const months = new Map(unit === 'month' ? h?.months ?? [] : []);
  const tracker = d.trackerDays ?? [];
  const at = new Date(unitStart(from, unit));
  const periods: Period[] = [];
  while (at.getTime() < to) {
    const start = at.getTime();
    if (unit === 'month') at.setMonth(at.getMonth() + 1);
    else at.setDate(at.getDate() + (unit === 'week' ? 7 : 1));
    periods.push({ start, end: at.getTime(), ms: 0, games: new Map(), streams: 0, avg: null, peak: null, watched: null, views: null, followers: null, gained: null, rank: null });
  }
  if (!periods.length) return periods;
  const lo = periods[0].start;
  const streams = d.streams.filter((s) => s.end > lo && s.start < to);
  for (const p of periods) {
    const end = Math.min(p.end, d.now);
    for (const s of streams) {
      for (const x of pieces(s, p.start, end)) {
        p.ms += x.b - x.a;
        p.games.set(x.game, (p.games.get(x.game) ?? 0) + x.b - x.a);
      }
      const w = s.end > p.start && s.start < end ? watchedIn(s, p.start, end) : null;
      if (w !== null) p.watched = (p.watched ?? 0) + w / HOUR;
    }
    if (p.watched !== null) p.watched = Math.round(p.watched);
    const mine = streams.filter((s) => s.start >= p.start && s.start < p.end);
    p.streams = mine.length;
    const counted = mine.filter((s) => s.avg !== undefined);
    if (counted.length) {
      const ms = counted.reduce((a, s) => a + (s.end - s.start), 0) || 1;
      p.avg = Math.round(counted.reduce((a, s) => a + s.avg! * (s.end - s.start), 0) / ms);
      p.peak = Math.max(...counted.map((s) => s.peak ?? s.avg!));
    }
    const viewed = mine.filter((s) => s.views !== undefined);
    if (viewed.length) p.views = viewed.reduce((a, s) => a + s.views!, 0);
    const inside = d.followerDays.filter(([day]) => day >= p.start && day < p.end);
    if (inside.length) {
      p.followers = inside[inside.length - 1][1];
      const before = valueAt(d.followerDays, p.start - 1);
      const base = before ?? (inside.length > 1 ? inside[0][1] : null);
      if (base !== null) p.gained = p.followers - base;
    }
    const ranks = tracker.filter(([day, rank]) => day >= p.start && day < p.end && rank !== null);
    if (ranks.length) p.rank = ranks[ranks.length - 1][1];
    const at = new Date(p.start);
    const m = months.get(`${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`);
    if (m) {
      const ms = m.airMin !== null ? m.airMin * MIN : p.ms;
      if (p.ms < ms * 0.9 && m.hw) {
        p.games = new Map();
        let left = ms;
        for (const [name, hw] of m.games) {
          const part = (hw / m.hw) * ms;
          const id = gameIdOf(d, name);
          p.games.set(id, (p.games.get(id) ?? 0) + part);
          left -= part;
        }
        if (left > MIN) p.games.set(OTHER_GAMES, left);
      }
      p.ms = ms;
      p.watched = m.hw ?? p.watched;
      p.avg = m.avg ?? p.avg;
      p.peak = m.peak ?? p.peak;
      p.streams = m.streams ?? p.streams;
      p.gained = m.gained ?? p.gained;
      p.full = true;
    }
  }
  return periods;
}

/** What a stretch of time adds up to, to set one range against the one before it. */
export function sums(d: Streamer, from: number, to: number) {
  let ms = 0;
  for (const s of d.streams) for (const p of pieces(s, from, to)) ms += p.b - p.a;
  const watched = d.streams.filter((s) => s.avg !== undefined && s.start >= from && s.start < to);
  const wms = watched.reduce((a, s) => a + (s.end - s.start), 0) || 1;
  let hw: number | null = null;
  for (const s of d.streams) {
    const w = s.end > from && s.start < to ? watchedIn(s, from, to) : null;
    if (w !== null) hw = (hw ?? 0) + w / HOUR;
  }
  const a = valueAt(d.followerDays, from + DAY), b = valueAt(d.followerDays, to);
  // the follower count has to be known from the start of the stretch
  const known = d.followerDays.length > 0 && d.followerDays[0][0] <= from + DAY;
  return {
    ms,
    avg: watched.length ? Math.round(watched.reduce((x, s) => x + s.avg! * (s.end - s.start), 0) / wms) : null,
    peak: watched.length ? Math.max(...watched.map((s) => s.peak ?? s.avg!)) : null,
    /** viewer-hours over the streams where viewers were counted */
    watched: hw !== null ? Math.round(hw) : null,
    streams: d.streams.filter((s) => s.start >= from && s.start < to).length,
    gained: known && a !== null && b !== null ? b - a : null,
    /** whether every stream of the stretch is known (the past ones Twitch lists, or recorded here) */
    whole: (d.streams.at(-1)?.start ?? Infinity) <= from || (d.recordingSince ?? Infinity) <= from,
    recorded: (d.recordingSince ?? Infinity) <= from,
  };
}
