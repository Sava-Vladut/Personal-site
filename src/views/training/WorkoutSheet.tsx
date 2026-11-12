import { useRef, useState } from 'preact/hooks';
import { timeLabel } from '../../lib/dates';
import { fmtPower, itemPower, setPower, setVolume, type Routine } from '../../lib/fitness';
import { deleteWorkout, saveRoutine, saveWorkout, toast, uid } from '../../lib/store';
import { navigate } from '../../lib/router';
import { haptic } from '../../lib/haptics';
import type { Done } from '../../lib/trainingStats';
import { Sheet } from '../../components/Sheet';
import { CountUp } from '../../components/charts';
import { KIND_ICON, Power, TAG_NAME } from '../../components/fitness';
import { Icon } from '../../components/icons';
import { PowerGauge, Rolling } from '../../components/power';
import { count, t } from '../../lib/i18n';
import { Feel, fmtKg, fmtMins, setMark, setText, whenOf, WorkoutIcon } from './parts';

/** One workout, every exercise and set in it, and what can be done with it: keep it as a plan, or delete it (with Undo). */
export function WorkoutSheet({ d, records, onClose, onMove }: { d: Done | null; records: number; onClose: () => void; onMove: (id: string) => void }) {
  // the sheet slides away showing the workout it had
  const last = useRef(d);
  if (d) last.current = d;
  const shown = last.current;
  return (
    <Sheet
      open={!!d}
      onClose={onClose}
      tall
      class="tr-w-sheet"
      title={shown ? <span class="tr-sheet-title"><WorkoutIcon icon={shown.w.icon} /> {shown.w.name || t('Workout')}</span> : ''}
      label={shown?.w.name || t('Workout')}
      footer={shown && <Actions d={shown} onClose={onClose} />}
    >
      {shown && <Body key={shown.w.id} d={shown} records={records} onMove={onMove} />}
    </Sheet>
  );
}

function Body({ d, records, onMove }: { d: Done; records: number; onMove: (id: string) => void }) {
  const { w } = d;
  const volume = w.items.reduce((sum, it) => sum + it.sets.reduce((a, s) => a + (s.done ? setVolume(it.move, s, w.bw, it.pair) : 0), 0), 0);
  const of = w.target > 0 ? t('of {n}', { n: fmtPower(w.target) }) : '';
  return (
    <div class="tr-sheet">
      <p class="tr-when"><Icon name="calendar" size={14} /> {whenOf(w.start)}{w.end && <>–{timeLabel(w.end)}</>} · {fmtMins(d.mins)}</p>

      {/* its ⚡ against what it asked for: the ring fills (and laps past the target) as the sheet opens */}
      <div class={w.target > 0 ? 'tr-goal has-gauge' : 'tr-goal'}>
        {w.target > 0 && (
          <PowerGauge value={d.power} target={w.target} size="m" label={`${fmtPower(d.power)} ⚡ ${of}`}>
            <b class="tr-goal-pct"><Rolling value={Math.round((d.power / w.target) * 100)} from={0} ms={900} format={(n) => `${Math.round(n)}%`} /></b>
          </PowerGauge>
        )}
        <div class="tr-goal-text">
          <span class="power tr-goal-n"><Icon name="bolt" size={20} /><Rolling value={d.power} from={0} ms={900} class="power-n" /></span>
          {w.target > 0 && <span class="tr-goal-of">{of}</span>}
          {w.target > 0 && (
            <span class={d.met ? 'tr-target met' : 'tr-target'}>
              <Icon name={d.met ? 'check' : 'x'} size={12} /> {d.met ? t('Target met') : t('{n} short', { n: fmtPower(w.target - d.power) })}
            </span>
          )}
        </div>
      </div>

      <div class="media-stats tr-figures">
        <span class="stat" style={{ '--i': 0 }}><b><CountUp value={d.sets} /></b><small>{t('Sets')}</small></span>
        <span class="stat" style={{ '--i': 1 }}><b>{volume > 0 ? <CountUp value={Math.round(volume)} /> : '—'}</b><small>{t('kg moved')}</small></span>
        <span class="stat" style={{ '--i': 2 }}><b>{fmtKg(w.bw)}</b><small>{t('Body weight')}</small></span>
        {w.feel > 0 && <span class="stat" style={{ '--i': 3 }}><b><Feel value={w.feel} size={20} /></b><small>{t('Felt')}</small></span>}
      </div>
      {records > 0 && <p class="tr-prs"><Icon name="trophy" size={14} /> {t('New personal bests in {n}', { n: count(records, 'exercise', 'exercises') })}</p>}

      <ul class="tr-items">
        {w.items.map((it) => {
          let n = 0;
          return (
            <li class="tr-item">
              <button class="tr-item-head" onClick={() => onMove(it.move.id)}>
                <span class="tr-ico small"><Icon name={KIND_ICON[it.move.kind]} size={14} /></span>
                <span class="tr-item-name">{it.move.name}</span>
                <Power value={itemPower(it, w.bw)} size={12} />
              </button>
              <ol class="tr-sets">
                {it.sets.map((s) => {
                  if (!s.tag) n++;
                  return (
                    <li class={s.done ? '' : 'skipped'} title={s.done ? undefined : t('Not done')}>
                      <i class={s.tag ? `tr-mark ${s.tag}` : 'tr-mark'} title={TAG_NAME[s.tag]}>{setMark(s, n)}</i>
                      <span class="tr-set-text">{setText(it.move, s, it.pair)}</span>
                      <span class="tr-set-p">{s.done ? `${fmtPower(setPower(it.move, s, w.bw, it.pair))} ⚡` : <Icon name="minus" size={12} />}</span>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ul>

      {w.note.trim() && (
        <section class="tr-sheet-part">
          <h3 class="section-title"><Icon name="pencil" size={16} /> {t('Note')}</h3>
          <p class="tr-note-text">{w.note}</p>
        </section>
      )}
    </div>
  );
}

function Actions({ d, onClose }: { d: Done; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const { w } = d;
  const remove = async () => {
    haptic();
    onClose();
    const removed = await deleteWorkout(w.id);
    if (removed) toast(t('Workout deleted'), { label: t('Undo'), run: () => saveWorkout(removed) });
  };
  // a plan from it: the sets you did (all of an exercise's, when none were), to do again, asking for its power rounded up
  const plan = async () => {
    setSaving(true);
    const now = Date.now();
    const r: Routine = {
      id: uid(), name: w.name || t('Workout'), icon: w.icon, target: Math.ceil(d.power / 10) * 10, created: now, updated: now,
      items: w.items.map((it) => ({ ...it, sets: (it.sets.some((s) => s.done) ? it.sets.filter((s) => s.done) : it.sets).map((s) => ({ ...s, done: false })) })),
    };
    try {
      await saveRoutine(r);
      haptic();
      toast(t('Saved as a plan'), { label: t('Open'), run: () => navigate('workout') });
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <button class="btn btn-quiet danger" onClick={remove}><Icon name="trash" size={18} /> {t('Delete')}</button>
      <button class="btn btn-quiet" onClick={plan} disabled={saving}><Icon name="copy-plus" size={18} /> {saving ? t('Saving…') : t('Save as plan')}</button>
    </>
  );
}
