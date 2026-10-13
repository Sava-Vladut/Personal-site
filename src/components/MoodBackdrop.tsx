// The page's background takes the world of your latest mood: faint, blurred clouds drifting very slowly
// behind everything, with out-of-focus letters that thicken where the clouds are and thin to dust between.
// Every world uses the same gentle field; what changes is its colour, its letters (the same ramps as the
// journal's sky) and which way and how it drifts: joy and hope rise, sadness sinks in long curtains, calm
// stretches into mist. When the mood changes, the old world fades out and the new one fades in.
import { useEffect, useRef } from 'preact/hooks';
import { COMPANION, RAMPS } from './Sky';

const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const FRAME = 50;      // 20fps: the field moves so slowly that more would only cost battery
const FADE_OUT = 600;  // ms
const FADE_IN = 1800;
const CLOUD_PX = 10;   // the clouds are painted at 1/10 size and stretched up by the browser, so they stay soft
const BLUR = [0.8, 2, 4]; // how out of focus a letter is (shadow blur, px): sharp-ish, soft, dreamy
const BLUR_GAIN = [1, 1.15, 1.4]; // blurrier letters spread thin, so they get a little more ink

type RGB = [number, number, number];
interface Feel {
  vx: number; vy: number; // drift, px per second
  stretch: number;        // < 1 pulls the clouds out sideways into mist, > 1 into upright curtains
  cover: number;          // > 0 for more sky under cloud
  evolve: number;         // how fast the shapes slowly change as they drift
}
const FEEL: Record<string, Feel> = {
  joy: { vx: 5, vy: -3, stretch: 1, cover: 0, evolve: 0.05 },
  'hope-interest': { vx: 2, vy: -6, stretch: 1, cover: 0, evolve: 0.05 },
  'love-connection': { vx: 4, vy: -1, stretch: 0.85, cover: 0.04, evolve: 0.04 },
  'calm-safety': { vx: 7, vy: 0, stretch: 0.55, cover: 0.02, evolve: 0.03 },
  sadness: { vx: -2, vy: 7, stretch: 1.5, cover: 0.07, evolve: 0.04 },
  fear: { vx: 3, vy: 2, stretch: 1, cover: 0.02, evolve: 0.1 },
  anger: { vx: 3, vy: -8, stretch: 1.1, cover: 0.03, evolve: 0.07 },
  'shame-aversion': { vx: -3, vy: 3, stretch: 1, cover: 0.04, evolve: 0.04 },
};

