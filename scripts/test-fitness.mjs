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

test('every done set counts in full (set kinds are retired) and only done sets count in a workout', () => {
  const it = { move: move({}), sets: [set({ kg: 40, reps: 10 }), set({ kg: 60, reps: 10 }), set({ kg: 60, reps: 10, done: false })], pair: false, rest: 90, note: '' };
  assert.equal(f.workoutPower({ items: [it], bw: 75 }), 100);
  assert.equal(f.planPower({ items: [it] }, 75), 160);
  assert.equal(f.suggestTarget({ items: [it] }, 75), 160);
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
  // an older warm-up, drop or failure set reads as a normal one
  assert.equal(f.normalizeWorkout({ id: 'b', start: 1, items: [{ move: { id: 'Bench', name: 'Bench' }, sets: [{ kg: 50, reps: 5, tag: 'warm', done: true }] }] }).items[0].sets[0].tag, '');
  assert.equal(f.normalizeMyMove({ id: 'Pushups', name: 'x' }), null);
  assert.ok(f.normalizeMyMove({ id: 'myabc123', name: 'Mine', kind: 'body', share: 0.5 }));
  assert.equal(f.normalizeWeighIn({ id: 'w', day: '2026-01-01', kg: 10 }), null);
});

/* ---------- form ---------- */

const curl = move({ id: 'Curl', equip: 'dumbbell', muscles: ['biceps'] });
const hammer = move({ id: 'Hammer', equip: 'dumbbell', muscles: ['biceps'] });
const dip = move({ id: 'Dip', kind: 'body', share: 0.9, muscles: ['triceps'] });
const squat = move({ id: 'Squat', equip: 'barbell', muscles: ['quadriceps'] });
const item = (m, sets) => ({ move: m, sets, pair: false, rest: 90, note: '' });
const T0 = 1_700_000_000_000;
const at = (s) => T0 + s * 1000;
// objects from the bundle's own realm: compared as plain data
const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
const whys = (x) => x.hits.map((h) => h.why).sort().join(',');

test('a short rest earns more, a long one less, sets ticked together are not timed', () => {
  // 4 reps: outside the growth range, so only the rest shows
  const sets = [at(0), at(100), at(500), at(1200)].map((t) => set({ kg: 20, reps: 4, at: t }));
  const form = f.formOf({ items: [item(curl, sets)], bw: 75 });
  same(form.map(whys), ['', 'rest', 'long', 'cold']);
  assert.equal(form[1].f, 1.15);
  // changing exercise gets a minute more
  const two = f.formOf({ items: [item(curl, [set({ kg: 20, reps: 4, at: at(0) })]), item(dip, [set({ reps: 4, at: at(200) })])], bw: 75 });
  assert.equal(whys(two[1]), 'rest');
});

test('reps in the growth range earn more; very heavy or very light sets less', () => {
  const form = f.formOf({ items: [item(curl, [2, 10, 20, 40].map((reps) => set({ kg: 10, reps })))], bw: 75 });
  same(form.map((x) => x.f), [0.9, 1.1, 1, 0.8]);
});

test('the same muscle again and again loses power past four sets in a row; switching starts over', () => {
  const six = [...Array(6)].map(() => set({ kg: 10, reps: 4 }));
  const alike = f.formOf({ items: [item(curl, six.slice(0, 3)), item(hammer, six.slice(3))], bw: 75 });
  same(alike.map((x) => x.f), [1, 1, 1, 1, 0.85, 0.7]);
  // curls, dips, curls…: never more than one in a row
  const mixed = f.formOf({ items: [item(curl, [set({ kg: 10, reps: 4, at: at(0) }), set({ kg: 10, reps: 4, at: at(10) }), set({ kg: 10, reps: 4, at: at(20) })]), item(dip, [set({ reps: 4, at: at(5) }), set({ reps: 4, at: at(15) })])], bw: 75 });
  assert.ok(mixed.every((x) => x.f === 1));
  // past ten sets of a muscle in a workout, each counts half (on top of the row)
  const many = f.formOf({ items: [item(curl, [...Array(11)].map(() => set({ kg: 10, reps: 4 })))], bw: 75 });
  assert.ok(many[10].hits.some((h) => h.why === 'cap'));
  assert.equal(many[10].f, f.FORM_MIN);
});

