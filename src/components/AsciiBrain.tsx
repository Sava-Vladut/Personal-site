// The intro's brain: buildBrain()'s points turned, lit and drawn as letters on a grid, like the old spinning ASCII donut.
// Every frame keeps the nearest point in each cell, lights it from the upper left (or toward the pointer) and picks a
// letter by how bright it is. The emotion regions take turns lighting up with their own motion, sparks run between them,
// a ring of words orbits around it, now and then a row slips sideways, and it all flies in out of the sky at the start
// and away again when you go in. Drag to spin it; tap a region to light it.
import { useEffect, useRef } from 'preact/hooks';
import { PATCHES, pulse } from '../lib/brainShape';
import { CEREBELLUM, buildBrain, sideOf, type BrainCloud } from '../lib/brain3d';
import { watchView } from '../lib/inView';

const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const RAMP = ' .,-~:;=!*#%@'; // dark to bright
const SCRAMBLE = '!<>-_/\\[]{}=+*^?#%&$01';
const SPARK = '@*+:.'; // a spark's head, then its tail
const FLY = 0.65;       // seconds each letter takes to fly in
const ASSEMBLE = 1.3;   // until the last one lands
const SETTLE = 0.35;    // the whole brain turning a moment before onLanded
/** How long going in takes: the page waits this long before the app shows. */
export const DIVE_MS = 750;
const CAM = 3.4;        // the eye's distance from the brain's middle
const SPIN = 0.32;      // radians a second when left alone
const SPOT_EVERY = 2.6; // seconds each region holds the spotlight
const RING = 0.96;      // the word ring's radius
const MIN_FRAME = 33;   // ~30fps is plenty for letters

/** The order the regions take the spotlight in. */
const SHOW = ['hope-interest', 'joy', 'love-connection', 'calm-safety', 'sadness', 'fear', 'anger', 'shame-aversion']
  .map((w) => PATCHES.findIndex((p) => p.world === w));
const ANGER = PATCHES.findIndex((p) => p.world === 'anger');

// colour rows in the letter atlas: the plain brain, the cerebellum, white-hot, then one per region
const BASE = 0, SMALL = 1, HOT = 2, REGION = 3;

