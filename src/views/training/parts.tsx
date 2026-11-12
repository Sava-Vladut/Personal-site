// What every tab of Workouts (views/Training.tsx) writes the same way: times, weights, a set, a change since the range
// before, and a workout's icon.
import type { ComponentChildren } from 'preact';
import { dayLabel, timeLabel } from '../../lib/dates';
import { dayOf, fmtPower, type Snap, type WSet } from '../../lib/fitness';
import { FEELS, TAG_MARK } from '../../components/fitness';
import { Icon, type UiName } from '../../components/icons';
import { LOCALE, t } from '../../lib/i18n';

/** "45 min", "1 h 05 min", "2 h". */
export function fmtMins(m: number) {
  const all = Math.round(m);
  if (all < 60) return t('{n} min', { n: all });
  const h = Math.floor(all / 60), rest = all % 60;
  return rest ? t('{h} h {m} min', { h, m: String(rest).padStart(2, '0') }) : t('{h} h', { h });
}

/** "45 s", "2 min", "1 h 05 min". */
export const fmtSecs = (s: number) => (s < 90 ? t('{n} s', { n: Math.round(s) }) : fmtMins(s / 60));

const one = (n: number) => n.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
/** "82.5 kg". */
export const fmtKg = (kg: number) => t('{n} kg', { n: one(kg) });
/** "5.2 km". */
export const fmtKm = (km: number) => t('{n} km', { n: km.toLocaleString(LOCALE, { maximumFractionDigits: 2 }) });

/** "Today, 18:05", "Tue 3 Nov, 07:30". */
export const whenOf = (ms: number) => `${dayLabel(dayOf(ms))}, ${timeLabel(ms)}`;

/** What a set was, as short as it can be said: "60 kg × 8", "× 12", "+10 kg × 8", "45 s", "30 min · 5 km". */
export function setText(m: Pick<Snap, 'kind'>, s: WSet, pair = false) {
  const kg = s.kg ?? 0;
  if (m.kind === 'weight') return `${pair ? '2 × ' : ''}${fmtKg(kg)} × ${s.reps ?? 0}`;
  const extra = kg ? `${kg > 0 ? '+' : '−'}${fmtKg(Math.abs(kg))} ` : '';
  if (m.kind === 'body') return `${extra}× ${s.reps ?? 0}`;
  if (m.kind === 'time') return `${extra}${fmtSecs(s.secs ?? 0)}`.trim();
  return s.km ? `${fmtSecs(s.secs ?? 0)} · ${fmtKm(s.km)}` : fmtSecs(s.secs ?? 0);
}

/** A set's place in its exercise: its number, or W, D or F for a warm-up, a drop set or one to failure. */
export const setMark = (s: WSet, n: number) => (s.tag ? TAG_MARK[s.tag] : String(n));

/** How a workout felt, 1 to 5 (components/fitness.tsx's faces). */
export const FEEL_NAME = FEELS.map((f) => f[1]);

/** How a workout felt (1–5, or an average of them), as the face for it, with the word for screen readers and a hover. */
export function Feel({ value, size = 16 }: { value: number; size?: number }) {
  const n = Math.max(1, Math.min(5, Math.round(value)));
  return <span class="tr-feel" role="img" aria-label={FEEL_NAME[n]} title={FEEL_NAME[n]}><Icon name={FEELS[n][0]} size={size} /></span>;
}

/** The change from the range before: "↑ 3", "↓ 12%" (rel: as a share of what it was), "no change". */
export function Delta({ cur, prev, rel, unit = '' }: { cur: number | null; prev: number | null | undefined; rel?: boolean; unit?: string }) {
  if (cur === null || prev === null || prev === undefined) return null;
  if (rel && prev <= 0) return null;
  const d = rel ? ((cur - prev) / prev) * 100 : cur - prev;
  if (Math.abs(d) < 0.5) return <span class="delta">{t('no change')}</span>;
  return <span class="delta">{d > 0 ? '↑' : '↓'} {Math.round(Math.abs(d)).toLocaleString(LOCALE)}{rel ? '%' : unit}</span>;
}

/** A workout's (or a plan's) icon in a small tile of the page's colour. */
export const WorkoutIcon = ({ icon, size = 16 }: { icon: string; size?: number }) => (
  <span class="tr-ico" aria-hidden="true"><Icon name={icon as UiName} size={size} /></span>
);

/** ⚡ and a number, for tooltips and table cells where the bolt can't be drawn. */
export const powerText = (p: number) => `${fmtPower(p)} ⚡`;

/** A row of a records list: an icon, what it is, the figure and when. `k`, its place, staggers the icons popping in. */
export function RecordRow({ icon, label, value, when, onClick, k = 0 }: { icon: UiName; label: string; value: ComponentChildren; when?: string; onClick?: () => void; k?: number }) {
  const body = (
    <>
      <span class="tr-rec-ico" style={{ '--k': Math.min(k, 4) }}><Icon name={icon} size={16} /></span>
      <span class="tr-rec-text">
        <span class="tr-rec-label">{label}</span>
        {when && <span class="tr-rec-when">{when}</span>}
      </span>
      <b class="tr-rec-value">{value}</b>
    </>
  );
  return onClick ? <button class="list-row action tr-rec" onClick={onClick}>{body}</button> : <div class="list-row tr-rec">{body}</div>;
}
