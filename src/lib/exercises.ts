// The exercise database: about 870 exercises from free-exercise-db (github.com/yuhonas/free-exercise-db, public domain),
// trimmed and given their power facts by scripts/build-exercises.mjs (src/data/exercises.json), plus the ones you made
// (store.ts, "moves"). The database is its own chunk, loaded the first time the Workout page or the picker needs it; the
// how-to steps are another, loaded only when an exercise's details are opened. Pictures come from jsDelivr.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useMyMoves } from './store';
import { MUSCLES, type Equip, type Move, type Muscle } from './fitness';
import { POPULARITY } from '../data/exercise-popular';

type Raw = Partial<Move> & Pick<Move, 'id' | 'name' | 'kind' | 'equip' | 'cat' | 'muscles'>;

let loaded: Move[] | null = null;
let loading: Promise<Move[]> | null = null;

const fill = (r: Raw): Move => ({
  also: [], share: 0, met: 0, pair: false, foot: false, level: 0, force: null, img: 0, ...r,
});

/** Loads the database (once). */
export function loadExercises(): Promise<Move[]> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= import('../data/exercises.json')
    .then((m) => (loaded = (m.default as Raw[]).map(fill)))
    .catch((error) => {
      loading = null; // offline: the next try fetches it again
      throw error;
    });
  return loading;
}

/** The database and your own exercises, yours first; empty until the database has loaded. */
export function useExercises(): { list: Move[]; ready: boolean } {
  const [db, setDb] = useState<Move[] | null>(loaded);
  const mine = useMyMoves();
  useEffect(() => {
    if (db) return;
    let live = true;
    loadExercises().then((list) => live && setDb(list), () => {});
    return () => { live = false; };
  }, []);
  const list = useMemo(() => [...mine, ...(db ?? [])], [mine, db]);
  return { list, ready: !!db };
}

/** One exercise by id, if it's loaded (yours always are). */
export const findExercise = (list: Move[], id: string) => list.find((m) => m.id === id);

let steps: Promise<Record<string, string[]>> | null = null;
/** How to do an exercise, step by step (database exercises only). */
export async function stepsOf(id: string): Promise<string[]> {
  steps ??= import('../data/exercise-steps.json').then((m) => m.default as Record<string, string[]>).catch((error) => {
    steps = null;
    throw error;
  });
  return (await steps)[id] ?? [];
}

const CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';
/** A picture of an exercise from the database: 0 is the start of the move, 1 the end. */
export const imageOf = (m: Pick<Move, 'id' | 'img'>, n = 0) => (m.img > n ? `${CDN}${encodeURIComponent(m.id)}/${n}.jpg` : null);

/* ---------- search ---------- */
//
// Finding an exercise the way gym apps do it: what you've done before first, then the staples everyone does
// (data/exercise-popular.ts ranks the database's ~900 by how common they are, and gives them their everyday names, "rdl",
// "lat pulldown", "air squat"), then the rest. Words match however they're written: "squats" finds "Squat", "push ups"
// and "pushup" find "Push-Up", a word half typed finds the ones it starts, and when nothing matches a typo is forgiven.
// What's typed can also be a muscle ("quads", "back") or equipment ("db", "bodyweight").

/** Lowercase, without accents or punctuation, for matching what's typed. */
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Two-word names written as one: "push up", "push-up" and "pushup" all become "pushup". */
const JOINS: [RegExp, string][] = [
  [/\b(push|pull|chin|sit|step|press) (ups?|downs?)\b/g, '$1$2'],
  [/\b(skull) (crushers?)\b/g, '$1$2'],
  [/\b(t|ez|hex) (bars?)\b/g, '$1$2'],
  [/\bbody weight\b/g, 'bodyweight'],
  [/\b(dead) (lifts?)\b/g, '$1$2'],
  [/\b(kick|pull) (backs?|overs?)\b/g, '$1$2'],
];
const IRREGULAR: Record<string, string> = { flyes: 'fly', flye: 'fly', flies: 'fly', flys: 'fly', calves: 'calf', dumbell: 'dumbbell', dumbells: 'dumbbell', abs: 'abs' };

