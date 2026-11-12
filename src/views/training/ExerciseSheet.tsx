import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { shortDate } from '../../lib/dates';
import { setPower } from '../../lib/fitness';
import { imageOf } from '../../lib/exercises';
import { trendOf, type MoveStats, type Rec } from '../../lib/trainingStats';
import { Sheet } from '../../components/Sheet';
import { CountUp } from '../../components/charts';
import { EQUIP_ICON, EQUIP_NAME, KIND_ICON, KIND_NAME, MUSCLE_NAME, Power } from '../../components/fitness';
import { MuscleIcon } from '../../components/BodyMap';
import { Icon, type UiName } from '../../components/icons';
import { Flipbook } from '../../components/power';
import { t } from '../../lib/i18n';
import { SessionBars, TrendLine } from './charts';
import { MoveThumb, usePictures } from './Exercises';
import { fmtKg, fmtKm, fmtSecs, powerText, RecordRow, setMark, setText } from './parts';

/** One exercise: how it's going, its records and the last few times you did it. */
export function ExerciseSheet({ m, onClose, onWorkout }: { m: MoveStats | null; onClose: () => void; onWorkout: (id: string) => void }) {
  // the sheet slides away showing the exercise it had
  const last = useRef(m);
  if (m) last.current = m;
  const shown = last.current;
  return (
    <Sheet open={!!m} onClose={onClose} title={shown?.move.name ?? ''} tall class="tr-ex-sheet">
      {shown && <Body key={shown.move.id} m={shown} onWorkout={onWorkout} />}
    </Sheet>
  );
}

function Body({ m, onWorkout }: { m: MoveStats; onWorkout: (id: string) => void }) {
  const pictures = usePictures();
  const { move } = m;
  const trend = trendOf(m);
  const by1rm = trend === m.oneRm;
  const when = (r: Rec) => shortDate(r.day);
  const records: { icon: UiName; label: string; value: ComponentChildren; r: Rec }[] = [];
  if (m.best1rm) records.push({ icon: 'trophy', label: t('Best estimated 1RM'), value: fmtKg(m.best1rm.value), r: m.best1rm });
  if (m.heaviest) records.push({ icon: 'barbell', label: t('Heaviest'), value: m.heaviest.set ? setText(move, m.heaviest.set) : fmtKg(m.heaviest.value), r: m.heaviest });
  if (m.mostReps) records.push({ icon: 'arrow-big-up-lines', label: t('Most reps in a set'), value: m.mostReps.set ? setText(move, m.mostReps.set) : String(m.mostReps.value), r: m.mostReps });
  if (m.longest) records.push({ icon: 'stopwatch', label: move.kind === 'cardio' ? t('Longest') : t('Longest hold'), value: fmtSecs(m.longest.value), r: m.longest });
  if (m.farthest) records.push({ icon: 'route', label: t('Farthest'), value: fmtKm(m.farthest.value), r: m.farthest });
  if (m.bestSet) records.push({ icon: 'bolt', label: t('Best set'), value: <Power value={m.bestSet.value} size={14} />, r: m.bestSet });
  if (m.bestDay) records.push({ icon: 'flame', label: t('Most ⚡ in one workout'), value: <Power value={m.bestDay.value} size={14} />, r: m.bestDay });

  // each of the last few workouts and the ⚡ the exercise got in it, newest first as kept
  const recent = m.recent.map((r) => ({ ...r, p: r.sets.reduce((a, s) => a + setPower(move, s, r.bw, r.pair), 0) }));
  // the exercise's two pictures, played (yours have none: then its kind's icon, as in the lists)
  const db = pictures.get(move.id);
  const shots = db
    ? [
      [imageOf(db, 0), t('{name}: the start of the move', { name: move.name })],
      [imageOf(db, 1), t('{name}: the end of the move', { name: move.name })],
    ].filter((x): x is [string, string] => !!x[0])
    : [];

  return (
    <div class="tr-sheet">
      {shots.length > 0 && <Flipbook class="tr-ex-flip" frames={shots.map((x) => x[0])} alt={shots.map((x) => x[1])} />}
      <div class="tr-ex-head">
        {!shots.length && <MoveThumb id={move.id} kind={move.kind} pictures={pictures} />}
        <div class="tr-tags">
          <span class="tr-tag"><Icon name={KIND_ICON[move.kind]} size={14} /> {KIND_NAME[move.kind]}</span>
          <span class="tr-tag"><Icon name={EQUIP_ICON[move.equip]} size={14} /> {EQUIP_NAME[move.equip]}</span>
          {move.muscles.map((x) => <span class="tr-tag"><MuscleIcon muscle={x} size={14} /> {MUSCLE_NAME[x]}</span>)}
        </div>
      </div>

      <div class="media-stats tr-figures">
        <span class="stat" style={{ '--i': 0 }}><b><CountUp value={m.times} /></b><small>{t('Workouts')}</small></span>
        <span class="stat" style={{ '--i': 1 }}><b><CountUp value={m.sets} /></b><small>{t('Sets')}</small></span>
        <span class="stat" style={{ '--i': 2 }}><b><Icon name="bolt" size={14} class="tr-bolt" /><CountUp value={Math.round(m.power)} /></b><small>{t('All its power')}</small></span>
      </div>

      {trend.length > 1 && (
        <section class="tr-sheet-part">
          <h3 class="section-title">{by1rm ? t('Estimated 1RM over time') : t('Best set over time')}</h3>
          <TrendLine
            points={trend.map((p) => ({ day: p.day, value: p.value }))}
            format={by1rm ? fmtKg : (v) => powerText(v)}
            label={by1rm ? t('Estimated one-rep max over time') : t('Best set’s power over time')}
            unit={by1rm ? t('estimated 1RM') : t('best set')}
          />
        </section>
      )}

      {records.length > 0 && (
        <section class="tr-sheet-part">
          <h3 class="section-title">{t('Personal bests')}</h3>
          <div class="card list">
            {records.map((x, i) => <RecordRow k={i} icon={x.icon} label={x.label} value={x.value} when={when(x.r)} onClick={() => onWorkout(x.r.id)} />)}
          </div>
        </section>
      )}

      {recent.length > 1 && (
        <section class="tr-sheet-part">
          <h3 class="section-title">{t('Recent sessions')}</h3>
          <SessionBars sessions={recent.map((r) => ({ id: r.id, day: r.day, p: r.p })).reverse()} onOpen={onWorkout} />
        </section>
      )}

      <section class="tr-sheet-part">
        <h3 class="section-title">{t('Recent sets')}</h3>
        <div class="card list">
          {recent.map((r) => (
            <button class="list-row action tr-recent" onClick={() => onWorkout(r.id)}>
              <span class="tr-recent-day">{shortDate(r.day)}</span>
              <span class="tr-chips">
                {r.sets.map((s, i) => (
                  <span class={s.tag === 'warm' ? 'tr-set warm' : 'tr-set'} title={powerText(setPower(move, s, r.bw, r.pair))}>
                    <i>{setMark(s, r.sets.slice(0, i + 1).filter((x) => !x.tag).length)}</i> {setText(move, s, r.pair)}
                  </span>
                ))}
              </span>
              <Power value={r.p} size={12} />
            </button>
          ))}
        </div>
        <p class="muted small tr-note">
          {move.kind === 'weight' ? t('Estimated 1RM uses the Epley formula on sets of 1 to 12 reps. Warm-ups never set a best.') : t('Warm-ups never set a best.')}
        </p>
      </section>
    </div>
  );
}
