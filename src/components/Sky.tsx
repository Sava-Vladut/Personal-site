// The journal's sky: two layers of soft clouds drifting behind the top panel, partly drawn in letters.
// A far layer of small, faint clouds and finer letters sits behind a near layer of larger, faster
// ones that lean harder toward a finger or cursor. Each layer is two stacked canvases: the clouds,
// painted small and stretched up by CSS so they stay soft, and the letters, which thicken where the
// clouds are and thin to dust between. Clouds breathe, stretch and pinch as they drift, and a low sun
// from the upper left lights their edges. Each emotion world has its own letter ramp. The sky can take
// one world (the journal) or a mix (the mind page, where each cloud belongs to someone you think about),
// and changes colour in place when they change, without the clouds starting over.
import { useEffect, useRef } from 'preact/hooks';

const SCALE = 4; // cloud canvases are drawn at 1/4 size
const SPRITE = 64; // a soft puff, painted once per colour and stamped for every puff
const LUT_N = 256;
const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const MIN_FRAME = 15; // never step faster than ~60fps, even on 120Hz screens

/** Letters from empty to dense. A level with several characters picks one per cell, for texture. */
const RAMPS: Record<string, string[]> = {
  default: [' ', '.', ':', '+', '*', 'o', 'O', '#'],
  joy: [' ', '·', '.', '+', '*', 'o', 'O', '@'],
  'hope-interest': [' ', '.', ':', '^', '*', '+', 'x', 'X'],
  'love-connection': [' ', '.', ':', 'o', 'O', '0', '8', '@'],
  'calm-safety': [' ', '.', '-', '~', '=', '≈', '≡'],
  sadness: [' ', '.', ',', "'", ':', ';', '!', '|'],
  fear: [' ', '.', "'", '/\\', 'x', 'X', '%'],
  anger: [' ', '.', ':', '+', '%', '#', '@', 'M'],
  'shame-aversion': [' ', '.', ':', '-', '()', '[]', '{}'],
  // the media page: a sky of pages, and one of notes
  books: [' ', '.', ',', ';', 'ilt', 'aeo', 'bdhk', '¶§'],
  music: [' ', '.', '·', '-', '♩', '♪', '♫', '♬'],
};

/** The world a sky leans toward; the second colour keeps it from going flat. */
const COMPANION: Record<string, string> = {
  joy: 'hope-interest',
  'hope-interest': 'love-connection',
  'love-connection': 'fear',
  'calm-safety': 'sadness',
  sadness: 'fear',
  fear: 'sadness',
  anger: 'hope-interest',
  'shame-aversion': 'calm-safety',
};
const DAWN = ['hope-interest', 'love-connection', 'sadness'];

type RGB = [number, number, number];
interface Puff { dx: number; dy: number; r: number; u: number; phase: number; rate: number }
interface Cloud {
  x: number; y: number; speed: number; tone: number; puffs: Puff[]; span: number;
  spreadPhase: number; spreadRate: number;
}

/** What tells the two layers apart. */
interface Spec {
  seed: number;
  size: [number, number];   // cloud size range
  perPx: number;            // one cloud per this many px of width
  minCount: number;
  speed: [number, number];  // px per second
  yFrom: number; yRange: number;
  toneShift: number;        // far clouds lean toward the second colour
  haze: number;             // how far the layer fades toward the background
  fill: number;             // opacity of the clouds
  ink: number;              // opacity of the letters
  spacing: [number, number]; // letter grid, small screen / large
  font: [number, number];
  res: number;              // sharpest the letters are drawn, in pixels per px: faint far letters can be softer
  pull: number;             // how strongly the pointer moves this layer
  reach: number;
  waveRate: number;
  /** Shortest time between redraws (ms) while a finger is on the sky, and while it is left alone. */
  active: number; idle: number;
}
const FAR: Spec = {
  seed: 23, size: [0.42, 0.7], perPx: 115, minCount: 4, speed: [2, 4.5], yFrom: 0.06, yRange: 0.84,
  toneShift: 1, haze: 0.3, fill: 0.65, ink: 0.85, spacing: [11, 13], font: [8, 9], res: 1.5, pull: 0.3, reach: 0.75,
  waveRate: 0.55, active: 48, idle: 64,
};
const NEAR: Spec = {
  seed: 7, size: [0.85, 1.45], perPx: 210, minCount: 3, speed: [7, 15], yFrom: 0.14, yRange: 0.62,
  toneShift: 0, haze: 0, fill: 1, ink: 1, spacing: [17, 21], font: [12, 13], res: 2, pull: 1.4, reach: 1.15,
  waveRate: 1, active: 16, idle: 30,
};
/** If the screen can't keep up, layers redraw this much less often. */
const EASE = [1, 1.7, 2.6];

