// The brain on Stats: a side view drawn in letters, like the sky. Each emotion world lives in its own region and
// moves the way its sprite does (the amygdala flickers, the temporal lobe beats like a heart, the brainstem breathes).
// How brightly a region burns comes from a stretch of the journal (7 or 13 weeks, or all of it, ending today or on any past day:
// slide it back, or press play to watch the brain change); tap a region to read about it.
import { useEffect, useRef } from 'preact/hooks';
import { ZONES, type BrainState } from '../lib/brain';
import { BOX_H, BOX_W, BOX_Y0, PATCHES, folds, grooveDist, partAt, patchAt, pulse } from '../lib/brainShape';
import { watchView } from '../lib/inView';
import { onCovered, pageCovered } from '../lib/covered';
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
/** Every letter the brain draws with, once: its column in the letter atlas. */
const CHARS = [...new Set([PLAIN, ...PATCHES.map((p) => RAMPS[p.world] ?? PLAIN)].flat().join('').replace(/\s/g, ''))];
const COLUMN = new Map(CHARS.map((c, i) => [c, i]));

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

export function BrainCanvas({ brain, selected, onPick }: { brain: BrainState; selected: string | null; onPick: (world: string) => void }) {
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
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, visible = false, ink = [0, 0, 0], colors: Record<string, number[]> = {};
    let regionColors: Record<string, string> = {};
    const t0 = performance.now();
    // every letter in every colour (the cortex, the cerebellum, then each region), painted once; a frame then draws each
    // cell as a small copy at its own opacity instead of setting a colour and laying out text thousands of times
    const atlas = document.createElement('canvas');
    let atlasKey = '', tile = 0;
    let regionRow: Record<string, number> = {};
    const paint = (cortex: string, cerebellum: string, font: number) => {
      const key = `${cortex}|${cerebellum}|${Object.values(regionColors).join('|')}|${font}|${dpr}`;
      if (key === atlasKey) return;
      atlasKey = key;
      const worlds = Object.keys(regionColors);
      regionRow = Object.fromEntries(worlds.map((k, i) => [k, i + 2]));
      const rows = [cortex, cerebellum, ...worlds.map((k) => regionColors[k])];
      tile = Math.ceil(font * dpr * 1.5);
      atlas.width = CHARS.length * tile;
      atlas.height = rows.length * tile;
      const a = atlas.getContext('2d')!;
      a.font = `${font * dpr}px ${FONT}`;
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      rows.forEach((color, r) => {
        a.fillStyle = `rgb(${color})`;
        CHARS.forEach((ch, c) => a.fillText(ch, c * tile + tile / 2, r * tile + tile / 2));
      });
    };

    const palette = () => {
      const css = getComputedStyle(el);
      ink = rgb(css.getPropertyValue('--ink'));
      colors = Object.fromEntries(Object.keys(ZONES).map((k) => [k, rgb(css.getPropertyValue(`--emo-${k}`))]));
      regionColors = Object.fromEntries(Object.entries(colors).map(([k, c]) => [k, c.join(',')]));
    };

    const draw = () => {
      const g = grid.current;
      if (!g) return;
      const { brain, selected } = live.current;
      const now = performance.now();
      const s = reduced.matches ? 2.4 : (now - t0) / 1000;
      const lead = brain.lead ? colors[brain.lead] : ink;
      const cortexRgb = mixRgb(ink, lead, 0.5);
      const cerebellumRgb = mixRgb(ink, lead, 0.2);
      const mute = 0.35 + 0.65 * Math.sqrt(brain.alive);   // a brain with little written in it burns low
      const rp = ripple.current;
      const rr = rp ? (now - rp.at) / 900 : 2;
      if (rp && rr > 1.4) ripple.current = null;

      paint(cortexRgb, cerebellumRgb, g.cw / 0.6);
      const half = tile / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.width, el.height);
      for (let r = 0; r < g.rows; r++) {
        for (let c = 0; c < g.cols; c++) {
          const i = r * g.cols + c;
          const part = g.part[i];
          if (!part) continue;
          const x = g.x[i], y = g.y[i], ph = g.ph[i];
          const px = (c + 0.5) * g.cw, py = (r + 0.5) * g.ch;
          let ramp = PLAIN, level: number, row: number, alpha: number;
          const p = g.patch[i];
          const ring = rp ? Math.max(0, 1 - Math.abs(Math.hypot(x - rp.x, y - rp.y) - rr * 0.7) / 0.07) : 0;
          if (p >= 0) {
            const world = PATCHES[p].world;
            const reg = brain.regions[world];
            ramp = RAMPS[world];
            const beat = reg.level > 0 ? pulse(world, s, ph, x, y) : 0;
            const chosen = world === selected;
            level = reg.level > 0 ? (0.12 + reg.level * (0.28 + 0.6 * beat)) * (0.55 + 0.45 * brain.force + 0.15) : 0.1;
            level = Math.min(1, level + ring * 0.4 + (chosen ? 0.12 : 0));
            row = regionRow[world] ?? 0;
            alpha = reg.level > 0 ? Math.min(1, 0.3 + level * 0.8) * (chosen || !selected ? 1 : 0.8) : 0.16;
            if (reg.level > 0) alpha *= 0.55 + 0.45 * mute;
          } else {
            const f = g.fold[i];
            if (part === 2) {
              level = 0.15 + 0.4 * f;
              row = 1;
              alpha = (0.2 + 0.2 * (0.5 + 0.5 * Math.sin(s * 0.7 + x * 5))) * mute;
            } else {
              if (f === 0) { if (g.edge[i]) continue; level = 0.1; } else level = 0.12 + 0.5 * f;
              if (g.edge[i]) level = Math.max(level, 0.78);
              const wave = 0.5 + 0.5 * Math.sin(s * 0.8 - (x * 4.2 + y * 2.6));
              row = 0;
              alpha = (0.14 + 0.5 * level) * (0.6 + 0.4 * wave * (0.5 + brain.force)) * mute;
              alpha = Math.min(1, alpha + ring * 0.5);
            }
          }
          const k = Math.min(ramp.length - 1, Math.max(p >= 0 && level > 0 ? 1 : 0, Math.floor(level * ramp.length)));
          const glyph = ramp[k];
          if (!glyph.trim()) continue;
          const ch = glyph.length > 1 ? glyph[Math.abs(Math.floor(ph * 1000)) % glyph.length] : glyph;
          ctx.globalAlpha = alpha;
          ctx.drawImage(atlas, (COLUMN.get(ch) ?? 0) * tile, row * tile, tile, tile, Math.round(px * dpr - half), Math.round(py * dpr - half), tile, tile);
        }
      }
      ctx.globalAlpha = 1;
    };
    redraw.current = draw;

    const size = () => {
      const r = el.parentElement!.getBoundingClientRect();
      if (!r.width) return;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      if (r.width === w && ratio === dpr) return;
      w = r.width;
      dpr = ratio;
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
      if (!visible || document.hidden || reduced.matches || pageCovered()) return;
      if (now - last >= 42) { last = now; draw(); }
      raf = requestAnimationFrame(frame);
    };
    const resume = () => {
      const on = visible && !document.hidden && !reduced.matches && !pageCovered();
      if (on) { if (!raf) raf = requestAnimationFrame(frame); }
      else { cancelAnimationFrame(raf); raf = 0; }
    };
    const onMotion = () => { resume(); if (reduced.matches) draw(); };

    const ro = new ResizeObserver(size);
    ro.observe(el.parentElement!);
    const stop = watchView(el, (on) => { visible = on; resume(); });
    const theme = new MutationObserver(() => { palette(); draw(); });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const unCover = onCovered(resume); // holds still under a sheet or the wheel and while a page change slides
    const dark = matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => { palette(); draw(); };
    dark.addEventListener('change', onScheme);
    reduced.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', resume);
    size();
    resume();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); stop(); theme.disconnect(); unCover();
      dark.removeEventListener('change', onScheme);
      reduced.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', resume);
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
