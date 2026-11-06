// The exercise database: about 870 exercises from free-exercise-db (github.com/yuhonas/free-exercise-db, public domain),
// trimmed and given their power facts by scripts/build-exercises.mjs (src/data/exercises.json), plus the ones you made
// (store.ts, "moves"). The database is its own chunk, loaded the first time the Workout page or the picker needs it; the
// how-to steps are another, loaded only when an exercise's details are opened. Pictures come from jsDelivr.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useMyMoves } from './store';
import { MUSCLES, type Equip, type Move, type Muscle } from './fitness';

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

/** Lowercase, without accents or punctuation, for matching what's typed. */
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const folded = new WeakMap<Move, string>();
const words = (m: Move) => {
  let w = folded.get(m);
  if (w === undefined) folded.set(m, (w = fold(`${m.name} ${m.muscles.join(' ')} ${m.equip}`)));
  return w;
};

export interface Filter { q?: string; muscle?: Muscle | null; equip?: Equip | null }

/**
 * The exercises that match: every word typed (a name, a muscle or equipment, "pushup" finds "push-up"), the muscle it
 * mainly works and what it's done with. Names that start with what's typed come first, then the ones you've used most.
 */
export function searchExercises(list: Move[], f: Filter, used: Map<string, number> = new Map()) {
  const q = fold(f.q ?? '');
  const terms = q ? q.split(' ') : [];
  const squash = q.replace(/ /g, '');
  const out: { m: Move; score: number }[] = [];
  for (const m of list) {
    if (f.muscle && !m.muscles.includes(f.muscle)) continue;
    if (f.equip && m.equip !== f.equip) continue;
    let score = used.get(m.id) ?? 0;
    if (terms.length) {
      const w = words(m);
      const flat = w.replace(/ /g, '');
      if (!terms.every((t) => w.includes(t)) && !flat.includes(squash)) continue;
      const name = fold(m.name);
      score += name === q ? 1000 : name.startsWith(q) ? 500 : name.split(' ').some((x) => x.startsWith(terms[0])) ? 100 : 0;
    }
    out.push({ m, score });
  }
  return out.sort((a, b) => b.score - a.score || a.m.name.localeCompare(b.m.name)).map((x) => x.m);
}

/** The muscles in order, for filters. */
export const MUSCLE_ORDER: readonly Muscle[] = MUSCLES;
