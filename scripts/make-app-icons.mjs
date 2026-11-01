// Renders the app icon, the Mind traps head with a spiral where the brain sits, drawn like the Learn marks
// (data/marks.ts: ivory cut paper and black brush ink) on the app's dark tile, into the PWA icons (SVG + PNG).
// The SVG carries the marks' ink wobble (components/Mark.tsx); the PNGs are drawn by ImageMagick (`convert`, needed
// only to run this) without it. Run from the repo root: node scripts/make-app-icons.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const TILE = '#1a1a19';
const INK = '#141413';
const PAPER = '#faf9f5';
const GLINT = '#9085e9'; // the dark theme's fear violet, so the glints show on the dark tile

const n = (v) => +v.toFixed(1);

/** An inward spiral round (cx, cy), out to r, as one line. */
function spiral(cx, cy, r, turns = 2.6) {
  const pts = [];
  for (let i = 0; i <= 90; i++) {
    const t = i / 90, a = -Math.PI / 2 + t * turns * 2 * Math.PI, rr = 1.2 + (r - 1.2) * t;
    pts.push(`${n(cx + rr * Math.cos(a))} ${n(cy + rr * Math.sin(a))}`);
  }
  return 'M' + pts.join('L');
}
const glint = (cx, cy, r) => `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`;

// [d, fill, stroke, stroke width] in a 100 × 100 box
const ART = [
  ['M28 92V72Q14 62 16 42Q20 14 48 14Q72 16 74 38L80 52L74 54V62Q74 68 66 68H58V92Z', PAPER, INK, 3.6],
  [spiral(44, 38, 17), 'none', INK, 3.2],
  ['M41.2 38a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0 -5.6 0Z', INK],
  [glint(88, 18, 5.5), GLINT],
  [glint(86, 74, 4), GLINT],
];

const svgArt = ART.map(([d, fill, stroke, w]) =>
  `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"` : ''}/>`).join('');

writeFileSync(
  'public/icon.svg',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>' +
  '<filter id="w" filterUnits="userSpaceOnUse" x="-5" y="-5" width="110" height="110" color-interpolation-filters="sRGB">' +
  '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="137" result="n"/>' +
  '<feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter></defs>' +
  `<rect width="100" height="100" rx="22" fill="${TILE}"/><g filter="url(#w)">${svgArt}</g></svg>\n`,
);

/** size: image px; scale: the art's size against the tile's; radius: corner radius fraction (0 = square) */
function png(file, size, scale, radius) {
  const u = size / 100, r = size * radius;
  const mvg = [
    `fill '${TILE}'`, radius ? `roundrectangle 0,0 ${size - 1},${size - 1} ${r},${r}` : `rectangle 0,0 ${size},${size}`,
    `translate ${(size * (1 - scale)) / 2},${(size * (1 - scale)) / 2}`, `scale ${u * scale},${u * scale}`,
    'stroke-linecap round', 'stroke-linejoin round',
    ...ART.flatMap(([d, fill, stroke, w]) => [`fill '${fill}'`, stroke ? `stroke '${stroke}'` : 'stroke none', `stroke-width ${w ?? 0}`, `path '${d}'`]),
  ].join('\n');
  execFileSync('convert', ['-size', `${size}x${size}`, 'xc:none', '-draw', mvg, '-depth', '8', '-strip', file]);
}

png('public/icon-192.png', 192, 1, 0.22);
png('public/icon-512.png', 512, 1, 0.22);
png('public/icon-maskable-512.png', 512, 0.8, 0); // full-bleed, art inside the safe zone; the OS applies its own mask
png('public/apple-touch-icon.png', 180, 1, 0); // iOS rounds corners itself
console.log('icons written to public/');
