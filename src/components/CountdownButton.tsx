import { navigate } from '../lib/router';
import { END, countdownOn, parts, progress, useNow } from '../lib/countdown';
import { t } from '../lib/i18n';
import { Icon } from './icons';

/** Next to the wheel while the countdown lasts: an hourglass in a ring that fills as the days go, and the days left on it. */
export function CountdownButton() {
  const now = useNow(60_000);
  if (!countdownOn(now)) return null;
  const done = now >= END;
  const days = parts(END - now).d;
  const r = 15, len = 2 * Math.PI * r;
  const label = done ? t('Countdown · over') : t('Countdown · {d} days left', { d: days });
  return (
    <button class="icon-btn cd-trigger" onClick={() => navigate('countdown')} aria-label={label} title={label}>
      <svg class="cd-mini" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r={r} class="cd-track" />
        <circle cx="17" cy="17" r={r} class="cd-fill" style={{ strokeDasharray: len, strokeDashoffset: len * (1 - progress(now)) }} />
      </svg>
      <Icon name="hourglass" size={18} stroke={1.9} />
      {!done && <span class="cd-days" aria-hidden="true">{days}</span>}
    </button>
  );
}
