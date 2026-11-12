import { useMemo, useState } from 'preact/hooks';
import { monthLabel } from '../../lib/dates';
import { fmtPower, MUSCLES, workoutPower, type Workout } from '../../lib/fitness';
import { muscleLoad, type Done } from '../../lib/trainingStats';
import { navigate } from '../../lib/router';
import { MuscleIcon } from '../../components/BodyMap';
import { Power } from '../../components/fitness';
import { Icon } from '../../components/icons';
import { PowerBar } from '../../components/power';
import { count, t } from '../../lib/i18n';
import { Feel, fmtMins, whenOf, WorkoutIcon } from './parts';

/** Rows shown at first, and how many more each "Show older" adds. */
const PAGE = 40;

/** The muscles a workout worked most (its main muscles' sets, the helping ones' at half), up to n. */
export function topMuscles(d: Done, n = 3) {
  const load = muscleLoad([d]);
  return MUSCLES.filter((m) => load[m].sets > 0).sort((a, b) => load[b].sets - load[a].sets).slice(0, n);
}

/** Every workout, newest first, a month to a group: what it was, when, how long, its ⚡ against its target (a bar under it). */
export function History({ all, live, records, onOpen }: { all: Done[]; live: Workout | null; records: Map<string, number>; onOpen: (id: string) => void }) {
  const [shown, setShown] = useState(PAGE);
  const months = useMemo(() => {
    const out: { key: string; list: Done[]; power: number }[] = [];
    for (const d of all.slice(0, shown)) {
      const key = d.day.slice(0, 7);
      if (out.at(-1)?.key !== key) out.push({ key, list: [], power: 0 });
      out.at(-1)!.list.push(d);
      out.at(-1)!.power += d.power;
    }
    return out;
  }, [all, shown]);
  // a month cut short by the page's end says so, rather than a smaller total
  const whole = (key: string) => shown >= all.length || all[shown]?.day.slice(0, 7) !== key;

  return (
    <div class="tr-history">
      {live && (
        <div class="card list tr-live">
          <button class="list-row action tr-row" onClick={() => navigate('workout')}>
            <WorkoutIcon icon={live.icon} />
            <span class="tr-row-main">
              <span class="tr-row-name">{live.name || t('Workout')}</span>
              <span class="tr-row-meta"><span class="tr-live-dot" aria-hidden="true" /> {t('In progress')} · {whenOf(live.start)}</span>
              {live.target > 0 && <PowerBar value={workoutPower(live)} target={live.target} />}
            </span>
            <span class="tr-row-end"><Power value={workoutPower(live)} size={14} /><Icon name="chevron-right" size={16} /></span>
          </button>
        </div>
      )}
      {months.map((mo) => {
        const [y, m] = mo.key.split('-').map(Number);
        return (
          <section class="section tr-month" key={mo.key}>
            <h2 class="section-title">
              {monthLabel(y, m - 1)}
              <span class="tr-count">{count(mo.list.length, 'workout', 'workouts')}{whole(mo.key) && <> · <Power value={mo.power} size={12} /></>}</span>
            </h2>
            <div class="card list">
              {mo.list.map((d) => <Row key={d.w.id} d={d} records={records.get(d.w.id) ?? 0} onOpen={onOpen} />)}
            </div>
          </section>
        );
      })}
      {shown < all.length && (
        <div class="tr-more">
          <button class="btn btn-quiet" onClick={() => setShown(shown + PAGE * 2)}>
            <Icon name="history" size={18} /> {t('Show older')} <span class="muted">{all.length - shown}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ d, records, onOpen }: { d: Done; records: number; onOpen: (id: string) => void }) {
  const { w } = d;
  const muscles = useMemo(() => topMuscles(d), [d]);
  const name = w.name || t('Workout');
  return (
    <button class="list-row action tr-row" onClick={() => onOpen(w.id)} aria-label={`${name}, ${whenOf(w.start)}`}>
      <WorkoutIcon icon={w.icon} />
      <span class="tr-row-main">
        <span class="tr-row-name">
          {name}
          {records > 0 && <span class="tr-pr" title={count(records, 'personal best', 'personal bests')}><Icon name="trophy" size={14} /></span>}
        </span>
        <span class="tr-row-meta">
          <span>{whenOf(w.start)} · {fmtMins(d.mins)}</span>
          {w.feel > 0 && <Feel value={w.feel} size={16} />}
          {muscles.length > 0 && <span class="tr-row-muscles" aria-hidden="true">{muscles.map((m) => <MuscleIcon muscle={m} size={20} />)}</span>}
        </span>
        {w.target > 0 && <PowerBar value={d.power} target={w.target} />}
      </span>
      <span class="tr-row-end">
        <Power value={d.power} size={14} />
        {w.target > 0 && (
          <span class={d.met ? 'tr-target met' : 'tr-target'} title={d.met ? t('Target met') : t('Target missed')}>
            <Icon name={d.met ? 'check' : 'x'} size={12} /> {fmtPower(w.target)}
          </span>
        )}
      </span>
    </button>
  );
}
