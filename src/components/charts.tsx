// Hand-built SVG charts. Conventions: text uses ink tokens (never series colours), hairline solid grids,
// ≤24px bars with 4px rounded data-ends, 2px surface gaps between touching marks, a tooltip on every mark
// (hover, tap or keyboard focus) and a table view on every card.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CHART_ORDER, CORE, EMOTION, PICKER_ORDER, shortName } from '../data/emotions';
import { WEEKDAYS, addDays, diffDays, monthShort, parseKey, shortDate, startOfWeek } from '../lib/dates';
import { fmtMood, pct, type Bucket } from '../lib/stats';
import { Icon, Sprite, type UiName } from './icons';

/* ---------- scroll reveal ---------- */

/** A stack of cards whose entrance waits until each one scrolls into view (the CSS holds its animations until data-seen is set). */
export function RevealStack({ children }: { children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const kids = [...el.children] as HTMLElement[];
    if (typeof IntersectionObserver === 'undefined') {
      kids.forEach((k) => (k.dataset.seen = ''));
      return;
    }
    const io = new IntersectionObserver((rows) => {
      for (const r of rows)
        if (r.isIntersecting) {
          (r.target as HTMLElement).dataset.seen = '';
          io.unobserve(r.target);
        }
    }, { rootMargin: '0px 0px -6% 0px' });
    kids.forEach((k) => io.observe(k));
    return () => io.disconnect();
  }, []);
  return <div ref={ref} class="stack-l reveal">{children}</div>;
}

/** The world felt most in a bucket or day, if any. */
function dominant(cores: Record<string, number>) {
  let best: string | null = null, top = 0;
  for (const id of CHART_ORDER) if ((cores[id] ?? 0) > top) [best, top] = [id, cores[id]];
  return best;
}
const stagger = (i: number, n: number) => ({ '--t': (n > 1 ? i / (n - 1) : 0).toFixed(3) });

/* ---------- count-up ---------- */

/** A figure like "+1.4", "63%" or "12" that counts up from zero when it first appears. */
export function CountUp({ value }: { value: string | number }) {
  const text = String(value);
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(false);
  useLayoutEffect(() => {
    const el = ref.current!;
    const m = /^(\D*?)(\d[\d,]*(?:\.(\d+))?)(.*)$/.exec(text);
    // only the first time: later changes (a new range) just swap the number
    if (shown.current || !m || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = text;
      return;
    }
    shown.current = true;
    const [, pre, num, dec, post] = m;
    const to = parseFloat(num.replace(/,/g, '')), dp = dec?.length ?? 0, t0 = performance.now();
    const fmt = (n: number) => (num.includes(',') ? n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : n.toFixed(dp));
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / 900)); // a frame's time can be a touch before t0
      el.textContent = p < 1 ? pre + fmt(to * (1 - Math.pow(1 - p, 4))) + post : text;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    tick(t0);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = text;
    };
  }, [text]);
  // the text is written by the effect, so Preact never holds a stale text node here
  return <span ref={ref} />;
}

/* ---------- shared tooltip ---------- */

type Tip = { x: number; y: number; content: ComponentChildren } | null;
let tip: Tip = null;
let lastShow = 0;
const tipSubs = new Set<() => void>();
const setTip = (t: Tip) => {
  tip = t;
  tipSubs.forEach((f) => f());
};
export const showTip = (x: number, y: number, content: ComponentChildren) => {
  lastShow = performance.now();
  setTip({ x, y, content });
};
export const hideTip = () => tip && setTip(null);

/** Spread onto any mark: tooltip on hover, tap and keyboard focus. */
export function tipProps(content: () => ComponentChildren, label?: string) {
  return {
    tabIndex: 0,
    'aria-label': label,
    onPointerMove: (e: PointerEvent) => showTip(e.clientX, e.clientY, content()),
    onPointerDown: (e: PointerEvent) => showTip(e.clientX, e.clientY, content()),
    onPointerLeave: (e: PointerEvent) => e.pointerType === 'mouse' && hideTip(),
    onFocus: (e: FocusEvent) => {
      const r = (e.currentTarget as Element).getBoundingClientRect();
      showTip(r.left + r.width / 2, r.top, content());
    },
    onBlur: hideTip,
  };
}

