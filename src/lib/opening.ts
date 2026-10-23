// The app's opening, signed in: on a dark screen thousands of letters close in from every side and spiral into the brain,
// it whips round and slows, a white-hot wave runs through it from front to back leaving its regions lit, then the camera
// closes in and flies straight through it, the letters streaking past, and the journal opens up from inside like an iris.
// Drawn like the intro's brain (components/AsciiBrain.tsx): buildBrain()'s points turned, lit and set as letters on a
// grid, the nearest in each cell. A tap or a key hurries it along; it never goes in before the journal is ready behind it.
import { CORES } from '../data/emotions';
import { PATCHES, pulse } from './brainShape';
import { CEREBELLUM, buildBrain, sideOf, type BrainCloud } from './brain3d';

const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const RAMP = ' .,-~:;=!*#%@'; // dark to bright
const SCRAMBLE = '!<>-_/\\[]{}=+*^?#%&$01';
const STREAK = '-\\|/'; // a streak's letter by its slant
const FLY = 0.55;       // seconds each letter takes to close in
const SPREAD = 0.04;    // the last one sets off this much later
const LAND = 0.16;      // a letter flashes this long as it lands
const IGNITE = 0.56;    // when the wave sets off from the front
const SWEEP = 0.36;     // until it reaches the back
const HOLD = 0.95;      // the soonest the camera closes in
const DIVE = 0.7;       // seconds flying in through the brain
const REVEAL = 0.55;    // how far into the dive the journal is put in behind and the iris opens
const CAM = 3.4, CAM_FAR = 5.2, CAM_IN = 0.1; // the eye's distance from the brain's middle
const SWIRL = 2.4;      // radians the letters turn as they close in
const WHIP = 2.8;       // radians the brain turns as it comes together, slowing to a drift
const LEVEL = 0.42;     // how lit the regions stay once the wave has passed
const MIN_FRAME = 16;   // 60fps at most, even on a faster screen

// colour rows in the letter atlas: the plain brain, the cerebellum, white-hot, then one per region
const BASE = 0, SMALL = 1, HOT = 2, REGION = 3;

