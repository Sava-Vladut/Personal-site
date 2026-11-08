// What the Workout page's parts share: the exercises by id (for their pictures), saving as you go, a clock that ticks
// while the page is in view, how sets and numbers are written, and starting a workout.
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { imageOf, useExercises } from '../../lib/exercises';
import {
  blankSet, MAX_ITEMS, MAX_SETS, repPower, setPower, snapOf, weightOn,
  type Item, type Kind, type Move, type Routine, type Snap, type WSet, type Workout,
} from '../../lib/fitness';
import { deleteWorkout, getWorkouts, saveWorkout, toast, uid, useWeighIns, useWorkouts } from '../../lib/store';
import { todayKey } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { LOCALE, t } from '../../lib/i18n';
import { ask } from '../Confirm';
import { EQUIP_ICON, KIND_ICON, Power } from '../fitness';
import { Icon } from '../icons';

/* ---------- the exercises, once for the whole page ---------- */

interface Moves { list: Move[]; ready: boolean; byId: Map<string, Move> }
const MovesCtx = createContext<Moves>({ list: [], ready: false, byId: new Map() });

/** Loads the database once for the page and lets every part find an exercise by id (a plan only keeps its snapshot). */
export function MovesProvider({ children }: { children: ComponentChildren }) {
  const { list, ready } = useExercises();
  const value = useMemo(() => ({ list, ready, byId: new Map(list.map((m) => [m.id, m])) }), [list, ready]);
  return <MovesCtx.Provider value={value}>{children}</MovesCtx.Provider>;
}
export const useMoves = () => useContext(MovesCtx);

/** The Workout pages' emotion world. */
export const WORKOUT_WORLD = 'hope-interest';

/** A Workout page wears its world's colour: power's bolts, the rings and the meters read the accent from the root. */
export function useWorkoutAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', `var(--emo-${WORKOUT_WORLD})`);
    return () => root.removeProperty('--accent');
  }, []);
}

/** Your body weight today: the last weigh-in, or the default until there is one. */
export function useBodyWeight() {
  const list = useWeighIns();
  return useMemo(() => weightOn(list, todayKey()), [list]);
}

/** How often each exercise has been done, for putting the ones you use first. */
export function useUsedCounts() {
  const workouts = useWorkouts();
  return useMemo(() => {
    const used = new Map<string, number>();
    for (const w of workouts) for (const id of new Set(w.items.map((it) => it.move.id))) used.set(id, (used.get(id) ?? 0) + 1);
    return used;
  }, [workouts]);
}

/** The sets done the last time each exercise was done, from the newest finished workout that has it. */
export function lastSets(workouts: Workout[], skip?: string) {
  const out = new Map<string, WSet[]>();
  for (const w of workouts) {
    if (w.end === null || w.id === skip) continue;
    for (const it of w.items) {
      if (out.has(it.move.id)) continue;
      const done = it.sets.filter((s) => s.done);
      if (done.length) out.set(it.move.id, done);
    }
  }
  return out;
}

/** The power of the last finished workout started from a plan, for suggesting what to ask of it next. */
export function lastPlanWorkout(workouts: Workout[], plan: string) {
  return workouts.find((w) => w.plan === plan && w.end !== null);
}

/* ---------- saving as you go ---------- */

/**
 * Something edited in place (a plan, the workout going on): kept here as it changes and saved a moment after the last
 * change, as the page is hidden and as it's left, so typing a weight doesn't write the whole list on every key.
 * `keep` says whether it's worth saving yet (a new plan with nothing in it isn't).
 */
export function useDraft<T>(first: T, save: (x: T) => Promise<unknown>, keep: (x: T) => boolean = () => true) {
  const [draft, setDraft] = useState(first);
  const now = useRef(first);
  const pending = useRef(false);
  const timer = useRef<number>(0);
  const flush = () => {
    clearTimeout(timer.current);
    if (!pending.current) return;
    pending.current = false;
    if (keep(now.current)) save(now.current).catch(() => toast(t('Couldn’t save the workout. Try again.')));
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  const update = (change: (x: T) => T) => {
    now.current = change(now.current);
    setDraft(now.current);
    pending.current = true;
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flushRef.current(), 400);
  };
  /** Forgets what's waiting to be saved: the draft is being finished or thrown away. */
  const drop = () => {
    clearTimeout(timer.current);
    pending.current = false;
  };
  useEffect(() => {
    const hidden = () => document.visibilityState === 'hidden' && flushRef.current();
    const leave = () => flushRef.current();
    document.addEventListener('visibilitychange', hidden);
    addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      removeEventListener('pagehide', leave);
      flushRef.current();
    };
  }, []);
  return { draft, update, flush, drop, now };
}

