// The push-up counter's own page, in the Workout group beside Workouts: what you've done (your best set, this week, all
// time), the way to start the camera, how to set the phone up, and your last sessions. Push-ups counted here are kept as
// a short workout, a set for each run between rests, so they show in Insights too; ones counted inside a workout are part
// of that workout.
import { useMemo, useState } from 'preact/hooks';
import { addDays, dayLabel, startOfWeek, todayKey } from '../lib/dates';
import { blankSet, dayOf, type Workout as Done } from '../lib/fitness';
import { findExercise, loadExercises } from '../lib/exercises';
import { pushupReps } from '../lib/pushups';
import { onComputer } from '../lib/desktop';
import { saveWorkout, toast, uid, useReady, useSettings, useWorkouts } from '../lib/store';
import { count, t } from '../lib/i18n';
import { Icon, type UiName } from '../components/icons';
import { PageHead } from '../components/PageHead';
import { PushupCounter, unlockSound } from '../components/workout/PushupCounter';
import { itemOf, useBodyWeight, useWorkoutAccent, WORKOUT_WORLD } from '../components/workout/shared';
import '../styles/workout.css';

interface Session { w: Done; reps: number[]; total: number }

const STEPS: { icon: UiName; text: () => string }[] = [
  { icon: 'ruler-measure', text: () => t('Stand the phone on the floor 1–2 m away, beside you or at an angle. On its side, it fits all of you in.') },
  { icon: 'body-scan', text: () => t('Get into a plank with your arms straight: counting starts once it sees you holding it.') },
  { icon: 'volume', text: () => t('Go down until your elbows bend to about 90°, then push back up. It says each number out loud.') },
  { icon: 'player-pause', text: () => t('Get up or drop to your knees to rest: counting pauses, and your next plank starts a new set.') },
];

export function Pushups(_: { id: string; query: URLSearchParams }) {
  useWorkoutAccent();
  const ready = useReady();
  const workouts = useWorkouts();
  const bw = useBodyWeight();
  const { weekStart } = useSettings();
  const [counting, setCounting] = useState(false);

  const sessions = useMemo(() => {
    const out: Session[] = [];
    for (const w of workouts) {
      if (w.end === null) continue;
      const reps = pushupReps(w);
      if (reps.length) out.push({ w, reps, total: reps.reduce((a, b) => a + b, 0) });
    }
    return out.sort((a, b) => b.w.start - a.w.start);
  }, [workouts]);
  const from = startOfWeek(todayKey(), weekStart);
  const to = addDays(from, 6);
  const best = Math.max(0, ...sessions.flatMap((s) => s.reps));
  const week = sessions.filter((s) => { const d = dayOf(s.w.start); return d >= from && d <= to; }).reduce((n, s) => n + s.total, 0);
  const total = sessions.reduce((n, s) => n + s.total, 0);

  const save = async (counted: number[], start: number) => {
    const reps = counted.reduce((a, b) => a + b, 0);
    try {
      const move = findExercise(await loadExercises(), 'Pushups');
      if (!move) throw new Error('no push-ups in the exercise list');
      const now = Date.now();
      await saveWorkout({
        id: uid(), plan: null, name: t('Push-ups'), icon: 'gymnastics', target: 0, bw, start, end: now,
        items: [{ ...itemOf(move, undefined, true), sets: counted.map((n) => ({ ...blankSet(move.kind), reps: n, done: true })) }],
        feel: 0, note: '', created: now, updated: now,
      });
    } catch {
      return toast(t('Couldn’t save the push-ups. Try again.'));
    }
    setCounting(false);
    const top = Math.max(...counted);
    toast(top > best && best > 0 ? t('New best set: {count}!', { count: count(top, 'push-up', 'push-ups') }) : t('{count} saved', { count: count(reps, 'push-up', 'push-ups') }));
  };

  if (!ready) return <div class="page wo-page pp-page"><PageHead title={t('Push-up counter')} wheel world={WORKOUT_WORLD} /></div>;
  return (
    <div class="page wo-page pp-page">
      <PageHead title={t('Push-up counter')} wheel world={WORKOUT_WORLD} />

      <div class="pp-home">
        <section class="card wo-hero pp-hero">
          <span class="wo-label"><Icon name="camera" size={14} />{t('Your push-ups')}</span>
          <div class="pp-stats">
            <Stat value={best} label={t('Best set')} />
            <Stat value={week} label={t('This week')} />
            <Stat value={total} label={t('All time')} />
          </div>
          {onComputer() ? (
            <p class="muted small pp-note">
              <Icon name="devices" size={14} />
              {t('Counting needs your phone’s camera on the floor: open this page on your phone.')}
            </p>
          ) : (
            <button class="btn btn-primary wo-wide" onClick={() => (unlockSound(), setCounting(true))}>
              <Icon name="camera" size={18} />
              {t('Start counting')}
            </button>
          )}
        </section>

        <section class="section pp-how">
          <h2 class="section-title"><Icon name="info-circle" size={16} />{t('How it works')}</h2>
          <ol class="card list pp-steps">
            {STEPS.map((s, i) => (
              <li key={i} class="pp-step">
                <span class="wo-tile"><Icon name={s.icon} size={20} /></span>
                <span>{s.text()}</span>
              </li>
            ))}
          </ol>
          <p class="muted small pp-note">
            <Icon name="lock" size={14} />
            {t('The video stays on your phone: it’s never saved or sent anywhere.')}
          </p>
        </section>

        <section class="section pp-recent">
          <h2 class="section-title"><Icon name="history" size={16} />{t('Recent')}</h2>
          {sessions.length ? (
            <div class="card list wo-list">
              {sessions.slice(0, 12).map((s) => (
                <div key={s.w.id} class="wo-row">
                  <span class="wo-tile"><Icon name={(s.w.items.length > 1 ? s.w.icon : 'gymnastics') as UiName} size={20} /></span>
                  <span class="wo-row-text">
                    <span class="wo-row-name">{count(s.total, 'push-up', 'push-ups')}</span>
                    <span class="wo-meta">
                      <span class="wo-meta-text">{dayLabel(dayOf(s.w.start))}</span>
                      {s.reps.length > 1 && <span class="wo-meta-text">{s.reps.join(' · ')}</span>}
                      {s.w.items.length > 1 && <span class="wo-meta-text">{s.w.name}</span>}
                    </span>
                  </span>
                  {s.reps.includes(best) && sessions.length > 1 && <span class="pp-best" title={t('Your best set')}><Icon name="trophy" size={16} /></span>}
                </div>
              ))}
            </div>
          ) : (
            <div class="card empty pp-empty">
              <span class="wo-tile big" aria-hidden="true"><Icon name="camera" size={24} /></span>
              <p>{t('Your push-ups show here once you’ve counted some.')}</p>
            </div>
          )}
        </section>
      </div>

      {counting && !onComputer() && <PushupCounter onClose={() => setCounting(false)} onSave={save} />}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div class="pp-stat">
      <span class="pp-stat-n">{value}</span>
      <span class="pp-stat-label">{label}</span>
    </div>
  );
}
