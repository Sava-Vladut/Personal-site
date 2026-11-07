// Workouts: the plans you train by, the workouts you log, your body weight over time and the exercises you add yourself.
// Only the data and its maths live here (nothing stored): store.ts keeps the four synced collections, lib/exercises.ts
// the exercise database, views/Workout.tsx the page you train on and views/Training.tsx the numbers under Insights.
//
// Power (⚡) is what a set is worth: one point for every 10 kg lifted once.
// - Weights (barbell, dumbbells, machines, cables, kettlebells…): the weight on it, set in stone. A 20 kg rep is 2 ⚡ for
//   anyone. Dumbbells used in pairs count both.
// - Body moves: 15% of the share of your own body the move lifts, at your body weight. At 75 kg a push-up lifts about
//   64% of you, 48 kg, and counts as 7.2 kg: 0.72 ⚡ a rep, so 20 push-ups (14 ⚡) stay below 10 curls with a 10 kg
//   dumbbell in each hand (20 ⚡), up to about 100 kg of you. Your body is always there and takes no loading, so its reps come much easier and many
//   more of them; counted whole, a few push-ups outscored real lifting. The same push-up is still worth less to someone
//   lighter, as it should be.
// - Holds (a plank, a wall sit, a hang): counted like body moves, a rep for every 3 seconds held.
// - Cardio and stretching: by effort over time, METs × body weight × minutes ÷ 30, so half an hour's run at 75 kg
//   (about 9.8 METs) is about 735 ⚡, about what a solid hour of lifting comes to.
// Warm-up sets count half. A workout keeps the body weight it was done at, so weighing in later never changes the past.

/** The muscles the exercise database names, front to back, top to bottom. */
export const MUSCLES = [
  'neck', 'traps', 'shoulders', 'chest', 'biceps', 'triceps', 'forearms', 'lats', 'middle back', 'lower back', 'abdominals',
  'glutes', 'abductors', 'adductors', 'quadriceps', 'hamstrings', 'calves',
] as const;
export type Muscle = (typeof MUSCLES)[number];

/** How an exercise is logged, and so how its power is counted. */
export const KINDS = ['weight', 'body', 'time', 'cardio'] as const;
export type Kind = (typeof KINDS)[number];

/** What it's done with. */
export const EQUIPS = ['body', 'barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bands', 'ezbar', 'medball', 'ball', 'foam', 'other'] as const;
export type Equip = (typeof EQUIPS)[number];

/** The kind of training it is. */
export const CATS = ['strength', 'powerlifting', 'olympic', 'strongman', 'plyometrics', 'cardio', 'stretching'] as const;
export type Cat = (typeof CATS)[number];

export type Force = 'push' | 'pull' | 'static';

/** An exercise: one from the database (lib/exercises.ts), or one you made. */
export interface Move {
  id: string;            // the database's id ("Pushups", up to 80 letters, digits, _ and -), or "my" and a uid for one of yours
  name: string;
  kind: Kind;
  equip: Equip;
  cat: Cat;
  muscles: Muscle[];     // the ones it works most, the main one first
  also: Muscle[];        // the ones that help
  share: number;         // body moves and holds: the share of your body weight it lifts (0–1.2), 0 for the rest
  met: number;           // cardio and stretching: how hard, in METs, 0 for the rest
  pair: boolean;         // dumbbells: one in each hand, so the weight counts twice
  foot: boolean;         // a run or walk: with a distance, its effort comes from the pace
  level: 0 | 1 | 2;      // beginner, intermediate, expert
  force: Force | null;
  img: number;           // how many pictures the database has of it (none for yours)
}

/** One you made, kept and synced like the rest of your things. */
export interface MyMove extends Move { created: number; updated: number }

/** What a workout remembers of an exercise, as it was when it was added: enough to count and chart it without the database. */
export type Snap = Pick<Move, 'id' | 'name' | 'kind' | 'equip' | 'cat' | 'muscles' | 'also' | 'share' | 'met' | 'foot' | 'force'>;

export const TAGS = ['', 'warm', 'drop', 'fail'] as const;
/** A set's kind: a normal one, a warm-up (counts half), a drop set, or one taken to failure. */
export type Tag = (typeof TAGS)[number];

/** One set. Which numbers it uses depends on the exercise's kind. */
export interface WSet {
  kg: number | null;     // weight: the weight (each dumbbell, when a pair); body and holds: not used (older sets may hold added weight, now ignored)
  reps: number | null;   // weight and body
  secs: number | null;   // holds: how long held; cardio: how long
  km: number | null;     // cardio: how far
  tag: Tag;
  done: boolean;         // ticked off; only done sets count in a workout
}