/** The time now, every second while the page is in view; a hidden tab doesn't tick. */
export function useClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer = 0;
    const run = () => {
      clearInterval(timer);
      if (document.visibilityState !== 'visible') return;
      setNow(Date.now());
      timer = window.setInterval(() => setNow(Date.now()), 1000);
    };
    run();
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
    };
  }, []);
  return now;
}

/* ---------- writing numbers ---------- */

const one = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const two = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
/** A weight or a distance: up to one decimal (two for km). */
export const num = (n: number, km = false) => (km ? two : one).format(n);
export const kgText = (n: number) => t('{n} kg', { n: num(n) });
/** Added weight or help on a body move: "+10 kg", "−20 kg". */
const signedKg = (n: number) => t('{n} kg', { n: (n > 0 ? '+' : '−') + num(Math.abs(n)) });

const pad = (n: number) => String(n).padStart(2, '0');
/** A running clock: "4:05", "1:02:09". */
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
/** How long something took: "42 min", "1 h 05 min". */
export function span(ms: number) {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m < 60 ? t('{n} min', { n: m }) : t('{h} h {m} min', { h: Math.floor(m / 60), m: pad(m % 60) });
}

/** One set in a few characters: "10 · 20 kg", "12 · +10 kg", "45 s", "20 min · 3 km". */
function setText(m: Snap, s: WSet) {
  const parts: string[] = [];
  if (m.kind === 'weight' || m.kind === 'body') parts.push(s.reps === null ? '–' : String(s.reps));
  if (m.kind === 'time') parts.push(t('{n} s', { n: s.secs ?? 0 }));
  if (m.kind === 'cardio') {
    parts.push(t('{n} min', { n: num((s.secs ?? 0) / 60) }));
    if (s.km) parts.push(t('{n} km', { n: num(s.km, true) }));
  }
  if (m.kind === 'weight' && s.kg !== null) parts.push(kgText(s.kg));
  if ((m.kind === 'body' || m.kind === 'time') && s.kg) parts.push(signedKg(s.kg));
  return parts.join(' · ');
}
/** An exercise's sets the way a gym writes them, alike ones together: "3 × 10 · 20 kg", "1 × 8 · 25 kg". */
export function setsLine(it: Item) {
  const runs: [string, number][] = [];
  for (const s of it.sets) {
    const text = setText(it.move, s), last = runs[runs.length - 1];
    if (last && last[0] === text) last[1]++;
    else runs.push([text, 1]);
  }
  return runs.map(([text, n]) => `${n} × ${text}`);
}

/** All the reps of an exercise's sets added up (only = done ones), or null for holds and cardio. */
export function totalReps(it: Item, only?: boolean) {
  if (it.move.kind !== 'weight' && it.move.kind !== 'body') return null;
  return it.sets.reduce((n, s) => n + (only && !s.done ? 0 : s.reps ?? 0), 0);
}

/** What one rep (body moves) or one minute (holds, stretches, cardio) is worth at a body weight; weights have no such thing. */
export function perUnit(m: Pick<Snap, 'kind' | 'share' | 'met' | 'foot'>, bw: number): { p: number; unit: 'rep' | 'min' } | null {
  if (m.kind === 'weight') return null;
  if (m.kind === 'body') return { p: repPower(m, { kg: 0 }, bw), unit: 'rep' };
  return { p: setPower(m, { kg: 0, reps: null, secs: 60, km: null, tag: '', done: true }, bw), unit: 'min' };
}

