// Your body weight today: what body moves count from. One weigh-in a day (weighing again replaces it); past workouts keep
// the weight they were done at.
import { useEffect, useState } from 'preact/hooks';
import { MAX_BW, MIN_BW, weightOn } from '../../lib/fitness';
import { saveWeighIn, toast, uid, useWeighIns } from '../../lib/store';
import { dayLabel, todayKey } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { t } from '../../lib/i18n';
import { Icon } from '../icons';
import { Sheet } from '../Sheet';
import { NumInput, kgText, num } from './shared';

const STEPS = [-1, -0.1, 0.1, 1];
const fit = (kg: number) => Math.min(MAX_BW, Math.max(MIN_BW, Math.round(kg * 10) / 10));

export function WeighInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const list = useWeighIns();
  const [kg, setKg] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setKg(weightOn(list, todayKey()));
  }, [open]);

  const ok = kg !== null && kg >= MIN_BW && kg <= MAX_BW;
  const save = async () => {
    if (!ok) return;
    const today = todayKey(), was = list.find((w) => w.day === today), now = Date.now();
    setBusy(true);
    try {
      await saveWeighIn({ id: was?.id ?? uid(), day: today, kg: fit(kg), created: was?.created ?? now, updated: now });
      haptic(10);
      toast(t('Weight saved: {kg}', { kg: kgText(fit(kg)) }));
      onClose();
    } catch {
      toast(t('Couldn’t save your weight. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Your weight')}
      footer={
        <button class="btn btn-primary wo-wide" onClick={save} disabled={!ok || busy}>
          <Icon name="check" size={18} />
          {busy ? t('Saving…') : t('Save for today')}
        </button>
      }
    >
      <div class="wo-weigh">
        <div class="wo-weigh-dial">
          {STEPS.slice(0, 2).map((d) => (
            <button key={d} class="wo-step" onClick={() => setKg(fit((kg ?? 0) + d))} aria-label={t('{n} kg less', { n: -d })} title={t('{n} kg less', { n: -d })}>
              −{num(-d)}
            </button>
          ))}
          <label class="wo-weigh-n">
            <Icon name="scale" size={20} />
            <NumInput class="wo-weigh-input" value={kg} onValue={setKg} label={t('Your weight in kilograms')} decimal max={MAX_BW} />
            <span class="wo-weigh-unit">{t('kg')}</span>
          </label>
          {STEPS.slice(2).map((d) => (
            <button key={d} class="wo-step" onClick={() => setKg(fit((kg ?? 0) + d))} aria-label={t('{n} kg more', { n: d })} title={t('{n} kg more', { n: d })}>
              +{num(d)}
            </button>
          ))}
        </div>
        <p class="muted small wo-sheet-note">
          <Icon name="body-scan" size={14} />
          {t('Body moves count from this weight. Past workouts keep the weight they were done at.')}
        </p>
        {list.length > 0 && (
          <section class="wo-sum-part">
            <h3 class="wo-label"><Icon name="history" size={14} />{t('Last weigh-ins')}</h3>
            <div class="card list">
              {list.slice(0, 5).map((w) => (
                <div key={w.id} class="list-row wo-weigh-row">
                  <span>{dayLabel(w.day)}</span>
                  <b>{kgText(w.kg)}</b>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Sheet>
  );
}
