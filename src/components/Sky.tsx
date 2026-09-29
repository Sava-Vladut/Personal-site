// The journal's sky: two layers of soft clouds drifting behind the top panel, partly drawn in letters.
// A far layer of small, faint clouds and finer letters sits behind a near layer of larger, faster
// ones that lean harder toward a finger or cursor. Clouds are painted small on a buffer and stretched
// up, so they stay soft; that buffer says how much cloud sits under each letter, so glyphs thicken
// where the clouds are and thin to dust between. Clouds breathe, stretch and pinch as they drift,
// and a low sun from the upper left lights their edges. Each emotion world has its own letter ramp.
import { useEffect, useRef } from 'preact/hooks';

const SCALE = 4; // cloud buffers are drawn at 1/4 size

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
  fill: number;             // opacity of the cloud image
  ink: number;              // opacity of the letters
  spacing: [number, number]; // letter grid, small screen / large
  font: [number, number];
  pull: number;             // how strongly the pointer moves this layer
  reach: number;
  waveRate: number;
  every: number;            // redraw on every nth frame; slow, faint layers can rest between
}
const FAR: Spec = {
  seed: 23, size: [0.42, 0.7], perPx: 115, minCount: 4, speed: [2, 4.5], yFrom: 0.06, yRange: 0.84,
  toneShift: 1, haze: 0.3, fill: 0.65, ink: 0.85, spacing: [11, 13], font: [8, 9], pull: 0.3, reach: 0.75, waveRate: 0.55, every: 3,
};
const NEAR: Spec = {
  seed: 7, size: [0.85, 1.45], perPx: 210, minCount: 3, speed: [7, 15], yFrom: 0.14, yRange: 0.62,
  toneShift: 0, haze: 0, fill: 1, ink: 1, spacing: [17, 21], font: [12, 13], pull: 1.4, reach: 1.15, waveRate: 1, every: 1,
};

interface Layer {
  spec: Spec; clouds: Cloud[]; maxSpan: number;
  buf: HTMLCanvasElement; bctx: CanvasRenderingContext2D;
  out: HTMLCanvasElement; octx: CanvasRenderingContext2D;
  tones: RGB[]; shadow: RGB[]; light: RGB[]; shades: string[];
  spacing: number; font: number;
}

// the sun: low, from the upper left; the step is in buffer pixels
const SUN = { x: -0.55, y: -0.83 };
const SUN_STEP = { x: -2, y: -3 };
const WARM: RGB = [255, 200, 120];
const SHADES = 9;       // colours between shaded and sunlit
const SHADE_LOW = -0.6; // the lowest light value: a little shaded, never black

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

/** Where a puff is and how big, right now: it breathes, and its cloud slowly stretches and pinches. */
function puffNow(c: Cloud, p: Puff, s: number) {
  const spread = 1 + 0.4 * Math.sin(s * c.spreadRate + c.spreadPhase);
  const pinch = clamp((spread - 1) / 0.4, 0, 1) * 0.3 * (1 - Math.abs(p.u) * 2); // the middle thins as it stretches
  const breath = 1 + 0.13 * Math.sin(s * p.rate + p.phase);
  return {
    x: c.x + p.dx * spread + Math.sin(s * p.rate * 0.7 + p.phase * 1.7) * 3,
    y: c.y + p.dy * (0.9 + 0.1 * breath) + Math.sin(s * p.rate + p.phase * 0.6) * 2,
    r: p.r * breath * (1 - pinch),
  };
}

