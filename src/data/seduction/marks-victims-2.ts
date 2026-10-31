// Marks for The Art of Seduction's victims 10–18, drawn with the shared pen (data/marks.ts). Keyed by id (data/seduction).
import { PEN } from '../marks';

const { k, p, pk, f, pl, circle, oval, rect, poly, g, star, glint, flower, person } = PEN;

/** A book lying flat, its spine facing us: paper with a band at each end, or solid ink with paper bands. */
const book = (x: number, y: number, w: number, h: number, ink = false) =>
  ink
    ? f(rect(x, y, w, h, 1.5)) + pl(`M${x + 6} ${y + 2.5}V${y + h - 2.5}M${x + w - 6} ${y + 2.5}V${y + h - 2.5}`, 2.2)
    : pk(rect(x, y, w, h, 1.5)) + k(`M${x + 6} ${y + 2.5}V${y + h - 2.5}M${x + w - 6} ${y + 2.5}V${y + h - 2.5}`, 2.2);

export const MARKS: Record<string, string> = {
  // round spectacles resting on top of a tall stack of books
  professor:
    book(16, 78, 64, 12) + g('rotate(-3 50 72)', book(24, 67, 54, 11, true)) + book(20, 56, 56, 11) + g('rotate(4 52 50)', book(28, 45, 48, 11)) +
    k('M29 32H23M71 32H77', 3) +
    pk(circle(39, 33, 10)) + pk(circle(61, 33, 10)) + k('M49 32Q50 28 51 32', 3) +
    k('M33 29q3-4 7-3M55 29q3-4 7-3', 2) + glint(84, 18, 5),

  // a rose kept under a glass bell jar, one petal already fallen
  beauty:
    pk(rect(16, 78, 68, 10, 3)) +
    k('M50 78V50', 3) + pk('M50 68Q40 66 36 58Q46 56 50 64Z', 2.4) + pk('M50 62Q60 58 64 52Q54 50 50 58Z', 2.4) +
    pk('M39 38Q39 52 50 52Q61 52 61 38Q61 30 50 30Q39 30 39 38Z') + k('M50 36Q55 36 55 40Q55 45 50 45Q44 45 44 39Q44 33 52 32M39 40Q44 48 50 48', 2.2) +
    pk('M58 78Q60 72 66 72Q65 77 58 78Z', 2.2) +
    k('M26 78V40Q26 14 50 14Q74 14 74 40V78') + pk(circle(50, 10, 4), 2.8) +
    k('M32 46V36Q32 26 40 22', 2.6),

  // a baby's dummy whose shield is a grown-up's polka-dot bow tie
  'aging-baby':
    k(circle(50, 26, 13), 5) +
    pk('M12 56Q12 38 28 42L44 50V62L28 70Q12 74 12 56Z') + pk('M88 56Q88 38 72 42L56 50V62L72 70Q88 74 88 56Z') +
    f(circle(24, 52, 2.6)) + f(circle(30, 62, 2.6)) + f(circle(21, 63, 2)) + f(circle(76, 52, 2.6)) + f(circle(70, 62, 2.6)) + f(circle(79, 63, 2)) +
    pk('M44 68Q40 86 50 90Q60 86 56 68Z', 3) + pk(rect(42, 47, 16, 18, 4)),

  // a rope let down into a dark pit, the small figure at the bottom catching hold of it
  rescuer:
    p('M0 44H100V100H0Z') + k('M-4 44H28M72 44H104') + f('M28 44H72V100H28Z') +
    k('M56 0V44', 5) + pl('M54 4l4 3M54 12l4 3M54 20l4 3M54 28l4 3M54 36l4 3', 1.4) + pl('M56 44V76', 3.4) + p(circle(56, 78, 3.2)) +
    pk(circle(45, 76, 6.5), 2.6) + pk('M32 100V92Q32 85 45 85Q58 85 58 92V100Z', 2.6) + pl('M53 86L56 64', 3.6) + pk(circle(56, 62, 3.4), 2.2),

  // an old gentleman's cane bursting into fresh bloom
  roue:
    k('M32 92L52 26Q56 12 46 10Q38 10 36 18', 6) + pk(rect(46, 28, 10, 6, 2), 2.4) +
    k('M42 58Q52 56 58 46', 2.6) + pk('M48 56Q50 48 58 48Q56 56 48 56Z', 2.2) + flower(64, 40, 14) +
    k('M36 78Q28 74 22 76', 2.6) + pk('M28 75Q22 68 16 72Q22 79 28 75Z', 2.2) +
    glint(80, 18, 5) + glint(84, 66, 3.5),

  // a small figure kneeling, arms raised, before a bust on a column ringed with light
  'idol-worshipper':
    k('M64 4v5M48 10l4 4M80 10l-4 4M42 24h6M86 24h-6', 3) +
    person(64, 36, 11, true) +
    pk(rect(50, 47, 28, 6, 1.5)) + pk(rect(54, 53, 20, 33)) + k('M60 56V84M68 56V84', 2.2) + pk(rect(48, 86, 32, 6, 1.5)) +
    k('M28 68L40 55M24 67L30 50', 3.2) + f(circle(23, 60, 5)) + f('M17 67Q23 63 30 67L29 77L37 81Q41 86 37 89H13Q11 82 17 79Z') + k('M8 90H44', 3),

  // a perfume bottle with its atomiser bulb, the scent drifting up in curls
  sensualist:
    pk('M20 54Q20 46 28 46H56Q64 46 64 54V80Q64 88 56 88H28Q20 88 20 80Z') + k('M28 56V78', 2.6) +
    pk(rect(36, 36, 12, 10, 1.5)) + pk(rect(38, 28, 8, 8, 1.5)) + k('M37 32H32', 3) +
    k('M46 32H62Q72 32 72 44', 2.6) + f(oval(76, 54, 8, 10)) + k('M76 64V70', 2.4) +
    f(circle(26, 31, 1.6)) + f(circle(22, 27, 1.6)) + f(circle(21, 34, 1.4)) +
    k('M18 24C8 20 22 14 14 6', 2.6) + k('M30 20C22 16 36 10 28 2', 2.6),

  // an empty throne high on a stepped dais
  'lonely-leader':
    p('M6 104V86H16V76H26V66H74V76H84V86H94V104Z') + k('M6 86H16V76H26V66H74V76H84V86H94', 3.2) +
    pk('M38 56V24Q38 12 50 10Q62 12 62 24V56Z') + f(star(50, 28, 6, 2.6, 5)) + f(circle(50, 6, 3)) +
    pk(rect(32, 40, 9, 18, 2)) + pk(rect(59, 40, 9, 18, 2)) + pk(rect(36, 46, 28, 9, 2)) + k('M38 56V66M62 56V66', 3.4) +
    glint(16, 22, 5) + glint(84, 40, 3.5),

  // a hanging mobile, its shapes drifting in balance
  'floating-gender':
    k('M48 0V16', 2.4) + k('M18 21Q48 13 78 21', 3.2) + f(circle(48, 17, 2.2)) +
    k('M20 20V42M76 20V34', 2) + pk(circle(20, 53, 10)) +
    k('M57 37Q71 32 85 37', 3) + f(circle(73, 34, 2)) +
    k('M59 37V56M83 37V60', 2) + g('rotate(8 59 66)', f(poly(59, 56, 69, 74, 49, 74))) + g('rotate(-14 83 68)', pk('M82 60A9 9 0 1 0 88 76A7 7 0 1 1 82 60Z')),
};
