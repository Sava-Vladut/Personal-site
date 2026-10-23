// Marks: one small drawing per mind trap, per law of power and per principle, in the manner of a magazine spot illustration:
// ivory cut-paper shapes and loose black brush lines on a flat colour tile (the tile and the wobble that makes
// the lines look hand-inked live in components/Mark.tsx). Every drawing sits in a 100 × 100 box.
// Keyed by trap id (data/traps.ts), law id (data/laws) and principle id (data/principles).

const INK = '#141413';
const PAPER = '#faf9f5';
const W = 3.6;

const n = (v: number) => +v.toFixed(1);

/* ---------- the pen ---------- */

/** Ink line. */
const k = (d: string, w = W) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** Cut paper, no outline. */
const p = (d: string) => `<path d="${d}" fill="${PAPER}"/>`;
/** Cut paper, outlined in ink. */
const pk = (d: string, w = W) => `<path d="${d}" fill="${PAPER}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"/>`;
/** Solid ink. */
const f = (d: string) => `<path d="${d}" fill="${INK}"/>`;

const circle = (cx: number, cy: number, r: number) => `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;
const oval = (cx: number, cy: number, rx: number, ry: number) => `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0Z`;
const rect = (x: number, y: number, w: number, h: number, r = 0) =>
  r ? `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z` : `M${x} ${y}h${w}v${h}h${-w}Z`;
const poly = (...pts: number[]) => 'M' + pts.reduce<string[]>((a, v, i) => (i % 2 ? a : [...a, `${n(v)} ${n(pts[i + 1])}`]), []).join('L') + 'Z';
const g = (t: string, ...parts: string[]) => `<g transform="${t}">${parts.join('')}</g>`;

/** A star or burst: n points between two radii. */
const star = (cx: number, cy: number, r1: number, r2: number, pts = 5, turn = -90) =>
  poly(...Array.from({ length: pts * 2 }, (_, i) => {
    const r = i % 2 ? r2 : r1, a = ((turn + (i * 180) / pts) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }).flat());
/** A four-point glint. */
const glint = (cx: number, cy: number, r: number) =>
  f(`M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`);
const heart = (cx: number, cy: number, s: number) =>
  `M${cx} ${n(cy + s)}C${n(cx - s * 1.6)} ${n(cy)} ${n(cx - s * 1.1)} ${n(cy - s * 1.2)} ${cx} ${n(cy - s * 0.45)}C${n(cx + s * 1.1)} ${n(cy - s * 1.2)} ${n(cx + s * 1.6)} ${n(cy)} ${cx} ${n(cy + s)}Z`;
const cloud = (cx: number, cy: number, s: number) =>
  `M${n(cx - 2.2 * s)} ${n(cy + s)}Q${n(cx - 3.2 * s)} ${n(cy + s)} ${n(cx - 3 * s)} ${n(cy + 0.1 * s)}Q${n(cx - 2.8 * s)} ${n(cy - 0.8 * s)} ${n(cx - 1.6 * s)} ${n(cy - 0.6 * s)}Q${n(cx - 1.2 * s)} ${n(cy - 2 * s)} ${n(cx + 0.2 * s)} ${n(cy - 1.8 * s)}Q${n(cx + 1.6 * s)} ${n(cy - 1.7 * s)} ${n(cx + 1.7 * s)} ${n(cy - 0.5 * s)}Q${n(cx + 3 * s)} ${n(cy - 0.6 * s)} ${n(cx + 3 * s)} ${n(cy + 0.3 * s)}Q${n(cx + 3 * s)} ${n(cy + s)} ${n(cx + 2.2 * s)} ${n(cy + s)}Z`;
/** A question mark, s tall-ish. */
const ask = (cx: number, cy: number, s: number, w = W) =>
  k(`M${n(cx - s * 0.5)} ${n(cy - s * 0.45)}Q${n(cx - s * 0.5)} ${n(cy - s)} ${cx} ${n(cy - s)}Q${n(cx + s * 0.55)} ${n(cy - s)} ${n(cx + s * 0.55)} ${n(cy - s * 0.45)}Q${n(cx + s * 0.55)} ${n(cy - s * 0.05)} ${cx} ${n(cy + s * 0.1)}V${n(cy + s * 0.35)}`, w) +
  f(circle(cx, cy + s * 0.75, w * 0.6));
/** A person: head and shoulders. */
const person = (x: number, y: number, s: number, paper = false) => {
  const head = circle(x, y - s * 1.1, s * 0.62), body = `M${n(x - s)} ${n(y + s)}Q${n(x - s)} ${n(y - s * 0.3)} ${x} ${n(y - s * 0.3)}Q${n(x + s)} ${n(y - s * 0.3)} ${n(x + s)} ${n(y + s)}Z`;
  return paper ? pk(head, 2.6) + pk(body, 2.6) : f(head) + f(body);
};

/**
 * A hand, fingers up, wrist at (0, 0), drawn as one loose line the way a brush pen would: up the palm, around four
 * fingers, out to the thumb and back down the arm. Place it with x, y, a turn in degrees and a scale.
 */
function hand(x: number, y: number, turn = 0, s = 1, mirror = false) {
  const lens = [17, 20, 19, 14];
  let d = 'M-12 70V30C-12 16-12.5 4-12-14';
  lens.forEach((len, j) => {
    const x0 = -12 + j * 6.2, top = -14 - len + 2.8;
    d += `L${n(x0)} ${n(top)}A2.8 2.8 0 0 1 ${n(x0 + 5.6)} ${n(top)}L${n(x0 + 5.6)} -15`;
    if (j < 3) d += `Q${n(x0 + 5.9)} -12.6 ${n(x0 + 6.2)} -15`;
  });
  d += 'L12.2-9C15-12 19-16.5 21.8-15C24.6-13.4 21-7 15.5-1.5C13 1.5 12.6 14 12.6 30V70';
  return g(`translate(${x} ${y}) rotate(${turn}) scale(${mirror ? -s : s} ${s})`, k(d, W / s));
}

/** A pencil from (x1, y1), its point, back to (x2, y2). */
function pencil(x1: number, y1: number, x2: number, y2: number, w = 9) {
  const len = Math.hypot(x2 - x1, y2 - y1), a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return g(`translate(${x1} ${y1}) rotate(${n(a)})`,
    pk(`M0 0L12 ${-w / 2}H${n(len)}V${w / 2}H12Z`),
    f(`M0 0L4.5 ${n(-w / 5.4)}V${n(w / 5.4)}Z`),
    k(`M${n(len - 8)} ${-w / 2}V${w / 2}`, 2.6));
}

/** A crown, its band's centre at (cx, cy). */
const crown = (cx: number, cy: number, w: number) => {
  const h = w * 0.62;
  return pk(`M${n(cx - w / 2)} ${cy}V${n(cy - h)}L${n(cx - w / 4)} ${n(cy - h * 0.55)}L${cx} ${n(cy - h * 1.1)}L${n(cx + w / 4)} ${n(cy - h * 0.55)}L${n(cx + w / 2)} ${n(cy - h)}V${cy}Z`) +
    f(circle(cx - w / 2, cy - h - 3, 2.6)) + f(circle(cx, cy - h * 1.1 - 3, 2.6)) + f(circle(cx + w / 2, cy - h - 3, 2.6));
};

/** A speech bubble with its tail at the bottom left. */
const bubble = (x: number, y: number, w: number, h: number) =>
  `M${x + 8} ${y}H${x + w - 8}Q${x + w} ${y} ${x + w} ${y + 8}V${y + h - 8}Q${x + w} ${y + h} ${x + w - 8} ${y + h}H${x + 18}L${x + 6} ${y + h + 10}L${x + 9} ${y + h}H${x + 8}Q${x} ${y + h} ${x} ${y + h - 8}V${y + 8}Q${x} ${y} ${x + 8} ${y}Z`;

/** A fluffy outline: an oval with scalloped edges, for wool and clouds. */
const fluff = (cx: number, cy: number, rx: number, ry: number, bumps = 11) => {
  const pts = Array.from({ length: bumps }, (_, i) => {
    const a = (i / bumps) * Math.PI * 2;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
  return `M${n(pts[0][0])} ${n(pts[0][1])}` + pts.map((_, i) => {
    const [x, y] = pts[(i + 1) % bumps], b = n(Math.hypot(x - pts[i][0], y - pts[i][1]) * 0.56);
    return `A${b} ${b} 0 0 1 ${n(x)} ${n(y)}`;
  }).join('') + 'Z';
};

const sheep = (x: number, y: number, s = 1) =>
  g(`translate(${x} ${y}) scale(${s})`,
    k('M-6 5V13M-1 6V13M4 6V13M8 5V12', W / s),
    pk(fluff(0, 0, 11, 7.5), W / s),
    f(oval(12, -3, 4, 5.4)), f(oval(9, -6.5, 3, 1.6)));

/* ---------- mind traps ---------- */

export const TRAP_MARKS: Record<string, string> = {
  confirmation:
    pk('M18 20L62 15L66 76L22 80Z') +
    k('M28 33l4 4l7-8M29 47l4 4l7-8M30 61l4 4l7-8') +
    pk(circle(64, 56, 15)) + k('M57 56l5 5l9-10') + k('M75 67L88 80', 7),
  motivated:
    pk(circle(42, 58, 24)) + k('M42 38v5M42 73v5M22 58h5M57 58h5', 2.8) +
    f('M58 42L44.8 60.8L40.2 56.2Z') + pk('M26 74L44.8 60.8L40.2 56.2Z', 2.6) + f(circle(42, 58, 2.6)) +
    pk(heart(78, 22, 10)),
  perseverance:
    p('M0 84Q50 64 100 84V100H0Z') + k('M0 84Q50 64 100 84') +
    k('M46 75V20', 4.2) + pk('M46 22L80 30L46 40Z') +
    k('M8 30q8-4 16 0M4 44q10-4 20 0M12 58q6-3 12 0', 3),
  'illusory-truth':
    pk(bubble(14, 14, 46, 24)) + pk(bubble(26, 34, 46, 24)) + pk(bubble(38, 54, 46, 24)) +
    k('M48 66h26', 3) + k('M36 46h16', 3) + k('M24 26h16', 3),
  apophenia:
    k('M30 66L42 74L58 74L70 66', 2.4) + k('M34 40L50 54L66 40', 2.4) +
    pk(circle(34, 40, 4.6), 2.8) + pk(circle(66, 40, 4.6), 2.8) + pk(circle(50, 54, 3.6), 2.8) +
    pk(circle(30, 66, 3.6), 2.8) + pk(circle(42, 74, 3.6), 2.8) + pk(circle(58, 74, 3.6), 2.8) + pk(circle(70, 66, 3.6), 2.8) +
    f(circle(16, 20, 2)) + f(circle(82, 22, 1.6)) + f(circle(86, 50, 2.2)) + f(circle(14, 52, 1.6)) + f(circle(52, 22, 1.8)) + f(circle(24, 86, 1.8)) + f(circle(84, 84, 2)),
  'just-world':
    k('M50 24V80', 4.2) + pk('M32 86H68L63 78H37Z') + k('M18 30H82', 4) + f(circle(50, 22, 4.4)) +
    k('M20 30L11 56M20 30L29 56M80 30L71 56M80 30L89 56', 2.4) +
    pk('M8 56H32Q20 70 8 56Z') + pk('M68 56H92Q80 70 68 56Z'),
  hindsight:
    k('M50 30V12', 4.2) + pk(rect(14, 28, 72, 34, 15)) +
    k('M28 45Q50 28 72 45Q50 62 28 45Z', 3) + f(circle(50, 45, 6.5)) + p(circle(52.5, 42.5, 1.8)) +
    k('M74 82Q50 92 28 82', 3.2) + k('M35 76L27 82L35 88', 3.2),
  misinformation:
    pk('M14 22L66 16L70 66L18 72Z') + k('M22 62L36 42L46 54L54 46L64 58', 3) + k(circle(56, 30, 4.5), 2.6) +
    pencil(52, 84, 92, 50),
  rosy:
    pk(circle(31, 50, 16)) + pk(circle(69, 50, 16)) + k('M47 47Q50 42 53 47') + k('M15 45L5 38M85 45L95 38') +
    f(heart(31, 50, 6.5)) + f(heart(69, 50, 6.5)) + glint(22, 22, 5) + glint(80, 76, 4),
  'peak-end':
    p('M18 82V70C28 66 30 30 40 28C50 26 52 60 62 62C70 64 74 52 84 46V82Z') +
    k('M14 18V84H88') + k('M18 70C28 66 30 30 40 28C50 26 52 60 62 62C70 64 74 52 84 46') +
    pk(circle(40, 28, 5.5)) + f(circle(84, 46, 5.5)),
  negativity:
    k('M34 8v6M34 58v6M10 36h6M52 36h6M17 19l4 4M47 49l4 4M51 19l-4 4M17 53l4-4', 3) + pk(circle(34, 36, 15)) +
    f(cloud(62, 56, 9)) + k('M44 74l-4 10M56 74l-4 10M68 74l-4 10M80 74l-4 10', 3),
  halo:
    p('M18 100Q18 76 50 76Q82 76 82 100Z') + k('M18 100Q18 76 50 76Q82 76 82 100') + pk(circle(50, 52, 17)) +
    k(oval(50, 24, 20, 6), 4) + glint(20, 30, 6) + glint(82, 40, 5) + glint(78, 14, 3.5),
  fae:
    k('M8 88H92', 3) + k('M51 60Q51 50 57 45', 4) +
    pk('M47 62Q32 54 21 64Q14 72 18 86Q23 75 33 71Q41 69 46 72Z') + pk('M55 62Q70 54 81 64Q88 72 84 86Q79 75 69 71Q61 69 56 72Z') + pk('M44 88Q40 70 47 59Q52 55 56 60Q60 72 57 88Z') +
    g('rotate(-24 56 22)', pk('M36 20Q36 10 44 10H52Q56 18 70 20Q78 22 78 30H36Z'), k('M36 30H78', 2.6)) + k('M24 40q4-6 10-6M74 42q6 0 8 6', 2.6),
  conformity:
    [26, 50, 74].map((y, r) => [14, 40, 66].map((x, c) => (r === 2 && c === 2 ? '' : k(`M${x} ${y}h20m-7-7l7 7l-7 7`))).join('')).join('') +
    k('M70 94Q70 74 86 74', 3.6) + k('M79 67l7 7l-7 7'),
  authority:
    pk(star(50, 50, 34, 17, 6)) + pk(circle(50, 50, 10)) + f(star(50, 50, 6, 2.6, 5)) +
    [0, 1, 2, 3, 4, 5].map((i) => f(circle(50 + 36 * Math.cos(((i * 60 - 90) * Math.PI) / 180), 50 + 36 * Math.sin(((i * 60 - 90) * Math.PI) / 180), 3.2))).join(''),
  'in-group':
    pk(circle(42, 50, 30)) + person(32, 44, 6) + person(52, 44, 6) + person(32, 66, 6) + person(52, 66, 6) +
    person(85, 84, 7, true),
  curse:
    pk('M28 92V72Q14 62 16 42Q20 14 48 14Q72 16 74 38L80 52L74 54V62Q74 68 66 68H58V92Z') +
    k('M28 38q6-10 14-2q8 8 14-2q4-6-4-8q-10-2-14 6q-4 10 8 12q10 2 10-8', 2.6) + ask(88, 22, 9, 3.2),
  overconfidence:
    k('M10 88H90', 3) +
    pk(rect(30, 74, 36, 14, 1)) +
    g('rotate(4 50 67)', pk(rect(34, 61, 30, 13, 1))) +
    g('rotate(9 52 54)', pk(rect(38, 48, 26, 12, 1))) +
    g('rotate(15 56 41)', pk(rect(44, 36, 22, 11, 1))) +
    g('rotate(22 62 28)', pk(rect(52, 24, 18, 10, 1))) + k('M82 16q4 4 2 10M86 36q4 2 4 8', 2.6),
  'dunning-kruger':
    p('M16 82V78C22 20 30 20 36 40C42 62 48 70 58 64C68 58 76 46 86 40V82Z') +
    k('M12 14V84H90') + k('M16 78C22 20 30 20 36 40C42 62 48 70 58 64C68 58 76 46 86 40') +
    k('M28 29V10', 2.8) + f('M28 10L40 13L28 18Z'),
  'self-serving':
    k('M34 28Q20 28 22 40Q24 48 36 48M66 28Q80 28 78 40Q76 48 64 48') +
    pk('M33 20H67V36Q67 58 50 60Q33 58 33 36Z') + k('M50 60V70') + pk(rect(36, 70, 28, 10, 2)) +
    f(star(50, 38, 8, 3.4, 5)) + glint(18, 16, 5) + glint(84, 70, 4.5),
  spotlight:
    p('M24 20L36 16L86 86Q60 98 28 90Z') + f('M12 6L32 2L38 20L18 26Z') + k('M10 0L14 8', 3) +
    person(56, 80, 8) + k(oval(56, 90, 18, 3.5), 2.4),
  'blind-spot':
    k('M40 46L92 20M40 54L92 80', 2.6) + pk('M8 50Q24 32 42 50Q24 68 8 50Z') + f(circle(25, 50, 6)) +
    f(circle(70, 50, 13)) + p(circle(66, 46, 2.4)),
  barnum:
    pk('M30 84L35 72H65L70 84Z') + pk(circle(50, 46, 26)) + k('M33 38Q36 26 48 22', 2.6) +
    glint(54, 46, 9) + glint(40, 58, 4.5) + glint(64, 32, 3.5),
  availability:
    p('M0 70H100V100H0Z') + pk('M30 66Q42 40 64 18Q60 44 72 66Z') +
    k('M2 68q8-6 16 0t16 0t16 0t16 0t16 0t16 0') + k('M10 82q8-6 16 0t16 0t16 0t16 0t16 0', 3),
  gamblers:
    [16, 34, 52, 70].map((x, i) => f(circle(x + 6, 24 + (i % 2) * 2, 7.5))).join('') +
    pk(circle(50, 64, 20)) + ask(50, 64, 9),
  'base-rate':
    Array.from({ length: 25 }, (_, i) => {
      const x = 22 + (i % 5) * 14, y = 22 + Math.floor(i / 5) * 14;
      return i === 17 ? pk(circle(x, y, 6.2), 3) : f(circle(x, y, 3.6));
    }).join(''),
  conjunction:
    p(circle(37, 50, 23)) + p(circle(63, 50, 23)) + f('M50 31A23 23 0 0 1 50 69A23 23 0 0 1 50 31Z') +
    k(circle(37, 50, 23)) + k(circle(63, 50, 23)),
  survivorship:
    pk('M45 38L10 56V63L45 55Z') + pk('M55 38L90 56V63L55 55Z') + pk('M42 78L30 86V90L50 85L70 90V86L58 78Z') +
    pk('M50 10Q56 12 56 24V78Q56 84 50 86Q44 84 44 78V24Q44 12 50 10Z') +
    [[22, 55], [30, 51], [70, 51], [79, 56], [36, 54], [64, 54], [40, 86], [61, 86], [50, 44], [50, 52]].map(([x, y]) => f(circle(x, y, 1.9))).join(''),
  'illusion-control':
    g('rotate(-14 36 64)', pk(rect(20, 48, 32, 32, 6)), f(circle(29, 57, 3)), f(circle(36, 64, 3)), f(circle(43, 71, 3))) +
    g('rotate(12 66 52)', pk(rect(52, 38, 28, 28, 6)), f(circle(60, 46, 2.7)), f(circle(72, 46, 2.7)), f(circle(60, 58, 2.7)), f(circle(72, 58, 2.7))) +
    k('M70 22q6-4 12 0M76 12q6-4 12 0M18 30q4-6 10-6', 3),
  anchoring:
    k(circle(50, 18, 7), 4.4) + k('M50 25V84', 5) + k('M36 34H64', 5) + k('M22 62Q24 84 50 84Q76 84 78 62', 5) +
    f('M14 64L24 56L28 68Z') + f('M86 64L76 56L72 68Z'),
  'loss-aversion':
    k('M12 46L88 76', 4.4) + pk('M50 62L40 82H60Z') + k('M8 88H92', 3) +
    pk(circle(26, 39, 12)) + k('M26 33v12M20 39h12', 3.2) +
    f(circle(76, 63, 8.5)) + k('M72 63h8', 3) ,
  'sunk-cost':
    f(oval(50, 80, 32, 9)) +
    g('rotate(-20 36 26)', pk(oval(36, 26, 10, 7))) + g('rotate(16 62 42)', pk(oval(62, 42, 10, 7))) + g('rotate(-8 46 60)', pk(oval(46, 60, 10, 6))) +
    k('M22 12l-2-6M52 22l2-6M76 32l4-4', 2.6),
  endowment:
    k('M64 42Q80 42 80 55Q80 68 64 68') + pk('M26 34H66V72Q66 82 56 82H36Q26 82 26 72Z') +
    k('M38 26q-5-6 0-12q5-6 0-12M54 26q-5-6 0-12q5-6 0-12', 2.8) + f(heart(46, 58, 8)),
  'status-quo':
    pk('M26 50V30Q26 16 40 16H60Q74 16 74 30V50Z') + pk(rect(22, 54, 56, 16, 4)) +
    pk(rect(12, 42, 15, 32, 7)) + pk(rect(73, 42, 15, 32, 7)) + k('M24 76V86M76 76V86') + k('M40 30q10 6 20 0', 2.6),
  framing:
    pk(rect(14, 14, 72, 72, 2)) + k(rect(24, 24, 52, 52), 2.6) +
    k('M14 14L24 24M86 14L76 24M14 86L24 76M86 86L76 76', 2.4) +
    f('M40.9 50H59.1L56.2 68H43.8Z') + k('M38 34L43.5 70H56.5L62 34', 3),
  present:
    pk(oval(50, 76, 34, 8)) + pk('M36 50Q36 44 50 44Q64 44 64 50V64Q64 70 50 70Q36 70 36 64Z') + k(oval(50, 50, 14, 4.5), 2.6) +
    pk(circle(78, 24, 12)) + k('M78 17V24L83 28', 3),
  planning:
    pk(rect(14, 22, 72, 64, 6)) + f('M20 22H80Q86 22 86 28V36H14V28Q14 22 20 22Z') + k('M32 14V28M68 14V28', 4) +
    k('M24 46l7 7m0-7l-7 7M42 46l7 7m0-7l-7 7M60 46l7 7m0-7l-7 7M24 64l7 7m0-7l-7 7', 2.8) + k(circle(46, 67, 7), 3) +
    k('M56 67Q70 66 82 74', 2.8) + k('M76 76l7-1l-3-6', 2.8),
  optimism:
    k('M50 14v12M24 24l8 8M76 24l-8 8M12 48h12M88 48h-12', 3.4) + pk('M26 70A24 24 0 0 1 74 70Z') + k('M6 70H94') +
    k('M18 80h20M50 80h30M30 90h40', 3),
  projection:
    pk(rect(8, 54, 32, 22, 3)) + pk(circle(16, 44, 8)) + pk(circle(33, 44, 8)) + f(rect(40, 60, 6, 10)) +
    p('M46 62L94 30V96L46 68Z') + f(heart(76, 62, 9)),
  'naive-realism':
    p(rect(26, 38, 38, 38)) + k(rect(26, 38, 38, 38)) + k(rect(40, 24, 38, 38)) + k('M26 38L40 24M64 38L78 24M26 76L40 62M64 76L78 62'),
};

/* ---------- laws of power ---------- */

export const LAW_MARKS: Record<string, string> = {
  outshine:
    k('M50 6v8M22 18l6 6M78 18l-6 6M8 44h8M92 44h-8', 3.4) + pk(circle(50, 48, 22)) + crown(50, 86, 48),
  'friends-enemies':
    hand(12, 70, 70, 1.05) + hand(88, 30, -110, 1.05, true) +
    pk(circle(36, 48, 10)) + p(circle(36, 48, 3.6)) + pk('M45 46H72V52H68V58H63V52H45Z'),
  conceal:
    k('M80 58L90 94', 4) +
    pk('M10 38Q30 28 50 40Q70 28 90 38Q90 64 68 64Q56 64 50 54Q44 64 32 64Q10 64 10 38Z') +
    f(oval(32, 47, 8, 5)) + f(oval(68, 47, 8, 5)),
  'say-less':
    pk(bubble(12, 20, 76, 50)) + k('M26 45H70', 3) + k('M30 39v12M36 39v12M42 39v12M48 39v12M54 39v12M60 39v12', 2.4) + f(rect(68, 40, 9, 12, 2)),
  reputation:
    pk('M50 10L82 22Q82 64 50 90Q18 64 18 22Z') + k('M50 20L72 29Q72 60 50 80Q28 60 28 29Z', 2.4) + f(star(50, 47, 13, 5.6, 5)),
  attention:
    pk(rect(10, 42, 12, 18, 2)) + pk('M22 40L56 22V80L22 62Z') + k('M30 64L34 80', 4) +
    k('M64 38Q70 51 64 64M72 30Q82 51 72 72M80 22Q94 51 80 80', 3.4),
  credit:
    pk('M34 8H46L58 40H46Z') + pk('M66 8H54L42 40H54Z') + pk(circle(50, 58, 20)) + k(circle(50, 58, 14), 2.4) + f(star(50, 58, 9, 3.8, 5)),
  'come-to-you':
    k('M62 0V40', 2.2) + k('M62 40V60Q62 72 51 72Q42 72 42 64', 3.4) + f('M42 64L38 56L46 59Z') +
    k('M58 46q6 4 0 8q-6 4 0 8', 4) +
    pk('M12 76L2 67V85Z') + pk('M10 76Q24 62 40 74Q24 88 10 76Z') + f(circle(32, 73, 2)) +
    k(circle(44, 64, 2.2), 2) + k(circle(40, 56, 1.6), 1.8),
  actions:
    pk(bubble(8, 8, 34, 22)) + k('M14 10L40 34', 3) +
    g('rotate(-35 62 62)', pk(rect(58, 46, 8, 46, 3)), pk(rect(42, 34, 40, 16, 3)), k('M50 34V50', 2.4)) +
    k('M86 62l8 4M80 76l8 6', 3),
  infection:
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = (i * 45 * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      return k(`M${n(50 + 22 * c)} ${n(50 + 22 * s)}L${n(50 + 32 * c)} ${n(50 + 32 * s)}`) + f(circle(50 + 34 * c, 50 + 34 * s, 4));
    }).join('') +
    pk(circle(50, 50, 22)) + f(circle(43, 44, 4)) + f(circle(57, 56, 5)) + f(circle(56, 41, 2.6)) + f(circle(42, 58, 2.6)),
  dependent:
    k('M30 40L36 60M70 40L64 60M50 24V44', 1.8) + k('M28 18H72', 5) + k('M50 8V28', 5) + k('M28 18L30 40M72 18L70 40', 1.8) +
    pk(circle(50, 52, 9)) + pk('M40 64H60L64 92H36Z') + k('M40 66L34 60M60 66L66 60', 3),
  'selective-honesty':
    pk(rect(22, 46, 56, 40)) + f(rect(46, 46, 8, 40)) +
    g('rotate(-10 50 40)', pk(rect(16, 32, 64, 12, 2)), f(rect(44, 32, 8, 12))) +
    f('M22 45L78 44V48L22 49Z') +
    k('M44 30Q30 12 26 22Q24 30 44 30M52 28Q60 10 70 16Q76 24 52 28', 3.2),
  'self-interest':
    k('M2 12L66 34', 4) + k('M65 34V46', 2) +
    pk('M54 46Q65 40 76 46L65 94Z') + k('M58 58l6 2M61 70l5 1M62 80l3 1', 2.4) + k('M65 44V34M65 42L57 32M65 42L73 32', 3),
  spy:
    pk(rect(26, 10, 48, 80, 22)) + f('M44 46L38 76H62L56 46Z') + f(circle(50, 42, 13)) +
    p('M40 42Q50 33 60 42Q50 51 40 42Z') + f(circle(50, 42, 3.4)),
  crush:
    k('M4 88H96', 3) +
    g('translate(14 70) rotate(84)', pk(rect(-18, -8, 36, 8, 2)), pk('M-12 -8Q-14 -30 -7 -44H7Q14 -30 12 -8Z'), pk(rect(-12, -51, 24, 7, 2)), pk('M-9 -51Q-12 -63 0 -65Q12 -63 9 -51Z'), k('M0 -65V-77M-6 -71H6', 3.4)) +
    k('M28 40l-4-8M40 36V26M52 40l4-8', 2.8),
  absence:
    p('M42 0H58L86 90H14Z') + k(oval(50, 90, 36, 4), 2.4) +
    k('M36 20V82M36 54H66M38 60V82M64 60V82', 4) + pk(rect(34, 52, 34, 7, 2)),
  unpredictable:
    g('rotate(-30 26 58)', pk(rect(22, 42, 48, 14, 2))) +
    k('M50 60L40 54L60 47L40 40L60 33L50 28', 3) + pk(circle(50, 20, 11)) + f(circle(46, 19, 1.8)) + f(circle(54, 19, 1.8)) + k('M45 24q5 4 10 0', 2.4) +
    pk(rect(24, 60, 52, 30, 2)) + f(star(50, 75, 8, 3.5, 5)),
  fortress:
    pk('M28 90V34H32V24H42V34H46V24H54V34H58V24H68V34H72V90Z') + f('M42 90V74Q42 66 50 66Q58 66 58 74V90Z') + f(rect(46, 44, 8, 10, 4)) +
    k('M64 34L58 46L66 54L60 64', 2.6) + k('M8 90H92', 3),
  'wrong-person':
    k('M86 96L70 66', 4) +
    pk('M30 80Q22 62 30 48Q34 26 50 22Q66 26 70 48Q78 62 70 80Z') + k('M28 52Q50 60 72 52M26 66Q50 74 74 66M36 36Q50 42 64 36', 2.6) + f(oval(50, 76, 6, 4)) +
    f(oval(16, 30, 4, 3)) + pk(oval(14, 25, 3.4, 2.4), 1.8) + f(oval(84, 22, 4, 3)) + pk(oval(82, 17, 3.4, 2.4), 1.8),
  commit:
    k('M36 48V30Q36 14 52 14Q68 14 68 30V36', 6) + pk(rect(28, 48, 44, 38, 6)) + f(circle(50, 62, 5)) + f('M48 64H52L54 74H46Z'),
  sucker:
    pk(circle(50, 60, 26)) + f(circle(40, 56, 3.4)) + k('M55 56q5-4 10 0', 3) + k('M38 70Q50 80 62 70', 3) +
    g('rotate(12 50 34)', pk('M34 38L50 2L66 38Z'), k('M40 26H60M44 16H56', 2.6)),
  surrender:
    k('M28 94V12', 4.4) + pk('M28 14Q42 6 56 14Q70 22 86 14V44Q70 52 56 44Q42 36 28 44Z') + k('M10 94H50', 3),
  concentrate:
    pk(circle(42, 58, 30)) + k(circle(42, 58, 19), 3.2) + f(circle(42, 58, 9)) +
    k('M42 58L84 16', 3.6) + pk('M78 14L90 2L92 14L84 16Z', 2.4) + pk('M86 22L98 10L86 8L84 16Z', 2.4),
  courtier:
    hand(50, 100, 0, 1.1) + k('M14 64H86', 4.4) + pk('M22 64Q22 30 50 30Q78 30 78 64Z') + pk(circle(50, 26, 4.4)) + k('M32 52Q32 40 42 36', 2.6),
  recreate:
    pk('M50 48Q36 10 18 16Q4 26 20 42Q30 52 50 50Z') + pk('M50 48Q64 10 82 16Q96 26 80 42Q70 52 50 50Z') +
    pk('M50 52Q26 52 24 70Q26 84 38 78Q48 70 50 54Z') + pk('M50 52Q74 52 76 70Q74 84 62 78Q52 70 50 54Z') +
    f(oval(50, 52, 3.6, 18)) + k('M48 36Q44 22 38 18M52 36Q56 22 62 18', 2.4) + f(circle(24, 28, 3.6)) + f(circle(76, 28, 3.6)),
  'clean-hands':
    g('rotate(-10 50 70)', pk(rect(26, 58, 48, 24, 10)), k('M36 66h22', 2.6)) +
    pk(circle(36, 40, 9)) + pk(circle(58, 30, 6.5)) + pk(circle(72, 48, 10.5)) + pk(circle(52, 48, 4.4), 2.6) + pk(circle(80, 22, 4), 2.6) +
    k('M68 44q2-4 6-4', 2.4),
  cult:
    Array.from({ length: 9 }, (_, i) => {
      const a = ((200 + i * 17.5) * Math.PI) / 180;
      return person(50 + 38 * Math.cos(a), 92 + 38 * Math.sin(a) * 0.55 + 6, 4.4);
    }).join('').replace(/^/, '') +
    k('M50 6v6M30 14l4 5M70 14l-4 5', 3) + pk('M50 18Q62 32 50 42Q38 32 50 18Z') + pk(rect(42, 44, 16, 32, 2)),
  boldness:
    g('rotate(36 50 50)',
      pk('M42 62Q50 96 58 62Z'), f('M46 62Q50 80 54 62Z'),
      pk('M38 44L26 64L38 60Z'), pk('M62 44L74 64L62 60Z'),
      pk('M50 6Q68 22 64 62H36Q32 22 50 6Z'), pk(circle(50, 32, 6.5), 3), k('M38 52H62', 2.6)) +
    k('M10 66l-6 4M14 78l-8 8M26 86l-4 8', 3),
  'plan-end':
    pk(rect(12, 12, 76, 76, 6)) + k('M28 12V60M44 28V88M60 12V44H74M60 60V74H88M12 76H28M74 28H88', 3) +
    k('M20 20V68H36V20H52V52H68V82', 2) .replace('stroke-width="2"', 'stroke-width="2" stroke-dasharray="0.5 5"') +
    k('M68 82V64', 2.6) + f('M68 64L80 67L68 71Z'),
  effortless:
    k('M4 78q8-5 16 0t16 0t16 0t16 0t16 0t16 0', 3) + k('M40 84l4 6l4-6M58 84l4 6l4-6', 2.2) +
    pk('M20 60Q40 56 54 64Q64 68 78 56Q82 72 66 78H36Q22 76 20 60Z') +
    k('M62 66Q48 50 56 38Q64 26 58 18Q52 12 46 20', 10) + k('M62 66Q48 50 56 38Q64 26 58 18Q52 12 46 20', 3.4).replace(INK, PAPER) +
    f('M47 18L36 22L46 25Z') + f(circle(52, 19, 1.4)),
  options:
    g('rotate(-22 50 88)', pk(rect(34, 30, 32, 46, 4))) + g('rotate(22 50 88)', pk(rect(34, 30, 32, 46, 4))) +
    pk(rect(34, 26, 32, 46, 4)) + f(heart(50, 48, 8)) + k('M40 34v4M60 64v4', 2.6),
  fantasies:
    pk(cloud(54, 40, 11)) + pk(circle(26, 72, 5), 2.8) + pk(circle(16, 84, 3), 2.4) +
    f('M38 50V36H42V32H46V36H50V28H54V24H58V28H62V36H66V32H70V50Z') + p(rect(52, 42, 4, 8, 2)),
  thumbscrew:
    pk(heart(48, 50, 30)) + f(circle(48, 42, 6)) + f('M45 44H51L54 62H42Z') +
    k('M76 82L94 64', 3.4) + k(circle(72, 86, 5), 3) + k('M86 72l4 4M90 68l4 4', 2.6),
  royal:
    pk('M14 76V30L32 50L50 18L68 50L86 30V76Z') + f(rect(14, 64, 72, 12)) +
    f(circle(14, 26, 4)) + f(circle(50, 14, 4)) + f(circle(86, 26, 4)) + p(circle(50, 70, 3.2)) + p(circle(32, 70, 2.4)) + p(circle(68, 70, 2.4)),
  timing:
    pk('M32 16Q32 42 47 50Q32 58 32 84H68Q68 58 53 50Q68 42 68 16Z') +
    f('M37 30H63Q61 42 50 47Q39 42 37 30Z') + f('M38 84Q50 66 62 84Z') + k('M50 48V74', 1.6) + k('M24 14H76M24 86H76', 5),
  disdain:
    k('M52 4V18', 3) + pk('M52 18Q66 8 78 16Q70 28 52 18Z', 2.8) +
    [[44, 26], [58, 28], [37, 39], [51, 40], [65, 40], [44, 53], [58, 53], [51, 66]].map(([x, y]) => pk(circle(x, y, 7.6), 3)).join('') +
    k('M14 90Q22 76 34 84', 3) + k('M88 82l-8-6M90 70l-8-2', 2.6),
  spectacle:
    k('M70 96L60 64', 2.4).replace('stroke-width="2.4"', 'stroke-width="2.4" stroke-dasharray="1 5"') +
    Array.from({ length: 10 }, (_, i) => {
      const a = (i * 36 * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      return k(`M${n(34 + 9 * c)} ${n(34 + 9 * s)}L${n(34 + 22 * c)} ${n(34 + 22 * s)}`, 3) + f(circle(34 + 26 * c, 34 + 26 * s, 1.8));
    }).join('') +
    pk(star(66, 56, 18, 8, 8)) + glint(84, 20, 5) + glint(18, 76, 4),
  behave:
    [14, 32, 50, 68, 86].map((x) => (x === 50 ? person(x, 82, 9, true) : person(x, 82, 9))).join('') +
    pk(cloud(54, 32, 6), 2.8) + pk(circle(48, 50, 2.4), 2.2) + f(star(52, 30, 7, 3, 5)),
  stir:
    k('M50 50' + Array.from({ length: 40 }, (_, i) => {
      const t = (i + 1) * 0.42, r = 2 + t * 3.1;
      return `L${n(50 + r * Math.cos(t))} ${n(50 + r * Math.sin(t) * 0.8)}`;
    }).join(''), 3.2) +
    g('translate(76 20) rotate(30)', pk('M-10 0Q0-8 10 0Q0 8-10 0Z', 2.6), pk('M-10 0L-16-5V5Z', 2.6)) +
    g('translate(22 82) rotate(200)', pk('M-8 0Q0-6 8 0Q0 6-8 0Z', 2.6), pk('M-8 0L-13-4V4Z', 2.6)),
  'free-lunch':
    pk(rect(8, 64, 84, 14, 3)) + k('M18 64V30H34V64', 3.4) + k(circle(26, 62, 4.4), 2.6) + k('M40 64V58H54', 2.6) +
    pk('M58 64H88V40Z') + f(circle(78, 58, 2.6)) + f(circle(70, 60, 1.8)) + f(circle(84, 50, 1.8)) + k('M12 86H88', 2.4),
  shoes:
    pk('M24 14H50V56Q74 58 84 68V82H24Z') + k('M24 74H84M30 14V6H44V14', 3) + k('M40 30h10M40 40h10', 2.6) +
    f(oval(10, 90, 3, 5)) + f(oval(18, 82, 3, 5)) + f(oval(10, 72, 2.6, 4.4)),
  shepherd:
    k('M24 94V32Q24 14 38 14Q52 14 52 28', 4.6) + sheep(64, 46, 1.1) + sheep(78, 76, 1) + sheep(42, 80, 0.95) +
    k('M88 40h8M90 48h6M94 66h4', 2.6),
  hearts:
    pk(heart(50, 38, 22)) + k('M34 26q4-6 10-4', 2.6) + hand(50, 106, 0, 1.25),
  mirror:
    g('rotate(28 50 50)', pk(rect(45, 56, 10, 36, 4)), pk(oval(50, 36, 22, 26)), k(oval(50, 36, 15, 19), 2.4), k('M42 30L50 22M42 40L56 26', 2.6)),
  change:
    p('M14 86V70H32V56H50V42H68V28H86V86Z') + k('M10 86H90') + k('M14 86V70H32V56H50V42H68V28H86V86', 3.4) +
    k('M18 58Q30 44 40 42Q52 28 62 24', 2.6) + k('M56 20l7 3l-3 7', 2.6),
  perfect:
    pk('M30 24H70L88 44L50 86L12 44Z') + k('M12 44H88M30 24L40 44L50 24L60 44L70 24M40 44L50 86L60 44', 2.6) + k('M66 52L61 58L67 62L63 68', 2.6) +
    glint(22, 14, 5),
  stop:
    p(poly(...Array.from({ length: 8 }, (_, i) => {
      const a = ((22.5 + i * 45) * Math.PI) / 180;
      return [50 + 40 * Math.cos(a), 46 + 40 * Math.sin(a)];
    }).flat())) +
    hand(48, 104, 0, 1.85),
  formless:
    pk('M50 10Q74 42 74 58Q74 82 50 82Q26 82 26 58Q26 42 50 10Z') + k('M36 60Q36 70 44 72', 2.6) +
    k('M6 92q8-5 16 0t16 0t16 0t16 0t16 0t16 0', 3),
};

/* ---------- principles ---------- */

/** A dashed or dotted ink line. */
const dashed = (line: string, a = '1 5') => line.replace('stroke-width', `stroke-dasharray="${a}" stroke-width`);

/** A daisy: six paper petals round an ink heart. */
const flower = (cx: number, cy: number, r: number) =>
  [0, 60, 120, 180, 240, 300].map((a) => g(`rotate(${a} ${cx} ${cy})`, pk(oval(cx, cy - r * 0.62, r * 0.36, r * 0.5), 2.4))).join('') + f(circle(cx, cy, r * 0.34));

/** A light bulb, the top of its glass at (x, y). */
const bulb = (x: number, y: number, s = 1) =>
  g(`translate(${x} ${y}) scale(${s})`,
    pk('M0 0Q16 0 16 16Q16 24 8 30V36H-8V30Q-16 24-16 16Q-16 0 0 0Z', W / s),
    k('M-5 29L-3 20L0 26L3 20L5 29', 2.2 / s),
    k('M-6 41H6M-4 46H4', 3 / s));

/** A little sailing boat, its mast at x. */
const boat = (x: number, y: number, s = 1) =>
  g(`translate(${x} ${y}) scale(${s})`, f('M0-12V8H-11Z'), f('M2-7V8H10Z'), f('M-13 11H13L9 16H-9Z'));

/** A falling drop, s wide-ish, round at the bottom. */
const drop = (x: number, y: number, s: number) => `M${x} ${n(y - 2 * s)}L${n(x + s)} ${y}A${s} ${s} 0 0 1 ${n(x - s)} ${y}Z`;

export const PRINCIPLE_MARKS: Record<string, string> = {
  'no-criticism':
    pk(bubble(12, 12, 64, 46)) + f('M48 18L34 38H44L38 54L56 30H46L52 18Z') + pk('M12 80L80 12L90 22L22 90Z'),
  appreciation:
    k('M32 32L44 64M66 28L56 64M50 46V64', 3) + flower(32, 32, 12) + flower(66, 28, 12) + flower(50, 46, 11) +
    pk('M28 58L50 94L72 58Z') + k('M38 72Q50 78 62 72', 2.6),
  'eager-want':
    pk('M24 66V40A26 26 0 0 1 76 40V66H60V40A10 10 0 0 0 40 40V66Z') + f(rect(24, 56, 16, 10)) + f(rect(60, 56, 16, 10)) +
    k('M32 71v5M68 71v5M50 70v8', 2.6) + k('M14 74q-4 8 0 16M86 74q4 8 0 16', 2.6) + f(heart(32, 86, 6)) + f(star(68, 86, 7, 3, 5)),
  interested:
    k('M58 58L86 86', 8) + pk(circle(42, 42, 26)) + person(42, 52, 9) + glint(80, 18, 5) + glint(88, 36, 3),
  smile:
    pk(circle(50, 52, 32)) + k('M33 44q5-7 10 0M57 44q5-7 10 0', 3.4) + f('M30 58Q50 86 70 58Z') +
    glint(14, 16, 6) + glint(88, 18, 4),
  name:
    pk(rect(8, 40, 64, 44, 6)) + f('M14 40H66Q72 40 72 46V54H8V46Q8 40 14 40Z') + k('M18 47H40', 2.4).replace(INK, PAPER) +
    k('M18 72q3-9 6 0t6 0t6 0t6 0t6 0t6 0', 3) +
    f(oval(68, 30, 5, 3.8)) + f(oval(86, 24, 5, 3.8)) + k('M72.6 30V10L90.6 4V24', 3) + k('M72.6 12L90.6 6', 5),
  listen:
    k('M30 40Q37 52 30 64', 3.4) + k('M18 32Q29 52 18 72', 3.4) +
    pk('M42 36Q42 14 62 14Q82 14 82 36Q82 50 72 58Q66 63 66 72Q66 88 52 88Q42 88 40 80Q48 82 52 76Q56 68 56 62Q56 54 48 50Q42 46 42 36Z') +
    k('M52 36Q52 26 62 26Q72 26 72 36Q72 44 64 48', 3),
  'their-interests':
    pk(bubble(8, 8, 48, 36)) + boat(32, 25, 0.9) + person(18, 90, 9, true) +
    pk(cloud(72, 42, 6.5)) + boat(72, 39, 0.5) + pk(circle(70, 56, 3), 2.4) + pk(circle(74, 63, 2.2), 2) + person(76, 88, 11),
  'feel-important':
    k('M8 92H92', 3) + pk(rect(28, 62, 44, 30, 2)) + f(star(50, 77, 8, 3.4, 5)) + person(50, 50, 11, true) +
    glint(20, 30, 6) + glint(80, 24, 5) + glint(84, 50, 3.5) + k('M24 12l4 6M70 8l-3 6M12 50l6-2', 2.6),
  'avoid-argument':
    pk(fluff(42, 48, 26, 19, 12)) + f(star(32, 48, 8, 3.4, 5)) + k('M46 38L56 44L48 50L58 56', 3) +
    dashed(k('M12 88Q86 98 86 52Q86 18 58 12', 3)) + f('M50 12L60 5V19Z'),
  'never-wrong':
    pk(bubble(10, 8, 62, 46)) + k('M30 18L52 40M52 18L30 40', 6) + hand(72, 96, -12, 0.95),
  'admit-wrong':
    hand(40, 100, -6, 1.05) + k('M14 58v12M6 66v12', 3) + pk(bubble(52, 8, 40, 28)) + k('M64 14L80 30M80 14L64 30', 4),
  friendly:
    dashed(k('M14 24Q28 8 44 18Q58 28 70 22', 2.4)) +
    pk('M22 44Q16 90 50 90Q84 90 78 44Z') + pk(rect(18, 36, 64, 10, 4)) +
    f('M22.5 46H77.5V52Q74 56 70 52Q67 49 66 56Q65 64 60 63Q56 62 56 54Q54 50 48 54Q45 57 44 64Q43 70 39 69Q35 67 36 58Q36 52 30 53Q25 55 23 50Z') +
    f(heart(50, 76, 7)) +
    pk(oval(76, 12, 5, 3.5), 2.4) + pk(oval(86, 14, 5, 3.5), 2.4) + f(oval(82, 22, 7, 5)) + k('M80 18V26M85 18V26', 1.8).replace(INK, PAPER),
  'yes-yes':
    pk(circle(16, 70, 10)) + k('M11 70l4 4l7-8', 3) + pk(circle(40, 60, 14)) + k('M33 60l5 5l9-11', 3.6) +
    pk(circle(72, 44, 22)) + k('M61 44l8 8l14-17', 5),
  'let-them-talk':
    pk(bubble(26, 8, 66, 42)) + k('M36 20H82M36 29H82M36 38H66', 3) + person(30, 86, 11, true) + person(78, 90, 8),
  'their-idea':
    k('M50 2V8M30 10l5 5M70 10l-5 5M24 30h6M76 30h-6', 3) + bulb(50, 14, 0.9) +
    dashed(k('M4 92Q8 40 30 32', 2.4)) + person(50, 90, 14, true),
  'their-view':
    pk(circle(50, 50, 22)) + k(circle(50, 56, 7), 4.4) + k('M43 55Q42 40 56 38', 4.4) +
    person(50, 90, 8) + g('rotate(180 50 50)', person(50, 90, 8, true)),
  sympathy:
    k('M8 8l-3 8M22 4l-3 8M78 4l-3 8M92 10l-3 8', 2.6) + k('M50 18V10', 3.4) + k('M50 50V78Q50 84 56 84', 3.4) +
    pk('M12 50Q12 18 50 18Q88 18 88 50Q82 44 75.3 50Q69 44 62.7 50Q56 44 50 50Q44 44 37.3 50Q31 44 24.7 50Q18 44 12 50Z') +
    k('M50 18Q40 30 37.3 50M50 18Q60 30 62.7 50', 2.4) + person(31, 90, 8) + person(70, 90, 8, true),
  'nobler-motives':
    pk('M38 46Q20 30 6 34Q14 40 12 44Q22 46 22 50Q30 52 30 56Q36 56 40 54Z') +
    pk('M62 46Q80 30 94 34Q86 40 88 44Q78 46 78 50Q70 52 70 56Q64 56 60 54Z') +
    k('M16 40Q26 42 34 46M88 40Q74 42 66 46', 2.2) + pk(heart(50, 52, 16)) + glint(50, 16, 7) + glint(24, 72, 4) + glint(78, 76, 3.5),
  dramatize:
    pk('M-4 10H30Q22 50 36 96H-4Z') + pk('M104 10H70Q78 50 64 96H104Z') +
    k('M10 16Q8 56 16 96M20 16Q16 56 26 96M90 16Q92 56 84 96M80 16Q84 56 74 96', 2.4) +
    f('M0 0H100V12Q92 20 84 12Q76 20 68 12Q60 20 52 12Q44 20 36 12Q28 20 20 12Q12 20 4 12H0Z') +
    k('M0 92H100', 3) + pk(star(50, 58, 22, 9, 5)) + glint(50, 28, 4),
  challenge:
    k('M8 92H92', 3) + k('M22 92V18M78 92V18', 4) + k('M15 92h14M71 92h14', 4) +
    pk(rect(14, 22, 72, 7, 3.5)) + f(rect(30, 22, 8, 7)) + f(rect(46, 22, 8, 7)) + f(rect(62, 22, 8, 7)) +
    k('M50 84V48', 4.4) + f('M39 52L50 36L61 52Z'),
  'begin-praise':
    pk('M40 54L28 90L38 86L44 94L50 60Z') + pk('M60 54L72 90L62 86L56 94L50 60Z') +
    pk(star(50, 38, 28, 22, 16)) + pk(circle(50, 38, 15)) + k('M45 33L51 28V48', 4),
  indirect:
    k('M6 12H94', 5) + dashed(k('M16 84L50 18L84 80', 3)) + f(circle(16, 84, 7)) +
    pk(circle(84, 80, 10)) + k('M80 76l8 8m0-8l-8 8', 2.6) + k('M42 22l-5 3M58 22l5 3', 2.4),
  'own-mistakes':
    g('translate(86 14) rotate(135)',
      pk('M0 0L13-5.5H68V5.5H13Z'), f('M0 0L5-2.1V2.1Z'), k('M60-5.5V5.5', 2.6), pk(rect(68, -5.5, 13, 11, 3))) +
    k('M8 74L24 90', 3.6) + dashed(k('M24 74L8 90', 3.6), '2 6') +
    f(circle(32, 82, 1.6)) + f(circle(38, 78, 1.3)) + f(circle(35, 89, 1.5)),
  'ask-not-order':
    pk(bubble(30, 8, 62, 50)) + ask(61, 32, 13, 4.4) +
    pk(circle(20, 76, 13)) + k('M20 68V77', 4) + f(circle(20, 83, 2.2)) + k('M10 86L30 66', 3),
  'save-face':
    k('M2 94q8-5 16 0t16 0t16 0t16 0t16 0t16 0', 3) +
    k(circle(50, 50, 28), 20) + k(circle(50, 50, 28), 13).replace(INK, PAPER) +
    [45, 135, 225, 315].map((a) => {
      const r = 28, a1 = ((a - 14) * Math.PI) / 180, a2 = ((a + 14) * Math.PI) / 180;
      return k(`M${n(50 + r * Math.cos(a1))} ${n(50 + r * Math.sin(a1))}A${r} ${r} 0 0 1 ${n(50 + r * Math.cos(a2))} ${n(50 + r * Math.sin(a2))}`, 13).replace('round', 'butt');
    }).join('') +
    pk(circle(50, 50, 13)) + f(circle(45, 47, 1.8)) + f(circle(55, 47, 1.8)) + k('M44 54q6 5 12 0', 2.4),
  'every-improvement':
    g('rotate(18 30 36)', k('M18 28Q28 12 38 28', 3.4), k('M42 34L66 24', 5), pk(rect(12, 28, 32, 24, 4)), pk(circle(66, 24, 4), 2.6)) +
    f(drop(72, 46, 2.2)) + f(drop(78, 54, 2.2)) + f(drop(70, 60, 2.2)) +
    k('M58 92H94', 3) + k('M76 92V70', 3.4) + pk('M76 80Q63 78 62 68Q75 67 76 80Z', 2.6) + pk('M76 74Q88 70 90 60Q77 59 76 74Z', 2.6) +
    glint(92, 46, 4.5),
  'fine-reputation':
    person(60, 76, 22) + crown(60, 38, 26) + person(28, 88, 10, true) + glint(20, 30, 5) + glint(90, 12, 4),
  encourage:
    g('rotate(-30 50 50)', pk(rect(12, 38, 76, 24, 12)), pk(rect(38, 38, 24, 24, 2)),
      [44, 50, 56].map((x) => [44, 50, 56].map((y) => f(circle(x, y, 1.5))).join('')).join('')) +
    glint(18, 22, 6) + glint(82, 78, 4.5),
  'happy-to-do':
    k('M42 54L28 22M58 54L72 22', 4.4) + pk(rect(18, 4, 64, 20, 4)) + k('M40 14l6 5l12-10', 3.6) +
    pk('M38 94L42 54Q50 48 58 54L62 94Z') + pk(circle(50, 37, 9)) + f(circle(46.5, 35.5, 1.4)) + f(circle(53.5, 35.5, 1.4)) + k('M46 40q4 3 8 0', 2) +
    k('M14 44l8 4M10 58h9M86 44l-8 4M90 58h-9', 3),
};

/* ---------- spots: marks for screens outside Learn, keyed spot:<name> ---------- */

/** A thin line in paper, for grooves and glints drawn over ink. */
const pl = (d: string, w = 1.6) => `<path d="${d}" fill="none" stroke="${PAPER}" stroke-width="${w}" stroke-linecap="round"/>`;

export const SPOT_MARKS: Record<string, string> = {
  // a record sliding out of its sleeve
  'spot:records':
    f(circle(64, 50, 25)) +
    pl('M70.5 30.5A20 20 0 0 1 83.5 46') + pl('M74 61.5A14 14 0 0 1 66.5 63.8') + pl('M80.8 58A19 19 0 0 1 76.5 64', 1.2) +
    pk(circle(64, 50, 7.5), 2.6) + f(circle(64, 50, 1.6)) +
    pk(rect(14, 29, 43, 43, 2)) +
    f('M22 60A13.5 13.5 0 0 1 49 60Z') + k('M22 66h27', 2.8) + glint(42, 39, 4.5),
  // books standing on a shelf, the last one leaning on its neighbour
  'spot:shelf':
    pk(rect(20, 34, 13, 42, 1.5)) + k('M23 41h7M23 69h7', 2.6) +
    f(rect(33, 26, 15, 50, 1.5)) + pl('M36 33h9M36 68h9', 2.4) +
    pk(rect(48, 40, 11, 36, 1.5)) + k('M51.5 50v16', 2.6) +
    g('rotate(-20 72 76)', pk(rect(72, 32, 12, 44, 1.5)), k('M75 39h6M75 69h6', 2.6)) +
    k('M12 77H88', 4.4) + glint(84, 22, 4),
};
