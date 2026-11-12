// The maths of a set's numbers dragged sideways (components/workout/Scrubber.tsx): how much a step is for each field and
// piece of equipment, how many pixels make a step, a quick flick counting three times, and where the slider's far end is.
// Pure, so scripts/test-scrub.mjs can check it.
import type { Equip } from './fitness';

/** The numbers a set row can drag: minutes are a view of the seconds a set keeps. */
export type ScrubField = 'kg' | 'reps' | 'secs' | 'mins' | 'km';

/** How far a finger goes for one step, px: a little further for the numbers that matter most. */
export const PX: Record<ScrubField, number> = { reps: 16, kg: 14, secs: 12, mins: 14, km: 12 };

/** Faster than this (px per ms, over the last few moves) a drag counts three steps for one. */
export const FAST = 1.2;

/** Where the slider's far end starts before there's a bigger number to go on. */
const END: Record<ScrubField, number> = { kg: 40, reps: 15, secs: 60, mins: 30, km: 5 };

/** One step of a field: plates come in 2.5 kg on a bar or a stack, dumbbells and kettlebells in 2. */
export function stepOf(field: ScrubField, equip?: Equip) {
  switch (field) {
    case 'reps': return 1;
    case 'secs': return 5;
    case 'mins': return 0.5;
    case 'km': return 0.1;
    case 'kg': return equip === 'barbell' || equip === 'ezbar' || equip === 'machine' || equip === 'cable' ? 2.5
      : equip === 'dumbbell' || equip === 'kettlebell' ? 2 : 1;
  }
}

/** A number kept to two decimals, so 0.1 steps add up to 0.3 and not 0.30000000000000004. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** `from` moved by a number of steps, between 0 and `max`. */
export function stepped(from: number, steps: number, step: number, max: number) {
  return Math.min(max, Math.max(0, round2(from + steps * step)));
}

/** Where a drag starts counting from: the number there, else last time's, else 0. */
export const startOf = (value: number | null, ghost: number | null | undefined) => value ?? ghost ?? 0;

/** The steps a drag can go before it hits 0 or `max` (from where it started). */
export function bounds(from: number, step: number, max: number): [number, number] {
  return [Math.ceil(round2(-from / step)), Math.floor(round2((max - from) / step))];
}

/**
 * The slider's far end, for `aria-valuemax` and End: half as much again as the biggest of the number, last time's and a
 * usual amount, rounded up to a whole step and never past `max`.
 */
export function scaleEnd(value: number | null, ghost: number | null | undefined, field: ScrubField, max = Infinity, step = stepOf(field)) {
  const top = Math.max(value ?? 0, ghost ?? 0, END[field]) * 1.5;
  return Math.min(max, round2(Math.ceil(round2(top / step)) * step));
}

/**
 * A drag's steps from where it went down: the distance gone over the pixels a step takes, with the stretches done fast
 * counting three times (so a flick goes far and a slow drag stays exact). `lo`/`hi` keep it inside the ends, so turning
 * back moves the number at once.
 */
export function tracker(px: number) {
  let last = 0;
  let gone = 0;
  const recent: [number, number][] = [];
  return {
    /** The finger went down at `x` at time `t` (ms). */
    start(x: number, t: number) {
      last = x;
      gone = 0;
      recent.length = 0;
      recent.push([x, t]);
    },
    /** The finger's at `x` at time `t`: the steps it has come to. */
    move(x: number, t: number, lo = -Infinity, hi = Infinity) {
      recent.push([x, t]);
      while (recent.length > 4) recent.shift();
      const [x0, t0] = recent[0];
      const fast = recent.length >= 3 && t > t0 && Math.abs(x - x0) / (t - t0) > FAST;
      gone = Math.min(hi * px, Math.max(lo * px, gone + (x - last) * (fast ? 3 : 1)));
      last = x;
      return Math.trunc(gone / px) || 0;
    },
  };
}
