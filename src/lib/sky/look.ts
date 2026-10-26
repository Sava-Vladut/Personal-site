// What a sky looks like (lib/sky/engine.ts draws it): its colours, read from the page's emotion colours, and each
// layer's letters painted once in every shade. This part stays on the page, where the theme and the fonts are.
import { RAMPS } from '../../components/ramps';
import { dprOf, sizeOf, specsFor, SHADES, SHADE_LOW, type Look, type RGB } from './specs';

const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';

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
const WARM: RGB = [255, 200, 120];

function hex(s: string): RGB {
  const m = s.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** The page colours a sky is made from. */
export interface Colors { dark: boolean; ink: RGB; surface: RGB; raw: RGB[] }

/** Reads the theme's colours where the sky sits, for one world (the journal) or a mix (the mind page). */
export function readColors(host: Element, world?: string | null, worlds?: string[]): Colors {
  const css = getComputedStyle(host);
  const v = (name: string) => hex(css.getPropertyValue(name));
  const named = worlds?.length ? worlds : world ? [world, COMPANION[world] ?? 'sadness', world] : DAWN;
  return {
    dark: document.documentElement.dataset.theme === 'dark',
    ink: v('--ink'),
    surface: v('--surface'),
    raw: named.map((c) => v(`--emo-${c}`)),
  };
}

/**
 * The look for a sky `w` px wide on a screen of pixel ratio `dpr` (the letters' size and sharpness depend on both), in
 * the letters of `letters` (a key of RAMPS, or the world's own).
 */
export function makeLook({ dark, ink, surface, raw }: Colors, letters: string, small: boolean, w: number, dpr: number): Look {
  const ramp = RAMPS[letters] ?? RAMPS.default;
  // every character the ramp uses, once, and which of them each density level picks from
  const glyphs: string[] = [];
  const glyphIdx = ramp.map((level) =>
    level.trim() === '' ? [] : [...level].map((ch) => (glyphs.includes(ch) ? glyphs.indexOf(ch) : glyphs.push(ch) - 1)),
  );
  const accent = raw[0];
  const glyph = mix(accent, ink, dark ? 0.55 : 0.6);
  // the lit side glows warm; the shaded side just quiets down
  const sun = dark
    ? mix(mix(accent, WARM, 0.35), [255, 255, 255], 0.5)
    : mix(mix(accent, WARM, 0.4), [0, 0, 0], 0.12);
  const [farSpec, nearSpec] = specsFor(small);
  const layer = (spec: typeof farSpec) => {
    const haze = spec.haze;
    // pastel in the light, deep glows in the dark; the far layer fades toward the background
    const tones = raw.map((c) => mix(dark ? mix(c, surface, 0.35) : mix(c, [255, 255, 255], 0.5), surface, haze));
    const g = mix(glyph, surface, haze * 0.75);
    const quiet = mix(g, surface, 0.4);
    const shades = Array.from({ length: SHADES }, (_, j) => {
      const l = SHADE_LOW + ((1 - SHADE_LOW) * j) / (SHADES - 1);
      return rgba(l < 0 ? mix(g, quiet, l / SHADE_LOW) : mix(g, sun, l), 1);
    });
    // every letter in every shade, painted once; drawing a letter is then a small copy
    const res = dprOf(spec, dpr);
    const font = spec.font[sizeOf(w)];
    const tile = Math.ceil(font * 1.6 * res);
    const atlas = document.createElement('canvas');
    atlas.width = Math.max(1, glyphs.length) * tile;
    atlas.height = SHADES * tile;
    const a = atlas.getContext('2d')!;
    a.font = `${font * res}px ${FONT}`;
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    shades.forEach((shade, si) => {
      a.fillStyle = shade;
      glyphs.forEach((ch, gi) => a.fillText(ch, gi * tile + tile / 2, si * tile + tile / 2));
    });
    return {
      tones,
      shadow: tones.map((c) => (dark ? mix(c, [0, 0, 0], 0.4) : mix(c, [60, 70, 120], 0.3))),
      light: tones.map((c) => (dark ? mix(c, [255, 255, 255], 0.3) : mix(c, [255, 246, 225], 0.65))),
      atlas,
      tile,
    };
  };
  return { dark, glyphIdx, layers: [layer(farSpec), layer(nearSpec)] };
}
