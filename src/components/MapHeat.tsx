// The map's heat: where you've felt things, drawn like the journal's sky. Each entry is a soft, breathing puff in
// the colour of its world, and where puffs gather the map fills with that world's letters (Sky's ramps), denser
// and brighter the more was felt there. Recent entries burn brighter; older ones linger, fainter.
// From home (where most was felt) one thread spills out and branches to every place, like a spill finding its way:
// thick near home, tapering to fine tips, in the colours of the places it joins, made of the same letters, with a
// glow seeping outward along it. It keeps the same width at every zoom.
import { useEffect, useRef } from 'preact/hooks';
import { RAMPS } from './Sky';

export interface HeatPoint {
  /** world units, 0–1 (Web Mercator) */
  x: number; y: number;
  core: string | null;
  /** how much it counts: recency and intensity */
  weight: number;
}

const WORLDS = ['joy', 'hope-interest', 'love-connection', 'calm-safety', 'sadness', 'fear', 'anger', 'shame-aversion'];
const NONE = WORLDS.length; // entries without a feeling take the ink colour
const KINDS = WORLDS.length + 1;
const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const SCALE = 4;          // the colour layer is drawn at 1/4 size and stretched, so it stays soft
const SPRITE = 64;
const R_WORLD = 5.7e-5;   // a puff's radius in world units (about 60px at street-level zoom 12)
const THREAD_STEP = 6;    // px between the thread's samples
const MIN_FRAME = 33;     // ~30fps is plenty for drifting clouds

type RGB = [number, number, number];
const hex = (s: string): RGB => {
  const m = s.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const worldOf = (core: string | null) => {
  const found = core ? WORLDS.indexOf(core) : -1;
  return found < 0 ? NONE : found;
};

export interface SpillNode {
  /** a place, in world units, with how much was felt there (own) and in everything beyond it (flow) */
  x: number; y: number; wi: number; own: number; flow: number;
  /** the place it branches from (an index into the list, always earlier), -1 for home */
  parent: number;
  /** the curve in from the parent: its two control points, and how far from home it starts and ends */
  c1: [number, number]; c2: [number, number]; s0: number; s1: number;
}

/**
 * The thread's shape: places (entries close together are one) joined by the shortest tree that reaches them all,
 * grown out from home, the place with the most felt around it. Home comes first; every place after its parent.
 */
export function spillTree(points: HeatPoint[]): SpillNode[] {
  let cells = new Map<string, { x: number; y: number; own: number; by: number[] }>();
  for (let bits = 20; bits >= 8; bits -= 2) {
    const g = 2 ** bits;
    cells = new Map();
    for (const p of points) {
      const key = `${Math.round(p.x * g)}:${Math.round(p.y * g)}`;
      const cell = cells.get(key) ?? { x: 0, y: 0, own: 0, by: new Array(KINDS).fill(0) };
      const wt = Math.max(0.01, p.weight);
      cell.x += p.x * wt; cell.y += p.y * wt; cell.own += wt;
      cell.by[worldOf(p.core)] += wt;
      cells.set(key, cell);
    }
    if (cells.size <= 1200) break;
  }
  const places = [...cells.values()].map((c) => ({ x: c.x / c.own, y: c.y / c.own, own: c.own, wi: c.by.indexOf(Math.max(...c.by)) }));
  const n = places.length;
  if (!n) return [];
  // home: the place with the most felt within a couple of kilometres of it
  const NEAR = 6e-5;
  let home = 0, most = -1;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) if (Math.abs(places[i].x - places[j].x) < NEAR && Math.abs(places[i].y - places[j].y) < NEAR) sum += places[j].own;
    if (sum > most) { most = sum; home = i; }
  }
  // Prim's tree from home
  const dist = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const order: number[] = [];
  dist[home] = 0;
  for (let step = 0; step < n; step++) {
    let next = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (next < 0 || dist[i] < dist[next])) next = i;
    done[next] = 1;
    order.push(next);
    const a = places[next];
    for (let i = 0; i < n; i++) {
      if (done[i]) continue;
      const d = Math.hypot(places[i].x - a.x, places[i].y - a.y);
      if (d < dist[i]) { dist[i] = d; from[i] = next; }
    }
  }
  const at = new Int32Array(n);
  order.forEach((p, i) => (at[p] = i));
  const nodes: SpillNode[] = order.map((p) => ({ ...places[p], flow: places[p].own, parent: from[p] < 0 ? -1 : at[from[p]], c1: [0, 0], c2: [0, 0], s0: 0, s1: 0 }));
  for (let i = n - 1; i > 0; i--) nodes[nodes[i].parent].flow += nodes[i].flow;

  // each place's way through: where the thread comes in from, leaning toward where most of it goes on to
  type V = [number, number];
  const unit = (v: V, or: V): V => { const l = Math.hypot(v[0], v[1]); return l > 1e-12 ? [v[0] / l, v[1] / l] : or; };
  const turn = (v: V, a: number): V => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  const dirOf = (i: number): V => { const P = nodes[nodes[i].parent]; return unit([nodes[i].x - P.x, nodes[i].y - P.y], [1, 0]); };
  const way: V[] = nodes.map(() => [0, 0]);
  for (let i = 1; i < n; i++) {
    const d = dirOf(i), f = nodes[i].flow;
    way[i] = [way[i][0] + d[0] * f, way[i][1] + d[1] * f];
    const p = nodes[i].parent;
    if (p > 0) way[p] = [way[p][0] + d[0] * f, way[p][1] + d[1] * f];
  }
  const BEND = 0.45;
  const leaf = new Uint8Array(n).fill(1);
  for (let i = 1; i < n; i++) leaf[nodes[i].parent] = 0;
  for (let i = 1; i < n; i++) {
    const N = nodes[i], P = nodes[N.parent], d = dirOf(i);
    const L = Math.hypot(N.x - P.x, N.y - P.y);
    const out = N.parent === 0 ? turn(d, -BEND * 0.6) : unit([d[0] + 0.8 * unit(way[N.parent], d)[0], d[1] + 0.8 * unit(way[N.parent], d)[1]], d);
    const inn = leaf[i] ? turn(d, BEND) : unit([d[0] + 0.8 * unit(way[i], d)[0], d[1] + 0.8 * unit(way[i], d)[1]], d);
    N.c1 = [P.x + out[0] * L * 0.35, P.y + out[1] * L * 0.35];
    N.c2 = [N.x - inn[0] * L * 0.35, N.y - inn[1] * L * 0.35];
    N.s0 = P.s1;
    N.s1 = N.s0 + L * 1.05;
  }
  return nodes;
}

