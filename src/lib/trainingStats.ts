// The numbers under Insights › Workouts (views/Training.tsx): what the workouts you finished add up to, week by week,
// muscle by muscle and exercise by exercise, and the records in them. Plain maths over lib/fitness.ts's types, with no
// preact and no words in it, so scripts/test-training.mjs runs it as it is. Only finished workouts count, and in them
// only the sets that were ticked off; warm-ups count for power (half, as everywhere) but never set a record.

import { KINDS, MUSCLES, dayOf, itemPower, metTarget, oneRepMax, setPower, workoutPower, type Item, type Kind, type Muscle, type Snap, type WeighIn, type Workout, type WSet } from './fitness';

/* ---------- days ('YYYY-MM-DD', in this device's time, as lib/fitness.ts's dayOf writes them) ---------- */

const dateOf = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** The day n days after k (before it, when n is negative). */
export const addDay = (k: string, n: number) => {
  const d = dateOf(k);
  d.setDate(d.getDate() + n);
  return dayOf(d.getTime());
};
/** Whole days from a to b (rounded, so a change of clocks in between doesn't matter). */
export const daysBetween = (a: string, b: string) => Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 864e5);
/** The first day of k's week, which starts on a Monday (1) or a Sunday (0). */
export const weekOf = (k: string, weekStart: 0 | 1) => addDay(k, -((dateOf(k).getDay() - weekStart + 7) % 7));

/* ---------- a finished workout, added up once ---------- */

const noKinds = (): Record<Kind, number> => ({ weight: 0, body: 0, time: 0, cardio: 0 });

export interface Done {
  w: Workout;
  day: string;                  // the day it started on
  power: number;                // ⚡
  mins: number;                 // how long it took
  met: boolean;                 // reached its target (false when it had none)
  sets: number;                 // sets ticked off
  kinds: Record<Kind, number>;  // the ⚡ from each kind of exercise
}

export function summarize(w: Workout): Done {
  const kinds = noKinds();
  let sets = 0;
  for (const it of w.items) {
    kinds[it.move.kind] += itemPower(it, w.bw);
    for (const s of it.sets) if (s.done) sets++;
  }
  // the total as the Workout page counts it, so "met" here is "met" there to the last decimal
  const power = workoutPower(w);
  return { w, day: dayOf(w.start), power, mins: Math.max(0, ((w.end ?? w.start) - w.start) / 60_000), met: metTarget(w, power), sets, kinds };
}

/** The finished workouts, added up, newest first (as the store keeps them). */
export const finished = (list: Workout[]) => list.filter((w) => w.end !== null).map(summarize);

/* ---------- ranges ---------- */

export type RangeKey = '4w' | '3m' | '1y' | 'all';
export const RANGE_KEYS: readonly RangeKey[] = ['4w', '3m', '1y', 'all'];
const RANGE_WEEKS = { '4w': 4, '3m': 13, '1y': 52 } as const;

export interface Span { start: string; end: string }
export interface Range extends Span { key: RangeKey; prev: Span | null }

/**
 * The days a range covers: whole weeks back from this one, up to today, so each bar of the week chart is a whole week.
 * The range it's compared with is as many weeks before it, cut at the same point of its last week: a week that has only
 * begun is matched with as much of the week it's set against. All time starts with the week of the first workout.
 */
export function rangeOf(key: RangeKey, today: string, weekStart: 0 | 1, first: string | null = null): Range {
  if (key === 'all') return { key, start: weekOf(first && first < today ? first : today, weekStart), end: today, prev: null };
  const weeks = RANGE_WEEKS[key];
  const start = addDay(weekOf(today, weekStart), -7 * (weeks - 1));
  const before = addDay(start, -7 * weeks);
  return { key, start, end: today, prev: { start: before, end: addDay(before, daysBetween(start, today)) } };
}

export const within = (list: Done[], s: Span) => list.filter((d) => d.day >= s.start && d.day <= s.end);

/* ---------- totals and averages ---------- */

export interface Totals { workouts: number; power: number; targeted: number; met: number; mins: number; sets: number; feel: number | null }

export function totals(list: Done[]): Totals {
  let power = 0, targeted = 0, met = 0, mins = 0, sets = 0, feel = 0, felt = 0;
  for (const d of list) {
    power += d.power;
    mins += d.mins;
    sets += d.sets;
    if (d.w.target > 0) targeted++;
    if (d.met) met++;
    if (d.w.feel > 0) (feel += d.w.feel), felt++;
  }
  return { workouts: list.length, power, targeted, met, mins, sets, feel: felt ? feel / felt : null };
}