type RGB = [number, number, number];
const hex = (s: string): RGB => {
  const n = parseInt(s.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const out3 = (t: number) => 1 - (1 - t) ** 3;
const inOut3 = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2);

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/**
 * Play the opening on `cover`, a full-screen element over the app. `reveal` is called once the brain fills the screen,
 * for the journal to be put in behind; the promise settles when the iris has opened onto it.
 */
export function playOpening(cover: HTMLElement, ready: Promise<unknown>, reveal: () => void): Promise<void> {
  const el = cover.appendChild(document.createElement('canvas'));
  el.setAttribute('aria-hidden', 'true');
  const ctx = el.getContext('2d')!;
  const rand = rng(53);
  const meta = document.querySelector('meta[name="theme-color"]'), color = meta?.getAttribute('content');
  meta?.setAttribute('content', '#050507');

  let cloud: BrainCloud | null = null;
  let spin = new Float32Array(0), reach = new Float32Array(0), lift = new Float32Array(0), delay = new Float32Array(0);
  let w = 0, h = 0, dpr = 1, cols = 0, rows = 0, cw = 8, ch = 15, unit = 100, fontPx = 12, far = 3;
  let depth = new Float32Array(0), who = new Int32Array(0), trail = new Uint8Array(0), trailA = new Float32Array(0), trailC = new Uint8Array(0);
  const atlas = document.createElement('canvas');
  let tile = 0, glyphAt = new Map<string, number>();

  let s = 0, diveAt = -1, hurry = false, isReady = false, revealed = false, leaving = false, finished = false;
  let raf = 0, last = 0, frameMs = MIN_FRAME, slow = 0;
  let done!: () => void;
  const over = new Promise<void>((r) => { done = r; });
  void ready.then(() => { isReady = true; }, () => { isReady = true; });

  /** Every letter in every colour, painted once; drawing one is then a small copy. */
  const paint = () => {
    const ink: RGB = [214, 220, 236];
    // the dark theme's colours, whatever the page's: they glow on black
    const palette = [ink, mix(ink, [120, 130, 160], 0.45), [255, 244, 214], ...PATCHES.map((p) => mix(hex(CORES.find((c) => c.id === p.world)?.color[1] ?? '#888888'), [255, 255, 255], 0.22))];
    const chars = [...new Set([...RAMP, ...SCRAMBLE, ...STREAK].filter((c) => c.trim()))];
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
      chars.forEach((g, i) => a.fillText(g, i * tile + tile / 2, row * tile + tile / 2));
    });
  };

  const size = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (innerWidth === w && innerHeight === h && ratio === dpr) return;
    w = innerWidth; h = innerHeight; dpr = ratio;
    cols = clamp(Math.round(w / (w < 600 ? 5.2 : 6.6)), 56, 210); // finer letters on a phone, or the brain looks coarse
    cw = w / cols;
    ch = cw * 1.9;
    rows = Math.max(10, Math.ceil(h / ch));
    fontPx = Math.min(cw / 0.62, ch * 0.9);
    unit = Math.min(w / 1.65, h / 2.3);
    far = Math.hypot(w, h) / 2 / unit; // from the middle to a corner, in the brain's units
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    const cells = cols * rows;
    depth = new Float32Array(cells); who = new Int32Array(cells);
    trail = new Uint8Array(cells); trailA = new Float32Array(cells); trailC = new Uint8Array(cells);
    paint();
  };

  const draw = () => {
    if (!cloud) return;
    const { pos, nrm, part, region, fold, phase, n } = cloud;
    const u = diveAt < 0 ? 0 : clamp((s - diveAt) / DIVE, 0, 1);
    const near = CAM_FAR + (CAM - CAM_FAR) * out3(clamp(s / HOLD, 0, 1));
    const cam = near - (near - CAM_IN) * u ** 1.6;
    const fade = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25;
    const yaw = -0.55 - WHIP * (1 - out3(clamp(s / HOLD, 0, 1))) + 0.22 * s;
    const pitch = -0.16 + 0.06 * Math.sin(s * 0.8);
    const roll = 0.55 * u * u; // a slow barrel roll on the way in
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    const ox = w / 2, oy = h / 2, burst = u * u;
    const wave = -0.85 + ((s - IGNITE) / SWEEP) * 1.7;
    const lx = -0.45, ly = 0.6, lz = 0.7, ll = Math.hypot(lx, ly, lz);

    depth.fill(-1e9);
    who.fill(-1);
    trailA.fill(0);

    // where a point lands on the screen: px, py, its depth, or null behind the eye
    let px = 0, py = 0, pz = 0;
    const toScreen = (x: number, y: number, z: number, eye: number) => {
      const d = eye - z;
      if (d < 0.12) return false;
      const f = (CAM / d) * unit;
      const rx = x * cr - y * sr, ry = x * sr + y * cr;
      px = ox + rx * f; py = oy - (ry + 0.03) * f; pz = z;
      return true;
    };
    // a streak from (x0, y0) to just before (x1, y1), fading toward its tail
    const streak = (x0: number, y0: number, x1: number, y1: number, alpha: number, color: number) => {
      const c0 = x0 / cw, r0 = y0 / ch, dc = x1 / cw - c0, dr = y1 / ch - r0;
      const len = Math.min(7, Math.floor(Math.max(Math.abs(dc), Math.abs(dr))));
      if (len < 1) return;
      const slant = ((Math.round(Math.atan2(dr * ch, dc * cw) / (Math.PI / 4)) % 4) + 4) % 4;
      for (let k = 0; k < len; k++) {
        const t = k / len, col = Math.floor(c0 + dc * t), row = Math.floor(r0 + dr * t);
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
        const c = row * cols + col, a = alpha * (0.25 + 0.75 * t);
        if (a > trailA[c]) { trailA[c] = a; trail[c] = slant; trailC[c] = color; }
      }
    };

    // 1. every point onto the grid, nearest wins; the ones still flying, and all of them on the way in, leave streaks
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      let x = pos[o], y = pos[o + 1], z = pos[o + 2];
      const e = (s - delay[i]) / FLY;
      if (e <= 0) continue;
      if (burst) {
        const push = burst * (0.25 + phase[i] * 0.9);
        x += nrm[o] * push; y += nrm[o + 1] * push; z += nrm[o + 2] * push;
      }
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const flying = e < 1;
      if (flying) {
        // closing in from off the screen in a ring, turning as it comes
        const k = inOut3(e), at = (k0: number) => {
          const r = reach[i] * far * (1 - k0), a = spin[i] + SWIRL * (1 - k0) ** 2;
          return toScreen(x1 * k0 + Math.cos(a) * r, y2 * k0 + Math.sin(a) * r, z2 * k0 + lift[i] * (1 - k0), cam);
        };
        let tx = NaN, ty = 0;
        if (i % 3 === 0 && at(inOut3(Math.max(0, e - 0.07)))) { tx = px; ty = py; }
        if (!at(k)) continue;
        if (tx === tx) streak(tx, ty, px, py, (0.2 + 0.6 * e) * fade, region[i] >= 0 ? REGION + region[i] : BASE);
      } else {
        // facing away: hidden behind the front anyway
        const nz = nrm[o + 1] * sp + (-nrm[o] * sy + nrm[o + 2] * cy) * cp;
        if (nz < -0.15 - u * 0.6) continue;
        let tx = NaN, ty = 0;
        if (u > 0.05 && i % 3 === 0 && toScreen(x1, y2, z2, cam + 0.12 + 0.5 * u)) { tx = px; ty = py; }
        if (!toScreen(x1, y2, z2, cam)) continue;
        if (tx === tx) streak(tx, ty, px, py, (0.3 + 0.7 * u) * fade, region[i] >= 0 ? REGION + region[i] : BASE);
      }
      const col = Math.floor(px / cw), row = Math.floor(py / ch);
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      const c = row * cols + col;
      if (pz > depth[c]) { depth[c] = pz; who[c] = i; }
    }

    // 2. close pinholes between neighbours at the same depth
    for (let row = 0; row < rows; row++) {
      for (let col = 1; col < cols - 1; col++) {
        const c = row * cols + col;
        if (who[c] < 0 && who[c - 1] >= 0 && who[c + 1] >= 0 && Math.abs(depth[c - 1] - depth[c + 1]) < 0.1) { who[c] = who[c - 1]; depth[c] = depth[c - 1]; }
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.imageSmoothingEnabled = false;
    const half = tile / 2;
    const put = (glyph: string, color: number, c: number, alpha: number) => {
      const g = glyphAt.get(glyph);
      if (g === undefined || alpha <= 0.01) return;
      const col = c % cols, row = (c - col) / cols;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(atlas, g * tile, color * tile, tile, tile, Math.round((col + 0.5) * cw * dpr - half), Math.round((row + 0.5) * ch * dpr - half), tile, tile);
    };

    // 3. each cell once: the brain's letter, or else a streak's
    const top = RAMP.length - 1;
    for (let c = 0; c < who.length; c++) {
      const i = who[c];
      if (i < 0) {
        if (trailA[c] > 0) put(STREAK[trail[c]], trailC[c], c, trailA[c]);
        continue;
      }
      const o = i * 3;
      const e = (s - delay[i]) / FLY;
      const r = region[i];
      if (e < 1) {
        // still flying: a letter that hasn't decided what it is yet
        put(SCRAMBLE[(i * 7 + Math.floor(s * 20)) % SCRAMBLE.length], r >= 0 && phase[i] < 0.6 ? REGION + r : BASE, c, (0.3 + 0.7 * e) * fade);
        continue;
      }
      const nx = nrm[o], ny = nrm[o + 1], nz0 = nrm[o + 2];
      const nx1 = nx * cy + nz0 * sy, nz1 = -nx * sy + nz0 * cy;
      const ny2 = ny * cp - nz1 * sp, nz2 = ny * sp + nz1 * cp;
      const diffuse = Math.max(0, (nx1 * lx + ny2 * ly + nz2 * lz) / ll);
      const rim = (1 - Math.max(0, nz2)) ** 3;
      const f = fold[i];
      let b = 0.06 + 0.78 * diffuse * (0.5 + 0.5 * f) + 0.3 * rim;
      if (f === 0) b *= 0.35; // the deep grooves between the lobes
      let color = part[i] === CEREBELLUM ? SMALL : BASE;
      // the wave: white-hot where it is, the regions lit behind it
      const passed = wave - pos[o];
      if (r >= 0 && passed > 0) {
        const [sx, sy2] = sideOf(pos[o], pos[o + 1]);
        const glow = (LEVEL + (1 - LEVEL) * Math.exp(-passed * 2.4)) * (0.35 + 0.65 * pulse(PATCHES[r].world, s, phase[i], sx, sy2)) + u * 1.2;
        if (glow > 0.2) { color = REGION + r; b = Math.max(b, 0.2) * (0.55 + 0.45 * diffuse) + glow * 0.55; }
      } else if (passed > 0) b += 0.3 * Math.exp(-passed * 5) + u * 0.4;
      if (Math.abs(passed) < 0.05) { color = HOT; b = Math.max(b, 0.9); }
      if (e < 1 + LAND / FLY) { color = HOT; b += 0.5; } // just landed: a flash
      if (cam - depth[c] < 0.9) { color = HOT; b = 1; } // rushing past the eye
      b = clamp(b, 0, 1);
      put(RAMP[Math.max(1, Math.round(b * top))], color, c, (0.3 + 0.7 * b) * fade);
    }
    ctx.globalAlpha = 1;
  };

  const step = (dt: number) => {
    s += dt;
    if (diveAt < 0 && isReady && (s >= HOLD || (hurry && s >= 0.25))) {
      diveAt = s;
      cover.classList.add('diving');
    }
    const u = diveAt < 0 ? 0 : (s - diveAt) / DIVE;
    if (!revealed && u >= REVEAL) { revealed = true; reveal(); }
    if (!leaving && u >= REVEAL + 0.04) {
      // the app is in behind by now: the iris opens onto it
      leaving = true;
      cover.classList.add('out');
      setTimeout(finish, 1000); // in case the animation never ends
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (last && now - last < frameMs - 2) { schedule(); return; }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    try {
      step(dt);
      const t0 = performance.now();
      draw();
      // a phone that can't keep up draws 30 times a second instead of 60
      slow = performance.now() - t0 > 13 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 8) frameMs = 33;
    } catch (e) {
      console.error('The opening stopped', e);
      return finish();
    }
    schedule();
  };
  const schedule = () => { if (!raf && !finished && cloud) raf = requestAnimationFrame(frame); };

  const onHurry = () => { hurry = true; };
  const onEnd = (e: AnimationEvent) => { if (e.animationName === 'opening-iris') finish(); }; // not the glow behind
  function finish() {
    if (finished) return;
    finished = true;
    reveal();
    cancelAnimationFrame(raf);
    clearTimeout(start);
    removeEventListener('resize', size);
    removeEventListener('keydown', onHurry);
    cover.removeEventListener('pointerdown', onHurry);
    cover.removeEventListener('animationend', onEnd);
    if (color) meta?.setAttribute('content', color);
    done();
  }

  addEventListener('resize', size);
  addEventListener('keydown', onHurry);
  cover.addEventListener('pointerdown', onHurry);
  cover.addEventListener('animationend', onEnd);
  // building the brain takes a moment: let the dark screen paint first
  const start = setTimeout(() => {
    size();
    cloud = buildBrain(innerWidth < 700 ? 13000 : 22000);
    // each letter sets off from a ring just past the corners of the screen, in its own time
    spin = new Float32Array(cloud.n); reach = new Float32Array(cloud.n); lift = new Float32Array(cloud.n); delay = new Float32Array(cloud.n);
    for (let i = 0; i < cloud.n; i++) {
      spin[i] = rand() * Math.PI * 2;
      reach[i] = 1.02 + rand() * 0.18;
      lift[i] = rand() * 0.6;
      delay[i] = rand() * SPREAD;
    }
    schedule();
  }, 30);
  return over;
}
