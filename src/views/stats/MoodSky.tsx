import { useMemo, useState } from 'preact/hooks';
import { CHART_ORDER, shortName } from '../../data/emotions';
import { shortDate } from '../../lib/dates';
import { fmtMood, type Stats as S } from '../../lib/stats';
import { CloudChart, type Puff } from '../../components/CloudChart';
import { TipRow, bucketLabel, hideTip, showTip } from '../../components/charts';
import { count, t } from '../../lib/i18n';

const H = 240;
const INSET: [number, number, number, number] = [12, 8, 26, 28]; // top, right, bottom, left

function dominant(cores: Record<string, number>) {
  let best: string | null = null, top = 0;
  for (const id of CHART_ORDER) if ((cores[id] ?? 0) > top) [best, top] = [id, cores[id]];
  return best;
}

/** A smooth line through the points, broken where a stretch has no mood. */
function curve(pts: ([number, number] | null)[]) {
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    const prev = pts[i - 1];
    if (!prev) { d += `M${p[0].toFixed(1)},${p[1].toFixed(1)}`; continue; }
    const before = pts[i - 2] ?? prev, next = pts[i + 1] ?? p;
    // Catmull-Rom, as a cubic Bézier
    const c1 = [prev[0] + (p[0] - before[0]) / 6, prev[1] + (p[1] - before[1]) / 6];
    const c2 = [p[0] - (next[0] - prev[0]) / 6, p[1] - (next[1] - prev[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  }
  return d;
}

/**
 * Your mood as a sky: each day (or week) you felt something is a cloud at the height of its mood, in the colour and
 * letters of the world felt most, bigger the more you wrote. The line through them is the rolling average.
 */
export function MoodSky({ s }: { s: S }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = s.buckets.length;
  const xf = (i: number) => (n === 1 ? 0.5 : i / (n - 1));
  const yf = (m: number) => (5 - m) / 10;
  const most = Math.max(1, ...s.buckets.map((b) => b.entries.length));
  // a week's few clouds can be big; months of them overlap into a bank
  const size = Math.min(1.5, Math.max(0.85, 3.6 / Math.sqrt(n)));
  const puffs = useMemo<Puff[]>(
    () => s.buckets.flatMap((b, i) => {
      const world = dominant(b.cores);
      return b.mood === null || !world ? [] : [{ x: xf(i), y: yf(b.mood), r: (0.07 + 0.08 * Math.sqrt(b.entries.length / most)) * size, world }];
    }),
    [s],
  );

  const tipFor = (i: number) => {
    const b = s.buckets[i], world = dominant(b.cores);
    return (
      <>
        <div class="tip-title">{bucketLabel(b, s.step)}</div>
        {world && <TipRow value={shortName(world)} label={t('most felt')} color={`var(--emo-${world})`} />}
        <TipRow value={fmtMood(b.mood)} label={b.entries.length ? t('mood · {count}', { count: count(b.entries.length, 'entry', 'entries') }) : t('no entries')} />
        <TipRow value={fmtMood(b.rolling)} label={s.step === 1 ? t('7-day average') : t('4-week average')} color="var(--ink)" />
      </>
    );
  };

  return (
    <CloudChart puffs={puffs} height={H} inset={INSET} hot={hover === null ? null : xf(hover)}>
      {(W) => {
        const [T, R, B, L] = INSET;
        const pw = W - L - R, ph = H - T - B;
        const x = (i: number) => L + xf(i) * pw;
        const y = (m: number) => T + yf(m) * ph;
        const line = curve(s.buckets.map((b, i) => (b.rolling === null ? null : [x(i), y(b.rolling)])));
        const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];
        const at = (e: PointerEvent | FocusEvent, i: number) => {
          const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
          const b = s.buckets[i], m = b.rolling ?? b.mood;
          showTip(r.left + x(i) - L, r.top + (m === null ? 0 : y(m) - T), tipFor(i));
        };
        const move = (e: PointerEvent) => {
          const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
          const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / Math.max(1, r.width)) * (n - 1))));
          setHover(i);
          at(e, i);
        };
        return (
          <g role="group" aria-label={t('Mood over time, from −5 unpleasant to +5 pleasant')}>
            <line x1={L} x2={L + pw} y1={y(0)} y2={y(0)} class="cc-zero" />
            {[5, 0, -5].map((m) => <text x={L - 8} y={y(m) + 4} class="tick" text-anchor="end">{m > 0 ? '+5' : m < 0 ? '−5' : '0'}</text>)}
            {ticks.map((i) => (
              <text x={x(i)} y={H - 6} class="tick" text-anchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{shortDate(s.buckets[i].key)}</text>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ph} class="cc-cross" />}
            {line && <path d={line} class="cc-line" pathLength={1} />}
            {hover !== null && s.buckets[hover].rolling !== null && <circle cx={x(hover)} cy={y(s.buckets[hover].rolling!)} r={4.5} class="cc-dot" />}
            <rect
              x={L} y={T} width={pw} height={ph} fill="transparent" tabIndex={0} class="cc-hit"
              aria-label={t('Mood chart — use arrow keys to move between days')}
              onPointerMove={move}
              onPointerDown={move}
              onPointerLeave={(e) => { if (e.pointerType === 'mouse') { setHover(null); hideTip(); } }}
              onFocus={(e) => { const i = hover ?? n - 1; setHover(i); at(e, i); }}
              onBlur={() => { setHover(null); hideTip(); }}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                const i = Math.max(0, Math.min(n - 1, (hover ?? n - 1) + (e.key === 'ArrowLeft' ? -1 : 1)));
                setHover(i);
                at(e as unknown as FocusEvent, i);
              }}
            />
          </g>
        );
      }}
    </CloudChart>
  );
}