export function MapHeat(props: { points: HeatPoint[]; view: { x: number; y: number; z: number } | null; w: number; h: number }) {
  const glyphRef = useRef<HTMLCanvasElement>(null);
  const cloudRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const poke = useRef<() => void>();

  useEffect(() => {
    const glyphCv = glyphRef.current!, cloudCv = cloudRef.current!;
    const g = glyphCv.getContext('2d')!, c = cloudCv.getContext('2d')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let w = 0, h = 0, dpr = 1, sp = 14, font = 11, cols = 0, rows = 0;
    let heat = new Float32Array(0), byWorld = new Float32Array(0);
    let dark = false;
    let puffs: HTMLCanvasElement[] = [];
    let strand: string[] = []; // the thread's colour in each world
    let spill: SpillNode[] = [], spillFor: HeatPoint[] | null = null;
    // the letters: per world, its ramp's characters in two rows (warm, and hot where the heat is strongest)
    const atlas = document.createElement('canvas');
    let tile = 0, levels: number[][][] = [];

    const palette = () => {
      const css = getComputedStyle(cloudCv);
      dark = document.documentElement.dataset.theme === 'dark';
      const ink = hex(css.getPropertyValue('--ink'));
      const tones = [...WORLDS.map((k) => hex(css.getPropertyValue(`--emo-${k}`))), mix(ink, [128, 128, 128], 0.3)];
      strand = tones.map((col) => rgba(dark ? mix(col, [255, 255, 255], 0.2) : col, 1));
      puffs = tones.map((col) => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = SPRITE;
        const x = cv.getContext('2d')!;
        const grad = x.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
        grad.addColorStop(0, rgba(col, 0.75));
        grad.addColorStop(0.5, rgba(col, 0.35));
        grad.addColorStop(1, rgba(col, 0));
        x.fillStyle = grad;
        x.fillRect(0, 0, SPRITE, SPRITE);
        return cv;
      });
      tile = Math.ceil(font * 1.6 * dpr);
      const ramps = [...WORLDS.map((k) => RAMPS[k] ?? RAMPS.default), RAMPS.default];
      const glyphs = ramps.map((ramp) => [...new Set(ramp.join('').replace(/\s/g, ''))]);
      levels = ramps.map((ramp, wi) => ramp.map((level) => (level.trim() ? [...level].map((ch) => glyphs[wi].indexOf(ch)) : [])));
      atlas.width = Math.max(...glyphs.map((gl) => gl.length)) * tile;
      atlas.height = KINDS * 2 * tile;
      const a = atlas.getContext('2d')!;
      a.font = `${font * dpr}px ${FONT}`;
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      tones.forEach((col, wi) => {
        const warm = dark ? mix(col, [255, 255, 255], 0.25) : mix(col, [0, 0, 0], 0.15);
        const hot = dark ? mix(mix(col, [255, 210, 150], 0.35), [255, 255, 255], 0.45) : mix(col, [0, 0, 0], 0.35);
        [warm, hot].forEach((shade, r) => {
          a.fillStyle = rgba(shade, 1);
          glyphs[wi].forEach((ch, gi) => a.fillText(ch, gi * tile + tile / 2, (wi * 2 + r) * tile + tile / 2));
        });
      });
    };

    const resize = (W: number, H: number) => {
      w = W; h = H;
      dpr = Math.min(devicePixelRatio || 1, 2);
      glyphCv.width = Math.round(w * dpr); glyphCv.height = Math.round(h * dpr);
      cloudCv.width = Math.ceil(w / SCALE); cloudCv.height = Math.ceil(h / SCALE);
      const wide = w >= 720;
      sp = wide ? 16 : 14;
      font = wide ? 12 : 11;
      cols = Math.ceil(w / sp) + 1; rows = Math.ceil(h / sp) + 1;
      heat = new Float32Array(cols * rows);
      byWorld = new Float32Array(cols * rows * KINDS);
      palette();
    };

    const draw = (now: number) => {
      const { points, view, w: W, h: H } = latest.current;
      if (!W || !H || !view) return;
      if (W !== w || H !== h) resize(W, H);
      const t = now / 1000;
      const k = 256 * 2 ** view.z;
      const left = view.x * k - w / 2, top = view.y * k - h / 2;
      const r0 = clamp(R_WORLD * k, 30, 72);

      c.setTransform(1 / SCALE, 0, 0, 1 / SCALE, 0, 0);
      c.clearRect(0, 0, w, h);
      heat.fill(0);
      byWorld.fill(0);
      /** Adds a soft round of heat to the letter grid, looking only at the cells it can reach. */
      const splat = (cx: number, cy: number, r: number, f0: number, wi: number) => {
        const rr = r * r;
        const row0 = Math.max(0, Math.ceil((cy - r - sp / 2) / sp)), row1 = Math.min(rows - 1, Math.floor((cy + r - sp / 2) / sp));
        for (let row = row0; row <= row1; row++) {
          const shift = (row & 1) * (sp / 3);
          const dy = row * sp + sp / 2 - cy;
          const col0 = Math.max(0, Math.ceil((cx - r - shift) / sp)), col1 = Math.min(cols - 1, Math.floor((cx + r - shift) / sp));
          for (let col = col0; col <= col1; col++) {
            const dx = col * sp + shift - cx;
            const u = (dx * dx + dy * dy) / rr;
            if (u >= 1) continue;
            const f = (1 - u) * (1 - u) * f0;
            const cell = row * cols + col;
            heat[cell] += f;
            byWorld[cell * KINDS + wi] += f;
          }
        }
      };

      // the places: a breathing puff each, in its world's colour
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const ph = i * 2.399; // a golden-angle phase each, so they don't breathe in step
        const r = r0 * (0.8 + 0.25 * Math.min(2, p.weight)) * (1 + 0.12 * Math.sin(t * 0.6 + ph));
        const cx = p.x * k - left + Math.sin(t * 0.35 + ph) * r * 0.08;
        const cy = p.y * k - top + Math.cos(t * 0.3 + ph * 1.3) * r * 0.06;
        if (cx < -r || cy < -r || cx > w + r || cy > h + r) continue;
        const wi = worldOf(p.core);
        c.globalAlpha = Math.min(0.9, 0.55 * p.weight);
        c.drawImage(puffs[wi], cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);
        splat(cx, cy, r, p.weight, wi);
      }

      // the spill: one branching thread running out from home to every place, thickest where the most has
      // flowed through it and tapering to fine tips, with a glow running outward along it
      if (spillFor !== points) { spill = spillTree(points); spillFor = points; }
      const total = spill.length ? spill[0].flow : 1;
      const width = (f: number) => 1.6 + 8.5 * Math.sqrt(Math.max(0, f) / total); // half-width, px, the same at any zoom
      const sx = (x: number) => x * k - left, sy = (y: number) => y * k - top;
      for (const node of spill) {
        const P = node.parent >= 0 ? spill[node.parent] : null;
        if (!P) continue;
        const pts = [[P.x, P.y], node.c1, node.c2, [node.x, node.y]].map(([x, y]) => [sx(x), sy(y)]);
        const w0 = width(node.flow), w1 = width(node.flow - node.own * 0.7);
        const pad = w0 * 3 + 20;
        if (Math.max(...pts.map((q) => q[0])) < -pad || Math.min(...pts.map((q) => q[0])) > w + pad) continue;
        if (Math.max(...pts.map((q) => q[1])) < -pad || Math.min(...pts.map((q) => q[1])) > h + pad) continue;
        const at = (u: number): [number, number] => {
          const v = 1 - u, a = v * v * v, b = 3 * v * v * u, cc = 3 * v * u * u, d = u * u * u;
          return [a * pts[0][0] + b * pts[1][0] + cc * pts[2][0] + d * pts[3][0], a * pts[0][1] + b * pts[1][1] + cc * pts[2][1] + d * pts[3][1]];
        };
        // only the stretches near the screen are sampled finely, so a branch to somewhere far stays cheap close in
        const poly = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) + Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]) + Math.hypot(pts[3][0] - pts[2][0], pts[3][1] - pts[2][1]);
        if (poly < 3) continue; // places this close are one puff from here
        const us: number[] = [];
        const COARSE = Math.min(48, Math.ceil(poly / 200));
        let prev = at(0);
        for (let i = 1; i <= COARSE; i++) {
          const u0 = (i - 1) / COARSE, u1 = i / COARSE;
          const cur = at(u1);
          const len = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
          const m = pad + len * 0.1;
          const seen = Math.max(prev[0], cur[0]) > -m && Math.min(prev[0], cur[0]) < w + m && Math.max(prev[1], cur[1]) > -m && Math.min(prev[1], cur[1]) < h + m;
          if (seen) {
            const n = Math.min(400, Math.max(1, Math.ceil(len / THREAD_STEP)));
            for (let j = us.length && us[us.length - 1] === u0 ? 1 : 0; j <= n; j++) us.push(u0 + ((u1 - u0) * j) / n);
          } else if (us.length && us[us.length - 1] !== -1) us.push(-1); // a break
          prev = cur;
        }
        const along = node.s0 * k, span = (node.s1 - node.s0) * k;
        let run: { x: number; y: number; nx: number; ny: number; hw: number; s: number; u: number }[] = [];
        const flush = () => {
          if (run.length < 2) { run = []; return; }
          // the colour: a soft glow, then the thread itself, each from where it comes from to where it goes
          const grad = c.createLinearGradient(pts[0][0], pts[0][1], pts[3][0], pts[3][1]);
          grad.addColorStop(0, strand[P.wi]);
          grad.addColorStop(1, strand[node.wi]);
          c.fillStyle = grad;
          for (const [grow, alpha] of [[2.6, 0.16], [1, 0.7]]) {
            c.beginPath();
            run.forEach((q, i) => (i ? c.lineTo : c.moveTo).call(c, q.x + q.nx * q.hw * grow, q.y + q.ny * q.hw * grow));
            for (let i = run.length - 1; i >= 0; i--) c.lineTo(run[i].x - run[i].nx * run[i].hw * grow, run[i].y - run[i].ny * run[i].hw * grow);
            c.closePath();
            c.globalAlpha = alpha;
            c.fill();
          }
          // and its letters, brighter where the glow is passing
          for (const q of run) {
            const pulse = 0.5 + 0.5 * Math.sin(q.s * 0.012 - t * 2.2);
            const r = Math.max(q.hw * 1.3, sp * 0.95);
            const f0 = (0.25 + 0.45 * pulse * pulse) * (0.45 + 0.55 * Math.min(1, q.hw / 7)) * (THREAD_STEP / (1.07 * r)) * 1.6;
            splat(q.x, q.y, r, f0, q.u < 0.5 ? P.wi : node.wi);
          }
          run = [];
        };
        for (const u of [...us, -1]) {
          if (u < 0) { flush(); continue; }
          const [x, y] = at(u);
          const [x2, y2] = at(Math.min(1, u + 0.001)), [x1, y1] = at(Math.max(0, u - 0.001));
          const tl = Math.hypot(x2 - x1, y2 - y1) || 1;
          const s = along + span * u;
          // it seeps: the edges swell and ebb a little as it goes
          const hw = (w0 + (w1 - w0) * u) * (1 + 0.16 * Math.sin(s * 0.05 - t * 1.3) * Math.sin(s * 0.013 + t * 0.4));
          run.push({ x, y, nx: -(y2 - y1) / tl, ny: (x2 - x1) / tl, hw, s, u });
        }
      }

      // the letters
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, glyphCv.width, glyphCv.height);
      g.imageSmoothingEnabled = false;
      const half = tile / 2;
      for (let row = 0, cell = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++, cell++) {
          const s = 1 - Math.exp(-heat[cell] * 1.5);
          if (s < 0.03) continue;
          let best = 0, tint = NONE;
          for (let wi = 0; wi < KINDS; wi++) {
            const v = byWorld[cell * KINDS + wi];
            if (v > best) { best = v; tint = wi; }
          }
          const bx = col * sp + (row & 1) * (sp / 3), by = row * sp + sp / 2;
          const wave = 0.5 + 0.5 * Math.sin(bx * 0.021 + t * 1.1) * Math.cos(by * 0.017 - t * 0.85);
          const ramp = levels[tint];
          const top = ramp.length - 1;
          const i = Math.min(top, Math.floor((s * 0.88 + wave * 0.24 - 0.08) * top));
          if (i <= 0) continue;
          const variants = ramp[i];
          const glyph = variants[variants.length === 1 ? 0 : (col * 3 + row * 5) % variants.length];
          const x = bx + Math.sin(t * 1.3 + row * 0.37 + col * 0.13) * 1.3;
          const y = by + Math.cos(t * 1.1 + row * 0.18 - col * 0.17) * 1.1;
          g.globalAlpha = Math.min(0.92, 0.18 + s * 0.75) * (dark ? 1 : 0.85);
          g.drawImage(atlas, glyph * tile, (tint * 2 + (s > 0.72 ? 1 : 0)) * tile, tile, tile,
            Math.round(x * dpr - half), Math.round(y * dpr - half), tile, tile);
        }
      }
      g.globalAlpha = 1;
    };

    let raf = 0, last = 0;
    const frame = (now: number) => {
      raf = 0;
      if (!last || now - last >= MIN_FRAME) {
        last = now;
        draw(now);
      }
      schedule();
    };
    const schedule = () => {
      if (!raf && !document.hidden && !reduced.matches) raf = requestAnimationFrame(frame);
    };
    // without motion, it's drawn once for every change of the map instead
    poke.current = () => { if (reduced.matches) draw(0); };
    const onVisibility = () => (document.hidden ? (cancelAnimationFrame(raf), (raf = 0)) : schedule());
    const onMotion = () => (reduced.matches ? draw(0) : schedule());
    const mo = new MutationObserver(() => w && palette());
    mo.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', onMotion);
    onMotion();
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotion);
    };
  }, []);

  useEffect(() => poke.current?.());

  return (
    <>
      <canvas ref={cloudRef} class="map-heat map-heat-clouds" aria-hidden="true" />
      <canvas ref={glyphRef} class="map-heat" aria-hidden="true" />
    </>
  );
}
