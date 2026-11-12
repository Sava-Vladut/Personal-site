// The workout going on. A slim bar stays at the top on a phone: a gauge filling with the power done against the power
// asked for, the time, the workout's options and Finish, with a strip along its foot filling exercise by exercise. Each
// exercise is a card of numbered sets, dragged or typed in and ticked off. Only the exercise you're on is open, the set
// to do now picked out; the others are folded to a line saying what they hold (a tap opens any of them), and finishing
// one moves on to the next. After each set a rest timer floats at the bottom saying what's next.
//
// On a wide screen it's a cockpit: the exercises as steps down the left (a rail), the one you're on large in the middle
// with its pictures playing, and the gauge, the rest and Finish on the right. Ticked sets throw sparks and fly their
// power into the gauge, and meeting the target is a moment of its own. Everything is saved as you go, so leaving the page
// (or closing the app) and coming back finds it as it was.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { blankSet, fmtPower, itemPower, MAX_SETS, metTarget, planPower, suggestTarget, workoutPower, type Item, type Move, type Routine, type Snap, type WSet, type Workout } from '../../lib/fitness';
import { imageOf } from '../../lib/exercises';
import { deleteWorkout, saveRoutine, saveWorkout, toast, useWorkouts } from '../../lib/store';
import { haptic } from '../../lib/haptics';
import { usePref } from '../../lib/prefs';
import { count, t } from '../../lib/i18n';
import { countsPushups } from '../../lib/pushups';
import { onComputer } from '../../lib/desktop';
import { ask } from '../Confirm';
import { EQUIP_ICON, KIND_ICON, Power } from '../fitness';
import { Icon } from '../icons';
import { PageHead } from '../PageHead';
import { burst, Celebrate, Flipbook, FLY_MS, PowerGauge, PowerStrip, Rolling, still, useMedia, type StripPart } from '../power';
import { Sheet } from '../Sheet';
import { ExerciseInfo } from './ExerciseInfo';
import { FinishSheet } from './Finish';
import { ItemMenu } from './ItemMenu';
import { Picker } from './Picker';
import { PushupCounter, unlockSound } from './PushupCounter';
import { SetRows } from './SetRows';
import {
  clock, itemActions, itemParts, lastPlanWorkout, lastSets, PerUnit, restText, setParts, setsLine, TargetStepper, totalReps, Thumb,
  useClock, useDraft, useMoves, useUsedCounts, useWakeLock, whereAt,
} from './shared';
import '../../styles/workout-live.css';

interface Rest { end: number; total: number }
/** The rest timer outlives the page being left for a moment (another tab, a look at a plan). */
let resting: Rest | null = null;
/** The workouts whose target-met moment has played: once each, even if the page is left and come back to. */
const cheered = new Set<string>();

