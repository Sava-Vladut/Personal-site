// The brain page: a side view drawn in letters, like the sky. Each emotion world lives in its own region and
// moves the way its sprite does (the amygdala flickers, the temporal lobe beats like a heart, the brainstem breathes).
// How brightly a region burns comes from the last seven weeks of the journal; tap one to read about it.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PICKER_ORDER, shortName } from '../data/emotions';
import { SPAN, ZONES, readBrain, regionLine, type BrainState, type Day } from '../lib/brain';
import { BOX_H, BOX_W, BOX_Y0, PATCHES, folds, grooveDist, partAt, patchAt } from '../lib/brainShape';
import { shortDate } from '../lib/dates';
import { watchView } from '../lib/inView';
import { useEntries } from '../lib/store';
import { count, t } from '../lib/i18n';
import { Sprite } from './icons';
import { RAMPS } from './Sky';

const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const PLAIN = RAMPS.default;
const CALM = PATCHES.findIndex((p) => p.world === 'calm-safety');

const rgb = (css: string): [number, number, number] => {
  const h = css.trim().replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as [number, number, number];
};
const mixRgb = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',');

/** How strongly each world's region is lit at one moment (0–1), moving like that world's sprite does. */
function pulse(world: string, t: number, ph: number, x: number, y: number): number {
  switch (world) {
    case 'fear': return 0.5 + 0.5 * Math.sin(t * 11 + ph * 6.3) * Math.sin(t * 7.3 + ph * 3);
    case 'anger': return 0.3 + 0.7 * Math.pow(Math.abs(Math.sin(t * 3.2 + ph * 1.5)), 3);
    case 'joy': return 0.45 + 0.55 * Math.abs(Math.sin(t * 2.6 + ph * 2));
    case 'love-connection': {
      const k = ((t + ph * 0.06) % 1.15) / 1.15;
      return 0.4 + 0.6 * Math.min(1, Math.exp(-(((k - 0.08) / 0.06) ** 2)) + 0.7 * Math.exp(-(((k - 0.3) / 0.07) ** 2)));
    }
    case 'calm-safety': return 0.55 + 0.45 * Math.sin(t * 0.9 + x * 2);
    case 'sadness': return 0.25 + 0.75 * (1 - ((t * 0.5 + ph) % 1));
    case 'hope-interest': return 0.5 + 0.5 * Math.sin(t * 2 - y * 18 + ph * 2);
    default: { const k = t % 3.6; return k < 0.3 ? 0.2 : 0.6 + 0.2 * Math.sin(t + ph * 3); } // shame: looks away now and then
  }
}

interface Grid {
  cols: number; rows: number; cw: number; ch: number;
  part: Uint8Array;     // 0 none, 1 cortex, 2 cerebellum, 3 stem
  patch: Int8Array;
  fold: Float32Array;   // 0–1 texture, groove cells 0
  edge: Uint8Array;
  ph: Float32Array;     // each cell's own phase
  x: Float32Array; y: Float32Array;
}

function lay(width: number): Grid {
  const cols = Math.max(46, Math.min(104, Math.round(width / 6.3)));
  const cw = width / cols;
  const ch = cw * 1.8;
  const rows = Math.max(12, Math.round((width * (BOX_H / BOX_W)) / ch));
  const g: Grid = {
    cols, rows, cw, ch: (width * (BOX_H / BOX_W)) / rows,
    part: new Uint8Array(cols * rows), patch: new Int8Array(cols * rows).fill(-1), fold: new Float32Array(cols * rows),
    edge: new Uint8Array(cols * rows), ph: new Float32Array(cols * rows), x: new Float32Array(cols * rows), y: new Float32Array(cols * rows),
  };
  const dx = (BOX_W / cols) * 1.1, dy = (BOX_H / rows) * 1.1;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = ((c + 0.5) / cols) * BOX_W, y = BOX_Y0 + ((r + 0.5) / rows) * BOX_H;
      g.x[i] = x; g.y[i] = y;
      g.ph[i] = Math.abs((Math.sin(c * 12.9898 + r * 78.233) * 43758.5453) % 1);
      const part = partAt(x, y);
      if (!part) continue;
      g.part[i] = part === 'cortex' ? 1 : part === 'cerebellum' ? 2 : 3;
      g.edge[i] = +(!partAt(x - dx, y) || !partAt(x + dx, y) || !partAt(x, y - dy) || !partAt(x, y + dy));
      if (part === 'cortex') {
        g.patch[i] = patchAt(x, y);
        g.fold[i] = grooveDist(x, y) < 0.016 && g.patch[i] < 0 ? 0 : folds(x, y);
      } else if (part === 'stem') {
        g.patch[i] = CALM;
        g.fold[i] = folds(x, y);
      } else g.fold[i] = folds(x, y);
    }
  return g;
}

