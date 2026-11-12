// The charts only Workouts draws, made the way components/charts.tsx makes Stats': hairline grids, bars of 24px at most
// with 4px rounded ends, ink text, the page's colour for the data, a tooltip on every mark, and each draws itself in
// once as it arrives.
import { useState } from 'preact/hooks';
import { addDays, diffDays, monthShort, parseKey, shortDate, WEEKDAYS } from '../../lib/dates';
import { fmtPower } from '../../lib/fitness';
import { weekMet, type DayTotal, type Week } from '../../lib/trainingStats';
import { barPath, hideTip, showTip, TipRow, tipProps, useWidth } from '../../components/charts';
import { Power } from '../../components/fitness';
import { Icon, type UiName } from '../../components/icons';
import { noun, t } from '../../lib/i18n';
import { powerText } from './parts';

const stagger = (i: number, n: number) => ({ '--t': (n > 1 ? i / (n - 1) : 0).toFixed(3) });
/** A round number at or above v for the top of an axis: 1, 2 or 5 times a power of ten. */
function niceMax(v: number) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}
/** Deep for weeks whose every target was met, the page's own colour for the rest. */
export const MET = 'var(--pos-a)';
export const UNMET = 'var(--tr-pale)';

/* ---------- power per week ---------- */

export function WeekBars({ weeks }: { weeks: Week[] }) {
  const [ref, W] = useWidth();
  const H = 180, L = 36, R = 6, T = 10, B = 22;
  const n = weeks.length;
  const max = niceMax(Math.max(...weeks.map((w) => w.power), 0));
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const band = pw / Math.max(1, n);
  const bw = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => T + ph - (v / max) * ph;
  const avg = n ? weeks.reduce((a, w) => a + w.power, 0) / n : 0;
  const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];
  const label = (w: Week) => t('Week of {date}', { date: shortDate(w.key) });

  return (
    <div ref={ref} class="chart tr-chart">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={t('Power per week')}>
          <line x1={L} x2={L + pw} y1={T} y2={T} class="grid" />
          <line x1={L} x2={L + pw} y1={y(max / 2)} y2={y(max / 2)} class="grid" />
          <text x={L - 8} y={T + 4} class="tick" text-anchor="end">{fmtPower(max)}</text>
          <text x={L - 8} y={y(max / 2) + 4} class="tick" text-anchor="end">{fmtPower(max / 2)}</text>
          <text x={L - 8} y={T + ph + 4} class="tick" text-anchor="end">0</text>
          {weeks.map((w, i) => {
            const x = L + i * band + (band - bw) / 2;
            const met = weekMet(w);
            return (
              <g class="chart-mark" {...tipProps(() => (
                <>
                  <div class="tip-title">{label(w)}</div>
                  <TipRow value={powerText(w.power)} label={t('power')} color={met ? MET : UNMET} />
                  <TipRow value={w.workouts} label={noun(w.workouts, 'workout', 'workouts')} />
                  {w.targeted > 0 && <TipRow value={`${w.met}/${w.targeted}`} label={t('targets met')} />}
                </>
              ), `${label(w)}: ${powerText(w.power)}`)}>
                <rect x={L + i * band} y={T} width={band} height={ph} fill="transparent" />
                {w.power > 0
                  ? <path d={barPath(x, bw, T + ph, y(w.power))} fill={met ? MET : UNMET} class="bar up" style={stagger(i, n)} />
                  : <rect x={x} y={T + ph - 2} width={bw} height={2} rx={1} fill="var(--line-2)" />}
              </g>
            );
          })}
          <line x1={L} x2={L + pw} y1={T + ph} y2={T + ph} class="axis" />
          {avg > 0 && <line x1={L} x2={L + pw} y1={y(avg)} y2={y(avg)} class="tr-avg-line" />}
          {ticks.map((i) => (
            <text x={L + i * band + band / 2} y={H - 6} class="tick" text-anchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{shortDate(weeks[i].key)}</text>
          ))}
        </svg>
      )}
    </div>
  );
}

/* ---------- the days you trained ---------- */

/**
 * Each day a square shaded by its ⚡. A month or so is a week to a row; up to four months, a week to a column, so it
 * stays short on a phone; longer, a month to a row and a column for each day of the month.
 */