/** The share of the workouts that asked for power that got it, 0–1, or null when none asked. */
export const metShare = (t: Totals) => (t.targeted ? t.met / t.targeted : null);

export interface Averages { mins: number; power: number; perMin: number; sets: number; feel: number | null }

/** A typical workout: how long, how much ⚡, how fast it came, how many sets and how it felt (1–5, of those you rated). */
export function averages(t: Totals): Averages | null {
  if (!t.workouts) return null;
  return { mins: t.mins / t.workouts, power: t.power / t.workouts, perMin: t.mins > 0 ? t.power / t.mins : 0, sets: t.sets / t.workouts, feel: t.feel };
}

/* ---------- weeks, days and hours ---------- */

export interface Week { key: string; power: number; workouts: number; targeted: number; met: number }

/** Every week of the span, oldest first, the empty ones too (a gap is part of the story). */
export function weeks(list: Done[], s: Span, weekStart: 0 | 1): Week[] {
  const out: Week[] = [];
  const at = new Map<string, Week>();
  for (let k = weekOf(s.start, weekStart), last = weekOf(s.end, weekStart); k <= last; k = addDay(k, 7)) {
    const w = { key: k, power: 0, workouts: 0, targeted: 0, met: 0 };
    out.push(w);
    at.set(k, w);
  }
  for (const d of list) {
    const w = d.day >= s.start && d.day <= s.end ? at.get(weekOf(d.day, weekStart)) : undefined;
    if (!w) continue;
    w.power += d.power;
    w.workouts++;
    if (d.w.target > 0) w.targeted++;
    if (d.met) w.met++;
  }
  return out;
}

/** A week in which every workout that asked for power got it. */
export const weekMet = (w: Week) => w.targeted > 0 && w.met === w.targeted;

export interface DayTotal { power: number; workouts: number }

export function byDay(list: Done[]) {
  const out = new Map<string, DayTotal>();
  for (const d of list) {
    const x = out.get(d.day) ?? { power: 0, workouts: 0 };
    x.power += d.power;
    x.workouts++;
    out.set(d.day, x);
  }
  return out;
}

/** When workouts start: a row for each weekday (Monday first) and a column for each three hours of the day. */
export function whenHeat(list: Done[]) {
  const heat = Array.from({ length: 7 }, () => new Array<number>(8).fill(0));
  let max = 0;
  for (const d of list) {
    const at = new Date(d.w.start);
    const row = heat[(at.getDay() + 6) % 7];
    const col = Math.floor(at.getHours() / 3);
    max = Math.max(max, ++row[col]);
  }
  return { heat, max };
}

/** The ⚡ that came from each kind of exercise. */
export function kindPower(list: Done[]) {
  const out = noKinds();
  for (const d of list) for (const k of KINDS) out[k] += d.kinds[k];
  return out;
}

/* ---------- streaks ---------- */

export interface Streaks {
  weeks: number;         // weeks in a row with a workout, up to this one (or the last, while this one has none yet)
  bestWeeks: number;
  targets: number;       // the last workouts that asked for power, in a row, that got it
  bestTargets: number;
  lastWeeks: boolean[];  // the last 8 weeks, oldest first: trained or not
  lastTargets: boolean[];// the last 8 workouts with a target, oldest first: met or not
}

export function streaks(all: Done[], today: string, weekStart: 0 | 1): Streaks {
  const trained = new Set(all.map((d) => weekOf(d.day, weekStart)));
  const thisWeek = weekOf(today, weekStart);
  let weeks = 0;
  // this week isn't over, so a run that reached last week still stands
  for (let k = trained.has(thisWeek) ? thisWeek : addDay(thisWeek, -7); trained.has(k); k = addDay(k, -7)) weeks++;
  let bestWeeks = 0, run = 0, prev = '';
  for (const k of [...trained].sort()) {
    run = prev && addDay(prev, 7) === k ? run + 1 : 1;
    bestWeeks = Math.max(bestWeeks, run);
    prev = k;
  }
  // workouts without a target neither keep a run of targets going nor break it
  const asked = all.filter((d) => d.w.target > 0).sort((a, b) => a.w.start - b.w.start);
  let bestTargets = 0;
  run = 0;
  for (const d of asked) {
    run = d.met ? run + 1 : 0;
    bestTargets = Math.max(bestTargets, run);
  }
  return {
    weeks, bestWeeks, targets: run, bestTargets,
    lastWeeks: Array.from({ length: 8 }, (_, i) => trained.has(addDay(thisWeek, -7 * (7 - i)))),
    lastTargets: asked.slice(-8).map((d) => d.met),
  };
}