/** An exercise in a plan or a workout, and its sets. */
export interface Item {
  move: Snap;
  sets: WSet[];
  pair: boolean;         // dumbbells: count the weight twice
  rest: number;          // seconds of rest after each set, 0 for no timer
  note: string;
}

/** A workout you do again and again, and the power it asks of you. */
export interface Routine {
  id: string;
  name: string;
  icon: string;          // an interface icon's name (ROUTINE_ICONS)
  target: number;        // the power it asks for, ⚡
  items: Item[];         // the exercises and the sets you plan for each
  created: number;
  updated: number;
}

/** A workout you did (or are doing: `end` is null until it's finished). */
export interface Workout {
  id: string;
  plan: string | null;   // the Routine it was started from
  name: string;
  icon: string;
  target: number;        // the power it asked for, ⚡ (0 = none)
  bw: number;            // your body weight then, kg
  start: number;
  end: number | null;
  items: Item[];
  feel: number;          // how it went, 1 (awful) to 5 (great), 0 not said
  note: string;
  created: number;
  updated: number;
}

/** Your body weight on a day. */
export interface WeighIn { id: string; day: string; kg: number; created: number; updated: number }

/** The icons a plan can wear. */
export const ROUTINE_ICONS = [
  'barbell', 'dumbbell', 'weight', 'run', 'bike', 'swimming', 'treadmill', 'jump-rope', 'yoga', 'stretching', 'stretching-2',
  'karate', 'gymnastics', 'walk', 'stairs-up', 'heartbeat', 'flame', 'bolt', 'target', 'trophy',
] as const;

/** Kilograms for one ⚡. */
export const KG_PER_POWER = 10;
/** Seconds held that count as one rep. */
export const HOLD_SECS = 3;
/** The part of what a body move lifts that counts toward power (see the top of this file). */
export const BODY_COUNTS = 0.15;
/** Body weight used until you weigh in. */
export const DEFAULT_BW = 75;
export const MIN_BW = 25;
export const MAX_BW = 350;

/* ---------- power ---------- */

/** What one rep of a set really lifts, kg (before reps): the weight, or the share of your body. */
export function repLoad(m: Pick<Snap, 'kind' | 'share'>, s: Pick<WSet, 'kg'>, bw: number, pair = false) {
  if (m.kind === 'weight') return Math.max(0, s.kg ?? 0) * (pair ? 2 : 1);
  if (m.kind === 'body' || m.kind === 'time') return Math.max(0, bw * m.share);
  return 0;
}

/** What one rep counts as toward power, kg: all of a weight, 15% of what a body move lifts. */
const powerLoad = (m: Pick<Snap, 'kind' | 'share'>, s: Pick<WSet, 'kg'>, bw: number, pair = false) =>
  repLoad(m, s, bw, pair) * (m.kind === 'weight' ? 1 : BODY_COUNTS);

/** The power of one set, ⚡ (unrounded). Warm-ups count half. */
export function setPower(m: Pick<Snap, 'kind' | 'share' | 'met' | 'foot'>, s: WSet, bw: number, pair = false) {
  let p = 0;
  if (m.kind === 'weight' || m.kind === 'body') p = (powerLoad(m, s, bw, pair) * Math.max(0, s.reps ?? 0)) / KG_PER_POWER;
  else if (m.kind === 'time') p = m.met && !m.share
    ? cardioPower(m.met, bw, s.secs ?? 0)
    : (powerLoad(m, s, bw) * Math.max(0, s.secs ?? 0)) / HOLD_SECS / KG_PER_POWER;
  else p = cardioPower(m.foot ? cardioMet(m.met, s) : m.met, bw, s.secs ?? 0);
  return s.tag === 'warm' ? p / 2 : p;
}

/** Power from effort over time: METs × kg × minutes ÷ 30. */
const cardioPower = (met: number, bw: number, secs: number) => (met * bw * Math.max(0, secs) / 60) / 30;

/**
 * How hard a run or walk was, METs. With a distance, it's worked out from the pace (the ACSM's equations:
 * oxygen = 3.5 + 0.2 × m/min running, + 0.1 × m/min walking, and 3.5 is one MET); otherwise the exercise's own.
 */