export function TooltipLayer() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    tipSubs.add(f);
    const away = () => performance.now() - lastShow > 60 && hideTip();
    addEventListener('pointerdown', away);
    addEventListener('scroll', hideTip, { capture: true, passive: true });
    return () => {
      tipSubs.delete(f);
      removeEventListener('pointerdown', away);
      removeEventListener('scroll', hideTip, { capture: true });
    };
  }, []);
  if (!tip) return null;
  const x = Math.min(Math.max(tip.x, 90), innerWidth - 90);
  const below = tip.y < 90;
  return (
    <div class="tooltip" role="status" style={{ left: `${x}px`, top: `${below ? tip.y + 18 : tip.y - 14}px`, transform: `translate(-50%, ${below ? '0' : '-100%'})` }}>
      {tip.content}
    </div>
  );
}

const TipRow = ({ value, label, color }: { value: ComponentChildren; label: string; color?: string }) => (
  <div class="tip-row">
    {color && <i style={{ background: color }} />}
    <b>{value}</b>
    <span>{label}</span>
  </div>
);

/* ---------- card with chart ⇄ table toggle ---------- */

export interface Table { head: string[]; rows: (string | number)[][] }

export function ChartCard({ title, sub, legend, table, children }: {
  title: string;
  sub?: string;
  legend?: ComponentChildren;
  table?: Table;
  children: ComponentChildren;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section class="card chart-card">
      <header class="chart-head">
        <div>
          <h3 class="chart-title">{title}</h3>
          {sub && <p class="chart-sub">{sub}</p>}
        </div>
        {table && (
          <button class="icon-btn small" aria-pressed={asTable} aria-label={asTable ? 'Show chart' : 'Show as table'} title={asTable ? 'Show chart' : 'Show as table'} onClick={() => setAsTable(!asTable)}>
            <Icon name={asTable ? 'chart-bar' : 'table'} size={18} />
          </button>
        )}
      </header>
      {asTable && table ? (
        <div class="table-wrap">
          <table>
            <thead><tr>{table.head.map((h) => <th>{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r) => <tr>{r.map((c) => <td>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <>
          {legend && <div class="legend">{legend}</div>}
          {children}
        </>
      )}
    </section>
  );
}

export const LegendItem = ({ color, label, line, core }: { color?: string; label: string; line?: boolean; core?: string }) => (
  <span class="legend-item">
    {core ? <Sprite core={core} size={11} /> : <i class={line ? 'line' : ''} style={{ background: color }} />}
    {label}
  </span>
);

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current!;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export const bucketLabel = (b: Bucket, step: number) => (step === 1 ? shortDate(b.key) : `Week of ${shortDate(b.key)}`);

/** Path for a vertical bar with a 4px rounded data-end and a square base. */
function barPath(x: number, w: number, base: number, tip: number) {
  const h = Math.abs(tip - base);
  if (h < 0.5) return '';
  const r = Math.min(4, w / 2, h);
  const up = tip < base;
  const t = tip, s = up ? 1 : -1;
  return `M${x},${base}V${t + s * r}Q${x},${t} ${x + r},${t}H${x + w - r}Q${x + w},${t} ${x + w},${t + s * r}V${base}Z`;
}

/** Pleasant is the deep shade of the page's accent colour, unpleasant its pale tint (see stats.css), so they still differ by lightness alone. */
export const PLEASANT = 'var(--pos-a)';
export const UNPLEASANT = 'var(--neg-a)';

/* ---------- mood over time ---------- */

export function MoodChart({ buckets, step }: { buckets: Bucket[]; step: number }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const H = 190, L = 30, R = 10, T = 10, B = 24;
  const n = buckets.length;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const x = (i: number) => L + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
  const y = (m: number) => T + ((5 - m) / 10) * ph;
  const pts = buckets.map((b, i) => (b.rolling === null ? null : [x(i), y(b.rolling)]));
  const line = pts.reduce((acc, p, i, arr) => (p ? acc + `${arr[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}` : acc), '');
  // the same line closed down to the zero axis, so the mood pools above and below it in the accent colour
  const zero = y(0).toFixed(1);
  const area = pts.reduce((acc, p, i, arr) => {
    if (!p) return acc;
    const open = !arr[i - 1];
    const closes = !arr[i + 1];
    return acc + `${open ? `M${p[0].toFixed(1)},${zero}L` : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}${closes ? `L${p[0].toFixed(1)},${zero}Z` : ''}`;
  }, '');
  const bigDots = n <= 45;
  const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];

  const pick = (clientX: number, rect: DOMRect) => {
    // The target rectangle starts at the plot's left edge, after the axis margin.
    const i = Math.round(((clientX - rect.left) / Math.max(1, rect.width)) * (n - 1));
    return Math.max(0, Math.min(n - 1, i));
  };
  const tipFor = (i: number) => {
    const b = buckets[i];
    return (
      <>
        <div class="tip-title">{bucketLabel(b, step)}</div>
        <TipRow value={fmtMood(b.mood)} label={b.entries.length ? `mood · ${b.entries.length} ${b.entries.length === 1 ? 'entry' : 'entries'}` : 'no entries'} />
        <TipRow value={fmtMood(b.rolling)} label={`${step === 1 ? '7-day' : '4-week'} average`} color="var(--ink)" />
      </>
    );
  };
  const move = (e: PointerEvent) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const i = pick(e.clientX, r);
    setHover(i);
    const b = buckets[i];
    const my = b.rolling ?? b.mood;
    showTip(r.left + x(i) - L, r.top + (my !== null ? y(my) - T : 0), tipFor(i));
  };

  return (
    <div ref={ref} class="chart drawn">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label="Mood over time, from −5 unpleasant to +5 pleasant">
          <defs>
            <linearGradient id="moodwash" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="var(--ink)" stop-opacity="0.05" />
              <stop offset="0.5" stop-color="var(--ink)" stop-opacity="0" />
              <stop offset="1" stop-color="var(--ink)" stop-opacity="0.05" />
            </linearGradient>
            <linearGradient id="moodpool" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={T} y2={T + ph}>
              <stop offset="0" stop-color="var(--accent)" stop-opacity="0.34" />
              <stop offset="0.5" stop-color="var(--accent)" stop-opacity="0.04" />
              <stop offset="1" stop-color="var(--accent)" stop-opacity="0.34" />
            </linearGradient>
          </defs>
          <rect x={L} y={T} width={pw} height={ph} fill="url(#moodwash)" />
          {[5, 0, -5].map((m) => (
            <g>
              <line x1={L} x2={L + pw} y1={y(m)} y2={y(m)} class={m === 0 ? 'axis' : 'grid'} />
              <text x={L - 8} y={y(m) + 4} class="tick" text-anchor="end">{m > 0 ? '+5' : m < 0 ? '−5' : '0'}</text>
            </g>
          ))}
          {ticks.map((i) => (
            <text x={x(i)} y={H - 6} class="tick" text-anchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{shortDate(buckets[i].key)}</text>
          ))}
          {area && <path d={area} class="area" fill="url(#moodpool)" />}
          {buckets.map((b, i) => {
            if (b.mood === null) return null;
            const world = dominant(b.cores);
            return (
              <circle
                cx={x(i)} cy={y(b.mood)} r={bigDots ? 4 : 2.5} class={bigDots ? 'dot' : 'dot faint'}
                style={{ ...stagger(i, n), ...(world ? { fill: `var(--emo-${world})`, opacity: bigDots ? 1 : 0.85 } : {}) }}
              />
            );
          })}
          {line && <path d={line} class="series-line" pathLength={1} />}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ph} class="crosshair" />
              {buckets[hover].rolling !== null && <circle cx={x(hover)} cy={y(buckets[hover].rolling!)} r={4.5} class="dot ring" />}
            </g>
          )}
          <rect
            x={L} y={T} width={pw} height={ph} fill="transparent" tabIndex={0}
            aria-label="Mood chart — use arrow keys to move between days"
            onPointerMove={move}
            onPointerDown={move}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') { setHover(null); hideTip(); } }}
            onFocus={(e) => { const i = hover ?? n - 1; setHover(i); const r = (e.currentTarget as SVGRectElement).getBoundingClientRect(); showTip(r.left + x(i) - L, r.top, tipFor(i)); }}
            onBlur={() => { setHover(null); hideTip(); }}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              const i = Math.max(0, Math.min(n - 1, (hover ?? n - 1) + (e.key === 'ArrowLeft' ? -1 : 1)));
              setHover(i);
              const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
              showTip(r.left + x(i) - L, r.top, tipFor(i));
            }}
          />
        </svg>
      )}
    </div>
  );
}