export function Live({ workout }: { workout: Workout }) {
  const all = useWorkouts();
  const { draft: w, update, flush, drop } = useDraft(workout, saveWorkout);
  const ghosts = useMemo(() => lastSets(all, w.id), [all]);
  const last = useMemo(() => (w.plan ? lastPlanWorkout(all, w.plan) : undefined), [all]);
  const lastPower = last ? workoutPower(last) : 0;
  const power = workoutPower(w);
  const parts = useMemo(() => itemParts(w.items, w.bw, ghosts), [w.items, w.bw, ghosts]);
  const act = itemActions<Workout>(w.items, update, ghosts, true);
  const wide = useMedia('(min-width: 1024px)');
  // the exercise a set was last ticked off in: where the workout goes on from
  const [touched, setTouched] = useState(0);
  const at = whereAt(w.items, touched);
  // on a wide screen one exercise is on the stage: the one picked from the rail, else the one you're on, else the last
  const [pick, setPick] = useState<number | null>(null);
  const stage = pick !== null && pick < w.items.length ? pick : at?.i ?? w.items.length - 1;
  const sets = w.items.reduce((n, it) => n + it.sets.length, 0);
  const done = w.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);

  const [awake, setAwake] = usePref<boolean>('wo-awake', true);
  useWakeLock(awake);

  const [rest, setRestNow] = useState<Rest | null>(() => (resting && resting.end > Date.now() ? resting : null));
  const setRest = (r: Rest | null) => setRestNow((resting = r));
  // adding exercises, or swapping the one at an index for another
  const [picking, setPicking] = useState<{ swap: number | null } | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [info, setInfo] = useState<Item | null>(null);
  const [options, setOptions] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // the exercise whose push-ups the camera is counting
  const [counting, setCounting] = useState<number | null>(null);
  // the cards folded or opened by hand, by exercise; the rest are open only while they're the one you're on. Finishing
  // an exercise hands it back, so it folds
  const [folds, setFolds] = useState<Record<string, boolean>>({});
  const folded = (it: Item, i: number) => (wide && i === stage ? false : folds[it.move.id] ?? i !== at?.i);
  const fold = (it: Item, i: number) => setFolds((f) => ({ ...f, [it.move.id]: !folded(it, i) }));

  // the target met by a set ticked off just now (not by opening a workout that had already, or by lowering the target)
  const tickAt = useRef(0);
  const met = w.target > 0 && power >= w.target;
  const wasMet = useRef(met);
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    if (met && !wasMet.current && Date.now() - tickAt.current < 1500 && !cheered.has(w.id)) {
      cheered.add(w.id);
      setCheer(true);
    }
    wasMet.current = met;
  }, [met]);

  const discard = async () => {
    const yes = await ask({ title: t('Discard this workout?'), text: t('None of its sets will be kept.'), ok: t('Discard'), danger: true });
    if (!yes) return;
    drop();
    setRest(null);
    setOptions(false);
    await deleteWorkout(w.id);
    toast(t('Workout discarded'));
    scrollTo({ top: 0 });
  };
  const save = async (finished: Workout, plan: Routine | null) => {
    drop();
    try {
      await saveWorkout(finished);
      if (plan) await saveRoutine(plan);
    } catch {
      return toast(t('Couldn’t save the workout. Try again.'));
    }
    setRest(null);
    toast(metTarget(finished) ? t('Workout saved. Target met!') : t('Workout saved'));
    scrollTo({ top: 0 });
  };
  const finish = () => {
    flush();
    setFinishing(true);
  };
  const restAfter = (it: Item) => it.rest > 0 && setRest({ end: Date.now() + it.rest * 1000, total: it.rest });
  /** Brings an exercise up: open, on the stage on a wide screen, in view on a phone (on a wide screen only if it's scrolled past). */
  const go = (i: number) => {
    const it = w.items[i];
    if (!it) return;
    setFolds((f) => ({ ...f, [it.move.id]: false }));
    setPick(i);
    setTouched(i);
    setTimeout(() => {
      const el = document.getElementById(`wo-item-${i}`);
      if (el && (!wide || el.getBoundingClientRect().top < 0)) el.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
    }, 30);
  };
  // a set ticked off: the rest starts, and the last of an exercise throws sparks off it, folds it and brings up the next
  const ticked = (i: number, k: number) => {
    const it = w.items[i];
    if (!it) return;
    tickAt.current = Date.now();
    restAfter(it);
    setTouched(i);
    if (!it.sets.every((s, j) => j === k || s.done)) return;
    setFolds(({ [it.move.id]: _, ...rest }) => rest);
    const card = document.getElementById(`wo-item-${i}`);
    const strip = card?.querySelector('.wo-item-strip') ?? card;
    if (strip) burst(strip, { big: true });
    // on a wide screen the finished one stays on the stage a moment, so its last tick is seen, then the next comes up
    setPick(wide && !still() ? i : null);
    if (wide && !still()) setTimeout(() => setPick((p) => (p === i ? null : p)), 800);
    const then = whereAt(w.items.map((x, j) => (j === i ? { ...x, sets: x.sets.map((s, q) => (q === k ? { ...s, done: true } : s)) } : x)), i);
    if (!wide && then && then.i !== i) setTimeout(() => document.getElementById(`wo-item-${then.i}`)?.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' }), 80);
  };

  // each set the camera counted goes into the next set not done yet (or a new one), which then counts as done; the
  // rest timer starts after the last
  const logReps = (i: number, counted: number[]) => {
    const it = w.items[i];
    if (!it) return;
    const next = [...it.sets];
    for (const reps of counted) {
      const k = next.findIndex((s) => !s.done);
      if (k >= 0) next[k] = { ...next[k], reps, done: true };
      else if (next.length < MAX_SETS) next.push({ ...blankSet(it.move.kind), reps, done: true });
      else return toast(t('This exercise has as many sets as it can hold.'));
    }
    tickAt.current = Date.now();
    act.setItem(i, { ...it, sets: next });
    restAfter(it);
    setTouched(i);
    toast(t('{count} saved', { count: count(counted.reduce((a, b) => a + b, 0), 'push-up', 'push-ups') }));
  };

  // moving or taking out an exercise: the one on the stage (and the one you're on) stay with it
  const moveItem = (from: number, to: number) => {
    act.swap(from, to);
    const follow = (x: number) => (x === from ? to : x === to ? from : x);
    setPick((p) => (p === null ? p : follow(p)));
    setTouched(follow);
  };
  const removeItem = (i: number) => {
    act.remove(i);
    setPick((p) => (p === null || p < i ? p : p === i ? null : p - 1));
    setTouched((x) => (x > i ? x - 1 : x));
  };

  // on a wide screen, the exercise after the stage that still has sets to do
  let after = -1;
  if (wide) for (let j = 1; j < w.items.length && after < 0; j++) {
    const i = (stage + j) % w.items.length;
    if (w.items[i].sets.some((s) => !s.done)) after = i;
  }
  const restNext = at ? { name: w.items[at.i].move.name, n: at.k + 1 } : null;

  const addBtn = (
    <button class="wo-add-btn" onClick={() => setPicking({ swap: null })}>
      <Icon name="circle-plus" size={18} />
      {t('Add exercises')}
    </button>
  );

  return (
    <div class="page wo-page wo-live-page">
      <PageHead title={w.name} wheel world="hope-interest" />
      {/* on a phone its parts are just the bar at the top; on a wide screen it's the cockpit and the rail beside the exercises */}
      <aside class="wo-side" data-no-reveal>
        <div class="wo-cockpit">
          <LiveBar w={w} power={power} done={done} sets={sets} parts={parts} ghost={lastPower} wide={wide} onOptions={() => setOptions(true)} onFinish={finish} />
          {wide && rest && <RestPill card rest={rest} onRest={setRest} next={restNext} />}
        </div>
        {wide && w.items.length > 0 && <Rail items={w.items} bw={w.bw} ghosts={ghosts} stage={stage} onGo={go} onAdd={() => setPicking({ swap: null })} />}
      </aside>

      {w.items.length ? (
        <div class="wo-live-list">
          {w.items.map((it, i) => (
            <LiveItem
              key={i}
              id={`wo-item-${i}`}
              it={it}
              bw={w.bw}
              ghosts={ghosts.get(it.move.id)}
              next={at?.i === i ? at.k : undefined}
              folded={folded(it, i)}
              stage={wide && i === stage}
              onFold={() => fold(it, i)}
              onSets={(next) => act.setItem(i, { ...it, sets: next })}
              onRemoveSet={(k) => act.removeSet(i, k)}
              onAddSet={() => act.addSet(i)}
              onDone={(k) => ticked(i, k)}
              onMenu={() => setMenu(i)}
              onInfo={() => setInfo(it)}
              onCount={countsPushups(it.move) && !onComputer() ? () => (unlockSound(), setCounting(i)) : undefined}
            />
          ))}
          {after >= 0 && <NextUp it={w.items[after]} onGo={() => go(after)} />}
          <div class="wo-live-end">
            {addBtn}
            <Usual have={w.items} onAdd={(m) => act.add([m], null)} quick />
            {done > 0 && !at && (
              <div class="card wo-all-done fade-arrive-soft">
                <span class="wo-tile"><Icon name="flag-check" size={20} /></span>
                <span class="wo-all-done-text">
                  <b>{t('Every set done')}</b>
                  <span class="muted small">{t('Add more, or finish and save it.')}</span>
                </span>
                {/* on a wide screen the cockpit's Finish is in view and stays the main one */}
                <button class={`btn btn-s ${wide ? 'btn-quiet' : 'btn-primary'}`} onClick={finish}>{t('Finish')}</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <Empty onPick={() => setPicking({ swap: null })} onAdd={(m) => act.add([m], null)} />
      )}

      {!wide && rest && <RestPill rest={rest} onRest={setRest} next={restNext} />}

      <Celebrate open={cheer} title={t('Target met')} onDone={() => setCheer(false)}>
        <PowerGauge value={power} target={w.target} size="l" class="wo-live-cel-gauge">
          <Icon name="trophy" size={24} />
          <span class="wo-live-cel-n"><Rolling value={power} from={0} ms={900} /> ⚡</span>
        </PowerGauge>
        <span class="wo-live-cel-line">{power - w.target >= 0.5 ? t('{p} ⚡ over', { p: fmtPower(power - w.target) }) : t('Right on target')}</span>
      </Celebrate>

      <Picker open={!!picking} single={picking?.swap != null} onClose={() => setPicking(null)} onPick={(moves) => act.add(moves, picking?.swap ?? null)} />
      <ItemMenu
        item={menu !== null ? w.items[menu] ?? null : null}
        first={menu === 0}
        last={menu === w.items.length - 1}
        onClose={() => setMenu(null)}
        onChange={(it) => menu !== null && act.setItem(menu, it)}
        onReplace={() => setPicking({ swap: menu })}
        onInfo={() => menu !== null && setInfo(w.items[menu])}
        onMove={(by) => {
          if (menu === null || menu + by < 0 || menu + by >= w.items.length) return;
          moveItem(menu, menu + by);
          setMenu(menu + by);
        }}
        onRemove={() => menu !== null && removeItem(menu)}
      />
      <ExerciseInfo move={info?.move ?? null} onClose={() => setInfo(null)} />
      <Sheet
        open={options}
        onClose={() => setOptions(false)}
        title={t('This workout')}
        footer={<button class="btn btn-primary wo-wide" onClick={() => setOptions(false)}>{t('Done')}</button>}
      >
        <div class="wo-menu">
          <label class="wo-menu-part">
            <span class="field-label row gap-s"><Icon name="pencil" size={16} />{t('Name')}</span>
            <input
              class="input"
              value={w.name}
              maxLength={120}
              enterkeyhint="done"
              onInput={(e) => {
                const name = e.currentTarget.value;
                update((x) => ({ ...x, name }));
              }}
              onBlur={() => !w.name.trim() && update((x) => ({ ...x, name: workout.name || t('Workout') }))}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>
          <section class="wo-menu-part">
            <h3 class="field-label row gap-s"><Icon name="target" size={16} />{t('Target power')}</h3>
            <TargetStepper
              value={w.target}
              onValue={(target) => update((x) => ({ ...x, target }))}
              suggested={suggestTarget(w, w.bw, last && workoutPower(last))}
              full={planPower(w, w.bw)}
            />
            <p class="muted small">{t('Only the sets you tick off count toward it.')}</p>
          </section>
          <div class="card list menu-list">
            <label class="list-row">
              <span class="row gap-s"><Icon name="sun" size={18} />{t('Keep the screen on')}</span>
              <button type="button" class="switch" role="switch" aria-checked={awake} aria-label={t('Keep the screen on')} onClick={() => setAwake(!awake)} />
            </label>
            <button class="list-row action danger" onClick={discard}>
              <span class="row gap-s"><Icon name="trash" size={18} />{t('Discard workout')}</span>
            </button>
          </div>
        </div>
      </Sheet>
      {counting !== null && (
        <PushupCounter
          saveLabel={t('Add to the workout')}
          onClose={() => setCounting(null)}
          onSave={(reps) => {
            logReps(counting, reps);
            setCounting(null);
          }}
        />
      )}
      <FinishSheet open={finishing} w={w} onClose={() => setFinishing(false)} onSave={save} onDiscard={discard} />
    </div>
  );
}

/**
 * The milestones of a workout so far: half the target, and more than last time on this plan. `fresh` is one just
 * passed (for a few seconds), so it can pop; ones already passed when the page opened just show.
 */
function useMilestones(power: number, target: number, ghost: number) {
  const half = target > 0 && power >= target / 2;
  const past = ghost > 0 && power > ghost;
  const was = useRef({ half, past });
  const [fresh, setFresh] = useState<'half' | 'past' | null>(null);
  useEffect(() => {
    const crossed = past && !was.current.past ? 'past' : half && !was.current.half ? 'half' : null;
    was.current = { half, past };
    if (crossed) setFresh(crossed);
  }, [half, past]);
  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(() => setFresh(null), 4000);
    return () => clearTimeout(timer);
  }, [fresh]);
  return { half, past, fresh };
}

