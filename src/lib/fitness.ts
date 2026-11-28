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
// Every set ticked off counts, more or less for its form: short rests, reps in the growth range, beating last time and
// variety earn more, the same muscle over and over and long breaks less (see "form" further down).
// A workout keeps the body weight it was done at, so weighing in later never changes the past.

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
  at?: number;           // a workout's set: when it was ticked off (ms), so the rest before it can be timed
  beat?: number;         // a workout's set: what last time's same set scored (setScore), to see it beaten; 0 for none
  boost?: number;        // a workout's set: what its form made of its power (see "form" below), 1 or missing for nothing
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
  /** Hours since each muscle was last trained (2+ sets as its main muscle), as it was when the workout started, for the
   *  ones trained in the 7 days before. Missing on workouts from before form counted. */
  since?: Partial<Record<Muscle, number>>;
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

/** The power of one set, ⚡ (unrounded). */
export function setPower(m: Pick<Snap, 'kind' | 'share' | 'met' | 'foot'>, s: WSet, bw: number, pair = false) {
  let p = 0;
  if (m.kind === 'weight' || m.kind === 'body') p = (powerLoad(m, s, bw, pair) * Math.max(0, s.reps ?? 0)) / KG_PER_POWER;
  else if (m.kind === 'time') p = m.met && !m.share
    ? cardioPower(m.met, bw, s.secs ?? 0)
    : (powerLoad(m, s, bw) * Math.max(0, s.secs ?? 0)) / HOLD_SECS / KG_PER_POWER;
  else p = cardioPower(m.foot ? cardioMet(m.met, s) : m.met, bw, s.secs ?? 0);
  return p * (s.boost ?? 1);
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

/** A set as one still to do: not ticked, and nothing kept of when it was or what its form earned. */
export function undone(s: WSet): WSet {
  const { at: _a, beat: _b, boost: _x, ...rest } = s;
  return { ...rest, done: false };
}

/** A set with nothing in it yet, shaped for its exercise's kind, or copying the last one. */
export function blankSet(kind: Kind, last?: WSet): WSet {
  if (last) return { ...undone(last), tag: last.tag === 'warm' ? '' : last.tag };
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

/* ---------- form: what training well adds to a set's power, and what training badly takes off ---------- */
//
// A workout's sets earn more or less than their bare power for how they were done, the way the research on building
// muscle says works best:
// - Short rest: the next set within about 2½ minutes of the last (another minute when changing exercise, and when it's
//   a heavy barbell lift for the legs or back) earns 15%. Rests of a minute or two grow muscle about as well as long ones
//   and keep the workout dense; past 8 minutes the muscle has cooled off. Sets ticked off together aren't timed.
// - Reps in the growth range, 6 to 15, earn 10%. 1 to 3 reps lose 10% (heavy singles build strength more than size and
//   are the riskiest), more than 30 lose some (that's endurance: add weight or a harder version).
// - Beating last time's same set (more weight, more reps, or longer) earns 15%: progressive overload.
// - Variety: the same main muscle again and again loses more with each set past four in a row (switch muscle and it
//   starts over), and past ten sets of one muscle in a workout the rest count half: a session can't use more.
// - Recovery: a muscle not trained in a week earns 10%, one trained in the last 48 hours loses 15%.
// A set's form is all of these multiplied, kept between ×0.4 and ×1.5, and stored on it (`boost`) when it changes, so
// every place that counts power counts it the same. Cardio and stretching keep their bare power.

/** A set's form is kept between these. */
export const FORM_MIN = 0.4;
export const FORM_MAX = 1.5;
/** Hours back that a muscle's last training is remembered when a workout starts: a week. */
export const SINCE_HOURS = 168;

/** Why a set's form went up or down. */
export type FormWhy = 'rest' | 'quick' | 'long' | 'cold' | 'range' | 'heavy' | 'light' | 'beat' | 'row' | 'cap' | 'fresh' | 'sore';
/** One reason, what it multiplies the set's power by and (in a row, past the cap) how many sets it's been. */
export interface FormHit { why: FormWhy; f: number; n?: number }
/** One done set's form: where it is, when it was ticked, everything that touched it and what they come to. */
export interface SetForm { i: number; k: number; at: number; f: number; hits: FormHit[]; raw: number }

/** What counts as "the same kind of exercise" for variety: its main muscle (or the exercise, with none). Cardio and stretching don't count. */
export const formGroup = (m: Pick<Snap, 'kind' | 'cat' | 'muscles' | 'id'>): string | null =>
  m.kind === 'cardio' || m.cat === 'cardio' || m.cat === 'stretching' ? null : m.muscles[0] ?? m.id;

/** A set as one number to beat next time: a lift's estimated max (heavier or more reps both raise it), reps, or seconds held. */
export function setScore(m: Pick<Snap, 'kind'>, s: Pick<WSet, 'kg' | 'reps' | 'secs'>) {
  if (m.kind === 'weight') return (s.kg ?? 0) > 0 && (s.reps ?? 0) > 0 ? s.kg! * (1 + s.reps! / 30) : 0;
  if (m.kind === 'body') return Math.max(0, s.reps ?? 0);
  if (m.kind === 'time') return Math.max(0, s.secs ?? 0);
  return 0;
}

const HEAVY_MUSCLES: readonly string[] = ['quadriceps', 'hamstrings', 'glutes', 'lower back', 'middle back', 'lats'];
/** How long a set itself took, seconds: a hold or cardio its time, a set of reps not counted. */
const workSecs = (m: Pick<Snap, 'kind'>, s: WSet) => (m.kind === 'time' || m.kind === 'cardio' ? Math.max(0, s.secs ?? 0) : 0);

/** What the short-rest window grows by before a set of `to` after one of `from`: a minute for changing exercise, a minute before a heavy barbell lift for the legs or back. */
const restExtra = (from: Pick<Snap, 'id'>, to: Pick<Snap, 'id' | 'equip' | 'muscles'>) =>
  (from.id !== to.id ? 60 : 0) + (to.equip === 'barbell' && HEAVY_MUSCLES.includes(to.muscles[0] ?? '') ? 60 : 0);

/**
 * The seconds after ticking a set (of `from`) that the next one (of `to`) still earns the short-rest bonus: 2½ minutes,
 * what restExtra adds, and the time the next set itself takes when it's a hold.
 */
export function restWindow(from: Pick<Snap, 'id'>, to: Item) {
  const next = to.sets.find((s) => !s.done);
  return 150 + restExtra(from, to.move) + (next ? workSecs(to.move, next) : 0);
}

/** The rest before a set, as a reason (or none): `gap` is the seconds of rest, `extra` what restWindow adds past 2½ minutes. */
function restHit(gap: number, extra: number): FormHit | null {
  if (gap < 20) return null; // ticked off together, not timed
  if (gap < 45) return { why: 'quick', f: 1.05 };
  if (gap <= 150 + extra) return { why: 'rest', f: 1.15 };
  if (gap <= 240 + extra) return null;
  if (gap <= 480 + extra) return { why: 'long', f: 0.9 };
  return { why: 'cold', f: 0.8 };
}

/** The reps of a set, as a reason (or none). */
function repsHit(m: Pick<Snap, 'kind'>, s: WSet): FormHit | null {
  if (m.kind !== 'weight' && m.kind !== 'body') return null;
  const r = s.reps ?? 0;
  if (r <= 0) return null;
  if (r <= 3) return { why: 'heavy', f: 0.9 };
  if (r >= 6 && r <= 15) return { why: 'range', f: 1.1 };
  if (r > 30) return { why: 'light', f: m.kind === 'weight' ? 0.8 : 0.9 };
  return null;
}

/** The cut for the nth set in a row on one muscle: nothing up to four, then 15% more with each. */
export const rowCut = (n: number) => (n <= 4 ? 1 : Math.max(0.55, 1 - 0.15 * (n - 4)));
/** Sets of one muscle a workout can use; past them each counts half. */
export const MUSCLE_CAP = 10;

/** A workout's done sets in the order they were ticked off (ones from before sets were timed keep the list's order, first). */
function doneOrder(items: Item[]) {
  const out: { i: number; k: number; at: number }[] = [];
  items.forEach((it, i) => it.sets.forEach((s, k) => s.done && out.push({ i, k, at: s.at ?? 0 })));
  return out.sort((a, b) => a.at - b.at);
}

/** Every done set's form, in the order they were done. */
export function formOf(w: Pick<Workout, 'items' | 'bw' | 'since'>): SetForm[] {
  const out: SetForm[] = [];
  const per = new Map<string, number>();
  let run: string | null = null, row = 0;
  let prev: { it: Item; s: WSet } | null = null;
  for (const { i, k, at } of doneOrder(w.items)) {
    const it = w.items[i], s = it.sets[k], m = it.move;
    const g = formGroup(m);
    const hits: FormHit[] = [];
    // rest: from ticking off the set before to starting this one (ticked once it's done, so a hold's own time comes off)
    if (g !== null && prev && s.at && prev.s.at) {
      const h = restHit((s.at - prev.s.at) / 1000 - workSecs(m, s), restExtra(prev.it.move, m));
      if (h) hits.push(h);
    }
    if (g !== null) {
      const reps = repsHit(m, s);
      if (reps) hits.push(reps);
      if (s.beat && setScore(m, s) > s.beat + 1e-9) hits.push({ why: 'beat', f: 1.15 });
      row = g === run ? row + 1 : 1;
      run = g;
      if (row > 4) hits.push({ why: 'row', f: rowCut(row), n: row });
      const n = (per.get(g) ?? 0) + 1;
      per.set(g, n);
      if (n > MUSCLE_CAP) hits.push({ why: 'cap', f: 0.5, n });
      if (w.since && (MUSCLES as readonly string[]).includes(g)) {
        const h = w.since[g as Muscle];
        if (h === undefined) hits.push({ why: 'fresh', f: 1.1 });
        else if (h < 48) hits.push({ why: 'sore', f: 0.85 });
      }
    } else run = null, row = 0;
    const f = Math.round(Math.min(FORM_MAX, Math.max(FORM_MIN, hits.reduce((a, h) => a * h.f, 1))) * 1000) / 1000;
    out.push({ i, k, at, f, hits, raw: setPower(m, { ...s, boost: 1 }, w.bw, it.pair) });
    prev = { it, s };
  }
  return out;
}

/**
 * A workout as it's saved while it goes on: a set just ticked off gets its time and what last time's same set scored
 * (from `ghosts`, the sets each exercise had last time), a set unticked loses them, and every done set's form is worked
 * out again.
 */
export function applyForm<T extends Pick<Workout, 'items' | 'bw' | 'since'>>(w: T, ghosts: Map<string, WSet[]>, now: number): T {
  let items = w.items.map((it) => {
    let changed = false;
    const sets = it.sets.map((s, k) => {
      if (s.done && !s.at) {
        changed = true;
        const ghost = ghosts.get(it.move.id);
        const g = ghost?.[k] ?? ghost?.[ghost.length - 1];
        const beat = g ? setScore(it.move, g) : 0;
        return { ...s, at: now, ...(beat ? { beat } : {}) };
      }
      if (!s.done && (s.at || s.beat || s.boost)) return (changed = true), undone(s);
      return s;
    });
    return changed ? { ...it, sets } : it;
  });
  const form = formOf({ ...w, items });
  const by = new Map(form.map((x) => [`${x.i}:${x.k}`, x.f]));
  items = items.map((it, i) => {
    let changed = false;
    const sets = it.sets.map((s, k) => {
      if (!s.done) return s;
      const f = by.get(`${i}:${k}`) ?? 1;
      if ((s.boost ?? 1) === f) return s;
      changed = true;
      const { boost: _, ...rest } = s;
      return f === 1 ? rest : { ...rest, boost: f };
    });
    return changed ? { ...it, sets } : it;
  });
  return { ...w, items };
}

/**
 * What form did to a workout: the power it added and took off, and each reason's share of that, ⚡ (a set's change in
 * power split between its reasons by how much each multiplied it).
 */
export function formSummary(w: Pick<Workout, 'items' | 'bw' | 'since'>, form = formOf(w)) {
  const by = new Map<FormWhy, { why: FormWhy; sets: number; p: number }>();
  let gained = 0, lost = 0, raw = 0;
  for (const x of form) {
    raw += x.raw;
    const delta = x.raw * (x.f - 1);
    if (delta > 0) gained += delta; else lost -= delta;
    const logs = x.hits.map((h) => Math.log(h.f));
    const total = logs.reduce((a, b) => a + Math.abs(b), 0);
    x.hits.forEach((h, j) => {
      const r = by.get(h.why) ?? { why: h.why, sets: 0, p: 0 };
      r.sets++;
      // clamped sets: the change shared by the size of each reason, in its own direction
      r.p += total ? Math.abs(delta) * (Math.abs(logs[j]) / total) * Math.sign(logs[j]) : 0;
      by.set(h.why, r);
    });
  }
  return { gained, lost, raw, reasons: [...by.values()].sort((a, b) => Math.abs(b.p) - Math.abs(a.p)) };
}

/** Hours since each muscle was last trained as a workout's main one (2+ done sets), over the week before `now`. */
export function sinceOf(workouts: Workout[], now: number): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const w of workouts) {
    if (w.end === null) continue;
    const h = (now - w.end) / 3_600_000;
    if (h < 0 || h > SINCE_HOURS) continue;
    const n = new Map<Muscle, number>();
    for (const it of w.items) {
      const g = formGroup(it.move);
      if (g === null || !(MUSCLES as readonly string[]).includes(g)) continue;
      n.set(g as Muscle, (n.get(g as Muscle) ?? 0) + it.sets.filter((s) => s.done).length);
    }
    for (const [m, c] of n) if (c >= 2) out[m] = Math.min(out[m] ?? Infinity, Math.round(h * 10) / 10);
  }
  return out;
}