interface Layer {
  spec: Spec;
  cloudCv: HTMLCanvasElement; cloudCtx: CanvasRenderingContext2D;
  glyphCv: HTMLCanvasElement; glyphCtx: CanvasRenderingContext2D;
  clouds: Cloud[]; maxSpan: number;
  now: Float32Array; // x, y, r of every puff, this frame
  tones: RGB[]; shadow: RGB[]; light: RGB[]; shades: string[];
  sprites: HTMLCanvasElement[][]; // per tone: body, shade, light
  atlas: HTMLCanvasElement; tile: number; atlasDirty: boolean;
  spacing: number; font: number; dpr: number; cols: number; rows: number;
  cells: Float32Array; // per letter cell: x, y, then sine and cosine of four fixed phases
  dens: Float32Array; dens2: Float32Array; // how clear the sky is at each cell, and a step toward the sun
  drawn: number;
}

// the sun: low, from the upper left
const SUN = { x: -0.55, y: -0.83 };
const SUN_PX = { x: -8, y: -12 };
const WARM: RGB = [255, 200, 120];
const SHADES = 9;       // colours between shaded and sunlit
const SHADE_LOW = -0.6; // the lowest light value: a little shaded, never black
const STRIDE = 10;

function hex(s: string): RGB {
  const m = s.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// a small seeded random, so the same sky comes back on every visit
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const spanOf = (size: number) => 210 * size + 40;

function makeClouds(spec: Spec, w: number, h: number, tones: number): { clouds: Cloud[]; maxSpan: number } {
  const rand = rng(spec.seed);
  const n = Math.max(spec.minCount, Math.round(w / spec.perPx));
  const maxSpan = spanOf(spec.size[1]);
  const clouds = Array.from({ length: n }, (_, i) => {
    const size = spec.size[0] + rand() * (spec.size[1] - spec.size[0]);
    const count = 4 + Math.floor(rand() * 4);
    const puffs: Puff[] = [];
    for (let k = 0; k < count; k++) {
      const u = count === 1 ? 0 : k / (count - 1) - 0.5; // -0.5 … 0.5 along the cloud
      puffs.push({
        dx: u * 150 * size + (rand() - 0.5) * 24 * size,
        dy: -(1 - Math.abs(u) * 1.6) * 26 * size - rand() * 10 * size, // taller in the middle, flat underneath
        r: (38 + (1 - Math.abs(u)) * 34 + rand() * 14) * size,
        u,
        phase: rand() * Math.PI * 2,
        rate: 0.25 + rand() * 0.35, // a breath every 10–25 seconds
      });
    }
    return {
      x: ((i + rand() * 0.6) / n) * (w + maxSpan * 2) - maxSpan,
      y: h * (spec.yFrom + rand() * spec.yRange),
      speed: spec.speed[0] + rand() * (spec.speed[1] - spec.speed[0]),
      tone: (i + spec.toneShift) % tones,
      puffs,
      span: spanOf(size),
      spreadPhase: rand() * Math.PI * 2,
      spreadRate: 0.08 + rand() * 0.08, // stretches apart and gathers back over 40–80 seconds
    };
  });
  return { clouds, maxSpan };
}

/** Writes where a puff is and how big, right now, into out[k…]: it breathes, and its cloud slowly stretches and pinches. */
function puffNow(out: Float32Array, k: number, c: Cloud, p: Puff, s: number) {
  const spread = 1 + 0.4 * Math.sin(s * c.spreadRate + c.spreadPhase);
  const pinch = clamp((spread - 1) / 0.4, 0, 1) * 0.3 * (1 - Math.abs(p.u) * 2); // the middle thins as it stretches
  const breath = 1 + 0.13 * Math.sin(s * p.rate + p.phase);
  out[k] = c.x + p.dx * spread + Math.sin(s * p.rate * 0.7 + p.phase * 1.7) * 3;
  out[k + 1] = c.y + p.dy * (0.9 + 0.1 * breath) + Math.sin(s * p.rate + p.phase * 0.6) * 2;
  out[k + 2] = p.r * breath * (1 - pinch);
}

/** One soft round puff, painted once so it can be stamped instead of drawn as a gradient every frame. */
function blob(col: RGB, stops: [number, number][], radius: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE;
  const g = c.getContext('2d')!;
  const half = SPRITE / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half * radius);
  for (const [at, a] of stops) grad.addColorStop(at, rgba(col, a));
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE, SPRITE);
  return c;
}