/** A milestone as a chip: popping in when it's just been passed. */
function Milestone({ kind, fresh }: { kind: 'half' | 'past'; fresh: boolean }) {
  return (
    <span class={`wo-live-mile${fresh ? ' is-new' : ''}`}>
      <Icon name={kind === 'half' ? 'progress-check' : 'trending-up'} size={14} />
      {kind === 'half' ? t('Halfway') : t('Past last time')}
    </span>
  );
}

/**
 * The bar at the top on a phone, the cockpit's card on a wide screen: a gauge filling with the power done toward the
 * target (a notch where last time came to, a surge as each set's power lands in it, a trophy once it's met), the numbers
 * and the time (a tap opens the workout's options, the target among them), the milestones passed, the options and
 * Finish, and a strip of the exercises filling as their sets are ticked off.
 */
function LiveBar({ w, power, done, sets, parts, ghost, wide, onOptions, onFinish }: {
  w: Workout;
  power: number;
  done: number;
  sets: number;
  parts: StripPart[];
  ghost: number;
  wide: boolean;
  onOptions: () => void;
  onFinish: () => void;
}) {
  const met = w.target > 0 && power >= w.target;
  const miles = useMilestones(power, w.target, ghost);
  const scale = parts.reduce((a, x) => a + x.p, 0);
  const aim = w.target > 0 ? t('Target: {p} ⚡. Tap to change it', { p: fmtPower(w.target) }) : t('Set a target');
  const goal = met ? t('Target met') : w.target > 0 ? t('{p} ⚡ to go', { p: fmtPower(w.target - power) }) : t('Set a target');
  const of = w.target > 0 ? `/ ${fmtPower(w.target)} ⚡` : '⚡';
  return (
    <div class={`wo-bar${met ? ' is-met' : ''}`}>
      <button class={`wo-power${met ? ' is-met' : ''}`} onClick={onOptions} aria-label={aim} title={aim}>
        <PowerGauge value={power} target={w.target} scale={scale} ghost={ghost} size={wide ? 'l' : 's'} catcher surgeDelay={still() ? 0 : FLY_MS}>
          {wide ? (
            <>
              <b class="wo-live-n"><Rolling value={power} /></b>
              <span class="wo-of">{of}</span>
              <Elapsed start={w.start} big />
            </>
          ) : <Icon name={met ? 'trophy' : 'bolt'} size={18} />}
        </PowerGauge>
        {!wide && (
          <span class="wo-power-text">
            <span class="wo-power-n">
              <b><Rolling value={power} /></b>
              <span class="wo-of">{of}</span>
            </span>
            <span class="wo-power-sub">
              <Elapsed start={w.start} />
              {miles.fresh ? <Milestone kind={miles.fresh} fresh /> : <span class="wo-power-goal">{goal}</span>}
            </span>
          </span>
        )}
      </button>
      {wide && (
        <span class="wo-live-sub">
          <span class="wo-power-goal">{met && <Icon name="trophy" size={14} />}{goal}</span>
          {(miles.half || miles.past) && (
            <span class="wo-live-miles">
              {miles.half && <Milestone kind="half" fresh={miles.fresh === 'half'} />}
              {miles.past && <Milestone kind="past" fresh={miles.fresh === 'past'} />}
            </span>
          )}
        </span>
      )}
      <button class="icon-btn wo-bar-more" onClick={onOptions} aria-label={t('Workout options')} title={t('Workout options')}>
        <Icon name="dots" size={18} />
      </button>
      {/* the main thing to do once something's been done; until then, adding exercises is */}
      <button class={`btn btn-s wo-finish ${done ? 'btn-primary' : 'btn-quiet'}`} onClick={onFinish}>
        <Icon name="flag-check" size={16} />
        {t('Finish')}
      </button>
      {parts.length > 0 && <PowerStrip parts={parts} class="wo-live-strip" label={t('{n} of {total} sets done', { n: done, total: sets })} />}
    </div>
  );
}

