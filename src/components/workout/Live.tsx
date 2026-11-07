// The workout going on. A bar stays at the top with the power done against the power asked for, the time and the way to
// finish; each exercise is a card of sets to tick off; and after each set a rest timer floats at the bottom. Everything
// is saved as you go, so leaving the page (or closing the app) and coming back finds it as it was.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { blankSet, fmtPower, itemPower, MAX_SETS, metTarget, planPower, suggestTarget, workoutPower, type Item, type Routine, type WSet, type Workout } from '../../lib/fitness';
import { deleteWorkout, saveRoutine, saveWorkout, toast, useWorkouts } from '../../lib/store';
import { haptic } from '../../lib/haptics';
import { count, t } from '../../lib/i18n';
import { countsPushups } from '../../lib/pushups';
import { ask } from '../Confirm';
import { Power } from '../fitness';
import { Icon } from '../icons';
import { PageHead } from '../PageHead';
import { Sheet } from '../Sheet';
import { ExerciseInfo } from './ExerciseInfo';
import { FinishSheet } from './Finish';
import { ItemMenu } from './ItemMenu';
import { Picker } from './Picker';
import { PushupCounter, unlockSound } from './PushupCounter';
import { SetRows } from './SetRows';
import { clock, itemActions, lastPlanWorkout, lastSets, PerUnit, restText, TargetStepper, Thumb, useClock, useDraft } from './shared';

interface Rest { end: number; total: number }
/** The rest timer outlives the page being left for a moment (another tab, a look at a plan). */
let resting: Rest | null = null;

