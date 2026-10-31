// Marks for The Art of Seduction's moves 1–12, drawn with the shared pen (data/marks.ts). Keyed by id (data/seduction).
import { PEN } from '../marks';

const { n, k, p, pk, f, circle, oval, rect, poly, g, star, glint, heart, person, hand, dashed, flower, drop } = PEN;

/** The soil's surface, for insinuation. */
const GROUND = 'M0 50Q30 44 54 48Q78 52 100 46';

/** A butterfly's right wings, upper and lower, from its body at (0, 0). */
const UW = 'M1-3C4-13 12-17 16-13C19-9 14-2 2 0Z', LW = 'M2 1C10 1 14 6 11 11C8 14 3 9 1 3Z';
/** A butterfly, its body at (x, y): paper wings outlined in ink, or all ink. */
const butterfly = (x: number, y: number, s: number, paper = false, turn = 0) => {
  const w = (d: string) => (paper ? pk(d, 2.6 / s) : f(d));
  return g(`translate(${x} ${y}) rotate(${turn}) scale(${s})`,
    w(UW), w(LW), g('scale(-1 1)', w(UW), w(LW)),
    f(oval(0, 0, 1.7, 7)), k('M-1-6Q-3-11-6-13M1-6Q3-11 6-13', 1.8 / s));
};

/** An orb web round (cx, cy): spokes out to radius r and rings of thread sagging between them. */
const web = (cx: number, cy: number, r: number, spokes: number, rings: number) => {
  const ang = Array.from({ length: spokes }, (_, i) => (i / spokes) * Math.PI * 2 + 0.3);
  const at = (rr: number, a: number) => `${n(cx + rr * Math.cos(a))} ${n(cy + rr * Math.sin(a))}`;
  const rg = Array.from({ length: rings }, (_, j) => {
    const rr = r * (0.3 + (0.66 * j) / (rings - 1));
    return 'M' + at(rr, ang[0]) + ang.map((a, i) => {
      const b = i === spokes - 1 ? ang[0] + Math.PI * 2 : ang[i + 1];
      return `Q${at(rr * 0.86, (a + b) / 2)} ${at(rr, b)}`;
    }).join('');
  }).join('');
  return k(ang.map((a) => `M${cx} ${cy}L${at(r, a)}`).join(''), 2.2) + k(rg, 2);
};

/** A small spider, hanging by its thread at (x, y). */
const spider = (x: number, y: number) =>
  k(`M${x - 3} ${y - 1}l-5-4m5 3l-7 1m7 1l-5 6M${x + 3} ${y - 1}l5-4m-5 3l7 1m-7 1l5 6`, 2) + f(oval(x, y + 1, 4, 5)) + f(circle(x, y - 5, 2.8));

/** A tuning fork standing on its stem, its prongs centred on x. */
const fork = (x: number, top: number, foot: number) =>
  pk(`M${x - 10} ${top}V${top + 26}Q${x - 10} ${top + 38} ${x - 3} ${top + 39}V${foot}H${x + 3}V${top + 39}Q${x + 10} ${top + 38} ${x + 10} ${top + 26}V${top}H${x + 4}V${top + 26}Q${x + 4} ${top + 32} ${x} ${top + 32}Q${x - 4} ${top + 32} ${x - 4} ${top + 26}V${top}Z`);

/** A bunch of grapes, its widest row at y. */
const grapes = (x: number, y: number) =>
  [[-12, 0], [-4, 0], [4, 0], [12, 0], [-8, 7], [0, 7], [8, 7], [-4, 14], [4, 14], [0, 21]]
    .map(([dx, dy]) => pk(circle(x + dx, y + dy, 5.3), 2.6)).join('');

/** An Archimedean spiral in to (cx, cy) from radius r over the given turns, as a path tail (no M). */
const spiral = (cx: number, cy: number, r: number, turns: number, a0 = 0) =>
  Array.from({ length: Math.round(turns * 24) + 1 }, (_, i) => {
    const t = i / 24, a = a0 + t * Math.PI * 2, rr = r * (1 - t / (turns + 0.4));
    return `L${n(cx + rr * Math.cos(a))} ${n(cy + rr * Math.sin(a))}`;
  }).join('');

