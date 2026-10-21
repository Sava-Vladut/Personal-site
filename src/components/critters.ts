// The worlds as little characters: each core emotion is a sticker with a face, on a 32×32 grid.
// Every part is drawn twice underneath, as a white outline and a soft shadow, so the sticker reads on any
// background (its own colour too). Classes: cr-b is the body that moves, cr-face the features, cr-drops the rain.

type Sil = [d: string, width?: number];
interface Critter { sil: Sil[]; body: string; face: string; drops?: [Sil[], string]; extra?: [Sil[], string] }

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
const eye = (x: number, y: number, rx = 1.1, ry = rx * 1.3) =>
  `<ellipse class="cr-d" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/><circle class="cr-w" cx="${x + rx * 0.35}" cy="${y - rx * 0.45}" r="${rx * 0.38}"/>`;
const blush = (x: number, y: number) => `<ellipse class="cr-p" cx="${x}" cy="${y}" rx="1.9" ry="1.1"/>`;
const path = (d: string, cls: string, style = '') => `<path class="${cls}" d="${d}"${style ? ` style="${style}"` : ''}/>`;

const HEART = 'M16 28C16 28 3 20.2 3 11.6 3 7.2 6.4 4 10.3 4c2.6 0 4.6 1.4 5.7 3.4C17.1 5.4 19.1 4 21.7 4 25.6 4 29 7.2 29 11.6 29 20.2 16 28 16 28Z';
const STAR = star(16, 17, 13, 5.8);
const LEAF = 'M7 25C5 15 12 6 27.5 4.5 26.5 20 18 27.5 7 25Z';
const STEM = 'M7.5 24.8 4 28.5';
const SPARK = 'M16 2.5C17.8 10.6 21.4 14.2 29.5 16 21.4 17.8 17.8 21.4 16 29.5 14.2 21.4 10.6 17.8 2.5 16 10.6 14.2 14.2 10.6 16 2.5Z';
const TWINKLE = 'M26 2.4C26.3 4.6 27.4 5.7 29.6 6 27.4 6.3 26.3 7.4 26 9.6 25.7 7.4 24.6 6.3 22.4 6 24.6 5.7 25.7 4.6 26 2.4Z';
const GHOST = 'M6 16C6 9.4 10.5 5 16 5s10 4.4 10 11v11.5c0 .8-.9 1.2-1.5.7l-2.2-1.8-2.7 2.1c-.4.3-.9.3-1.3 0L16 26.6l-2.3 1.9c-.4.3-.9.3-1.3 0l-2.7-2.1-2.2 1.8c-.6.5-1.5.1-1.5-.7Z';
const CLOUD = 'M9.5 20C6.4 20 4 17.8 4 15c0-2.7 2.1-4.8 4.8-5C9.6 6.6 12.6 4 16.3 4c4 0 7.3 3 7.7 6.9 2.4.5 4 2.4 4 4.7 0 2.5-2 4.4-4.6 4.4Z';
const RAIN = [drop(10, 25), drop(16, 28.2), drop(22, 25)];
const FLAME = 'M16 30C10 30 6.5 26 6.5 20.5 6.5 15 10 12.5 11 8c2.5 1.5 3.5 4 3.5 6 2-2.5 2.5-7 1-11C21.5 6 25.5 12.5 25.5 20 25.5 26 22 30 16 30Z';
const EMBER = 'M16 29c-3.2 0-5-2.2-5-4.8 0-2.8 2-4.4 2.8-6.7 1.4 1.1 2 2.5 2 3.7 1.4-1.2 2-3 1.8-5 2.4 1.8 3.4 4.8 3.4 7.6 0 3-1.8 5.2-5 5.2Z';
const FACE = 'M16 4.5a12 12 0 1 1 0 24 12 12 0 0 1 0-24Z';
const SWEAT = drop(8.6, 10.2, 0.7);

