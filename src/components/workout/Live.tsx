// The workout going on. A slim bar stays at the top: the power done against the power asked for, the time, the workout's
// options and Finish, with a line along its foot filling as sets are ticked off. Each exercise is a card of numbered sets.
// Only the exercise you're on is open, the set to do now picked out; the others are folded to a line saying what they
// hold (a tap opens any of them), and finishing one moves on to the next. After each set a rest timer floats at the
// bottom saying what's next. Everything is saved as you go, so leaving the page (or closing the app) and
// coming back finds it as it was.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { blankSet, fmtPower, itemPower, MAX_SETS, metTarget, planPower, suggestTarget, workoutPower, type Item, type Move, type Routine, type WSet, type Workout } from '../../lib/fitness';
import { deleteWorkout, saveRoutine, saveWorkout, toast, useWorkouts } from '../../lib/store';
import { haptic } from '../../lib/haptics';
import { usePref } from '../../lib/prefs';
import { count, t } from '../../lib/i18n';
import { countsPushups } from '../../lib/pushups';
import { onComputer } from '../../lib/desktop';
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
import {
  clock, itemActions, lastPlanWorkout, lastSets, PerUnit, restText, setsLine, TargetStepper, totalReps, Thumb, useClock, useDraft,
  useMoves, useUsedCounts, useWakeLock, whereAt,
} from './shared';

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
  // the exercise a set was last ticked off in: where the workout goes on from
  const [touched, setTouched] = useState(0);
  const at = whereAt(w.items, touched);
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
  const folded = (it: Item, i: number) => folds[it.move.id] ?? i !== at?.i;
  const fold = (it: Item, i: number) => setFolds((f) => ({ ...f, [it.move.id]: !folded(it, i) }));

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
  // a set ticked off: the rest starts, and the last of an exercise folds it and brings up the next one
  const ticked = (i: number, k: number) => {
    const it = w.items[i];
    if (!it) return;
    restAfter(it);
    setTouched(i);
    if (!it.sets.every((s, j) => j === k || s.done)) return;
    setFolds(({ [it.move.id]: _, ...rest }) => rest);
    const then = whereAt(w.items.map((x, j) => (j === i ? { ...x, sets: x.sets.map((s, q) => (q === k ? { ...s, done: true } : s)) } : x)), i);
    if (then && then.i !== i) setTimeout(() => document.getElementById(`wo-item-${then.i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
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
    act.setItem(i, { ...it, sets: next });
    restAfter(it);
    setTouched(i);
    toast(t('{count} saved', { count: count(counted.reduce((a, b) => a + b, 0), 'push-up', 'push-ups') }));
  };

  const addBtn = (
    <button class="wo-add-btn" onClick={() => setPicking({ swap: null })}>
      <Icon name="circle-plus" size={18} />
      {t('Add exercises')}
    </button>
  );

  return (
    <div class="page wo-page wo-live-page">
      <PageHead title={w.name} wheel world="hope-interest" />
      {/* on a phone its parts are just the bar at the top; on a wide screen it's a panel beside the exercises */}
      <aside class="wo-side">
        <LiveBar w={w} power={power} done={done} sets={sets} onOptions={() => setOptions(true)} onFinish={finish} />
        {w.items.length > 0 && <Outline items={w.items} bw={w.bw} at={at?.i ?? -1} onGo={(i) => w.items[i] && setFolds((f) => ({ ...f, [w.items[i].move.id]: false }))} />}
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
                <button class="btn btn-primary btn-s" onClick={finish}>{t('Finish')}</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <Empty onPick={() => setPicking({ swap: null })} onAdd={(m) => act.add([m], null)} />
      )}

      {rest && <RestPill rest={rest} onRest={setRest} next={at ? { name: w.items[at.i].move.name, n: at.k + 1 } : null} />}

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
 * The bar at the top: a ring that fills with the power done toward the target (a trophy, and a pop, once it's met), the
 * numbers and the time beside it (a tap opens the workout's options, the target among them), the options and Finish. A
 * line along its foot fills as sets are ticked off.
 */
function LiveBar({ w, power, done, sets, onOptions, onFinish }: { w: Workout; power: number; done: number; sets: number; onOptions: () => void; onFinish: () => void }) {
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
      <button class={`wo-power${met ? ' is-met' : ''}`} onClick={onOptions} aria-label={aim} title={aim}>
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
            {w.target > 0 ? <span class="wo-of">/ {fmtPower(w.target)} ⚡</span> : <span class="wo-of">⚡</span>}
          </span>
          <span class="wo-power-sub">
            <Elapsed start={w.start} />
            <span class="wo-power-goal">{met ? t('Target met') : w.target > 0 ? t('{p} ⚡ to go', { p: fmtPower(w.target - power) }) : t('Set a target')}</span>
          </span>
        </span>
      </button>
      <button class="icon-btn wo-bar-more" onClick={onOptions} aria-label={t('Workout options')} title={t('Workout options')}>
        <Icon name="dots" size={18} />
      </button>
      {/* the main thing to do once something's been done; until then, adding exercises is */}
      <button class={`btn btn-s wo-finish ${done ? 'btn-primary' : 'btn-quiet'}`} onClick={onFinish}>
        <Icon name="flag-check" size={16} />
        {t('Finish')}
      </button>
      <span class="wo-bar-line" role="progressbar" aria-label={t('Sets done')} aria-valuemin={0} aria-valuemax={sets} aria-valuenow={done} title={t('{n} of {total} sets done', { n: done, total: sets })}>
        <i style={{ transform: `scaleX(${sets ? done / sets : 0})` }} />
      </span>
    </div>
  );
}

/**
 * The exercises at a glance, in the side panel on a wide screen: how many sets of each are ticked off and the power they
 * came to, the one you're on picked out. A tap opens the exercise and scrolls to it.
 */
function Outline({ items, bw, at, onGo }: { items: Item[]; bw: number; at: number; onGo: (i: number) => void }) {
  const go = (i: number) => {
    onGo(i);
    setTimeout(() => document.getElementById(`wo-item-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };
  return (
    <nav class="card list wo-outline" aria-label={t('Exercises')}>
      {items.map((it, i) => {
        const done = it.sets.filter((s) => s.done).length;
        const all = done > 0 && done === it.sets.length;
        return (
          <button key={i} class={`wo-outline-row${all ? ' is-done' : ''}${i === at ? ' is-now' : ''}`} onClick={() => go(i)} aria-current={i === at ? 'step' : undefined}>
            <Thumb move={it.move} on={all} />
            <span class="wo-outline-text">
              <span class="wo-outline-name">{it.move.name}</span>
              <span class="wo-meta">
                <span class="wo-meta-text" title={t('Sets done')}><Icon name="check" size={12} />{done}/{it.sets.length}</span>
                {done > 0 && <Power value={itemPower(it, bw)} size={12} />}
              </span>
            </span>
            {i === at && <span class="wo-now-dot" aria-hidden="true" />}
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
      <Icon name="stopwatch" size={13} />
      {clock(now - start)}
    </span>
  );
}

function LiveItem({ id, it, bw, ghosts, next, folded, onFold, onSets, onRemoveSet, onAddSet, onDone, onMenu, onInfo, onCount }: {
  id: string;
  it: Item;
  bw: number;
  ghosts?: WSet[];
  /** The set to do now, when it's in this exercise. */
  next?: number;
  folded: boolean;
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
    <article id={id} class={`card wo-item${all ? ' is-done' : ''}${next !== undefined ? ' is-now' : ''}${folded ? ' is-folded' : ''}`}>
      <div class="wo-item-head">
        <button class="wo-thumb-btn" onClick={onInfo} aria-label={about} title={about}>
          <Thumb move={it.move} on={all} />
        </button>
        <div class="wo-item-title">
          <button class="wo-item-name" onClick={onInfo} title={about}>{it.move.name}</button>
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
        <button class="icon-btn small wo-fold" onClick={onFold} aria-expanded={!folded} aria-label={folded ? t('Show the sets') : t('Fold away')} title={folded ? t('Show the sets') : t('Fold away')}>
          <Icon name="chevron-down" size={16} />
        </button>
        <button class="icon-btn small" onClick={onMenu} aria-label={t('Options for {name}', { name: it.move.name })} title={t('More')}>
          <Icon name="dots" size={16} />
        </button>
      </div>
      {(done > 0 || next !== undefined) && <span class="wo-item-meter" aria-hidden="true"><i style={{ transform: `scaleX(${done / it.sets.length})` }} /></span>}
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
 * The rest between sets, floating above the tab bar: what's left, what comes next, 15 seconds less or more, and skip. At
 * zero it buzzes, says go, and steps aside.
 */
function RestPill({ rest, onRest, next }: { rest: Rest; onRest: (r: Rest | null) => void; next: { name: string; n: number } | null }) {
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
      <span class="wo-rest-text">
        <b class="wo-rest-n">{over ? t('Go') : clock(left + 999)}</b>
        {next && <span class="wo-rest-next">{t('Next: {name}, set {n}', { name: next.name, n: next.n })}</span>}
      </span>
      <button class="icon-btn small wo-rest-btn" onClick={() => by(-15)} disabled={over} aria-label={t('15 seconds less')} title={t('15 seconds less')}>−15</button>
      <button class="icon-btn small wo-rest-btn" onClick={() => by(15)} aria-label={t('15 seconds more')} title={t('15 seconds more')}>+15</button>
      <button class="icon-btn small" onClick={() => onRest(null)} aria-label={t('Skip the rest')} title={t('Skip the rest')}>
        <Icon name={over ? 'x' : 'player-skip-forward'} size={16} />
      </button>
    </div>
  );
}
