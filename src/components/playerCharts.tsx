// The charts the games' player stats share (views/Glops.tsx, views/CardWars.tsx): who was online over a day or a week,
// the busy hours and a spread of lengths. They wear the page's --accent and glops.css' look (the page has .gl-page).
import { useMemo, useState } from 'preact/hooks';
import { busyBlocks } from '../lib/glops';
import { ChartCard, LegendItem, RhythmHeatmap, TipRow, tipProps, useWidth, type Table } from './charts';
import { LOCALE, t } from '../lib/i18n';

const HOUR = 3_600_000;

/** The top of a value axis: at least 4 and even, so its middle line is a whole number. */
export const evenTop = (max: number) => Math.max(4, Math.ceil(max / 2) * 2);
const timeOf = (ms: number) => new Date(ms).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
const dayOf = (ms: number) => new Date(ms).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric' });

/* ---------- players online over time ---------- */

/** [start ms, most online, most in a match] for every few minutes of the last week, as the games' relays count them. */
export type Series = [number, number, number][];

const RANGES: [id: string, label: string, ms: number, step: number][] = [
  ['day', t('24 hours'), 24 * HOUR, HOUR],
  ['week', t('7 days'), 7 * 24 * HOUR, 3 * HOUR],
];
type Point = { t: number; online: number | null; playing: number | null };

/** The relay's 5-minute samples folded into hours (or 3-hour blocks for the week), the busiest moment of each. */
function fold(now: string, series: Series, span: number, step: number): Point[] {
  const end = Date.parse(now), from = Math.floor((end - span) / step) * step + step;
  const pts: Point[] = [];
  for (let at = from; at <= end; at += step) pts.push({ t: at, online: null, playing: null });
  for (const [at, online, playing] of series) {
    const p = pts[Math.floor((at - from) / step)];
    if (!p) continue;
    p.online = Math.max(p.online ?? 0, online);
    p.playing = Math.max(p.playing ?? 0, playing);
  }
  return pts;
}

export function OnlineCard({ now, series, wide }: { now: string; series: Series; wide?: boolean }) {
  const [range, setRange] = useState('day');
  const [, label, span, step] = RANGES.find((r) => r[0] === range)!;
  const pts = useMemo(() => fold(now, series, span, step), [now, series, span, step]);
  const when = (p: Point) => (step === HOUR ? timeOf(p.t) : `${dayOf(p.t)} ${timeOf(p.t)}`);
  const table: Table = {
    head: [t('From'), t('Online'), t('In a match')],
    rows: pts.filter((p) => p.online !== null).reverse().map((p) => [when(p), p.online!, p.playing!]),
  };
  return (
    <ChartCard
      title={t('Players online')}
      sub={t('The busiest moment of each hour')}
      table={table}
      wide={wide}
      legend={<><LegendItem color="var(--gl-online)" label={t('Online')} /><LegendItem color="var(--gl-playing)" label={t('In a match')} line /></>}
    >
      <div class="seg tabs gl-range" role="tablist" aria-label={t('Time range')} style={{ '--at': RANGES.findIndex((r) => r[0] === range), '--tabs': RANGES.length }}>
        {RANGES.map(([id, name]) => <button role="tab" aria-selected={id === range} onClick={() => setRange(id)}>{name}</button>)}
      </div>
      {pts.some((p) => p.online)
        ? <OnlineChart key={range} pts={pts} step={step} label={label} when={when} />
        : <p class="empty-note">{t('Nobody played in this time.')}</p>}
    </ChartCard>
  );
}

