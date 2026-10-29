import { navigate } from '../lib/router';
import { biggest, biggestText, countdownName, progress, running, useCountdowns, useNow } from '../lib/countdown';
import { t } from '../lib/i18n';
import { Icon } from './icons';

/**
 * Next to the wheel while a countdown runs: the one ending soonest, as an hourglass in a ring that fills as the time goes,
 * and what's left on it: the days, or under a day the hours, then the minutes (never "0").
 */
export function CountdownButton() {
  const list = useCountdowns();
  // ticks every second only in the last hour, where the minutes move; every minute before that
  const soonest = running(list)[0];
  const now = useNow(soonest && soonest.end - Date.now() < 3_600_000 ? 1000 : 60_000);
  const [first, ...more] = running(list, now);
  if (!first) return null;
  const left = first.end - now;
  const { n, unit } = biggest(left);
  const r = 15, len = 2 * Math.PI * r;
  const label = t('{name} · {left} left', { name: countdownName(first), left: biggestText(left) }) + (more.length ? ' · ' + t('{n} more', { n: more.length }) : '');
  return (
    <button class={`icon-btn cd-trigger${left < 3_600_000 ? ' is-near' : ''}`} onClick={() => navigate('countdown')} aria-label={label} title={label}>
      <svg class="cd-mini" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r={r} class="cd-track" />
        <circle cx="17" cy="17" r={r} class="cd-fill" style={{ strokeDasharray: len, strokeDashoffset: len * (1 - progress(first, now)) }} />
      </svg>
      <Icon name="hourglass" size={18} stroke={1.9} />
      <span class="cd-days" aria-hidden="true">{unit === 'd' ? n : n + t(unit === 'h' ? 'h' : unit === 'm' ? 'm' : 's')}</span>
    </button>
  );
}
