// The body map's drawing (components/BodyMap.tsx): a figure standing with its arms a little out, in a 100 × 200 box,
// seen from the front and from the back. Every shape is drawn once, on the left as you look at it, as a loop of points
// the outline passes through ("x,y"; a "!" after a point makes it a corner), and the right side is its mirror image
// across x = 50. The loops are turned into smooth curves once, when the module loads, so a page full of icons only
// ever reads finished path strings.
import { MUSCLES, type Muscle } from '../lib/fitness';

type Pt = [x: number, y: number, corner: boolean];

const parse = (s: string): Pt[] =>
  s.trim().split(/\s+/).map((p) => {
    const [x, y] = p.replace('!', '').split(',').map(Number);
    return [x, y, p.endsWith('!')];
  });

const r = (n: number) => Math.round(n * 10) / 10;

/** A closed curve through the points (Catmull-Rom, as cubic Béziers); a corner gets no handles, so it stays sharp. */
function loop(ps: Pt[]): string {
  const n = ps.length;
  const tan = (i: number) => {
    if (ps[i][2]) return [0, 0];
    const a = ps[(i + n - 1) % n], b = ps[(i + 1) % n];
    return [(b[0] - a[0]) / 6, (b[1] - a[1]) / 6];
  };
  let d = `M${r(ps[0][0])} ${r(ps[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p = ps[i], q = ps[(i + 1) % n], tp = tan(i), tq = tan((i + 1) % n);
    d += `C${r(p[0] + tp[0])} ${r(p[1] + tp[1])} ${r(q[0] - tq[0])} ${r(q[1] - tq[1])} ${r(q[0])} ${r(q[1])}`;
  }
  return d + 'Z';
}

const flip = (ps: Pt[]): Pt[] => ps.map(([x, y, c]) => [100 - x, y, c]);

/** One side's shapes and their mirror images, as a single path. */
const pair = (shapes: string[]) => shapes.map((s) => { const ps = parse(s); return loop(ps) + loop(flip(ps)); }).join('');

/* ---------- the silhouette ---------- */

// Its left half, from the crown down the arm, round the hand, down the side and the leg and up the inside to the crotch.
// The right half is the same points mirrored and run back up, so the whole body is one closed outline.
const HALF = `
  50,4.6 45,5.8 42.2,9.6 41.4,14.6 41.8,19.2 43,22.6 44.8,24.8! 45,28.4 44.8,31.6 42.4,34  37,36.2 31,38.4 26,40.2 22.8,44.4
  21.6,50.4 21,57 20.4,64 19.6,72 19.2,78.4 18,84 17.8,90 18.4,96 18.6,100.4 17.2,104.6 16.8,109.6 17.8,114.6 20,117.6
  22.6,116.6 23.8,112.6 24.4,108.4 23.8,104 24,100.4 25.4,95.6 27.6,90 28.4,84.6 28.2,79.6 29,72 29.8,66 30.8,61.4
  32.6,58.2! 33.8,64 35.4,72 36.6,80 36.2,86 34.6,92 32.6,98 32,104 32.2,112 33.2,120 34.6,128 36,136 36.8,142 36.4,148
  35.2,154 35,160 35.8,166 37.4,174 39.2,181 40,186 39,190.6 39.4,194.6 41.6,196.6 44.8,196.8 47,195.4 47.4,191
  46.8,186.4 47.2,180 48.2,172 48.8,164 48.6,156 47.8,150 47.6,146 48.2,138 48.8,130 49.4,121 49.6,112 50,106!`;

const half = parse(HALF);
/** The whole body's outline, front and back alike. */
export const BODY = loop([...half, ...flip(half.slice(1, -1)).reverse()]);

/* ---------- the muscles ---------- */

// Each muscle is one or more shapes (the quads are the big outer head and the teardrop over the knee; the abs are the
// six blocks, the low one and the obliques). Nothing overlaps, and the gaps between shapes come from each one's stroke
// in the body's colour (BodyMap.tsx), so they stay even at any size.

const FOREARM = [
  '20.4,79.6 18.9,83.4 18.6,88.4 18.9,93.4 19.8,99.6! 21.6,94.6 22.8,89 23.2,84.4 22.4,81',
  '24.8,80.2 27.4,82.4 27.6,86 27,90.4 25.4,95 23.4,99.6! 23.6,94.6 23.9,89 24.2,84.4',
];

const FRONT: Partial<Record<Muscle, string[]>> = {
  neck: ['46,28.2 47.6,31.2 49,35.4 49.2,37.6! 47.8,37.8! 46.6,34.6 45.9,31.4'],
  traps: ['45,33.2 41.6,35.4 36,37.6 31.8,39.4! 36,40.2 41,39.4 44.6,38.2 46.4,36.8'],
  shoulders: ['31.6,40.8 27,41.2 23.6,44.6 22.6,50.4 22.6,56 24.6,61.6! 27.4,57 31,52.4 33.8,47.8 34,43.6'],
  chest: ['49.2,42.2! 49.2,59.2! 44,61.4 38.6,61.2 34.6,58.6 33,54.6 33.6,49.6 35.4,45.4 38.4,43.2 43.6,42.4'],
  biceps: ['28.8,58.8 26.4,61.6 23,64.2 21.4,68.6 21.6,73.4 23.6,77.6! 26.4,75.8 28.2,71.6 29,66 29.4,61.4'],
  forearms: FOREARM,
  abdominals: [
    '44.4,62.8 49.2,62.6! 49.2,69.4! 44.2,69.8 43.4,68.6 43.4,64',
    '44,70.8 49.2,70.6! 49.2,77.4! 44,77.6 43.2,76.4 43.2,72',
    '44,78.6 49.2,78.6! 49.2,85.4! 44.2,85.6 43.4,84.4 43.4,79.8',
    '43.6,87.4 45,86.6 49.2,86.6! 49.2,97.8! 48,98.6 46,96.4 44.2,92.6 43.4,89.4',
    '35.8,62.6 39,63.4 42,64.6 42.2,70 42,77 42,84 41.4,90.6 40.2,96.4! 37.6,92.4 37.2,86.4 37.4,80 36.2,72 35.2,66.4',
  ],
  abductors: ['36.2,96.6 34.2,99.6 33,104 33,110 33.8,116! 35.4,110 37.4,104.6 38.8,100.2'],
  adductors: ['46,104.8 48.2,107 48.9,111.4 48.6,116.6 47.6,121 46.2,124.6! 45.4,119.6 45.6,112'],
  quadriceps: [
    '40.4,101.2 38.2,104.8 36.6,110 35,115.4 34.2,120.4 34.6,126.4 35.8,132.4 37.4,138.2 40.2,141.6! 42.4,136.4 43.4,128.8 44.4,120.6 45,113 44.8,107 43.2,103',
    '45.6,126 47.2,129 47.9,133.4 47.2,137.8 45,141 42.6,141.8! 43.8,136.4 44.6,130.6',
  ],
  // from the front only the edges of the calves show, either side of the shin
  calves: [
    '45.6,147.4 47.2,151 47.8,156.4 47.8,162 47,167.6 45.6,172! 44.2,166 43.8,159.4 44.2,152.6',
    '37.6,148.8 36.2,153.4 35.8,159 36.2,164.8 37.8,170.4! 39.6,165 40,159 39.6,153',
  ],
};

const BACK: Partial<Record<Muscle, string[]>> = {
  neck: ['45.8,27.2 49.2,27! 49.2,33.6! 47.6,32.4 46.2,30.4'],
  // the trapezius is split at the shoulder blades' ridge: above it the traps, below it (with the rhomboids under it and
  // the muscles on the blades) the middle back
  traps: ['46.2,32 47.8,33.8 49.2,35.4! 49.2,48.6! 45.6,46.6 40.8,44.2 36,42 31.8,39.4! 37.6,37 43.6,34.6'],
  shoulders: ['31.4,41 27,41.4 23.6,44.8 22.4,50.4 22.6,56 24.4,61.4! 26.8,57.6 29.6,53 31.8,48.4 33,44.2'],
  triceps: [
    '24.4,63 22.2,65 20.9,68.6 21,72.6 22.6,76.2! 24.4,72.4 25.4,67.6 25.6,64',
    '27.4,58.2 29.2,61.6 29.2,65.6 28.6,70 27.4,74 25.8,76.8! 26.4,71.6 26.6,66.4 26.6,61.6',
  ],
  forearms: FOREARM,
  lats: ['33.8,59.6 37.2,60 41,62 44.2,66 46.6,71.4 45.4,76! 43,81.4 39.6,88! 38.2,83 37.2,77.8 36.2,71.6 34.8,65'],
  'middle back': [
    '49.2,50.6! 49.2,72! 46.8,66.4 43.4,59.6 40,53.4 37,48.2 36.8,45.4! 41,46.4 45.6,48.6',
    '34.2,46.8 36.6,49.6 38.6,53.6 38.4,56.8 36.4,57.6 34.4,55.6 33.4,51.8 33.4,48.2',
  ],
  'lower back': ['44.8,77.6 47,76.6 49.2,76.6! 49.2,96.6! 47.4,97 45.4,96 44.2,92 43.8,86 44,81'],
  glutes: ['45.6,97.6 49.2,100.4! 49.2,114.4! 47.2,117.4 43.4,119 39.4,118.8 35.6,117 33.4,113.4 33,108.4 34.6,103.6 37.8,100 41.6,98'],
  // the outer thighs from behind: the gluteus medius, high on the hip
  abductors: ['37.4,90.2 40.4,89.6 43.2,90.6! 42,93.6 39.6,96.6 36.6,98.8 34,100.4! 34,96.6 35.4,92.8'],
  hamstrings: [
    '35,121.4 38.4,120.4 41.6,121.2 41.8,127 41.2,133.6 40,139.6 38.8,143.6! 37.2,138.8 36,132.6 35.2,127',
    '42.8,120.6 45.8,120.4 48.4,121.6 48,128 47.6,134.6 46.6,140 43.4,143.8! 42.6,137 42.4,128.4',
  ],
  calves: [
    '39.4,146.6 37.2,150 35.8,155 35.8,160.6 37,166 39.6,169.8! 41.2,164.6 41.8,158.4 41.6,152.4 40.8,148.6',
    '43.8,146.4 46.2,148.6 47.8,153.4 48,159.6 47.4,165.6 45.6,170.6 43.8,172.8! 42.8,167 42.6,160 42.8,153.4 43.2,149',
  ],
};

export type Side = 'front' | 'back';

/** Each side's muscles as finished paths (both halves in one), in the order of MUSCLES, which is also the tab order. */
export const MAP: Record<Side, [Muscle, string][]> = {
  front: MUSCLES.filter((m) => FRONT[m]).map((m) => [m, pair(FRONT[m]!)]),
  back: MUSCLES.filter((m) => BACK[m]).map((m) => [m, pair(BACK[m]!)]),
};

/** The same, looked up by muscle. */
export const SHAPE: Record<Side, Partial<Record<Muscle, string>>> = {
  front: Object.fromEntries(MAP.front),
  back: Object.fromEntries(MAP.back),
};

/**
 * Each muscle's icon: the side that shows it best and the square of the drawing around it (centre x, centre y, size).
 * Small muscles get a close crop; the arms show both, with the shoulders, so they still read as a body at 16px.
 */
export const ICON: Record<Muscle, [Side, number, number, number]> = {
  neck: ['back', 50, 31, 30],
  traps: ['back', 50, 42, 40],
  shoulders: ['front', 50, 50, 60],
  chest: ['front', 50, 50, 44],
  biceps: ['front', 50, 64, 68],
  triceps: ['back', 50, 64, 68],
  forearms: ['front', 50, 86, 72],
  lats: ['back', 50, 66, 48],
  'middle back': ['back', 50, 56, 44],
  'lower back': ['back', 50, 86, 40],
  abdominals: ['front', 50, 80, 44],
  glutes: ['back', 50, 108, 40],
  abductors: ['front', 50, 108, 48],
  adductors: ['front', 50, 115, 36],
  quadriceps: ['front', 50, 120, 50],
  hamstrings: ['back', 50, 130, 48],
  calves: ['back', 50, 160, 40],
};
