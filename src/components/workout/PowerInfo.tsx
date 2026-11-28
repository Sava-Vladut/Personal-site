// How power (⚡) is counted, in a few lines, with the examples worked out at your own weight (lib/fitness.ts has the maths).
import { fmtPower, repPower } from '../../lib/fitness';
import { t } from '../../lib/i18n';
import { Icon, type UiName } from '../icons';
import { Sheet } from '../Sheet';
import { formRules } from './Form';
import { num } from './shared';

/** A push-up lifts about this much of you (the database's share for Pushups). */
const PUSHUP = 0.64;

export function PowerInfo({ open, onClose, bw }: { open: boolean; onClose: () => void; bw: number }) {
  const rows: [UiName, string][] = [
    ['barbell', t('10 kg lifted once = 1 ⚡, the same for everyone')],
    ['body-scan', t('Body moves count 15% of the weight they lift: at {kg} kg a push-up is {p} ⚡', { kg: num(bw), p: fmtPower(repPower({ kind: 'body', share: PUSHUP }, { kg: 0 }, bw)) })],
    ['stopwatch', t('Holds: 3 seconds = 1 rep')],
    ['run', t('Cardio: effort × weight × minutes')],
    ['target', t('Each workout asks for a power you set. Only the sets you tick off count toward it.')],
  ];
  return (
    <Sheet open={open} onClose={onClose} title={t('How power works')}>
      <ul class="wo-rules">
        {rows.map(([icon, text]) => (
          <li key={icon}>
            <span class="wo-tile"><Icon name={icon} size={20} /></span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <h3 class="section-title wo-rules-title"><Icon name="flame" size={16} />{t('Form: train well, earn more')}</h3>
      <p class="muted small">{t('Each set’s power goes up or down with how it was done, the way muscles grow best. A set ends up between ×0.4 and ×1.5.')}</p>
      <ul class="wo-rules">
        {formRules().map(([icon, text]) => (
          <li key={icon}>
            <span class="wo-tile"><Icon name={icon} size={20} /></span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