/** "⚡ 4.8/rep", "⚡ 25/min". */
export function PerUnit({ move, bw }: { move: Pick<Snap, 'kind' | 'share' | 'met' | 'foot'>; bw: number }) {
  const u = perUnit(move, bw);
  if (!u) return null;
  return (
    <span class="wo-per">
      <Power value={u.p} size={12} />
      {u.unit === 'rep' ? t('/rep') : t('/min')}
    </span>
  );
}

/* ---------- pictures ---------- */

/**
 * An exercise's picture, small and square, in a slot that's there before it loads; the icon of its kind or equipment
 * stays under it for the ones without (yours, a few of the database's) and when it can't load. `on` lays a tick over it.
 */
export function Thumb({ move, on, big }: { move: Snap; on?: boolean; big?: boolean }) {
  const { byId } = useMoves();
  const full = byId.get(move.id);
  const src = full ? imageOf(full, 0) : null;
  const size = big ? 56 : 44;
  return (
    <span class={`wo-thumb${big ? ' big' : ''}${on ? ' is-on' : ''}`} aria-hidden="true">
      <Icon name={move.kind === 'weight' ? EQUIP_ICON[move.equip] : KIND_ICON[move.kind]} size={20} />
      {src && <img src={src} alt="" loading="lazy" decoding="async" width={size} height={size} onError={(e) => (e.currentTarget.hidden = true)} />}
      {on && <span class="wo-thumb-check"><Icon name="check" size={18} stroke={2.5} /></span>}
    </span>
  );
}

/* ---------- new items and workouts ---------- */

/** Rest after each set, by kind: longer after heavy lifts, none in cardio. */
const REST: Record<Kind, number> = { weight: 90, body: 60, time: 45, cardio: 0 };

/**
 * An exercise as it joins a plan or a workout. A plan gets the sets you did last time (or three of ten reps) to aim
 * for; a workout gets empty sets, as many as last time, with last time's numbers shown faintly in them.
 */
export function itemOf(m: Move, last: WSet[] | undefined, live: boolean): Item {
  const n = last?.length ?? (m.kind === 'cardio' ? 1 : 3);
  const planned = (): WSet => ({ ...blankSet(m.kind), reps: m.kind === 'weight' || m.kind === 'body' ? 10 : null });
  const sets = live ? Array.from({ length: n }, () => blankSet(m.kind))
    : last ? last.map((s) => ({ ...s, done: false })) : Array.from({ length: n }, planned);
  return { move: snapOf(m), sets, pair: m.pair, rest: REST[m.kind], note: '' };
}

/** A plan's name, or what it's called before it has one. */
export const planName = (r: Pick<Routine, 'name'>) => r.name.trim() || t('New workout');

/** An empty workout is named for when it starts. */
function partOfDay(ms: number) {
  const h = new Date(ms).getHours();
  return h < 5 ? t('Night workout') : h < 12 ? t('Morning workout') : h < 17 ? t('Afternoon workout') : h < 22 ? t('Evening workout') : t('Night workout');
}

/** What a workout can start from: a plan, or a past workout done again (its plan's id, if it still has one). */
export type Source = Pick<Routine, 'name' | 'icon' | 'target' | 'items'> & { id?: string | null };

/**
 * Starts a workout, empty or from a plan or a past workout (its exercises and sets to tick off, and the power it asks
 * for), at today's body weight. Only one goes at a time: if one is already going, it asks before throwing that one away.
 * False if it didn't.
 */
export async function startWorkout(plan: Source | null, bw: number) {
  const going = getWorkouts().find((w) => w.end === null);
  if (going) {
    const yes = await ask({ title: t('A workout is already going'), text: t('Starting a new one throws that one away, with its sets.'), ok: t('Discard it and start'), danger: true });
    if (!yes) return false;
    await deleteWorkout(going.id);
  }
  const now = Date.now();
  await saveWorkout({
    id: uid(), plan: plan?.id || null, name: plan ? planName(plan) : partOfDay(now), icon: plan?.icon ?? 'barbell',
    target: plan?.target ?? 0, bw, start: now, end: null,
    items: plan ? plan.items.map((it) => ({ ...it, sets: it.sets.map((s) => ({ ...s, done: false })) })) : [],
    feel: 0, note: '', created: now, updated: now,
  });
  haptic(10);
  return true;
}