export function PowerCalendar({ days, start, end, weekStart }: { days: Map<string, DayTotal>; start: string; end: string; weekStart: 0 | 1 }) {
  const span = diffDays(start, end) + 1;
  let max = 0;
  days.forEach((d, k) => k >= start && k <= end && (max = Math.max(max, d.power)));
  const cell = (k: string, inRange: boolean) => {
    const d = days.get(k);
    const step = d && max > 0 ? Math.max(1, Math.min(5, Math.ceil((d.power / max) * 5))) : 0;
    const at = Math.min(1, Math.max(0, diffDays(start, k)) / Math.max(1, span - 1));
    return (
      <span
        class={!inRange ? 'px out' : d ? `px on tr-s${step}` : 'px'}
        style={{ '--t': at.toFixed(3) }}
        {...(inRange ? tipProps(() => (
          <>
            <div class="tip-title">{shortDate(k)}</div>
            {d ? (
              <>
                <TipRow value={powerText(d.power)} label={t('power')} color="var(--accent)" />
                <TipRow value={d.workouts} label={noun(d.workouts, 'workout', 'workouts')} />
              </>
            ) : <span>{t('Rest day')}</span>}
          </>
        ), shortDate(k)) : {})}
      />
    );
  };
  const labels = weekStart === 1 ? WEEKDAYS : [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)];
  const first = addDays(start, -((parseKey(start).getDay() - weekStart + 7) % 7));
  const weeks = Math.ceil((diffDays(first, end) + 1) / 7);

  if (span <= 42) {
    return (
      <div class="pixels weeks">
        {labels.map((l) => <span class="tick-html">{l.slice(0, 1)}</span>)}
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const k = addDays(first, i);
          return cell(k, k >= start && k <= end);
        })}
      </div>
    );
  }
  if (span <= 126) {
    // a column for each week, the weekdays down the side, a month's name over the week it starts in
    return (
      <div class="tr-cal" style={{ '--weeks': weeks }}>
        <span />
        {Array.from({ length: weeks }, (_, w) => {
          const k = addDays(first, w * 7);
          const d = parseKey(k);
          const starts = w === 0 || parseKey(addDays(k, -7)).getMonth() !== d.getMonth();
          return <span class="tick-html tr-cal-month">{starts ? monthShort(d.getFullYear(), d.getMonth()) : ''}</span>;
        })}
        {labels.map((l, r) => (
          <>
            <span class="tick-html left">{r % 2 === 0 ? l.slice(0, 2) : ''}</span>
            {Array.from({ length: weeks }, (_, w) => {
              const k = addDays(first, w * 7 + r);
              return cell(k, k >= start && k <= end);
            })}
          </>
        ))}
      </div>
    );
  }
  const s = parseKey(start), e = parseKey(end);
  const months: [number, number][] = [];
  for (let d = new Date(s.getFullYear(), s.getMonth(), 1); d <= e; d.setMonth(d.getMonth() + 1)) months.push([d.getFullYear(), d.getMonth()]);
  return (
    <div class="pixels year">
      <span />
      {Array.from({ length: 31 }, (_, i) => <span class="tick-html">{(i + 1) % 5 === 0 || i === 0 ? i + 1 : ''}</span>)}
      {months.map(([y, m]) => (
        <>
          <span class="tick-html left">{monthShort(y, m)}{m === 0 || months[0][0] !== y ? ` ’${String(y).slice(2)}` : ''}</span>
          {Array.from({ length: 31 }, (_, i) => {
            const d = new Date(y, m, i + 1);
            if (d.getMonth() !== m) return <span class="px none" />;
            const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            return cell(k, k >= start && k <= end);
          })}
        </>
      ))}
    </div>
  );
}

export const PowerLegend = () => (
  <span class="legend-item">{t('Less')} {[1, 2, 3, 4, 5].map((s) => <i class={`px tr-s${s} tr-swatch`} />)} {t('More')}</span>
);

/* ---------- a value over time: body weight, an exercise's progress ---------- */

export interface LinePoint { day: string; value: number; hollow?: boolean }