/**
 * The exercises as steps down the side on a wide screen: each one's picture, name, sets as a little power strip, how
 * many are ticked off and the power they came to, with a line between them filling as each is finished. The one on the
 * stage is picked out; a tap puts another there.
 */
function Rail({ items, bw, ghosts, stage, onGo, onAdd }: {
  items: Item[];
  bw: number;
  ghosts: Map<string, WSet[]>;
  stage: number;
  onGo: (i: number) => void;
  onAdd: () => void;
}) {
  return (
    <nav class="card wo-rail" aria-label={t('Exercises')}>
      <ol class="wo-rail-list">
        {items.map((it, i) => {
          const done = it.sets.filter((s) => s.done).length;
          const all = done > 0 && done === it.sets.length;
          const here = i === stage;
          return (
            <li key={i} class={`wo-rail-step${all ? ' is-done' : ''}${here ? ' is-stage' : ''}`}>
              <button class="wo-rail-btn" onClick={() => onGo(i)} aria-current={here ? 'step' : undefined}>
                <Thumb move={it.move} on={all} />
                <span class="wo-rail-text">
                  <span class="wo-rail-name">{it.move.name}</span>
                  <PowerStrip parts={setParts(it, bw, ghosts.get(it.move.id))} class="is-mini" />
                  <span class="wo-meta">
                    <span class="wo-meta-text" title={t('Sets done')}><Icon name="check" size={12} />{done}/{it.sets.length}</span>
                    {done > 0 && <Power value={itemPower(it, bw)} size={12} />}
                  </span>
                </span>
              </button>
              {i < items.length - 1 && <span class="wo-rail-line" aria-hidden="true"><i style={{ transform: `scaleY(${all ? 1 : 0})` }} /></span>}
            </li>
          );
        })}
      </ol>
      <button class="wo-rail-add" onClick={onAdd}>
        <Icon name="plus" size={16} />
        {t('Add exercises')}
      </button>
    </nav>
  );
}

