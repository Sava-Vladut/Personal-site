// The worlds as little characters: each core emotion is a shape with a face, on a 32×32 grid.
// Classes: cr-b is the body that moves, cr-face the features, cr-drops the rain. The face is bold enough to read
// at chip size; the fine touches (brows, blush, tears, a twinkle) only join it once the character is drawn large.

interface Critter { body: string; face: string; fine?: string; drops?: string; extra?: string }

function star(cx: number, cy: number, R: number, r: number) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2);
  }
  return d + 'Z';
}
const drop = (x: number, y: number, s = 1) =>
  `M${x} ${y - 2.6 * s}C${x + 0.9 * s} ${y - 1.2 * s} ${x + 1.8 * s} ${y - 0.2 * s} ${x + 1.8 * s} ${y + 0.8 * s}a${1.8 * s} ${1.8 * s} 0 0 1 ${-3.6 * s} 0C${x - 1.8 * s} ${y - 0.2 * s} ${x - 0.9 * s} ${y - 1.2 * s} ${x} ${y - 2.6 * s}Z`;
const eye = (x: number, y: number, rx: number, ry: number) =>
  `<ellipse class="cr-d" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/><circle class="cr-w" cx="${x + rx * 0.35}" cy="${y - rx * 0.45}" r="${rx * 0.38}"/>`;
const blush = (x: number, y: number) => `<ellipse class="cr-p" cx="${x}" cy="${y}" rx="2" ry="1.2"/>`;
const path = (d: string, cls: string, style = '') => `<path class="${cls}" d="${d}"${style ? ` style="${style}"` : ''}/>`;

const HEART = 'M16 28C16 28 3 20.2 3 11.6 3 7.2 6.4 4 10.3 4c2.6 0 4.6 1.4 5.7 3.4C17.1 5.4 19.1 4 21.7 4 25.6 4 29 7.2 29 11.6 29 20.2 16 28 16 28Z';
const STAR = star(16, 17, 13, 5.8);
const LEAF = 'M7 25C5 15 12 6 27.5 4.5 26.5 20 18 27.5 7 25Z';
const SPARK = 'M16 2.5C17.8 10.6 21.4 14.2 29.5 16 21.4 17.8 17.8 21.4 16 29.5 14.2 21.4 10.6 17.8 2.5 16 10.6 14.2 14.2 10.6 16 2.5Z';
const TWINKLE = 'M26 2.4C26.3 4.6 27.4 5.7 29.6 6 27.4 6.3 26.3 7.4 26 9.6 25.7 7.4 24.6 6.3 22.4 6 24.6 5.7 25.7 4.6 26 2.4Z';
const GHOST = 'M6 16C6 9.4 10.5 5 16 5s10 4.4 10 11v11.5c0 .8-.9 1.2-1.5.7l-2.2-1.8-2.7 2.1c-.4.3-.9.3-1.3 0L16 26.6l-2.3 1.9c-.4.3-.9.3-1.3 0l-2.7-2.1-2.2 1.8c-.6.5-1.5.1-1.5-.7Z';
const CLOUD = 'M9.5 20C6.4 20 4 17.8 4 15c0-2.7 2.1-4.8 4.8-5C9.6 6.6 12.6 4 16.3 4c4 0 7.3 3 7.7 6.9 2.4.5 4 2.4 4 4.7 0 2.5-2 4.4-4.6 4.4Z';
const FLAME = 'M16 30C10 30 6.5 26 6.5 20.5 6.5 15 10 12.5 11 8c2.5 1.5 3.5 4 3.5 6 2-2.5 2.5-7 1-11C21.5 6 25.5 12.5 25.5 20 25.5 26 22 30 16 30Z';
const EMBER = 'M16 29c-3.2 0-5-2.2-5-4.8 0-2.8 2-4.4 2.8-6.7 1.4 1.1 2 2.5 2 3.7 1.4-1.2 2-3 1.8-5 2.4 1.8 3.4 4.8 3.4 7.6 0 3-1.8 5.2-5 5.2Z';
const FACE = 'M16 4.5a12 12 0 1 1 0 24 12 12 0 0 1 0-24Z';

