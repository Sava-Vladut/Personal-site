// Exercise silhouettes: instead of photos, every exercise is drawn as a figure in the pose of its kind of move (a push-up,
// a squat, a row…), holding what it's done with. About twenty poses cover the database; which one an exercise gets comes
// from its name, then its category, then the muscle it mainly works, so your own exercises get one too. The drawing is
// plain shapes on a 64 × 64 grid (components/workout/Figure.tsx turns them into SVG), the figure facing right.
import type { Equip, Snap } from './fitness';

type P = readonly [number, number];
type Limb = readonly [P, P]; // elbow and hand, or knee and foot

/** What's around the figure: the floor, a bench, a bar to hang from… */
type Scene = 'floor' | 'bench' | 'bar' | 'step' | 'seat' | 'dip' | 'bike' | 'roller' | 'box';

interface Pose {
  front?: boolean;   // seen from the front, so both sides are drawn alike (and a barbell lies across)
  h: P; s: P; p: P;  // head, shoulders, hips
  a: Limb; A: Limb;  // the far arm and the near one
  l: Limb; L: Limb;  // the far leg and the near one
  hold?: boolean;    // the hands hold the weight
  bar?: { at: P; a: Limb; A: Limb }; // a barbell rests on the shoulders instead, the arms holding it there
  cable?: P;         // where a cable runs from the near hand
  scene?: Scene[];
}

const FLOOR = 58;

