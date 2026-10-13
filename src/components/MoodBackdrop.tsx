// The page's background takes the world of your latest mood: a faint field of letters behind everything.
// Joy is a warm glow with sparkles, calm a swell of ≈ waves, sadness a light rain of ' and ., anger rising
// embers, and so on. Each world is a small function that says how strong the field is at a spot; the
// letters come from the same ramps as the journal's sky. When the mood changes, the old world fades out
// and the new one fades in.
import { useEffect, useRef } from 'preact/hooks';
import { RAMPS } from './Sky';

const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const FRAME = 33;      // ~30fps is plenty for a slow, faint field
const FADE_OUT = 350;  // ms
const FADE_IN = 900;

type RGB = [number, number, number];
interface Grid {
  w: number; h: number; sp: number; cols: number; rows: number;
  rnd: Float32Array; // three fixed random numbers per cell
  calm: Float32Array; // per column: how much to hush it, so the middle (where the page's text is) stays quieter
}
/** Strength 0…1 at a cell's centre (x, y); fields may also set `shake`. */
type Field = (g: Grid, i: number, c: number, r: number, x: number, y: number, t: number) => number;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fract = (v: number) => v - Math.floor(v);
const hash = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const smooth = (a: number, b: number, v: number) => {
  const x = clamp((v - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lattice = (i: number, j: number) => hash(i * 57.3 + j * 113.9);
/** Smooth value noise, 0…1. */
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(lattice(xi, yi), lattice(xi + 1, yi), u), lerp(lattice(xi, yi + 1), lattice(xi + 1, yi + 1), u), v);
}

function hex(s: string): RGB {
  const m = s.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;

/** A letter's sideways and downward tremble this frame, for the fields that shiver. */
const shake = { x: 0, y: 0 };

const FIELDS: Record<string, Field> = {
  // a low sun in the corner, rays turning slowly, and a few letters that twinkle
  joy(g, i, _c, _r, x, y, t) {
    const dx = x - g.w * 0.08, dy = y + g.h * 0.05;
    const d = Math.hypot(dx, dy) / (Math.max(g.w, g.h) * 0.85);
    const glow = Math.max(0, 1 - d) ** 1.6 * (0.85 + 0.15 * Math.sin(t * 0.6));
    const ray = 0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 9 + t * 0.35);
    let twinkle = 0;
    if (g.rnd[i * 3] > 0.86) twinkle = Math.max(0, Math.sin(t * (0.8 + g.rnd[i * 3 + 1] * 1.4) + g.rnd[i * 3 + 2] * 6.283)) ** 10 * 0.8;
    return Math.max(glow * (0.35 + 0.65 * ray) * 0.85, twinkle);
  },
  // upward drifts, brightest toward the top, like the first light
  'hope-interest'(g, _i, _c, _r, x, y, t) {
    const n = noise(x * 0.008, y * 0.01 + t * 0.28) * 0.65 + noise(x * 0.02 + 9, y * 0.022 + t * 0.5) * 0.35;
    return smooth(0.35, 0.95, n) * (0.35 + 0.65 * (1 - y / g.h));
  },
  // two soft glows that wander and pulse like a heartbeat
  'love-connection'(g, _i, _c, _r, x, y, t) {
    const m = Math.max(g.w, g.h);
    const beat = 1 + 0.1 * Math.max(0, Math.sin(t * 1.7)) ** 3;
    const d1 = Math.hypot(x - g.w * (0.28 + 0.1 * Math.sin(t * 0.11)), y - g.h * (0.32 + 0.1 * Math.cos(t * 0.13))) / (m * 0.3 * beat);
    const d2 = Math.hypot(x - g.w * (0.72 + 0.08 * Math.cos(t * 0.09)), y - g.h * (0.7 + 0.08 * Math.sin(t * 0.12))) / (m * 0.3 * beat);
    const ring = 0.8 + 0.2 * Math.sin(Math.min(d1, d2) * 5 - t * 1.3);
    return clamp(Math.exp(-d1 * d1 * 1.6) + Math.exp(-d2 * d2 * 1.6), 0, 1) * ring * 0.85;
  },
  // a slow swell of waves, deeper toward the bottom
  'calm-safety'(g, _i, _c, r, x, y, t) {
    const sea = 0.35 + 0.65 * (y / g.h);
    const swell = 0.6 + 0.4 * Math.sin(r * 0.33 - t * 0.22);
    const v = Math.sin(x * 0.011 + t * 0.5 + Math.sin(r * 0.55 + t * 0.17) * 1.6);
    return clamp(0.5 + 0.4 * v * swell, 0, 1) * sea;
  },
  // a light rain: thin slanted drops with short tails
  sadness(g, _i, c, r, _x, _y, t) {
    const col = c + Math.floor(r * 0.18);
    let level = 0;
    for (let k = 0; k < 2; k++) {
      const key = col * 2 + k;
      if (hash(key * 1.7 + 0.3) > 0.3) continue;
      const speed = 7 + hash(key + 5.5) * 9;
      const trail = 5 + hash(key + 9.1) * 7;
      const span = g.rows + trail + 6 + hash(key + 2.2) * 14;
      const behind = ((t * speed + hash(key + 7.7) * span) % span) - r;
      if (behind >= 0 && behind < trail) level = Math.max(level, (1 - behind / trail) ** 1.6 * 0.5);
    }
    return level;
  },
  // patches of unease that jump and tremble
  fear(g, i, _c, _r, x, y, t) {
    const step = Math.floor(t * 2.2);
    const s = smooth(0.7, 1, fract(t * 2.2));
    const a = noise(x * 0.014 + step * 5.3, y * 0.014 + step * 2.9);
    const b = s > 0 ? noise(x * 0.014 + (step + 1) * 5.3, y * 0.014 + (step + 1) * 2.9) : a;
    const v = smooth(0.55, 0.88, lerp(a, b, s)) * 0.9;
    if (v > 0) {
      shake.x = Math.sin(t * 11 + g.rnd[i * 3 + 2] * 40) * 1.4;
      shake.y = Math.cos(t * 9 + g.rnd[i * 3 + 1] * 40) * 1.4;
    }
    return v;
  },
  // embers rising from the bottom, flickering hot
  anger(g, i, _c, _r, x, y, t) {
    const heat = (y / g.h) ** 2;
    const n = noise(x * 0.018, y * 0.03 - t * 1.5) * 0.7 + noise(x * 0.05 + 3, y * 0.07 - t * 3.1) * 0.3;
    const flick = hash(i + Math.floor(t * 7) * 0.37) * 0.12;
    return clamp(heat * (0.2 + 1.1 * n) - 0.08 + flick * heat, 0, 0.88);
  },
  // brackets closing in from the edges, breathing slowly
  'shame-aversion'(g, _i, _c, _r, x, y, t) {
    const d = Math.hypot((x - g.w / 2) / g.w, (y - g.h / 2) / g.h);
    const edge = smooth(0.32 - 0.05 * Math.sin(t * 0.3), 0.7, d);
    return edge * (0.75 + 0.25 * noise(x * 0.02, y * 0.02 + t * 0.1)) * 0.9;
  },
};

/** `world`: the emotion world to show (a core id), `strength`: 0…1, how strong the feeling was. */
export function MoodBackdrop({ world, strength }: { world: string; strength: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ world, strength });
  const poke = useRef<() => void>();
  latest.current = { world, strength };
  useEffect(() => poke.current?.(), [world, strength]);

  useEffect(() => {
    const canvas = cv.current!;
    const ctx = canvas.getContext('2d')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const atlas = document.createElement('canvas');
    let g: Grid | null = null;
    let dpr = 1, font = 12, tile = 0;
    let shown: string | null = null, fade = 0;
    let dark = false, color: RGB = [128, 128, 128];
    let glyphs: string[] = [];
    let ramp = RAMPS.default;
    let glyphIdx: number[][] = [];
    let atlasDirty = true;
    let raf = 0, last = 0, clock = 0;

    /** Colours and letters of the world on show. */
    const tune = () => {
      if (!shown) return;
      const css = getComputedStyle(document.documentElement);
      const v = (name: string) => hex(css.getPropertyValue(name));
      dark = document.documentElement.dataset.theme === 'dark';
      color = mix(v(`--emo-${shown}`), v('--ink'), dark ? 0.2 : 0.35);
      ramp = RAMPS[shown] ?? RAMPS.default;
      glyphs = [];
      glyphIdx = ramp.map((level) =>
        level.trim() === '' ? [] : [...level].map((ch) => (glyphs.includes(ch) ? glyphs.indexOf(ch) : glyphs.push(ch) - 1)),
      );
      atlasDirty = true;
    };

    const buildAtlas = () => {
      tile = Math.ceil(font * 1.6 * dpr);
      atlas.width = Math.max(1, glyphs.length) * tile;
      atlas.height = tile;
      const a = atlas.getContext('2d')!;
      a.font = `${font * dpr}px ${FONT}`;
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      a.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      glyphs.forEach((ch, gi) => a.fillText(ch, gi * tile + tile / 2, tile / 2));
      atlasDirty = false;
    };

    const layout = () => {
      const w = innerWidth, h = innerHeight;
      const narrow = w < 720;
      const sp = narrow ? 18 : 22;
      font = narrow ? 12 : 14;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const cols = Math.ceil(w / sp) + 1, rows = Math.ceil(h / sp) + 1;
      const rnd = new Float32Array(cols * rows * 3);
      for (let k = 0; k < rnd.length; k++) rnd[k] = hash(k * 0.7311 + 1.3);
      // the page's column sits in the middle: keep the field quieter there
      const half = Math.min(w / 2, 320);
      const calm = new Float32Array(cols);
      for (let c = 0; c < cols; c++) calm[c] = 1 - 0.4 * (1 - smooth(half * 0.6, half * 1.4, Math.abs(c * sp - w / 2)));
      g = { w, h, sp, cols, rows, rnd, calm };
      atlasDirty = true;
    };

    const step = (dt: number) => {
      if (!reduced.matches) clock += dt;
      const want = latest.current.world;
      if (shown !== want) {
        if (shown === null || fade <= 0) {
          shown = want;
          fade = 0;
          tune();
        } else fade = Math.max(0, fade - dt / FADE_OUT);
      }
      if (shown === want) fade = Math.min(1, fade + dt / FADE_IN);
    };

    const draw = () => {
      if (!g) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const field = shown && FIELDS[shown];
      if (!field || fade <= 0) return;
      if (atlasDirty) buildAtlas();
      const { sp, cols, rows, calm } = g;
      const t = clock / 1000;
      const top = ramp.length - 1;
      const half = tile / 2;
      const gain = (dark ? 0.34 : 0.3) * fade * (0.7 + 0.3 * latest.current.strength);
      ctx.imageSmoothingEnabled = false;
      for (let r = 0, i = 0; r < rows; r++) {
        const y = r * sp + sp / 2, shift = (r & 1) * (sp / 3);
        for (let c = 0; c < cols; c++, i++) {
          const x = c * sp + shift;
          shake.x = shake.y = 0;
          const level = field(g, i, c, r, x, y, t);
          const idx = Math.min(top, Math.floor(level * top));
          if (idx <= 0) continue;
          const variants = glyphIdx[idx];
          const glyph = variants[variants.length === 1 ? 0 : (c * 3 + r * 5) % variants.length];
          ctx.globalAlpha = Math.min(0.5, gain * (0.3 + 0.7 * level) * calm[c]);
          ctx.drawImage(atlas, glyph * tile, 0, tile, tile, Math.round((x + shake.x) * dpr - half), Math.round((y + shake.y) * dpr - half), tile, tile);
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? now - last : FRAME;
      if (dt < FRAME - 2) return;
      last = now;
      step(Math.min(dt, 100));
      draw();
    };
    const start = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (!reduced.matches && !document.hidden) raf = requestAnimationFrame(tick);
    };
    /** Still skies (reduced motion) have no loop: jump straight to the new world and paint once. */
    const settle = () => {
      if (!reduced.matches) return;
      step(5000);
      step(5000);
      draw();
    };

    poke.current = settle;
    layout();
    step(0);
    if (reduced.matches) { step(5000); draw(); } else start();

    let size = [innerWidth, innerHeight];
    const onResize = () => {
      // the phone's address bar growing and shrinking is not worth redrawing for
      if (innerWidth === size[0] && Math.abs(innerHeight - size[1]) < 100) return;
      size = [innerWidth, innerHeight];
      layout();
      if (reduced.matches) draw();
    };
    const onTheme = () => {
      tune();
      if (reduced.matches) draw();
    };
    const theme = new MutationObserver(onTheme);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', start);
    reduced.addEventListener('change', start);
    return () => {
      cancelAnimationFrame(raf);
      poke.current = undefined;
      theme.disconnect();
      removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', start);
      reduced.removeEventListener('change', start);
    };
  }, []);

  return <canvas ref={cv} class="mood-bg" aria-hidden="true" />;
}
