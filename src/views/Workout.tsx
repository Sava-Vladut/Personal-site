// The Workout page, where you train for power (⚡; lib/fitness.ts says how it's counted). With no workout going it opens
// under a sky with this week as its hero (the power so far, a column a day, the weeks in a row), then what's up next
// (the plan you've gone longest without, a tap from starting) or a way to start, your plans (or a few to start from)
// and the last few workouts, each a tap from being done again; with one going, the workout itself
// (components/workout/Live.tsx). A plan opens in place as ?plan=<id>. The numbers over time are under Insights
// (views/Training.tsx).
// the shared pieces first: the components below (and workout-home.css, last) build on them
import '../styles/workout.css';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addDays, dayLabel, startOfWeek, todayKey, weekday, WEEKDAYS } from '../lib/dates';
import { navigate } from '../lib/router';
import { dayOf, fmtPower, metTarget, planPower, workoutPower, type Item, type Muscle, type Routine, type Workout as Done } from '../lib/fitness';
import { finished, streaks } from '../lib/trainingStats';
import { saveRoutine, toast, uid, useReady, useRoutines, useSettings, useWeighIns, useWorkouts } from '../lib/store';
import { usePref } from '../lib/prefs';
import { useSync } from '../lib/sync';
import { count, t } from '../lib/i18n';
import { MuscleIcon } from '../components/BodyMap';
import { FEELS, Power } from '../components/fitness';
import { Icon, type UiName } from '../components/icons';
import { PageHead } from '../components/PageHead';
import { PowerBar, PowerGauge, Rolling } from '../components/power';
import { Sky } from '../components/Sky';
import { Live } from '../components/workout/Live';
import { PlanEditor } from '../components/workout/PlanEditor';
import { PowerInfo } from '../components/workout/PowerInfo';
import { starterPlans } from '../components/workout/Starters';
import { WeighInSheet } from '../components/workout/WeighIn';
import { againOf, kgText, MovesProvider, planMinutes, planName, span, startWorkout, Thumb, useBodyWeight, useMoves, useWorkoutAccent, WORKOUT_WORLD, type Source } from '../components/workout/shared';
import '../styles/workout-home.css';

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
  if (!ready) {
    const head = <PageHead title={t('Workout')} wheel world={WORLD} />;
    return <div class="page wo-page">{plan ? head : <div class="journal-top stats-top wo-home-top"><Sky world={WORLD} />{head}</div>}</div>;
  }
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
  const weightNudge = !weighins.length && !nudged;
  const syncNudge = !sync.on && !syncNudged && (plans.length > 0 || workouts.length > 0 || weighins.length > 0);
  const nudges = (weightNudge || syncNudge) && (
    <>
      {weightNudge && (
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
      {syncNudge && (
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
    </>
  );
  const side = done.length > 0;

  return (
    <div class="page wo-page">
      <div class="journal-top stats-top wo-home-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
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
        <Week done={done} weekStart={weekStart} onInfo={() => setSheet('power')} />
      </div>

      {/* on a phone one column: the nudges, up next, the plans, the recent ones; on a wide screen the recent ones (and
          the nudges over them) sit in a panel at the right, and with none yet the page is one column */}
      <div class={`wo-home${side ? '' : ' is-solo'}`}>
        <div class="wo-home-main">
          {!side && nudges}
          <UpNext plan={next} last={next ? lastOf.get(next.id) : undefined} bw={bw} onStart={start} />
          <section class="section wo-plans">
            <header class="wo-head">
              <h2 class="section-title">
                <Icon name="list-details" size={16} />
                {t('Your plans')}
                {plans.length > 0 && <span class="wo-count">{plans.length}</span>}
              </h2>
              {plans.length > 0 && (
                <button class="btn btn-quiet btn-s wo-new" onClick={newPlan} aria-label={t('New workout plan')} title={t('New workout plan')}>
                  <Icon name="plus" size={16} stroke={2.5} />
                  {t('New')}
                </button>
              )}
            </header>
            {plans.length ? (
              <div class="wo-plan-cards">
                {plans.map((r, i) => (
                  <PlanCard key={r.id} r={r} i={i} bw={bw} last={lastOf.get(r.id)} next={r.id === next?.id} onStart={() => start(r)} />
                ))}
              </div>
            ) : (
              <Starters bw={bw} onNew={newPlan} />
            )}
          </section>
        </div>
        {side && (
          <div class="wo-home-side">
            {nudges}
            <Recent done={done.slice(0, 4)} plans={plans} onAgain={start} />
          </div>
        )}
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

/** What a plan's power reads as aloud: last time (if it's been done), then what it aims for. */
function powerLabel(last: number | null, target: number, planned: number) {
  const then = last === null ? t('Not done yet') : t('Last time: {p} ⚡', { p: fmtPower(last) });
  const aim = target > 0 ? t('Target: {p} ⚡', { p: fmtPower(target) }) : `${t('What every set adds up to')}: ${fmtPower(planned)} ⚡`;
  return `${then}. ${aim}`;
}

/* ---------- this week ---------- */

/**
 * This week, the hero under the sky: the power it has come to (counting up as the page opens), how many workouts, the
 * weeks in a row, and a column a day as tall as that day's power, growing in one after another (a bolt on the days you
 * trained, today ringed, the days to come hollow).
 */
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
  const top = Math.max(0, ...byDay.values());
  const run = useMemo(() => streaks(finished(done), today, weekStart).weeks, [done, today, weekStart]);
  return (
    <section class="wo-wk" aria-label={t('This week')}>
      <div class="wo-wk-top">
        <span class="wo-label"><Icon name="calendar-week" size={14} />{t('This week')}</span>
        <button class="icon-btn small wo-wk-info" onClick={onInfo} aria-label={t('How power works')} title={t('How power works')}>
          <Icon name="info-circle" size={16} />
        </button>
      </div>
      <span class="wo-wk-n"><Icon name="bolt" size={24} /><Rolling value={total} from={0} ms={900} /></span>
      <div class="wo-wk-line">
        <span>{n ? count(n, 'workout', 'workouts') : t('No workout yet this week')}</span>
        {run >= 2 && (
          <span class="wo-wk-streak" title={t('Weeks in a row with a workout')}>
            <span class="pw-flicker"><Icon name="flame" size={14} /></span>
            {count(run, 'week in a row', 'weeks in a row')}
          </span>
        )}
      </div>
      <ol class="wo-wk-days">
        {days.map((d, i) => {
          const p = byDay.get(d);
          const label = p === undefined ? dayLabel(d) : `${dayLabel(d)}: ${fmtPower(p)} ⚡`;
          // as tall as the day's power against the week's biggest day; a trained day always shows enough for its bolt
          const h = p === undefined ? 0 : top > 0 ? Math.max(0.3, p / top) : 0.3;
          return (
            <li
              key={d}
              class={`wo-wk-day${p !== undefined ? ' is-on' : ''}${d === today ? ' is-today' : ''}${d > today ? ' is-ahead' : ''}`}
              style={{ '--i': Math.min(i, 4) }}
              title={label}
              aria-label={label}
            >
              <span class="wo-wk-col">
                {p !== undefined && <i class="wo-wk-fill" style={{ '--h': h }}><Icon name="bolt" size={12} /></i>}
              </span>
              <span class="wo-wk-name" aria-hidden="true">{WEEKDAYS[weekday(d)]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------- up next ---------- */

/** What the card shows with no plan to start: the kinds of things a workout can hold. */
const BLANK_ICONS: UiName[] = ['barbell', 'run', 'gymnastics', 'stopwatch'];

/** A plan's exercises as a 2×2 of their pictures (a "+N" in the last corner when there are more). */
function Mosaic({ items }: { items: Item[] }) {
  const more = items.length > 4 ? items.length - 3 : 0;
  const shown = items.slice(0, more ? 3 : 4);
  return (
    <span class="wo-up-mosaic" data-n={shown.length + (more ? 1 : 0)} aria-hidden="true">
      {shown.map((it, i) => <Thumb key={it.move.id + i} move={it.move} />)}
      {more > 0 && <span class="wo-up-more">+{more}</span>}
    </span>
  );
}

/**
 * What to do now, at the top: the plan that's up next (its exercises' pictures, what it holds and how long it takes),
 * a ring of how far last time got against what it asks for, and Start, the one big button on the page (or an empty
 * workout instead). With no plans, an invitation to just start.
 */
function UpNext({ plan, last, bw, onStart }: { plan: Routine | null; last?: Done; bw: number; onStart: (r: Source | null) => void }) {
  if (!plan) {
    return (
      <section class="card wo-up is-blank">
        <span class="wo-label"><Icon name="player-play" size={14} />{t('Ready when you are')}</span>
        <span class="wo-up-mosaic is-icons" aria-hidden="true">
          {BLANK_ICONS.map((name, i) => <span key={name} class="wo-up-tile" style={{ '--i': i }}><Icon name={name} size={22} /></span>)}
        </span>
        <span class="wo-up-text">
          <h2 class="wo-next-name">{t('Start a workout')}</h2>
          <span class="wo-next-moves">{t('Add exercises as you go and tick off each set. Make a plan below to start it in a tap next time.')}</span>
        </span>
        <div class="wo-next-acts">
          <button class="wo-next-go pw-sheen" onClick={() => onStart(null)}>
            <Icon name="player-play" size={18} stroke={2.25} />
            {t('Start empty workout')}
          </button>
        </div>
      </section>
    );
  }
  const name = planName(plan);
  const sets = plan.items.reduce((n, it) => n + it.sets.length, 0);
  const lastP = last ? workoutPower(last) : 0;
  const planned = planPower(plan, bw);
  return (
    <section class="card wo-up">
      <span class="wo-label"><Icon name="sparkles" size={14} />{t('Up next')}</span>
      <Mosaic items={plan.items} />
      <span class="wo-up-text">
        <h2 class="wo-next-name">{name}</h2>
        <span class="wo-next-moves">{movesLine(plan, 5)}</span>
      </span>
      <PowerGauge size="m" class="wo-up-gauge" value={lastP} target={plan.target} scale={planned} label={powerLabel(last ? lastP : null, plan.target, planned)}>
        <b class="wo-up-mid"><Icon name="bolt" size={14} />{fmtPower(plan.target || planned)}</b>
        <small class="wo-up-mid-label">{plan.target > 0 ? t('target') : t('planned')}</small>
      </PowerGauge>
      <div class="wo-up-facts">
        <span class="wo-fact"><Icon name="list-numbers" size={14} />{count(sets, 'set', 'sets')}</span>
        <span class="wo-fact"><Icon name="stopwatch" size={14} />{t('~{n} min', { n: planMinutes(plan, last) })}</span>
        <span class="wo-fact" title={t('Last done')}>
          <Icon name="history" size={14} />
          {last ? since(dayOf(last.start)) : t('Not done yet')}
          {last && <Power value={lastP} size={12} />}
        </span>
      </div>
      {/* Start in the page's colour, with a light sweeping across it; an empty workout is the quiet way out under it */}
      <div class="wo-next-acts">
        <button class="wo-next-go pw-sheen" onClick={() => onStart(plan)} aria-label={t('Start {name}', { name })}>
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

/* ---------- plans ---------- */

/** A plan's first three exercises as a little stack of pictures, its icon on the corner (just the icon while it has none). */
function Stack({ r }: { r: Pick<Routine, 'items' | 'icon'> }) {
  if (!r.items.length) return <span class="wo-tile wo-plan-tile"><Icon name={r.icon as UiName} size={20} /></span>;
  return (
    <span class="wo-plan-stack" aria-hidden="true">
      {r.items.slice(0, 3).map((it, i) => <Thumb key={it.move.id + i} move={it.move} />)}
      <span class="wo-plan-icon"><Icon name={r.icon as UiName} size={12} /></span>
    </span>
  );
}

/**
 * A plan as a card: its pictures, name, exercises and when it was last done (a tap opens it to look at or change), a bar
 * of last time's power against its target (a notch where every set lands), and Start. Used for the starters too, with
 * Add instead.
 */
function PlanCard({ r, i, bw, last, next, onStart }: { r: Routine; i: number; bw: number; last?: Done; next: boolean; onStart: () => void }) {
  const name = planName(r);
  const planned = planPower(r, bw);
  const lastP = last ? workoutPower(last) : 0;
  const met = !!last && r.target > 0 && lastP >= r.target;
  return (
    <article class={`wo-plan-card${next ? ' is-next' : ''}`} style={{ '--i': Math.min(i, 4) }}>
      <button class="wo-plan-main" onClick={() => navigate('workout?plan=' + r.id)} aria-label={t('Open {name}', { name })}>
        <Stack r={r} />
        <span class="wo-row-text">
          <span class="wo-plan-title">
            <span class="wo-row-name">{name}</span>
            {next && <span class="wo-plan-badge">{t('Up next')}</span>}
          </span>
          <span class="wo-plan-moves">{r.items.length ? movesLine(r) : t('No exercises yet')}</span>
          <span class="wo-meta">
            {mainMuscles(r).map((m) => <MuscleIcon key={m} muscle={m} size={14} />)}
            {r.items.length > 0 && <span class="wo-meta-text" title={t('About how long it takes')}><Icon name="stopwatch" size={12} />{t('~{n} min', { n: planMinutes(r, last) })}</span>}
            {last && <span class="wo-meta-text" title={t('Last done')}><Icon name="history" size={12} />{since(dayOf(last.start))}</span>}
          </span>
        </span>
      </button>
      <div class="wo-plan-foot">
        <PowerBar value={lastP} target={r.target} ghost={planned} label={powerLabel(last ? lastP : null, r.target, planned)} />
        {(last || r.target > 0 || planned > 0) && (
          <span class={`wo-plan-p${met ? ' is-met' : ''}`}>
            {met && <Icon name="circle-check" size={14} />}
            {last ? <Power value={lastP} size={12} /> : <Power value={r.target || planned} size={12} class="is-quiet" />}
            {last && r.target > 0 && <span class="wo-of">/ {fmtPower(r.target)}</span>}
          </span>
        )}
        <button class="wo-go" onClick={onStart} disabled={!r.items.length} aria-label={t('Start {name}', { name })} title={t('Start {name}', { name })}>
          <Icon name="player-play" size={16} />
          <span>{t('Start')}</span>
        </button>
      </div>
    </article>
  );
}

/**
 * With no plans yet: a few ready-made ones, each added in a tap, as cards like your plans' (their bars side by side
 * show which asks the most), and the way to make your own.
 */
function Starters({ bw, onNew }: { bw: number; onNew: () => void }) {
  const { byId, ready } = useMoves();
  const plans = useMemo(() => (ready ? starterPlans(byId, bw) : []), [byId, ready, bw]);
  const top = Math.max(0, ...plans.map((r) => planPower(r, bw)));
  const add = async (r: Routine) => {
    await saveRoutine(r);
    toast(t('{name} is in your workouts', { name: r.name }));
  };
  return (
    <div class="wo-starters">
      <p class="muted">{t('Start from one of these, or make your own.')}</p>
      {ready ? (
        <div class="wo-plan-cards">
          {plans.map((r, i) => {
            const planned = planPower(r, bw);
            return (
              <article key={r.name} class="wo-plan-card" style={{ '--i': Math.min(i, 4) }}>
                <button class="wo-plan-main" onClick={() => add(r)} aria-label={t('Add {name}', { name: r.name })}>
                  <Stack r={r} />
                  <span class="wo-row-text">
                    <span class="wo-plan-title"><span class="wo-row-name">{r.name}</span></span>
                    <span class="wo-plan-moves">{movesLine(r)}</span>
                    <span class="wo-meta">
                      {mainMuscles(r).map((m) => <MuscleIcon key={m} muscle={m} size={14} />)}
                      <span class="wo-meta-text"><Icon name="stopwatch" size={12} />{t('~{n} min', { n: planMinutes(r) })}</span>
                    </span>
                  </span>
                </button>
                <div class="wo-plan-foot">
                  <PowerBar value={planned} target={0} ghost={top} label={`${t('What every set adds up to')}: ${fmtPower(planned)} ⚡`} />
                  <span class="wo-plan-p"><Power value={planned} size={12} /></span>
                  <button class="wo-go is-quiet" onClick={() => add(r)} aria-label={t('Add {name}', { name: r.name })} title={t('Add {name}', { name: r.name })}>
                    <Icon name="plus" size={16} />
                    <span>{t('Add')}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div class="wo-plan-cards" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} class="wo-plan-card wo-ghost-row">
              <span class="ghost wo-ghost-thumb" />
              <span class="wo-ghost-lines"><span class="ghost" /><span class="ghost" /><span class="ghost" /></span>
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

/* ---------- the last few ---------- */

/**
 * The last few workouts: when, how long, how it went and their power against what they asked for (a bar, ticked when
 * met). A tap opens one under Insights; the arrow does it again.
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
                  {w.target > 0 && <PowerBar class="wo-home-bar" value={p} target={w.target} />}
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
