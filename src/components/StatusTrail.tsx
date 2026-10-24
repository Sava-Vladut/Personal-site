import { EMOTION, shortName } from '../data/emotions';
import { addDays, formatDate, keyOf, timeLabel, todayKey } from '../lib/dates';
import type { PublicTrail, TrailDot } from '../lib/status';
import { INTENSITY } from './emotion';
import { Icon } from './icons';
import { t } from '../lib/i18n';

const feelingOf = (id: string) => {
  const em = EMOTION[id];
  return em.depth === 0 ? shortName(id) : em.name;
};
/** The dot's colour is the feeling's world, its size how strong it was. */
const dotStyle = (d: TrailDot) => ({ '--dot': `var(--emo-${EMOTION[d.emotion].core})`, '--s': 0.55 + d.intensity * 0.09 });
const weekday = (ms: number) => formatDate(ms, { weekday: 'short' });

type Slot = { key: string; dot: TrailDot | null; label: string; sub?: string; spoken: string; now?: boolean };

/** The last 7 days, oldest first: each day's strongest check-in (the latest of equals), or an empty ring. */
function byDay(recent: TrailDot[]): Slot[] {
  const today = todayKey();
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(today, i - 6);
    const day = recent.filter((d) => keyOf(new Date(d.time)) === key);
    const dot = day.reduce<TrailDot | null>((best, d) => (!best || d.intensity > best.intensity ? d : best), null);
    const label = key === today ? t('Today') : weekday(new Date(`${key}T12:00`).getTime());
    const spoken = day.length ? `${label}: ${day.map((d) => feelingOf(d.emotion)).join(', ')}` : `${label}: ${t('No check-in')}`;
    return { key, dot, label, spoken, now: key === today };
  });
}

/** The last 5 check-ins, oldest first, each with its feeling and when. */
function byCheckin(recent: TrailDot[]): Slot[] {
  const today = todayKey();
  return recent.slice(0, 5).reverse().map((d, i, all) => {
    const when = keyOf(new Date(d.time)) === today ? timeLabel(d.time) : weekday(d.time);
    const name = feelingOf(d.emotion);
    return { key: String(d.time), dot: d, label: name, sub: when, spoken: `${name}, ${INTENSITY[d.intensity - 1]}, ${when}`, now: i === all.length - 1 };
  });
}

/**
 * The public status's recent trail (lib/status.ts): coloured dots for the last 7 days or the last 5 check-ins, feelings
 * only. On the public page (views/Status.tsx), and small in the preview where it's switched on (StatusPanel.tsx).
 */
export function StatusTrail({ trail, compact }: { trail: PublicTrail; compact?: boolean }) {
  const recent = trail.recent.filter((d) => EMOTION[d.emotion]);
  const slots = trail.by === 'checkins' ? byCheckin(recent) : byDay(recent);
  if (!slots.some((s) => s.dot)) return null;
  const title = trail.by === 'checkins' ? t('Last 5 check-ins') : t('Last 7 days');
  const list = (
    <ol class={`status-recent is-${trail.by}`} aria-label={title}>
      {slots.map((s) => (
        <li key={s.key} class={`status-recent-slot${s.now ? ' is-now' : ''}`} aria-label={s.spoken} title={compact ? s.spoken : undefined}>
          <i class={`status-recent-dot${s.dot ? '' : ' is-empty'}`} style={s.dot ? dotStyle(s.dot) : undefined} aria-hidden="true" />
          {!compact && <span class="status-recent-label" aria-hidden="true">{s.label}</span>}
          {!compact && s.sub && <span class="status-recent-sub" aria-hidden="true">{s.sub}</span>}
        </li>
      ))}
    </ol>
  );
  if (compact) return list;
  return (
    <section class="status-card status-recent-card">
      <h2 class="status-card-title"><Icon name="chart-dots" size={14} /> {title}</h2>
      {list}
    </section>
  );
}
