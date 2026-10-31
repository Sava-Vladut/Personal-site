// Marks for The Art of Seduction's seducer types and the Anti-Seducer, drawn with the shared pen (data/marks.ts). Keyed by id (data/seduction).
import { PEN } from '../marks';

const { INK, PAPER, n, k, p, pk, f, circle, oval, rect, g, star, glint, boat } = PEN;

/** An ink line drawn fat with a paper core: a tube, like a snake's body or a bent stem. */
const tube = (d: string, w = 9, core = 3.4) => k(d, w) + k(d, core).replace(INK, PAPER);

/** A point at angle a (degrees, 0 = right, -90 = up) and radius r from (cx, cy). */
const at = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];

/** A folding fan pivoting at (cx, cy), its leaf between r1 and r2, open from angle a1 to a2 in `folds` pleats. */
function fan(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number, folds: number) {
  const step = (a2 - a1) / folds;
  let out = '';
  for (let i = 0; i < folds; i++) {
    const a = a1 + i * step, b = a + step;
    const [x1, y1] = at(cx, cy, r1, a), [x2, y2] = at(cx, cy, r2, a), [x3, y3] = at(cx, cy, r2, b), [x4, y4] = at(cx, cy, r1, b);
    const [qx, qy] = at(cx, cy, r2 + 4, a + step / 2);
    const d = `M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}Q${n(qx)} ${n(qy)} ${n(x3)} ${n(y3)}L${n(x4)} ${n(y4)}Z`;
    out += i % 2 ? f(d) : pk(d, 2.6);
  }
  return out;
}

