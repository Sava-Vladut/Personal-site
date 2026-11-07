// Finishing a workout: what it came to (the time, the power against the target, the sets, any new records), how it went
// and a note. Saving keeps only the sets that were done; a workout from a plan can hand today's numbers back to the plan.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { fmtPower, oneRepMax, setPower, workoutPower, type Item, type Routine, type Workout } from '../../lib/fitness';
import { useRoutines, useWorkouts } from '../../lib/store';
import { count, t } from '../../lib/i18n';
import { FEELS, Power } from '../fitness';
import { Icon, type UiName } from '../icons';
import { Sheet } from '../Sheet';
import { kgText, span } from './shared';


/** The exercises with only their done sets, and without the ones left empty. */
const keptItems = (items: Item[]) => items.map((it) => ({ ...it, sets: it.sets.filter((s) => s.done) })).filter((it) => it.sets.length);

interface Record { id: string; name: string; lift: boolean; now: number; was: number }

/**
 * What beat your best: for a lift, the heaviest single it points to (estimated from weight and reps); for anything else,
 * the strongest set in power. Only against workouts you've finished before, so a first time isn't a record yet, and
 * only sets ticked off count.
 */
function recordsOf(w: Workout, all: Workout[]) {
  const best = new Map<string, Record>();
  const value = (it: Item, s: Item['sets'][number], bw: number) => (it.move.kind === 'weight' ? oneRepMax(s.kg ?? 0, s.reps ?? 0) : setPower(it.move, s, bw, it.pair));
  for (const it of w.items) for (const s of it.sets) {
    if (!s.done) continue;
    const v = value(it, s, w.bw), b = best.get(it.move.id);
    if (!b || v > b.now) best.set(it.move.id, { id: it.move.id, name: it.move.name, lift: it.move.kind === 'weight', now: v, was: 0 });
  }
  for (const p of all) {
    if (p.id === w.id || p.end === null) continue;
    for (const it of p.items) {
      const b = best.get(it.move.id);
      if (b) for (const s of it.sets) if (s.done) b.was = Math.max(b.was, value(it, s, p.bw));
    }
  }
  return [...best.values()].filter((b) => b.was > 0 && b.now > b.was * 1.001);
}

/** The plan with today's done sets in place of its own, exercise by exercise. */
function withToday(plan: Routine, items: Item[]): Routine {
  const used = new Set<number>();
  return {
    ...plan,
    items: plan.items.map((pi) => {
      const k = items.findIndex((it, j) => !used.has(j) && it.move.id === pi.move.id);
      if (k < 0) return pi;
      used.add(k);
      return { ...pi, sets: items[k].sets.map((s) => ({ ...s, done: false })) };
    }),
  };
}

