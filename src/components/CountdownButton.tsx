import { navigate } from '../lib/router';
import { countdownName, parts, progress, running, useCountdowns, useNow } from '../lib/countdown';
import { t } from '../lib/i18n';
import { Icon } from './icons';

/** Next to the wheel while a countdown runs: the one ending soonest, as an hourglass in a ring that fills as the days go, and the days left on it. */
export function CountdownButton() {
  const list = useCountdowns();
  const now = useNow(60_000);
  const [c, ...more] = running(list, now);
  if (!c) return null;
  const days = parts(c.end - now).d;
  const r = 15, len = 2 * Math.PI * r;
  const label = t('{name} · {d} days left', { name: countdownName(c), d: days }) + (more.length ? ' · ' + t('{n} more', { n: more.length }) : '');
  return (
    <button class="icon-btn cd-trigger" onClick={() => navigate('countdown')} aria-label={label} title={label}>
      <svg class="cd-mini" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r={r} class="cd-track" />
        <circle cx="17" cy="17" r={r} class="cd-fill" style={{ strokeDasharray: len, strokeDashoffset: len * (1 - progress(c, now)) }} />
      </svg>
      <Icon name="hourglass" size={18} stroke={1.9} />
      <span class="cd-days" aria-hidden="true">{days}</span>
    </button>
  );
}
