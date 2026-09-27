// The journal's sky: soft clouds drifting behind the top panel, partly drawn in letters. The clouds
// are painted small on a buffer and stretched up, so they stay soft; that same buffer says how much
// cloud sits under each letter, so the glyphs thicken where the clouds are and thin to dust between.
// A finger or cursor pulls the letters toward it. Tinted by the world you last checked in with today.
import { useEffect, useRef } from 'preact/hooks';

const GLYPHS = [' ', '.', ':', '+', '*', 'o', 'O', '#'];
const SCALE = 4; // cloud buffer is drawn at 1/4 size

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
interface Puff { dx: number; dy: number; r: number }
interface Cloud { x: number; y: number; speed: number; tone: number; puffs: Puff[]; span: number }

function hex(s: string): RGB {
  const m = s.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// a small seeded random, so the same sky comes back on every visit
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function makeClouds(w: number, h: number, tones: number): Cloud[] {
  const rand = rng(7);
  const n = Math.max(3, Math.round(w / 170));
  return Array.from({ length: n }, (_, i) => {
    const size = 0.7 + rand() * 0.6;
    const count = 4 + Math.floor(rand() * 4);
    const puffs: Puff[] = [];
    for (let k = 0; k < count; k++) {
      const u = count === 1 ? 0 : k / (count - 1) - 0.5; // -0.5 … 0.5 along the cloud
      puffs.push({
        dx: u * 150 * size + (rand() - 0.5) * 24,
        dy: -(1 - Math.abs(u) * 1.6) * 26 * size - rand() * 10, // taller in the middle, flat underneath
        r: (38 + (1 - Math.abs(u)) * 34 + rand() * 14) * size,
      });
    }
    return {
      x: ((i + rand() * 0.6) / n) * (w + 260) - 130,
      y: h * (0.14 + rand() * 0.62),
      speed: 4 + rand() * 7,
      tone: i % tones,
      puffs,
      span: 150 * size + 110,
    };
  });
}

export function Sky({ world }: { world?: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current!;
    const host = cv.parentElement!;
    const ctx = cv.getContext('2d')!;
    const buf = document.createElement('canvas');
    const bctx = buf.getContext('2d', { willReadFrequently: true })!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const darkQuery = matchMedia('(prefers-color-scheme: dark)');

    let w = 0, h = 0, dpr = 1, spacing = 18;
    let clouds: Cloud[] = [];
    let tones: RGB[] = [];
    let glyph: RGB = [0, 0, 0];
    let accent: RGB = [0, 0, 0];
    let dark = false;
    let raf = 0, visible = true, last = 0, clock = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, pull: 0, target: 0 };

    const palette = () => {
      const css = getComputedStyle(host);
      const v = (name: string) => hex(css.getPropertyValue(name));
      dark = document.documentElement.dataset.theme === 'dark';
      const ink = v('--ink'), surface = v('--surface');
      const worlds = world ? [world, COMPANION[world] ?? 'sadness', world] : DAWN;
      const raw = worlds.map((c) => v(`--emo-${c}`));
      // pastel in the light, deep glows in the dark
      tones = raw.map((c) => (dark ? mix(c, surface, 0.35) : mix(c, [255, 255, 255], 0.5)));
      accent = raw[0];
      glyph = mix(raw[0], ink, dark ? 0.55 : 0.6);
      if (clouds.length) clouds.forEach((c, i) => (c.tone = i % tones.length));
    };

    const resize = () => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const first = !w;
      w = r.width; h = r.height;
      dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      buf.width = Math.ceil(w / SCALE); buf.height = Math.ceil(h / SCALE);
      spacing = w < 720 ? 15 : 19;
      if (first || !clouds.length) clouds = makeClouds(w, h, tones.length);
      else clouds.forEach((c) => (c.y = Math.min(c.y, h * 0.92)));
      draw();
    };

    const paintClouds = () => {
      bctx.setTransform(1 / SCALE, 0, 0, 1 / SCALE, 0, 0);
      bctx.clearRect(0, 0, w, h);
      for (const c of clouds) {
        const col = tones[c.tone];
        for (const p of c.puffs) {
          const x = c.x + p.dx, y = c.y + p.dy;
          const g = bctx.createRadialGradient(x, y, 0, x, y, p.r);
          g.addColorStop(0, rgba(col, dark ? 0.42 : 0.6));
          g.addColorStop(0.55, rgba(col, dark ? 0.2 : 0.3));
          g.addColorStop(1, rgba(col, 0));
          bctx.fillStyle = g;
          bctx.fillRect(x - p.r, y - p.r, p.r * 2, p.r * 2);
        }
      }
    };

    const draw = () => {
      if (!w) return;
      paintClouds();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(buf, 0, 0, w, h);

      const data = bctx.getImageData(0, 0, buf.width, buf.height).data;
      const bw = buf.width, bh = buf.height;
      const t = clock * 0.0011;
      const radius = Math.min(Math.max(w, h) * 0.3, 150);
      const pull = pointer.pull;
      ctx.font = `${w < 720 ? 11 : 12}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const base = rgba(glyph, 1), lit = rgba(dark ? mix(accent, [255, 255, 255], 0.3) : mix(accent, [0, 0, 0], 0.15), 1);

      const cols = Math.ceil(w / spacing) + 1, rows = Math.ceil(h / spacing) + 1;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const bx = col * spacing + (row % 2) * (spacing / 3);
          const by = row * spacing + spacing / 2;
          const sx = Math.min(bw - 1, (bx / SCALE) | 0), sy = Math.min(bh - 1, (by / SCALE) | 0);
          const cloud = Math.min(1, data[(sy * bw + sx) * 4 + 3] / 255 / (dark ? 0.5 : 0.62));
          const dx = pointer.x - bx, dy = pointer.y - by;
          const dist = Math.hypot(dx, dy);
          const near = pull > 0.01 ? Math.max(0, 1 - dist / radius) * pull : 0;
          const wave = (Math.sin(bx * 0.018 + t + row * 0.14) + Math.cos(by * 0.015 - t * 0.9 + col * 0.11) + 2) / 4;
          const level = cloud * 0.78 + wave * 0.3 - 0.1 + near * 0.55;
          const i = Math.min(GLYPHS.length - 1, Math.max(0, Math.floor(level * (GLYPHS.length - 1))));
          if (i === 0) continue;
          const driftX = Math.sin(t + row * 0.37 + col * 0.13) * 1.4;
          const driftY = Math.cos(t * 1.1 - row * 0.18 + col * 0.17) * 1.2;
          const pullX = dist > 0 ? (dx / dist) * near * 8 : 0;
          const pullY = dist > 0 ? (dy / dist) * near * 8 : 0;
          ctx.fillStyle = near > 0.25 ? lit : base;
          ctx.globalAlpha = Math.min(0.6, 0.07 + cloud * 0.2 + i * 0.025 + near * 0.35) * (dark ? 0.85 : 1);
          ctx.fillText(GLYPHS[i], bx + driftX + pullX, by + driftY + pullY);
        }
      }
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      clock += dt;
      for (const c of clouds) {
        c.x += (c.speed * dt) / 1000;
        if (c.x - c.span > w) c.x = -c.span;
      }
      pointer.x += (pointer.tx - pointer.x) * 0.12;
      pointer.y += (pointer.ty - pointer.y) * 0.12;
      pointer.pull += (pointer.target - pointer.pull) * 0.06;
      draw();
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
