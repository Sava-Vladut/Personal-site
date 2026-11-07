// The Workout page, where you train for power (⚡; lib/fitness.ts says how it's counted). With no workout going it shows
// this week at a glance and a way to start, your plans (or a few to start from), the last few workouts and your body
// weight; with one going, the workout itself (components/workout/Live.tsx). A plan opens in place as ?plan=<id>. The
// numbers over time are under Insights (views/Training.tsx).
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addDays, dayLabel, startOfWeek, todayKey, weekday, WEEKDAYS } from '../lib/dates';
import { navigate } from '../lib/router';
import { dayOf, fmtPower, metTarget, workoutPower, type Muscle, type Routine, type Workout as Done } from '../lib/fitness';
import { saveRoutine, toast, uid, useReady, useRoutines, useSettings, useWeighIns, useWorkouts } from '../lib/store';
import { usePref } from '../lib/prefs';
import { useSync } from '../lib/sync';
import { count, listOf, t } from '../lib/i18n';
import { MuscleIcon } from '../components/BodyMap';
import { MUSCLE_NAME, Power } from '../components/fitness';
import { Icon, type UiName } from '../components/icons';
import { PageHead } from '../components/PageHead';
import { Live } from '../components/workout/Live';
import { PlanEditor } from '../components/workout/PlanEditor';
import { PowerInfo } from '../components/workout/PowerInfo';
import { starterPlans } from '../components/workout/Starters';
import { WeighInSheet } from '../components/workout/WeighIn';
import { kgText, MovesProvider, planName, span, startWorkout, useBodyWeight, useMoves, useWorkoutAccent, WORKOUT_WORLD } from '../components/workout/shared';
import '../styles/workout.css';

const WORLD = WORKOUT_WORLD;

/** A plan opens in place of the page, from its top; going back finds the page scrolled where it was. */
function useScrollSwap(plan: string | null) {
  const was = useRef(0);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) return void (first.current = false);
    if (plan) {
      was.current = scrollY;
      scrollTo(0, 0);
    } else scrollTo(0, was.current);
  }, [plan]);
}

export function Workout({ query }: { id: string; query: URLSearchParams }) {
  useWorkoutAccent();
  const ready = useReady();
  const workouts = useWorkouts();
  const live = workouts.find((w) => w.end === null);
  const plan = query.get('plan');
  useScrollSwap(plan);
  if (!ready) return <div class="page wo-page"><PageHead title={t('Workout')} wheel world={WORLD} /></div>;
  return (
    <MovesProvider>
      {plan ? <PlanEditor key={plan} id={plan} /> : live ? <Live key={live.id} workout={live} /> : <Home workouts={workouts} />}
    </MovesProvider>
  );
}

/* ---------- with no workout going ---------- */