export const MARKS: Record<string, string> = {
  // a lyre on a rock calling out over the waves, a little boat turning towards it
  siren:
    f('M0 100V82L8 74L16 76L26 66L38 70L46 80L54 100Z') +
    k('M25 64C14 56 10 44 17 34C21 28 19 21 12 17', 4.6) + k('M39 64C50 56 54 44 47 34C43 28 45 21 52 17', 4.6) +
    pk(rect(19, 60, 26, 8, 4)) + pk(rect(11, 24, 42, 6, 3), 3) +
    k('M26 30V60M32 30V60M38 30V60', 1.8) +
    k('M60 30Q66 40 60 50', 3) + k('M68 24Q76 40 68 56', 3) +
    k('M56 90q6-4 12 0t12 0t12 0t12 0', 3) + g('rotate(-12 80 74)', boat(80, 74, 1.15)),

  // a rose crossed with a rapier
  rake:
    k('M36 40L78 88', 3.6) + k('M54 60l5-3M64 72l-5 2M70 79l4-4', 2.4) +
    pk('M58 64Q64 52 76 54Q70 66 58 64Z', 2.6) +
    g('translate(28 74) rotate(-45)',
      k('M4 0H76', 3.4), f('M72 -1.7L80 0L72 1.7Z'),
      pk(rect(-17, -3.5, 17, 7, 2), 2.6), pk(circle(-21, 0, 4.5), 2.6),
      k('M2 12Q-8 16 -18 5', 2.4), pk('M3 -12Q10 0 3 12Q-2 0 3 -12Z', 2.6)) +
    pk('M14 29Q12 12 29 12Q46 12 44 29Q42 46 29 46Q16 46 14 29Z') +
    k('M29 20Q36 20 36 27Q36 34 29 34Q22 34 22 27Q22 24 26 24Q30 24 30 27.5', 2.8) + k('M15 31Q22 39 29 39Q36 39 43 31', 2.6),

  // an easel, the canvas on it holding a shining star
  'ideal-lover':
    k('M30 94L42 24M70 94L58 24', 3.6) + k('M50 68V96', 3) +
    pk(rect(20, 18, 60, 46, 2)) + k('M16 66H84', 4.4) +
    f(star(50, 41, 15, 6.4)) + glint(30, 28, 3.5) + glint(70, 54, 3) +
    glint(90, 12, 5) + glint(10, 40, 3.5),

  // a peacock feather, its eye at the top
  dandy:
    g('rotate(24 50 54)',
      k('M50 98V20', 3),
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const y = 52 + i * 5.5, w = 16 - i * 1.5;
        return k(`M50 ${y}L${n(50 - w)} ${n(y - 6 - w * 0.2)}M50 ${y}L${n(50 + w)} ${n(y - 6 - w * 0.2)}`, 1.8);
      }).join(''),
      pk('M50 6Q70 18 70 34Q70 52 50 54Q30 52 30 34Q30 18 50 6Z'),
      f(oval(50, 36, 12, 14)), p(oval(50, 38, 6.5, 8)), f(oval(50, 40, 3, 4))) +
    glint(16, 22, 5) + glint(86, 72, 4),

  // a pinwheel on a stick, spinning in the wind
  natural:
    k('M44 40L56 96', 4.4) +
    [0, 90, 180, 270].map((a) => g(`rotate(${a} 44 38)`, pk('M44 38Q36 20 44 7Q62 6 67 25Q54 26 44 38Z', 3), f('M44 38Q36 20 44 7Q48 24 44 38Z'))).join('') +
    f(circle(44, 38, 3.4)) +
    k('M80 14q6 4 4 10M86 36q6 2 6 8M76 56q4 4 2 8', 2.8),

  // a folding fan, held half open
  coquette:
    k('M32 78L30 88', 2.4) + f('M26 86H34L32 94H28Z') +
    fan(32, 76, 18, 60, -112, -18, 9) +
    k(`M32 76L${at(32, 76, 20, -112).map(n).join(' ')}M32 76L${at(32, 76, 20, -18).map(n).join(' ')}`, 4) +
    f(circle(32, 76, 3.6)) + glint(84, 74, 5) + glint(76, 90, 3),

  // a cobra swaying up out of a basket to the music
  charmer:
    tube('M52 70Q68 62 60 53Q50 45 54 36', 10, 3.6) +
    pk('M55 41Q42 37 42 24Q43 13 53 11Q64 13 65 24Q65 37 55 41Z') +
    pk('M52 18Q44 11 35 14Q31 17 35 21Q43 24 52 22Z', 2.8) + f(circle(42, 16, 1.5)) + k('M33 18.5l-6-1l-2.2-2.4M27 17.5l-2.4 2', 1.6) +
    pk(rect(24, 66, 52, 8, 4)) + pk('M28 74H72L66 92H34Z') + k('M30 81H70M32 87.5H68', 2.4) +
    f(oval(18, 42, 4, 3)) + k('M21.6 41.5V26L27 23', 2.6) + f(oval(80, 32, 4, 3)) + k('M83.6 31.5V16', 2.6),

  // a lit torch held high, blazing
  charismatic:
    [-150, -120, -90, -60, -30, -170, -10].map((a) => {
      const [x1, y1] = at(50, 30, 24, a), [x2, y2] = at(50, 30, 34, a);
      return k(`M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`, 3.2);
    }).join('') +
    pk('M50 6Q66 20 62 34Q60 44 50 46Q40 44 38 34Q34 20 50 6Z') +
    f('M50 22Q57 30 55 37Q53 42 50 42Q47 42 45 37Q43 30 50 22Z') +
    pk('M36 46H64L58 56H42Z') + pk('M43 56H57L52 94H48Z') + k('M44.5 64H55.5', 2.6),

  // a strip of film, a star in its middle frame
  star:
    g('rotate(-12 50 50)',
      f(rect(-10, 27, 120, 46)),
      [-8, 2, 12, 22, 32, 42, 52, 62, 72, 82, 92, 102].map((x) => p(rect(x, 30.5, 5, 4.5, 1)) + p(rect(x, 65, 5, 4.5, 1))).join(''),
      p(rect(-4, 38, 30, 24, 2)), p(rect(35, 38, 30, 24, 2)), p(rect(74, 38, 30, 24, 2)),
      f(star(50, 50.5, 11, 4.6))) +
    glint(16, 16, 5) + glint(84, 86, 4.5),

  // a snuffer brought down over a candle, its flame gone to smoke
  'anti-seducer':
    pk(oval(42, 88, 28, 5)) + k(circle(76, 86, 5), 3) + pk(rect(32, 54, 20, 34, 2)) + k('M37 54v7', 2.4) +
    k('M29 48Q21 42 27 34Q33 26 25 18', 2.6) + k('M55 47Q62 42 58 35', 2.2) +
    k('M45 34Q60 26 88 8', 3.6) + pk('M30 51Q37 47 39 31Q40 25 42 24Q44 25 45 31Q47 47 54 51Z') + f(circle(42, 22, 2.6)),
};
