import assert from 'node:assert/strict';
import test from 'node:test';
// lib/exercises.ts: finding exercises the way people type them, the common ones first.
import vm from 'node:vm';
import { rolldown } from 'rolldown';
import { readFileSync } from 'node:fs';
const b = await rolldown({ input: 'src/lib/exercises.ts', plugins: [{ name: 'stub', resolveId(id) { if (id === 'preact/hooks' || id.endsWith('/store')) return '\0' + id; }, load(id) { if (id.startsWith('\0')) return 'export const useEffect=()=>{},useMemo=()=>{},useState=()=>[],useMyMoves=()=>[];'; } }] });
let code = (await b.generate({ format: 'esm', codeSplitting: false })).output[0].code;
code = code.replace(/export\s*\{([^}]*)\};?\s*$/, (_, l) => `return { ${l.split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [a, n = a] = s.split(/\s+as\s+/); return `${n}: ${a}`; }).join(', ')} };`);
const x = vm.runInNewContext(`(() => {${code}})()`, {});
const raw = JSON.parse(readFileSync('src/data/exercises.json', 'utf8'));
const list = raw.map((r) => ({ also: [], share: 0, met: 0, pair: false, foot: false, level: 0, force: null, img: 0, ...r }));
const names = (q, more = {}) => [...x.searchExercises(list, { q, ...more })].map((m) => m.name);
const top = (q, more) => names(q, more).slice(0, 3);

test('plural or singular, the staples come first', () => {
  assert.deepEqual(top('squats').slice(0, 2), ['Barbell Squat', 'Bodyweight Squat']);
  assert.deepEqual(top('squat').slice(0, 2), ['Barbell Squat', 'Bodyweight Squat']);
  assert.equal(names('curls')[0], 'Dumbbell Bicep Curl');
  assert.equal(names('lunges')[0], names('lunge')[0]);
  assert.equal(names('flyes')[0], 'Dumbbell Flyes');
  assert.equal(names('deadlifts')[0], 'Barbell Deadlift');
});

test('however a name is written: push up, push-up, pushups', () => {
  for (const q of ['push up', 'push-ups', 'pushup', 'Pushups']) assert.equal(names(q)[0], 'Pushups', q);
  assert.equal(names('pull ups')[0], 'Pullups');
});

test('everyday names and short forms find the exercise', () => {
  assert.equal(names('rdl')[0], 'Romanian Deadlift');
  assert.equal(names('lat pulldown')[0], 'Wide-Grip Lat Pulldown');
  assert.equal(names('bench')[0], 'Barbell Bench Press - Medium Grip');
  assert.equal(names('ohp')[0], 'Standing Military Press');
  assert.equal(names('db curl')[0], 'Dumbbell Bicep Curl');
  assert.equal(names('air squat')[0], 'Bodyweight Squat');
});

test('a muscle or equipment typed narrows the list, most common first', () => {
  assert.deepEqual(top('chest').slice(0, 2), ['Pushups', 'Barbell Bench Press - Medium Grip']);
  assert.ok(top('abs').includes('Plank'));
});

test('equipment: any of several, or none for all', () => {
  assert.equal(names('squats', { equip: ['body'] })[0], 'Bodyweight Squat');
  const two = names('squat', { equip: ['body', 'dumbbell'] });
  assert.ok(two.includes('Bodyweight Squat') && two.includes('Goblet Squat') === false && two.includes('Dumbbell Squat'));
  assert.ok(!two.includes('Barbell Squat'));
  assert.equal(names('squat', { equip: [] }).length, names('squat').length);
});

test('a typo is forgiven when nothing matches', () => {
  assert.equal(names('squta')[0], 'Barbell Squat');
  assert.equal(names('dumbell press')[0], 'Dumbbell Bench Press');
  assert.deepEqual(names('zzzzqqq'), []);
});

test('with nothing typed: what you have done first, then the most common', () => {
  const used = new Map([['Zercher_Squats', 3]]);
  assert.equal(x.searchExercises(list, {}, used)[0].name, 'Zercher Squats');
  assert.ok(['Barbell Squat', 'Pushups', 'Pullups', 'Barbell Deadlift', 'Barbell Bench Press - Medium Grip'].includes(x.searchExercises(list, {})[0].name));
  const pop = x.popularOf(list);
  assert.ok(pop.length >= 20 && pop.length <= 50);
});