/* ---------- pleasant vs unpleasant, per day/week ---------- */

export function BalanceChart({ buckets, step }: { buckets: Bucket[]; step: number }) {
  const [ref, W] = useWidth();
  const H = 170, L = 26, R = 6, T = 8, B = 22;
  const n = buckets.length;
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.pleasant, b.unpleasant)));
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const band = pw / Math.max(1, n);
  const bw = Math.max(2, Math.min(24, band - 2));
  const mid = T + ph / 2;
  const s = (v: number) => (v / max) * (ph / 2);
  const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];

  return (
    <div ref={ref} class="chart">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label="Pleasant and unpleasant entries over time">
          <line x1={L} x2={L + pw} y1={T} y2={T} class="grid" />
          <line x1={L} x2={L + pw} y1={T + ph} y2={T + ph} class="grid" />
          <text x={L - 8} y={T + 4} class="tick" text-anchor="end">{max}</text>
          <text x={L - 8} y={mid + 4} class="tick" text-anchor="end">0</text>
          <text x={L - 8} y={T + ph + 4} class="tick" text-anchor="end">{max}</text>
          {buckets.map((b, i) => {
            const bx = L + i * band + (band - bw) / 2;
            return (
              <g class="mark" {...tipProps(() => (
                <>
                  <div class="tip-title">{bucketLabel(b, step)}</div>
                  <TipRow value={b.pleasant} label="pleasant" color={PLEASANT} />
                  <TipRow value={b.unpleasant} label="unpleasant" color={UNPLEASANT} />
                </>
              ), `${bucketLabel(b, step)}: ${b.pleasant} pleasant, ${b.unpleasant} unpleasant`)}>
                <rect x={L + i * band} y={T} width={band} height={ph} fill="transparent" />
                {b.pleasant > 0 && <path d={barPath(bx, bw, mid - 1, mid - 1 - s(b.pleasant))} fill={PLEASANT} class="bar up" style={stagger(i, n)} />}
                {b.unpleasant > 0 && <path d={barPath(bx, bw, mid + 1, mid + 1 + s(b.unpleasant))} fill={UNPLEASANT} class="bar down" style={stagger(i, n)} />}
              </g>
            );
          })}
          <line x1={L} x2={L + pw} y1={mid} y2={mid} class="axis" />
          {ticks.map((i) => (
            <text x={L + i * band + band / 2} y={H - 6} class="tick" text-anchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{shortDate(buckets[i].key)}</text>
          ))}
        </svg>
      )}
    </div>
  );
}