/**
 * A line through the points, placed by their dates (so a gap of weeks looks like one), with the page's colour pooled
 * under it. Hollow points are guesses (a workout's weight where there's no weigh-in). Point at it, tap it or use the
 * arrow keys to read each point.
 */
export function TrendLine({ points, format, label, unit }: { points: LinePoint[]; format: (v: number) => string; label: string; unit: string }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const H = 160, L = 40, R = 10, T = 12, B = 22;
  const n = points.length;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const first = points[0]?.day ?? '', days = n > 1 ? Math.max(1, diffDays(first, points[n - 1].day)) : 1;
  let lo = Math.min(...points.map((p) => p.value)), hi = Math.max(...points.map((p) => p.value));
  if (!(hi > lo)) [lo, hi] = [lo - 1, hi + 1];
  const pad = (hi - lo) * 0.12;
  lo -= pad;
  hi += pad;
  const x = (p: LinePoint) => L + (n === 1 ? pw / 2 : (diffDays(first, p.day) / days) * pw);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * ph;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = n > 1 ? `${line}L${x(points[n - 1]).toFixed(1)},${T + ph}L${x(points[0]).toFixed(1)},${T + ph}Z` : '';
  const dots = n <= 60;

  const tipFor = (i: number) => (
    <>
      <div class="tip-title">{shortDate(points[i].day)}</div>
      <TipRow value={format(points[i].value)} label={points[i].hollow ? t('{unit}, from a workout', { unit }) : unit} color="var(--ink)" />
    </>
  );
  const show = (i: number, el: Element) => {
    setHover(i);
    const r = el.getBoundingClientRect();
    showTip(r.left + x(points[i]) - L, r.top + y(points[i].value) - T, tipFor(i));
  };
  const nearest = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const px = clientX - r.left + L;
    let best = 0;
    points.forEach((p, i) => Math.abs(x(p) - px) < Math.abs(x(points[best]) - px) && (best = i));
    return best;
  };

  return (
    <div ref={ref} class="chart drawn tr-chart">
      {W > 0 && n > 0 && (
        <svg width={W} height={H} role="img" aria-label={label}>
          <defs>
            <linearGradient id="tr-pool" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={T} y2={T + ph}>
              <stop offset="0" stop-color="var(--accent)" stop-opacity="0.3" />
              <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
            </linearGradient>
          </defs>
          <line x1={L} x2={L + pw} y1={T} y2={T} class="grid" />
          <line x1={L} x2={L + pw} y1={T + ph} y2={T + ph} class="axis" />
          <text x={L - 8} y={T + 4} class="tick" text-anchor="end">{format(hi)}</text>
          <text x={L - 8} y={T + ph + 4} class="tick" text-anchor="end">{format(lo)}</text>
          <text x={x(points[0])} y={H - 6} class="tick" text-anchor={n === 1 ? 'middle' : 'start'}>{shortDate(points[0].day)}</text>
          {n > 1 && <text x={x(points[n - 1])} y={H - 6} class="tick" text-anchor="end">{shortDate(points[n - 1].day)}</text>}
          {area && <path d={area} class="area" fill="url(#tr-pool)" />}
          {n > 1 && <path d={line} class="series-line" pathLength={1} />}
          {dots && points.map((p, i) => (
            <circle cx={x(p)} cy={y(p.value)} r={n <= 24 ? 3.5 : 2.5} class={p.hollow ? 'dot tr-hollow' : 'dot'} style={stagger(i, n)} />
          ))}
          {hover !== null && points[hover] && (
            <g>
              <line x1={x(points[hover])} x2={x(points[hover])} y1={T} y2={T + ph} class="crosshair" />
              <circle cx={x(points[hover])} cy={y(points[hover].value)} r={4.5} class="dot ring" />
            </g>
          )}
          <rect
            x={L} y={T} width={pw} height={ph} fill="transparent" tabindex={0}
            aria-label={t('{label} — use the arrow keys to move between points', { label })}
            onPointerMove={(e) => show(nearest(e.clientX, e.currentTarget), e.currentTarget)}
            onPointerDown={(e) => show(nearest(e.clientX, e.currentTarget), e.currentTarget)}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') { setHover(null); hideTip(); } }}
            onFocus={(e) => show(hover ?? n - 1, e.currentTarget)}
            onBlur={() => { setHover(null); hideTip(); }}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              show(Math.max(0, Math.min(n - 1, (hover ?? n - 1) + (e.key === 'ArrowLeft' ? -1 : 1))), e.currentTarget);
            }}
          />
        </svg>
      )}
    </div>
  );
}

