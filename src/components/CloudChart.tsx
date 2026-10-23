// Data drawn the way the journal draws its sky (Sky.tsx): every value is a soft puff of its world's colour, painted
// small and stretched up so it stays soft, and over it a grid of that world's letters that thicken where the clouds
// are and thin to dust between. The clouds roll in from the left, then breathe and drift a little while on screen.
// What has to be read exactly (lines, labels, the marks you hover) is drawn over them in SVG by the caller.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useWidth } from './charts';
import { RAMPS } from './ramps';

export interface Puff {
  /** where, in px from the chart's top left */
  x: number;
  y: number;
  /** radius in px */
  r: number;
  world: string;
}

/** Seconds the clouds take to roll in, first to last; a mark drawn over one can wait as long (see rollDelay). */
export const ROLL = 0.8;
/** When a cloud at x appears, among clouds at xs, so what sits on it can arrive with it. */
export const rollDelay = (x: number, xs: number[]) => {
  const lo = Math.min(...xs), hi = Math.max(...xs);
  return hi > lo ? ((x - lo) / (hi - lo)) * ROLL : 0;
};

const SCALE = 4;      // the cloud canvas is drawn at 1/4 size
const SPRITE = 64;    // a soft puff, painted once per world and stamped for every value
const LUT_N = 256;
const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';

type RGB = [number, number, number];
const WHITE: RGB = [255, 255, 255];
const hex = (s: string): RGB => {
  const m = s.trim().match(/^#?([0-9a-f]{6})$/i);
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const hash = (n: number) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

function blob(col: RGB, stops: [number, number][]) {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE;
  const g = c.getContext('2d')!;
  const half = SPRITE / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);
  for (const [at, a] of stops) grad.addColorStop(at, rgba(col, a));
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE, SPRITE);
  return c;
}

/**
 * puffs: given the chart's width, the clouds to draw, in px: the caller lays them out with what it draws over them.
 * hot: x in px where the pointer is: the letters there light up.
 * children: what is drawn over the clouds, given the chart's width.
 */