function Home({ workouts }: { workouts: Done[] }) {
  const plans = useRoutines();
  const weighins = useWeighIns();
  const bw = useBodyWeight();
  const { weekStart } = useSettings();
  const [sheet, setSheet] = useState<'weight' | 'power' | null>(null);
  const [nudged, setNudged] = usePref<boolean>('wo-weight-nudged', false);
  const sync = useSync();
  const [syncNudged, setSyncNudged] = usePref<boolean>('wo-sync-nudged', false);
  const done = useMemo(() => workouts.filter((w) => w.end !== null), [workouts]);
  // the last time each plan was done
  const lastOf = useMemo(() => {
    const m = new Map<string, Done>();
    for (const w of done) if (w.plan && !m.has(w.plan)) m.set(w.plan, w);
    return m;
  }, [done]);
  const start = (r: Routine | null) => startWorkout(r, bw).then((ok) => ok && scrollTo({ top: 0 }));
  const newPlan = () => navigate('workout?plan=' + uid());

  return (
    <div class="page wo-page">
      <PageHead
        title={t('Workout')}
        wheel
        world={WORLD}
        actions={
          <>
            <button class="btn btn-quiet btn-s wo-bw" onClick={() => setSheet('weight')} aria-label={t('Your weight: {kg}. Tap to weigh in', { kg: kgText(bw) })} title={t('Your weight')}>
              <Icon name="scale" size={16} />
              {kgText(bw)}
            </button>
            <button class="btn btn-primary btn-s wo-new" onClick={newPlan} aria-label={t('New workout plan')} title={t('New workout plan')}>
              <Icon name="plus" size={18} stroke={2.5} />
              {t('New')}
            </button>
          </>
        }
      />

      {!weighins.length && !nudged && (
        <div class="card wo-nudge fade-arrive-soft">
          <button class="wo-nudge-main" onClick={() => setSheet('weight')}>
            <span class="wo-tile"><Icon name="scale" size={20} /></span>
            <span>{t('Set your weight so body moves count fairly')}</span>
          </button>
          <button class="icon-btn small" onClick={() => setNudged(true)} aria-label={t('Not now')} title={t('Not now')}>
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {!sync.on && !syncNudged && (plans.length > 0 || workouts.length > 0 || weighins.length > 0) && (
        <div class="card wo-nudge fade-arrive-soft">
          <button class="wo-nudge-main" onClick={() => navigate('settings')}>
            <span class="wo-tile"><Icon name="refresh" size={20} /></span>
            <span>{t('Your workouts stay on this device. Turn on sync in Settings to have them on your others')}</span>
          </button>
          <button class="icon-btn small" onClick={() => setSyncNudged(true)} aria-label={t('Not now')} title={t('Not now')}>
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      <div class="wo-home">
        <Week done={done} weekStart={weekStart} onStart={() => start(null)} onInfo={() => setSheet('power')} />
        <section class="section wo-plans">
          <h2 class="section-title">
            <Icon name="list-details" size={16} />
            {t('Your workouts')}
            {plans.length > 0 && <span class="wo-count">{plans.length}</span>}
          </h2>
          {plans.length ? (
            <div class="card list wo-list">
              {plans.map((r) => <PlanRow key={r.id} r={r} last={lastOf.get(r.id)} onStart={() => start(r)} />)}
            </div>
          ) : (
            <Starters bw={bw} onNew={newPlan} />
          )}
        </section>
        {done.length > 0 && <Recent done={done.slice(0, 3)} />}
      </div>

      <WeighInSheet open={sheet === 'weight'} onClose={() => setSheet(null)} />
      <PowerInfo open={sheet === 'power'} onClose={() => setSheet(null)} bw={bw} />
    </div>
  );
}

/**
 * This week at a glance: a dot a day (a bolt on the days you trained), the power it has come to, and the way to start a
 * workout with nothing planned.
 */
function Week({ done, weekStart, onStart, onInfo }: { done: Done[]; weekStart: 0 | 1; onStart: () => void; onInfo: () => void }) {
  const today = todayKey();
  const from = startOfWeek(today, weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const byDay = new Map<string, number>();
  let n = 0;
  for (const w of done) {
    const d = dayOf(w.start);
    if (d < from || d > days[6]) continue;
    n++;
    byDay.set(d, (byDay.get(d) ?? 0) + workoutPower(w));
  }
  const total = [...byDay.values()].reduce((a, b) => a + b, 0);
  return (
    <section class="card wo-hero">
      <div class="wo-hero-head">
        <span class="wo-label"><Icon name="calendar-week" size={14} />{t('This week')}</span>
        <button class="icon-btn small" onClick={onInfo} aria-label={t('How power works')} title={t('How power works')}>
          <Icon name="info-circle" size={16} />
        </button>
      </div>
      <div class="wo-hero-row">
        <Power value={total} size={24} class="wo-hero-n" />
        <span class="muted small">{n ? count(n, 'workout', 'workouts') : t('No workout yet this week')}</span>
      </div>
      <ol class="wo-week">
        {days.map((d) => {
          const p = byDay.get(d);
          const label = p === undefined ? dayLabel(d) : `${dayLabel(d)}: ${fmtPower(p)} ⚡`;
          return (
            <li key={d} class={`wo-day${p !== undefined ? ' is-on' : ''}${d === today ? ' is-today' : ''}${d > today ? ' is-ahead' : ''}`} title={label} aria-label={label}>
              <span class="wo-dot">{p !== undefined && <Icon name="bolt" size={14} />}</span>
              <span class="wo-day-name" aria-hidden="true">{WEEKDAYS[weekday(d)]}</span>
            </li>
          );
        })}
      </ol>
      <button class="btn btn-primary wo-wide" onClick={onStart}>
        <Icon name="player-play" size={18} />
        {t('Start empty workout')}
      </button>
    </section>
  );
}

/** The muscles a plan works most, by the sets that go to each exercise's main one. */
function mainMuscles(r: Pick<Routine, 'items'>, n = 3) {
  const by = new Map<Muscle, number>();
  for (const it of r.items) {
    const m = it.move.muscles[0];
    if (m) by.set(m, (by.get(m) ?? 0) + it.sets.length);
  }
  return [...by].sort((a, b) => b[1] - a[1]).slice(0, n).map(([m]) => m);
}

/** What a plan is, in icons: the power it asks for, the muscles it works, how many exercises. */
function PlanMeta({ r }: { r: Routine }) {
  return (
    <>
      {r.target > 0 && <Power value={r.target} size={12} />}
      {mainMuscles(r).map((m) => <MuscleIcon key={m} muscle={m} size={14} />)}
      <span class="wo-meta-text" title={count(r.items.length, 'exercise', 'exercises')}>
        <Icon name="list-details" size={12} />
        {r.items.length}
      </span>
    </>
  );
}

/** The exercises a plan is made of, in a line: only shown where there's room for it (desktop.css-sized screens). */
function MovesLine({ r }: { r: Pick<Routine, 'items'> }) {
  if (!r.items.length) return null;
  const names = r.items.slice(0, 4).map((it) => it.move.name);
  const more = r.items.length - names.length;
  return <span class="wo-row-moves">{names.join(' · ')}{more > 0 && ` · +${more}`}</span>;
}

function PlanRow({ r, last, onStart }: { r: Routine; last?: Done; onStart: () => void }) {
  const name = planName(r);
  return (
    <div class="wo-row">
      <button class="wo-row-main" onClick={() => navigate('workout?plan=' + r.id)} aria-label={t('Change {name}', { name })}>
        <span class="wo-tile"><Icon name={r.icon as UiName} size={20} /></span>
        <span class="wo-row-text">
          <span class="wo-row-name">{name}</span>
          <MovesLine r={r} />
          <span class="wo-meta">
            <PlanMeta r={r} />
            {last && (
              <span class="wo-meta-text" title={t('Last done')}>
                <Icon name="history" size={12} />
                {dayLabel(dayOf(last.start))}
              </span>
            )}
          </span>
        </span>
      </button>
      <button class="wo-play" onClick={onStart} disabled={!r.items.length} aria-label={t('Start {name}', { name })} title={t('Start {name}', { name })}>
        <Icon name="player-play" size={18} />
      </button>
    </div>
  );
}

/** With no plans yet: a few ready-made ones, each added in a tap, and the way to make your own. */
function Starters({ bw, onNew }: { bw: number; onNew: () => void }) {
  const { byId, ready } = useMoves();
  const plans = useMemo(() => (ready ? starterPlans(byId, bw) : []), [byId, ready, bw]);
  const add = async (r: Routine) => {
    await saveRoutine(r);
    toast(t('{name} is in your workouts', { name: r.name }));
  };
  return (
    <div class="wo-starters">
      <p class="muted">{t('Start from one of these, or make your own.')}</p>
      {ready ? (
        <div class="card list wo-list fade-arrive-soft">
          {plans.map((r) => (
            <button key={r.name} class="wo-row wo-row-main wo-starter" onClick={() => add(r)} aria-label={t('Add {name}', { name: r.name })}>
              <span class="wo-tile"><Icon name={r.icon as UiName} size={20} /></span>
              <span class="wo-row-text">
                <span class="wo-row-name">{r.name}</span>
                <MovesLine r={r} />
                <span class="wo-meta">
                  <PlanMeta r={r} />
                  <span class="wo-meta-text">{listOf(mainMuscles(r, 4).map((m) => MUSCLE_NAME[m]))}</span>
                </span>
              </span>
              <span class="wo-add-ico" aria-hidden="true"><Icon name="plus" size={18} /></span>
            </button>
          ))}
        </div>
      ) : (
        <div class="card list wo-list" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} class="wo-ghost-row">
              <span class="ghost wo-ghost-thumb" />
              <span class="wo-ghost-lines"><span class="ghost" /><span class="ghost" /></span>
            </span>
          ))}
        </div>
      )}
      <button class="btn btn-quiet wo-wide" onClick={onNew}>
        <Icon name="plus" size={18} />
        {t('Make your own')}
      </button>
    </div>
  );
}

/** The last few workouts: when, how long, and their power against what they asked for. The rest is under Insights. */
function Recent({ done }: { done: Done[] }) {
  return (
    <section class="section wo-recent">
      <header class="wo-head">
        <h2 class="section-title"><Icon name="history" size={16} />{t('Recent')}</h2>
        <button class="wo-more" onClick={() => navigate('training')}>
          <Icon name="chart-line" size={14} />
          {t('See all')}
          <Icon name="chevron-right" size={14} />
        </button>
      </header>
      <div class="card list wo-list">
        {done.map((w) => {
          const p = workoutPower(w), met = metTarget(w, p);
          return (
            <div key={w.id} class="wo-row">
              <span class="wo-tile"><Icon name={w.icon as UiName} size={20} /></span>
              <span class="wo-row-text">
                <span class="wo-row-name">{w.name}</span>
                <span class="wo-meta">
                  <span class="wo-meta-text">{dayLabel(dayOf(w.start))}</span>
                  <span class="wo-meta-text"><Icon name="stopwatch" size={12} />{span((w.end ?? w.start) - w.start)}</span>
                </span>
              </span>
              <span class={`wo-done-p${met ? ' is-met' : ''}`} title={met ? t('Target met') : undefined}>
                {met && <Icon name="circle-check" size={16} />}
                <Power value={p} />
                {w.target > 0 && <span class="wo-of">/ {fmtPower(w.target)}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
