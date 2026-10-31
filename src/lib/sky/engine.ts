// The skies' motion and drawing (components/Sky.tsx), apart from the page: where the browser can hand a canvas to a
// worker it all runs there (worker.ts), off the main thread, so scrolling, taps and page slides never wait on a cloud;
// elsewhere it runs on the page. Either way every sky on screen steps from one shared frame loop.
//
// A sky is two layers, far then near, each two canvases: the clouds, painted small and stretched up by CSS so they
// stay soft, and the letters, which thicken where the clouds are and thin to dust between. What the sky looks like
// (colours and the letter atlas, which needs the page's fonts) comes from look.ts on the page.

import { dprOf, sizeOf, specsFor, SHADES, SHADE_LOW, type Look, type RGB, type Spec } from './specs';

export type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const SCALE = 4; // cloud canvases are drawn at 1/4 size
const SPRITE = 64; // a soft puff, painted once per colour and stamped for every puff
const LUT_N = 256;
const MIN_FRAME = 15; // never step faster than ~60fps, even on 120Hz screens
const STRIDE = 10;
const FADE = 900; // ms a new look takes to blend in over the old one

// the sun: low, from the upper left
const SUN = { x: -0.55, y: -0.83 };
const SUN_PX = { x: -8, y: -12 };

/** If the screen can't keep up, layers redraw this much less often. */
const EASE = [1, 1.7, 2.6];

interface Puff { dx: number; dy: number; r: number; u: number; phase: number; rate: number }
interface Cloud {
  x: number; y: number; speed: number; tone: number; puffs: Puff[]; span: number;
  spreadPhase: number; spreadRate: number;
}
/** A layer's cloud colours, as they are right now (mid-blend, they're neither the old look's nor the new one's). */
interface Tones { tones: RGB[]; shadow: RGB[]; light: RGB[] }
interface Layer {
  spec: Spec;
  cloudCv: Canvas; cloudCtx: Ctx;
  glyphCv: Canvas; glyphCtx: Ctx;
  clouds: Cloud[];
  now: Float32Array; // x, y, r of every puff, this frame
  sprites: Canvas[][]; // per tone: body, shade, light
  spacing: number; dpr: number; cols: number; rows: number;
  cells: Float32Array; // per letter cell: x, y, then sine and cosine of four fixed phases
  dens: Float32Array; dens2: Float32Array; // how clear the sky is at each cell, and a step toward the sun
  drawn: number;
}

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// a small seeded random, so the same sky comes back on every visit
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const spanOf = (size: number) => 210 * size + 40;

function makeClouds(spec: Spec, w: number, h: number, tones: number): Cloud[] {
  const rand = rng(spec.seed);
  const n = Math.max(spec.minCount, Math.round(w / spec.perPx));
  const maxSpan = spanOf(spec.size[1]);
  return Array.from({ length: n }, (_, i) => {
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
      tone: (i + spec.toneShift) % Math.max(1, tones),
      puffs,
      span: spanOf(size),
      spreadPhase: rand() * Math.PI * 2,
      spreadRate: 0.08 + rand() * 0.08, // stretches apart and gathers back over 40–80 seconds
    };
  });
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

/* ---------- one loop for every sky ---------- */

const scenes = new Set<SkyScene>();
let queued = false;
const nextFrame: (cb: (now: number) => void) => unknown =
  typeof requestAnimationFrame === 'function' ? (cb) => requestAnimationFrame(cb) : (cb) => setTimeout(() => cb(performance.now()), 16);
function tick(now: number) {
  queued = false;
  for (const s of scenes) s.frame(now);
  if (scenes.size && !queued) { queued = true; nextFrame(tick); }
}

/**
 * One sky. `make` gives a scratch canvas (an OffscreenCanvas in the worker); `onDrawn` hears when its first frame is
 * down, so the page can fade it in instead of showing it blank.
 */