export function cardioMet(met: number, s: Pick<WSet, 'km' | 'secs'>) {
  if (!s.km || !s.secs || s.km <= 0 || s.secs <= 0) return met;
  const mPerMin = (s.km * 1000) / (s.secs / 60);
  if (mPerMin < 30 || mPerMin > 600) return met; // a typo, or not on foot
  const running = mPerMin > 134; // above about 8 km/h, people run
  return (3.5 + (running ? 0.2 : 0.1) * mPerMin) / 3.5;
}

/** The power of one rep (body and weight moves), ⚡: what the page shows beside an exercise. */
export const repPower = (m: Pick<Snap, 'kind' | 'share'>, s: Pick<WSet, 'kg'>, bw: number, pair = false) => powerLoad(m, s, bw, pair) / KG_PER_POWER;

/** An exercise's power in a workout: its done sets (or, for a plan, all its sets). */
export const itemPower = (it: Item, bw: number, all = false) =>
  it.sets.reduce((sum, s) => sum + (all || s.done ? setPower(it.move, s, bw, it.pair) : 0), 0);

/** A workout's power, ⚡ (unrounded). */
export const workoutPower = (w: Pick<Workout, 'items' | 'bw'>) => w.items.reduce((sum, it) => sum + itemPower(it, w.bw), 0);

/** What a plan is worth if every set in it is done, at a body weight. */
export const planPower = (r: Pick<Routine, 'items'>, bw: number) => r.items.reduce((sum, it) => sum + itemPower(it, bw, true), 0);

/** Power as it's shown: whole points, with one decimal below 10. */
export const fmtPower = (p: number) => (p > 0 && p < 10 ? (Math.round(p * 10) / 10).toString() : Math.round(p).toLocaleString());

/**
 * The power to ask of a plan: what its sets add up to, or 5% more than the last time it was done when that was more,
 * rounded up to the next 10.
 */
export function suggestTarget(r: Pick<Routine, 'items'>, bw: number, last?: number) {
  const p = Math.max(planPower(r, bw), last ? last * 1.05 : 0);
  return p > 0 ? Math.ceil(p / 10) * 10 : 0;
}

/** Whether a finished workout reached the power it asked for. */
export const metTarget = (w: Workout, power = workoutPower(w)) => w.target > 0 && power >= w.target;

/* ---------- strength ---------- */

/** Estimated one-rep max (Epley: kg × (1 + reps ÷ 30)), for weighted sets of 1 to 12 reps. */
export function oneRepMax(kg: number, reps: number) {
  if (!(kg > 0) || !(reps >= 1) || reps > 12) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

/** Total weight moved by a set, kg: load × reps (holds and cardio move none). */
export const setVolume = (m: Pick<Snap, 'kind' | 'share'>, s: WSet, bw: number, pair = false) =>
  m.kind === 'weight' || m.kind === 'body' ? repLoad(m, s, bw, pair) * Math.max(0, s.reps ?? 0) : 0;

/** A set with nothing in it yet, shaped for its exercise's kind, or copying the last one. */
export function blankSet(kind: Kind, last?: WSet): WSet {
  if (last) return { ...last, tag: last.tag === 'warm' ? '' : last.tag, done: false };
  return { kg: null, reps: null, secs: kind === 'cardio' ? 600 : kind === 'time' ? 30 : null, km: null, tag: '', done: false };
}

/** The day a workout was on, 'YYYY-MM-DD' in this device's time. */
export function dayOf(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Your body weight on a day: the last weigh-in on or before it, else the first one after, else the default. */
export function weightOn(list: WeighIn[], day: string) {
  let before: WeighIn | null = null, after: WeighIn | null = null;
  for (const w of list) {
    if (w.day <= day) { if (!before || w.day > before.day || (w.day === before.day && w.updated > before.updated)) before = w; }
    else if (!after || w.day < after.day) after = w;
  }
  return (before ?? after)?.kg ?? DEFAULT_BW;
}

/* ---------- reading untrusted copies (a backup, another device) ---------- */

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const id40 = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 40;
const numOr = (v: unknown, min: number, max: number, or: number | null = null) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : or);
const time = (v: unknown, or: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : or);
const oneOf = <T extends string>(list: readonly T[], v: unknown, or: T): T => (list.includes(v as T) ? (v as T) : or);
const muscles = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((m): m is Muscle => MUSCLES.includes(m as Muscle)))].slice(0, MUSCLES.length) : []);
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const MAX_ITEMS = 60;
export const MAX_SETS = 50;

