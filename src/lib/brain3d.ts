// The brain in three dimensions, for the intro: the side view in brainShape.ts grown into a body with two hemispheres,
// two temporal lobes, a two-lobed cerebellum and the stem, then sampled as points on its surface, each knowing which way
// it faces. Like brainShape.ts it is plain functions of position, so the same brain comes back every time and can be
// checked without a browser. Axes: x runs from the front (−) to the back (+), y up, z across; the origin is the
// middle of the side view.
import { PATCHES, grooveDist, patchAt } from './brainShape';

const CX = 0.76, CY = 0.48;
/** A 3D point's spot in the side view (brainShape's coordinates), for the regions and their motion. */
export const sideOf = (x: number, y: number): [number, number] => [x + CX, CY - y];

/** A rounded body: a superellipsoid, flatter below its centre than above. */
interface Body { c: [number, number, number]; r: [number, number, number]; down: number; n: number; part: number }

export const CORTEX = 0, CEREBELLUM = 1, STEM = 2;
const HEMI = 0.25; // how far each hemisphere's centre sits from the middle: they touch below and part along the top
const BODIES: Body[] = [
  // the hemispheres: the side view's dome, each a little over half as wide as the brain
  ...[1, -1].map((s): Body => ({ c: [0, CY - 0.44, s * HEMI], r: [0.64, 0.33, 0.27], down: 0.2, n: 2.4, part: CORTEX })),
  // the temporal lobes, along the underside
  ...[1, -1].map((s): Body => ({ c: [0.68 - CX, CY - 0.645, s * 0.29], r: [0.31, 0.1, 0.16], down: 0.1, n: 2, part: CORTEX })),
  // the cerebellum, tucked under the back
  ...[1, -1].map((s): Body => ({ c: [1.16 - CX, CY - 0.71, s * 0.12], r: [0.18, 0.095, 0.17], down: 0.095, n: 2, part: CEREBELLUM })),
];
// the stem: a slanted capsule, as in the side view
const STEM_A: [number, number, number] = [0.9 - CX, CY - 0.55, 0];
const STEM_B: [number, number, number] = [0.99 - CX, CY - 0.9, 0];
const stemRadius = (s: number) => 0.065 - 0.012 * s;

/** The brain is wider at the back than at the front. */
const taper = (x: number) => 0.92 + 0.1 * Math.max(-1, Math.min(1, x / 0.64));

/** |v|ⁿ, quick for the plain ellipsoids. */
const pw = (v: number, n: number) => (n === 2 ? v * v : Math.pow(Math.abs(v), n));

/** How far out of a body a point is: under 1 inside, 1 on the surface. */
function level(b: Body, x: number, y: number, z: number) {
  const dx = (x - b.c[0]) / b.r[0], dz = (z - b.c[2]) / b.r[2], dy = y - b.c[1];
  if (dx > 1 || dx < -1 || dz > 1 || dz < -1) return 2; // outside its box: no need to work it out
  return pw(dx, b.n) + pw(dy / (dy >= 0 ? b.r[1] : b.down), b.n) + pw(dz, b.n);
}