export function FinishSheet({ open, w, onClose, onSave, onDiscard }: {
  open: boolean;
  w: Workout;
  onClose: () => void;
  onSave: (w: Workout, plan: Routine | null) => void;
  onDiscard: () => void;
}) {
  const all = useWorkouts();
  const plan = useRoutines().find((r) => r.id === w.plan) ?? null;
  const [feel, setFeel] = useState(0);
  const [note, setNote] = useState('');
  const [toPlan, setToPlan] = useState(false);
  // it ended when Finish was tapped, not when the note was done
  const [end, setEnd] = useState(Date.now);
  useEffect(() => {
    if (!open) return;
    setFeel(w.feel);
    setNote(w.note);
    setToPlan(false);
    setEnd(Date.now());
  }, [open]);

  const kept = useMemo(() => keptItems(w.items), [w.items]);
  const records = useMemo(() => (open ? recordsOf(w, all) : []), [open, w, all]);
  const power = workoutPower(w);
  const sets = kept.reduce((n, it) => n + it.sets.length, 0);
  const met = w.target > 0 && power >= w.target;
  const fromPlan = !!plan && kept.some((it) => plan.items.some((pi) => pi.move.id === it.move.id));

  const tiles: [UiName, string, ComponentChildren][] = [
    ['stopwatch', t('Time'), span(end - w.start)],
    ['bolt', t('Power'), <><Power value={power} size={16} />{w.target > 0 && <span class="wo-of">/ {fmtPower(w.target)}</span>}</>],
    ['check', t('Sets'), String(sets)],
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title={t('Finish workout')}
      footer={
        <div class="row gap-s wo-wide">
          <button class="btn btn-quiet danger" onClick={onDiscard} aria-label={t('Discard workout')} title={t('Discard workout')}>
            <Icon name="trash" size={18} />
          </button>
          <button class="btn btn-primary grow" disabled={!sets} onClick={() => onSave({ ...w, items: kept, end, feel, note: note.trim() }, toPlan && plan ? withToday(plan, kept) : null)}>
            <Icon name="check" size={18} />
            {t('Save workout')}
          </button>
        </div>
      }
    >
      <div class="wo-sum">
        {met ? (
          <div class="wo-met fade-arrive-soft">
            <span class="wo-tile big"><Icon name="trophy" size={24} /></span>
            <span><b>{t('Target met')}</b><span class="muted small">{t('{p} ⚡ over', { p: fmtPower(power - w.target) })}</span></span>
            <Icon name="confetti" size={24} />
          </div>
        ) : w.target > 0 && sets > 0 ? (
          <div class="wo-met is-short">
            <span class="wo-tile big"><Icon name="target" size={24} /></span>
            <span><b>{t('{p} ⚡ short of the target', { p: fmtPower(w.target - power) })}</b><span class="muted small">{t('Every set still counts.')}</span></span>
          </div>
        ) : null}

        <div class="wo-stats">
          {tiles.map(([icon, label, value]) => (
            <div key={icon} class="wo-stat">
              <span class="wo-stat-label"><Icon name={icon} size={14} />{label}</span>
              <span class="wo-stat-value">{value}</span>
            </div>
          ))}
        </div>
        {!sets && <p class="empty-note">{t('Tick off at least one set to save it, or discard it.')}</p>}

        {records.length > 0 && (
          <section class="wo-sum-part">
            <h3 class="section-title"><Icon name="medal" size={16} />{count(records.length, 'new record', 'new records')}</h3>
            <div class="card list">
              {records.map((r) => (
                <div key={r.id} class="list-row wo-record">
                  <span class="wo-record-name">{r.name}</span>
                  <span class="wo-record-v">
                    {r.lift ? <b title={t('Your heaviest single, estimated')}>{kgText(Math.round(r.now * 10) / 10)}</b> : <Power value={r.now} />}
                    <span class="muted small">{t('was {n}', { n: r.lift ? kgText(Math.round(r.was * 10) / 10) : fmtPower(r.was) })}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section class="wo-sum-part">
          <h3 class="section-title"><Icon name="mood-smile" size={16} />{t('How did it go?')}</h3>
          <div class="wo-feel" role="radiogroup" aria-label={t('How did it go?')}>
            {FEELS.slice(1).map(([icon, label], i) => (
              <button key={icon} role="radio" aria-checked={feel === i + 1} onClick={() => setFeel(feel === i + 1 ? 0 : i + 1)} aria-label={label} title={label}>
                <Icon name={icon} size={24} />
              </button>
            ))}
            <span class="wo-feel-label">{FEELS[feel][1]}</span>
          </div>
        </section>

        <label class="wo-sum-part">
          <span class="field-label row gap-s"><Icon name="pencil" size={16} />{t('Note')}</span>
          <textarea class="input" rows={3} maxLength={20_000} value={note} placeholder={t('What went well, what to change next time…')} onInput={(e) => setNote(e.currentTarget.value)} />
        </label>

        {fromPlan && plan && (
          <label class="list-row card wo-to-plan">
            <span>
              <span class="row gap-s"><Icon name="rotate-clockwise" size={18} />{t('Update the plan with today’s numbers')}</span>
              <span class="muted small">{t('{name} starts from these weights and reps next time.', { name: plan.name.trim() || w.name })}</span>
            </span>
            <button type="button" class="switch" role="switch" aria-checked={toPlan} aria-label={t('Update the plan with today’s numbers')} onClick={() => setToPlan(!toPlan)} />
          </label>
        )}
      </div>
    </Sheet>
  );
}