export function Live({ workout }: { workout: Workout }) {
  const all = useWorkouts();
  const { draft: w, update, flush, drop } = useDraft(workout, saveWorkout);
  const ghosts = useMemo(() => lastSets(all, w.id), [all]);
  const last = useMemo(() => (w.plan ? lastPlanWorkout(all, w.plan) : undefined), [all]);
  const power = workoutPower(w);
  const act = itemActions<Workout>(w.items, update, ghosts, true);

  const [rest, setRestNow] = useState<Rest | null>(() => (resting && resting.end > Date.now() ? resting : null));
  const setRest = (r: Rest | null) => setRestNow((resting = r));
  // adding exercises, or swapping the one at an index for another
  const [picking, setPicking] = useState<{ swap: number | null } | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [info, setInfo] = useState<Item | null>(null);
  const [aiming, setAiming] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // the exercise whose push-ups the camera is counting
  const [counting, setCounting] = useState<number | null>(null);

  const discard = async () => {
    const yes = await ask({ title: t('Discard this workout?'), text: t('None of its sets will be kept.'), ok: t('Discard'), danger: true });
    if (!yes) return;
    drop();
    setRest(null);
    await deleteWorkout(w.id);
    toast(t('Workout discarded'));
    scrollTo({ top: 0 });
  };
  const save = async (done: Workout, plan: Routine | null) => {
    drop();
    try {
      await saveWorkout(done);
      if (plan) await saveRoutine(plan);
    } catch {
      return toast(t('Couldn’t save the workout. Try again.'));
    }
    setRest(null);
    toast(metTarget(done) ? t('Workout saved. Target met!') : t('Workout saved'));
    scrollTo({ top: 0 });
  };

  // the camera's count goes into the next set not done yet (or a new one), which then counts as done and starts the rest
  const logReps = (i: number, reps: number) => {
    const it = w.items[i];
    if (!it) return;
    const k = it.sets.findIndex((s) => !s.done);
    if (k < 0 && it.sets.length >= MAX_SETS) return toast(t('This exercise has as many sets as it can hold.'));
    const sets = k >= 0 ? it.sets.map((s, j) => (j === k ? { ...s, reps, done: true } : s)) : [...it.sets, { ...blankSet(it.move.kind), reps, done: true }];
    act.setItem(i, { ...it, sets });
    if (it.rest > 0) setRest({ end: Date.now() + it.rest * 1000, total: it.rest });
    toast(t('{count} saved', { count: count(reps, 'push-up', 'push-ups') }));
  };

  // adding and discarding: under the exercises on a phone, in the side panel on a wide screen
  const ends = (
    <>
      <button class={`btn wo-wide ${w.items.length ? 'btn-quiet' : 'btn-primary'}`} onClick={() => setPicking({ swap: null })}>
        <Icon name="circle-plus" size={18} />
        {t('Add exercises')}
      </button>
      <button class="btn btn-quiet danger wo-wide" onClick={discard}>
        <Icon name="trash" size={18} />
        {t('Discard workout')}
      </button>
    </>
  );

  return (
    <div class="page wo-page wo-live-page">
      <PageHead title={w.name} wheel world="hope-interest" />
      {/* on a phone its parts are just the bar at the top; on a wide screen it's a panel beside the exercises */}
      <aside class="wo-side">
        <LiveBar w={w} power={power} onTarget={() => setAiming(true)} onFinish={() => (flush(), setFinishing(true))} />
        {w.items.length > 0 && <Outline items={w.items} bw={w.bw} />}
        <div class="wo-side-end">{ends}</div>
      </aside>

      {w.items.length ? (
        <div class="stack-l wo-live-list">
          {w.items.map((it, i) => (
            <LiveItem
              key={i}
              id={`wo-item-${i}`}
              it={it}
              bw={w.bw}
              ghosts={ghosts.get(it.move.id)}
              onSets={(sets) => act.setItem(i, { ...it, sets })}
              onRemoveSet={(k) => act.removeSet(i, k)}
              onAddSet={() => act.addSet(i)}
              onDone={() => it.rest > 0 && setRest({ end: Date.now() + it.rest * 1000, total: it.rest })}
              onMenu={() => setMenu(i)}
              onInfo={() => setInfo(it)}
              onCount={countsPushups(it.move) ? () => (unlockSound(), setCounting(i)) : undefined}
            />
          ))}
        </div>
      ) : (
        <div class="empty wo-live-empty">
          <span class="wo-tile big" aria-hidden="true"><Icon name="barbell" size={24} /></span>
          <p>{t('Add the exercises you’re doing, then tick off each set as you go.')}</p>
        </div>
      )}

      <div class="wo-live-end">{ends}</div>

      {rest && <RestPill rest={rest} onRest={setRest} />}

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
          act.swap(menu, menu + by);
          setMenu(menu + by);
        }}
        onRemove={() => menu !== null && act.remove(menu)}
      />
      <ExerciseInfo move={info?.move ?? null} onClose={() => setInfo(null)} />
      <Sheet
        open={aiming}
        onClose={() => setAiming(false)}
        title={t('Target power')}
        footer={<button class="btn btn-primary wo-wide" onClick={() => setAiming(false)}>{t('Done')}</button>}
      >
        <TargetStepper
          value={w.target}
          onValue={(target) => update((x) => ({ ...x, target }))}
          suggested={suggestTarget(w, w.bw, last && workoutPower(last))}
          full={planPower(w, w.bw)}
        />
        <p class="muted small wo-sheet-note">{t('Only the sets you tick off count toward it.')}</p>
      </Sheet>
      {counting !== null && (
        <PushupCounter
          saveLabel={t('Save as a set')}
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
 * The bar at the top: a ring that fills with the power done toward the target (a trophy, and a pop, once it's met), the
 * numbers beside it (a tap changes the target), the time so far and Finish.
 */
function LiveBar({ w, power, onTarget, onFinish }: { w: Workout; power: number; onTarget: () => void; onFinish: () => void }) {
  const met = w.target > 0 && power >= w.target;
  const was = useRef(met);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    // only reaching it now pops, not opening a workout that had already
    if (met && !was.current) {
      setPop(true);
      haptic(20);
    }
    was.current = met;
  }, [met]);
  const p = w.target > 0 ? Math.min(1, power / w.target) : 0;
  const aim = w.target > 0 ? t('Target: {p} ⚡. Tap to change it', { p: fmtPower(w.target) }) : t('Set a target');
  return (
    <div class="wo-bar">
      <button class={`wo-power${met ? ' is-met' : ''}`} onClick={onTarget} aria-label={aim} title={aim}>
        <span class={`wo-ring${pop ? ' is-pop' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <circle class="wo-ring-track" cx="24" cy="24" r="21" />
            {p > 0 && <circle class="wo-ring-fill" cx="24" cy="24" r="21" pathLength={100} style={{ strokeDashoffset: 100 - p * 100 }} />}
          </svg>
          <Icon name={met ? 'trophy' : 'bolt'} size={18} />
        </span>
        <span class="wo-power-text">
          <span class="wo-power-n">
            <b>{fmtPower(power)}</b>
            {w.target > 0 && <span class="wo-of">/ {fmtPower(w.target)}</span>}
          </span>
          <span class="wo-power-sub">{met ? t('Target met') : w.target > 0 ? t('{p} ⚡ to go', { p: fmtPower(w.target - power) }) : t('Set a target')}</span>
        </span>
      </button>
      <Elapsed start={w.start} />
      {/* the main thing to do once something's been done; until then, adding exercises is */}
      <button class={`btn btn-s wo-finish ${w.items.some((it) => it.sets.some((s) => s.done)) ? 'btn-primary' : 'btn-quiet'}`} onClick={onFinish}>
        <Icon name="flag-check" size={16} />
        {t('Finish')}
      </button>
    </div>
  );
}

/**
 * The exercises at a glance, in the side panel on a wide screen: how many sets of each are ticked off and the power they
 * came to. A tap scrolls to the exercise.
 */
function Outline({ items, bw }: { items: Item[]; bw: number }) {
  const go = (i: number) => document.getElementById(`wo-item-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <nav class="card list wo-outline" aria-label={t('Exercises')}>
      {items.map((it, i) => {
        const done = it.sets.filter((s) => s.done).length;
        const all = done > 0 && done === it.sets.length;
        return (
          <button key={i} class={`wo-outline-row${all ? ' is-done' : ''}`} onClick={() => go(i)}>
            <Thumb move={it.move} on={all} />
            <span class="wo-outline-text">
              <span class="wo-outline-name">{it.move.name}</span>
              <span class="wo-meta">
                <span class="wo-meta-text" title={t('Sets done')}><Icon name="check" size={12} />{done}/{it.sets.length}</span>
                {done > 0 && <Power value={itemPower(it, bw)} size={12} />}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** The time since the workout started, ticking on its own so the rest of the page doesn't redraw every second. */
function Elapsed({ start }: { start: number }) {
  const now = useClock();
  return (
    <span class="wo-clock" role="timer" title={t('Time so far')}>
      <Icon name="stopwatch" size={14} />
      {clock(now - start)}
    </span>
  );
}

function LiveItem({ id, it, bw, ghosts, onSets, onRemoveSet, onAddSet, onDone, onMenu, onInfo, onCount }: {
  id: string;
  it: Item;
  bw: number;
  ghosts?: WSet[];
  onSets: (sets: WSet[]) => void;
  onRemoveSet: (k: number) => void;
  onAddSet: () => void;
  onDone: () => void;
  onMenu: () => void;
  onInfo: () => void;
  /** Push-ups: count a set with the camera. */
  onCount?: () => void;
}) {
  const done = it.sets.filter((s) => s.done).length;
  return (
    <article id={id} class={`card wo-item${done && done === it.sets.length ? ' is-done' : ''}`}>
      <div class="wo-item-head">
        <button class="wo-thumb-btn" onClick={onInfo} aria-label={t('About {name}', { name: it.move.name })} title={t('About {name}', { name: it.move.name })}>
          <Thumb move={it.move} />
        </button>
        <div class="wo-item-title">
          <button class="wo-item-name" onClick={onInfo} title={t('About {name}', { name: it.move.name })}>{it.move.name}</button>
          <span class="wo-meta">
            {it.pair && <span class="wo-pair" title={t('One in each hand (counts ×2)')}>×2</span>}
            <PerUnit move={it.move} bw={bw} />
            {it.rest > 0 && <span class="wo-meta-text" title={t('Rest between sets')}><Icon name="alarm" size={12} />{restText(it.rest)}</span>}
          </span>
        </div>
        <button class="icon-btn small" onClick={onMenu} aria-label={t('Options for {name}', { name: it.move.name })} title={t('More')}>
          <Icon name="dots" size={16} />
        </button>
      </div>
      {it.note && <p class="wo-note"><Icon name="pencil" size={12} />{it.note}</p>}
      <SetRows item={it} bw={bw} live ghosts={ghosts} onSets={onSets} onRemove={onRemoveSet} onDone={onDone} />
      <div class="wo-item-foot">
        <span class="wo-item-acts">
          <button class="btn btn-quiet btn-s" onClick={onAddSet} disabled={it.sets.length >= MAX_SETS}>
            <Icon name="plus" size={16} />
            {t('Set')}
          </button>
          {onCount && (
            <button class="btn btn-quiet btn-s" onClick={onCount} aria-label={t('Count push-ups with the camera')} title={t('Count push-ups with the camera')}>
              <Icon name="camera" size={16} />
              {t('Camera')}
            </button>
          )}
        </span>
        <span class="wo-item-sum" title={count(done, 'set done', 'sets done')}>
          <Icon name="check" size={14} />
          {done}/{it.sets.length}
          <Power value={itemPower(it, bw)} />
        </span>
      </div>
    </article>
  );
}

/**
 * The rest between sets, floating above the tab bar: what's left, 15 seconds less or more, and skip. At zero it buzzes,
 * says go, and steps aside.
 */
function RestPill({ rest, onRest }: { rest: Rest; onRest: (r: Rest | null) => void }) {
  const now = useClock();
  const left = Math.max(0, rest.end - now);
  const over = left <= 0;
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
  return (
    <div class={`wo-rest glass${over ? ' is-over' : ''}`} role="timer" aria-label={t('Rest')}>
      <span class="wo-rest-bar" aria-hidden="true"><i style={{ transform: `scaleX(${left / (rest.total * 1000)})` }} /></span>
      <Icon name={over ? 'player-play' : 'alarm'} size={18} />
      <b class="wo-rest-n">{over ? t('Go') : clock(left + 999)}</b>
      <button class="icon-btn small wo-rest-btn" onClick={() => by(-15)} disabled={over} aria-label={t('15 seconds less')} title={t('15 seconds less')}>−15</button>
      <button class="icon-btn small wo-rest-btn" onClick={() => by(15)} aria-label={t('15 seconds more')} title={t('15 seconds more')}>+15</button>
      <button class="icon-btn small" onClick={() => onRest(null)} aria-label={t('Skip the rest')} title={t('Skip the rest')}>
        <Icon name={over ? 'x' : 'player-skip-forward'} size={16} />
      </button>
    </div>
  );
}