function stemDist(x: number, y: number, z: number) {
  const dx = STEM_B[0] - STEM_A[0], dy = STEM_B[1] - STEM_A[1];
  const s = Math.max(0, Math.min(1, ((x - STEM_A[0]) * dx + (y - STEM_A[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (STEM_A[0] + dx * s), y - (STEM_A[1] + dy * s), z) - stemRadius(s);
}

/** Whether a point is inside the brain. `skip` leaves one body out, to find where another one covers it. */
export function insideBrain(x: number, y: number, z: number, skip = -1, slack = 1): boolean {
  const zu = z / taper(x);
  for (let i = 0; i < BODIES.length; i++) if (i !== skip && level(BODIES[i], x, y, zu) < slack) return true;
  return skip !== BODIES.length && stemDist(x, y, zu) < 0;
}

/** Folds of the cortex, 0–1: ridges and the grooves between them, now in depth too. */
function folds3(x: number, y: number, z: number) {
  const a = Math.sin(x * 34 + 2.4 * Math.sin(y * 19 + z * 13));
  const b = Math.sin(y * 39 + 1.9 * Math.sin(z * 23 - x * 5));
  const c = Math.sin(z * 31 + 1.6 * Math.sin(x * 17 + y * 9));
  return 0.5 + (a + b + c) / 6;
}

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export interface BrainCloud {
  n: number;
  pos: Float32Array;    // x, y, z per point
  nrm: Float32Array;    // the way it faces, unit length
  part: Uint8Array;     // CORTEX, CEREBELLUM or STEM
  region: Int8Array;    // index into PATCHES, or −1
  fold: Float32Array;   // 0–1 surface texture, 0 in the deepest grooves
  phase: Float32Array;  // each point's own 0–1, for flicker
  /** Where each region sits on the brain's +z side, three numbers per PATCHES entry. */
  centres: Float32Array;
}

const CALM = PATCHES.findIndex((p) => p.world === 'calm-safety');
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** About `count` points spread evenly over the brain's surface. */
export function buildBrain(count: number): BrainCloud {
  const rand = rng(17);
  const pos: number[] = [], nrm: number[] = [], part: number[] = [], region: number[] = [], fold: number[] = [];

  const keep = (x: number, y: number, z: number, nx: number, ny: number, nz: number, p: number) => {
    // squeeze the width toward the front; facing directions follow the stretch
    const k = taper(x);
    z *= k;
    nz /= k;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const [sx, sy] = sideOf(x, y);
    let f: number, r = -1;
    if (p === CORTEX) {
      r = patchAt(sx, sy);
      f = grooveDist(sx, sy) < 0.016 && r < 0 && Math.abs(z) > 0.12 ? 0 : folds3(x, y, z);
      // ridges stand out and grooves sink in, so the outline is bumpy too
      const d = (f - 0.5) * 0.02;
      x += nx * d; y += ny * d; z += nz * d;
    } else if (p === CEREBELLUM) f = 0.5 + 0.5 * Math.sin(y * 150 + x * 25); // fine parallel folds
    else { f = 0.55; r = CALM; }
    pos.push(x, y, z); nrm.push(nx, ny, nz); part.push(p); region.push(r); fold.push(f);
  };

  // each body's share of the points, by about how much surface it shows
  const share = [0.33, 0.33, 0.08, 0.08, 0.06, 0.06];
  BODIES.forEach((b, bi) => {
    const want = count * share[bi];
    const tries = Math.round(want * 2.4);
    const cand = new Float32Array(tries * 7);
    let wmax = 0, wsum = 0;
    for (let k = 0; k < tries; k++) {
      // a direction from the body's centre (evenly spread over a sphere), out to where it meets the surface
      const dy = 1 - (2 * (k + 0.5)) / tries, rr = Math.sqrt(1 - dy * dy), a = k * GOLDEN;
      const dx = Math.cos(a) * rr, dz = Math.sin(a) * rr;
      const ry = dy >= 0 ? b.r[1] : b.down;
      const s = Math.pow(pw(dx / b.r[0], b.n) + pw(dy / ry, b.n) + pw(dz / b.r[2], b.n), -1 / b.n);
      const px = dx * s, py = dy * s, pz = dz * s;
      // the surface's facing direction: where its level rises fastest
      let nx = (Math.sign(px) * pw(px / b.r[0], b.n - 1)) / b.r[0];
      let ny = (Math.sign(py) * pw(py / ry, b.n - 1)) / ry;
      let nz = (Math.sign(pz) * pw(pz / b.r[2], b.n - 1)) / b.r[2];
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl; ny /= nl; nz /= nl;
      // stretching evenly spread directions onto a long body thins them out at its ends: weigh each by the area it stands for
      const w = (s * s) / Math.max(0.08, dx * nx + dy * ny + dz * nz);
      wmax = Math.max(wmax, w);
      wsum += w;
      const o = k * 7;
      cand[o] = px + b.c[0]; cand[o + 1] = py + b.c[1]; cand[o + 2] = pz + b.c[2];
      cand[o + 3] = nx; cand[o + 4] = ny; cand[o + 5] = nz; cand[o + 6] = w;
    }
    const ratio = (want * wmax) / wsum;
    for (let i = 0; i < cand.length; i += 7) {
      if (rand() > (cand[i + 6] / wmax) * ratio) continue;
      const x = cand[i], y = cand[i + 1], z = cand[i + 2];
      if (insideBrain(x, y, z * taper(x), bi, 0.985)) continue; // hidden inside another part
      keep(x, y, z, cand[i + 3], cand[i + 4], cand[i + 5], b.part);
    }
  });

  // the stem: rings around its slanted axis
  const dx = STEM_B[0] - STEM_A[0], dy = STEM_B[1] - STEM_A[1], len = Math.hypot(dx, dy);
  const ux = dy / len, uy = -dx / len; // across the axis, in the side view
  const rings = Math.max(8, Math.round(Math.sqrt(count * 0.03) * 1.4)), around = Math.max(10, Math.round((count * 0.03) / rings));
  for (let i = 0; i < rings; i++) {
    const s = (i + 0.5) / rings, r = stemRadius(s);
    for (let j = 0; j < around; j++) {
      const a = ((j + (i % 2) * 0.5) / around) * Math.PI * 2;
      const nx = Math.cos(a) * ux, ny = Math.cos(a) * uy, nz = Math.sin(a);
      const x = STEM_A[0] + dx * s + nx * r, y = STEM_A[1] + dy * s + ny * r, z = nz * r;
      if (insideBrain(x, y, z * taper(x), BODIES.length, 0.985)) continue;
      keep(x, y, z, nx, ny, nz, STEM);
    }
  }

  const n = part.length;
  const out: BrainCloud = {
    n,
    pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), part: Uint8Array.from(part), region: Int8Array.from(region),
    fold: Float32Array.from(fold), phase: new Float32Array(n), centres: new Float32Array(PATCHES.length * 3),
  };
  for (let i = 0; i < n; i++) out.phase[i] = rand();
  // the middle of each region's points on the +z side, pushed back out to the surface
  const sums = new Float64Array(PATCHES.length * 4);
  for (let i = 0; i < n; i++) {
    const r = out.region[i];
    if (r < 0 || out.pos[i * 3 + 2] < 0.02) continue;
    for (let k = 0; k < 3; k++) sums[r * 4 + k] += out.pos[i * 3 + k];
    sums[r * 4 + 3]++;
  }
  PATCHES.forEach((p, r) => {
    const m = sums[r * 4 + 3];
    const c = m ? [sums[r * 4] / m, sums[r * 4 + 1] / m, sums[r * 4 + 2] / m] : [p.x - CX, CY - p.y, 0.3];
    out.centres.set(c, r * 3);
  });
  return out;
}