export class SkyScene {
  private layers: Layer[];
  private look: Look | null = null;
  // while a new look blends in: the one it replaces, the colours it starts from, and how far along it is (0…1)
  private prev: Look | null = null;
  private from: Tones[] = [];
  private shown: Tones[] = [];
  private fadeAt = 0;
  private fade = 1;
  private w = 0;
  private h = 0;
  private dark = false;
  private norm = 1 / 0.62;
  private lut = new Float32Array(LUT_N + 1); // how solid a puff is, by squared distance from its centre
  private pointer = { x: 0, y: 0, tx: 0, ty: 0, pull: 0, target: 0 };
  private clock = 0;
  private last = 0;
  private told = false;
  // if frames keep arriving late, the layers ease off
  private ease = 0;
  private late = 0;
  private frameMs = 0;
  private calm = 0;
  private eased = 0;
  private strikes = 0;
  private seen: number[] = [];

  constructor(canvases: Canvas[], small: boolean, private make: (w: number, h: number) => Canvas, private onDrawn: () => void) {
    this.layers = specsFor(small).map((spec, i) => {
      const cloudCv = canvases[i * 2], glyphCv = canvases[i * 2 + 1];
      return {
        spec, cloudCv, glyphCv,
        cloudCtx: cloudCv.getContext('2d') as Ctx, glyphCtx: glyphCv.getContext('2d') as Ctx,
        clouds: [], now: new Float32Array(0), sprites: [],
        spacing: 18, dpr: 1, cols: 0, rows: 0,
        cells: new Float32Array(0), dens: new Float32Array(0), dens2: new Float32Array(0), drawn: 0,
      };
    });
  }

  /**
   * New colours and letters: the clouds keep where they are and change colour in place. A moving sky blends into
   * them (the clouds' colours shift, the old letters fade under the new); a still one just takes them.
   */
  setLook(look: Look) {
    const old = this.look;
    this.look = look;
    const dark = (this.dark = look.dark);
    this.norm = 1 / (dark ? 0.5 : 0.62);
    const body = dark ? [0.42, 0.2] : [0.6, 0.3];
    for (let k = 0; k <= LUT_N; k++) {
      const t = Math.sqrt(k / LUT_N);
      this.lut[k] = t < 0.55 ? body[0] + (body[1] - body[0]) * (t / 0.55) : body[1] * (1 - (t - 0.55) / 0.45);
    }
    // a look that arrives mid-blend starts from the colours on screen, under whichever letters show most
    if (old && scenes.has(this) && this.shown.length) {
      const keep = this.prev && this.fade < 0.5 ? this.prev : old;
      if (this.prev && this.prev !== keep) release(this.prev);
      if (old !== keep) release(old);
      this.prev = keep;
      this.from = this.shown;
      this.fadeAt = this.clock;
      this.fade = 0;
    } else {
      if (this.prev) release(this.prev);
      if (old) release(old);
      this.prev = null;
      this.fade = 1;
    }
    this.layers.forEach((L, i) => L.clouds.forEach((c, k) => (c.tone = (k + L.spec.toneShift) % look.layers[i].tones.length)));
    this.tint();
    this.draw();
  }

  /** Paints each layer's cloud puffs in the colours of this moment of the blend. */
  private tint() {
    const look = this.look;
    if (!look) return;
    const dark = this.dark;
    const body = dark ? [0.42, 0.2] : [0.6, 0.3];
    const k = smooth(this.fade);
    this.shown = this.layers.map((L, i) => {
      const to = look.layers[i], from = this.fade < 1 ? this.from[i] : undefined;
      const at = (list: RGB[], old: RGB[] | undefined, j: number) => (old?.length ? mix(old[j % old.length], list[j], k) : list[j]);
      const now: Tones = {
        tones: to.tones.map((_, j) => at(to.tones, from?.tones, j)),
        shadow: to.shadow.map((_, j) => at(to.shadow, from?.shadow, j)),
        light: to.light.map((_, j) => at(to.light, from?.light, j)),
      };
      const was = L.sprites;
      L.sprites = now.tones.map((tone, j) => [
        this.blob(tone, [[0, body[0]], [0.55, body[1]], [1, 0]], 1, was[j]?.[0]),
        this.blob(now.shadow[j], [[0, dark ? 0.32 : 0.26], [1, 0]], 0.75, was[j]?.[1]),
        this.blob(now.light[j], [[0, dark ? 0.4 : 0.6], [1, 0]], 0.75, was[j]?.[2]),
      ]);
      return now;
    });
  }