/* ---------- emotion mix over time: 100% stacked columns ---------- */

export function MixChart({ buckets, step }: { buckets: Bucket[]; step: number }) {
  const [ref, W] = useWidth();
  // at most ~16 columns so each stays readable on a phone
  const g = Math.max(1, Math.ceil(buckets.length / 16));
  const cols: { key: string; end: string; cores: Record<string, number>; total: number }[] = [];
  for (let i = 0; i < buckets.length; i += g) {
    const part = buckets.slice(i, i + g);
    const cores: Record<string, number> = {};
    part.forEach((b) => Object.entries(b.cores).forEach(([k, v]) => (cores[k] = (cores[k] ?? 0) + v)));
    cols.push({ key: part[0].key, end: part[part.length - 1].end, cores, total: Object.values(cores).reduce((a, b) => a + b, 0) });
  }
  const H = 170, L = 6, R = 6, T = 6, B = 22;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const band = pw / Math.max(1, cols.length);
  const bw = Math.min(24, band - 4);
  const label = (c: (typeof cols)[number]) => (step === 1 && g === 1 ? shortDate(c.key) : `${shortDate(c.key)} – ${shortDate(c.end)}`);

  return (
    <div ref={ref} class="chart">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label="Share of each emotion world over time">
          <line x1={L} x2={L + pw} y1={T + ph} y2={T + ph} class="axis" />
          {cols.map((c, i) => {
            const x = L + i * band + (band - bw) / 2;
            let y = T + ph;
            const present = CHART_ORDER.filter((id) => c.cores[id]);
            return (
              <g class="mark" {...tipProps(() => (
                <>
                  <div class="tip-title">{label(c)}</div>
                  {c.total ? present.map((id) => <TipRow value={pct(c.cores[id] / c.total)} label={shortName(id)} color={`var(--emo-${id})`} />) : <span>No feelings logged</span>}
                </>
              ), label(c))}>
                <rect x={L + i * band} y={T} width={band} height={ph} fill="transparent" />
                {c.total === 0 && <rect x={x} y={T + ph - 2} width={bw} height={2} rx={1} fill="var(--line-2)" />}
                <g class="bar up" style={stagger(i, cols.length)}>
                  {present.map((id, k) => {
                    const h = (c.cores[id] / c.total) * ph;
                    y -= h;
                    const last = k === present.length - 1;
                    const segH = Math.max(0, h - (last ? 0 : 2)); // 2px surface gap between segments
                    return last
                      ? <path d={barPath(x, bw, y + h, y)} fill={`var(--emo-${id})`} />
                      : <rect x={x} y={y + 2} width={bw} height={segH} fill={`var(--emo-${id})`} />;
                  })}
                </g>
              </g>
            );
          })}
          {[0, cols.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
            <text x={L + i * band + band / 2} y={H - 6} class="tick" text-anchor={cols.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'}>{shortDate(cols[i].key)}</text>
          ))}
        </svg>
      )}
    </div>
  );
}

