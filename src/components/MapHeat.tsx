// The map's heat: where you've felt things, drawn like the journal's sky. Each entry is a soft, breathing puff in
// the colour of its world, and where puffs gather the map fills with that world's letters (Sky's ramps), denser
// and brighter the more was felt there. Recent entries burn brighter; older ones linger, fainter.
// The heat lingers on screen too: it eases toward where it should be instead of jumping, so moving the map
// leaves a fading trail of letters and colour behind it.
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
const LINGER = 0.09;      // how far the letters move toward the real heat each frame: lower lingers longer
const FADE = 0.14;        // how much of the colour layer fades each frame
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
    let heat = new Float32Array(0), byWorld = new Float32Array(0), shown = new Float32Array(0);
    let tint = new Uint8Array(0); // the world each cell shows; kept while it fades, so trails keep their colour
    let dark = false;
    let puffs: HTMLCanvasElement[] = [];
    // the letters: per world, its ramp's characters in two rows (warm, and hot where the heat is strongest)
    const atlas = document.createElement('canvas');
    let tile = 0, levels: number[][][] = [];

    const palette = () => {
      const css = getComputedStyle(cloudCv);
      dark = document.documentElement.dataset.theme === 'dark';
      const ink = hex(css.getPropertyValue('--ink'));
      const tones = [...WORLDS.map((k) => hex(css.getPropertyValue(`--emo-${k}`))), mix(ink, [128, 128, 128], 0.3)];
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
      shown = new Float32Array(cols * rows);
      tint = new Uint8Array(cols * rows);
      palette();
    };

    const draw = (now: number, still: boolean) => {
      const { points, view, w: W, h: H } = latest.current;
      if (!W || !H || !view) return;
      if (W !== w || H !== h) resize(W, H);
      const t = now / 1000;
      const k = 256 * 2 ** view.z;
      const left = view.x * k - w / 2, top = view.y * k - h / 2;
      const r0 = clamp(R_WORLD * k, 34, 130);

      // the colour: fade what was there a little (that's the linger), then stamp this frame's puffs
      c.setTransform(1 / SCALE, 0, 0, 1 / SCALE, 0, 0);
      c.globalCompositeOperation = 'destination-out';
      c.globalAlpha = still ? 1 : FADE;
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'source-over';
      heat.fill(0);
      byWorld.fill(0);
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const ph = i * 2.399; // a golden-angle phase each, so they don't breathe in step
        const r = r0 * (0.8 + 0.25 * Math.min(2, p.weight)) * (1 + 0.12 * Math.sin(t * 0.6 + ph));
        const cx = p.x * k - left + Math.sin(t * 0.35 + ph) * r * 0.08;
        const cy = p.y * k - top + Math.cos(t * 0.3 + ph * 1.3) * r * 0.06;
        if (cx < -r || cy < -r || cx > w + r || cy > h + r) continue;
        const found = p.core ? WORLDS.indexOf(p.core) : -1;
        const wi = found < 0 ? NONE : found;
        c.globalAlpha = Math.min(0.9, 0.55 * p.weight) * (still ? 1 : FADE * 1.15);
        c.drawImage(puffs[wi], cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);
        // and its heat, on the letter grid
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
            const f = (1 - u) * (1 - u) * p.weight;
            const cell = row * cols + col;
            heat[cell] += f;
            byWorld[cell * KINDS + wi] += f;
          }
        }
      }

      // the letters, easing toward the heat
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, glyphCv.width, glyphCv.height);
      g.imageSmoothingEnabled = false;
      const half = tile / 2;
      const ease = still ? 1 : LINGER;
      for (let row = 0, cell = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++, cell++) {
          const target = 1 - Math.exp(-heat[cell] * 1.5);
          const s = (shown[cell] += (target - shown[cell]) * ease);
          if (target > 0.04) {
            let best = 0, at = NONE;
            for (let wi = 0; wi < KINDS; wi++) {
              const v = byWorld[cell * KINDS + wi];
              if (v > best) { best = v; at = wi; }
            }
            tint[cell] = at;
          }
          if (s < 0.03) continue;
          const bx = col * sp + (row & 1) * (sp / 3), by = row * sp + sp / 2;
          const wave = 0.5 + 0.5 * Math.sin(bx * 0.021 + t * 1.1) * Math.cos(by * 0.017 - t * 0.85);
          const ramp = levels[tint[cell]];
          const top = ramp.length - 1;
          const i = Math.min(top, Math.floor((s * 0.88 + wave * 0.24 - 0.08) * top));
          if (i <= 0) continue;
          const variants = ramp[i];
          const glyph = variants[variants.length === 1 ? 0 : (col * 3 + row * 5) % variants.length];
          const x = bx + Math.sin(t * 1.3 + row * 0.37 + col * 0.13) * 1.3;
          const y = by + Math.cos(t * 1.1 + row * 0.18 - col * 0.17) * 1.1;
          g.globalAlpha = Math.min(0.92, 0.18 + s * 0.75) * (dark ? 1 : 0.85);
          g.drawImage(atlas, glyph * tile, (tint[cell] * 2 + (s > 0.72 ? 1 : 0)) * tile, tile, tile,
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
        draw(now, false);
      }
      schedule();
    };
    const schedule = () => {
      if (!raf && !document.hidden && !reduced.matches) raf = requestAnimationFrame(frame);
    };
    // without motion, it's drawn once for every change of the map instead
    poke.current = () => { if (reduced.matches) draw(0, true); };
    const onVisibility = () => (document.hidden ? (cancelAnimationFrame(raf), (raf = 0)) : schedule());
    const onMotion = () => (reduced.matches ? draw(0, true) : schedule());
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
