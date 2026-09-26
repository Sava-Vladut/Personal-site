import { CHART_ORDER, EMOTION, coreOf, shortName, valence } from '../data/emotions';
import { WEEKDAYS, addDays, diffDays, startOfWeek, todayKey, weekday } from './dates';
import type { Entry } from './store';

export type RangeKey = '7d' | '30d' | '90d' | '1y' | 'all';
export const RANGES: [RangeKey, string, number | null][] = [
  ['7d', '7D', 7], ['30d', '30D', 30], ['90d', '90D', 90], ['1y', '1Y', 365], ['all', 'All', null],
];

/** Mood of one entry: intensity × average valence of its emotions, from −5 (intensely unpleasant) to +5. */
export function moodOf(e: Entry): number | null {
  if (!e.emotions.length) return null;
  const v = e.emotions.reduce((s, id) => s + valence(id), 0) / e.emotions.length;
  return v * e.intensity;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const inc = <K>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
/** Whether an entry's clock time belongs to its calendar day (notes back-dated to another day don't). */
const timed = (e: Entry) => {
  const d = new Date(e.time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === e.date;
};

export function streaks(entries: Entry[]) {
  const days = new Set(entries.map((e) => e.date));
  const today = todayKey();
  let current = 0;
  for (let d = days.has(today) ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) current++;
  let longest = 0;
  for (const d of days) {
    if (days.has(addDays(d, -1))) continue; // only start counting at the first day of a run
    let n = 0;
    for (let x = d; days.has(x); x = addDays(x, 1)) n++;
    longest = Math.max(longest, n);
  }
  return { current, longest };
}

function kpis(list: Entry[]) {
  const moods = list.map(moodOf).filter((m): m is number => m !== null);
  const occ = list.flatMap((e) => e.emotions);
  const pleasant = occ.filter((id) => valence(id) > 0).length;
  const leaves = new Map<string, number>();
  occ.forEach((id) => inc(leaves, id));
  // Normalised entropy of which feelings show up: 0 = always the same one, 100 = evenly spread.
  const total = occ.length;
  const entropy = [...leaves.values()].reduce((h, c) => h - (c / total) * Math.log(c / total), 0);
  const activeDays = new Set(list.map((e) => e.date)).size;
  return {
    entries: list.length,
    notes: list.filter((e) => e.kind === 'note').length,
    checkins: list.filter((e) => e.kind === 'checkin').length,
    activeDays,
    perDay: activeDays ? list.length / activeDays : 0,
    mood: mean(moods),
    intensity: mean(list.filter((e) => e.emotions.length).map((e) => e.intensity)),
    pleasantShare: total ? pleasant / total : null,
    feelings: new Set(occ.filter((id) => EMOTION[id]?.depth === 2)).size,
    diversity: total > 1 && leaves.size > 1 ? (entropy / Math.log(Math.min(total, 48 + 24 + 8))) * 100 : null,
    words: list.reduce((s, e) => s + words(e.text), 0),
  };
}
export type Kpis = ReturnType<typeof kpis>;

export interface Bucket {
  key: string;          // first day of the bucket
  end: string;
  entries: Entry[];
  pleasant: number;     // entries whose mood > 0
  unpleasant: number;   // entries whose mood < 0
  mood: number | null;
  rolling: number | null;
  cores: Record<string, number>;
}

export const DAYPARTS = [
  { name: 'Morning', test: (h: number) => h >= 5 && h < 12 },
  { name: 'Afternoon', test: (h: number) => h >= 12 && h < 17 },
  { name: 'Evening', test: (h: number) => h >= 17 && h < 22 },
  { name: 'Night', test: (h: number) => h >= 22 || h < 5 },
];

export function computeStats(all: Entry[], range: RangeKey, weekStart: 0 | 1) {
  const today = todayKey();
  const n = RANGES.find((r) => r[0] === range)![2];
  const earliest = all.length ? all.reduce((m, e) => (e.date < m ? e.date : m), today) : today;
  let start = n ? addDays(today, -(n - 1)) : earliest;
  if (diffDays(start, today) < 6) start = addDays(today, -6);
  const span = diffDays(start, today) + 1;
  const list = all.filter((e) => e.date >= start && e.date <= today);
  const prevList = n ? all.filter((e) => e.date >= addDays(start, -n) && e.date < start) : [];

  /* time buckets: days for short ranges, weeks beyond ~4 months */
  const step = span > 120 ? 7 : 1;
  const first = step === 7 ? startOfWeek(start, weekStart) : start;
  const buckets: Bucket[] = [];
  for (let k = first; k <= today; k = addDays(k, step))
    buckets.push({ key: k, end: addDays(k, step - 1), entries: [], pleasant: 0, unpleasant: 0, mood: null, rolling: null, cores: {} });
  for (const e of list) {
    const b = buckets[Math.min(buckets.length - 1, Math.floor(diffDays(first, e.date) / step))];
    b.entries.push(e);
    const m = moodOf(e);
    if (m !== null && m > 0) b.pleasant++;
    if (m !== null && m < 0) b.unpleasant++;
    for (const id of e.emotions) b.cores[coreOf(id).id] = (b.cores[coreOf(id).id] ?? 0) + 1;
  }
  const win = step === 1 ? 7 : 4;
  buckets.forEach((b, i) => {
    b.mood = mean(b.entries.map(moodOf).filter((m): m is number => m !== null));
    const window = buckets.slice(Math.max(0, i - win + 1), i + 1).flatMap((x) => x.entries.map(moodOf)).filter((m): m is number => m !== null);
    b.rolling = mean(window);
  });

  /* emotion counts: a feeling also counts toward its family and world */
  const cores = new Map<string, number>(), families = new Map<string, number>(), exact = new Map<string, number>();
  for (const e of list)
    for (const id of e.emotions) {
      const em = EMOTION[id];
      inc(cores, em.core);
      if (em.depth === 2) inc(families, em.parent!);
      if (em.depth === 1) inc(families, em.id);
      inc(exact, id);
    }
  const occurrences = [...cores.values()].reduce((a, b) => a + b, 0);

  /* rhythm: weekday × 3-hour block, and mood by weekday / part of day */
  const heat = Array.from({ length: 7 }, () => Array(8).fill(0) as number[]);
  const wdMoods: number[][] = Array.from({ length: 7 }, () => []);
  const dpMoods: number[][] = DAYPARTS.map(() => []);
  const dpCounts = DAYPARTS.map(() => 0);
  for (const e of list) {
    const m = moodOf(e);
    if (m !== null) wdMoods[weekday(e.date)].push(m);
    if (!timed(e)) continue;
    const h = new Date(e.time).getHours();
    heat[weekday(e.date)][Math.floor(h / 3)]++;
    const p = DAYPARTS.findIndex((d) => d.test(h));
    dpCounts[p]++;
    if (m !== null) dpMoods[p].push(m);
  }

  /* intensity distribution, split by valence */
  const intensity = [1, 2, 3, 4, 5].map((lvl) => {
    const at = list.filter((e) => e.emotions.length && e.intensity === lvl);
    return { level: lvl, pleasant: at.filter((e) => (moodOf(e) ?? 0) > 0).length, unpleasant: at.filter((e) => (moodOf(e) ?? 0) < 0).length, total: at.length };
  });

  /* feelings that show up together in one entry */
  const pairs = new Map<string, number>();
  for (const e of list) {
    const ids = [...new Set(e.emotions)].sort();
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) inc(pairs, ids[i] + '|' + ids[j]);
  }

  /* what tends to come next: world of one entry → world of the next one (within 2 days) */
  const chrono = list.filter((e) => e.emotions.length).sort((a, b) => a.time - b.time);
  const trans = new Map<string, number>();
  for (let i = 1; i < chrono.length; i++) {
    const [a, b] = [chrono[i - 1], chrono[i]];
    if (Math.abs(diffDays(a.date, b.date)) > 2) continue;
    const [ca, cb] = [coreOf(a.emotions[0]).id, coreOf(b.emotions[0]).id];
    if (ca !== cb) inc(trans, ca + '>' + cb);
  }

  /* calendar: dominant world per day */
  const days = new Map<string, { cores: Map<string, number>; moods: number[]; n: number }>();
  for (const e of list) {
    const d = days.get(e.date) ?? { cores: new Map<string, number>(), moods: [] as number[], n: 0 };
    d.n++;
    e.emotions.forEach((id) => inc(d.cores, coreOf(id).id));
    const m = moodOf(e);
    if (m !== null) d.moods.push(m);
    days.set(e.date, d);
  }
  const calendar = new Map(
    [...days].map(([k, d]) => {
      const top = [...d.cores].sort((a, b) => b[1] - a[1])[0];
      return [k, { core: top?.[0] ?? null, n: d.n, mood: mean(d.moods) }];
    }),
  );

  return {
    start, end: today, span, step, list,
    k: kpis(list),
    prev: n ? kpis(prevList) : null,
    buckets,
    cores: CHART_ORDER.map((id) => ({ id, count: cores.get(id) ?? 0 })),
    families,
    exact: [...exact].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, count })),
    occurrences,
    heat,
    heatMax: Math.max(1, ...heat.flat()),
    weekdays: wdMoods.map((ms, i) => ({ day: WEEKDAYS[i], mood: mean(ms), n: ms.length })),
    dayparts: DAYPARTS.map((d, i) => ({ name: d.name, mood: mean(dpMoods[i]), n: dpCounts[i] })),
    intensity,
    pairs: [...pairs].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, count]) => ({ ids: k.split('|'), count })),
    transitions: [...trans].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, count]) => ({ from: k.split('>')[0], to: k.split('>')[1], count })),
    calendar,
  };
}
export type Stats = ReturnType<typeof computeStats>;

