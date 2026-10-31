// Marks for The Art of Seduction's victims 1–9, drawn with the shared pen (data/marks.ts). Keyed by id (data/seduction).
import { PEN } from '../marks';

const { n, k, p, pk, f, pl, circle, oval, rect, poly, g, star, glint, crown, dashed } = PEN;

/** A spiral of ink from the centre out to r, for a lollipop. */
const swirl = (cx: number, cy: number, r: number, turns = 2.4) =>
  'M' + Array.from({ length: 41 }, (_, i) => {
    const t = (i / 40) * turns * Math.PI * 2, rr = (i / 40) * r;
    return `${n(cx + rr * Math.cos(t))} ${n(cy + rr * Math.sin(t))}`;
  }).join('L');

export const MARKS: Record<string, string> = {
  // a birdcage with its door swung open, the bird on the sill looking out
  'reformed-rake':
    k('M44 2V10', 3) + k(circle(44, 13.5, 3.4), 2.8) +
    pk('M18 80V44Q18 19 44 18Q70 19 70 44V80Z') +
    k('M44 19Q27 22 27 44V80M44 19Q36 24 36 44V80M44 19V48', 2.2) + k('M18 44H47M65 44H70', 2.4) +
    k('M44 19Q54 24 55 44V48M44 19Q62 22 63 44V48', 2.2) +
    k('M47 80V48H65V80', 2.4) +
    pk('M65 48L83 42V73L65 80Z', 2.6) + k('M71 46.5V77M77 44.5V75', 2) +
    pk(rect(12, 80, 64, 8, 2)) +
    g('translate(55 79) scale(1.18) translate(-55 -79)',
      f(oval(54, 73.5, 6.4, 5)), f(circle(59.5, 66.5, 4.2)), f(poly(63, 64.5, 69, 66.5, 63, 68.5)), p(circle(60.5, 65.5, 1.1)),
      f(poly(49, 74, 41, 79, 48, 78))) +
    glint(90, 22, 5),
  // a flower pressed in an open book, wilted over on its stem, a petal falling
  'disappointed-dreamer':
    pk('M50 68Q36 60 12 64V88Q36 84 50 92Z') + pk('M50 68Q64 60 88 64V88Q64 84 50 92Z') +
    k('M18 72Q32 69 44 73M18 80Q32 77 44 81M56 73Q68 69 82 72', 2.2) +
    k('M50 68C50 44 51 24 63 22Q73 21 72 32', 3.4) + pk('M50.5 50Q40 49 35 61Q45 63 50.5 56Z', 2.6) +
    g('translate(72 31) rotate(16) scale(1.3)', pk('M0-2Q10-1 10 10L8 16L4.5 9.5L1 18L-3 10L-7 14L-9 8Q-10-1 0-2Z', 2.8)) +
    g('rotate(36 88 58)', pk(oval(88, 58, 3.4, 5.6), 2.4)) +
    glint(24, 22, 5),
  // a crown slipped askew on a plump cushion, a lollipop propped beside it
  'pampered-royal':
    k('M72 64L80 30', 3.4) + pk(circle(81, 22, 10)) + k(swirl(81, 22, 7.5), 2.4) +
    pk('M8 60Q48 50 88 60Q82 73 88 86Q48 96 8 86Q14 73 8 60Z') +
    k('M8 60Q14 62 18 66M88 60Q82 62 78 66M8 86Q14 84 18 80M88 86Q82 84 78 80', 2.2) + f(circle(48, 74, 2.4)) +
    g('rotate(-16 42 62)', crown(42, 62, 34)),
  // a forbidden apple kept under a bell jar, a glint on the glass
  'new-prude':
    pk(rect(16, 80, 68, 9, 3)) +
    k('M26 80V44Q26 18 50 18Q74 18 74 44V80') + pk(circle(50, 14, 4), 2.8) + pl('M32 66V44Q32 28 44 24', 2.4) +
    pk('M50 52Q40 44 34 52Q28 62 36 74Q42 80 50 76Q58 80 64 74Q72 62 66 52Q60 44 50 52Z') +
    k('M50 52Q50 44 54 40', 3) + pk('M54 44Q62 38 66 44Q60 48 54 44Z', 2.4),
  // a star fallen to the ground and split in two
  'crushed-star':
    dashed(k('M6 8Q26 8 38 28', 2.6)) + k('M6 86H94', 3) +
    g('translate(-3 0) rotate(-9 34 82)', pk(poly(50, 30, 47, 40, 53, 48, 46, 57, 53, 64, 50, 70, 33.5, 80.7, 38.6, 61.7, 23.4, 49.4, 43, 48.3))) +
    g('translate(3 0) rotate(9 66 82)', pk(poly(50, 30, 57, 48.3, 76.6, 49.4, 61.4, 61.7, 66.5, 80.7, 50, 70, 53, 64, 46, 57, 53, 48, 47, 40))) +
    k('M14 78l-5-3M86 78l5-3M50 80v-6', 2.4),
  // a chick just hatched, the top of its shell tipped up like a hat
  novice:
    pk(circle(50, 47, 13)) + f(circle(54, 44, 2.4)) + f(poly(61, 46, 71, 48.5, 61, 52)) +
    pk('M27 60L33 54L39 60L45 53L51 60L57 53L63 60L69 54L73 60Q76 88 50 88Q24 88 27 60Z') +
    g('translate(3 -5) rotate(22 52 34)', pk('M36 34Q36 16 52 16Q68 16 68 34L63 30L58 35L52 29L46 35L41 30Z')) +
    k('M18 40l-6-4M16 52h-7M84 46l6-4', 2.6),
  // a chess knight leaning forward, ready to leap
  conqueror:
    pk(rect(24, 80, 52, 8, 2)) + pk(rect(30, 72, 40, 8, 2)) +
    pk('M36 72Q34 58 42 50L32 54Q24 56 22 48L26 38Q32 24 48 20L50 10L56 18Q72 24 70 50Q68 62 64 72Z') +
    f(circle(42, 32, 2.6)) + k('M58 26Q64 32 64 44', 2.4) + k('M84 30h10M82 42h12M86 54h8', 3),
  // a suitcase covered in travel stickers, a tag on its handle
  'exotic-fetishist':
    k('M38 34V26Q38 22 42 22H58Q62 22 62 26V34', 4.4) +
    k('M60 23Q68 16 72 18', 2) + g('rotate(24 80 18)', pk('M72 13H86V23H72L68 18Z', 2.4), k('M75 18h8', 2)) +
    pk(rect(12, 34, 76, 50, 6)) + k('M24 34V84M76 34V84', 2.4) +
    f(circle(40, 54, 10)) + pl('M32 57q4-3 8 0t8 0', 2) + pl('M35.5 51.5a4.5 4.5 0 0 1 9 0', 2) +
    g('rotate(-12 58 72)', pk(rect(48, 65, 20, 14, 2), 2.4), f(star(58, 72, 5, 2.2, 5))) +
    pk(circle(62, 47, 9), 2.4) + k('M62 54Q63.5 49 61 43', 2.4) + k('M61 43q-6-2-8 3M61 43q6-2 8 3M61 43q-2-5 4-7', 2.2),
  // the comedy and tragedy masks under a storm cloud, lightning striking between them
  'drama-queen':
    g('rotate(-14 32 64) translate(32 64) scale(1.12) translate(-32 -64)',
      pk('M18 48Q32 42 46 48Q48 68 32 84Q16 68 18 48Z', 3.2),
      k('M23 58q4-5 8 0M34 58q4-5 8 0', 2.5), f('M24 66Q32 76 40 66Q32 70 24 66Z')) +
    g('rotate(14 68 64) translate(68 64) scale(1.12) translate(-68 -64)',
      f('M54 48Q68 42 82 48Q84 68 68 84Q52 68 54 48Z'),
      pl('M59 56q4 4 8 1M70 57q4 3 8-1', 2.4), p('M60 74Q68 64 76 74Q68 70 60 74Z')) +
    pk('M34 26Q26 26 26 19Q26 12 34 13Q36 5 45 5Q54 5 56 12Q65 11 66 18Q67 26 58 26Z', 2.8) +
    f('M48 26L42 38H48L44 50L56 34H50L54 26Z'),
};