/* ---------- muscles ---------- */

/** How much of a set each muscle an exercise names gets: a whole one for the muscles it works most, half for the ones that help. */
function shares(m: Pick<Snap, 'muscles' | 'also'>) {
  const out = new Map<Muscle, number>();
  for (const x of m.also) out.set(x, 0.5);
  for (const x of m.muscles) out.set(x, 1);
  return out;
}

export interface MuscleLoad {
  sets: number;          // sets: whole for the muscles an exercise works most, half for the ones that help
  power: number;         // its part of the ⚡, shared out in the same proportions (so the muscles add up to the workouts)
  last: string | null;   // the last day it was worked
}

const doneSets = (it: Item) => it.sets.reduce((n, s) => n + (s.done ? 1 : 0), 0);

export function muscleLoad(list: Done[], only?: Muscle): Record<Muscle, MuscleLoad> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, { sets: 0, power: 0, last: null }])) as Record<Muscle, MuscleLoad>;
  for (const d of list) for (const it of d.w.items) {
    const n = doneSets(it);
    if (!n) continue;
    const sh = shares(it.move);
    if (only && !sh.has(only)) continue;
    let whole = 0;
    sh.forEach((v) => (whole += v));
    if (!whole) continue;
    const p = itemPower(it, d.w.bw);
    sh.forEach((v, m) => {
      const x = out[m];
      if (!x) return;
      x.sets += n * v;
      x.power += (p * v) / whole;
      if (!x.last || d.day > x.last) x.last = d.day;
    });
  }
  return out;
}

/** Each muscle's sets as a share of the most worked one's, 0–1, for the body map (unworked muscles left out). */
export function muscleHeat(load: Record<Muscle, MuscleLoad>) {
  const max = Math.max(0, ...MUSCLES.map((m) => load[m].sets));
  const out: Partial<Record<Muscle, number>> = {};
  if (max > 0) for (const m of MUSCLES) if (load[m].sets > 0) out[m] = load[m].sets / max;
  return out;
}

/** The sets of each group of muscles (push, pull, legs, core: the map is the page's, components/fitness.tsx). */
export function groupLoad<G extends string>(load: Record<Muscle, MuscleLoad>, groupOf: Record<Muscle, G>) {
  const out = {} as Record<G, number>;
  for (const m of MUSCLES) out[groupOf[m]] = (out[groupOf[m]] ?? 0) + load[m].sets;
  return out;
}

/** The muscles you've worked, the longest rested first, and the ones you never have. Give it all-time load. */
export function rested(load: Record<Muscle, MuscleLoad>, today: string) {
  const worked = MUSCLES.filter((m) => load[m].last).map((m) => ({ muscle: m, days: Math.max(0, daysBetween(load[m].last!, today)) }));
  worked.sort((a, b) => b.days - a.days || MUSCLES.indexOf(a.muscle) - MUSCLES.indexOf(b.muscle));
  return { worked, never: MUSCLES.filter((m) => !load[m].last) };
}

/** The exercises that worked a muscle, the most sets (as the muscle counts them) first. */
export function movesFor(list: Done[], muscle: Muscle) {
  const by = new Map<string, { move: Snap; sets: number; power: number }>();
  for (const d of list) for (const it of d.w.items) {
    const v = shares(it.move).get(muscle);
    const n = doneSets(it);
    if (!v || !n) continue;
    const x = by.get(it.move.id) ?? { move: it.move, sets: 0, power: 0 };
    x.sets += n * v;
    x.power += itemPower(it, d.w.bw);
    by.set(it.move.id, x);
  }
  return [...by.values()].sort((a, b) => b.sets - a.sets || b.power - a.power);
}

/* ---------- exercises and their records ---------- */

/** A best: its value, the day and the workout it came in, and the set when it's a set's. */
export interface Rec { value: number; day: string; id: string; set?: WSet }
export interface Point { day: string; value: number; id: string }

