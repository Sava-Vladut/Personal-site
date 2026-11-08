// The Workout page, where you train for power (⚡; lib/fitness.ts says how it's counted). With no workout going it shows
// what's up next (the plan you've gone longest without, a tap from starting) or a way to start, this week at a glance,
// your plans (or a few to start from) and the last few workouts, each a tap from being done again; with one going, the
// workout itself (components/workout/Live.tsx). A plan opens in place as ?plan=<id>. The numbers over time are under
// Insights (views/Training.tsx).
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addDays, dayLabel, startOfWeek, todayKey, weekday, WEEKDAYS } from '../lib/dates';
import { navigate } from '../lib/router';
import { dayOf, fmtPower, metTarget, workoutPower, type Muscle, type Routine, type Workout as Done } from '../lib/fitness';
import { finished, streaks } from '../lib/trainingStats';
import { saveRoutine, toast, uid, useReady, useRoutines, useSettings, useWeighIns, useWorkouts } from '../lib/store';
import { usePref } from '../lib/prefs';
import { useSync } from '../lib/sync';
import { count, t } from '../lib/i18n';
import { MuscleIcon } from '../components/BodyMap';
import { FEELS, Power } from '../components/fitness';
import { Icon, type UiName } from '../components/icons';
import { PageHead } from '../components/PageHead';
import { Live } from '../components/workout/Live';
import { PlanEditor } from '../components/workout/PlanEditor';
import { PowerInfo } from '../components/workout/PowerInfo';
import { starterPlans } from '../components/workout/Starters';
import { WeighInSheet } from '../components/workout/WeighIn';
import { againOf, kgText, MovesProvider, planMinutes, planName, span, startWorkout, useBodyWeight, useMoves, useWorkoutAccent, WORKOUT_WORLD, type Source } from '../components/workout/shared';
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