/** A word in its one form: plurals made singular ("squats", "presses", "crunches", "flyes"), so either finds the other. */
export function stem(w: string) {
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length > 4 && /(ch|sh|x|ss|zz)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Text as the words searched: folded, joined, singular. */
export function tokens(s: string) {
  let x = fold(s);
  for (const [re, to] of JOINS) x = x.replace(re, to);
  return x ? x.split(' ').map(stem) : [];
}

/** What else each muscle and piece of equipment is called. */
const MUSCLE_WORDS: Record<Muscle, string> = {
  neck: 'neck', traps: 'traps trapezius', shoulders: 'shoulders delts', chest: 'chest pecs', biceps: 'biceps arms', triceps: 'triceps arms',
  forearms: 'forearms arms grip', lats: 'lats back', 'middle back': 'middle back', 'lower back': 'lower back', abdominals: 'abdominals abs core',
  glutes: 'glutes butt legs', abductors: 'abductors outer thighs', adductors: 'adductors inner thighs', quadriceps: 'quadriceps quads legs',
  hamstrings: 'hamstrings hams legs', calves: 'calves legs',
};
const EQUIP_WORDS: Record<Equip, string> = {
  body: 'bodyweight no equipment', barbell: 'barbell bb', dumbbell: 'dumbbell db', kettlebell: 'kettlebell kb', machine: 'machine',
  cable: 'cable', bands: 'bands', ezbar: 'ezbar', medball: 'medicine ball', ball: 'exercise ball swiss', foam: 'foam roller', other: '',
};

/** The words that only name a muscle or equipment: typed on their own, they narrow the list and leave it in its usual order. */
const KIND_WORDS = new Set([...Object.values(MUSCLE_WORDS), ...Object.values(EQUIP_WORDS)].flatMap(tokens));

/** An exercise as it's searched: its name's words, its other names', and its muscles' and equipment's. */
interface Doc { name: string[]; alias: string[][]; extra: Set<string>; pop: number }
const docs = new WeakMap<Move, Doc>();
function docOf(m: Move): Doc {
  let d = docs.get(m);
  if (!d) {
    const [pop = 0, ...alias] = POPULARITY[m.id] ?? [];
    d = {
      name: tokens(m.name),
      alias: alias.map(tokens),
      extra: new Set(tokens(`${m.muscles.map((x) => MUSCLE_WORDS[x]).join(' ')} ${EQUIP_WORDS[m.equip]}`)),
      pop,
    };
    docs.set(m, d);
  }
  return d;
}

/** How a word typed matches a word: the same (2), the start of it (1), a typo away (0.5, only when `loose`), or not (0). */
function wordMatch(typed: string, w: string, loose: boolean) {
  if (w === typed) return 2;
  if (typed.length >= 2 && w.startsWith(typed)) return 1;
  if (loose && typed.length >= 4 && Math.abs(w.length - typed.length) <= 2 && edits(typed, w, typed.length >= 8 ? 2 : 1)) return 0.5;
  return 0;
}

/** Whether two words are at most `max` letters' changes apart: one added, taken out, changed, or two swapped ("squta"). */
function edits(a: string, b: string, max: number) {
  let before: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], before[j - 2] + 1);
      low = Math.min(low, row[j]);
    }
    if (low > max) return false;
    before = prev;
    prev = row;
  }
  return prev[b.length] <= max;
}

/** The best match of a typed word in a list of words. */
const best = (typed: string, words: readonly string[], loose: boolean) => words.reduce((a, w) => Math.max(a, wordMatch(typed, w, loose)), 0);

/**
 * How well an exercise matches the words typed (null if one of them is in none of its words): mostly how much of its name
 * (or another name) is what was typed, so "Barbell Squat" beats "Barbell Squat To A Bench".
 */
function matchScore(d: Doc, terms: string[], loose: boolean): number | null {
  // only a muscle or equipment typed ("chest", "db"): the ones with it, most common first
  if (terms.every((t) => KIND_WORDS.has(t))) return terms.every((t) => d.extra.has(t) || d.name.includes(t)) ? 0 : null;
  let score = 0;
  for (const t of terms) {
    const inName = Math.max(best(t, d.name, loose), ...d.alias.map((a) => best(t, a, loose)));
    if (inName) score += 10 * inName;
    else if (best(t, [...d.extra], loose)) score += 4;
    else return null;
  }
  // how much of a name is covered by what's typed, and whether it is exactly that
  const cover = (words: string[]) => (words.length ? words.filter((w) => terms.some((t) => wordMatch(t, w, loose))).length / words.length : 0);
  const exact = (words: string[]) => words.length === terms.length && words.every((w, i) => w === terms[i]);
  score += 120 * Math.max(cover(d.name), ...d.alias.map(cover));
  if (exact(d.name) || d.alias.some(exact)) score += 150;
  else if (terms.every((t, i) => d.name[i] && wordMatch(t, d.name[i], false))) score += 30;
  return score;
}

/** How likely an exercise is the one wanted, whatever's typed: yours, how common, how simple. */
function baseScore(m: Move, d: Doc, used: number) {
  let score = d.pop * 1.5 + (used > 0 ? 250 + Math.min(used, 20) * 8 : 0);
  if (m.id.startsWith('my')) score += 20;
  if (m.level === 0) score += 8;
  else if (m.level === 2) score -= 10;
  if (m.cat === 'olympic' || m.cat === 'strongman' || m.cat === 'powerlifting') score -= 15;
  return score;
}

export interface Filter { q?: string; muscle?: Muscle | null; equip?: readonly Equip[] | null }

/**
 * The exercises that match, best first: every word typed found in its name, another name, its muscles or equipment;
 * the muscle it mainly works; and what it's done with (any of `equip`, none for all). With nothing typed, the ones
 * you've done come first, then the most common.
 */
export function searchExercises(list: Move[], f: Filter, used: Map<string, number> = new Map()) {
  const terms = tokens(f.q ?? '');
  const equip = f.equip?.length ? new Set(f.equip) : null;
  const pass = (loose: boolean) => {
    const out: { m: Move; score: number; len: number }[] = [];
    for (const m of list) {
      if (f.muscle && !m.muscles.includes(f.muscle)) continue;
      if (equip && !equip.has(m.equip)) continue;
      const d = docOf(m);
      const match = terms.length ? matchScore(d, terms, loose) : 0;
      if (match === null) continue;
      out.push({ m, score: match + baseScore(m, d, used.get(m.id) ?? 0), len: d.name.length });
    }
    return out;
  };
  let out = pass(false);
  if (!out.length && terms.length) out = pass(true); // nothing at all: forgive a typo
  return out.sort((a, b) => b.score - a.score || a.len - b.len || a.m.name.localeCompare(b.m.name)).map((x) => x.m);
}

/** The staples, most common first: what to show before anything's typed. */
export const popularOf = (list: Move[], min = 80) =>
  list.filter((m) => docOf(m).pop >= min).sort((a, b) => docOf(b).pop - docOf(a).pop || a.name.localeCompare(b.name));

/** The muscles in order, for filters. */
export const MUSCLE_ORDER: readonly Muscle[] = MUSCLES;