/** The time since the workout started, ticking on its own so the rest of the page doesn't redraw every second. */
function Elapsed({ start, big }: { start: number; big?: boolean }) {
  const now = useClock();
  return (
    <span class="wo-clock" role="timer" title={t('Time so far')}>
      <Icon name="stopwatch" size={big ? 14 : 12} />
      {clock(now - start)}
    </span>
  );
}

/**
 * The top of the exercise on the stage: its two pictures played as a flipbook with its name over them, or (one of yours,
 * with no pictures) its icon on a tint of the page's colour.
 */
function StageBanner({ move }: { move: Snap }) {
  const { byId } = useMoves();
  const full = byId.get(move.id);
  const shots = full
    ? ([[imageOf(full, 0), t('{name}: the start of the move', { name: move.name })], [imageOf(full, 1), t('{name}: the end of the move', { name: move.name })]]
      .filter((x) => x[0]) as [string, string][])
    : [];
  return (
    <div class={`wo-stage-banner${shots.length ? '' : ' is-plain'}`}>
      {shots.length ? (
        <Flipbook key={move.id} class="wo-stage-flip" frames={shots.map((x) => x[0])} alt={shots.map((x) => x[1])} />
      ) : (
        <span class="wo-tile big" aria-hidden="true"><Icon name={move.kind === 'weight' ? EQUIP_ICON[move.equip] : KIND_ICON[move.kind]} size={24} /></span>
      )}
      <h2 class="wo-stage-name">{move.name}</h2>
    </div>
  );
}