function BrainCanvas({ brain, selected, onPick }: { brain: BrainState; selected: string | null; onPick: (world: string) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const live = useRef({ brain, selected });
  live.current = { brain, selected };
  const redraw = useRef<() => void>();
  const ripple = useRef<{ x: number; y: number; at: number } | null>(null);
  const grid = useRef<Grid | null>(null);
  const key = `${selected}|${brain.entries}|${brain.lead}|${Object.values(brain.regions).map((r) => r.level.toFixed(2)).join()}`;

  useEffect(() => {
    const el = cv.current!;
    const ctx = el.getContext('2d')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, visible = true, ink = [0, 0, 0], colors: Record<string, number[]> = {};
    const t0 = performance.now();

    const palette = () => {
      const css = getComputedStyle(el);
      ink = rgb(css.getPropertyValue('--ink'));
      colors = Object.fromEntries(Object.keys(ZONES).map((k) => [k, rgb(css.getPropertyValue(`--emo-${k}`))]));
    };

    const draw = () => {
      const g = grid.current;
      if (!g) return;
      const { brain, selected } = live.current;
      const now = performance.now();
      const s = reduced.matches ? 2.4 : (now - t0) / 1000;
      const lead = brain.lead ? colors[brain.lead] : ink;
      const cortexRgb = mixRgb(ink, lead, 0.5);
      const mute = 0.35 + 0.65 * Math.sqrt(brain.alive);   // a brain with little written in it burns low
      const rp = ripple.current;
      const rr = rp ? (now - rp.at) / 900 : 2;
      if (rp && rr > 1.4) ripple.current = null;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.font = `${g.cw / 0.6}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let r = 0; r < g.rows; r++) {
        for (let c = 0; c < g.cols; c++) {
          const i = r * g.cols + c;
          const part = g.part[i];
          if (!part) continue;
          const x = g.x[i], y = g.y[i], ph = g.ph[i];
          const px = (c + 0.5) * g.cw, py = (r + 0.5) * g.ch;
          let ramp = PLAIN, level: number, color: string, alpha: number;
          const p = g.patch[i];
          const ring = rp ? Math.max(0, 1 - Math.abs(Math.hypot(x - rp.x, y - rp.y) - rr * 0.7) / 0.07) : 0;
          if (p >= 0) {
            const world = PATCHES[p].world;
            const reg = brain.regions[world];
            ramp = RAMPS[world];
            const beat = pulse(world, s, ph, x, y);
            const chosen = world === selected;
            level = reg.level > 0 ? (0.12 + reg.level * (0.28 + 0.6 * beat)) * (0.55 + 0.45 * brain.force + 0.15) : 0.1;
            level = Math.min(1, level + ring * 0.4 + (chosen ? 0.12 : 0));
            color = colors[world].join(',');
            alpha = reg.level > 0 ? Math.min(1, 0.3 + level * 0.8) * (chosen || !selected ? 1 : 0.8) : 0.16;
            if (reg.level > 0) alpha *= 0.55 + 0.45 * mute;
          } else {
            const f = g.fold[i];
            if (part === 2) {
              level = 0.15 + 0.4 * f;
              color = mixRgb(ink, lead, 0.2);
              alpha = (0.2 + 0.2 * (0.5 + 0.5 * Math.sin(s * 0.7 + x * 5))) * mute;
            } else {
              if (f === 0) { if (g.edge[i]) continue; level = 0.1; } else level = 0.12 + 0.5 * f;
              if (g.edge[i]) level = Math.max(level, 0.78);
              const wave = 0.5 + 0.5 * Math.sin(s * 0.8 - (x * 4.2 + y * 2.6));
              color = cortexRgb;
              alpha = (0.14 + 0.5 * level) * (0.6 + 0.4 * wave * (0.5 + brain.force)) * mute;
              alpha = Math.min(1, alpha + ring * 0.5);
            }
          }
          const k = Math.min(ramp.length - 1, Math.max(p >= 0 && level > 0 ? 1 : 0, Math.floor(level * ramp.length)));
          const glyph = ramp[k];
          if (!glyph.trim()) continue;
          ctx.fillStyle = `rgba(${color},${alpha.toFixed(2)})`;
          ctx.fillText(glyph.length > 1 ? glyph[Math.abs(Math.floor(ph * 1000)) % glyph.length] : glyph, px, py);
        }
      }
    };
    redraw.current = draw;

    const size = () => {
      const r = el.parentElement!.getBoundingClientRect();
      if (!r.width) return;
      w = r.width;
      dpr = Math.min(devicePixelRatio || 1, 2);
      grid.current = lay(w);
      h = w * (BOX_H / BOX_W);
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      el.style.height = `${h}px`;
      palette();
      draw();
    };
    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden || reduced.matches) return;
      if (now - last >= 42) { last = now; draw(); }
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && visible && !document.hidden && !reduced.matches) raf = requestAnimationFrame(frame); };

    const ro = new ResizeObserver(size);
    ro.observe(el.parentElement!);
    const stop = watchView(el, (on) => { visible = on; if (on) kick(); });
    const theme = new MutationObserver(() => { palette(); draw(); });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const dark = matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => { palette(); draw(); };
    dark.addEventListener('change', onScheme);
    reduced.addEventListener('change', kick);
    document.addEventListener('visibilitychange', kick);
    size();
    kick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); stop(); theme.disconnect();
      dark.removeEventListener('change', onScheme);
      reduced.removeEventListener('change', kick);
      document.removeEventListener('visibilitychange', kick);
      redraw.current = undefined;
    };
  }, []);

  useEffect(() => { redraw.current?.(); }, [key]);

  const tap = (ev: PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * BOX_W, y = BOX_Y0 + ((ev.clientY - r.top) / r.height) * BOX_H;
    const part = partAt(x, y);
    if (!part) return;
    ripple.current = { x, y, at: performance.now() };
    const p = part === 'stem' ? CALM : part === 'cortex' ? patchAt(x, y) : -1;
    if (p >= 0) onPick(PATCHES[p].world);
    redraw.current?.();
  };

  return <canvas ref={cv} class="brain-canvas" role="img" aria-label={`${brain.title}. ${brain.sub}`} onPointerDown={tap} />;
}

/** Mood day by day over the 7 weeks, drawn as a brainwave: flat on days nothing was written, a swell up for good days and down for heavy ones. */
function Waves({ days, lead }: { days: Day[]; lead: string | null }) {
  const W = SPAN * 10, H = 70, mid = H / 2;
  const y = (d: Day) => (d.mood === null ? mid : mid - (d.mood / 5) * (mid - 7));
  const path = days.map((d, i) => `${i ? 'L' : 'M'}${(i * 10 + 5).toFixed(1)} ${y(d).toFixed(1)}`).join(' ');
  return (
    <svg class="brain-wave" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={lead ? { '--c': `var(--emo-${lead})` } : undefined}>
      {[...Array(8)].map((_, i) => <line class="bw-week" x1={i * 70} x2={i * 70} y1="0" y2={H} />)}
      <line class="bw-zero" x1="0" x2={W} y1={mid} y2={mid} />
      <path class="bw-line" d={path} />
      {days.map((d, i) => d.mood !== null && <circle class={d.mood >= 0 ? 'bw-dot up' : 'bw-dot down'} cx={i * 10 + 5} cy={y(d)} r="2.2" />)}
    </svg>
  );
}

export function Brain() {
  const entries = useEntries();
  const brain = useMemo(() => readBrain(entries), [entries]);
  const [pick, setPick] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const world = pick ?? brain.lead ?? 'hope-interest';
  const zone = ZONES[world], region = brain.regions[world];
  const notes = more ? brain.notes : brain.notes.slice(0, 3);

  return (
    <section class="section">
      <div class="card brain" style={brain.lead ? { '--c': `var(--emo-${brain.lead})` } : undefined}>
        <div class="brain-head">
          <div class="brain-title">{brain.title}</div>
          <div class="muted small">{brain.sub}</div>
        </div>
        <div class="brain-stage"><BrainCanvas brain={brain} selected={pick ?? brain.lead} onPick={setPick} /></div>

        <div class="brain-zones" role="radiogroup" aria-label={t('Regions')}>
          {PICKER_ORDER.map((id) => (
            <button
              class="brain-zone" style={{ '--c': `var(--emo-${id})`, '--lit': brain.regions[id].level }}
              role="radio" aria-checked={world === id} onClick={() => setPick(id)} title={ZONES[id].name}
            >
              <Sprite core={id} size={14} idle={world === id} />
              <span class="brain-zone-name">{shortName(id)}</span>
              <i class="brain-zone-lit" />
            </button>
          ))}
        </div>

        <div class="brain-detail" style={{ '--c': `var(--emo-${world})` }}>
          <div class="brain-detail-head"><Sprite core={world} size={18} idle /> <b>{zone.name}</b></div>
          <p class="brain-role">{zone.role}</p>
          <p class="brain-line">{regionLine(region)}</p>
        </div>

        <div class="brain-wave-head">
          <span>{t('Brainwaves, 7 weeks')}</span>
          <span class="muted small">{shortDate(brain.days[0].date)} – {t('today')}</span>
        </div>
        <Waves days={brain.days} lead={brain.lead} />
        {brain.arc && (
          <p class="brain-arc muted small">
            {t('Brightest week: from {a}. Heaviest: from {b}.', { a: shortDate(brain.arc.high.start), b: shortDate(brain.arc.low.start) })}
          </p>
        )}

        <div class="brain-stats">
          <div><b>{brain.activeDays}<span class="muted"> / {SPAN}</span></b><span class="muted small">{t('days awake')}</span></div>
          <div><b>{brain.named}</b><span class="muted small">{t('exact feelings')}</span></div>
          <div><b>{brain.longestRun}</b><span class="muted small">{t('day streak')}</span></div>
        </div>

        {notes.length > 0 && (
          <div class="brain-notes">
            {notes.map((n) => (
              <div class="brain-note" key={n.id} style={n.core ? { '--c': `var(--emo-${n.core})` } : undefined}>
                <b>{n.title}</b>
                <p>{n.text}</p>
              </div>
            ))}
            {brain.notes.length > 3 && (
              <button class="btn btn-quiet brain-more" onClick={() => setMore(!more)}>
                {more ? t('Show fewer') : t('Show {n} more', { n: brain.notes.length - 3 })}
              </button>
            )}
          </div>
        )}
        <p class="brain-foot muted small">
          {t('Newer days glow brighter and older ones fade, the way memories do. A playful mirror of your journal, not a diagnosis. Based on {entries}.', { entries: count(brain.entries, 'entry', 'entries') })}
        </p>
      </div>
    </section>
  );
}