type RGB = [number, number, number];
const hex = (s: string): RGB => {
  const m = s.trim().match(/^#?([0-9a-f]{6})$/i);
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** One brain per screen size for the whole visit: building it takes a moment, and coming back to the intro shouldn't. */
const built = new Map<number, BrainCloud>();
const brainFor = (count: number) => built.get(count) ?? built.set(count, buildBrain(count)).get(count)!;

export interface Word { text: string; world: string }

interface Props {
  words: Word[];
  label: string;
  /** Goes up by one each time the brain should flinch. */
  flinch?: number;
  /** Going in: the letters burst out toward you and fade. */
  diving: boolean;
  /** Skip the fly-in, for a second look in the same visit. */
  quick?: boolean;
  /** The region in the spotlight, whenever it changes: the showcase's, or the one you point at. */
  onSpot?: (world: string) => void;
  /** Once, when every letter has landed and the whole brain has turned a moment. */
  onLanded?: () => void;
}

export function AsciiBrain({ words, label, flinch = 0, diving, quick, onSpot, onLanded }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const live = useRef({ words, flinch, diving, onSpot, onLanded });
  live.current = { words, flinch, diving, onSpot, onLanded };

  useEffect(() => {
    const el = cv.current!;
    const ctx = el.getContext('2d')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const rand = rng(91);

    let cloud: BrainCloud | null = null;
    let from = new Float32Array(0), delay = new Float32Array(0);
    let w = 0, h = 0, dpr = 1, cols = 0, rows = 0, cw = 8, ch = 15, unit = 100, fontPx = 12;
    let depth = new Float32Array(0), who = new Int32Array(0), taken = new Uint8Array(0);
    let ringText: string[] = [], ringRow: number[] = [];
    const atlas = document.createElement('canvas');
    let tile = 0, glyphAt = new Map<string, number>(), palette: RGB[] = [];

    // motion
    let s = quick || reduced.matches ? ASSEMBLE + 1.2 : 0; // animation time, seconds
    let yaw = -0.55, yawVel = SPIN, pitchDrag = 0, pitch = -0.18, ringTurn = 0;
    let spot = -1, pinned = -1, pinnedUntil = 0;
    const lvl = new Float32Array(PATCHES.length).fill(0.3), flare = new Float32Array(PATCHES.length);
    let sparks: { a: number; b: number; side: number; t0: number; dur: number }[] = [];
    let nextSpark = ASSEMBLE + 0.4;
    let ripple: { x: number; y: number; z: number; t0: number } | null = null;
    let bands: { r0: number; r1: number; shift: number }[] = [], glitchUntil = 0, nextGlitch = ASSEMBLE + 5 + rand() * 6;
    let flinchAt = -9, seenFlinch = live.current.flinch, diveAt = -1, landed = false;
    const light = { x: -0.45, y: 0.6, z: 0.7 }, aim = { x: -0.45, y: 0.6 };
    let drag: { x: number; y: number; yaw0: number; moved: boolean; last: number; lastYaw: number; vel: number } | null = null;
    let raf = 0, last = 0, visible = true, frameMs = MIN_FRAME, slow = 0;

    /** Every letter in every colour, painted once; drawing one is then a small copy. */
    const paint = () => {
      const css = getComputedStyle(el);
      const ink: RGB = [214, 220, 236];
      palette = [ink, mix(ink, [120, 130, 160], 0.45), [255, 244, 214], ...PATCHES.map((p) => mix(hex(css.getPropertyValue(`--emo-${p.world}`)), [255, 255, 255], 0.22))];
      const chars = [...new Set([...RAMP, ...SCRAMBLE, ...SPARK, ...ringText].filter((c) => c.trim()))];
      glyphAt = new Map(chars.map((c, i) => [c, i]));
      tile = Math.ceil(fontPx * dpr * 1.5);
      atlas.width = chars.length * tile;
      atlas.height = palette.length * tile;
      const a = atlas.getContext('2d')!;
      a.font = `${fontPx * dpr}px ${FONT}`;
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      palette.forEach((c, row) => {
        a.fillStyle = `rgb(${c.join(',')})`;
        chars.forEach((ch, i) => a.fillText(ch, i * tile + tile / 2, row * tile + tile / 2));
      });
    };

    /** As many words as fit around the ring, evenly spaced. */
    const ring = () => {
      const { words } = live.current;
      const room = Math.max(24, Math.floor((2 * Math.PI * RING * unit) / (cw * 1.3)));
      ringText = []; ringRow = [];
      for (let k = 0; words.length && ringText.length < room; k++) {
        const word = words[k % words.length];
        const chars = [...`${word.text}  ·  `];
        if (ringText.length + chars.length > room && ringText.length) break;
        const row = REGION + Math.max(0, PATCHES.findIndex((p) => p.world === word.world));
        for (const c of chars) { ringText.push(c); ringRow.push(c === '·' ? BASE : row); }
      }
    };

    const size = () => {
      const r = el.parentElement!.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      if (r.width === w && r.height === h && ratio === dpr) return;
      w = r.width; h = r.height; dpr = ratio;
      cols = clamp(Math.round(w / (w < 600 ? 5.2 : 6.6)), 56, 170); // finer letters on a phone, or the brain looks coarse
      cw = w / cols;
      ch = cw * 1.9;
      rows = Math.max(10, Math.floor(h / ch));
      fontPx = Math.min(cw / 0.62, ch * 0.9);
      unit = Math.min(w / 2.2, (rows * ch) / 1.3);
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      depth = new Float32Array(cols * rows);
      who = new Int32Array(cols * rows);
      taken = new Uint8Array(cols * rows);
      ring();
      paint();
      draw();
    };

    const step = (dt: number) => {
      const { flinch, diving } = live.current;
      s += dt;
      if (flinch !== seenFlinch) { seenFlinch = flinch; flinchAt = s; yawVel += (rand() < 0.5 ? -1 : 1) * 2.4; }
      if (diving && diveAt < 0) diveAt = s;
      if (!landed && s >= ASSEMBLE + SETTLE) { landed = true; live.current.onLanded?.(); }
      if (!drag) {
        yaw += yawVel * dt;
        yawVel += (SPIN - yawVel) * Math.min(1, dt * 0.9);
        pitchDrag *= Math.max(0, 1 - dt * 2.5);
      }
      ringTurn -= dt * 0.16 + (yawVel - SPIN) * dt * 0.25;
      pitch += (-0.18 + 0.07 * Math.sin(s * 0.37) + pitchDrag - pitch) * Math.min(1, dt * 4);
      light.x += (aim.x - light.x) * Math.min(1, dt * 4);
      light.y += (aim.y - light.y) * Math.min(1, dt * 4);

      // the spotlight: what you point at, or the next region in the show
      const next = pinned >= 0 && s < pinnedUntil ? pinned : s > ASSEMBLE - 0.3 ? SHOW[Math.floor((s - ASSEMBLE) / SPOT_EVERY + 8) % SHOW.length] : -1;
      if (next !== spot) { spot = next; if (spot >= 0) live.current.onSpot?.(PATCHES[spot].world); }
      for (let r = 0; r < lvl.length; r++) {
        lvl[r] += ((r === spot ? 1 : 0.28) - lvl[r]) * Math.min(1, dt * 3);
        flare[r] *= Math.exp(-dt * 2.4);
      }

      if (s > nextSpark && diveAt < 0) {
        const a = Math.floor(rand() * PATCHES.length);
        const b = (a + 1 + Math.floor(rand() * (PATCHES.length - 1))) % PATCHES.length;
        sparks.push({ a, b, side: rand() < 0.5 ? -1 : 1, t0: s, dur: 0.6 + rand() * 0.5 });
        nextSpark = s + 0.8 + rand() * 1.2;
      }
      if (s > nextGlitch && diveAt < 0) {
        bands = Array.from({ length: 1 + Math.floor(rand() * 2) }, () => {
          const r0 = Math.floor(rand() * rows);
          return { r0, r1: r0 + 1 + Math.floor(rand() * 3), shift: (rand() < 0.5 ? -1 : 1) * (2 + Math.floor(rand() * 5)) };
        });
        glitchUntil = s + 0.13;
        nextGlitch = s + 8 + rand() * 7;
      }
    };

    const draw = () => {
      if (!cloud || !w) return;
      const { pos, nrm, part, region, fold, phase } = cloud;
      const n = cloud.n;
      const dive = diveAt < 0 ? 0 : clamp((s - diveAt) / (DIVE_MS / 1000), 0, 1);
      const cam = CAM - 2.4 * dive * dive;
      const fade = 1 - dive * dive;
      const breath = 1 + 0.012 * Math.sin(s * 1.3);
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const ox = w / 2, oy = (rows * ch) / 2;
      const ll = Math.hypot(light.x, light.y, light.z), lx = light.x / ll, ly = light.y / ll, lz = light.z / ll;

      depth.fill(-1e9);
      who.fill(-1);
      taken.fill(0);

      // 1. every point onto the grid, nearest wins
      for (let i = 0; i < n; i++) {
        const o = i * 3;
        let x = pos[o] * breath, y = pos[o + 1] * breath, z = pos[o + 2] * breath;
        const e = (s - delay[i]) / FLY;
        const flying = e < 1;
        if (flying) {
          if (e <= 0) continue;
          const k = 1 - (1 - e) ** 3;
          x = from[o] + (x - from[o]) * k; y = from[o + 1] + (y - from[o + 1]) * k; z = from[o + 2] + (z - from[o + 2]) * k;
        } else {
          // facing away: hidden behind the front anyway
          const nz = nrm[o + 1] * sp + (-nrm[o] * sy + nrm[o + 2] * cy) * cp;
          if (nz < -0.15) continue;
        }
        if (dive) {
          const push = dive * dive * (0.6 + phase[i] * 1.6);
          x += nrm[o] * push; y += nrm[o + 1] * push; z += nrm[o + 2] * push;
        }
        const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
        const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        const d = cam - z2;
        if (d < 0.25) continue;
        const f = (cam / d) * unit;
        const col = Math.floor((ox + x1 * f) / cw), row = Math.floor((oy - (y2 + 0.03) * f) / ch);
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
        const c = row * cols + col;
        if (z2 > depth[c]) { depth[c] = z2; who[c] = i; }
      }

      // 2. close pinholes between neighbours at the same depth
      for (let row = 0; row < rows; row++) {
        for (let col = 1; col < cols - 1; col++) {
          const c = row * cols + col;
          if (who[c] < 0 && who[c - 1] >= 0 && who[c + 1] >= 0 && Math.abs(depth[c - 1] - depth[c + 1]) < 0.1) { who[c] = who[c - 1]; depth[c] = depth[c - 1]; }
        }
      }
      for (let row = 1; row < rows - 1; row++) {
        for (let col = 0; col < cols; col++) {
          const c = row * cols + col;
          if (who[c] < 0 && who[c - cols] >= 0 && who[c + cols] >= 0 && Math.abs(depth[c - cols] - depth[c + cols]) < 0.1) { who[c] = who[c - cols]; depth[c] = depth[c - cols]; }
        }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.width, el.height);
      ctx.imageSmoothingEnabled = false;
      const half = tile / 2;
      const put = (glyph: string, color: number, col: number, row: number, alpha: number) => {
        const g = glyphAt.get(glyph);
        if (g === undefined || alpha <= 0.01) return;
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.drawImage(atlas, g * tile, color * tile, tile, tile, Math.round((col + 0.5) * cw * dpr - half), Math.round((row + 0.5) * ch * dpr - half), tile, tile);
      };
      const project = (x: number, y: number, z: number): [number, number, number] | null => {
        const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
        const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        const d = cam - z2;
        if (d < 0.25) return null;
        const f = (cam / d) * unit;
        const col = Math.floor((ox + x1 * f) / cw), row = Math.floor((oy - (y2 + 0.03) * f) / ch);
        return col < 0 || col >= cols || row < 0 || row >= rows ? null : [col, row, z2];
      };

      // 3. the ring of words, tilted, turning on its own; letters behind the brain are hidden by it
      const ringIn = clamp((s - ASSEMBLE + 0.4) / 0.7, 0, 1) * fade;
      if (ringIn > 0 && ringText.length) {
        const rr = RING * (1 + dive * 1.2), tilt = 0.4, ct = Math.cos(tilt), st = Math.sin(tilt), roll = 0.12;
        const cr = Math.cos(roll), sr = Math.sin(roll);
        const lit: [number, number, number, number][] = [];
        for (let j = 0; j < ringText.length; j++) {
          if (ringText[j] === ' ') continue;
          const a = ringTurn + (j / ringText.length) * Math.PI * 2;
          const px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
          let y = -pz * st, z = pz * ct, x = px;
          [x, y] = [x * cr - y * sr, x * sr + y * cr];
          // the ring follows the brain's tilt but not its spin
          const y2 = y * cp - z * sp, z2 = y * sp + z * cp;
          const d = cam - z2;
          if (d < 0.25) continue;
          const f = (cam / d) * unit;
          const col = Math.floor((ox + x * f) / cw), row = Math.floor((oy - (y2 + 0.03) * f) / ch);
          if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
          lit.push([j, col, row, z2]);
        }
        lit.sort((p, q) => q[3] - p[3]);
        for (const [j, col, row, z] of lit) {
          const c = row * cols + col;
          if (taken[c] || z < depth[c]) continue;
          taken[c] = 1;
          put(ringText[j], ringRow[j], col, row, (0.28 + 0.6 * (z / RING * 0.5 + 0.5)) * ringIn);
        }
      }

      // 4. the brain itself
      const glitching = s < glitchUntil;
      const top = RAMP.length - 1;
      const flinching = Math.max(0, 1 - (s - flinchAt) / 0.7);
      const rippleAge = ripple ? s - ripple.t0 : 9;
      if (rippleAge > 1.6) ripple = null;
      for (let row = 0; row < rows; row++) {
        let shift = 0;
        if (glitching) for (const b of bands) if (row >= b.r0 && row < b.r1) shift = b.shift;
        for (let col = 0; col < cols; col++) {
          const c = row * cols + col;
          const i = who[c];
          if (i < 0 || taken[c]) continue;
          const o = i * 3;
          const e = (s - delay[i]) / FLY;
          if (e < 1) {
            // still flying: a letter that hasn't decided what it is yet
            put(SCRAMBLE[(i * 7 + Math.floor(s * 18)) % SCRAMBLE.length], BASE, col, row, (0.25 + 0.6 * e) * fade);
            continue;
          }
          const nx = nrm[o], ny = nrm[o + 1], nz0 = nrm[o + 2];
          const nx1 = nx * cy + nz0 * sy, nz1 = -nx * sy + nz0 * cy;
          const ny2 = ny * cp - nz1 * sp, nz2 = ny * sp + nz1 * cp;
          const diffuse = Math.max(0, nx1 * lx + ny2 * ly + nz2 * lz);
          const rim = (1 - Math.max(0, nz2)) ** 3;
          const f = fold[i];
          let b = 0.06 + 0.78 * diffuse * (0.5 + 0.5 * f) + 0.3 * rim;
          if (f === 0) b *= 0.35; // the deep grooves between the lobes
          let color = part[i] === CEREBELLUM ? SMALL : BASE;
          const r = region[i];
          if (r >= 0) {
            const [sx2, sy2] = sideOf(pos[o], pos[o + 1]);
            const glow = lvl[r] * (0.35 + 0.65 * pulse(PATCHES[r].world, s, phase[i], sx2, sy2)) + flare[r];
            if (glow > 0.2) {
              color = REGION + r;
              b = Math.max(b, 0.2) * (0.55 + 0.45 * diffuse) + glow * 0.55;
            }
          }
          if (ripple) {
            const dist = Math.hypot(pos[o] - ripple.x, pos[o + 1] - ripple.y, pos[o + 2] - ripple.z);
            const ringK = Math.max(0, 1 - Math.abs(dist - rippleAge * 0.9) / 0.07) * (1 - rippleAge / 1.6);
            if (ringK > 0) { b += ringK * 0.6; if (ringK > 0.45) color = HOT; }
          }
          if (flinching && phase[i] < flinching) { color = REGION + ANGER; b += 0.3 * flinching; }
          b = clamp(b, 0, 1);
          let glyph = RAMP[Math.max(1, Math.round(b * top))];
          if (shift && phase[i] < 0.5) glyph = SCRAMBLE[(i + Math.floor(s * 30)) % SCRAMBLE.length];
          const at = col + shift;
          if (at < 0 || at >= cols) continue;
          put(glyph, color, at, row, (0.3 + 0.7 * b) * fade);
        }
      }

      // 5. sparks: a bright head and a fading tail, arcing just above the surface from one region to another
      sparks = sparks.filter((spark) => {
        const u = (s - spark.t0) / spark.dur;
        if (u >= 1) { flare[spark.b] = 1; return false; }
        const A = spark.a * 3, B = spark.b * 3, cs = cloud!.centres;
        for (let k = 0; k < SPARK.length; k++) {
          const uk = u - k * 0.045;
          if (uk < 0) break;
          const lift = 1 + 0.25 * Math.sin(Math.PI * uk);
          const p = project(
            (cs[A] + (cs[B] - cs[A]) * uk) * lift,
            (cs[A + 1] + (cs[B + 1] - cs[A + 1]) * uk) * lift,
            (cs[A + 2] + (cs[B + 2] - cs[A + 2]) * uk) * lift * spark.side,
          );
          if (!p) continue;
          const behind = depth[p[1] * cols + p[0]] > p[2] + 0.05;
          put(SPARK[k], k < 2 ? HOT : REGION + spark.b, p[0], p[1], (1 - k * 0.17) * (behind ? 0.25 : 1) * fade);
        }
        return true;
      });
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      raf = 0;
      if (last && now - last < frameMs - 2) { schedule(); return; }
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 30;
      last = now;
      step(dt);
      const t0 = performance.now();
      draw();
      // a phone that can't keep up draws 20 times a second instead of 30
      const took = performance.now() - t0;
      slow = took > 22 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 20) { frameMs = 50; slow = 0; }
      schedule();
    };
    const schedule = () => {
      // nothing moves until the brain is built, so the fly-in starts from the beginning
      if (!raf && cloud && visible && !document.hidden && !reduced.matches) raf = requestAnimationFrame(frame);
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; last = 0; };

    const cellAt = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const col = Math.floor((e.clientX - r.left) / cw), row = Math.floor((e.clientY - r.top) / ch);
      return col >= 0 && col < cols && row >= 0 && row < rows ? row * cols + col : -1;
    };
    const regionAt = (c: number) => (c >= 0 && cloud && who[c] >= 0 ? cloud.region[who[c]] : -1);
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, yaw0: yaw, moved: false, last: performance.now(), lastYaw: yaw, vel: 0 };
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      // the light leans toward the pointer
      aim.x = -0.2 + ((e.clientX - r.left) / r.width - 0.5) * 1.6;
      aim.y = 0.35 - ((e.clientY - r.top) / r.height - 0.5) * 1.4;
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
        yaw = drag.yaw0 + dx * 0.009;
        pitchDrag = clamp(dy * 0.004, -0.6, 0.6);
        const now = performance.now();
        if (now > drag.last) { drag.vel = ((yaw - drag.lastYaw) / (now - drag.last)) * 1000; drag.last = now; drag.lastYaw = yaw; }
      } else if (e.pointerType === 'mouse') {
        const reg = regionAt(cellAt(e));
        if (reg >= 0) { pinned = reg; pinnedUntil = s + 1.2; }
        if (reduced.matches) draw();
      }
    };
    const up = (e: PointerEvent) => {
      if (!drag) return;
      if (!drag.moved) {
        // a tap: a ripple from where it landed, and that region lights up for a while
        const c = cellAt(e);
        if (c >= 0 && cloud && who[c] >= 0) {
          const o = who[c] * 3;
          ripple = { x: cloud.pos[o], y: cloud.pos[o + 1], z: cloud.pos[o + 2], t0: s };
          const reg = cloud.region[who[c]];
          if (reg >= 0) { pinned = reg; pinnedUntil = s + 4; flare[reg] = 1; }
        }
      } else yawVel = clamp(drag.vel, -5, 5);
      drag = null;
      if (reduced.matches) draw();
    };
    const leave = () => { aim.x = -0.45; aim.y = 0.6; };

    const onMotion = () => (reduced.matches ? (stop(), draw()) : schedule());
    const onVisibility = () => (document.hidden ? stop() : schedule());
    const ro = new ResizeObserver(size);
    ro.observe(el.parentElement!);
    const unwatch = watchView(el, (on) => { visible = on; on ? schedule() : stop(); });
    reduced.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', leave);
    // building the brain takes a moment: let the page paint first
    const start = setTimeout(() => {
      size();
      cloud = brainFor(innerWidth < 700 ? 13000 : 22000);
      // each letter starts somewhere up in the sky and lands in its own time
      from = new Float32Array(cloud.n * 3);
      delay = new Float32Array(cloud.n);
      for (let i = 0; i < cloud.n; i++) {
        from[i * 3] = (rand() - 0.5) * 5.2;
        from[i * 3 + 1] = 0.35 + rand() * 1.1;
        from[i * 3 + 2] = (rand() - 0.5) * 2;
        delay[i] = 0.05 + rand() * 0.6;
      }
      step(0);
      draw();
      schedule();
    }, 30);
    return () => {
      clearTimeout(start);
      stop();
      ro.disconnect();
      unwatch();
      reduced.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', leave);
    };
  }, []);

  return <canvas ref={cv} class="intro-brain" role="img" aria-label={label} />;
}