/* ---------- one bar split by world: unpleasant worlds on the left, pleasant on the right ---------- */

export function WorldSplit({ cores, total }: { cores: { id: string; count: number }[]; total: number }) {
  const by = new Map(cores.map((c) => [c.id, c.count]));
  const segs = PICKER_ORDER.map((id) => ({ id, count: by.get(id) ?? 0 })).filter((x) => x.count > 0);
  return (
    <div class="split-bar worlds">
      {segs.map((x, i) => (
        <i
          style={{ flexGrow: x.count, background: `var(--emo-${x.id})`, '--k': i }}
          {...tipProps(() => <TipRow value={`${x.count} · ${pct(total ? x.count / total : 0)}`} label={shortName(x.id)} color={`var(--emo-${x.id})`} />, `${shortName(x.id)}: ${x.count}`)}
        />
      ))}
    </div>
  );
}

export const WorldLegend = () => <>{CHART_ORDER.map((id) => <LegendItem core={id} label={shortName(id)} />)}</>;

/* ---------- horizontal bars (worlds, feelings) ---------- */

export function HBars({ rows, total }: { rows: { id: string; label: string; count: number; core: string }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul class="hbars">
      {rows.map((r, i) => (
        <li style={{ '--k': i }} {...tipProps(() => <TipRow value={`${r.count} · ${pct(total ? r.count / total : 0)}`} label={r.label} color={`var(--emo-${r.core})`} />, `${r.label}: ${r.count}`)}>
          <span class="hbar-label"><Sprite core={r.core} size={12} />{r.label}</span>
          <span class="hbar-track">{r.count > 0 && <i style={{ width: `${(r.count / max) * 100}%`, background: `var(--emo-${r.core})` }} />}</span>
          <span class="hbar-value">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- mood bars: average mood per weekday / part of day ---------- */

export function MoodBars({ rows }: { rows: { label: string; mood: number | null; n: number }[] }) {
  const [ref, W] = useWidth();
  const H = 150, L = 26, R = 4, T = 8, B = 22;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const band = pw / rows.length;
  const bw = Math.min(24, band - 8);
  const mid = T + ph / 2;
  const s = (m: number) => (Math.abs(m) / 5) * (ph / 2);
  return (
    <div ref={ref} class="chart">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label="Average mood">
          <line x1={L} x2={L + pw} y1={T} y2={T} class="grid" />
          <line x1={L} x2={L + pw} y1={T + ph} y2={T + ph} class="grid" />
          <text x={L - 8} y={T + 4} class="tick" text-anchor="end">+5</text>
          <text x={L - 8} y={mid + 4} class="tick" text-anchor="end">0</text>
          <text x={L - 8} y={T + ph + 4} class="tick" text-anchor="end">−5</text>
          {rows.map((r, i) => {
            const x = L + i * band + (band - bw) / 2;
            const m = r.mood;
            return (
              <g class="mark" {...tipProps(() => (
                <>
                  <div class="tip-title">{r.label}</div>
                  <TipRow value={fmtMood(m)} label={`average mood · ${r.n} ${r.n === 1 ? 'entry' : 'entries'}`} />
                </>
              ), `${r.label}: ${fmtMood(m)}`)}>
                <rect x={L + i * band} y={T} width={band} height={ph} fill="transparent" />
                {m !== null && Math.abs(m) > 0.02 && (
                  <path d={m > 0 ? barPath(x, bw, mid - 1, mid - 1 - s(m)) : barPath(x, bw, mid + 1, mid + 1 + s(m))} fill={m > 0 ? PLEASANT : UNPLEASANT} class={`bar ${m > 0 ? 'up' : 'down'}`} style={stagger(i, rows.length)} />
                )}
                <text x={L + i * band + band / 2} y={H - 6} class="tick" text-anchor="middle">{r.label}</text>
              </g>
            );
          })}
          <line x1={L} x2={L + pw} y1={mid} y2={mid} class="axis" />
        </svg>
      )}
    </div>
  );
}

/* ---------- mood rows: average mood per group, as bars left (unpleasant) or right (pleasant) of zero ---------- */

export function MoodRows({ rows }: { rows: { label: string; icon?: UiName; core?: string | null; mood: number | null; n: number }[] }) {
  // the longest bar reaches the end of its half, but ±2.5 at least, so small differences don't look dramatic
  const scale = Math.max(2.5, ...rows.map((r) => Math.abs(r.mood ?? 0)));
  return (
    <ul class="mood-rows">
      {rows.map((r, i) => {
        const m = r.mood;
        const w = m === null ? 0 : (Math.abs(m) / scale) * 100;
        return (
          <li style={{ '--k': i }} {...tipProps(() => (
            <>
              <div class="tip-title">{r.label}</div>
              <TipRow value={fmtMood(m)} label={`average mood · ${r.n} ${r.n === 1 ? 'entry' : 'entries'}`} />
            </>
          ), `${r.label}: ${fmtMood(m)}, ${r.n} ${r.n === 1 ? 'entry' : 'entries'}`)}>
            <span class="mr-label">
              {r.icon ? <Icon name={r.icon} size={15} /> : r.core ? <Sprite core={r.core} size={12} /> : null}
              <span>{r.label}</span>
            </span>
            <span class="mr-track">
              <span class="mr-half neg">{m !== null && m < -0.02 && <i style={{ width: `${w}%`, background: UNPLEASANT }} />}</span>
              <span class="mr-half pos">{m !== null && m > 0.02 && <i style={{ width: `${w}%`, background: PLEASANT }} />}</span>
            </span>
            <span class="mr-value">{fmtMood(m)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- intensity distribution ---------- */

export function IntensityChart({ rows }: { rows: { level: number; pleasant: number; unpleasant: number; total: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  const NAMES = ['Barely', 'Mild', 'Moderate', 'Strong', 'Intense'];
  return (
    <div class="intensity-chart">
      {rows.map((r) => (
        <div class="ic-col" style={{ '--k': r.level }} {...tipProps(() => (
          <>
            <div class="tip-title">{r.level} · {NAMES[r.level - 1]}</div>
            <TipRow value={r.pleasant} label="pleasant" color={PLEASANT} />
            <TipRow value={r.unpleasant} label="unpleasant" color={UNPLEASANT} />
          </>
        ), `Intensity ${r.level}: ${r.total}`)}>
          <div class="ic-bar">
            {r.pleasant > 0 && <i class="pos" style={{ height: `${(r.pleasant / max) * 100}%` }} />}
            {r.unpleasant > 0 && <i class="neg" style={{ height: `${(r.unpleasant / max) * 100}%` }} />}
          </div>
          <span class="tick-html">{r.level}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- rhythm heatmap: weekday × 3-hour block ---------- */

export function RhythmHeatmap({ heat, max }: { heat: number[][]; max: number }) {
  const BLOCKS = ['0–3', '3–6', '6–9', '9–12', '12–15', '15–18', '18–21', '21–24'];
  const step = (v: number) => (v === 0 ? 0 : Math.min(5, Math.ceil((v / max) * 5)));
  return (
    <div class="heat">
      <span />
      {['0', '', '6', '', '12', '', '18', ''].map((h) => <span class="tick-html">{h}</span>)}
      {heat.map((row, d) => (
        <>
          <span class="tick-html left">{WEEKDAYS[d].slice(0, 2)}</span>
          {row.map((v, b) => (
            <span class={`heat-cell s${step(v)}`} style={stagger(d * 8 + b, 56)} {...tipProps(() => <TipRow value={v} label={`${WEEKDAYS[d]} · ${BLOCKS[b]}h`} />, `${WEEKDAYS[d]} ${BLOCKS[b]}: ${v}`)} />
          ))}
        </>
      ))}
    </div>
  );
}

export const HeatLegend = () => (
  <span class="legend-item">Fewer {[1, 2, 3, 4, 5].map((s) => <i class={`heat-cell s${s} swatch`} />)} More</span>
);

/* ---------- calendar of dominant feelings ---------- */

type Day = { core: string | null; n: number; mood: number | null };

export function MoodCalendar({ calendar, start, end, weekStart }: { calendar: Map<string, Day>; start: string; end: string; weekStart: 0 | 1 }) {
  const span = diffDays(start, end) + 1;
  const cell = (k: string, inRange: boolean) => {
    const d = calendar.get(k);
    const cls = !inRange ? 'px out' : d ? 'px on' : 'px';
    const t = Math.min(1, Math.max(0, diffDays(start, k)) / Math.max(1, span - 1));
    return (
      <span
        class={cls}
        style={{ '--t': t.toFixed(3), ...(d?.core ? { background: `var(--emo-${d.core})` } : {}) }}
        {...(inRange ? tipProps(() => (
          <>
            <div class="tip-title">{shortDate(k)}</div>
            {d ? (
              <>
                {d.core && <TipRow value={shortName(d.core)} label="most felt" color={`var(--emo-${d.core})`} />}
                <TipRow value={d.n} label={d.n === 1 ? 'entry' : 'entries'} />
                <TipRow value={fmtMood(d.mood)} label="mood" />
              </>
            ) : <span>Nothing logged</span>}
          </>
        ), shortDate(k)) : {})}
      />
    );
  };

  if (span <= 120) {
    const first = startOfWeek(start, weekStart);
    const weeks = Math.ceil((diffDays(first, end) + 1) / 7);
    const labels = weekStart === 1 ? WEEKDAYS : [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)];
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
  // Year-in-pixels: one row per month, one column per day of month.
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

/* ---------- the emotion wheel: where your feelings live ---------- */

export function Wheel({ counts, onSelect, selected }: { counts: Map<string, number>; onSelect: (id: string | null) => void; selected: string | null }) {
  const [ref, W] = useWidth();
  const size = Math.min(W, 340);
  const c = size / 2;
  const rings = [[0.3, 0.53], [0.55, 0.76], [0.78, 1]];
  // Pleasant worlds on the right half, unpleasant on the left, starting at 12 o'clock.
  const order = [...PICKER_ORDER.slice(4), ...PICKER_ORDER.slice(0, 4)];
  const maxByDepth = [0, 1, 2].map((d) => Math.max(1, ...[...counts].filter(([id]) => EMOTION[id]?.depth === d).map(([, v]) => v)));

  const arc = (r0: number, r1: number, a0: number, a1: number) => {
    const p = (r: number, a: number) => `${(c + r * c * Math.sin(a)).toFixed(2)},${(c - r * c * Math.cos(a)).toFixed(2)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${p(r0, a0)}L${p(r1, a0)}A${r1 * c},${r1 * c} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0 * c},${r0 * c} 0 ${large} 0 ${p(r0, a0)}Z`;
  };
  const wedges: { id: string; d: string; depth: number }[] = [];
  const sprites: { core: string; x: number; y: number }[] = [];
  const TAU = Math.PI * 2;
  order.forEach((coreId, ci) => {
    const a0 = (ci / 8) * TAU, a1 = ((ci + 1) / 8) * TAU;
    wedges.push({ id: coreId, d: arc(rings[0][0], rings[0][1], a0, a1), depth: 0 });
    const mid = (a0 + a1) / 2, rm = ((rings[0][0] + rings[0][1]) / 2) * c;
    sprites.push({ core: coreId, x: c + rm * Math.sin(mid), y: c - rm * Math.cos(mid) });
    CORE[coreId].families.forEach((f, fi) => {
      const f0 = a0 + ((a1 - a0) * fi) / 3, f1 = a0 + ((a1 - a0) * (fi + 1)) / 3;
      wedges.push({ id: f.id, d: arc(rings[1][0], rings[1][1], f0, f1), depth: 1 });
      f.feelings.forEach((x, xi) => {
        const x0 = f0 + ((f1 - f0) * xi) / 2, x1 = f0 + ((f1 - f0) * (xi + 1)) / 2;
        wedges.push({ id: x.id, d: arc(rings[2][0], rings[2][1], x0, x1), depth: 2 });
      });
    });
  });
  const total = [...counts].filter(([id]) => EMOTION[id]?.depth === 0).reduce((a, [, v]) => a + v, 0);
  const sel = selected ? EMOTION[selected] : null;

  return (
    <div ref={ref} class="wheel-chart">
      {W > 0 && (
        <svg width={size} height={size} role="group" aria-label="Emotion wheel — darker means felt more often">
          {wedges.map((w) => {
            const v = counts.get(w.id) ?? 0;
            const core = EMOTION[w.id].core;
            const op = v ? 0.2 + 0.8 * (v / maxByDepth[w.depth]) : 1;
            return (
              <path
                d={w.d}
                class={`wedge${selected === w.id ? ' sel' : ''}`}
                style={{ '--depth': w.depth }}
                fill={v ? `var(--emo-${core})` : 'var(--surface-2)'}
                fill-opacity={op}
                role="button"
                onClick={() => onSelect(selected === w.id ? null : w.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(w.id))}
                {...tipProps(() => <TipRow value={v} label={EMOTION[w.id].name} color={`var(--emo-${core})`} />, `${EMOTION[w.id].name}: ${v}`)}
              />
            );
          })}
          {sprites.map((s) => (
            <svg x={s.x - 7} y={s.y - 7} width={14} height={14} viewBox="0 0 8 8" shape-rendering="crispEdges" pointer-events="none">
              <path d={spriteD(s.core)} fill={(counts.get(s.core) ?? 0) / maxByDepth[0] > 0.55 ? 'var(--surface)' : `var(--emo-${s.core})`} />
            </svg>
          ))}
          <text x={c} y={c - 4} text-anchor="middle" class="wheel-num">{sel ? counts.get(sel.id) ?? 0 : total}</text>
          <text x={c} y={c + 14} text-anchor="middle" class="tick">{sel ? 'times' : 'feelings'}</text>
        </svg>
      )}
    </div>
  );
}

function spriteD(core: string) {
  let d = '';
  CORE[core].sprite.forEach((row, y) => [...row].forEach((ch, x) => ch === 'X' && (d += `M${x} ${y}h1v1h-1z`)));
  return d;
}