interface Grid {
  w: number; h: number; sp: number; cols: number; rows: number;
  rnd: Float32Array; // three fixed random numbers per cell: dust, depth of focus, wobble
  calm: Float32Array; // per column: how much to hush it, so the middle (where the page's text is) stays quieter
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, v: number) => {
  const x = clamp((v - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// a repeating 256×256 table of random numbers, so the clouds can drift for hours without running out
const TABLE = new Float32Array(256 * 256);
{
  let seed = 90210;
  for (let k = 0; k < TABLE.length; k++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    TABLE[k] = seed / 4294967296;
  }
}
/** Smooth value noise, 0…1. */
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8;
  return lerp(lerp(TABLE[y0 + x0], TABLE[y0 + x1], u), lerp(TABLE[y1 + x0], TABLE[y1 + x1], u), v);
}

/** How much cloud there is at (x, y) px, 0…1: big slow shapes with a little finer detail. */
function cloud(x: number, y: number, t: number, f: Feel, cover: number) {
  const ox = f.vx * t + Math.sin(t * f.evolve) * 70;
  const oy = f.vy * t + Math.cos(t * f.evolve * 0.8) * 50;
  const sx = f.stretch / 380, sy = 1 / 380;
  const a = noise((x - ox) * sx, (y - oy) * sy);
  const b = noise((x - ox * 1.4) * sx * 2.6 + 31, (y - oy * 1.4) * sy * 2.6 + 17);
  return smooth(0.42 - cover, 0.74 - cover, a * 0.72 + b * 0.28);
}

function hex(s: string): RGB {
  const m = s.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;

/** `world`: the emotion world to show (a core id), `strength`: 0…1, how strong the feeling was. */
export function MoodBackdrop({ world, strength }: { world: string; strength: number }) {
  const clouds = useRef<HTMLCanvasElement>(null);
  const letters = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ world, strength });
  const poke = useRef<() => void>();
  latest.current = { world, strength };
  useEffect(() => poke.current?.(), [world, strength]);

  useEffect(() => {
    const cloudCv = clouds.current!, glyphCv = letters.current!;
    const cloudCtx = cloudCv.getContext('2d')!, ctx = glyphCv.getContext('2d')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const atlas = document.createElement('canvas');
    let g: Grid | null = null;
    let img: ImageData | null = null;
    let dpr = 1, font = 12, tile = 0;
    let shown: string | null = null, fade = 0;
    let dark = false, color: RGB = [128, 128, 128], tint: [RGB, RGB] = [[128, 128, 128], [128, 128, 128]];
    let feel = FEEL.joy;
    let glyphs: string[] = [];
    let ramp = RAMPS.default;
    let glyphIdx: number[][] = [];
    let atlasDirty = true;
    let raf = 0, last = 0, clock = 0;

    /** Colours, letters and drift of the world on show. */
    const tune = () => {
      if (!shown) return;
      const css = getComputedStyle(document.documentElement);
      const v = (name: string) => hex(css.getPropertyValue(name));
      dark = document.documentElement.dataset.theme === 'dark';
      const accent = v(`--emo-${shown}`);
      color = mix(accent, v('--ink'), dark ? 0.25 : 0.4);
      tint = [accent, v(`--emo-${COMPANION[shown] ?? shown}`)];
      feel = FEEL[shown] ?? FEEL.joy;
      ramp = RAMPS[shown] ?? RAMPS.default;
      glyphs = [];
      glyphIdx = ramp.map((level) =>
        level.trim() === '' ? [] : [...level].map((ch) => (glyphs.includes(ch) ? glyphs.indexOf(ch) : glyphs.push(ch) - 1)),
      );
      atlasDirty = true;
    };

    /** Every letter at three degrees of blur, painted once; drawing a letter is then a small copy. */
    const buildAtlas = () => {
      const pad = Math.ceil(5 * dpr);
      tile = Math.ceil(font * 1.4 * dpr) + pad * 2;
      atlas.width = Math.max(1, glyphs.length) * tile;
      atlas.height = BLUR.length * tile;
      const a = atlas.getContext('2d')!;
      a.font = `${font * dpr}px ${FONT}`;
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      const off = atlas.width + 200; // the letter itself is drawn off to the side: only its blurred shadow lands in the tile
      a.fillStyle = '#000';
      a.shadowColor = `rgb(${color[0]},${color[1]},${color[2]})`;
      a.shadowOffsetX = off;
      BLUR.forEach((blur, bi) => {
        a.shadowBlur = blur * dpr;
        glyphs.forEach((ch, gi) => a.fillText(ch, gi * tile + tile / 2 - off, bi * tile + tile / 2));
      });
      atlasDirty = false;
    };

    const layout = () => {
      const w = innerWidth, h = innerHeight;
      const narrow = w < 720;
      const sp = narrow ? 18 : 22;
      font = narrow ? 12 : 14;
      dpr = Math.min(devicePixelRatio || 1, 2);
      glyphCv.width = Math.round(w * dpr);
      glyphCv.height = Math.round(h * dpr);
      cloudCv.width = Math.ceil(w / CLOUD_PX);
      cloudCv.height = Math.ceil(h / CLOUD_PX);
      img = cloudCtx.createImageData(cloudCv.width, cloudCv.height);
      const cols = Math.ceil(w / sp) + 1, rows = Math.ceil(h / sp) + 1;
      const rnd = new Float32Array(cols * rows * 3);
      for (let k = 0; k < rnd.length; k++) rnd[k] = TABLE[(k * 7919) & 0xffff];
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

    const paintClouds = (t: number, cover: number) => {
      if (!g || !img) return;
      const { data, width, height } = img;
      const peak = (dark ? 0.17 : 0.2) * fade * 255;
      const [c1, c2] = tint;
      const half = Math.min(g.w / 2, 320);
      for (let py = 0, o = 0; py < height; py++) {
        const y = (py + 0.5) * CLOUD_PX;
        for (let px = 0; px < width; px++, o += 4) {
          const x = (px + 0.5) * CLOUD_PX;
          const d = cloud(x, y, t, feel, cover);
          if (d < 0.004) { data[o + 3] = 0; continue; }
          // the colour slides from the world toward its companion across the sky
          const m = clamp(x / g.w * 0.5 + y / g.h * 0.5, 0, 1) * 0.7;
          data[o] = c1[0] + (c2[0] - c1[0]) * m;
          data[o + 1] = c1[1] + (c2[1] - c1[1]) * m;
          data[o + 2] = c1[2] + (c2[2] - c1[2]) * m;
          data[o + 3] = peak * d * (1 - 0.4 * (1 - smooth(half * 0.6, half * 1.4, Math.abs(x - g.w / 2))));
        }
      }
      cloudCtx.putImageData(img, 0, 0);
    };

    const paintLetters = (t: number, cover: number) => {
      if (!g) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, glyphCv.width, glyphCv.height);
      if (atlasDirty) buildAtlas();
      const { sp, cols, rows, calm, rnd } = g;
      const top = ramp.length - 1;
      const half = tile / 2;
      const gain = (dark ? 0.4 : 0.32) * fade;
      ctx.imageSmoothingEnabled = true;
      for (let r = 0, i = 0; r < rows; r++) {
        const y = r * sp + sp / 2, shift = (r & 1) * (sp / 3);
        for (let c = 0; c < cols; c++, i++) {
          const x = c * sp + shift;
          // letters thicken where the cloud is, with a little dust between
          const level = cloud(x, y, t, feel, cover) * 0.8 + (rnd[i * 3] > 0.7 ? 0.05 : 0);
          if (level <= 0.01) continue;
          const at = Math.min(level, 1) * top;
          const idx = Math.min(top - 1, Math.floor(at));
          const into = at - idx; // the letter hands over to the next one smoothly instead of popping
          const depth = rnd[i * 3 + 1] < 0.3 ? 0 : rnd[i * 3 + 1] < 0.7 ? 1 : 2;
          const wobble = rnd[i * 3 + 2] * 6.283;
          const px = (x + Math.sin(t * 0.35 + wobble) * 1.6) * dpr - half;
          const py = (y + Math.cos(t * 0.3 + wobble) * 1.6) * dpr - half;
          const alpha = gain * BLUR_GAIN[depth] * calm[c];
          for (let k = 0; k < 2; k++) {
            const lvl = idx + k;
            const share = k ? into : 1 - into;
            const variants = glyphIdx[lvl];
            if (!variants.length || share < 0.02) continue;
            const glyph = variants[variants.length === 1 ? 0 : (c * 3 + r * 5) % variants.length];
            ctx.globalAlpha = Math.min(0.5, alpha * share * (0.25 + 0.75 * level));
            ctx.drawImage(atlas, glyph * tile, depth * tile, tile, tile, px, py, tile, tile);
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      if (!g) return;
      if (!shown || fade <= 0) {
        cloudCtx.clearRect(0, 0, cloudCv.width, cloudCv.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, glyphCv.width, glyphCv.height);
        return;
      }
      const t = clock / 1000;
      const cover = feel.cover + (latest.current.strength - 0.5) * 0.06; // a stronger feeling fills a little more sky
      paintClouds(t, cover);
      paintLetters(t, cover);
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? now - last : FRAME;
      if (dt < FRAME - 4) return;
      last = now;
      step(Math.min(dt, 120));
      draw();
    };
    const start = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (!reduced.matches && !document.hidden) raf = requestAnimationFrame(tick);
    };
    /** A still sky (reduced motion) has no loop: jump straight to the new world and paint once. */
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

  return (
    <div class="mood-bg" aria-hidden="true">
      <canvas ref={clouds} />
      <canvas ref={letters} />
    </div>
  );
}