/**
 * What the next set of an exercise would lose for its muscle, if it came next: how many in a row it would make on that
 * muscle and the cut, and past the cap, its count there. Null when it loses nothing.
 */
export function nextCut(w: Pick<Workout, 'items'>, i: number): { row: number; f: number; cap: boolean } | null {
  const it = w.items[i];
  const g = it && formGroup(it.move);
  if (!g) return null;
  let row = 0, total = 0;
  const order = doneOrder(w.items);
  for (let j = order.length - 1; j >= 0 && formGroup(w.items[order[j].i].move) === g; j--) row++;
  for (const x of order) if (formGroup(w.items[x.i].move) === g) total++;
  const cut = rowCut(row + 1);
  const cap = total + 1 > MUSCLE_CAP;
  return cut < 1 || cap ? { row: row + 1, f: cut * (cap ? 0.5 : 1), cap } : null;
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
    tag: '', // set kinds (warm-up, drop, to failure) are retired: older ones read as normal sets
    done: raw.done === true,
    ...(raw.done === true && typeof raw.at === 'number' && Number.isFinite(raw.at) && raw.at > 0 ? { at: raw.at } : {}),
    ...(raw.done === true && numOr(raw.beat, 0, 1e6) ? { beat: raw.beat } : {}),
    ...(raw.done === true && numOr(raw.boost, FORM_MIN, FORM_MAX) !== null && raw.boost !== 1 ? { boost: raw.boost } : {}),
  };
}
const sinceMap = (v: unknown) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Partial<Record<Muscle, number>> = {};
  for (const m of MUSCLES) {
    const h = numOr((v as any)[m], 0, SINCE_HOURS);
    if (h !== null) out[m] = h;
  }
  return out;
};

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
    ...(sinceMap(raw.since) ? { since: sinceMap(raw.since) } : {}),
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
