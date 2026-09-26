// Renders the pixel thought-bubble mark into the PWA icons (PNG + SVG). No dependencies:
// pixel art is just filled squares, so we write the PNG bytes directly.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const MARK = ['..XX.XX.', '.XXXXXXX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '........', '.XX.....', 'X.......'];
const BG = [0x1a, 0x1a, 0x19];
const FG = [0xf3, 0xf3, 0xf1];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** size: image px; scale: fraction of the image the 8×8 mark spans; radius: corner radius fraction (0 = square) */
function png(size, scale, radius) {
  const cell = Math.floor((size * scale) / 8);
  const off = Math.floor((size - cell * 8) / 2);
  const r = size * radius;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      // rounded-square background with transparent corners
      const cx = Math.max(r - x - 0.5, x + 0.5 - (size - r), 0);
      const cy = Math.max(r - y - 0.5, y + 0.5 - (size - r), 0);
      const inside = r === 0 || cx * cx + cy * cy <= r * r;
      const mx = Math.floor((x - off) / cell), my = Math.floor((y - off) / cell);
      const on = x >= off && y >= off && mx < 8 && my < 8 && MARK[my][mx] === 'X';
      const [R, G, B] = on ? FG : BG;
      row.set([R, G, B, inside ? 255 : 0], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icon-192.png', png(192, 0.5, 0.22));
writeFileSync('public/icon-512.png', png(512, 0.5, 0.22));
writeFileSync('public/icon-maskable-512.png', png(512, 0.42, 0)); // full-bleed; OS applies its own mask
writeFileSync('public/apple-touch-icon.png', png(180, 0.5, 0)); // iOS rounds corners itself

let d = '';
MARK.forEach((row, y) => [...row].forEach((c, x) => c === 'X' && (d += `M${x + 4} ${y + 4}h1v1h-1z`)));
writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" rx="3.5" fill="#1a1a19"/><path d="${d}" fill="#f3f3f1"/></svg>\n`,
);
console.log('icons written to public/');