/** A past workout as something to start again: the sets it did (all of an exercise's, when none were), its plan if it's still there. */
export function againOf(w: Workout, plans: Routine[]): Source {
  return {
    id: w.plan && plans.some((r) => r.id === w.plan) ? w.plan : null,
    name: w.name, icon: w.icon, target: w.target,
    items: w.items.map((it) => ({ ...it, sets: (it.sets.some((s) => s.done) ? it.sets.filter((s) => s.done) : it.sets).map((s) => ({ ...s, done: false })) })),
  };
}

/**
 * About how long a list of exercises takes, minutes, rounded to 5: each set's work (40 s for reps, its time for holds
 * and cardio) and the rest after it, and a minute to get each exercise ready.
 */
export function minutesOf(items: Item[]) {
  if (!items.length) return 0;
  let s = 0;
  for (const it of items) {
    s += 60;
    for (const x of it.sets) s += (it.move.kind === 'weight' || it.move.kind === 'body' ? 40 : x.secs ?? 30) + it.rest;
  }
  return Math.max(5, Math.round(s / 300) * 5);
}

/** How long a plan takes: as long as it took last time (when that was a real workout, not a quick try), or the estimate. */
export function planMinutes(r: Pick<Routine, 'items'>, last?: Workout) {
  const took = last?.end ? Math.round((last.end - last.start) / 60_000) : 0;
  return took >= 5 ? took : minutesOf(r.items);
}

/**
 * Where a workout is: the first exercise with a set still to do, and that set (null once every set is done). `from` is
 * the exercise last worked on: you stay on it while it has sets left, then go on to the ones after it, and a set skipped
 * earlier comes round again at the end.
 */
export function whereAt(items: Item[], from = 0) {
  for (let j = 0; j < items.length; j++) {
    const i = (from + j) % items.length;
    const k = items[i].sets.findIndex((s) => !s.done);
    if (k >= 0) return { i, k };
  }
  return null;
}

/** The screen stays on while `on` (a workout going on, the phone propped up between sets); taken again when the page comes back. */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const take = () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      navigator.wakeLock.request('screen').then((l) => (gone ? void l.release().catch(() => {}) : (lock = l)), () => {});
    };
    take();
    document.addEventListener('visibilitychange', take);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', take);
      void lock?.release().catch(() => {});
    };
  }, [on]);
}

/* ---------- a number field that lets you type ---------- */

/**
 * A number typed in place: it keeps what you're typing ("2.", "0,5") while you type, hands on the number, and shows the
 * stored value again once you leave it. Empty is null. `ghost` is shown faintly when it's empty (last time's number).
 */