  /** The sky's size in CSS px, and the screen's pixel ratio. */
  setSize(w: number, h: number, dpr: number) {
    if (!w || !h) return;
    if (w === this.w && h === this.h && this.layers.every((L) => L.dpr === dprOf(L.spec, dpr))) return;
    const first = !this.w;
    this.w = w; this.h = h;
    const size = sizeOf(w);
    for (const L of this.layers) {
      L.dpr = dprOf(L.spec, dpr);
      L.glyphCv.width = Math.round(w * L.dpr); L.glyphCv.height = Math.round(h * L.dpr);
      L.cloudCv.width = Math.ceil(w / SCALE); L.cloudCv.height = Math.ceil(h / SCALE);
      L.spacing = L.spec.spacing[size];
      if (first || !L.clouds.length) {
        L.clouds = makeClouds(L.spec, w, h, L.sprites.length);
        L.now = new Float32Array(L.clouds.reduce((n, c) => n + c.puffs.length, 0) * 3);
      } else L.clouds.forEach((c) => (c.y = Math.min(c.y, h * 0.92)));
      this.layout(L);
    }
    this.draw();
  }

  /** Where a finger or cursor is on the sky (CSS px from its corner), or that it has let go. */
  setPointer(x: number, y: number, on: boolean) {
    const p = this.pointer;
    if (!on) { p.target = 0; return; }
    p.tx = x; p.ty = y;
    if (p.target === 0 && p.pull < 0.05) { p.x = x; p.y = y; }
    p.target = 1;
  }

  /** Whether the sky moves; a still sky keeps what it last drew. */
  run(on: boolean) {
    if (on === scenes.has(this)) return;
    if (on) {
      scenes.add(this);
      if (!queued) { queued = true; nextFrame(tick); }
    } else {
      scenes.delete(this);
      this.last = 0;
    }
  }

  /** Stops it for good and lets go of its pictures. */
  dispose() {
    this.run(false);
    if (this.look) release(this.look);
    if (this.prev) release(this.prev);
    this.look = this.prev = null;
    for (const L of this.layers) {
      L.sprites = [];
      L.cloudCv.width = L.cloudCv.height = L.glyphCv.width = L.glyphCv.height = 0;
    }
  }