export function Sky({ world }: { world?: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current!;
    const host = cv.parentElement!;
    const ctx = cv.getContext('2d')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const darkQuery = matchMedia('(prefers-color-scheme: dark)');
    const ramp = RAMPS[world ?? ''] ?? RAMPS.default;

    const layer = (spec: Spec): Layer => {
      const buf = document.createElement('canvas'), out = document.createElement('canvas');
      return {
        spec, clouds: [], maxSpan: spanOf(spec.size[1]),
        buf, bctx: buf.getContext('2d', { willReadFrequently: true })!,
        out, octx: out.getContext('2d')!,
        tones: [], shadow: [], light: [], shades: [], spacing: 18, font: 12,
      };
    };
    const layers = [layer(FAR), layer(NEAR)]; // far first, so the near clouds pass in front

    let w = 0, h = 0, dpr = 1;
    let dark = false;
    let raf = 0, visible = true, last = 0, clock = 0, tick = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, pull: 0, target: 0 };

    const palette = () => {
      const css = getComputedStyle(host);
      const v = (name: string) => hex(css.getPropertyValue(name));
      dark = document.documentElement.dataset.theme === 'dark';
      const ink = v('--ink'), surface = v('--surface');
      const worlds = world ? [world, COMPANION[world] ?? 'sadness', world] : DAWN;
      const raw = worlds.map((c) => v(`--emo-${c}`));
      const accent = raw[0];
      const glyph = mix(accent, ink, dark ? 0.55 : 0.6);
      // the lit side glows warm; the shaded side just quiets down
      const sun = dark
        ? mix(mix(accent, WARM, 0.35), [255, 255, 255], 0.5)
        : mix(mix(accent, WARM, 0.4), [0, 0, 0], 0.12);
      for (const L of layers) {
        const haze = L.spec.haze;
        // pastel in the light, deep glows in the dark; the far layer fades toward the background
        const tones = raw.map((c) => (dark ? mix(c, surface, 0.35) : mix(c, [255, 255, 255], 0.5)));
        L.tones = tones.map((c) => mix(c, surface, haze));
        L.shadow = L.tones.map((c) => (dark ? mix(c, [0, 0, 0], 0.4) : mix(c, [60, 70, 120], 0.3)));
        L.light = L.tones.map((c) => (dark ? mix(c, [255, 255, 255], 0.3) : mix(c, [255, 246, 225], 0.65)));
        const g = mix(glyph, surface, haze * 0.75);
        const quiet = mix(g, surface, 0.4);
        L.shades = Array.from({ length: SHADES }, (_, j) => {
          const l = SHADE_LOW + ((1 - SHADE_LOW) * j) / (SHADES - 1);
          return rgba(l < 0 ? mix(g, quiet, l / SHADE_LOW) : mix(g, sun, l), 1);
        });
        L.clouds.forEach((c, i) => (c.tone = (i + L.spec.toneShift) % tones.length));
      }
    };

    const resize = () => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const first = !w;
      w = r.width; h = r.height;
      dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const small = w < 720 ? 0 : 1;
      for (const L of layers) {
        L.out.width = cv.width; L.out.height = cv.height;
        L.buf.width = Math.ceil(w / SCALE); L.buf.height = Math.ceil(h / SCALE);
        L.spacing = L.spec.spacing[small];
        L.font = L.spec.font[small];
        if (first || !L.clouds.length) {
          const made = makeClouds(L.spec, w, h, L.tones.length);
          L.clouds = made.clouds; L.maxSpan = made.maxSpan;
        } else L.clouds.forEach((c) => (c.y = Math.min(c.y, h * 0.92)));
      }
      draw();
    };

    const paintClouds = (L: Layer, s: number) => {
      const bctx = L.bctx;
      bctx.setTransform(1 / SCALE, 0, 0, 1 / SCALE, 0, 0);
      bctx.globalCompositeOperation = 'source-over';
      bctx.clearRect(0, 0, w, h);
      const now = L.clouds.map((c) => c.puffs.map((p) => puffNow(c, p, s)));
      const body = dark ? [0.42, 0.2] : [0.6, 0.3];
      // the body of every cloud first, then shade and light laid over it without changing its shape
      L.clouds.forEach((c, ci) => {
        const col = L.tones[c.tone];
        for (const p of now[ci]) {
          const g = bctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, rgba(col, body[0]));
          g.addColorStop(0.55, rgba(col, body[1]));
          g.addColorStop(1, rgba(col, 0));
          bctx.fillStyle = g;
          bctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
      });
      bctx.globalCompositeOperation = 'source-atop';
      const wash = (tones: RGB[], away: number, alpha: number) => {
        L.clouds.forEach((c, ci) => {
          const col = tones[c.tone];
          for (const p of now[ci]) {
            const x = p.x + SUN.x * p.r * away, y = p.y + SUN.y * p.r * away;
            const g = bctx.createRadialGradient(x, y, 0, x, y, p.r * 0.75);
            g.addColorStop(0, rgba(col, alpha));
            g.addColorStop(1, rgba(col, 0));
            bctx.fillStyle = g;
            bctx.fillRect(x - p.r, y - p.r, p.r * 2, p.r * 2);
          }
        });
      };
      wash(L.shadow, -0.4, dark ? 0.32 : 0.26);
      wash(L.light, 0.4, dark ? 0.4 : 0.6);
      bctx.globalCompositeOperation = 'source-over';
    };

    const drawLayer = (L: Layer, t: number, s: number) => {
      const { spec, buf, bctx, spacing, octx: ctx } = L;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      paintClouds(L, s);
      ctx.globalAlpha = spec.fill;
      ctx.drawImage(buf, 0, 0, w, h);

      const data = bctx.getImageData(0, 0, buf.width, buf.height).data;
      const bw = buf.width, bh = buf.height;
      const norm = 1 / (255 * (dark ? 0.5 : 0.62));
      const radius = Math.min(Math.max(w, h) * 0.3, 150) * spec.reach;
      const pull = pointer.pull;
      const wt = t * spec.waveRate;
      const top = ramp.length - 1;
      const shadeTop = SHADES - 1;
      ctx.font = `${L.font}px ui-monospace, SFMono-Regular, Menlo, monospace`;

      const cols = Math.ceil(w / spacing) + 1, rows = Math.ceil(h / spacing) + 1;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const bx = col * spacing + (row % 2) * (spacing / 3);
          const by = row * spacing + spacing / 2;
          const sx = Math.min(bw - 1, (bx / SCALE) | 0), sy = Math.min(bh - 1, (by / SCALE) | 0);
          const cloud = Math.min(1, data[(sy * bw + sx) * 4 + 3] * norm);
          const dx = pointer.x - bx, dy = pointer.y - by;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const near = pull > 0.01 ? Math.max(0, 1 - dist / radius) * pull * spec.pull : 0;
          const wave = (Math.sin(bx * 0.018 + wt + row * 0.14) + Math.cos(by * 0.015 - wt * 0.9 + col * 0.11) + 2) / 4;
          const level = cloud * 0.78 + wave * 0.3 - 0.1 + near * 0.55;
          const i = Math.min(top, Math.max(0, Math.floor(level * top)));
          if (i === 0) continue;

          // sunlit where the cloud thins out toward the sun, quiet on the far side, bright along thin edges
          const qx = clamp(sx + SUN_STEP.x, 0, bw - 1), qy = clamp(sy + SUN_STEP.y, 0, bh - 1);
          const toward = Math.min(1, data[(qy * bw + qx) * 4 + 3] * norm);
          const light = clamp((cloud - toward) * 2.6 + 4 * cloud * (1 - cloud) * 0.3 + near * 0.8, SHADE_LOW, 1);

          const driftX = Math.sin(t + row * 0.37 + col * 0.13) * 1.4 * spec.pull;
          const driftY = Math.cos(t * 1.1 - row * 0.18 + col * 0.17) * 1.2 * spec.pull;
          const pullX = dist > 0 ? (dx / dist) * near * 8 : 0;
          const pullY = dist > 0 ? (dy / dist) * near * 8 : 0;
          const chars = ramp[i];
          ctx.fillStyle = L.shades[Math.round(((light - SHADE_LOW) / (1 - SHADE_LOW)) * shadeTop)];
          ctx.globalAlpha =
            Math.min(0.7, (0.07 + cloud * 0.2 + (i / top) * 0.175 + near * 0.35) * (1 + light * 0.5)) *
            (dark ? 0.85 : 1) * spec.ink;
          ctx.fillText(
            chars.length === 1 ? chars : chars[(col * 3 + row * 5) % chars.length],
            bx + driftX + pullX,
            by + driftY + pullY,
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    const draw = (all = true) => {
      if (!w) return;
      const t = clock * 0.0011, s = clock / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const L of layers) {
        if (all || tick % L.spec.every === 0) drawLayer(L, t, s);
        ctx.drawImage(L.out, 0, 0);
      }
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
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
      draw(false);
      tick++;
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
      const r = host.getBoundingClientRect();
      pointer.tx = e.clientX - r.left;
      pointer.ty = e.clientY - r.top;
      if (pointer.target === 0 && pointer.pull < 0.05) { pointer.x = pointer.tx; pointer.y = pointer.ty; }
      pointer.target = 1;
    };
    const leave = () => { pointer.target = 0; };
    const up = (e: PointerEvent) => { if (e.pointerType !== 'mouse') leave(); }; // a lifted finger lets go

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
    resize();
    ro.observe(host);
    io.observe(host);
    mo.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    darkQuery.addEventListener('change', retheme);
    reduced.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);
    host.addEventListener('pointerdown', move);
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
      host.removeEventListener('pointerdown', move);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', leave);
    };
  }, [world]);

  return <canvas ref={canvas} class="sky" aria-hidden="true" />;
}