const CRITTERS: Record<string, Critter> = {
  // the heart smiles with its eyes shut
  'love-connection': {
    sil: [[HEART]],
    body: path(HEART, 'cr-c'),
    face: path('M10.6 13.4q1.5-2 3 0M18.4 13.4q1.5-2 3 0', 'cr-k') + blush(9.4, 16.6) + blush(22.6, 16.6) + path('M14.2 16.8q1.8 1.8 3.6 0', 'cr-k'),
  },
  // the star grins
  'joy': {
    sil: [[STAR, 5.6]],
    body: path(STAR, 'cr-c', 'stroke:var(--c);stroke-width:2.6;stroke-linejoin:round'),
    face: eye(13.4, 15.6) + eye(18.6, 15.6) + path('M13.6 18.4h4.8a2.4 2.4 0 0 1-4.8 0Z', 'cr-d'),
  },
  // the leaf dozes
  'calm-safety': {
    sil: [[LEAF], [STEM, 4.8]],
    body: path(LEAF, 'cr-c') + path(STEM, 'cr-ks', 'stroke-width:1.8'),
    face: `<g transform="rotate(-42 16.8 15.6)">${path('M12.6 15q1.3 1.3 2.6 0M18.4 15q1.3 1.3 2.6 0', 'cr-k')}${path('M15.6 17.8q1.2.9 2.4 0', 'cr-k')}${blush(11.6, 17.4)}${blush(22, 17.4)}</g>`,
  },
  // the spark looks on, wide-eyed
  'hope-interest': {
    sil: [[SPARK]],
    body: path(SPARK, 'cr-c'),
    face: eye(13.7, 15.3, 1.5, 1.8) + eye(18.3, 15.3, 1.5, 1.8) + '<ellipse class="cr-d" cx="16" cy="19.2" rx=".8" ry="1"/>',
    extra: [[[TWINKLE]], path(TWINKLE, 'cr-c')],
  },
  // the ghost frets
  'fear': {
    sil: [[GHOST]],
    body: path(GHOST, 'cr-c'),
    face: path('M10.4 11.2l3.5-1.3M21.6 11.2l-3.5-1.3', 'cr-k') + eye(12.6, 15.4, 1.9, 2.5) + eye(19.4, 15.4, 1.9, 2.5) + path('M12.8 21.6q.8-.9 1.6 0t1.6 0 1.6 0 1.6 0', 'cr-k'),
  },
  // the cloud cries, and rains
  'sadness': {
    sil: [[CLOUD]],
    body: path(CLOUD, 'cr-c'),
    face: path('M10.8 10.9l2.6-.9M21.2 10.9l-2.6-.9', 'cr-k') + eye(12.8, 13.6, 1, 1.25) + eye(19.2, 13.6, 1, 1.25) + path('M14 17.6q2-1.6 4 0', 'cr-k') + path(drop(11.8, 17.4, 0.55), 'cr-t'),
    drops: [RAIN.map((d) => [d] as Sil), RAIN.map((d) => path(d, 'cr-l')).join('')],
  },
  // the flame glowers through its teeth
  'anger': {
    sil: [[FLAME]],
    body: path(FLAME, 'cr-c') + path(EMBER, 'cr-y'),
    face: path('M11.6 17.6l3.2 1.3M20.4 17.6l-3.2 1.3', 'cr-k', 'stroke-width:1.6') + eye(13.6, 21, 1, 1.2) + eye(18.4, 21, 1, 1.2)
      + '<rect x="13.5" y="23.6" width="5" height="2.3" rx="1" class="cr-w" style="stroke:var(--cr-deep);stroke-width:.9"/>' + path('M16 23.6v2.3', 'cr-k', 'stroke-width:.7'),
  },
  // the face blushes and looks away
  'shame-aversion': {
    sil: [[FACE]],
    body: path(FACE, 'cr-c'),
    face: path('M17.2 11.2q1.4-.9 2.6-.2M22.4 11q1.3-.7 2.5.3', 'cr-k') + eye(18.6, 14.8, 1, 1.4) + eye(23.5, 14.8, 1, 1.4) + blush(17.4, 18.6) + blush(25, 18.6) + path('M17.6 22.2q.9-.9 1.8 0t1.8 0 1.8 0', 'cr-k'),
    extra: [[[SWEAT]], path(SWEAT, 'cr-t')],
  },
};

/** A silhouette's outline and shadow, drawn under the parts it outlines. */
function under(sil: Sil[]) {
  const ps = sil.map(([d, w]) => `<path d="${d}"${w ? ` style="stroke-width:${w}"` : ''}/>`).join('');
  return `<g class="cr-sh" transform="translate(0 .8)">${ps}</g><g class="cr-ol">${ps}</g>`;
}

/** Style for a world's character: its colour, and how long its idle loop waits before it starts. */
export const critterStyle = (core: string, delay = 0, color?: string) => ({ '--c': color ?? `var(--emo-${core})`, ...(delay && { '--delay': `${delay}ms` }) });

const cache: Record<string, string> = {};
/** Inner SVG markup (32×32 viewBox) for a world's character. `small` leaves out the tiny extras (a twinkle, a bead of sweat). */
export function critter(core: string, small = false) {
  const key = core + (small ? ':s' : '');
  if (cache[key] == null) {
    const c = CRITTERS[core];
    if (!c) return (cache[key] = '');
    cache[key] = `<g class="cr-b">${under(c.sil)}${c.body}<g class="cr-face">${c.face}</g></g>`
      + (c.drops ? `<g class="cr-drops">${under(c.drops[0])}${c.drops[1]}</g>` : '')
      + (c.extra && !small ? `<g class="cr-x">${under(c.extra[0])}${c.extra[1]}</g>` : '');
  }
  return cache[key];
}