/** A small line of the last few values, for a row: how it's going, at a glance. Holds its space when there's nothing to draw. */
export function Spark({ values }: { values: number[] }) {
  const W = 56, H = 20, P = 3;
  if (values.length < 2) return <svg class="tr-spark" width={W} height={H} aria-hidden="true" />;
  let lo = Math.min(...values), hi = Math.max(...values);
  if (!(hi > lo)) [lo, hi] = [lo - 1, hi + 1];
  const x = (i: number) => P + (i / (values.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + ((hi - v) / (hi - lo)) * (H - 2 * P);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  return (
    <svg class="tr-spark" width={W} height={H} aria-hidden="true">
      <path d={d} pathLength={1} class="tr-spark-line" />
      <circle cx={x(last)} cy={y(values[last])} r={2.5} class="tr-spark-dot" />
    </svg>
  );
}

/* ---------- an exercise's last few workouts ---------- */

export interface Session { id: string; day: string; p: number }

/**
 * An exercise's last few workouts, oldest first, each a bar of the ⚡ it got from it: they grow in one after another,
 * the best in the page's full colour. A tap on one opens that workout.
 */
export function SessionBars({ sessions, onOpen }: { sessions: Session[]; onOpen: (id: string) => void }) {
  const max = Math.max(0, ...sessions.map((s) => s.p));
  // the latest of the best, when two tie
  let best = -1;
  sessions.forEach((s, i) => max > 0 && s.p === max && (best = i));
  return (
    <ol class="tr-sessions" aria-label={t('Power per workout')}>
      {sessions.map((s, i) => (
        <li key={s.id + i} class={i === best ? 'is-best' : undefined} style={{ '--k': Math.min(i, 4) }}>
          <button class="tr-session" onClick={() => onOpen(s.id)} aria-label={`${shortDate(s.day)}: ${powerText(s.p)}`} title={powerText(s.p)}>
            <span class="tr-session-n">{i === best && <Icon name="trophy" size={12} />}{fmtPower(s.p)}</span>
            <span class="tr-session-track"><i style={{ height: `${max > 0 ? Math.max(4, (s.p / max) * 100) : 0}%` }} /></span>
            <span class="tr-session-day">{shortDate(s.day)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/* ---------- a whole in parts: the power by kind of exercise, the sets by part of the body ---------- */

export interface Part { key: string; name: string; icon: UiName; n: number; color: string; text: string }

/** One bar split into its parts, and under it each part with its icon, share and amount. */
export function Split({ parts, label, empty }: { parts: Part[]; label: string; empty: string }) {
  const total = parts.reduce((a, p) => a + p.n, 0);
  const shown = parts.filter((p) => p.n > 0);
  if (!total) return <p class="empty-note">{empty}</p>;
  const share = (n: number) => `${Math.round(total ? (n / total) * 100 : 0)}%`;
  return (
    <div class="tr-split">
      <div class="split-bar" role="img" aria-label={label}>
        {shown.map((p, i) => (
          <i style={{ flexGrow: p.n, background: p.color, '--k': i }} {...tipProps(() => <TipRow value={`${p.text} · ${share(p.n)}`} label={p.name} color={p.color} />, `${p.name}: ${share(p.n)}`)} />
        ))}
      </div>
      <ul class="tr-parts">
        {parts.map((p, i) => (
          <li class={p.n > 0 ? '' : 'none'} style={{ '--k': i, '--c': p.color }}>
            <span class="tr-part-ico"><Icon name={p.icon} size={16} /></span>
            <span class="tr-part-name">{p.name}</span>
            <b>{share(p.n)}</b>
            <small>{p.text}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The ⚡ of a thing, with its bolt: what rows and records show. */
export const PowerOf = ({ value }: { value: number }) => <Power value={value} size={14} />;