export const POSES = {
  stand: {
    front: true,
    h: [32, 11], s: [32, 19], p: [32, 36],
    a: [[25, 27], [23, 37]], A: [[39, 27], [41, 37]],
    l: [[29, 47], [28, FLOOR]], L: [[35, 47], [36, FLOOR]], hold: true, scene: ['floor'],
  },
  walk: {
    h: [34, 11], s: [33, 19], p: [32, 36],
    a: [[29, 28], [25, 35]], A: [[37, 28], [40, 35]],
    l: [[29, 47], [23, FLOOR]], L: [[37, 47], [40, FLOOR]], hold: true, scene: ['floor'],
  },
  squat: {
    h: [40, 21], s: [35, 29], p: [27, 44],
    a: [[42, 31], [50, 31]], A: [[43, 32], [51, 32]],
    l: [[38, 46], [35, FLOOR]], L: [[40, 47], [38, FLOOR]], hold: true, scene: ['floor'],
    bar: { at: [30, 26], a: [[26, 33], [29, 27]], A: [[28, 34], [32, 27]] },
  },
  lunge: {
    h: [31, 18], s: [31, 26], p: [31, 43],
    a: [[29, 35], [29, 43]], A: [[33, 35], [33, 43]],
    l: [[25, 54], [15, 57]], L: [[42, 44], [43, FLOOR]], hold: true, scene: ['floor'],
    bar: { at: [31, 23], a: [[26, 30], [29, 24]], A: [[28, 31], [33, 24]] },
  },
  hinge: {
    h: [49, 22], s: [42, 26], p: [28, 35],
    a: [[42, 35], [42, 44]], A: [[44, 35], [44, 44]],
    l: [[31, 46], [29, FLOOR]], L: [[34, 46], [32, FLOOR]], hold: true, scene: ['floor'],
  },
  row: {
    h: [51, 29], s: [44, 32], p: [27, 37],
    a: [[36, 30], [38, 39]], A: [[38, 31], [40, 40]],
    l: [[32, 47], [29, FLOOR]], L: [[35, 47], [33, FLOOR]], hold: true, cable: [62, 40], scene: ['floor'],
  },
  pullup: {
    front: true,
    h: [32, 17], s: [32, 24], p: [32, 40],
    a: [[22, 18], [24, 7]], A: [[42, 18], [40, 7]],
    l: [[29, 50], [29, 60]], L: [[35, 50], [35, 60]], scene: ['bar'],
  },
  hang: {
    h: [36, 15], s: [32, 21], p: [31, 38],
    a: [[31, 14], [31, 7]], A: [[33, 14], [33, 7]],
    l: [[40, 30], [40, 41]], L: [[42, 31], [42, 42]], scene: ['bar'],
  },
  bench: {
    h: [49, 34], s: [41, 36], p: [24, 36],
    a: [[38, 28], [39, 20]], A: [[40, 28], [41, 20]],
    l: [[13, 44], [10, FLOOR]], L: [[15, 45], [13, FLOOR]], hold: true, scene: ['bench'],
  },
  press: {
    front: true,
    h: [32, 11], s: [32, 19], p: [32, 36],
    a: [[22, 17], [24, 6]], A: [[42, 17], [40, 6]],
    l: [[29, 47], [28, FLOOR]], L: [[35, 47], [36, FLOOR]], hold: true, scene: ['floor'],
  },
  overhead: {
    front: true,
    h: [32, 16], s: [32, 24], p: [32, 40],
    a: [[26, 15], [22, 6]], A: [[38, 15], [42, 6]],
    l: [[25, 49], [24, FLOOR]], L: [[39, 49], [40, FLOOR]], hold: true, scene: ['floor'],
  },
  raise: {
    front: true,
    h: [32, 11], s: [32, 19], p: [32, 36],
    a: [[23, 21], [14, 22]], A: [[41, 21], [50, 22]],
    l: [[29, 47], [28, FLOOR]], L: [[35, 47], [36, FLOOR]], hold: true, scene: ['floor'],
  },
  curl: {
    h: [32, 11], s: [32, 19], p: [32, 36],
    a: [[33, 29], [40, 24]], A: [[35, 29], [43, 24]],
    l: [[31, 47], [30, FLOOR]], L: [[33, 47], [34, FLOOR]], hold: true, scene: ['floor'],
  },
  triceps: {
    h: [36, 13], s: [32, 20], p: [32, 37],
    a: [[30, 8], [22, 12]], A: [[31, 7], [23, 12]],
    l: [[31, 48], [30, FLOOR]], L: [[33, 48], [34, FLOOR]], hold: true, scene: ['floor'],
  },
  pushdown: {
    h: [33, 11], s: [32, 19], p: [31, 36],
    a: [[31, 28], [37, 34]], A: [[33, 28], [39, 35]],
    l: [[30, 47], [29, FLOOR]], L: [[32, 47], [33, FLOOR]], hold: true, cable: [46, 2], scene: ['floor'],
  },
  pushup: {
    h: [52, 35], s: [45, 39], p: [28, 46],
    a: [[44, 48], [44, 57]], A: [[46, 48], [46, 57]],
    l: [[18, 51], [8, 55]], L: [[19, 50], [9, 54]], scene: ['floor'],
  },
  plank: {
    h: [52, 41], s: [45, 45], p: [28, 48],
    a: [[44, 56], [52, 57]], A: [[46, 56], [54, 57]],
    l: [[18, 51], [8, 55]], L: [[19, 50], [9, 54]], scene: ['floor'],
  },
  roller: {
    h: [52, 41], s: [45, 45], p: [29, 46],
    a: [[44, 56], [52, 57]], A: [[46, 56], [54, 57]],
    l: [[19, 48], [9, 50]], L: [[20, 47], [10, 49]], scene: ['floor', 'roller'],
  },
  dip: {
    h: [33, 12], s: [32, 20], p: [32, 37],
    a: [[25, 28], [31, 37]], A: [[27, 28], [33, 37]],
    l: [[31, 48], [24, 53]], L: [[33, 48], [26, 54]], scene: ['dip'],
  },
  situp: {
    h: [25, 34], s: [21, 41], p: [28, 55],
    a: [[28, 43], [35, 41]], A: [[29, 44], [36, 42]],
    l: [[37, 47], [45, 57]], L: [[38, 46], [46, FLOOR]], scene: ['floor'],
  },
  legs: {
    h: [53, 54], s: [46, 55], p: [29, 55],
    a: [[39, 57], [32, 57]], A: [[40, 57], [33, 57]],
    l: [[23, 46], [18, 36]], L: [[25, 45], [20, 35]], scene: ['floor'],
  },
  bridge: {
    h: [53, 53], s: [46, 55], p: [30, 44],
    a: [[39, 57], [32, 57]], A: [[40, 57], [33, 57]],
    l: [[19, 45], [16, 57]], L: [[21, 46], [18, FLOOR]], scene: ['floor'],
  },
  legcurl: {
    h: [52, 35], s: [44, 38], p: [28, 38],
    a: [[51, 42], [51, 46]], A: [[52, 42], [52, 46]],
    l: [[17, 38], [13, 28]], L: [[18, 39], [15, 29]], scene: ['bench'],
  },
  seated: {
    h: [27, 14], s: [27, 22], p: [26, 40],
    a: [[34, 27], [42, 25]], A: [[35, 28], [43, 26]],
    l: [[37, 41], [37, FLOOR]], L: [[38, 42], [39, FLOOR]], hold: true, scene: ['seat'],
  },
  legext: {
    h: [24, 15], s: [25, 23], p: [27, 40],
    a: [[25, 32], [31, 39]], A: [[26, 33], [32, 40]],
    l: [[38, 40], [48, 37]], L: [[39, 41], [50, 38]], scene: ['seat'],
  },
  calf: {
    h: [32, 7], s: [32, 15], p: [32, 32],
    a: [[30, 24], [30, 32]], A: [[34, 24], [34, 32]],
    l: [[31, 43], [31, 53]], L: [[33, 43], [34, 53]], hold: true, scene: ['step'],
    bar: { at: [28, 14], a: [[24, 21], [27, 15]], A: [[26, 22], [30, 15]] },
  },
  hip: {
    front: true,
    h: [30, 11], s: [30, 19], p: [30, 36],
    a: [[24, 27], [27, 35]], A: [[36, 27], [33, 35]],
    l: [[28, 47], [27, FLOOR]], L: [[40, 45], [48, 53]], scene: ['floor'],
  },
  run: {
    h: [37, 10], s: [35, 18], p: [31, 35],
    a: [[27, 25], [22, 31]], A: [[40, 25], [46, 20]],
    l: [[25, 44], [15, 44]], L: [[40, 42], [37, 53]], scene: ['floor'],
  },
  bike: {
    h: [46, 15], s: [41, 21], p: [26, 29],
    a: [[44, 28], [49, 33]], A: [[45, 28], [50, 33]],
    l: [[32, 40], [26, 49]], L: [[36, 37], [38, 48]], scene: ['bike'],
  },
  jump: {
    front: true,
    h: [32, 10], s: [32, 18], p: [32, 34],
    a: [[25, 12], [19, 5]], A: [[39, 12], [45, 5]],
    l: [[26, 43], [21, 51]], L: [[38, 43], [43, 51]], scene: ['floor'],
  },
  stretch: {
    front: true,
    h: [28, 13], s: [30, 21], p: [32, 37],
    a: [[24, 28], [30, 36]], A: [[33, 12], [27, 5]],
    l: [[29, 48], [27, FLOOR]], L: [[36, 48], [38, FLOOR]], scene: ['floor'],
  },
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;

/** The names that give a pose away, checked in order: the first that matches wins. */
const BY_NAME: [RegExp, PoseName][] = [
  [/\bsmr\b|foam roll/, 'roller'],
  [/leg curl|hamstring curl|glute ham|natural glute/, 'legcurl'],
  [/crunch|sit ?-?up|v ?-?up|jackknife|russian twist|oblique|toe touch|cocoon|tuck/, 'situp'],
  [/hanging|knee raise|toes to bar|knees to/, 'hang'],
  [/leg raise|leg lift|flutter|scissor|leg pull/, 'legs'],
  [/push ?-?up|press ?-?up|mountain climb/, 'pushup'],
  [/plank|rollout|ab roll|bear crawl|hold\b/, 'plank'],
  [/bridge|hip thrust|hip lift|butt lift|pelvic|glute kick/, 'bridge'],
  [/\bdips?\b/, 'dip'],
  [/pull ?-?ups?|chin ?-?ups?|pulldown|pull ?down|muscle ?up/, 'pullup'],
  [/calf|calves|toe raise|heel raise/, 'calf'],
  [/curl/, 'curl'],
  [/pushdown|push ?-?down|press ?down|kickback|kick ?back/, 'pushdown'],
  [/skull|tricep|french press|overhead extension/, 'triceps'],
  [/lateral raise|front raise|side raise|rear delt|reverse fl[yi]|upright row|\bt ?-?raise|y ?-?raise|pull apart/, 'raise'],
  [/shrug/, 'stand'],
  [/rowing|\brower\b/, 'run'],
  [/\brows?\b|face pull|inverted row/, 'row'],
  [/snatch|overhead squat|overhead carry|overhead walk|slam|throw|toss|wall ball|chest pass/, 'overhead'],
  [/arnold|military|overhead press|shoulder press|push press|jerk|behind the neck|\bohp\b|landmine press/, 'press'],
  [/bench|chest press|floor press|\bfl(y|ye|yes|ies)\b|pullover|pec deck|butterfly|crossover|incline press|decline press/, 'bench'],
  [/leg extension/, 'legext'],
  [/leg press|calf press/, 'seated'],
  [/squat|thruster|wall sit|goblet|pistol/, 'squat'],
  [/lunge|split|step ?-?ups?/, 'lunge'],
  [/deadlift|good ?morning|\brdl\b|romanian|clean|swing|hyperextension|back extension|pull ?through|stiff|superman/, 'hinge'],
  [/carry|farmer|walk|yoke|sled|march/, 'walk'],
  [/bike|bicycl|cycling|spinning|recumbent/, 'bike'],
  [/\brun|jog|sprint|treadmill|elliptical|stair|jump rope|rope jump|skip/, 'run'],
  [/jump|hop\b|hops\b|bound|burpee|box|skater|plyo|jack/, 'jump'],
  [/abduct|adduct|hip circle|hip raise|clam|fire hydrant|side leg/, 'hip'],
  [/stretch/, 'stretch'],
];

/** The pose of the muscle it mainly works, when its name doesn't say: by what it does with it. */
function byMuscle(m: Pick<Snap, 'muscles' | 'force' | 'equip'>): PoseName {
  switch (m.muscles[0]) {
    case 'chest': return 'bench';
    case 'shoulders': return m.force === 'push' ? 'press' : 'raise';
    case 'biceps': case 'forearms': return 'curl';
    case 'triceps': return m.equip === 'cable' ? 'pushdown' : 'triceps';
    case 'lats': return 'pullup';
    case 'middle back': return 'row';
    case 'traps': case 'neck': return 'stand';
    case 'lower back': case 'hamstrings': return 'hinge';
    case 'abdominals': return m.force === 'static' ? 'plank' : 'situp';
    case 'glutes': return 'bridge';
    case 'quadriceps': return m.equip === 'machine' ? 'seated' : 'squat';
    case 'calves': return 'calf';
    case 'abductors': case 'adductors': return 'hip';
    default: return 'stand';
  }
}

const fold = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** The pose an exercise is drawn in. */
export function poseOf(m: Pick<Snap, 'name' | 'cat' | 'kind' | 'muscles' | 'force' | 'equip'>): PoseName {
  const name = fold(m.name);
  if (m.cat === 'stretching' && !/smr|foam/.test(name)) return 'stretch';
  for (const [re, pose] of BY_NAME) if (re.test(name)) return pose;
  if (m.cat === 'cardio' || m.kind === 'cardio') return 'run';
  if (m.cat === 'plyometrics') return 'jump';
  if (m.cat === 'olympic') return 'hinge';
  return byMuscle(m);
}

/* ---------- the drawing ---------- */

/** One shape of a figure. `o` is how strongly it's drawn: the far side and the scene are fainter. */
export type Shape =
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; w: number; o: number }
  | { t: 'circle'; cx: number; cy: number; r: number; o: number; ring?: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; o: number };