export const MARKS: Record<string, string> = {
  // a butterfly net swung at one pale butterfly, the dark ones left to fly
  'choose-victim':
    butterfly(14, 58, 0.55, false, -14) + butterfly(84, 16, 0.5, false, 18) +
    g('translate(60 58) rotate(-50)',
      k('M-20 0H-56', 4.4),
      pk('M-19 2Q-14 34 6 36Q20 30 19 2Z', 3), k('M-10 6Q-4 26 4 32M0 4Q6 22 10 30M10 4Q12 18 14 26M-16 14Q0 20 17 12', 1.8),
      k(oval(0, 0, 20, 7), 3.6)) +
    butterfly(34, 28, 1.25, true, -12),

  // a web spun in a quiet corner, dew on its threads, the spider waiting below
  'false-security':
    k('M0 10L26 28M100 6L70 24M36 100L42 74', 2.2) + web(48, 46, 28, 8, 3) +
    k('M66 54V72', 1.8) + spider(66, 78) +
    [[27, 36], [60, 26], [69, 50], [36, 69], [52, 32]].map(([x, y]) => pk(circle(x, y, 3.2), 2)).join('') +
    glint(86, 90, 4.5) + glint(14, 84, 3.4),

  // a heart half light and half dark
  'mixed-signals':
    pk(heart(50, 52, 30)) + f('M50 82C98 52 83 16 50 38.5Z') + k(heart(50, 52, 30)) +
    p(star(64, 44, 6, 2.4, 5)) + glint(30, 46, 5),

  // a love triangle: one figure at its peak, wanted by the two below
  'object-of-desire':
    pk(poly(50, 20, 84, 78, 16, 78), 3) + f(heart(50, 58, 9)) +
    person(50, 28, 9, true) + person(20, 84, 8) + person(80, 84, 8) + glint(84, 18, 5),

  // an empty glass, one drop falling into it
  'create-need':
    k('M50 62V84', 4) + pk(oval(50, 86, 15, 3.6)) +
    pk('M28 26H72Q72 58 50 62Q28 58 28 26Z') + f('M44 57Q50 59 56 57Q50 60.5 44 57Z') +
    k('M36 34Q36 48 42 54', 2.4) + f(drop(50, 15, 5)) + k('M40 3v5M60 3v5', 2.4),

  // a seed sown out of sight: roots spreading under the soil, only a small shoot showing, another seed on its way down
  insinuation:
    p(GROUND + 'V100H0Z') + k(GROUND) +
    k('M52 76Q44 84 34 88Q26 90 20 98M54 77Q62 84 72 86Q80 88 86 96M53 78Q52 88 54 100', 3) + k('M40 85Q38 90 40 96M70 86Q74 90 72 98', 2.4) +
    g('rotate(-20 53 70)', f(oval(53, 70, 9, 6.2))) + k('M54 64Q55 56 54 51', 2.6) +
    k('M54 50Q54 42 58 40', 3) + pk('M58 41Q64 34 70 37Q65 44 58 41Z', 2.4) +
    f(circle(18, 66, 1.6)) + f(circle(84, 62, 1.6)) + f(circle(28, 80, 1.3)) +
    dashed(k('M8 6Q28 6 30 22Q31 30 28 38', 2.4)) + g('rotate(70 28 40)', f(oval(28, 40, 3.6, 2.6))) + glint(84, 18, 5),

  // two tuning forks, one struck, the other ringing with it
  'enter-spirit':
    fork(31, 22, 74) + fork(69, 22, 74) + pk(rect(14, 74, 72, 10, 3)) +
    k('M15 28Q11 37 15 46M9 24Q3 37 9 50M47 28Q51 37 47 46M85 28Q89 37 85 46', 2.8),

  // grapes hanging from the vine, a hand reaching up for them, not quite there
  temptation:
    k('M0 10Q24 18 50 10T100 8', 4.4) + k('M64 11Q64 18 62 24', 3) + pk('M68 11Q82 3 90 13Q78 21 68 11Z', 2.6) + k('M30 14Q26 24 32 28', 2.2) +
    grapes(62, 30) + hand(29, 93, 34, 1, true) + glint(86, 58, 4.5) + glint(14, 38, 3.4),

  // a roller-coaster car stopped on the crest, the drop ahead
  suspense:
    k('M16 94V74M28 94V56M40 94V40', 2.6) + k('M16 80L28 66M28 66L40 56M28 74L40 64', 1.8) +
    k('M0 84Q16 80 26 62Q38 38 52 32Q60 30 64 40Q72 62 78 100', 4.4) + k('M4 94H66', 3) +
    g('rotate(6 52 26)', pk(rect(40, 15, 22, 12, 3)), pk(circle(45, 28, 3.2), 2.4), pk(circle(57, 28, 3.2), 2.4)) +
    k('M72 16l3-6M80 24l6-3', 3) + glint(86, 50, 4),

  // a quill whose line of ink curls into a spiral
  'demonic-words':
    g('translate(42 54) rotate(-48) scale(0.92)',
      k('M0 0H66', 2.6), pk('M14 0Q26-13 60-10Q68-6 66 0Q52 9 20 4Z'), k('M30-1L38-9M40-1L48-9M50-1L56-8', 1.8),
      f('M0 0L10-2.6V2.6Z')) +
    k('M42 54Q36 56 36 62' + spiral(26, 70, 15, 2.2, 0), 3.2) +
    f(circle(52, 84, 2)) + f(circle(60, 78, 1.4)) + f(circle(12, 48, 1.6)),

  // a gift, its bow tied just so, a small flower tucked into the knot
  detail:
    pk(rect(24, 52, 52, 36, 2)) + f(rect(45, 52, 10, 36)) +
    pk(rect(18, 40, 64, 12, 2)) + f(rect(45, 40, 10, 12)) +
    pk('M50 40Q34 20 26 28Q22 36 50 40Z') + pk('M50 40Q66 20 74 28Q78 36 50 40Z') +
    k('M50 40Q44 50 40 54M50 40Q56 50 60 54', 3) + f(oval(50, 39, 4.4, 3.4)) +
    k('M56 36L76 16', 2.2) + flower(76, 16, 9) + glint(14, 22, 5) + glint(88, 74, 4),

  // a nightingale singing on a branch before the full moon
  poeticize:
    pk(circle(60, 40, 27)) + k('M50 20Q42 26 40 36', 2.6) +
    k('M0 80Q30 70 56 72Q74 74 92 62', 4) + k('M72 72Q80 82 90 82M42 72Q40 64 32 60', 3) + pk('M88 82Q94 74 100 78Q96 86 88 82Z', 2.4) +
    g('translate(34 72) scale(1.3) translate(-34 -72)',
      f('M24 66Q22 54 32 50Q38 46 42 50L48 48L43 53Q46 60 42 66Q36 74 26 76L14 82L20 72Z'), p(circle(39, 52, 1.3))) +
    k('M58 38q4 4 1 9M64 33q7 6 2 16', 2.4) + glint(14, 18, 5) + glint(26, 34, 3),
};