export function CloudChart({ puffs: make, height, hot = null, children }: {
  puffs: (w: number) => Puff[];
  height: number;
  hot?: number | null;
  children?: (w: number) => ComponentChildren;
}) {
  const [ref, W] = useWidth();
  const cloudRef = useRef<HTMLCanvasElement>(null);
  const glyphRef = useRef<HTMLCanvasElement>(null);
  const live = useRef<{ hot: number | null; redraw?: () => void }>({ hot });
  live.current.hot = hot;
  const puffs = W ? make(W) : [];
  const key = puffs.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.r.toFixed(3)},${p.world}`).join('|');

  useEffect(() => {
    const cv = cloudRef.current, gv = glyphRef.current;
    const cctx = cv?.getContext('2d'), gctx = gv?.getContext('2d');
    if (!W || !cv || !gv || !cctx || !gctx) return;
    const w = W, h = height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.ceil(w / SCALE); cv.height = Math.ceil(h / SCALE);
    gv.width = Math.round(w * dpr); gv.height = Math.round(h * dpr);
    const sp = w < 480 ? 12 : 14, font = w < 480 ? 10 : 11;

    const worlds = [...new Set(puffs.map((p) => p.world))];
    // they roll in left to right, from the first to the last, however much of the plot they fill
    const xs = puffs.map((p) => p.x);
    const P = puffs.map((p, i) => ({
      x: p.x, y: p.y, r: p.r, w: worlds.indexOf(p.world),
      at: rollDelay(p.x, xs), phase: hash(i + 1) * Math.PI * 2, rate: 0.3 + hash(i + 9) * 0.35,
    }));
    const now = new Float32Array(P.length * 3);

    // the letter grid, every other row nudged like the sky's, each cell with its own slow phase
    const cols = Math.ceil(w / sp) + 1, rows = Math.ceil(h / sp) + 1, n = cols * rows;
    const cx = new Float32Array(n), cy = new Float32Array(n), p1 = new Float32Array(n), p2 = new Float32Array(n);
    for (let row = 0, c = 0; row < rows; row++)
      for (let col = 0; col < cols; col++, c++) {
        cx[c] = col * sp + (row % 2) * (sp / 3);
        cy[c] = row * sp + sp / 2;
        p1[c] = hash(c * 1.7) * Math.PI * 2;
        p2[c] = hash(c * 3.1 + 5) * Math.PI * 2;
      }
    const clear = new Float32Array(n), best = new Float32Array(n), owner = new Int16Array(n);
    const lut = new Float32Array(LUT_N + 1);

    let dark = false, norm = 1.6, sprites: HTMLCanvasElement[] = [], tile = 0;
    let glyphIdx: number[][][] = [];
    const atlas = document.createElement('canvas');
    const palette = () => {
      const css = getComputedStyle(gv);
      dark = document.documentElement.dataset.theme === 'dark';
      const ink = hex(css.getPropertyValue('--ink')), surface = hex(css.getPropertyValue('--surface'));
      const raw = worlds.map((x) => hex(css.getPropertyValue(`--emo-${x}`)));
      const body = dark ? [0.5, 0.22] : [0.62, 0.28];
      norm = 1 / (dark ? 0.55 : 0.65);
      for (let k = 0; k <= LUT_N; k++) {
        const t = Math.sqrt(k / LUT_N);
        lut[k] = t < 0.55 ? body[0] + (body[1] - body[0]) * (t / 0.55) : body[1] * (1 - (t - 0.55) / 0.45);
      }
      // pastel in the light, deep glows in the dark, like the sky
      sprites = raw.map((c) => blob(dark ? mix(c, surface, 0.3) : mix(c, WHITE, 0.45), [[0, body[0]], [0.55, body[1]], [1, 0]]));
      const letter = raw.map((c) => rgba(dark ? mix(c, WHITE, 0.3) : mix(c, ink, 0.45), 1));
      const glyphs: string[] = [];
      glyphIdx = worlds.map((x) => (RAMPS[x] ?? RAMPS.default).map((level) =>
        level.trim() === '' ? [] : [...level].map((ch) => (glyphs.includes(ch) ? glyphs.indexOf(ch) : glyphs.push(ch) - 1)),
      ));
      tile = Math.ceil(font * 1.6 * dpr);
      atlas.width = Math.max(1, glyphs.length * tile);
      atlas.height = Math.max(1, worlds.length * tile);
      const a = atlas.getContext('2d')!;
      a.font = `${font * dpr}px ${FONT}`;
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      letter.forEach((col, wi) => {
        a.fillStyle = col;
        glyphs.forEach((ch, gi) => a.fillText(ch, gi * tile + tile / 2, wi * tile + tile / 2));
      });
    };

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (s: number) => {
      // where each puff is now: rolling in from the left at first, then breathing
      for (let i = 0, k = 0; i < P.length; i++, k += 3) {
        const p = P[i];
        const g = reduced.matches ? 1 : 1 - (1 - clamp((s - p.at) / 0.9, 0, 1)) ** 3;
        now[k] = p.x + Math.sin(s * p.rate * 0.7 + p.phase) * 2;
        now[k + 1] = p.y + Math.cos(s * p.rate * 0.6 + p.phase * 1.3) * 1.5;
        now[k + 2] = p.r * g * (1 + 0.07 * Math.sin(s * p.rate + p.phase));
      }

      cctx.setTransform(1 / SCALE, 0, 0, 1 / SCALE, 0, 0);
      cctx.clearRect(0, 0, w, h);
      for (let i = 0, k = 0; i < P.length; i++, k += 3) {
        const r = now[k + 2];
        if (r > 0.5) cctx.drawImage(sprites[P[i].w], now[k] - r, now[k + 1] - r, r * 2, r * 2);
      }

      // how covered each letter cell is, and whose cloud covers it most
      clear.fill(1);
      best.fill(0);
      owner.fill(-1);
      for (let i = 0, k = 0; i < P.length; i++, k += 3) {
        const px = now[k], py = now[k + 1], r = now[k + 2];
        if (r < 0.5) continue;
        const inv = 1 / (r * r);
        const r0 = Math.max(0, Math.ceil((py - r - sp / 2) / sp)), r1 = Math.min(rows - 1, Math.floor((py + r - sp / 2) / sp));
        for (let row = r0; row <= r1; row++) {
          const shift = (row % 2) * (sp / 3);
          const c0 = Math.max(0, Math.ceil((px - r - shift) / sp)), c1 = Math.min(cols - 1, Math.floor((px + r - shift) / sp));
          const dy = row * sp + sp / 2 - py;
          for (let col = c0; col <= c1; col++) {
            const dx = col * sp + shift - px;
            const u = (dx * dx + dy * dy) * inv;
            if (u >= 1) continue;
            const c = row * cols + col, v = lut[(u * LUT_N) | 0];
            clear[c] *= 1 - v;
            if (v > best[c]) { best[c] = v; owner[c] = P[i].w; }
          }
        }
      }

      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.clearRect(0, 0, gv.width, gv.height);
      gctx.imageSmoothingEnabled = false;
      const hx = live.current.hot;
      const t = s * 1.1, half = tile / 2;
      for (let row = 0, c = 0; row < rows; row++)
        for (let col = 0; col < cols; col++, c++) {
          const o = owner[c];
          if (o < 0) continue;
          const cover = Math.min(1, (1 - clear[c]) * norm);
          const wave = (Math.sin(t + p1[c]) + Math.sin(t * 0.8 + p2[c]) + 2) / 4;
          const near = hx === null ? 0 : Math.max(0, 1 - Math.abs(cx[c] - hx) / 22);
          const ramp = glyphIdx[o], top = ramp.length - 1;
          const i = Math.min(top, Math.max(0, Math.floor((cover * 0.85 + wave * 0.25 - 0.12 + near * 0.25) * top)));
          const variants = ramp[i];
          if (!i || !variants.length) continue;
          const glyph = variants[variants.length === 1 ? 0 : (col * 3 + row * 5) % variants.length];
          gctx.globalAlpha = Math.min(0.9, 0.1 + cover * 0.5 + (i / top) * 0.15 + near * 0.35) * (dark ? 0.9 : 1);
          const x = cx[c] + Math.sin(t * 0.9 + p2[c]) * 0.8, y = cy[c] + Math.cos(t * 0.7 + p1[c]) * 0.8;
          gctx.drawImage(atlas, glyph * tile, o * tile, tile, tile, Math.round(x * dpr - half), Math.round(y * dpr - half), tile, tile);
        }
      gctx.globalAlpha = 1;
    };

    // ~30 frames a second while the clouds roll in, then a slow ~12 while they drift
    let raf = 0, last = 0, clock = 0, visible = false;
    const frame = (stamp: number) => {
      raf = 0;
      if (last && stamp - last < (clock < 2500 ? 30 : 80)) return schedule();
      clock += last ? Math.min(100, stamp - last) : 16;
      last = stamp;
      draw(clock / 1000);
      schedule();
    };
    const schedule = () => {
      if (!raf && visible && !document.hidden && !reduced.matches) raf = requestAnimationFrame(frame);
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; last = 0; };
    const still = () => draw(reduced.matches ? 4 : clock / 1000);
    live.current.redraw = () => { if (!raf) still(); };

    const host = ref.current!;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? schedule() : stop(); });
    const mo = new MutationObserver(() => { palette(); still(); });
    const onVisibility = () => (document.hidden ? stop() : schedule());
    const onMotion = () => (reduced.matches ? (stop(), still()) : schedule());
    palette();
    still();
    io.observe(host);
    mo.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', onMotion);
    return () => {
      stop();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotion);
      live.current.redraw = undefined;
    };
  }, [W, height, key]);

  // a hover with the clouds standing still (reduced motion, or between frames) still lights the letters
  useEffect(() => live.current.redraw?.(), [hot]);

  return (
    <div ref={ref} class="cloud-chart" style={{ height: `${height}px` }}>
      <canvas ref={cloudRef} class="cc-clouds" aria-hidden="true" />
      <canvas ref={glyphRef} class="cc-letters" aria-hidden="true" />
      {W > 0 && children && <svg class="cc-over" width={W} height={height}>{children(W)}</svg>}
    </div>
  );
}