const CRITTERS: Record<string, Critter> = {
  // the heart smiles with its eyes shut
  'love-connection': {
    body: path(HEART, 'cr-c'),
    face: path('M10.3 13.6q1.8-2.4 3.6 0M18.1 13.6q1.8-2.4 3.6 0M13.6 17q2.4 2.4 4.8 0', 'cr-k'),
    fine: blush(9.2, 16.8) + blush(22.8, 16.8),
  },
  // the star grins
  'joy': {
    body: path(STAR, 'cr-c', 'stroke:var(--c);stroke-width:2.6;stroke-linejoin:round'),
    face: eye(13.2, 15.2, 1.5, 1.9) + eye(18.8, 15.2, 1.5, 1.9) + path('M13 18.3h6a3 3 0 0 1-6 0Z', 'cr-d'),
  },
  // the leaf dozes
  'calm-safety': {
    body: path(LEAF, 'cr-c') + path('M7.5 24.8 4 28.5', 'cr-ks'),
    face: `<g transform="rotate(-42 16.8 15.6)">${path('M12.2 14.8q1.6 1.6 3.2 0M18.2 14.8q1.6 1.6 3.2 0M15.4 18.3q1.4 1 2.8 0', 'cr-k')}</g>`,
    fine: `<g transform="rotate(-42 16.8 15.6)">${blush(11.4, 17.6)}${blush(22.2, 17.6)}</g>`,
  },
  // the spark looks on, wide-eyed
  'hope-interest': {
    body: path(SPARK, 'cr-c'),
    face: eye(13.4, 15.2, 1.9, 2.2) + eye(18.6, 15.2, 1.9, 2.2) + '<ellipse class="cr-d" cx="16" cy="19.8" rx="1" ry="1.3"/>',
    extra: path(TWINKLE, 'cr-c'),
  },
  // the ghost frets
  'fear': {
    body: path(GHOST, 'cr-c'),
    face: eye(12.4, 15.4, 2.2, 2.9) + eye(19.6, 15.4, 2.2, 2.9) + path('M12.6 22q.85-1 1.7 0t1.7 0 1.7 0 1.7 0', 'cr-k'),
    fine: path('M10 11l3.8-1.4M22 11l-3.8-1.4', 'cr-k'),
  },
  // the cloud cries, and rains
  'sadness': {
    body: path(CLOUD, 'cr-c'),
    face: eye(12.6, 13.4, 1.3, 1.6) + eye(19.4, 13.4, 1.3, 1.6) + path('M13.4 18q2.6-2.2 5.2 0', 'cr-k'),
    fine: path('M10.4 10.6l2.8-1M21.6 10.6l-2.8-1', 'cr-k') + path(drop(11.6, 17.8, 0.6), 'cr-t'),
    drops: [drop(10, 25), drop(16, 28.2), drop(22, 25)].map((d) => path(d, 'cr-l')).join(''),
  },
  // the flame glowers through its teeth
  'anger': {
    body: path(FLAME, 'cr-c') + path(EMBER, 'cr-y'),
    face: path('M11.2 17.2l3.8 1.6M20.8 17.2l-3.8 1.6', 'cr-k') + eye(13.5, 21, 1.3, 1.5) + eye(18.5, 21, 1.3, 1.5)
      + '<rect x="13" y="23.8" width="6" height="2.6" rx="1.1" class="cr-w" style="stroke:var(--cr-deep);stroke-width:1.1"/>',
    fine: path('M16 23.8v2.6', 'cr-k', 'stroke-width:.8'),
  },
  // the face blushes and looks away
  'shame-aversion': {
    body: path(FACE, 'cr-c'),
    face: eye(18.4, 14.6, 1.3, 1.7) + eye(23.6, 14.6, 1.3, 1.7) + blush(17, 18.8) + blush(25.2, 18.8) + path('M17.2 22.2q1-1 2 0t2 0 2 0', 'cr-k'),
    fine: path('M16.9 11q1.5-1 2.8-.2M22.2 10.8q1.4-.8 2.7.3', 'cr-k') + path(drop(8.6, 10.2, 0.75), 'cr-t'),
  },
};

/** Style for a world's character: its colour, and how long its idle loop waits before it starts. */
export const critterStyle = (core: string, delay = 0, color?: string) => ({ '--c': color ?? `var(--emo-${core})`, ...(delay && { '--delay': `${delay}ms` }) });

const cache: Record<string, string> = {};
/** Inner SVG markup (32×32 viewBox) for a world's character. `small` keeps only the bold features, for chip sizes. */
export function critter(core: string, small = false) {
  const key = core + (small ? ':s' : '');
  if (cache[key] == null) {
    const c = CRITTERS[core];
    if (!c) return (cache[key] = '');
    cache[key] = `<g class="cr-b">${c.body}<g class="cr-face">${c.face}${small ? '' : c.fine ?? ''}</g></g>`
      + (c.drops ? `<g class="cr-drops">${c.drops}</g>` : '')
      + (c.extra && !small ? c.extra : '');
  }
  return cache[key];
}