/** Every feeling ever named, for the collection ("dex"). */
export function dex(entries: Entry[]) {
  const found = new Map<string, { count: number; first: string }>();
  for (const e of entries)
    for (const id of e.emotions) {
      if (EMOTION[id]?.depth !== 2) continue;
      const f = found.get(id);
      if (!f) found.set(id, { count: 1, first: e.date });
      else {
        f.count++;
        if (e.date < f.first) f.first = e.date;
      }
    }
  return found;
}

/* ---------- plain-language insights ---------- */

export const fmtMood = (m: number | null) => (m === null ? '—' : `${m > 0.05 ? '+' : m < -0.05 ? '−' : ''}${Math.abs(m).toFixed(1)}`);
export const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const label = (id: string) => (EMOTION[id].depth === 0 ? shortName(id) : EMOTION[id].name);

export function insights(s: Stats, rangeName: string, entries: Entry[]): string[] {
  const out: string[] = [];
  const { k, prev } = s;
  if (!k.entries) return out;

  if (k.pleasantShare !== null) {
    const p = k.pleasantShare;
    out.push(
      p >= 0.6 ? `Mostly pleasant — ${pct(p)} of the feelings you named felt good.`
      : p <= 0.4 ? `A heavier stretch — ${pct(1 - p)} of the feelings you named were unpleasant.`
      : `A mixed stretch — pleasant and unpleasant feelings were close to even (${pct(p)} pleasant).`,
    );
  }
  if (prev && prev.mood !== null && k.mood !== null && Math.abs(k.mood - prev.mood) >= 0.3)
    out.push(`Your average mood is ${k.mood > prev.mood ? 'up' : 'down'} ${Math.abs(k.mood - prev.mood).toFixed(1)} compared with the ${rangeName} before.`);
  const top = s.exact[0];
  if (top && top.count > 1) out.push(`${label(top.id)} came up most often (${top.count}×).`);

  const wd = s.weekdays.filter((w) => w.mood !== null && w.n >= 2).sort((a, b) => b.mood! - a.mood!);
  if (wd.length >= 3 && wd[0].mood! - wd[wd.length - 1].mood! >= 1)
    out.push(`${full(wd[0].day)} tend to feel best (${fmtMood(wd[0].mood)}); ${full(wd[wd.length - 1].day)} are the hardest (${fmtMood(wd[wd.length - 1].mood)}).`);

  const dp = [...s.dayparts].sort((a, b) => b.n - a.n)[0];
  if (dp.n >= 3) out.push(`You check in most in the ${dp.name.toLowerCase()}.`);

  const t = s.transitions[0];
  if (t && t.count >= 2) out.push(`After ${shortName(t.from)}, the next thing you felt was most often ${shortName(t.to)}.`);

  const before = dex(entries.filter((e) => e.date < s.start));
  const fresh = [...dex(s.list).keys()].filter((id) => !before.has(id));
  if (fresh.length) out.push(`You named ${fresh.length} new feeling${fresh.length > 1 ? 's' : ''} in this period: ${fresh.slice(0, 3).map(label).join(', ')}${fresh.length > 3 ? '…' : ''}.`);
  return out;
}
const full = (d: string) => ({ Mon: 'Mondays', Tue: 'Tuesdays', Wed: 'Wednesdays', Thu: 'Thursdays', Fri: 'Fridays', Sat: 'Saturdays', Sun: 'Sundays' })[d];