test('beating last time, a fresh muscle and a sore one', () => {
  const sets = [set({ kg: 22, reps: 4, beat: 20 * (1 + 4 / 30) }), set({ kg: 20, reps: 4, beat: 20 * (1 + 4 / 30) })];
  const form = f.formOf({ items: [item(curl, sets), item(squat, [set({ kg: 60, reps: 4 })])], bw: 75, since: { quadriceps: 20 } });
  same(form.map(whys), ['beat,fresh', 'fresh', 'sore']);
  assert.equal(form[0].f, Math.round(1.15 * 1.1 * 1000) / 1000);
  // workouts from before form counted: no recovery either way
  assert.equal(whys(f.formOf({ items: [item(curl, sets.slice(1))], bw: 75 })[0]), '');
});

test('form is kept between its limits and counts in a set\'s power', () => {
  const s = set({ kg: 20, reps: 10, beat: 1, at: at(60) });
  const form = f.formOf({ items: [item(curl, [set({ kg: 20, reps: 10, at: at(0) }), s])], bw: 75, since: {} });
  assert.equal(form[1].f, f.FORM_MAX);
  assert.equal(f.setPower(curl, { ...s, boost: 1.5 }, 75), 30);
  assert.equal(form[1].raw, 20);
});

test('ticking a set stamps its time and last time\'s score; unticking takes them off; form is stored on the set', () => {
  const ghosts = new Map([['Curl', [set({ kg: 20, reps: 8 })]]]);
  let w = { items: [item(curl, [set({ kg: 20, reps: 10 }), set({ kg: 20, reps: 10, done: false })])], bw: 75, since: {} };
  w = f.applyForm(w, ghosts, T0);
  const [a, b] = w.items[0].sets;
  assert.equal(a.at, T0);
  assert.equal(a.beat, 20 * (1 + 8 / 30));
  assert.equal(a.boost, Math.round(1.1 * 1.15 * 1.1 * 1000) / 1000);
  assert.equal(b.at, undefined);
  w = f.applyForm({ ...w, items: [{ ...w.items[0], sets: [{ ...a, done: false }, b] }] }, ghosts, T0 + 1000);
  same(Object.keys(w.items[0].sets[0]).sort(), ['done', 'kg', 'km', 'reps', 'secs', 'tag']);
  // a plan made from it, or a set copied, keeps none of it
  assert.equal(f.blankSet('weight', a).at, undefined);
  assert.equal(f.undone(a).boost, undefined);
});

test('the summary splits what form added and took between its reasons', () => {
  const w = { items: [item(curl, [set({ kg: 10, reps: 10 }), set({ kg: 10, reps: 2 })])], bw: 75 };
  const sum = f.formSummary(w);
  assert.equal(Math.round(sum.gained * 100) / 100, 1);
  assert.equal(Math.round(sum.lost * 100) / 100, 0.2);
  same(sum.reasons.map((r) => r.why), ['range', 'heavy']);
});

test('recovery: hours since each muscle last had two sets, over the week before', () => {
  const done = (end, m, n) => ({ end, items: [item(m, [...Array(n)].map(() => set({ kg: 10, reps: 10 })))] });
  const now = T0 + 200 * 3_600_000;
  const since = f.sinceOf([done(T0 + 190 * 3_600_000, curl, 3), done(T0 + 199 * 3_600_000, dip, 1), done(T0, squat, 5), { end: null, items: [] }], now);
  same(since, { biceps: 10 });
});

test('the next set warns of its cut before it is done', () => {
  const w = { items: [item(curl, [...Array(4)].map(() => set({ kg: 10, reps: 10 }))), item(hammer, [set({ kg: 10, reps: 10, done: false })]), item(dip, [set({ reps: 10, done: false })])] };
  same(f.nextCut(w, 1), { row: 5, f: 0.85, cap: false });
  assert.equal(f.nextCut(w, 2), null);
});

test('stored form survives a round trip and junk is dropped', () => {
  const w = f.normalizeWorkout({ id: 'a', start: 1, since: { biceps: 5, nope: 3, chest: 999 }, items: [{ move: { id: 'Curl', name: 'Curl' }, sets: [{ kg: 10, reps: 10, done: true, at: 5, beat: 3, boost: 1.2 }, { done: false, at: 5, boost: 1.2 }, { done: true, boost: 9 }] }] });
  same(w.since, { biceps: 5 });
  assert.equal(w.items[0].sets[0].boost, 1.2);
  assert.equal(w.items[0].sets[0].at, 5);
  assert.equal(w.items[0].sets[1].at, undefined);
  assert.equal(w.items[0].sets[2].boost, undefined);
  assert.equal(f.normalizeWorkout({ id: 'b', start: 1 }).since, undefined);
});
