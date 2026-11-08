import { useMemo } from 'preact/hooks';
import { shortDate } from '../../lib/dates';
import { fmtPower } from '../../lib/fitness';
import { streaks, wall, type Done, type MoveStats } from '../../lib/trainingStats';
import { RevealStack } from '../../components/charts';
import { Power } from '../../components/fitness';
import { Icon } from '../../components/icons';
import { count, t } from '../../lib/i18n';
import { Tile } from '../stats/parts';
import { BestOf, MoveThumb, usePictures } from './Exercises';
import { fmtKg, fmtMins, RecordRow } from './parts';

/** Your personal bests of all time: the three that matter most up top, the rest in a list, then your strongest lifts. */
export function Bests({ all, moves, weekStart, today, onWorkout, onMove }: {
  all: Done[]; moves: MoveStats[]; weekStart: 0 | 1; today: string; onWorkout: (id: string) => void; onMove: (id: string) => void;
}) {
  const w = useMemo(() => wall(all, moves, weekStart), [all, moves, weekStart]);
  const st = useMemo(() => streaks(all, today, weekStart), [all, today, weekStart]);
  const pictures = usePictures();
  const others = moves.filter((m) => !m.best1rm && m.bestSet).slice(0, 5);
  const named = (d: Done) => `${d.w.name || t('Workout')} · ${shortDate(d.day)}`;

  return (
    <RevealStack>
      <div class="tiles tr-trophies">
        <Tile k={0} icon="trophy" label={t('Most ⚡ in a workout')} value={w.mostPower ? fmtPower(w.mostPower.power) : '—'} sub={w.mostPower ? shortDate(w.mostPower.day) : ''} />
        <Tile k={1} icon="medal" label={t('Biggest week')} value={w.bestWeek ? fmtPower(w.bestWeek.power) : '—'} sub={w.bestWeek ? t('Week of {date}', { date: shortDate(w.bestWeek.key) }) : ''} />
        <Tile k={2} icon="flame" label={t('Longest streak')} value={st.bestWeeks} sub={count(st.bestWeeks, 'week in a row', 'weeks in a row')} />
      </div>

      <section class="card chart-card tr-wall">
        <header class="chart-head"><h3 class="chart-title">{t('Workout bests')}</h3></header>
        <div class="list">
          {w.mostPower && <RecordRow icon="bolt" label={t('Most ⚡ in a workout')} value={<Power value={w.mostPower.power} size={14} />} when={named(w.mostPower)} onClick={() => onWorkout(w.mostPower!.w.id)} />}
          {w.longest && <RecordRow icon="clock" label={t('Longest workout')} value={fmtMins(w.longest.mins)} when={named(w.longest)} onClick={() => onWorkout(w.longest!.w.id)} />}
          {w.mostSets && <RecordRow icon="list-details" label={t('Most sets')} value={w.mostSets.sets} when={named(w.mostSets)} onClick={() => onWorkout(w.mostSets!.w.id)} />}
          {w.busiestWeek && <RecordRow icon="calendar-week" label={t('Busiest week')} value={count(w.busiestWeek.workouts, 'workout', 'workouts')} when={t('Week of {date}', { date: shortDate(w.busiestWeek.key) })} />}
          <RecordRow icon="target" label={t('Most targets met in a row')} value={st.bestTargets} when={st.targets ? t('{n} in a row now', { n: st.targets }) : undefined} />
        </div>
      </section>

      {w.lifts.length > 0 && (
        <section class="card chart-card tr-wall">
          <header class="chart-head">
            <div>
              <h3 class="chart-title">{t('Strongest lifts')}</h3>
              <p class="chart-sub">{t('The best estimated one-rep max of the lifts you do most')}</p>
            </div>
          </header>
          <div class="list">
            {w.lifts.map((m) => (
              <button class="list-row action tr-ex" onClick={() => onMove(m.move.id)}>
                <MoveThumb id={m.move.id} kind={m.move.kind} pictures={pictures} />
                <span class="tr-row-main">
                  <span class="tr-row-name">{m.move.name}</span>
                  <span class="tr-row-meta">{shortDate(m.best1rm!.day)}{m.heaviest && <> · {t('heaviest {kg}', { kg: fmtKg(m.heaviest.value) })}</>}</span>
                </span>
                <span class="tr-row-end"><b class="tr-big">{fmtKg(m.best1rm!.value)}</b></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section class="card chart-card tr-wall">
          <header class="chart-head">
            <div>
              <h3 class="chart-title">{t('Best sets')}</h3>
              <p class="chart-sub">{t('Body moves, holds and cardio: the most ⚡ in one set')}</p>
            </div>
          </header>
          <div class="list">
            {others.map((m) => (
              <button class="list-row action tr-ex" onClick={() => onMove(m.move.id)}>
                <MoveThumb id={m.move.id} kind={m.move.kind} pictures={pictures} />
                <span class="tr-row-main">
                  <span class="tr-row-name">{m.move.name}</span>
                  <span class="tr-row-meta">{shortDate(m.bestSet!.day)}</span>
                </span>
                <span class="tr-row-end"><BestOf m={m} /><Icon name="chevron-right" size={16} /></span>
              </button>
            ))}
          </div>
        </section>
      )}
    </RevealStack>
  );
}