const BODY = 7.5;  // the torso's thickness
const LIMB = 5;
const HEAD = 5.2;
const FAR = 0.5;   // the far arm and leg
const SCENE = 0.28;
const KIT = 0.9;   // what's held

const line = (a: P, b: P, w: number, o: number): Shape => ({ t: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1], w, o });
const dot = (c: P, r: number, o: number, ring?: number): Shape => ({ t: 'circle', cx: c[0], cy: c[1], r, o, ring });
const box = (x: number, y: number, w: number, h: number, o: number): Shape => ({ t: 'rect', x, y, w, h, o });

function scenery(s: Scene): Shape[] {
  switch (s) {
    case 'floor': return [line([6, 61], [58, 61], 1.5, SCENE)];
    case 'bench': return [box(14, 40, 40, 4, SCENE + 0.1), line([18, 44], [18, 61], 2.5, SCENE), line([48, 44], [48, 61], 2.5, SCENE)];
    case 'bar': return [line([10, 6], [54, 6], 2.5, SCENE + 0.15)];
    case 'step': return [box(20, 56, 26, 6, SCENE + 0.1)];
    case 'seat': return [box(18, 42, 18, 4, SCENE + 0.1), line([17, 42], [15, 18], 3, SCENE), line([26, 46], [26, 61], 2.5, SCENE)];
    case 'dip': return [line([24, 38], [46, 38], 2.5, SCENE + 0.15), line([44, 38], [44, 61], 2, SCENE)];
    case 'roller': return [dot([24, 54], 4.5, SCENE + 0.15)];
    case 'box': return [box(20, 48, 24, 13, SCENE)];
    case 'bike': return [
      dot([14, 50], 8.5, SCENE + 0.1, 2), dot([50, 50], 8.5, SCENE + 0.1, 2),
      line([14, 50], [26, 32], 2, SCENE + 0.1), line([26, 32], [46, 30], 2, SCENE + 0.1), line([46, 30], [50, 50], 2, SCENE + 0.1),
      line([26, 32], [32, 46], 2, SCENE + 0.1), line([46, 30], [49, 32], 2, SCENE + 0.1),
    ];
  }
}

