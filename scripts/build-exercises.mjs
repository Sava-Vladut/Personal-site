// Builds the Workout page's exercise database from free-exercise-db (github.com/yuhonas/free-exercise-db, the Unlicense):
//   src/data/exercises.json        what the picker searches, with each exercise's power facts (lib/fitness.ts)
//   src/data/exercise-steps.json   how to do each one, loaded only when its details are opened
// Usage: node scripts/build-exercises.mjs [path to a downloaded dist/exercises.json]
// Without a path it downloads the file. Moves the database lacks (burpees, outdoor runs, swimming…) are added below.
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json';
const raw = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : await (await fetch(SOURCE)).json();

const EQUIP = {
  'body only': 'body', barbell: 'barbell', dumbbell: 'dumbbell', kettlebells: 'kettlebell', machine: 'machine', cable: 'cable',
  bands: 'bands', 'e-z curl bar': 'ezbar', 'medicine ball': 'medball', 'exercise ball': 'ball', 'foam roll': 'foam', other: 'other',
};
const CAT = {
  strength: 'strength', powerlifting: 'powerlifting', 'olympic weightlifting': 'olympic', strongman: 'strongman',
  plyometrics: 'plyometrics', cardio: 'cardio', stretching: 'stretching',
};
const LEVEL = { beginner: 0, intermediate: 1, expert: 2 };