  /** One soft round puff, painted once (or into `into`, mid-blend) so it can be stamped instead of drawn as a gradient every frame. */
  private blob(col: RGB, stops: [number, number][], radius: number, into?: Canvas): Canvas {
    const c = into ?? this.make(SPRITE, SPRITE);
    const g = c.getContext('2d') as Ctx;
    const half = SPRITE / 2;
    g.clearRect(0, 0, SPRITE, SPRITE);
    const grad = g.createRadialGradient(half, half, 0, half, half, half * radius);
    for (const [at, a] of stops) grad.addColorStop(at, rgba(col.map(Math.round) as RGB, a));
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE, SPRITE);
    return c;
  }

  /** The letter grid, with each cell's slow wobble split into fixed and moving parts so a frame needs almost no trig. */
  private layout(L: Layer) {
    const sp = L.spacing;
    const cols = (L.cols = Math.ceil(this.w / sp) + 1), rows = (L.rows = Math.ceil(this.h / sp) + 1);
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
  }

  private paintClouds(L: Layer, s: number) {
    const b = L.cloudCtx, now = L.now;
    let k = 0;
    for (const c of L.clouds) for (const p of c.puffs) { puffNow(now, k, c, p, s); k += 3; }
    b.setTransform(1 / SCALE, 0, 0, 1 / SCALE, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, this.w, this.h);
    // the body of every cloud first, then shade and light laid over it without changing its shape
    const pass = (which: number, away: number) => {
      let j = 0;
      for (const c of L.clouds) {
        const img = L.sprites[c.tone]?.[which];
        if (!img) { j += c.puffs.length * 3; continue; }
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
  }

  /** Adds one puff's cover to a grid of how clear the sky is, looking only at the cells it can reach. */
  private splat(L: Layer, grid: Float32Array, cx: number, cy: number, r: number) {
    const { spacing: sp, cols, rows } = L;
    const lut = this.lut;
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
  }

  private density(L: Layer) {
    L.dens.fill(1);
    L.dens2.fill(1);
    const now = L.now;
    for (let k = 0; k < now.length; k += 3) {
      this.splat(L, L.dens, now[k], now[k + 1], now[k + 2]);
      this.splat(L, L.dens2, now[k] - SUN_PX.x, now[k + 1] - SUN_PX.y, now[k + 2]);
    }
  }

  private drawLayer(L: Layer, look: Look, i: number, t: number, s: number) {
    const { spec, cells, dens, dens2, cols, rows, dpr } = L;
    // mid-blend, the old letters fade out under the new ones
    const k = this.prev ? smooth(this.fade) : 1;
    const sets = [look, ...(this.prev ? [this.prev] : [])].map((l, n) => ({
      glyphIdx: l.glyphIdx, top: l.glyphIdx.length - 1, atlas: l.layers[i].atlas, tile: l.layers[i].tile, weight: n ? 1 - k : k,
    }));
    this.paintClouds(L, s);
    this.density(L);

    const ctx = L.glyphCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, L.glyphCv.width, L.glyphCv.height);
    ctx.imageSmoothingEnabled = false;

    const pointer = this.pointer, norm = this.norm;
    const px = pointer.x, py = pointer.y;
    const radius = Math.min(Math.max(this.w, this.h) * 0.3, 150) * spec.reach;
    const reach = pointer.pull * spec.pull;
    const pulling = pointer.pull > 0.01;
    const wt = t * spec.waveRate;
    const sw = Math.sin(wt), cw = Math.cos(wt), sw9 = Math.sin(wt * 0.9), cw9 = Math.cos(wt * 0.9);
    const st = Math.sin(t), ct = Math.cos(t), st11 = Math.sin(t * 1.1), ct11 = Math.cos(t * 1.1);
    const wobbleX = 1.4 * spec.pull, wobbleY = 1.2 * spec.pull;
    const shadeTop = SHADES - 1;
    const ink = (this.dark ? 0.85 : 1) * spec.ink;

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
        if (level * sets[0].top < 1 && (sets.length === 1 || level * sets[1].top < 1)) continue;

        // sunlit where the cloud thins out toward the sun, quiet on the far side, bright along thin edges
        const toward = Math.min(1, (1 - dens2[c]) * norm);
        const light = clamp((cloud - toward) * 2.6 + 4 * cloud * (1 - cloud) * 0.3 + near * 0.8, SHADE_LOW, 1);

        let x = bx + (st * cells[o + 7] + ct * cells[o + 6]) * wobbleX;
        let y = by + (ct11 * cells[o + 9] + st11 * cells[o + 8]) * wobbleY;
        if (near > 0 && dist > 0) { x += (dx / dist) * near * 8; y += (dy / dist) * near * 8; }

        const shade = Math.round(((light - SHADE_LOW) / (1 - SHADE_LOW)) * shadeTop);
        for (const { glyphIdx, top, atlas, tile, weight } of sets) {
          const lvl = Math.min(top, Math.max(0, Math.floor(level * top)));
          if (lvl === 0 || weight <= 0) continue;
          const variants = glyphIdx[lvl];
          if (!variants.length) continue;
          const glyph = variants[variants.length === 1 ? 0 : (col * 3 + row * 5) % variants.length];
          const half = tile / 2;
          ctx.globalAlpha = Math.min(0.7, (0.07 + cloud * 0.2 + (lvl / top) * 0.175 + near * 0.35) * (1 + light * 0.5)) * ink * weight;
          ctx.drawImage(
            atlas, glyph * tile, shade * tile, tile, tile,
            Math.round(x * dpr - half), Math.round(y * dpr - half), tile, tile,
          );
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Draws every layer as it is now (once the sky has both a size and a look). */
  draw() {
    const look = this.look;
    if (!this.w || !look) return;
    const t = this.clock * 0.0011, s = this.clock / 1000;
    this.layers.forEach((L, i) => {
      L.drawn = this.clock;
      this.drawLayer(L, look, i, t, s);
    });
    if (!this.told) { this.told = true; this.onDrawn(); }
  }

  private update(dt: number) {
    const look = this.look;
    this.clock += dt;
    for (const L of this.layers) {
      for (const c of L.clouds) {
        c.x += (c.speed * dt) / 1000;
        if (c.x - c.span > this.w) c.x = -c.span;
      }
    }
    const pointer = this.pointer;
    pointer.x += (pointer.tx - pointer.x) * 0.12;
    pointer.y += (pointer.ty - pointer.y) * 0.12;
    pointer.pull += (pointer.target - pointer.pull) * 0.06;
    if (!this.w || !look) return;
    // a blend in progress repaints the puffs in its next colours and redraws every layer each frame
    const blending = !!this.prev;
    if (blending) {
      this.fade = Math.min(1, (this.clock - this.fadeAt) / FADE);
      this.tint();
      if (this.fade >= 1) {
        release(this.prev!);
        this.prev = null;
      }
    }
    const active = pointer.target > 0 || pointer.pull > 0.01;
    const t = this.clock * 0.0011, s = this.clock / 1000;
    this.layers.forEach((L, i) => {
      // slow, quiet skies only need redrawing now and then; the canvases keep what was last drawn
      if (blending || this.clock - L.drawn >= (active ? L.spec.active : L.spec.idle) * EASE[this.ease] - 5) {
        L.drawn = this.clock;
        this.drawLayer(L, look, i, t, s);
      }
    });
  }

  private govern(now: number, dt: number) {
    if (this.seen.length < 30) {
      this.seen.push(dt);
      this.frameMs = clamp(Math.min(...this.seen), 16, 34); // 16 on most screens, 33 where the phone caps itself to 30fps
      return;
    }
    if (dt > this.frameMs * 1.5) this.late++;
    else if (this.late) this.late--;
    if (this.late > 24 && this.ease < EASE.length - 1) {
      if (now - this.eased < 6000) this.strikes = Math.min(this.strikes + 1, 4);
      this.ease++;
      this.late = 0;
      this.calm = now + 20000 * 2 ** this.strikes;
    } else if (this.ease > 0 && now > this.calm) {
      this.ease--;
      this.eased = now;
      this.late = 0;
      this.calm = now + 20000;
    }
  }

  /** Called by the shared loop on every frame while the sky runs. */
  frame(now: number) {
    const last = this.last;
    if (last && now - last < MIN_FRAME) return;
    const dt = last ? Math.min(64, now - last) : 16;
    if (last) this.govern(now, dt);
    this.last = now;
    this.update(dt);
  }
}

/** Frees a look's letter atlases once nothing draws from them (only pictures sent to the worker can be). */
function release(look: Look) {
  for (const l of look.layers) if (typeof ImageBitmap !== 'undefined' && l.atlas instanceof ImageBitmap) l.atlas.close();
}
