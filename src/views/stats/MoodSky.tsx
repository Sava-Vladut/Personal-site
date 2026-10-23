import { useState } from 'preact/hooks';
import { CHART_ORDER, shortName } from '../../data/emotions';
import { shortDate } from '../../lib/dates';
import { fmtMood, type Bucket, type Stats as S } from '../../lib/stats';
import { CloudChart, rollDelay } from '../../components/CloudChart';
import { TipRow, bucketLabel, hideTip, showTip } from '../../components/charts';
import { Sprite } from '../../components/icons';
import { count, t } from '../../lib/i18n';

// the old mood chart's proportions: −5 to +5 over the same height, labels left and under
const H = 200, T = 14, R = 8, B = 24, L = 28;

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
 * Where the days sit: the first and last pulled in from the edges by about half a step so their clouds aren't cut
 * off, and each cloud about as wide as its step, so a week's are clear and a year's run together, never a speck.
 */
function layout(W: number, n: number) {
  const full = Math.max(1, W - L - R);
  const pad = n > 1 ? Math.min(22, Math.max(8, (full / (n - 1)) * 0.45)) : full / 2;
  const span = Math.max(1, full - pad * 2);
  const step = n > 1 ? span / (n - 1) : span;
  const x = (i: number) => L + pad + (n > 1 ? (i / (n - 1)) * span : 0);
  const y = (m: number) => T + ((5 - m) / 10) * (H - T - B);
  return { pad, span, step, x, y, radius: Math.min(22, Math.max(8, step * 0.5)) };
}

/** The buckets that get their world's sprite: all of them when there's room, else the busiest of each few. */
function marked(buckets: Bucket[], step: number) {
  const every = Math.max(1, Math.ceil(16 / Math.max(1, step)));
  const out = new Set<number>();
  for (let i = 0; i < buckets.length; i += every) {
    let best = -1;
    for (let j = i; j < Math.min(buckets.length, i + every); j++)
      if (buckets[j].mood !== null && dominant(buckets[j].cores) && (best < 0 || buckets[j].entries.length > buckets[best].entries.length)) best = j;
    if (best >= 0) out.add(best);
  }
  return out;
}

/**
 * Your mood as a sky: each day (or week) you felt something is a cloud at the height of its mood, in the colour and
 * letters of the world felt most, with that world's sprite in it. The line through them is the rolling average.
 */
export function MoodSky({ s }: { s: S }) {
  const [hover, setHover] = useState<number | null>(null);
  const [hotX, setHotX] = useState<number | null>(null); // where the hovered day is, so its cloud lights up
  const n = s.buckets.length;
  const most = Math.max(1, ...s.buckets.map((b) => b.entries.length));
  const felt = s.buckets.flatMap((b, i) => (b.mood !== null && dominant(b.cores) ? [i] : []));

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
    <CloudChart
      height={H}
      puffs={(W) => {
        const { x, y, radius } = layout(W, n);
        return felt.map((i) => {
          const b = s.buckets[i];
          return { x: x(i), y: y(b.mood!), r: radius * (0.75 + 0.35 * Math.sqrt(b.entries.length / most)), world: dominant(b.cores)! };
        });
      }}
      hot={hover === null ? null : hotX}
    >
      {(W) => {
        const { pad, span, step, x, y } = layout(W, n);
        const ph = H - T - B;
        const line = curve(s.buckets.map((b, i) => (b.rolling === null ? null : [x(i), y(b.rolling)])));
        const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];
        const marks = marked(s.buckets, step);
        if (hover !== null) marks.add(hover);
        const size = step >= 30 ? 16 : 13;
        const pick = (clientX: number, r: DOMRect) =>
          Math.max(0, Math.min(n - 1, Math.round(((clientX - r.left - pad) / Math.max(1, span)) * (n - 1))));
        const at = (e: Event, i: number) => {
          const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
          const b = s.buckets[i], m = b.rolling ?? b.mood;
          showTip(r.left + x(i) - L, r.top + (m === null ? 0 : y(m) - T), tipFor(i));
        };
        const show = (e: Event, i: number) => {
          setHover(i);
          setHotX(x(i));
          at(e, i);
        };
        const move = (e: PointerEvent) => show(e, pick(e.clientX, (e.currentTarget as SVGRectElement).getBoundingClientRect()));
        return (
          <g role="group" aria-label={t('Mood over time, from −5 unpleasant to +5 pleasant')}>
            <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} class="cc-zero" />
            {[5, 0, -5].map((m) => <text x={L - 8} y={y(m) + 4} class="tick" text-anchor="end">{m > 0 ? '+5' : m < 0 ? '−5' : '0'}</text>)}
            {ticks.map((i) => (
              <text x={x(i)} y={H - 6} class="tick" text-anchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{shortDate(s.buckets[i].key)}</text>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ph} class="cc-cross" />}
            {line && <path d={line} class="cc-line" pathLength={1} />}
            {[...marks].map((i) => {
              const b = s.buckets[i], world = dominant(b.cores);
              if (b.mood === null || !world) return null;
              const big = i === hover ? size + 4 : size;
              return (
                <g transform={`translate(${(x(i) - big / 2).toFixed(1)},${(y(b.mood) - big / 2).toFixed(1)})`} class="cc-mark">
                  <g class="cc-mark-in" style={{ animationDelay: `${(0.3 + rollDelay(i, felt)).toFixed(2)}s` }}>
                    <Sprite core={world} size={big} idle={i === hover} />
                  </g>
                </g>
              );
            })}
            <rect
              x={L} y={T} width={W - L - R} height={ph} fill="transparent" tabIndex={0} class="cc-hit"
              aria-label={t('Mood chart — use arrow keys to move between days')}
              onPointerMove={move}
              onPointerDown={move}
              onPointerLeave={(e) => { if (e.pointerType === 'mouse') { setHover(null); hideTip(); } }}
              onFocus={(e) => show(e, hover ?? n - 1)}
              onBlur={() => { setHover(null); hideTip(); }}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                show(e, Math.max(0, Math.min(n - 1, (hover ?? n - 1) + (e.key === 'ArrowLeft' ? -1 : 1))));
              }}
            />
          </g>
        );
      }}
    </CloudChart>
  );
}