export interface MoveStats {
  move: Snap;              // as it was the last time it was done
  times: number;           // workouts it was done in
  sets: number;
  power: number;           // all its ⚡
  last: string;            // the day it was last done
  best1rm: Rec | null;     // weights: the best estimated one-rep max (Epley, sets of 1–12)
  heaviest: Rec | null;    // weights: the most weight on it
  mostReps: Rec | null;    // weights and body moves: the most reps in a set
  bestSet: Rec | null;     // the most ⚡ in one set
  bestDay: Rec | null;     // the most ⚡ from it in one workout
  longest: Rec | null;     // holds and cardio: the longest set, seconds
  farthest: Rec | null;    // cardio: the farthest, km
  oneRm: Point[];          // the best estimated one-rep max of each workout, oldest first
  setPower: Point[];       // the best set ⚡ of each workout, oldest first
  recent: { id: string; day: string; start: number; bw: number; pair: boolean; sets: WSet[] }[]; // the last five workouts, newest first
}

const better = (r: Rec | null, value: number, d: Done, set?: WSet): Rec | null =>
  value > 0 && (!r || value > r.value + 1e-9) ? { value, day: d.day, id: d.w.id, ...(set ? { set } : {}) } : r;

/** The exercises in a workout, each with all its items (one done twice, as a superset, is still one exercise). */
function byMove(w: Workout) {
  const out = new Map<string, Item[]>();
  for (const it of w.items) {
    const list = out.get(it.move.id);
    if (list) list.push(it);
    else out.set(it.move.id, [it]);
  }
  return out;
}

/** Every exercise you've done, the most done first. */
export function moveStats(list: Done[]): MoveStats[] {
  const by = new Map<string, MoveStats>();
  for (const d of [...list].sort((a, b) => a.w.start - b.w.start)) {
    byMove(d.w).forEach((items, id) => {
      const done = items.flatMap((it) => it.sets.filter((s) => s.done).map((s) => ({ s, it })));
      if (!done.length) return;
      const move = items[items.length - 1].move;
      let x = by.get(id);
      if (!x) {
        x = { move, times: 0, sets: 0, power: 0, last: d.day, best1rm: null, heaviest: null, mostReps: null, bestSet: null, bestDay: null, longest: null, farthest: null, oneRm: [], setPower: [], recent: [] };
        by.set(id, x);
      }
      x.move = move;
      x.times++;
      x.sets += done.length;
      x.last = d.day;
      const p = items.reduce((sum, it) => sum + itemPower(it, d.w.bw), 0);
      x.power += p;
      x.bestDay = better(x.bestDay, p, d);
      let e1 = 0, sp = 0;
      for (const { s, it } of done) {
        if (s.tag === 'warm') continue;
        const k = it.move.kind;
        const pw = setPower(it.move, s, d.w.bw, it.pair);
        sp = Math.max(sp, pw);
        x.bestSet = better(x.bestSet, pw, d, s);
        if (k === 'weight') {
          const rm = oneRepMax(s.kg ?? 0, s.reps ?? 0);
          e1 = Math.max(e1, rm);
          x.best1rm = better(x.best1rm, rm, d, s);
          x.heaviest = better(x.heaviest, s.kg ?? 0, d, s);
        }
        if (k === 'weight' || k === 'body') x.mostReps = better(x.mostReps, s.reps ?? 0, d, s);
        if (k === 'time' || k === 'cardio') x.longest = better(x.longest, s.secs ?? 0, d, s);
        if (k === 'cardio') x.farthest = better(x.farthest, s.km ?? 0, d, s);
      }
      if (e1 > 0) x.oneRm.push({ day: d.day, value: e1, id: d.w.id });
      if (sp > 0) x.setPower.push({ day: d.day, value: sp, id: d.w.id });
      x.recent.unshift({ id: d.w.id, day: d.day, start: d.w.start, bw: d.w.bw, pair: items.some((it) => it.pair), sets: done.map((x) => x.s) });
      if (x.recent.length > 5) x.recent.pop();
    });
  }
  return [...by.values()].sort((a, b) => b.times - a.times || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0));
}

/** What an exercise's progress is charted by: the estimated one-rep max for weights that have one, else the best set ⚡. */
export const trendOf = (m: MoveStats) => (m.oneRm.length ? m.oneRm : m.setPower);

/**
 * The workouts that broke one of their exercises' records (more ⚡ in a set, a better estimated one-rep max, more weight,
 * more reps, a longer hold or run than any workout before), and for how many of their exercises. An exercise's first
 * workout breaks nothing: there was nothing to beat yet, and nor does a first for one kind of best (the first set with
 * a weight on a move done without one before).
 */
