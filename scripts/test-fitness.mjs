import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// lib/fitness.ts: power, targets and reading untrusted copies of workouts.
async function load(file) {
  const bundle = await rolldown({ input: file });
  let code = (await bundle.generate({ format: 'esm', codeSplitting: false })).output[0].code;
  await bundle.close();
  code = code.replace(/export\s*\{([^}]*)\};?\s*$/, (_, list) => `return { ${list.split(',').map((s) => s.trim()).filter(Boolean)
    .map((s) => { const [local, name = local] = s.split(/\s+as\s+/); return `${name}: ${local}`; }).join(', ')} };`);
  return vm.runInNewContext(`(() => {\n${code}\n})()`, { Intl, Date, Math, Number, JSON });
}
const f = await load('src/lib/fitness.ts');
const set = (s) => ({ kg: null, reps: null, secs: null, km: null, tag: '', done: true, ...s });
const move = (m) => ({ id: 'x', name: 'X', kind: 'weight', equip: 'barbell', cat: 'strength', muscles: [], also: [], share: 0, met: 0, foot: false, force: null, ...m });

test('a weighted rep is worth a point for every 10 kg, whatever you weigh', () => {
  const bench = move({});
  assert.equal(f.setPower(bench, set({ kg: 60, reps: 10 }), 60), 60);
  assert.equal(f.setPower(bench, set({ kg: 60, reps: 10 }), 100), 60);
  // dumbbells in pairs count both
  assert.equal(f.setPower(move({ equip: 'dumbbell' }), set({ kg: 20, reps: 10 }), 75, true), 40);
});

test('a body move counts 15% of the share of your body it lifts, and stays below real lifting', () => {
  const pushup = move({ kind: 'body', equip: 'body', share: 0.64 });
  assert.equal(Math.round(f.repPower(pushup, set({}), 75) * 100) / 100, 0.72);
  assert.ok(f.setPower(pushup, set({ reps: 10 }), 60) < f.setPower(pushup, set({ reps: 10 }), 90));
  // 20 push-ups are worth less than 10 hammer curls with 10 kg in each hand (20 ⚡), up to about 100 kg of you
  const curls = f.setPower(move({ equip: 'dumbbell' }), set({ kg: 10, reps: 10 }), 75, true);
  assert.equal(curls, 20);
  assert.ok(f.setPower(pushup, set({ reps: 20 }), 75) < curls);
  assert.ok(f.setPower(pushup, set({ reps: 20 }), 100) < curls);
  // weight added on older sets no longer counts: the column is gone
  const pullup = move({ kind: 'body', share: 1 });
  assert.equal(f.setPower(pullup, set({ kg: 10, reps: 5 }), 80), f.setPower(pullup, set({ reps: 5 }), 80));
  assert.equal(Math.round(f.setPower(pullup, set({ reps: 5 }), 80) * 10) / 10, 6);
  // the volume a set moved is still the real weight
  assert.equal(f.setVolume(pullup, set({ reps: 5 }), 80), 400);
});

test('holds count a rep every 3 seconds, cardio counts effort over time', () => {
  const plank = move({ kind: 'time', share: 0.6 });
  assert.equal(Math.round(f.setPower(plank, set({ secs: 60 }), 75) * 10) / 10, 13.5);
  const run = move({ kind: 'cardio', met: 9.8, foot: true });
  assert.equal(Math.round(f.setPower(run, set({ secs: 1800 }), 75)), 735);
  // 5 km in 25 minutes is 200 m/min: (3.5 + 40) / 3.5 METs
  assert.equal(Math.round(f.cardioMet(9.8, { km: 5, secs: 1500 }) * 100) / 100, 12.43);
  // a bike's distance says nothing about effort on foot
  const bike = move({ kind: 'cardio', met: 8 });
  assert.equal(f.setPower(bike, set({ secs: 1800, km: 15 }), 75), f.setPower(bike, set({ secs: 1800 }), 75));
  const stretch = move({ kind: 'time', met: 2.3 });
  assert.equal(Math.round(f.setPower(stretch, set({ secs: 300 }), 75) * 10) / 10, 28.8);
});

test('warm-ups count half and only done sets count in a workout', () => {
  const it = { move: move({}), sets: [set({ kg: 40, reps: 10, tag: 'warm' }), set({ kg: 60, reps: 10 }), set({ kg: 60, reps: 10, done: false })], pair: false, rest: 90, note: '' };
  assert.equal(f.workoutPower({ items: [it], bw: 75 }), 80);
  assert.equal(f.planPower({ items: [it] }, 75), 140);
  assert.equal(f.suggestTarget({ items: [it] }, 75), 140);
  assert.equal(f.suggestTarget({ items: [it] }, 75, 200), 210);
});

test('one-rep max follows Epley within 1 to 12 reps', () => {
  assert.equal(f.oneRepMax(100, 1), 100);
  assert.equal(f.oneRepMax(100, 10), 100 * (1 + 10 / 30));
  assert.equal(f.oneRepMax(100, 20), 0);
});

test('body weight on a day is the last weigh-in before it', () => {
  const w = (day, kg) => ({ id: day, day, kg, created: 1, updated: 1 });
  const list = [w('2026-01-10', 80), w('2026-02-01', 78)];
  assert.equal(f.weightOn(list, '2026-01-20'), 80);
  assert.equal(f.weightOn(list, '2026-03-01'), 78);
  assert.equal(f.weightOn(list, '2025-12-01'), 80);
  assert.equal(f.weightOn([], '2026-01-01'), f.DEFAULT_BW);
});

test('untrusted workouts are cleaned up or dropped', () => {
  assert.equal(f.normalizeWorkout({ id: 'a' }), null);
  const w = f.normalizeWorkout({ id: 'a', start: 5, end: 1, bw: 9999, icon: '<x>', items: [{ move: { id: 'Pushups', name: 'Pushups', kind: 'body', share: 9 }, sets: [{ reps: 10, done: true, tag: 'odd' }] }, { move: { id: 'bad id!', name: 'x' } }] });
  assert.equal(w.end, null);
  assert.equal(w.bw, f.DEFAULT_BW);
  assert.equal(w.icon, 'barbell');
  assert.equal(w.items.length, 1);
  assert.equal(w.items[0].move.share, 0);
  assert.equal(w.items[0].sets[0].tag, '');
  assert.equal(f.normalizeMyMove({ id: 'Pushups', name: 'x' }), null);
  assert.ok(f.normalizeMyMove({ id: 'myabc123', name: 'Mine', kind: 'body', share: 0.5 }));
  assert.equal(f.normalizeWeighIn({ id: 'w', day: '2026-01-01', kg: 10 }), null);
});