/**
 * worlds: the emotion worlds the clouds take their colours from, in order of how much sky each gets.
 * letters: a ramp of its own (RAMPS) instead of the world's.
 */
export function Sky({ world, worlds, letters }: { world?: string | null; worlds?: string[]; letters?: string }) {
  const els = useRef<(HTMLCanvasElement | null)[]>([]);
  const latest = useRef({ world, worlds, letters });
  const retune = useRef<() => void>();
  const applied = useRef('');
  latest.current = { world, worlds, letters };
  const key = `${world ?? ''}|${(worlds ?? []).join()}|${letters ?? ''}`;

  useEffect(() => {
    const [farCloud, farGlyph, nearCloud, nearGlyph] = els.current as HTMLCanvasElement[];
    const host = nearGlyph.parentElement!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const darkQuery = matchMedia('(prefers-color-scheme: dark)');
    let ramp = RAMPS.default;
    let glyphs: string[] = [];
    let glyphIdx: number[][] = [];
    // every character the ramp uses, once, and which of them each density level picks from
    const tuneRamp = () => {
      ramp = RAMPS[latest.current.letters ?? latest.current.world ?? ''] ?? RAMPS.default;
      glyphs = [];
      glyphIdx = ramp.map((level) =>
        level.trim() === '' ? [] : [...level].map((ch) => (glyphs.includes(ch) ? glyphs.indexOf(ch) : glyphs.push(ch) - 1)),
      );
    };

    const layer = (spec: Spec, cloudCv: HTMLCanvasElement, glyphCv: HTMLCanvasElement): Layer => {
      if (spec.fill < 1) cloudCv.style.opacity = String(spec.fill);
      return {
        spec, cloudCv, glyphCv,
        cloudCtx: cloudCv.getContext('2d')!, glyphCtx: glyphCv.getContext('2d')!,
        clouds: [], maxSpan: spanOf(spec.size[1]), now: new Float32Array(0),
        tones: [], shadow: [], light: [], shades: [], sprites: [],
        atlas: document.createElement('canvas'), tile: 0, atlasDirty: true,
        spacing: 18, font: 12, dpr: 1, cols: 0, rows: 0,
        cells: new Float32Array(0), dens: new Float32Array(0), dens2: new Float32Array(0), drawn: 0,
      };
    };
    const layers = [layer(FAR, farCloud, farGlyph), layer(NEAR, nearCloud, nearGlyph)]; // far first, so the near clouds pass in front

    let w = 0, h = 0;
    let dark = false, norm = 1 / 0.62;
    const lut = new Float32Array(LUT_N + 1); // how solid a puff is, by squared distance from its centre
    let raf = 0, visible = true, last = 0, clock = 0;
    let rect: DOMRect | null = null;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, pull: 0, target: 0 };

    // if frames keep arriving late, the layers ease off
    let ease = 0, late = 0, frameMs = 0, calm = 0, eased = 0, strikes = 0;
    const seen: number[] = [];

    const palette = () => {
      tuneRamp();
      const { world, worlds } = latest.current;
      const css = getComputedStyle(host);
      const v = (name: string) => hex(css.getPropertyValue(name));
      dark = document.documentElement.dataset.theme === 'dark';
      norm = 1 / (dark ? 0.5 : 0.62);
      const ink = v('--ink'), surface = v('--surface');
      const named = worlds?.length ? worlds : world ? [world, COMPANION[world] ?? 'sadness', world] : DAWN;
      const raw = named.map((c) => v(`--emo-${c}`));
      const accent = raw[0];
      const glyph = mix(accent, ink, dark ? 0.55 : 0.6);
      // the lit side glows warm; the shaded side just quiets down
      const sun = dark
        ? mix(mix(accent, WARM, 0.35), [255, 255, 255], 0.5)
        : mix(mix(accent, WARM, 0.4), [0, 0, 0], 0.12);
      const body = dark ? [0.42, 0.2] : [0.6, 0.3];
      for (let k = 0; k <= LUT_N; k++) {
        const t = Math.sqrt(k / LUT_N);
        lut[k] = t < 0.55 ? body[0] + (body[1] - body[0]) * (t / 0.55) : body[1] * (1 - (t - 0.55) / 0.45);
      }
      for (const L of layers) {
        const haze = L.spec.haze;
        // pastel in the light, deep glows in the dark; the far layer fades toward the background
        const tones = raw.map((c) => (dark ? mix(c, surface, 0.35) : mix(c, [255, 255, 255], 0.5)));
        L.tones = tones.map((c) => mix(c, surface, haze));
        L.shadow = L.tones.map((c) => (dark ? mix(c, [0, 0, 0], 0.4) : mix(c, [60, 70, 120], 0.3)));
        L.light = L.tones.map((c) => (dark ? mix(c, [255, 255, 255], 0.3) : mix(c, [255, 246, 225], 0.65)));
        L.sprites = L.tones.map((tone, i) => [
          blob(tone, [[0, body[0]], [0.55, body[1]], [1, 0]], 1),
          blob(L.shadow[i], [[0, dark ? 0.32 : 0.26], [1, 0]], 0.75),
          blob(L.light[i], [[0, dark ? 0.4 : 0.6], [1, 0]], 0.75),
        ]);
        const g = mix(glyph, surface, haze * 0.75);
        const quiet = mix(g, surface, 0.4);
        L.shades = Array.from({ length: SHADES }, (_, j) => {
          const l = SHADE_LOW + ((1 - SHADE_LOW) * j) / (SHADES - 1);
          return rgba(l < 0 ? mix(g, quiet, l / SHADE_LOW) : mix(g, sun, l), 1);
        });
        L.atlasDirty = true;
        L.clouds.forEach((c, i) => (c.tone = (i + L.spec.toneShift) % tones.length));
      }
    };

    /** Every letter in every shade, painted once; drawing a letter is then a small copy. */
    const buildAtlas = (L: Layer) => {
      const tile = (L.tile = Math.ceil(L.font * 1.6 * L.dpr));
      L.atlas.width = glyphs.length * tile;
      L.atlas.height = SHADES * tile;
      const a = L.atlas.getContext('2d')!;
      a.font = `${L.font * L.dpr}px ${FONT}`;
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      L.shades.forEach((shade, si) => {
        a.fillStyle = shade;
        glyphs.forEach((ch, gi) => a.fillText(ch, gi * tile + tile / 2, si * tile + tile / 2));
      });
      L.atlasDirty = false;
    };

    /** The letter grid, with each cell's slow wobble split into fixed and moving parts so a frame needs almost no trig. */
    const layout = (L: Layer) => {
      const sp = L.spacing;
      const cols = (L.cols = Math.ceil(w / sp) + 1), rows = (L.rows = Math.ceil(h / sp) + 1);
      L.cells = new Float32Array(cols * rows * STRIDE);
      L.dens = new Float32Array(cols * rows);
      L.dens2 = new Float32Array(cols * rows);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const o = (row * cols + col) * STRIDE;
          const bx = col * sp + (row % 2) * (sp / 3), by = row * sp + sp / 2;
          const a = bx * 0.018 + row * 0.14, b = by * 0.015 + col * 0.11;
          const c = row * 0.37 + col * 0.13, d = row * 0.18 - col * 0.17;
          L.cells.set([bx, by, Math.sin(a), Math.cos(a), Math.sin(b), Math.cos(b), Math.sin(c), Math.cos(c), Math.sin(d), Math.cos(d)], o);
        }
      }
    };

    const resize = () => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      rect = r;
      const first = !w;
      w = r.width; h = r.height;
      const small = w < 720 ? 0 : 1;
      for (const L of layers) {
        L.dpr = Math.min(devicePixelRatio || 1, L.spec.res);
        L.glyphCv.width = Math.round(w * L.dpr); L.glyphCv.height = Math.round(h * L.dpr);
        L.cloudCv.width = Math.ceil(w / SCALE); L.cloudCv.height = Math.ceil(h / SCALE);
        L.spacing = L.spec.spacing[small];
        L.font = L.spec.font[small];
        if (first || !L.clouds.length) {
          const made = makeClouds(L.spec, w, h, L.tones.length);
          L.clouds = made.clouds; L.maxSpan = made.maxSpan;
          L.now = new Float32Array(L.clouds.reduce((n, c) => n + c.puffs.length, 0) * 3);
        } else L.clouds.forEach((c) => (c.y = Math.min(c.y, h * 0.92)));
        layout(L);
        L.atlasDirty = true;
      }
      draw();
    };

    const paintClouds = (L: Layer, s: number) => {
      const b = L.cloudCtx, now = L.now;
      let k = 0;
      for (const c of L.clouds) for (const p of c.puffs) { puffNow(now, k, c, p, s); k += 3; }
      b.setTransform(1 / SCALE, 0, 0, 1 / SCALE, 0, 0);
      b.globalCompositeOperation = 'source-over';
      b.clearRect(0, 0, w, h);
      // the body of every cloud first, then shade and light laid over it without changing its shape
      const pass = (which: number, away: number) => {
        let j = 0;
        for (const c of L.clouds) {
          const img = L.sprites[c.tone][which];
          for (let n = c.puffs.length; n > 0; n--, j += 3) {
            const r = now[j + 2];
            b.drawImage(img, now[j] + SUN.x * r * away - r, now[j + 1] + SUN.y * r * away - r, r * 2, r * 2);
          }
        }
      };
      pass(0, 0);
      b.globalCompositeOperation = 'source-atop';
      pass(1, -0.4);
      pass(2, 0.4);
      b.globalCompositeOperation = 'source-over';
    };

    /** Adds one puff's cover to a grid of how clear the sky is, looking only at the cells it can reach. */
    const splat = (L: Layer, grid: Float32Array, cx: number, cy: number, r: number) => {
      const { spacing: sp, cols, rows } = L;
      const r0 = Math.max(0, Math.ceil((cy - r - sp / 2) / sp)), r1 = Math.min(rows - 1, Math.floor((cy + r - sp / 2) / sp));
      const inv = 1 / (r * r);
      for (let row = r0; row <= r1; row++) {
        const shift = (row & 1) * (sp / 3);
        const c0 = Math.max(0, Math.ceil((cx - r - shift) / sp)), c1 = Math.min(cols - 1, Math.floor((cx + r - shift) / sp));
        const dy = row * sp + sp / 2 - cy, dy2 = dy * dy;
        for (let col = c0; col <= c1; col++) {
          const dx = col * sp + shift - cx;
          const u = (dx * dx + dy2) * inv;
          if (u < 1) grid[row * cols + col] *= 1 - lut[(u * LUT_N) | 0];
        }
      }
    };

    const density = (L: Layer) => {
      L.dens.fill(1);
      L.dens2.fill(1);
      const now = L.now;
      for (let k = 0; k < now.length; k += 3) {
        splat(L, L.dens, now[k], now[k + 1], now[k + 2]);
        splat(L, L.dens2, now[k] - SUN_PX.x, now[k + 1] - SUN_PX.y, now[k + 2]);
      }
    };

    const drawLayer = (L: Layer, t: number, s: number) => {
      if (L.atlasDirty) buildAtlas(L);
      const { spec, cells, dens, dens2, cols, rows, tile, dpr } = L;
      paintClouds(L, s);
      density(L);

      const ctx = L.glyphCtx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, L.glyphCv.width, L.glyphCv.height);
      ctx.imageSmoothingEnabled = false;

      const px = pointer.x, py = pointer.y;
      const radius = Math.min(Math.max(w, h) * 0.3, 150) * spec.reach;
      const reach = pointer.pull * spec.pull;
      const pulling = pointer.pull > 0.01;
      const wt = t * spec.waveRate;
      const sw = Math.sin(wt), cw = Math.cos(wt), sw9 = Math.sin(wt * 0.9), cw9 = Math.cos(wt * 0.9);
      const st = Math.sin(t), ct = Math.cos(t), st11 = Math.sin(t * 1.1), ct11 = Math.cos(t * 1.1);
      const wobbleX = 1.4 * spec.pull, wobbleY = 1.2 * spec.pull;
      const top = ramp.length - 1, shadeTop = SHADES - 1;
      const half = tile / 2;

      for (let row = 0, c = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++, c++) {
          const o = c * STRIDE;
          const bx = cells[o], by = cells[o + 1];
          const cloud = Math.min(1, (1 - dens[c]) * norm);
          let near = 0, dx = 0, dy = 0, dist = 0;
          if (pulling) {
            dx = px - bx; dy = py - by;
            if (dx < radius && dx > -radius && dy < radius && dy > -radius) {
              dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < radius) near = (1 - dist / radius) * reach;
            }
          }
          const wave = (sw * cells[o + 3] + cw * cells[o + 2] + cw9 * cells[o + 5] + sw9 * cells[o + 4] + 2) / 4;
          const level = cloud * 0.78 + wave * 0.3 - 0.1 + near * 0.55;
          const i = Math.min(top, Math.max(0, Math.floor(level * top)));
          if (i === 0) continue;

          // sunlit where the cloud thins out toward the sun, quiet on the far side, bright along thin edges
          const toward = Math.min(1, (1 - dens2[c]) * norm);
          const light = clamp((cloud - toward) * 2.6 + 4 * cloud * (1 - cloud) * 0.3 + near * 0.8, SHADE_LOW, 1);

          let x = bx + (st * cells[o + 7] + ct * cells[o + 6]) * wobbleX;
          let y = by + (ct11 * cells[o + 9] + st11 * cells[o + 8]) * wobbleY;
          if (near > 0 && dist > 0) { x += (dx / dist) * near * 8; y += (dy / dist) * near * 8; }

          const variants = glyphIdx[i];
          const glyph = variants[variants.length === 1 ? 0 : (col * 3 + row * 5) % variants.length];
          const shade = Math.round(((light - SHADE_LOW) / (1 - SHADE_LOW)) * shadeTop);
          ctx.globalAlpha =
            Math.min(0.7, (0.07 + cloud * 0.2 + (i / top) * 0.175 + near * 0.35) * (1 + light * 0.5)) *
            (dark ? 0.85 : 1) * spec.ink;
          ctx.drawImage(
            L.atlas, glyph * tile, shade * tile, tile, tile,
            Math.round(x * dpr - half), Math.round(y * dpr - half), tile, tile,
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      if (!w) return;
      const t = clock * 0.0011, s = clock / 1000;
      for (const L of layers) {
        L.drawn = clock;
        drawLayer(L, t, s);
      }
    };

    const update = (dt: number) => {
      clock += dt;
      for (const L of layers) {
        for (const c of L.clouds) {
          c.x += (c.speed * dt) / 1000;
          if (c.x - c.span > w) c.x = -c.span;
        }
      }
      pointer.x += (pointer.tx - pointer.x) * 0.12;
      pointer.y += (pointer.ty - pointer.y) * 0.12;
      pointer.pull += (pointer.target - pointer.pull) * 0.06;
      const active = pointer.target > 0 || pointer.pull > 0.01;
      const t = clock * 0.0011, s = clock / 1000;
      for (const L of layers) {
        // slow, quiet skies only need redrawing now and then; the canvases keep what was last drawn
        if (clock - L.drawn >= (active ? L.spec.active : L.spec.idle) * EASE[ease] - 5) {
          L.drawn = clock;
          drawLayer(L, t, s);
        }
      }
    };

    const govern = (now: number, dt: number) => {
      if (seen.length < 30) {
        seen.push(dt);
        frameMs = clamp(Math.min(...seen), 16, 34); // 16 on most screens, 33 where the phone caps itself to 30fps
        return;
      }
      if (dt > frameMs * 1.5) late++;
      else if (late) late--;
      if (late > 24 && ease < EASE.length - 1) {
        if (now - eased < 6000) strikes = Math.min(strikes + 1, 4);
        ease++;
        late = 0;
        calm = now + 20000 * 2 ** strikes;
      } else if (ease > 0 && now > calm) {
        ease--;
        eased = now;
        late = 0;
        calm = now + 20000;
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (last && now - last < MIN_FRAME) { schedule(); return; }
      const dt = last ? Math.min(64, now - last) : 16;
      if (last) govern(now, dt);
      last = now;
      update(dt);
      schedule();
    };
    const schedule = () => {
      if (!raf && visible && !document.hidden && !reduced.matches) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };

    const move = (e: PointerEvent) => {
      const r = rect ?? (rect = host.getBoundingClientRect());
      pointer.tx = e.clientX - r.left;
      pointer.ty = e.clientY - r.top;
      if (pointer.target === 0 && pointer.pull < 0.05) { pointer.x = pointer.tx; pointer.y = pointer.ty; }
      pointer.target = 1;
    };
    const down = (e: PointerEvent) => { rect = null; move(e); };
    const leave = () => { pointer.target = 0; };
    const up = (e: PointerEvent) => { if (e.pointerType !== 'mouse') leave(); }; // a lifted finger lets go
    const scrolled = () => { rect = null; };

    const retheme = () => { palette(); draw(); };
    const onVisibility = () => (document.hidden ? stop() : schedule());
    const onMotion = () => (reduced.matches ? (stop(), draw()) : schedule());
    const ro = new ResizeObserver(resize);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      visible ? schedule() : stop();
    });
    const mo = new MutationObserver(retheme);

    palette();
    applied.current = key;
    retune.current = () => { palette(); draw(); };
    resize();
    ro.observe(host);
    io.observe(host);
    mo.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    darkQuery.addEventListener('change', retheme);
    reduced.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);
    addEventListener('scroll', scrolled, { passive: true, capture: true });
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', leave);
    schedule();
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      darkQuery.removeEventListener('change', retheme);
      reduced.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
      removeEventListener('scroll', scrolled, { capture: true });
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', leave);
    };
  }, []);

  // a new mix of worlds (or new letters) recolours the clouds where they are
  useEffect(() => {
    if (applied.current === key) return;
    applied.current = key;
    retune.current?.();
  }, [key]);

  const at = (i: number) => (el: HTMLCanvasElement | null) => void (els.current[i] = el);
  return (
    <>
      <canvas ref={at(0)} class="sky" aria-hidden="true" />
      <canvas ref={at(1)} class="sky" aria-hidden="true" />
      <canvas ref={at(2)} class="sky" aria-hidden="true" />
      <canvas ref={at(3)} class="sky" aria-hidden="true" />
    </>
  );
}