/** The plan to do next: one never done yet (in your order), else the one done longest ago. Plans with no exercises can't be started. */
function upNext(plans: Routine[], lastOf: Map<string, Done>) {
  const ready = plans.filter((r) => r.items.length);
  return ready.find((r) => !lastOf.has(r.id)) ?? [...ready].sort((a, b) => lastOf.get(a.id)!.start - lastOf.get(b.id)!.start)[0] ?? null;
}

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
  const next = useMemo(() => upNext(plans, lastOf), [plans, lastOf]);
  const start = (r: Source | null) => startWorkout(r, bw).then((ok) => ok && scrollTo({ top: 0 }));
  const newPlan = () => navigate('workout?plan=' + uid());

  return (
    <div class="page wo-page">
      <PageHead
        title={t('Workout')}
        wheel
        world={WORLD}
        actions={
          <button class="btn btn-quiet btn-s wo-bw" onClick={() => setSheet('weight')} aria-label={t('Your weight: {kg}. Tap to weigh in', { kg: kgText(bw) })} title={t('Your weight')}>
            <Icon name="scale" size={16} />
            {kgText(bw)}
          </button>
        }
      />

      {!weighins.length && !nudged && (
        <div class="card wo-nudge fade-arrive-soft">
          <button class="wo-nudge-main" onClick={() => setSheet('weight')}>
            <span class="wo-tile small"><Icon name="scale" size={16} /></span>
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
            <span class="wo-tile small"><Icon name="refresh" size={16} /></span>
            <span>{t('Your workouts stay on this device. Turn on sync in Settings to have them on your others')}</span>
          </button>
          <button class="icon-btn small" onClick={() => setSyncNudged(true)} aria-label={t('Not now')} title={t('Not now')}>
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {/* on a phone one column: up next, the week, the plans, the recent ones; on a wide screen the week and the recent ones sit at the right */}
      <div class="wo-home">
        <div class="wo-home-main">
          <UpNext plan={next} last={next ? lastOf.get(next.id) : undefined} onStart={start} />
          <section class="section wo-plans">
            <header class="wo-head">
              <h2 class="section-title">
                <Icon name="list-details" size={16} />
                {t('Your plans')}
                {plans.length > 0 && <span class="wo-count">{plans.length}</span>}
              </h2>
              {plans.length > 0 && (
                <button class="btn btn-primary btn-s wo-new" onClick={newPlan} aria-label={t('New workout plan')} title={t('New workout plan')}>
                  <Icon name="plus" size={16} stroke={2.5} />
                  {t('New')}
                </button>
              )}
            </header>
            {plans.length ? (
              <div class="wo-plan-cards">
                {plans.map((r) => <PlanCard key={r.id} r={r} last={lastOf.get(r.id)} next={r.id === next?.id} onStart={() => start(r)} />)}
              </div>
            ) : (
              <Starters bw={bw} onNew={newPlan} />
            )}
          </section>
        </div>
        <div class="wo-home-side">
          <Week done={done} weekStart={weekStart} onInfo={() => setSheet('power')} />
          {done.length > 0 && <Recent done={done.slice(0, 4)} plans={plans} onAgain={start} />}
        </div>
      </div>

      <WeighInSheet open={sheet === 'weight'} onClose={() => setSheet(null)} />
      <PowerInfo open={sheet === 'power'} onClose={() => setSheet(null)} bw={bw} />
    </div>
  );
}

/** The exercises a plan is made of, in a line. */
function movesLine(r: Pick<Routine, 'items'>, n = 4) {
  const names = r.items.slice(0, n).map((it) => it.move.name);
  const more = r.items.length - names.length;
  return names.join(' · ') + (more > 0 ? ` · +${more}` : '');
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

/** "today", "yesterday", "3 days ago", or the day. */
function since(day: string) {
  const days = Math.round((new Date(todayKey() + 'T12:00').getTime() - new Date(day + 'T12:00').getTime()) / 864e5);
  if (days <= 0) return t('today');
  if (days === 1) return t('yesterday');
  return days < 14 ? t('{n} days ago', { n: days }) : dayLabel(day);
}

/**
 * What to do now, at the top: the plan that's up next, what it holds and how long it takes, started in a tap (or an
 * empty workout instead). With no plans, just the way to start.
 */
function UpNext({ plan, last, onStart }: { plan: Routine | null; last?: Done; onStart: (r: Source | null) => void }) {
  if (!plan) {
    return (
      <section class="card wo-next">
        <span class="wo-label"><Icon name="player-play" size={14} />{t('Ready when you are')}</span>
        <h2 class="wo-next-name">{t('Start a workout')}</h2>
        <p class="wo-next-moves">{t('Add exercises as you go and tick off each set. Make a plan below to start it in a tap next time.')}</p>
        <div class="wo-next-acts">
          <button class="wo-next-go" onClick={() => onStart(null)}>
            <Icon name="player-play" size={18} stroke={2.25} />
            {t('Start empty workout')}
          </button>
        </div>
      </section>
    );
  }
  const name = planName(plan);
  const sets = plan.items.reduce((n, it) => n + it.sets.length, 0);
  return (
    <section class="card wo-next">
      <span class="wo-label"><Icon name="sparkles" size={14} />{t('Up next')}</span>
      <div class="wo-next-top">
        <span class="wo-tile big"><Icon name={plan.icon as UiName} size={24} /></span>
        <span class="wo-next-text">
          <h2 class="wo-next-name">{name}</h2>
          <span class="wo-next-moves">{movesLine(plan, 5)}</span>
        </span>
      </div>
      <div class="wo-chips-row">
        <span class="wo-fact"><Icon name="list-numbers" size={14} />{count(sets, 'set', 'sets')}</span>
        <span class="wo-fact"><Icon name="stopwatch" size={14} />{t('~{n} min', { n: planMinutes(plan, last) })}</span>
        {plan.target > 0 && <span class="wo-fact"><Power value={plan.target} size={14} /></span>}
        <span class="wo-fact"><Icon name="history" size={14} />{last ? since(dayOf(last.start)) : t('Not done yet')}</span>
      </div>
      {/* Start in the page's colour, like the plan's icon; an empty workout is the quiet way out under it */}
      <div class="wo-next-acts">
        <button class="wo-next-go" onClick={() => onStart(plan)} aria-label={t('Start {name}', { name })}>
          <Icon name="player-play" size={18} stroke={2.25} />
          {t('Start workout')}
        </button>
        <button class="wo-next-empty" onClick={() => onStart(null)} title={t('Start empty workout')}>
          <Icon name="plus" size={16} />
          {t('Empty workout')}
        </button>
      </div>
    </section>
  );
}

/** This week at a glance: a dot a day (a bolt on the days you trained), the power it has come to, and the weeks in a row. */
function Week({ done, weekStart, onInfo }: { done: Done[]; weekStart: 0 | 1; onInfo: () => void }) {
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
  const run = useMemo(() => streaks(finished(done), today, weekStart).weeks, [done, today, weekStart]);
  return (
    <section class="card wo-week-card">
      <div class="wo-week-head">
        <span class="wo-label"><Icon name="calendar-week" size={14} />{t('This week')}</span>
        {run >= 2 && <span class="wo-streak" title={t('Weeks in a row with a workout')}><Icon name="flame" size={14} />{count(run, 'week in a row', 'weeks in a row')}</span>}
        <button class="icon-btn small" onClick={onInfo} aria-label={t('How power works')} title={t('How power works')}>
          <Icon name="info-circle" size={16} />
        </button>
      </div>
      <div class="wo-week-row">
        <Power value={total} size={20} class="wo-week-n" />
        <span class="muted small">{n ? count(n, 'workout', 'workouts') : t('No workout yet this week')}</span>
      </div>
      <ol class="wo-week">
        {days.map((d) => {
          const p = byDay.get(d);
          const label = p === undefined ? dayLabel(d) : `${dayLabel(d)}: ${fmtPower(p)} ⚡`;
          return (
            <li key={d} class={`wo-day${p !== undefined ? ' is-on' : ''}${d === today ? ' is-today' : ''}${d > today ? ' is-ahead' : ''}`} title={label} aria-label={label}>
              <span class="wo-dot">{p !== undefined && <Icon name="bolt" size={13} />}</span>
              <span class="wo-day-name" aria-hidden="true">{WEEKDAYS[weekday(d)]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** A plan: a tap opens it to look at or change; Start starts it. */
function PlanCard({ r, last, next, onStart }: { r: Routine; last?: Done; next: boolean; onStart: () => void }) {
  const name = planName(r);
  return (
    <article class={`wo-plan-card${next ? ' is-next' : ''}`}>
      <button class="wo-plan-main" onClick={() => navigate('workout?plan=' + r.id)} aria-label={t('Open {name}', { name })}>
        <span class="wo-tile"><Icon name={r.icon as UiName} size={20} /></span>
        <span class="wo-row-text">
          <span class="wo-row-name">{name}</span>
          <span class="wo-plan-moves">{r.items.length ? movesLine(r) : t('No exercises yet')}</span>
          <span class="wo-meta">
            {r.target > 0 && <Power value={r.target} size={12} />}
            {mainMuscles(r).map((m) => <MuscleIcon key={m} muscle={m} size={14} />)}
            {r.items.length > 0 && <span class="wo-meta-text" title={t('About how long it takes')}><Icon name="stopwatch" size={12} />{t('~{n} min', { n: planMinutes(r, last) })}</span>}
            {last && <span class="wo-meta-text" title={t('Last done')}><Icon name="history" size={12} />{since(dayOf(last.start))}</span>}
          </span>
        </span>
      </button>
      <button class="wo-go" onClick={onStart} disabled={!r.items.length} aria-label={t('Start {name}', { name })} title={t('Start {name}', { name })}>
        <Icon name="player-play" size={16} />
        <span>{t('Start')}</span>
      </button>
    </article>
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
        <div class="wo-plan-cards fade-arrive-soft">
          {plans.map((r) => (
            <article key={r.name} class="wo-plan-card">
              <button class="wo-plan-main" onClick={() => add(r)} aria-label={t('Add {name}', { name: r.name })}>
                <span class="wo-tile"><Icon name={r.icon as UiName} size={20} /></span>
                <span class="wo-row-text">
                  <span class="wo-row-name">{r.name}</span>
                  <span class="wo-plan-moves">{movesLine(r)}</span>
                  <span class="wo-meta">
                    {r.target > 0 && <Power value={r.target} size={12} />}
                    {mainMuscles(r).map((m) => <MuscleIcon key={m} muscle={m} size={14} />)}
                    <span class="wo-meta-text"><Icon name="stopwatch" size={12} />{t('~{n} min', { n: planMinutes(r) })}</span>
                  </span>
                </span>
              </button>
              <button class="wo-go is-quiet" onClick={() => add(r)} aria-label={t('Add {name}', { name: r.name })} title={t('Add {name}', { name: r.name })}>
                <Icon name="plus" size={16} />
                <span>{t('Add')}</span>
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div class="wo-plan-cards" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} class="wo-plan-card wo-ghost-row">
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

/**
 * The last few workouts: when, how long, how it went and their power against what they asked for. A tap opens one under
 * Insights; the arrow does it again.
 */
function Recent({ done, plans, onAgain }: { done: Done[]; plans: Routine[]; onAgain: (r: Source) => void }) {
  return (
    <section class="section wo-recent">
      <header class="wo-head">
        <h2 class="section-title"><Icon name="history" size={16} />{t('Recent')}</h2>
        <button class="wo-more" onClick={() => navigate('training?tab=history')}>
          <Icon name="chart-line" size={14} />
          {t('See all')}
          <Icon name="chevron-right" size={14} />
        </button>
      </header>
      <div class="card list wo-list">
        {done.map((w) => {
          const p = workoutPower(w), met = metTarget(w, p);
          const sets = w.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);
          return (
            <div key={w.id} class="wo-row">
              <button class="wo-row-main" onClick={() => navigate('training?tab=history&w=' + w.id)} aria-label={t('Open {name}', { name: w.name })}>
                <span class="wo-tile"><Icon name={w.icon as UiName} size={20} /></span>
                <span class="wo-row-text">
                  <span class="wo-row-name">{w.name}</span>
                  <span class="wo-meta">
                    <span class="wo-meta-text">{since(dayOf(w.start))}</span>
                    <span class="wo-meta-text"><Icon name="stopwatch" size={12} />{span((w.end ?? w.start) - w.start)}</span>
                    <span class="wo-meta-text"><Icon name="check" size={12} />{count(sets, 'set', 'sets')}</span>
                    {w.feel > 0 && <span class="wo-meta-text" title={FEELS[w.feel][1]}><Icon name={FEELS[w.feel][0]} size={14} /></span>}
                  </span>
                </span>
                <span class={`wo-done-p${met ? ' is-met' : ''}`} title={met ? t('Target met') : undefined}>
                  {met && <Icon name="circle-check" size={16} />}
                  <Power value={p} />
                  {w.target > 0 && <span class="wo-of">/ {fmtPower(w.target)}</span>}
                </span>
              </button>
              <button class="icon-btn small wo-again" onClick={() => onAgain(againOf(w, plans))} aria-label={t('Do {name} again', { name: w.name })} title={t('Do it again')}>
                <Icon name="repeat" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
