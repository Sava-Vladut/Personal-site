// What the sky's two layers are (engine.ts draws them, look.ts colours them), kept apart from the drawing so the page
// only loads the drawing when it can't hand it to a worker.

export type RGB = [number, number, number];

export const SHADES = 9;       // colours between shaded and sunlit
export const SHADE_LOW = -0.6; // the lowest light value: a little shaded, never black

/** What tells the two layers apart. */
export interface Spec {
  seed: number;
  size: [number, number];   // cloud size range
  perPx: number;            // one cloud per this many px of width
  minCount: number;
  speed: [number, number];  // px per second
  yFrom: number; yRange: number;
  toneShift: number;        // far clouds lean toward the second colour
  haze: number;             // how far the layer fades toward the background
  fill: number;             // opacity of the clouds
  ink: number;              // opacity of the letters
  spacing: [number, number]; // letter grid, small screen / large
  font: [number, number];
  res: number;              // sharpest the letters are drawn, in pixels per px: faint far letters can be softer
  pull: number;             // how strongly the pointer moves this layer
  reach: number;
  waveRate: number;
  /** Shortest time between redraws (ms) while a finger is on the sky, and while it is left alone. */
  active: number; idle: number;
}
const FAR: Spec = {
  seed: 23, size: [0.42, 0.7], perPx: 115, minCount: 4, speed: [2, 4.5], yFrom: 0.06, yRange: 0.84,
  toneShift: 1, haze: 0.3, fill: 0.65, ink: 0.85, spacing: [11, 13], font: [8, 9], res: 1.5, pull: 0.3, reach: 0.75,
  waveRate: 0.55, active: 48, idle: 64,
};
const NEAR: Spec = {
  seed: 7, size: [0.85, 1.45], perPx: 210, minCount: 3, speed: [7, 15], yFrom: 0.14, yRange: 0.62,
  toneShift: 0, haze: 0, fill: 1, ink: 1, spacing: [17, 21], font: [12, 13], res: 2, pull: 1.4, reach: 1.15,
  waveRate: 1, active: 16, idle: 30,
};
// small skies, for a card: smaller, slower clouds and finer letters, redrawn less often
const FAR_SMALL: Spec = {
  ...FAR, size: [0.3, 0.5], perPx: 75, minCount: 3, speed: [1.5, 3], spacing: [9, 10], font: [7, 7], active: 80, idle: 80,
};
const NEAR_SMALL: Spec = {
  ...NEAR, size: [0.45, 0.75], perPx: 125, minCount: 2, speed: [4, 8], yFrom: 0.25, yRange: 0.6, spacing: [12, 13], font: [9.5, 10],
  active: 40, idle: 40,
};
/** A sky's layers, far first so the near clouds pass in front. */
export const specsFor = (small: boolean): [Spec, Spec] => (small ? [FAR_SMALL, NEAR_SMALL] : [FAR, NEAR]);
/** Which of a spec's two letter grids and fonts a sky this wide uses. */
export const sizeOf = (w: number) => (w < 720 ? 0 : 1);
/** How sharp a layer's letters are drawn on this screen. */
export const dprOf = (spec: Spec, dpr: number) => Math.min(dpr || 1, spec.res);

/** A layer's colours and its letters, every one in every shade, painted once (look.ts) so drawing a letter is a small copy. */
export interface LayerLook { tones: RGB[]; shadow: RGB[]; light: RGB[]; atlas: CanvasImageSource; tile: number }
export interface Look {
  dark: boolean;
  /** For each density level of the ramp, the atlas columns it picks from (an empty level draws nothing). */
  glyphIdx: number[][];
  layers: [LayerLook, LayerLook];
}