export function NumInput({ value, onValue, label, ghost, decimal, max, field, class: cls }: {
  value: number | null;
  onValue: (n: number | null) => void;
  label: string;
  ghost?: string;
  decimal?: boolean;
  max: number;
  field?: string;
  class?: string;
}) {
  const shown = value === null ? '' : decimal ? num(value) : String(value);
  const [text, setText] = useState(shown);
  const typing = useRef(false);
  useEffect(() => {
    if (!typing.current) setText(shown);
  }, [shown]);
  return (
    <input
      class={cls ?? 'wo-num'}
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterkeyhint="done"
      autocomplete="off"
      value={text}
      placeholder={ghost}
      aria-label={label}
      title={label}
      data-f={field}
      onFocus={(e) => {
        typing.current = true;
        e.currentTarget.select();
      }}
      onBlur={() => {
        typing.current = false;
        setText(shown);
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      onInput={(e) => {
        const raw = e.currentTarget.value;
        setText(raw);
        const n = parseFloat(raw.replace(',', '.'));
        onValue(Number.isFinite(n) ? Math.min(max, Math.max(0, decimal ? Math.round(n * 100) / 100 : Math.round(n))) : null);
      }}
    />
  );
}

/* ---------- the power a workout asks for ---------- */

const STEPS = [-50, -10, 10, 50];

/** The power to aim for: −/+ in tens and fifties, typed in, or the suggested one in a tap. */
export function TargetStepper({ value, onValue, suggested, full }: { value: number; onValue: (n: number) => void; suggested: number; full: number }) {
  return (
    <div class="wo-target">
      <div class="wo-stepper">
        {STEPS.slice(0, 2).map((d) => (
          <button key={d} class="wo-step" onClick={() => onValue(Math.max(0, value + d))} disabled={value <= 0} aria-label={t('{n} less', { n: -d })} title={t('{n} less', { n: -d })}>
            −{-d}
          </button>
        ))}
        <label class="wo-target-n">
          <Icon name="bolt" size={20} />
          <NumInput class="wo-target-input" value={value || null} onValue={(n) => onValue(n ?? 0)} label={t('Target power')} ghost="0" max={100_000} />
        </label>
        {STEPS.slice(2).map((d) => (
          <button key={d} class="wo-step" onClick={() => onValue(value + d)} aria-label={t('{n} more', { n: d })} title={t('{n} more', { n: d })}>
            +{d}
          </button>
        ))}
      </div>
      <div class="wo-target-foot">
        {suggested > 0 && (
          <button class="chip" aria-pressed={value === suggested} onClick={() => onValue(suggested)} title={t('Suggested: what the sets add up to, or a little more than last time')}>
            <Icon name="sparkles" size={16} />
            <Power value={suggested} />
            {t('suggested')}
          </button>
        )}
        <span class="wo-full" title={t('What every set adds up to')}>
          <Icon name="list-details" size={14} />
          <Power value={full} />
        </span>
      </div>
    </div>
  );
}

/** A rest's length as the menu and the card write it: "Off", "45 s", "1:30", "2 min". */
export const restText = (s: number) =>
  !s ? t('Off') : s < 60 ? t('{n} s', { n: s }) : s % 60 ? `${Math.floor(s / 60)}:${pad(s % 60)}` : t('{n} min', { n: s / 60 });

/* ---------- changing a plan's or a workout's exercises ---------- */

/**
 * What a plan and a workout both do to their list of exercises, through their draft's `update`: change one, swap two,
 * add some (or swap one for another), add or take away a set. Taking one away happens at once, with Undo.
 */
export function itemActions<T extends { items: Item[] }>(items: Item[], update: (change: (x: T) => T) => void, ghosts: Map<string, WSet[]>, live: boolean) {
  const setItems = (f: (items: Item[]) => Item[]) => update((x) => ({ ...x, items: f(x.items) }));
  const setItem = (i: number, it: Item) => setItems((list) => list.map((x, j) => (j === i ? it : x)));
  const remove = (i: number) => {
    const it = items[i];
    if (!it) return;
    setItems((list) => list.filter((_, j) => j !== i));
    toast(t('Removed {name}', { name: it.move.name }), { label: t('Undo'), run: () => setItems((list) => [...list.slice(0, i), it, ...list.slice(i)]) });
  };
  return {
    setItem,
    remove,
    swap(i: number, j: number) {
      if (j < 0 || j >= items.length) return;
      setItems((list) => {
        const next = [...list];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
    },
    /** Adds exercises at the end, or puts the first in place of the one at `at` (keeping its rest and note). */
    add(moves: Move[], at: number | null) {
      const was = at === null ? undefined : items[at];
      if (was) setItem(at!, { ...itemOf(moves[0], ghosts.get(moves[0].id), live), rest: was.rest, note: was.note });
      else setItems((list) => [...list, ...moves.map((m) => itemOf(m, ghosts.get(m.id), live))].slice(0, MAX_ITEMS));
    },
    addSet(i: number) {
      const it = items[i];
      if (it && it.sets.length < MAX_SETS) setItem(i, { ...it, sets: [...it.sets, blankSet(it.move.kind, it.sets[it.sets.length - 1])] });
    },
    /** Takes a set away (the last one takes the exercise with it). */
    removeSet(i: number, k: number) {
      const it = items[i];
      if (!it) return;
      if (it.sets.length <= 1) return remove(i);
      const s = it.sets[k];
      setItem(i, { ...it, sets: it.sets.filter((_, j) => j !== k) });
      toast(t('Set removed'), {
        label: t('Undo'),
        run: () => setItems((list) => list.map((x, j) => (j === i ? { ...x, sets: [...x.sets.slice(0, k), s, ...x.sets.slice(k)] } : x))),
      });
    },
  };
}
