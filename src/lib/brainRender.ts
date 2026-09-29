/*
 * Turns a brain point cloud into a grid of ASCII characters: points are rotated, depth-buffered
 * into character cells, then lit (light from the upper left, soft rim, creases darker) and mapped
 * onto a ramp of characters from thin to dense. Pure typed-array code, no DOM.
 */
import type { BrainCloud } from './brain';

export const FOCUS_STEPS = 5; // how many colours a region fades through between dim and lit

export interface View { yaw: number; pitch: number; zoom: number; target: [number, number, number] }
export interface Grid {
  cols: number; rows: number;
  levels: number;                // length of the character ramp
  cw: number; ch: number;        // cell size in px
  cx: number; cy: number;        // where the model's target lands, in px
  scale: number;                 // px per model unit at zoom 1
}
export interface Spark { x: number; y: number; z: number; t0: number }
export interface Shading {
  focus: Float32Array;           // per region, 0 (dim) … 1 (lit)
  time: number;                  // seconds
  sparks: Spark[];
  scan: number;                  // height of the scanning band, or NaN
  tag: number;                   // region to find the on-screen centre of, or -1
}
export interface Frame {
  glyph: Uint8Array;             // ramp index per cell, 0 = nothing
  tone: Uint8Array;              // region * FOCUS_STEPS + focus step
  who: Int32Array;               // the point nearest the viewer in each cell, or -1
  tagX: number; tagY: number; tagN: number;
  zbuf: Float32Array; sub: Int32Array; // the supersampled depth buffer and which point owns each sample
}

const SS = 2; // samples per cell, each way: shading is averaged, so edges and fine folds don't shimmer

export function makeFrame(cells: number): Frame {
  return {
    glyph: new Uint8Array(cells), tone: new Uint8Array(cells), who: new Int32Array(cells),
    tagX: 0, tagY: 0, tagN: 0,
    zbuf: new Float32Array(cells * SS * SS), sub: new Int32Array(cells * SS * SS),
  };
}

const DIST = 5;
const LIGHT = (() => { const l = Math.hypot(-0.5, 0.62, 0.62); return [-0.5 / l, 0.62 / l, 0.62 / l]; })();
const HALF = (() => { const h = [LIGHT[0], LIGHT[1], LIGHT[2] + 1], l = Math.hypot(h[0], h[1], h[2]); return [h[0] / l, h[1] / l, h[2] / l]; })();

export const SPARK_LIFE = 2.6;

export function rasterize(c: BrainCloud, v: View, g: Grid, s: Shading, o: Frame) {
  const { pos, nor, ao, reg, n } = c;
  const { cols, rows } = g;
  const cells = cols * rows, sCols = cols * SS, samples = cells * SS * SS;
  const { zbuf, sub, glyph, tone, who } = o;
  zbuf.fill(-1e9, 0, samples);
  sub.fill(-1, 0, samples);

  const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
  const m00 = cy, m02 = sy;
  const m10 = sy * sp, m11 = cp, m12 = -cy * sp;
  const m20 = -sy * cp, m21 = sp, m22 = cy * cp;
  const [tx, ty, tz] = v.target;
  const k = g.scale * v.zoom;
  const icw = SS / g.cw, ich = SS / g.ch;
  const sRows = rows * SS;

  for (let i = 0, p = 0; i < n; i++, p += 3) {
    if (m20 * nor[p] + m21 * nor[p + 1] + m22 * nor[p + 2] < -0.25) continue; // facing away
    const x = pos[p] - tx, y = pos[p + 1] - ty, z = pos[p + 2] - tz;
    const Z = m20 * x + m21 * y + m22 * z;
    const w = DIST / (DIST - Z);
    const col = ((g.cx + (m00 * x + m02 * z) * w * k) * icw) | 0;
    const row = ((g.cy - (m10 * x + m11 * y + m12 * z) * w * k) * ich) | 0;
    if (col < 0 || row < 0 || col >= sCols || row >= sRows) continue;
    const at = row * sCols + col;
    if (Z > zbuf[at]) { zbuf[at] = Z; sub[at] = i; }
  }

  const nSparks = s.sparks.length;
  const sparkR = new Float32Array(nSparks), sparkK = new Float32Array(nSparks);
  for (let q = 0; q < nSparks; q++) {
    const age = s.time - s.sparks[q].t0;
    sparkR[q] = age * 0.34;
    const a = age / SPARK_LIFE;
    sparkK[q] = a < 0 || a > 1 ? 0 : (1 - a) * (1 - a);
  }
  const scanOn = s.scan === s.scan;
  const inv = 1 / (SS * SS);
  let tagX = 0, tagY = 0, tagN = 0;

  for (let row = 0, cell = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++, cell++) {
      let sum = 0, bestZ = -1e9, best = -1;
      for (let dy = 0; dy < SS; dy++) {
        const base = (row * SS + dy) * sCols + col * SS;
        for (let dx = 0; dx < SS; dx++) {
          const i = sub[base + dx];
          if (i < 0) continue;
          const p = i * 3;
          const nx = nor[p], ny = nor[p + 1], nz = nor[p + 2];
          const vx = m00 * nx + m02 * nz, vy = m10 * nx + m11 * ny + m12 * nz, vz = m20 * nx + m21 * ny + m22 * nz;
          const lam = Math.max(0, vx * LIGHT[0] + vy * LIGHT[1] + vz * LIGHT[2]);
          const rr = 1 - Math.max(0, vz);
          const rim = rr * rr * Math.sqrt(rr);
          let spec = Math.max(0, vx * HALF[0] + vy * HALF[1] + vz * HALF[2]);
          const s1 = spec;
          spec *= spec; spec *= spec; spec *= spec; spec *= spec; spec *= spec; spec *= s1 * s1; // ^34
          const a = ao[i];
          const z = zbuf[base + dx];
          let lum = (0.11 + 0.88 * lam * (0.5 + 0.5 * lam) + 0.34 * rim) * (0.18 + 0.82 * a) + 0.4 * spec * a;
          lum *= 0.8 + 0.2 * Math.min(1, Math.max(0, (z + 0.9) / 1.8));
          if (vz < 0) lum *= 0.3;
          if (scanOn) {
            const d = (pos[p + 1] - s.scan) / 0.04;
            lum += 0.5 * Math.exp(-d * d);
          }
          for (let q = 0; q < nSparks; q++) {
            if (!sparkK[q]) continue;
            const sq = s.sparks[q];
            const ex = pos[p] - sq.x, ey = pos[p + 1] - sq.y, ez = pos[p + 2] - sq.z;
            const e = (Math.sqrt(ex * ex + ey * ey + ez * ez) - sparkR[q]) / 0.045;
            lum += 0.8 * sparkK[q] * Math.exp(-e * e);
          }
          lum *= 0.42 + 0.58 * s.focus[reg[i]];
          sum += lum;
          if (z > bestZ) { bestZ = z; best = i; }
        }
      }
      who[cell] = best;
      if (best < 0) { glyph[cell] = 0; continue; }
      const idx = Math.min(g.levels - 1, (Math.min(1.4, sum * inv * 1.05) * g.levels) | 0);
      glyph[cell] = idx;
      const r = reg[best];
      tone[cell] = r * FOCUS_STEPS + Math.round(s.focus[r] * (FOCUS_STEPS - 1));
      if (idx && r === s.tag) { tagX += col; tagY += row; tagN++; }
    }
  }
  o.tagX = tagN ? tagX / tagN : 0;
  o.tagY = tagN ? tagY / tagN : 0;
  o.tagN = tagN;
}
