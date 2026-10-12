// The brain's outline and where each emotion world lives in it. A side view, facing left, in a box 1.5 wide and about 0.9 tall;
// everything is a plain function of position so the picture can be drawn with as many letters as the screen has room for.
import { t } from './i18n';

export const BOX_W = 1.5;
/** The part of the box's height that holds the brain. */
export const BOX_Y0 = 0.06, BOX_H = 0.86;

/** A patch of the brain that belongs to one emotion world: an ellipse, clipped to the brain. Earlier ones win where they overlap. */
export interface Patch { world: string; x: number; y: number; rx: number; ry: number }

export const PATCHES: Patch[] = [
  { world: 'fear', x: 0.67, y: 0.575, rx: 0.06, ry: 0.05 },               // amygdala
  { world: 'joy', x: 0.54, y: 0.5, rx: 0.065, ry: 0.055 },                // nucleus accumbens
  { world: 'sadness', x: 0.46, y: 0.38, rx: 0.065, ry: 0.06 },            // subgenual cingulate
  { world: 'anger', x: 0.84, y: 0.56, rx: 0.055, ry: 0.05 },              // hypothalamus
  { world: 'shame-aversion', x: 0.8, y: 0.4, rx: 0.085, ry: 0.06 },       // insula
  { world: 'calm-safety', x: 0.97, y: 0.78, rx: 0.075, ry: 0.14 },         // brainstem and vagus
  { world: 'love-connection', x: 0.68, y: 0.645, rx: 0.3, ry: 0.085 },    // temporal lobe
  { world: 'hope-interest', x: 0.3, y: 0.34, rx: 0.2, ry: 0.23 },         // prefrontal cortex
];

export type Part = 'cortex' | 'cerebellum' | 'stem';

const sdEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => Math.hypot((x - cx) / rx, (y - cy) / ry) - 1;

/** Which part of the brain is at this spot, if any. */
export function partAt(x: number, y: number): Part | null {
  // the stem: a slanted capsule running down from the middle of the underside
  const ax = 0.9, ay = 0.55, bx = 0.99, by = 0.9;
  const dx = bx - ax, dy = by - ay;
  const s = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  if (Math.hypot(x - (ax + dx * s), y - (ay + dy * s)) < 0.065 - 0.012 * s) return 'stem';
  if (sdEllipse(x, y, 1.16, 0.71, 0.18, 0.095) < 0) return 'cerebellum';
  // the cerebrum: a rounded dome, with the temporal lobe as a finger along the underside
  const u = (x - 0.76) / 0.64, v = (y - 0.44) / (y < 0.44 ? 0.33 : 0.2);
  if (Math.pow(Math.abs(u), 2.4) + Math.pow(Math.abs(v), 2.4) < 1) return 'cortex';
  if (sdEllipse(x, y, 0.68, 0.645, 0.31, 0.095) < 0) return 'cortex';
  return null;
}

/** The patch at this spot, or −1 for the plain cortex around it. */
export function patchAt(x: number, y: number): number {
  for (let i = 0; i < PATCHES.length; i++) {
    const p = PATCHES[i];
    if (sdEllipse(x, y, p.x, p.y, p.rx, p.ry) < 0) return i;
  }
  return -1;
}

/** Folds of the surface, 0–1: ridges (gyri) and the grooves between them. */
export function folds(x: number, y: number): number {
  const a = Math.sin(x * 34 + 2.4 * Math.sin(y * 19 + x * 7));
  const b = Math.sin(y * 39 + 1.9 * Math.sin(x * 23 - y * 5));
  const c = Math.sin((x + y) * 27 + 1.2 * Math.sin(x * 11));
  return 0.5 + (a + b + c) / 6;
}

const SYLVIAN: [number, number][] = [[0.4, 0.62], [0.58, 0.57], [0.82, 0.5], [1.06, 0.4]];
const CENTRAL: [number, number][] = [[0.9, 0.13], [0.84, 0.25], [0.92, 0.35]];
const segDist = (x: number, y: number, [ax, ay]: [number, number], [bx, by]: [number, number]) => {
  const dx = bx - ax, dy = by - ay;
  const s = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + dx * s), y - (ay + dy * s));
};

/** Distance to the two deepest grooves, the lateral fissure and the central sulcus: they split the lobes. */
export function grooveDist(x: number, y: number): number {
  let d = 1;
  for (const line of [SYLVIAN, CENTRAL]) for (let i = 1; i < line.length; i++) d = Math.min(d, segDist(x, y, line[i - 1], line[i]));
  return d;
}

/** How strongly each world's region is lit at one moment (0–1), moving like that world's sprite does. */
export function pulse(world: string, t: number, ph: number, x: number, y: number): number {
  switch (world) {
    case 'fear': return 0.5 + 0.5 * Math.sin(t * 11 + ph * 6.3) * Math.sin(t * 7.3 + ph * 3);
    case 'anger': return 0.3 + 0.7 * Math.pow(Math.abs(Math.sin(t * 3.2 + ph * 1.5)), 3);
    case 'joy': return 0.45 + 0.55 * Math.abs(Math.sin(t * 2.6 + ph * 2));
    case 'love-connection': {
      const k = ((t + ph * 0.06) % 1.15) / 1.15;
      return 0.4 + 0.6 * Math.min(1, Math.exp(-(((k - 0.08) / 0.06) ** 2)) + 0.7 * Math.exp(-(((k - 0.3) / 0.07) ** 2)));
    }
    case 'calm-safety': return 0.55 + 0.45 * Math.sin(t * 0.9 + x * 2);
    case 'sadness': return 0.25 + 0.75 * (1 - ((t * 0.5 + ph) % 1));
    case 'hope-interest': return 0.5 + 0.5 * Math.sin(t * 2 - y * 18 + ph * 2);
    default: { const k = t % 3.6; return k < 0.3 ? 0.2 : 0.6 + 0.2 * Math.sin(t + ph * 3); } // shame: looks away now and then
  }
}

/** Where each world lives in the brain, and what that part does. */
export const ZONES: Record<string, { name: string; role: string }> = {
  'hope-interest': { name: t('Prefrontal cortex'), role: t('The planner. It holds goals in mind, weighs what comes next and turns curiosity into action.') },
  joy: { name: t('Nucleus accumbens'), role: t('The reward hub. Dopamine here makes good things worth repeating, and the wanting often feels better than the having.') },
  'love-connection': { name: t('Temporal lobe'), role: t('The social brain. It reads faces, voices and intentions, and it files away the people who matter to you.') },
  'calm-safety': { name: t('Brainstem and vagus nerve'), role: t('The brake pedal. The vagus nerve slows your heart and tells the body it is safe to rest.') },
  sadness: { name: t('Subgenual cingulate'), role: t('A deep, slow hub for low mood and loss. Sadness is the brain slowing down to take in something that mattered.') },
  fear: { name: t('Amygdala'), role: t('The smoke detector. It flags danger in a fraction of a second, before you have had time to think, and errs on the side of caution on purpose.') },
  anger: { name: t('Hypothalamus'), role: t('The body’s alarm panel. It turns a perceived wrong or threat into heat, heartbeat and hormones.') },
  'shame-aversion': { name: t('Insula'), role: t('Where the body’s signals become feelings. It fires for disgust, for the sting of social pain and for the urge to look away.') },
};