export function normalizeSnap(raw: any): Snap | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(raw.id)) return null;
  const name = str(raw.name, 120).trim();
  if (!name) return null;
  return {
    id: raw.id,
    name,
    kind: oneOf(KINDS, raw.kind, 'weight'),
    equip: oneOf(EQUIPS, raw.equip, 'other'),
    cat: oneOf(CATS, raw.cat, 'strength'),
    muscles: muscles(raw.muscles),
    also: muscles(raw.also),
    share: numOr(raw.share, 0, 1.5, 0)!,
    met: numOr(raw.met, 0, 25, 0)!,
    foot: raw.foot === true,
    force: raw.force === 'push' || raw.force === 'pull' || raw.force === 'static' ? raw.force : null,
  };
}

function normalizeSet(raw: any): WSet | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    kg: numOr(raw.kg, -500, 1000),
    reps: numOr(raw.reps, 0, 10_000),
    secs: numOr(raw.secs, 0, 86_400),
    km: numOr(raw.km, 0, 1000),
    tag: oneOf(TAGS, raw.tag, ''),
    done: raw.done === true,
  };
}

function normalizeItem(raw: any): Item | null {
  if (!raw || typeof raw !== 'object') return null;
  const move = normalizeSnap(raw.move);
  if (!move) return null;
  return {
    move,
    sets: (Array.isArray(raw.sets) ? raw.sets.map(normalizeSet).filter(Boolean) as WSet[] : []).slice(0, MAX_SETS),
    pair: raw.pair === true,
    rest: Math.round(numOr(raw.rest, 0, 3600, 0)!),
    note: str(raw.note, 2000),
  };
}
const items = (v: unknown) => (Array.isArray(v) ? v.map(normalizeItem).filter(Boolean) as Item[] : []).slice(0, MAX_ITEMS);
const icon = (v: unknown) => oneOf(ROUTINE_ICONS, v, 'barbell');

export function normalizeRoutine(raw: any): Routine | null {
  if (!raw || typeof raw !== 'object' || !id40(raw.id)) return null;
  const now = Date.now();
  return {
    id: raw.id,
    name: str(raw.name, 120),
    icon: icon(raw.icon),
    target: Math.round(numOr(raw.target, 0, 1_000_000, 0)!),
    items: items(raw.items),
    created: time(raw.created, now),
    updated: time(raw.updated, now),
  };
}

export function normalizeWorkout(raw: any): Workout | null {
  if (!raw || typeof raw !== 'object' || !id40(raw.id)) return null;
  const now = Date.now();
  const start = time(raw.start, 0);
  if (!start) return null;
  const end = typeof raw.end === 'number' && Number.isFinite(raw.end) && raw.end >= start ? raw.end : null;
  return {
    id: raw.id,
    plan: id40(raw.plan) ? raw.plan : null,
    name: str(raw.name, 120),
    icon: icon(raw.icon),
    target: Math.round(numOr(raw.target, 0, 1_000_000, 0)!),
    bw: numOr(raw.bw, MIN_BW, MAX_BW, DEFAULT_BW)!,
    start,
    end,
    items: items(raw.items),
    feel: Math.round(numOr(raw.feel, 0, 5, 0)!),
    note: str(raw.note, 20_000),
    created: time(raw.created, now),
    updated: time(raw.updated, now),
  };
}

export function normalizeWeighIn(raw: any): WeighIn | null {
  if (!raw || typeof raw !== 'object' || !id40(raw.id) || !isDay(raw.day)) return null;
  const kg = numOr(raw.kg, MIN_BW, MAX_BW);
  if (kg === null) return null;
  const now = Date.now();
  return { id: raw.id, day: raw.day, kg, created: time(raw.created, now), updated: time(raw.updated, now) };
}

export function normalizeMyMove(raw: any): MyMove | null {
  const snap = normalizeSnap(raw);
  if (!snap || !/^my[a-z0-9]{1,38}$/.test(snap.id)) return null;
  const now = Date.now();
  return {
    ...snap,
    pair: raw.pair === true,
    level: raw.level === 1 || raw.level === 2 ? raw.level : 0,
    img: 0,
    created: time(raw.created, now),
    updated: time(raw.updated, now),
  };
}

/** The part of an exercise a workout keeps. */
export const snapOf = (m: Move): Snap => ({
  id: m.id, name: m.name, kind: m.kind, equip: m.equip, cat: m.cat, muscles: m.muscles, also: m.also, share: m.share, met: m.met, foot: m.foot, force: m.force,
});