function LiveItem({ id, it, bw, ghosts, next, folded, stage, onFold, onSets, onRemoveSet, onAddSet, onDone, onMenu, onInfo, onCount }: {
  id: string;
  it: Item;
  bw: number;
  ghosts?: WSet[];
  /** The set to do now, when it's in this exercise. */
  next?: number;
  folded: boolean;
  /** On the stage (a wide screen): large, with its pictures, and never folded. */
  stage: boolean;
  onFold: () => void;
  onSets: (sets: WSet[]) => void;
  onRemoveSet: (k: number) => void;
  onAddSet: () => void;
  onDone: (k: number) => void;
  onMenu: () => void;
  onInfo: () => void;
  /** Push-ups: count a set with the camera. */
  onCount?: () => void;
}) {
  const done = it.sets.filter((s) => s.done).length;
  const all = done > 0 && done === it.sets.length;
  const reps = totalReps(it);
  const about = t('About {name}', { name: it.move.name });
  // folded, the card says what it holds the way a gym writes it: what was done, once it's done; what's planned till then
  const line = folded ? foldedLine(it, all) : '';
  return (
    <article id={id} class={`card wo-item${all ? ' is-done' : ''}${next !== undefined ? ' is-now' : ''}${folded ? ' is-folded' : ''}${stage ? ' is-stage' : ''}`}>
      {stage && <StageBanner move={it.move} />}
      <div class="wo-item-head">
        {!stage && (
          <button class="wo-thumb-btn" onClick={onInfo} aria-label={about} title={about}>
            <Thumb move={it.move} on={all} />
          </button>
        )}
        <div class="wo-item-title">
          {!stage && <button class="wo-item-name" onClick={onInfo} title={about}>{it.move.name}</button>}
          <span class="wo-meta">
            <span class={`wo-meta-text wo-sets-done${all ? ' is-all' : ''}`} title={count(done, 'set done', 'sets done')}>
              <Icon name="check" size={12} />
              {done}/{it.sets.length}
            </span>
            {line && <span class="wo-meta-text wo-done-line">{line}</span>}
            {!folded && reps ? <span class="wo-meta-text" title={t('Reps done')}>{totalReps(it, true)}/{count(reps, 'rep', 'reps')}</span> : null}
            {done > 0 && <Power value={itemPower(it, bw)} size={12} />}
            {!folded && <PerUnit move={it.move} bw={bw} />}
            {!folded && it.pair && <span class="wo-pair" title={t('One in each hand (counts ×2)')}>×2</span>}
            {!folded && it.rest > 0 && <button class="wo-meta-text wo-rest-chip" onClick={onMenu} title={t('Rest between sets')}><Icon name="alarm" size={12} />{restText(it.rest)}</button>}
          </span>
        </div>
        {stage ? (
          <button class="icon-btn small" onClick={onInfo} aria-label={about} title={about}>
            <Icon name="info-circle" size={18} />
          </button>
        ) : (
          <button class="icon-btn small wo-fold" onClick={onFold} aria-expanded={!folded} aria-label={folded ? t('Show the sets') : t('Fold away')} title={folded ? t('Show the sets') : t('Fold away')}>
            <Icon name="chevron-down" size={16} />
          </button>
        )}
        <button class="icon-btn small" onClick={onMenu} aria-label={t('Options for {name}', { name: it.move.name })} title={t('More')}>
          <Icon name="dots" size={16} />
        </button>
      </div>
      {(done > 0 || next !== undefined || stage) && <PowerStrip parts={setParts(it, bw, ghosts)} now={next} class="wo-item-strip" />}
      {!folded && (
        <div class="wo-item-body">
          {it.note && <p class="wo-note"><Icon name="pencil" size={12} />{it.note}</p>}
          <SetRows item={it} bw={bw} live ghosts={ghosts} next={next} onSets={onSets} onRemove={onRemoveSet} onDone={onDone} />
          <div class="wo-item-foot">
            <button class="wo-add-set" onClick={onAddSet} disabled={it.sets.length >= MAX_SETS}>
              <Icon name="plus" size={16} />
              {t('Add set')}
            </button>
            {onCount && (
              <button class="btn btn-quiet btn-s" onClick={onCount} aria-label={t('Count push-ups with the camera')} title={t('Count push-ups with the camera')}>
                <Icon name="camera" size={16} />
                {t('Camera')}
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

/** A folded exercise in a few characters: "3 × 10 · 20 kg", or "3 sets" while they're empty. */
function foldedLine(it: Item, all: boolean) {
  const sets = it.sets.filter((s) => (all ? s.done : s.kg !== null || s.reps !== null || s.secs !== null || s.km !== null));
  return sets.length ? setsLine({ ...it, sets }).join(', ') : count(it.sets.length, 'set', 'sets');
}

/** Under the stage on a wide screen: the exercise that comes next, a tap from being put there. */
function NextUp({ it, onGo }: { it: Item; onGo: () => void }) {
  return (
    <button class="card wo-live-next" onClick={onGo}>
      <Thumb move={it.move} />
      <span class="wo-live-next-text">
        <span class="wo-label">{t('Up next')}</span>
        <span class="wo-live-next-name">{it.move.name}</span>
        <span class="wo-meta"><span class="wo-meta-text wo-done-line">{foldedLine(it, false)}</span></span>
      </span>
      <Icon name="chevron-right" size={18} />
    </button>
  );
}

/**
 * The exercises you do most that this workout hasn't got yet, each added in a tap: a list when it's empty, a row to
 * scroll (`quick`) under the exercises once it has some.
 */
function Usual({ have, onAdd, quick }: { have: Item[]; onAdd: (m: Move) => void; quick?: boolean }) {
  const { byId, ready } = useMoves();
  const used = useUsedCounts();
  const usual = useMemo(() => {
    if (!ready) return [];
    const ids = new Set(have.map((it) => it.move.id));
    return [...used].filter(([id]) => !ids.has(id)).sort((a, b) => b[1] - a[1]).flatMap(([id]) => byId.get(id) ?? []).slice(0, quick ? 10 : 8);
  }, [used, byId, ready, have, quick]);
  if (!usual.length) return null;
  return (
    <div class={`wo-usual${quick ? ' is-quick' : ''}`}>
      <span class="wo-label"><Icon name="history" size={14} />{quick ? t('Quick add') : t('Your usual')}</span>
      <div class="wo-usual-list">
        {usual.map((m) => (
          <button key={m.id} class="wo-usual-chip" onClick={() => onAdd(m)} aria-label={t('Add {name}', { name: m.name })} title={t('Add {name}', { name: m.name })}>
            <Thumb move={m} />
            <span class="wo-usual-name">{m.name}</span>
            <Icon name="plus" size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** No exercises yet: the way to add some, and the ones you do most, each added in a tap. */
function Empty({ onPick, onAdd }: { onPick: () => void; onAdd: (m: Move) => void }) {
  return (
    <div class="card wo-live-empty fade-arrive-soft">
      <span class="wo-tile big" aria-hidden="true"><Icon name="barbell" size={24} /></span>
      <h2 class="wo-empty-title">{t('What are you training?')}</h2>
      <p class="muted">{t('Add the exercises you’re doing, then tick off each set as you go: the rest timer starts on its own.')}</p>
      <Usual have={[]} onAdd={onAdd} />
      <button class="btn btn-primary wo-wide" onClick={onPick}>
        <Icon name="circle-plus" size={18} />
        {t('Add exercises')}
      </button>
    </div>
  );
}

/**
 * The rest between sets: on a phone it floats above the tab bar, on a wide screen it's a card in the cockpit with a ring
 * running down round the clock. What's left, what comes next, 15 seconds less or more, and skip. At zero it buzzes, says
 * go, and steps aside.
 */
function RestPill({ rest, onRest, next, card }: { rest: Rest; onRest: (r: Rest | null) => void; next: { name: string; n: number } | null; card?: boolean }) {
  const now = useClock();
  const left = Math.max(0, rest.end - now);
  const over = left <= 0;
  const share = Math.min(1, left / (rest.total * 1000));
  const onRestRef = useRef(onRest);
  onRestRef.current = onRest;
  useEffect(() => {
    if (!over) return;
    if (typeof navigator.vibrate === 'function') navigator.vibrate([160, 90, 160]);
    else haptic(20);
    const gone = setTimeout(() => onRestRef.current(null), 3000);
    return () => clearTimeout(gone);
  }, [over]);
  // from when it ends (or from now, once it has)
  const by = (s: number) => onRest({ end: Math.max(Date.now(), Math.max(Date.now(), rest.end) + s * 1000), total: Math.max(1, rest.total + s) });
  const time = <b class="wo-rest-n">{over ? t('Go') : clock(left + 999)}</b>;
  const then = next && <span class="wo-rest-next">{t('Next: {name}, set {n}', { name: next.name, n: next.n })}</span>;
  const tools = (
    <>
      <button class="icon-btn small wo-rest-btn" onClick={() => by(-15)} disabled={over} aria-label={t('15 seconds less')} title={t('15 seconds less')}>−15</button>
      <button class="icon-btn small wo-rest-btn" onClick={() => by(15)} aria-label={t('15 seconds more')} title={t('15 seconds more')}>+15</button>
      <button class="icon-btn small wo-rest-btn" onClick={() => onRest(null)} aria-label={t('Skip the rest')} title={t('Skip the rest')}>
        <Icon name={over ? 'x' : 'player-skip-forward'} size={16} />
      </button>
    </>
  );
  if (card) {
    return (
      <div class={`card wo-rest is-card${over ? ' is-over' : ''}`} role="timer" aria-label={t('Rest')}>
        <span class="wo-live-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle class="wo-live-ring-track" cx="50" cy="50" r="44" />
            <circle class="wo-live-ring-arc" cx="50" cy="50" r="44" pathLength={100} style={{ strokeDashoffset: 100 - share * 100 }} />
          </svg>
          {time}
        </span>
        <span class="wo-rest-text">
          <span class="wo-label"><Icon name={over ? 'player-play' : 'alarm'} size={14} />{t('Rest')}</span>
          {then}
        </span>
        <span class="wo-live-rest-tools">{tools}</span>
      </div>
    );
  }
  return (
    <div class={`wo-rest glass${over ? ' is-over' : ''}`} role="timer" aria-label={t('Rest')}>
      <span class="wo-rest-bar" aria-hidden="true"><i style={{ transform: `scaleX(${share})` }} /></span>
      <Icon name={over ? 'player-play' : 'alarm'} size={18} />
      <span class="wo-rest-text">
        {time}
        {then}
      </span>
      {tools}
    </div>
  );
}