/** Moves done with your own body that the database files under "other" (bars, rings, straps, boxes). */
const BODY_OTHER = /pull[- ]?ups?\b|chin|\bdips?\b|muscle up|otis-up|rope climb|push[- ]?up|drop push|inverted row|mid row|suspended|hyperextensions \(back|knee\/hip raise|london bridges|\bjump|hop|leap|bound|skip|sprint drill|side to side box|stride|push-off|hurdle|bench sprint|power stairs|platform hamstring|one handed hang|single-leg high box squat|donkey calf|band assisted/i;
/** Body moves where you add weight (a belt, a vest) rather than lift it alone. */
const LOADED_BODY = /weighted (pull ups|bench dip|squat)/i;

/** The share of your body weight a body move lifts (see lib/fitness.ts), from its name. Push-ups are measured (Ebben 2011);
 * the rest are estimates from body-segment masses. */
function shareOf(name, cat) {
  const n = name.toLowerCase();
  const rules = [
    [/one arm chin|one handed hang/, 1],
    [/handstand/, 1],
    [/muscle up|rope climb/, 1],
    [/scapular/, 0.9],
    [/gorilla/, 0.4],
    [/pull[- ]?ups?|chin|otis/, 0.95],
    [/bench dip/, 0.6],
    [/\bdips?\b/, 0.95],
    [/single-arm push|one arm push/, 0.75],
    [/knee push/, 0.49],
    [/incline push/, 0.45],
    [/decline push|feet elevated|feet on an exercise ball|plyo|clap|drop push|depth jump/, 0.74],
    [/push[- ]?ups?|body-up|body tricep press|spider crawl/, 0.64],
    [/inverted row|mid row|suspended row|row with straps/, 0.6],
    [/pistol|single-leg high box squat|single-leg .*squat|split squat/, 0.85],
    [/calf/, 0.9],
    [/step-?up/, 0.8],
    [/jump squat|squat jump/, 0.8],
    [/squat|lunge/, 0.75],
    [/burpee/, 0.85],
    [/glute ham|glute-ham|platform hamstring|hamstring slides/, 0.6],
    [/hyperextension|superman|back extension/, 0.5],
    [/plank|side bridge|wiper/, 0.6],
    [/\bl-sit/, 0.8],
    [/wall sit/, 0.6],
    [/hang\b|dead hang/, 0.9],
    [/neck|isometric chest/, 0.1],
    [/bridge|hip raise|butt lift|kickback|leg lift|flutter|scissor/, 0.45],
    [/sit-?up|v-up|jackknife|janda/, 0.5],
    [/hanging|knee\/hip raise|pike/, 0.4],
    [/leg raise|leg pull-in|leg tucks|pull-in/, 0.35],
    [/crunch|heel touch|elbow to knee|toe touch|twist|dead bug|air bike|cocoons|bottoms up|butt-ups|rotation|side bend/, 0.3],
    [/climber|crawl|butt kick|skipping|carioca|quick step|drill|technique|claw/, 0.5],
    [/jumping jack|star jump/, 0.3],
    [/jump|hop|bound|leap|sprint|stride|push-off|shuffle|stairs/, 0.8],
  ];
  for (const [re, share] of rules) if (re.test(n)) return share;
  return cat === 'plyometrics' ? 0.7 : 0.5;
}

/** Dumbbells and kettlebells used one in each hand, so the weight counts twice (you can change it per workout). */
function pairOf(name, equip) {
  const n = name.toLowerCase();
  if (equip === 'dumbbell')
    return !/one-arm|one arm|one-leg|single|concentration|pullover|side bend|seated triceps press|standing dumbbell triceps extension|calf raise on a dumbbell|external rotation|pronation|supination|vertical swing|seated box jump|plie|tate press|around the worlds/.test(n);
  if (equip === 'kettlebell') return /double|two kettlebells|alternating (floor|kettlebell press|kettlebell row|renegade)|seesaw/.test(n);
  return false;
}

/** How hard cardio is, in METs (2024 Adult Compendium of Physical Activities). */
const CARDIO_MET = [
  [/recumbent/, 5.5], [/stationary/, 6.8], [/bicycl/, 8], [/elliptical/, 5], [/walking, treadmill/, 3.8], [/jogging/, 7.5],
  [/running, treadmill/, 9.8], [/trail/, 6.5], [/rope jump/, 11], [/rowing/, 7.3], [/skating/, 7], [/stairmaster/, 9.3],
  [/step mill/, 9], [/prowler/, 8],
];
const metOf = (name) => CARDIO_MET.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? 7;

const out = [];
const steps = {};
for (const e of raw) {
  const cat = CAT[e.category] ?? 'strength';
  let equip = e.equipment ? EQUIP[e.equipment] ?? 'other' : cat === 'stretching' ? 'other' : 'body';
  let kind;
  if (cat === 'cardio') kind = 'cardio';
  else if (cat === 'stretching' || equip === 'foam') kind = 'time';
  else if (equip === 'body' || equip === 'ball' || (equip === 'other' && (BODY_OTHER.test(e.name) || LOADED_BODY.test(e.name)))) kind = e.force === 'static' ? 'time' : 'body';
  else kind = 'weight';
  if (kind === 'body' || (kind === 'time' && cat !== 'stretching' && equip !== 'foam')) {
    if (equip === 'other') equip = 'body';
  }
  const m = {
    id: e.id,
    name: e.name.trim(),
    kind,
    equip,
    cat,
    muscles: e.primaryMuscles,
  };
  if (e.secondaryMuscles?.length) m.also = e.secondaryMuscles.filter((x) => !e.primaryMuscles.includes(x));
  if (!m.also?.length) delete m.also;
  if (kind === 'body' || (kind === 'time' && cat !== 'stretching' && equip !== 'foam')) m.share = shareOf(e.name, cat);
  if (kind === 'cardio') m.met = metOf(e.name);
  if (kind === 'time' && (cat === 'stretching' || equip === 'foam')) m.met = 2.3;
  if (/running|jogging|walking/i.test(e.name) && kind === 'cardio') m.foot = true;
  if (pairOf(e.name, equip)) m.pair = true;
  if (LEVEL[e.level]) m.level = LEVEL[e.level];
  if (e.force) m.force = e.force;
  if (e.images?.length) m.img = Math.min(2, e.images.length);
  out.push(m);
  if (e.instructions?.length) steps[e.id] = e.instructions.map((s) => s.trim()).filter(Boolean);
}

// What the database doesn't have. Ids start "mm_" so they never meet one of its ids (letters, digits, _ and -).
const body = (id, name, muscles, also, share, extra = {}) => ({ id: 'mm_' + id, name, kind: 'body', equip: 'body', cat: 'strength', muscles, also, share, ...extra });
const hold = (id, name, muscles, also, share) => ({ id: 'mm_' + id, name, kind: 'time', equip: 'body', cat: 'strength', muscles, also, share, force: 'static' });
const cardio = (id, name, muscles, met, extra = {}) => ({ id: 'mm_' + id, name, kind: 'cardio', equip: 'body', cat: 'cardio', muscles, met, ...extra });
const flow = (id, name, muscles, met) => ({ id: 'mm_' + id, name, kind: 'time', equip: 'body', cat: 'stretching', muscles, met });
out.push(
  body('Burpee', 'Burpee', ['quadriceps', 'chest'], ['shoulders', 'triceps', 'abdominals', 'glutes'], 0.85, { cat: 'plyometrics', force: 'push' }),
  body('Jumping_Jack', 'Jumping Jack', ['calves', 'shoulders'], ['quadriceps', 'glutes'], 0.3, { cat: 'plyometrics', force: 'push' }),
  body('Knee_Push-Up', 'Knee Push-Up', ['chest'], ['triceps', 'shoulders'], 0.49, { force: 'push' }),
  body('Pistol_Squat', 'Pistol Squat', ['quadriceps'], ['glutes', 'hamstrings', 'calves'], 0.85, { force: 'push', level: 2 }),
  body('Lunge', 'Bodyweight Lunge', ['quadriceps'], ['glutes', 'hamstrings'], 0.75, { force: 'push' }),
  body('Calf_Raise', 'Bodyweight Calf Raise', ['calves'], [], 0.9, { force: 'push' }),
  body('Glute_Bridge', 'Glute Bridge', ['glutes'], ['hamstrings', 'lower back'], 0.45, { force: 'push' }),
  body('Leg_Raise', 'Lying Leg Raise', ['abdominals'], [], 0.35, { force: 'pull' }),
  body('Muscle-Up', 'Bar Muscle-Up', ['lats'], ['chest', 'triceps', 'biceps', 'shoulders'], 1, { force: 'pull', level: 2 }),
  hold('Wall_Sit', 'Wall Sit', ['quadriceps'], ['glutes'], 0.6),
  hold('L-Sit', 'L-Sit', ['abdominals'], ['triceps', 'quadriceps'], 0.8),
  hold('Dead_Hang', 'Dead Hang', ['forearms'], ['lats', 'shoulders'], 0.9),
  hold('Hollow_Hold', 'Hollow Body Hold', ['abdominals'], [], 0.4),
  cardio('Running', 'Running', ['quadriceps'], 9.8, { also: ['hamstrings', 'calves', 'glutes'], foot: true }),
  cardio('Walking', 'Walking', ['quadriceps'], 3.8, { also: ['calves', 'glutes'], foot: true }),
  cardio('Hiking', 'Hiking', ['quadriceps'], 6, { also: ['glutes', 'calves'], foot: true }),
  cardio('Swimming', 'Swimming', ['lats'], 8.3, { also: ['shoulders', 'chest', 'triceps', 'quadriceps'] }),
  cardio('HIIT', 'HIIT Circuit', ['quadriceps'], 8, { also: ['chest', 'shoulders', 'abdominals', 'glutes'] }),
  cardio('Boxing', 'Boxing (Heavy Bag)', ['shoulders'], 7, { also: ['chest', 'triceps', 'abdominals'] }),
  cardio('Dancing', 'Dancing', ['quadriceps'], 5, { also: ['calves', 'glutes'] }),
  cardio('Football', 'Football (Soccer)', ['quadriceps'], 7, { also: ['hamstrings', 'calves', 'glutes'] }),
  cardio('Basketball', 'Basketball', ['quadriceps'], 6.5, { also: ['calves', 'shoulders'] }),
  cardio('Tennis', 'Tennis', ['shoulders'], 7.3, { also: ['quadriceps', 'forearms'] }),
  flow('Yoga', 'Yoga', ['hamstrings'], 2.5),
  flow('Pilates', 'Pilates', ['abdominals'], 2.8),
  flow('Mobility', 'Mobility Flow', ['hamstrings'], 2.3),
);
for (const m of out) if (m.also && !m.also.length) delete m.also;

const ids = new Set();
for (const m of out) {
  if (ids.has(m.id)) throw new Error('duplicate id ' + m.id);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(m.id)) throw new Error('bad id ' + m.id);
  ids.add(m.id);
}
out.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync('src/data/exercises.json', JSON.stringify(out));
writeFileSync('src/data/exercise-steps.json', JSON.stringify(steps));
const kinds = out.reduce((c, m) => ((c[m.kind] = (c[m.kind] ?? 0) + 1), c), {});
console.log(`${out.length} exercises`, kinds);
