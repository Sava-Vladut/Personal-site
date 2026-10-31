// Marks for The Art of Seduction's moves 13–24, drawn with the shared pen (data/marks.ts). Keyed by id (data/seduction).
import { PEN } from '../marks';

const { W, n, k, p, pk, f, pl, circle, oval, rect, g, star, glint, heart, dashed, flower } = PEN;

/** A crescent: the circle (cx, cy, r) with the circle (cx + dx, cy + dy, r2) cut out of it. */
function crescent(cx: number, cy: number, r: number, dx: number, dy: number, r2: number) {
  const d = Math.hypot(dx, dy), a = (r * r - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(r * r - a * a);
  const px = cx + (a * dx) / d, py = cy + (a * dy) / d, ux = -dy / d, uy = dx / d;
  const [x1, y1, x2, y2] = [px + h * ux, py + h * uy, px - h * ux, py - h * uy].map(n);
  return `M${x1} ${y1}A${r} ${r} 0 1 1 ${x2} ${y2}A${r2} ${r2} 0 0 0 ${x1} ${y1}Z`;
}

/** A palm frond: a curved paper blade from (0, 0) out to the right, drooping at the tip. */
const frond = (x: number, y: number, turn: number, s = 1, mirror = false) =>
  g(`translate(${x} ${y}) rotate(${turn}) scale(${mirror ? -s : s} ${s})`, pk('M0 0Q14-11 30 3Q15-3 0 0Z', 2.6 / s));

/** A hand pointing its finger, the fingertip at (x, y), out of a cuff and a dark sleeve; cut paper, or solid ink. */
const pointer = (x: number, y: number, turn = 0, s = 1, mirror = false, ink = false) => {
  const d = 'M-2-3.5H-20Q-24-8-30-8H-44V12Q-36 16-28 15Q-22 15-21 11Q-16 12-16 8Q-12 7-14 3.5H-2A3.5 3.5 0 0 0-2-3.5Z';
  return g(`translate(${x} ${y}) rotate(${turn}) scale(${mirror ? -s : s} ${s})`,
    ink ? f(d) + pl('M-21 11Q-24 8-22 4M-30 14Q-32 10-30 6', 2 / s) : pk(d, W / s) + k('M-21 11Q-24 8-22 4M-30 14Q-32 10-30 6', 2.2 / s),
    f('M-56-11H-110V15H-56Z'), pk(rect(-58, -12, 14, 28, 2), W / s));
};

export const MARKS: Record<string, string> = {
  // a heart with a sticking plaster across it
  weakness:
    pk(heart(50, 52, 30)) +
    g('rotate(-32 50 56)', pk(rect(24, 48, 52, 16, 8)), pk(rect(42, 48, 16, 16)),
      f(circle(32, 53, 1.4)), f(circle(32, 59, 1.4)), f(circle(68, 53, 1.4)), f(circle(68, 59, 1.4))) +
    glint(16, 18, 5) + glint(86, 84, 4),
  // a paper moon and a star held up on rods behind a cardboard sea
  illusion:
    k('M47 50V92', 3) + k('M78 36V92', 2.6) +
    pk(crescent(42, 36, 21, 10, -5, 18)) + pk(star(78, 28, 9, 4, 5), 2.6) +
    pk('M-4 76Q6 66 16 74T36 74T56 74T76 74T96 74T116 74V104H-4Z') +
    pk('M-14 88Q-4 78 6 86T26 86T46 86T66 86T86 86T106 86V104H-14Z') +
    glint(84, 54, 4) + glint(14, 18, 3.5),
  // a little island with one palm, an empty rowing boat drifting away from it
  isolate:
    k('M0 74q8-5 16 0t16 0t16 0t16 0t16 0t16 0', 3) + k('M44 88q8-5 16 0t16 0', 2.6) +
    pk('M8 76Q14 58 34 58Q54 58 60 76Z') +
    k('M36 60Q34 40 44 26', 4.4) +
    frond(44, 26, 10) + frond(44, 26, -38, 0.85) + frond(44, 26, 10, 1, true) + frond(44, 26, -38, 0.85, true) +
    f(circle(41, 30, 3)) + f(circle(47, 31, 3)) +
    k('M72 58L90 74', 2.6) + pk('M68 64Q80 67 94 62Q92 72 84 72H76Q70 72 68 64Z', 3) + k('M62 66h-4M64 60h-4', 2.2),
  // a figure leaping the gap between two cliffs
  'prove-yourself':
    pk('M-4 68H24L28 104H-4Z') + pk('M74 60H104V104H70Z') +
    dashed(k('M20 66Q18 54 24 46', 2.6)) +
    g('translate(50 36) scale(1.3)',
      f(circle(10, -14, 5.2)), k('M6-6Q2 2-4 6', 4.6), k('M4-3Q11-3 17-10M4-3Q-3-7-8-6', 3), k('M-4 6Q4 10 7 18M-4 6Q-12 8-18 3', 3.4)),
  // a teddy bear sitting up
  regression:
    pk(circle(33, 22, 7.5)) + pk(circle(67, 22, 7.5)) + f(circle(33, 22, 3)) + f(circle(67, 22, 3)) +
    g('rotate(24 30 62)', pk(oval(30, 62, 7.5, 12))) + g('rotate(-24 70 62)', pk(oval(70, 62, 7.5, 12))) +
    pk(oval(50, 66, 19, 18)) + pk(oval(34, 84, 10.5, 8)) + pk(oval(66, 84, 10.5, 8)) +
    f(oval(31, 85, 4.5, 4)) + f(oval(69, 85, 4.5, 4)) +
    pk(circle(50, 36, 18)) + pk(oval(50, 43, 8.5, 6.5), 2.6) + f(oval(50, 40.5, 3.6, 2.6)) + k('M50 42.5V46', 2) +
    f(circle(43, 32, 2.3)) + f(circle(57, 32, 2.3)) + dashed(k('M42 62Q50 58 58 62', 2.2), '2 3.4'),
  // a dark door left ajar, light spilling out of the gap
  taboo:
    k('M4 84H96', 3) +
    p(rect(30, 14, 40, 70)) + p('M56 84H70L94 100H58Z') +
    f('M30 14L56 20V79L30 84Z') + p(circle(50, 50, 2.6)) +
    k('M30 84V14H70V84', 4.4) + glint(84, 26, 5) + glint(14, 40, 3.5),
  // a lotus opening on still water, light rising from it
  'spiritual-lures':
    k('M50 6v8M28 12l4 6M72 12l-4 6M14 30l7 3M86 30l-7 3', 3) +
    k('M4 80q8-5 16 0t16 0t16 0t16 0t16 0t16 0', 3) + k('M30 90q8-5 16 0t16 0', 2.6) +
    pk('M50 74Q30 78 12 64Q34 56 50 74Z') + pk('M50 74Q70 78 88 64Q66 56 50 74Z') +
    pk('M50 74Q26 66 26 40Q44 48 50 74Z') + pk('M50 74Q74 66 74 40Q56 48 50 74Z') +
    pk('M50 26Q65 46 50 74Q35 46 50 26Z'),
  // a cactus in its pot, flowering on top
  'pleasure-pain':
    g('translate(2.5 3) scale(0.95)',
      pk('M42 56H33Q27 56 27 50V42Q27 37 31.5 37Q36 37 36 42V48H42Z'), pk('M58 44H65V34Q65 29 69.5 29Q74 29 74 34V42Q74 50 66 50H58Z'),
      pk('M41 70V34Q41 22 50 22Q59 22 59 34V70Z'), k('M50 30V66', 2.4),
      k('M41 38l-5-2M41 46h-5M41 64l-5 1M59 56h5M59 64l5 1M27 45h-5M74 37h5M65 38h-5M36 44h4M74 46l5 1', 2.4),
      flower(50, 19, 11),
      pk(rect(26, 68, 48, 8, 2)), pk('M30 76H70L66 92H34Z')),
  // a feather drifting down through open air
  'space-to-fall':
    dashed(k('M12 8Q34 10 26 18Q18 26 30 30', 2.6)) +
    g('translate(58 52) rotate(-40)',
      pk('M2 24Q13 16 13 2L4-5L13-9Q12-28-6-36Q-17-20-15 2L-5 0L-14 9Q-12 19-2 24Z', 3.2),
      k('M0 38Q1 0-5-32', 2.4), k('M-2 26l-5 3M2 26l5 3', 2.2)) +
    glint(84, 22, 5) + glint(20, 70, 3.5),
  // two hands reaching out, their fingertips about to touch
  'physical-lures':
    pointer(45, 57, -16, 1.15) + pointer(55, 54, -16, 1.15, true, true) +
    glint(50, 55.5, 4) + k('M46 44l2 4M56 68l-2-4', 2.4),
  // a champagne bottle, the cork flying out
  'bold-move':
    g('translate(32 88) rotate(32)',
      pk('M-12 0V-28Q-12-40-4-46V-60H4V-46Q12-40 12-28V0Z'), f(rect(-5.5, -61, 11, 14, 1.5)), k('M-12-22H12M-12-10H12', 2.6)) +
    g('rotate(32 78 20)', pk(rect(73, 12, 10, 12, 2))) +
    k('M58 28l-5-6M66 24l-1-8M76 38l8 1M74 46l7 4', 3) + f(circle(86, 30, 2.2)) + f(circle(60, 14, 1.8)) + f(circle(90, 18, 1.6)) + f(circle(88, 44, 1.6)) +
    glint(20, 22, 6),
  // a heart balloon gone soft, sinking, its string slack on the floor
  aftereffects:
    k('M8 86H92', 3) +
    k('M56 76Q60 84 68 86H80Q88 86 86 80Q84 76 80 80', 2.4) +
    g('rotate(-30 46 54)', pk('M46 76C26 64 20 52 24 42C28 32 40 32 46 42C50 34 62 34 66 42C70 50 64 62 46 76Z'),
      f('M46 76L42 81H50Z'), k('M34 44Q39 50 36 58M58 42Q54 48 58 54M44 60Q48 64 46 68', 2.4)) +
    glint(76, 22, 5),
};