/** What the hands hold, by what it's done with. */
function kit(pose: Pose, equip: Equip, arms: { a: Limb; A: Limb }): Shape[] {
  const ha = arms.a[1];
  const hA = arms.A[1];
  if (equip === 'cable' && pose.cable) return [line(hA, pose.cable, 1.2, SCENE + 0.2), dot(pose.cable, 2.2, SCENE + 0.2)];
  if (!pose.hold) return [];
  switch (equip) {
    case 'barbell': case 'ezbar': {
      if (pose.bar) return [dot(pose.bar.at, 6, KIT, 2.4)];
      if (pose.front) {
        const y = (ha[1] + hA[1]) / 2;
        const x1 = Math.min(ha[0], hA[0]) - 11;
        const x2 = Math.max(ha[0], hA[0]) + 11;
        return [line([x1, y], [x2, y], 2, KIT), box(x1 - 1, y - 6, 3.5, 12, KIT), box(x2 - 2.5, y - 6, 3.5, 12, KIT)];
      }
      return [dot(hA, 6, KIT, 2.4)];
    }
    case 'dumbbell': {
      if (pose.front) {
        const bell = (h: P) => [line([h[0] - 4, h[1]], [h[0] + 4, h[1]], 2, KIT), box(h[0] - 5.5, h[1] - 3, 2.5, 6, KIT), box(h[0] + 3, h[1] - 3, 2.5, 6, KIT)];
        return [...bell(ha), ...bell(hA)];
      }
      return [dot(ha, 3.4, KIT * FAR), dot(hA, 3.4, KIT)];
    }
    case 'kettlebell': {
      const h = pose.front ? [(ha[0] + hA[0]) / 2, Math.max(ha[1], hA[1])] as const : hA;
      return [line(h, [h[0], h[1] + 4], 2, KIT), dot([h[0], h[1] + 6], 4, KIT)];
    }
    case 'medball': {
      const c: P = pose.front ? [(ha[0] + hA[0]) / 2, Math.min(ha[1], hA[1]) - 2] : [hA[0] + 3, hA[1]];
      return [dot(c, 5.5, KIT)];
    }
    default: return [];
  }
}

/** The shapes of an exercise's figure, back to front. */
export function figureOf(m: Pick<Snap, 'name' | 'cat' | 'kind' | 'muscles' | 'force' | 'equip'>, name: PoseName = poseOf(m)): Shape[] {
  const pose: Pose = POSES[name];
  const barbell = (m.equip === 'barbell' || m.equip === 'ezbar') && pose.bar;
  const arms = barbell ? pose.bar! : pose;
  const far = pose.front ? 1 : FAR;
  const limb = ([j, e]: Limb, from: P, o: number) => [line(from, j, LIMB, o), line(j, e, LIMB, o)];
  return [
    ...(pose.scene ?? []).flatMap(scenery),
    ...limb(pose.l, pose.p, far),
    ...limb(arms.a, pose.s, far),
    line(pose.s, pose.p, BODY, 1),
    dot(pose.h, HEAD, 1),
    ...limb(pose.L, pose.p, 1),
    ...limb(arms.A, pose.s, 1),
    ...kit(pose, m.equip, arms),
  ];
}
