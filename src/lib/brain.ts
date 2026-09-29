/*
 * A procedural 3D brain, grown as a dense cloud of surface points (position, normal, crest/crease
 * value, region). Nothing is loaded: each hemisphere is a lumpy superellipsoid whose surface is
 * folded with domain-warped noise, plus the big named grooves (lateral, central, parieto-occipital),
 * a cerebellum with fine parallel folia and a brainstem. The normals come from the finished mesh, so
 * every fold catches the light. Model space: +x right, +y up, +z toward the front; about 1.8 long.
 */

export const REGIONS = ['frontal', 'parietal', 'temporal', 'occipital', 'cerebellum', 'stem'] as const;
export type Region = (typeof REGIONS)[number];

export interface BrainCloud {
  n: number;
  pos: Float32Array; // x, y, z per point
  nor: Float32Array; // unit outward normals
  ao: Float32Array;  // 0 in the bottom of a crease … 1 on a crest
  reg: Uint8Array;   // index into REGIONS
}

/* ---------- noise ---------- */

function makeNoise(seed: number) {
  const base = Array.from({ length: 256 }, (_, i) => i);
  let s = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  const grad = (h: number, x: number, y: number, z: number) => {
    h &= 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };
  return (x: number, y: number, z: number) => {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    const X = fx & 255, Y = fy & 255, Z = fz & 255;
    x -= fx; y -= fy; z -= fz;
    const u = x * x * x * (x * (x * 6 - 15) + 10);
    const v = y * y * y * (y * (y * 6 - 15) + 10);
    const w = z * z * z * (z * (z * 6 - 15) + 10);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    const l = (a: number, b: number, t: number) => a + t * (b - a);
    return l(
      l(l(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), l(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      l(l(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), l(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w,
    );
  };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Smoothstep that also works with e0 > e1. */
const ss = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = (d: number, w: number) => Math.exp(-(d * d) / (w * w));

/* ---------- shape ---------- */

const HP = 2.4;                 // superellipsoid exponent: a little boxier than an ellipsoid
const HC = [0.36, 0.1, 0.03];   // hemisphere centre (the right one; the left is mirrored)
const HAX = 0.335;              // half-width; the medial edge sits at x = 0.03
const MED = 0.03;

/** Distance from the hemisphere centre to its surface along a unit direction. */
function hemiRadius(dx: number, dy: number, dz: number) {
  const ay = dy > 0 ? 0.46 : 0.4, az = dz > 0 ? 0.86 : 0.83;
  return Math.pow(Math.pow(Math.abs(dx) / HAX, HP) + Math.pow(Math.abs(dy) / ay, HP) + Math.pow(Math.abs(dz) / az, HP), -1 / HP);
}
/** < 1 inside the plain hemisphere shape. */
function hemiF(x: number, y: number, z: number) {
  const dx = Math.abs(x) - HC[0], dy = y - HC[1], dz = z - HC[2];
  const ay = dy > 0 ? 0.46 : 0.4, az = dz > 0 ? 0.86 : 0.83;
  return Math.pow(Math.abs(dx) / HAX, HP) + Math.pow(Math.abs(dy) / ay, HP) + Math.pow(Math.abs(dz) / az, HP);
}

const CB = { c: [0, -0.37, -0.5], ax: 0.44, ay: 0.19, az: 0.3, p: 2.3 };

const N = makeNoise(1337);

/** The lateral fissure: where the temporal lobe meets the frontal and parietal ones. */
const sylvY = (z: number) => -0.2 + 0.36 * (0.45 - z);
/** The central sulcus: the frontal/parietal border, running forward as it goes down the side. */
const centralZ = (x: number) => -0.05 + 0.3 * (x - MED);
/** The parieto-occipital border, a little further back at the top. */
const occipZ = (y: number) => -0.42 - 0.2 * (y - 0.1);

/** Folds for the cerebrum: how far in (positive) the surface sits at q, and how open to the light. */
function cortex(x: number, y: number, z: number): [number, number] {
  const wx = N(x * 2.2 + 11, y * 2.2, z * 2.2) * 0.085;
  const wy = N(x * 2.2, y * 2.2 + 7, z * 2.2) * 0.085;
  const wz = N(x * 2.2, y * 2.2, z * 2.2 + 3) * 0.085;
  const px = x + wx, py = y + wy, pz = z + wz;
  const a = N(px * 4.2, py * 4.7, pz * 4.2) * 0.84 + N(px * 8.4 + 3, py * 8.4, pz * 8.4) * 0.16;
  const c1 = 1 - ss(0, 0.12, Math.abs(a));
  const crest = ss(0.1, 0.4, Math.abs(a));
  const b = N(px * 9.5 + 9, py * 9.5, pz * 9.5 + 5);
  const c2 = (1 - ss(0, 0.08, Math.abs(b))) * (1 - c1) * 0.55;
  const depth = 0.046 * c1 + 0.014 * c2 - 0.016 * crest;
  return [depth, clamp(1 - 0.92 * c1 - 0.5 * c2, 0, 1)];
}

/* ---------- building ---------- */

const tick = () => new Promise<void>((r) => setTimeout(r));

interface Bag {
  pos: number[]; nor: number[]; ao: number[]; reg: number[];
}

/** Normals from a (wrapped in u, open in v) grid of surface points. The grid's winding is the same everywhere, so which way is out is decided once, by vote. */
function gridNormals(Q: Float32Array, U: number, V: number, cx: number, cy: number, cz: number, out: Float32Array) {
  let votes = 0;
  const flat = new Uint8Array(U * V);
  for (let j = 0; j < V; j++) {
    const j0 = Math.max(0, j - 1), j1 = Math.min(V - 1, j + 1);
    for (let i = 0; i < U; i++) {
      const i0 = (i + U - 1) % U, i1 = (i + 1) % U;
      const a = (j * U + i0) * 3, b = (j * U + i1) * 3, c = (j0 * U + i) * 3, d = (j1 * U + i) * 3;
      const ux = Q[b] - Q[a], uy = Q[b + 1] - Q[a + 1], uz = Q[b + 2] - Q[a + 2];
      const vx = Q[d] - Q[c], vy = Q[d + 1] - Q[c + 1], vz = Q[d + 2] - Q[c + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const k = (j * U + i) * 3;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) {
        const rx = Q[k] - cx, ry = Q[k + 1] - cy, rz = Q[k + 2] - cz, rl = Math.hypot(rx, ry, rz) || 1;
        out[k] = rx / rl; out[k + 1] = ry / rl; out[k + 2] = rz / rl;
        flat[j * U + i] = 1;
      } else {
        out[k] = nx / l; out[k + 1] = ny / l; out[k + 2] = nz / l;
        votes += (nx * (Q[k] - cx) + ny * (Q[k + 1] - cy) + nz * (Q[k + 2] - cz) < 0 ? -1 : 1);
      }
    }
  }
  if (votes < 0) for (let k = 0; k < U * V; k++) if (!flat[k]) { out[k * 3] = -out[k * 3]; out[k * 3 + 1] = -out[k * 3 + 1]; out[k * 3 + 2] = -out[k * 3 + 2]; }
}

async function hemisphere(side: 1 | -1, U: number, V: number, bag: Bag, progress: (f: number) => void) {
  const Q = new Float32Array(U * V * 3);
  const AO = new Float32Array(U * V);
  const RG = new Uint8Array(U * V);
  const off = side < 0 ? 9.1 : 0; // the two halves fold differently
  const dT = [0.55, -0.8, 0.34], lT = Math.hypot(dT[0], dT[1], dT[2]);
  const dF = [0.2, 0.1, 1], lF = Math.hypot(dF[0], dF[1], dF[2]);
  for (let j = 0; j < V; j++) {
    const v = ((j + 0.5) / V) * Math.PI, cv = Math.cos(v), sv = Math.sin(v);
    for (let i = 0; i < U; i++) {
      const u = (i / U) * Math.PI * 2;
      const dx = cv, dy = sv * Math.cos(u), dz = sv * Math.sin(u);
      let t = hemiRadius(dx, dy, dz);
      const gT = Math.exp(((dx * dT[0] + dy * dT[1] + dz * dT[2]) / lT - 1) / 0.11);
      const gF = Math.exp(((dx * dF[0] + dy * dF[1] + dz * dF[2]) / lF - 1) / 0.2);
      const gB = Math.exp((dy * -0.8 + dz * 0.6 - 1) / 0.17); // the underside of the frontal lobe, which sits higher than the temporal one
      t *= 1 + 0.2 * gT + 0.035 * gF - 0.14 * gB;
      let qx = HC[0] + dx * t, qy = HC[1] + dy * t, qz = HC[2] + dz * t;
      // a flatter medial wall, a narrower front and a narrower back
      let lx = qx - HC[0];
      if (lx < 0) lx = -HAX * Math.pow(Math.min(1, -lx / HAX), 0.72);
      qx = HC[0] + lx;
      qx = MED + (qx - MED) * (1 - 0.17 * ss(0.15, 0.85, qz)) * (1 - 0.11 * ss(-0.2, -0.85, qz));

      // regions and the named grooves, with a little wobble so the borders don't look ruled
      const wob = N(qx * 4, qy * 4, qz * 4) * 0.035;
      const sy = sylvY(qz + wob * 0.5);
      const lat = ss(0.28, 0.55, (qx - MED) / 0.66);
      const zm = ss(-0.52, -0.3, qz) * (1 - ss(0.42, 0.6, qz));
      const gs = gauss(qy - sy, 0.024) * lat * zm;
      const gst = gauss(qy - (sy - 0.15), 0.018) * lat * zm * 0.6;
      const above = ss(sy + 0.05, sy + 0.22, qy);
      const cz = centralZ(qx) + wob;
      const gc = gauss((qz - cz) * 0.96, 0.02) * above * (1 - ss(0.45, 0.6, qy));
      const oz = occipZ(qy) + wob;
      const gp = gauss(qz - oz, 0.022) * ss(0.05, 0.3, qy);
      const groove = Math.max(gs * 1.0, gc * 0.6, gp * 0.5, gst * 0.4);

      const [dep, ao] = cortex(qx + off, qy, qz);
      const depth = dep + 0.088 * gs + 0.05 * gc + 0.042 * gp + 0.03 * gst;

      let rx = qx - 0.3, ry = qy - 0.04, rz = qz - 0.03;
      const rl = Math.hypot(rx, ry, rz) || 1;
      rx /= rl; ry /= rl; rz /= rl;
      const k = (j * U + i) * 3;
      Q[k] = qx - rx * depth; Q[k + 1] = qy - ry * depth; Q[k + 2] = qz - rz * depth;
      AO[j * U + i] = clamp(ao * (1 - 0.88 * groove), 0, 1);

      const y = qy, z = qz;
      RG[j * U + i] =
        z < oz ? 3 : y < sy && z > -0.45 && z < 0.55 ? 2 : z > cz ? 0 : 1;
    }
    if ((j & 15) === 15) { progress(j / V); await tick(); }
  }
  const NOR = new Float32Array(U * V * 3);
  gridNormals(Q, U, V, 0.3, 0.05, 0.03, NOR);
  for (let k = 0; k < U * V; k++) {
    const x = Q[k * 3], y = Q[k * 3 + 1], z = Q[k * 3 + 2];
    bag.pos.push(x * side, y, z);
    bag.nor.push(NOR[k * 3] * side, NOR[k * 3 + 1], NOR[k * 3 + 2]);
    bag.ao.push(AO[k]);
    bag.reg.push(RG[k]);
  }
}

async function cerebellum(U: number, V: number, bag: Bag) {
  const Q = new Float32Array(U * V * 3), AO = new Float32Array(U * V);
  const { c, ax, ay, az, p } = CB;
  for (let j = 0; j < V; j++) {
    const v = ((j + 0.5) / V) * Math.PI, cv = Math.cos(v), sv = Math.sin(v);
    for (let i = 0; i < U; i++) {
      const u = (i / U) * Math.PI * 2;
      const dx = cv, dy = sv * Math.cos(u), dz = sv * Math.sin(u);
      const t = Math.pow(Math.pow(Math.abs(dx) / ax, p) + Math.pow(Math.abs(dy) / ay, p) + Math.pow(Math.abs(dz) / az, p), -1 / p);
      const qx = c[0] + dx * t, qy = c[1] + dy * t, qz = c[2] + dz * t;
      // folia: fine, wavy, parallel folds, with a shallow groove down the middle
      const wave = N(qx * 3.4, qy * 3.4, qz * 3.4) * 1.9 + N(qx * 9, qy * 9, qz * 9) * 0.6;
      const s = 0.5 + 0.5 * Math.sin(qy * 152 + wave);
      const vermis = gauss(qx, 0.028);
      const depth = 0.014 * (1 - s) + 0.03 * vermis;
      const rl = Math.hypot(dx * 1, dy * 1, dz * 1);
      const k = (j * U + i) * 3;
      Q[k] = qx - (dx / rl) * depth; Q[k + 1] = qy - (dy / rl) * depth; Q[k + 2] = qz - (dz / rl) * depth;
      AO[j * U + i] = clamp(0.25 + 0.75 * s - 0.5 * vermis, 0, 1);
    }
  }
  const NOR = new Float32Array(U * V * 3);
  gridNormals(Q, U, V, c[0], c[1], c[2], NOR);
  for (let k = 0; k < U * V; k++) {
    const x = Q[k * 3], y = Q[k * 3 + 1], z = Q[k * 3 + 2];
    if (hemiF(x, y, z) < 0.9) continue; // hidden under the cerebrum
    bag.pos.push(x, y, z);
    bag.nor.push(NOR[k * 3], NOR[k * 3 + 1], NOR[k * 3 + 2]);
    bag.ao.push(AO[k]);
    bag.reg.push(4);
  }
  await tick();
}

async function stem(U: number, V: number, bag: Bag) {
  const Q = new Float32Array(U * V * 3), AO = new Float32Array(U * V);
  const C = new Float32Array(U * V * 3);
  for (let j = 0; j < V; j++) {
    const s = j / (V - 1);
    const cy = -0.05 - 0.68 * s, cz = 0.0 - 0.2 * s - 0.05 * Math.sin(s * 3);
    const r0 = 0.12 * (1 - 0.28 * s) + 0.03 * (1 - s) * (1 - s);
    for (let i = 0; i < U; i++) {
      const u = (i / U) * Math.PI * 2;
      const cu = Math.cos(u), su = Math.sin(u);
      const front = Math.max(0, su); // +z side
      const pons = 0.42 * gauss(s - 0.24, 0.085) * front + 0.12 * gauss(s - 0.38, 0.06) * front;
      const r = r0 * (1 + pons);
      const rings = 0.5 + 0.5 * Math.sin(s * 95 + N(cu * 2, su * 2, s * 6) * 2.5);
      const k = (j * U + i) * 3;
      Q[k] = cu * r * 1.05; Q[k + 1] = cy; Q[k + 2] = cz + su * r * 0.92;
      C[k] = 0; C[k + 1] = cy; C[k + 2] = cz;
      AO[j * U + i] = 0.55 + 0.45 * (front > 0.4 ? rings : 0.85);
    }
  }
  const NOR = new Float32Array(U * V * 3);
  // the centre line moves with s, so use the ring centres for orientation
  for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) {
    const k = (j * U + i) * 3;
    const j0 = Math.max(0, j - 1), j1 = Math.min(V - 1, j + 1);
    const a = (j * U + (i + U - 1) % U) * 3, b = (j * U + (i + 1) % U) * 3, c0 = (j0 * U + i) * 3, d = (j1 * U + i) * 3;
    const ux = Q[b] - Q[a], uy = Q[b + 1] - Q[a + 1], uz = Q[b + 2] - Q[a + 2];
    const vx = Q[d] - Q[c0], vy = Q[d + 1] - Q[c0 + 1], vz = Q[d + 2] - Q[c0 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * (Q[k] - C[k]) + nz * (Q[k + 2] - C[k + 2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1;
    NOR[k] = nx / l; NOR[k + 1] = ny / l; NOR[k + 2] = nz / l;
  }
  for (let k = 0; k < U * V; k++) {
    const x = Q[k * 3], y = Q[k * 3 + 1], z = Q[k * 3 + 2];
    if (hemiF(x, y, z) < 0.92) continue;
    const cf = (x / CB.ax) ** 2 + ((y - CB.c[1]) / CB.ay) ** 2 + ((z - CB.c[2]) / CB.az) ** 2;
    if (cf < 0.92) continue;
    bag.pos.push(x, y, z);
    bag.nor.push(NOR[k * 3], NOR[k * 3 + 1], NOR[k * 3 + 2]);
    bag.ao.push(AO[k]);
    bag.reg.push(5);
  }
  await tick();
}

/** Grows the brain. `detail` scales the number of points (1 ≈ 250k). Yields to the browser as it goes. */
export async function buildBrain(detail = 1, onProgress?: (f: number) => void): Promise<BrainCloud> {
  const bag: Bag = { pos: [], nor: [], ao: [], reg: [] };
  const U = Math.round(460 * Math.sqrt(detail)), V = Math.round(230 * Math.sqrt(detail));
  const report = (a: number, span: number) => (f: number) => onProgress?.(a + f * span);
  await hemisphere(1, U, V, bag, report(0, 0.4));
  await hemisphere(-1, U, V, bag, report(0.4, 0.4));
  await cerebellum(Math.round(220 * Math.sqrt(detail)), Math.round(110 * Math.sqrt(detail)), bag);
  onProgress?.(0.92);
  await stem(Math.round(140 * Math.sqrt(detail)), Math.round(190 * Math.sqrt(detail)), bag);
  onProgress?.(1);
  const n = bag.reg.length;
  return { n, pos: Float32Array.from(bag.pos), nor: Float32Array.from(bag.nor), ao: Float32Array.from(bag.ao), reg: Uint8Array.from(bag.reg) };
}