export function recordBreaks(list: Done[]): Map<string, number> {
  const best = new Map<string, number[]>();
  const out = new Map<string, number>();
  for (const d of [...list].sort((a, b) => a.w.start - b.w.start)) {
    let broke = 0;
    byMove(d.w).forEach((items, id) => {
      const v = [0, 0, 0, 0, 0]; // set ⚡, one-rep max, weight, reps, seconds
      let any = false;
      for (const it of items) for (const s of it.sets) {
        if (!s.done || s.tag === 'warm') continue;
        any = true;
        const k = it.move.kind;
        v[0] = Math.max(v[0], setPower(it.move, s, d.w.bw, it.pair));
        if (k === 'weight') {
          v[1] = Math.max(v[1], oneRepMax(s.kg ?? 0, s.reps ?? 0));
          v[2] = Math.max(v[2], s.kg ?? 0);
        }
        if (k === 'weight' || k === 'body') v[3] = Math.max(v[3], s.reps ?? 0);
        if (k === 'time' || k === 'cardio') v[4] = Math.max(v[4], s.secs ?? 0);
      }
      if (!any) return;
      const b = best.get(id);
      if (b && v.some((x, i) => b[i] > 0 && x > b[i] + 1e-9)) broke++;
      best.set(id, b ? b.map((x, i) => Math.max(x, v[i])) : v);
    });
    if (broke) out.set(d.w.id, broke);
  }
  return out;
}

/* ---------- the bests of all time ---------- */

export interface Wall {
  mostPower: Done | null;
  longest: Done | null;
  mostSets: Done | null;
  bestWeek: { key: string; power: number; workouts: number } | null;
  busiestWeek: { key: string; power: number; workouts: number } | null;
  /** the lifts you do most, with their best estimated one-rep max */
  lifts: MoveStats[];
}

export function wall(list: Done[], moves: MoveStats[], weekStart: 0 | 1): Wall {
  let mostPower: Done | null = null, longest: Done | null = null, mostSets: Done | null = null;
  const wk = new Map<string, { key: string; power: number; workouts: number }>();
  for (const d of list) {
    if (d.power > 0 && (!mostPower || d.power > mostPower.power)) mostPower = d;
    if (d.mins > 0 && (!longest || d.mins > longest.mins)) longest = d;
    if (d.sets > 0 && (!mostSets || d.sets > mostSets.sets)) mostSets = d;
    const k = weekOf(d.day, weekStart);
    const x = wk.get(k) ?? { key: k, power: 0, workouts: 0 };
    x.power += d.power;
    x.workouts++;
    wk.set(k, x);
  }
  let bestWeek: Wall['bestWeek'] = null, busiestWeek: Wall['busiestWeek'] = null;
  wk.forEach((x) => {
    if (x.power > 0 && (!bestWeek || x.power > bestWeek.power)) bestWeek = x;
    if (!busiestWeek || x.workouts > busiestWeek.workouts || (x.workouts === busiestWeek.workouts && x.power > busiestWeek.power)) busiestWeek = x;
  });
  const lifts = moves.filter((m) => m.best1rm).sort((a, b) => b.times - a.times || b.best1rm!.value - a.best1rm!.value).slice(0, 6);
  return { mostPower, longest, mostSets, bestWeek, busiestWeek, lifts };
}

/* ---------- body weight ---------- */

export interface WeightPoint { day: string; kg: number; logged: boolean }

/**
 * Your body weight over the span: the weigh-ins (the last of a day), and, while there are fewer than two of them to
 * draw a line through, the weight each workout was done at on the days between (`logged` false).
 */
export function weightSeries(weighIns: WeighIn[], list: Done[], s: Span): WeightPoint[] {
  const days = new Map<string, WeighIn>();
  for (const w of weighIns) {
    if (w.day < s.start || w.day > s.end) continue;
    const o = days.get(w.day);
    if (!o || w.updated > o.updated) days.set(w.day, w);
  }
  const out: WeightPoint[] = [...days.values()].map((w) => ({ day: w.day, kg: w.kg, logged: true }));
  if (out.length < 2) {
    const seen = new Set(days.keys());
    for (const d of [...list].sort((a, b) => a.w.start - b.w.start)) {
      if (d.day < s.start || d.day > s.end || seen.has(d.day)) continue;
      seen.add(d.day);
      out.push({ day: d.day, kg: d.w.bw, logged: false });
    }
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}