function OnlineChart({ pts, step, label, when }: { pts: Point[]; step: number; label: string; when: (p: Point) => string }) {
  const [ref, W] = useWidth();
  const H = 180, L = 28, R = 8, T = 10, B = 24;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const band = pw / pts.length;
  const top = evenTop(Math.max(...pts.map((p) => p.online ?? 0)));
  const x = (i: number) => L + (i + 0.5) * band;
  const y = (v: number) => T + (1 - v / top) * ph;
  // a line per run of hours the relay was counting (a gap where it wasn't)
  const line = (k: 'online' | 'playing') => pts.reduce((d, p, i) => (p[k] === null ? d : d + `${pts[i - 1]?.[k] == null ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[k]!).toFixed(1)}`), '');
  const area = line('online').split('M').filter(Boolean).map((run) => {
    const xs = run.split('L').map((c) => c.split(',')[0]);
    return `M${xs[0]},${T + ph}L${run}L${xs.at(-1)},${T + ph}Z`;
  }).join('');
  // a lone hour has no line to draw: a dot shows it instead
  const lone = (k: 'online' | 'playing', i: number) => pts[i][k] !== null && pts[i - 1]?.[k] == null && pts[i + 1]?.[k] == null;
  const yTicks = [0, top / 2, top];
  // time labels: every 3, 6 or 12 hours of the day, or each new day of the week, no closer than 40px
  const hours = [3, 6, 12].find((k) => k * band >= 40) ?? 12;
  const ticks: number[] = [];
  pts.forEach((p, i) => {
    const due = step === HOUR ? new Date(p.t).getHours() % hours === 0 : i > 0 && new Date(p.t).getDate() !== new Date(pts[i - 1].t).getDate();
    if (due && (!ticks.length || x(i) - x(ticks.at(-1)!) >= 40)) ticks.push(i);
  });

  return (
    <div ref={ref} class="chart">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={t('Players online over the last {range}', { range: label })}>
          {yTicks.map((v) => (
            <>
              <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} class="grid" />
              <text x={L - 8} y={y(v) + 4} class="tick" text-anchor="end">{v}</text>
            </>
          ))}
          <path d={area} class="gl-area" />
          <path d={line('online')} class="gl-line online" pathLength={1} />
          <path d={line('playing')} class="gl-line playing" pathLength={1} />
          {pts.map((p, i) => lone('online', i) && <circle cx={x(i)} cy={y(p.online!)} r={3} class="gl-dot online" />)}
          {pts.map((p, i) => lone('playing', i) && p.playing! > 0 && <circle cx={x(i)} cy={y(p.playing!)} r={3} class="gl-dot playing" />)}
          {pts.map((p, i) => p.online !== null && (
            <g class="gl-col" {...tipProps(() => (
              <>
                <div class="tip-title">{when(p)}</div>
                <TipRow value={p.online} label={t('online')} color="var(--gl-online)" />
                <TipRow value={p.playing} label={t('in a match')} color="var(--gl-playing)" />
              </>
            ), `${when(p)}: ${p.online} ${t('online')}, ${p.playing} ${t('in a match')}`)}>
              <rect x={L + i * band} y={T} width={band} height={ph} fill="transparent" />
              <line x1={x(i)} x2={x(i)} y1={T} y2={T + ph} class="gl-guide" />
            </g>
          ))}
          {ticks.map((i) => (
            <text x={Math.min(x(i), L + pw - 16)} y={H - 6} class="tick" text-anchor="middle">
              {step === HOUR ? timeOf(pts[i].t) : dayOf(pts[i].t)}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

/* ---------- busy hours ---------- */

/** Minutes played by hour of the week (UTC, Sunday 0:00 first), as a weekday × 3-hour heatmap of the viewer's own time. */
export function Busy({ week }: { week: number[] }) {
  // hours, so the tooltips read as hours played
  const heat = useMemo(() => busyBlocks(week).map((row) => row.map((min) => Math.round(min / 6) / 10)), [week]);
  const max = Math.max(...heat.flat());
  if (!max) return <p class="empty-note">{t('Not enough play yet to show the busy hours.')}</p>;
  return <RhythmHeatmap heat={heat} max={max} />;
}

/* ---------- a spread: how many fall in each bucket ---------- */

/**
 * Names for buckets of minutes, as the relays count them: the first under bounds[0], then from one bound to the next,
 * the last at bounds' end or over: "under 1 min", "5–15 min", "30 min – 1 h", "1–2 h", "over 2 h".
 */
export function minuteBuckets(bounds: number[]) {
  const lab = (m: number) => (m < 60 ? t('{n} min', { n: m }) : t('{n} h', { n: m / 60 }));
  const span = (a: number, b: number) => ((a < 60) === (b < 60) ? lab(b).replace(/^\d+/, `${a < 60 ? a : a / 60}–$&`) : `${lab(a)} – ${lab(b)}`);
  return (i: number) => (i === 0 ? t('under {time}', { time: lab(bounds[0]) }) : i === bounds.length ? t('over {time}', { time: lab(bounds[i - 1]) }) : span(bounds[i - 1], bounds[i]));
}

/** A bar per bucket and its share of the whole, in a list card. */
export function Spread({ title, sub, counts, name, empty }: { title: string; sub: string; counts: number[]; name: (i: number) => string; empty: string }) {
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  return (
    <section class="card gl-list">
      <h3 class="chart-title">{title}</h3>
      <p class="chart-sub">{sub}</p>
      {total ? (
        <ul class="gl-bars">
          {counts.map((c, i) => (
            <li style={{ '--k': i, '--w': `${(c / max) * 100}%` }} {...tipProps(() => <TipRow value={c.toLocaleString(LOCALE)} label={name(i)} color="var(--accent)" />, `${name(i)}: ${c}`)}>
              <span class="gl-bar-label">{name(i)}</span>
              <span class="gl-bar"><i /></span>
              <b>{Math.round((c / total) * 100)}%</b>
            </li>
          ))}
        </ul>
      ) : (
        <p class="empty-note">{empty}</p>
      )}
    </section>
  );
}
