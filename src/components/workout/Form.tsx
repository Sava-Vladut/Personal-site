// Form, as the page shows it: what each reason a set earned more or less power is called, the chips that pop up as a set
// is ticked off, the summary of a workout's form and the rules (lib/fitness.ts, "form", has the maths).
import { useEffect, useState } from 'preact/hooks';
import { fmtPower, formSummary, type FormHit, type FormWhy, type SetForm, type Workout } from '../../lib/fitness';
import { count, t } from '../../lib/i18n';
import { Icon, type UiName } from '../icons';
import '../../styles/form.css';

const ICON: Record<FormWhy, UiName> = {
  rest: 'alarm', quick: 'stopwatch', long: 'hourglass', cold: 'clock', range: 'target', heavy: 'weight', light: 'dumbbell',
  beat: 'trending-up', row: 'repeat', cap: 'barbell', fresh: 'sparkles', sore: 'bed',
};

/** What a reason is called. */
export function formName(h: Pick<FormHit, 'why' | 'n'>) {
  switch (h.why) {
    case 'rest': return t('Short rest');
    case 'quick': return t('Very short rest');
    case 'long': return t('Long rest');
    case 'cold': return t('Cooled off');
    case 'range': return t('Growth range');
    case 'heavy': return t('Very heavy');
    case 'light': return t('Too light');
    case 'beat': return t('Beat last time');
    case 'row': return h.n ? t('{n} sets in a row on one muscle', { n: h.n }) : t('Same muscle in a row');
    case 'cap': return t('Muscle done for today');
    case 'fresh': return t('Fresh muscle');
    case 'sore': return t('Still recovering');
  }
}

/** A multiplier as a change: ×1.15 is "+15%", ×0.85 "−15%". */
export const pct = (f: number) => {
  const p = Math.round((f - 1) * 100);
  return p >= 0 ? `+${p}%` : `−${-p}%`;
};

/** One reason as a chip: its icon, what it's called and what it did. */
export function FormChip({ hit }: { hit: FormHit }) {
  return (
    <span class={`wo-form-chip ${hit.f >= 1 ? 'is-up' : 'is-down'}`}>
      <Icon name={ICON[hit.why]} size={13} />
      {formName(hit)}
      <b>{pct(hit.f)}</b>
    </span>
  );
}

/**
 * The set just ticked off's form, popping up over the bottom of the screen for a few seconds: its reasons, best first,
 * and (with more than one) what they come to.
 */
export function FormPop({ form }: { form: SetForm | null }) {
  const [shown, setShown] = useState<SetForm | null>(null);
  useEffect(() => {
    if (!form || !form.hits.length || Date.now() - form.at > 5000) return;
    setShown(form);
    const timer = setTimeout(() => setShown(null), 3200);
    return () => clearTimeout(timer);
  }, [form?.at, form?.i, form?.k]);
  if (!shown) return null;
  const hits = [...shown.hits].sort((a, b) => b.f - a.f);
  return (
    <div key={`${shown.at}-${shown.i}-${shown.k}`} class={`wo-form-pop glass ${shown.f >= 1 ? 'is-up' : 'is-down'}`} role="status">
      {hits.length > 1 && <b class="wo-form-pop-total"><Icon name="flame" size={14} />{pct(shown.f)}</b>}
      {hits.map((h) => <FormChip key={h.why} hit={h} />)}
    </div>
  );
}

/** A workout's form so far, as a chip: what it has done to the power of its sets (nothing until it has). */
export function FormBadge({ raw, power }: { raw: number; power: number }) {
  if (!(raw > 0) || Math.abs(power - raw) < 0.05) return null;
  const f = power / raw;
  const text = t('Form: {p} on your sets’ power', { p: pct(f) });
  return (
    <span class={`wo-form-badge ${f >= 1 ? 'is-up' : 'is-down'}`} title={text} aria-label={text}>
      <Icon name="flame" size={12} />
      {pct(f)}
    </span>
  );
}

/** What form did over a workout: the power it added and took off, and each reason's part, biggest first. */
export function FormSummary({ w }: { w: Pick<Workout, 'items' | 'bw' | 'since'> }) {
  // only workouts done since form counted: their sets are timed
  if (!w.items.some((it) => it.sets.some((s) => s.done && s.at))) return null;
  const sum = formSummary(w);
  if (!sum.reasons.length) return null;
  return (
    <section class="wo-sum-part">
      <h3 class="section-title"><Icon name="flame" size={16} />{t('Form')}</h3>
      <div class="wo-form-sum">
        <span class="wo-form-sum-n is-up"><b>+{fmtPower(sum.gained)} ⚡</b><span class="muted small">{t('earned')}</span></span>
        <span class="wo-form-sum-n is-down"><b>−{fmtPower(sum.lost)} ⚡</b><span class="muted small">{t('lost')}</span></span>
      </div>
      <div class="card list">
        {sum.reasons.map((r) => (
          <div key={r.why} class="list-row wo-form-row">
            <span class={`wo-tile ${r.p >= 0 ? 'is-up' : 'is-down'}`}><Icon name={ICON[r.why]} size={18} /></span>
            <span class="grow">
              {formName({ why: r.why })}
              <span class="muted small">{count(r.sets, 'set', 'sets')}</span>
            </span>
            <b class={r.p >= 0 ? 'wo-form-up' : 'wo-form-down'}>{r.p >= 0 ? '+' : '−'}{fmtPower(Math.abs(r.p))} ⚡</b>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The rules of form, for the sheet on how power works. */
export function formRules(): [UiName, string][] {
  return [
    ['alarm', t('Short rest: the next set within 2½ minutes earns 15% (a minute more when you change exercise or before heavy squats and deadlifts). Past 4 minutes it starts to cost.')],
    ['target', t('6 to 15 reps is the growth range: 10% more. 1 to 3 reps or more than 30 count less.')],
    ['trending-up', t('Beat last time’s set (more weight, reps or seconds): 15% more.')],
    ['repeat', t('Variety: past 4 sets in a row on one muscle, each loses 15% more. Switch muscle and it starts over. Past 10 sets of one muscle in a workout, the rest count half.')],
    ['sparkles', t('A muscle you haven’t trained in a week earns 10%; one trained in the last 48 hours loses 15%.')],
  ];
}
