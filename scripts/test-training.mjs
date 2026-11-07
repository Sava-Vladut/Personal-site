import assert from 'node:assert/strict';
import test from 'node:test';
import { rolldown } from 'rolldown';

// lib/trainingStats.ts: the numbers under Insights › Workouts (weeks, streaks, muscles, records, ranges). It's bundled
// with lib/fitness.ts and imported as a module of this realm, so its arrays compare with deepEqual like any others.
async function load(file) {
  const bundle = await rolldown({ input: file });
  const code = (await bundle.generate({ format: 'esm', codeSplitting: false })).output[0].code;
  await bundle.close();
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const s = await load('src/lib/trainingStats.ts');

const set = (x) => ({ kg: null, reps: null, secs: null, km: null, tag: '', done: true, ...x });
const move = (m) => ({ id: 'bench', name: 'Bench press', kind: 'weight', equip: 'barbell', cat: 'strength', muscles: ['chest'], also: ['shoulders', 'triceps'], share: 0, met: 0, foot: false, force: 'push', ...m });
const item = (m, sets, pair = false) => ({ move: move(m), sets: sets.map(set), pair, rest: 90, note: '' });
let n = 0;
/** A workout on a day, at 18:00 and an hour long unless it says otherwise. */
const workout = (day, items, { hour = 18, mins = 60, ...x } = {}) => {
  const [y, m, d] = day.split('-').map(Number);
  const start = new Date(y, m - 1, d, hour).getTime();
  return { id: 'w' + ++n, plan: null, name: 'W', icon: 'barbell', target: 0, bw: 80, start, end: start + mins * 60_000, items, feel: 0, note: '', created: start, updated: start, ...x };
};

test('days move by the calendar and weeks start on the chosen day', () => {
  assert.equal(s.addDay('2026-03-28', 2), '2026-03-30'); // across a change of clocks in Europe
  assert.equal(s.addDay('2026-01-01', -1), '2025-12-31');
  assert.equal(s.daysBetween('2026-03-28', '2026-03-30'), 2);
  // 2026-11-05 is a Thursday
  assert.equal(s.weekOf('2026-11-05', 1), '2026-11-02');
  assert.equal(s.weekOf('2026-11-05', 0), '2026-11-01');
  assert.equal(s.weekOf('2026-11-01', 1), '2026-10-26'); // a Sunday ends a Monday week
  assert.equal(s.weekOf('2026-11-01', 0), '2026-11-01');
});

test('a range is whole weeks back from this one, compared with as much of the weeks before', () => {
  const r = s.rangeOf('4w', '2026-11-05', 1);
  assert.equal(r.start, '2026-10-12');
  assert.equal(r.end, '2026-11-05');
  assert.equal(r.prev.start, '2026-09-14');
  assert.equal(s.daysBetween(r.prev.start, r.prev.end), s.daysBetween(r.start, r.end));
  assert.ok(r.prev.end < r.start);
  const all = s.rangeOf('all', '2026-11-05', 1, '2026-06-10');
  assert.equal(all.start, '2026-06-08');
  assert.equal(all.prev, null);
});

test('only finished workouts count, and in them only done sets', () => {
  const done = workout('2026-11-02', [item({}, [{ kg: 60, reps: 10 }, { kg: 60, reps: 10, done: false }])], { target: 50 });
  const live = workout('2026-11-03', [item({}, [{ kg: 60, reps: 10 }])], { end: null });
  const list = s.finished([live, done]);
  assert.equal(list.length, 1);
  assert.equal(list[0].power, 60);
  assert.equal(list[0].sets, 1);
  assert.equal(list[0].met, true);
  assert.equal(list[0].mins, 60);
  assert.equal(list[0].kinds.weight, 60);
});

test('weeks bucket by the week start, empty weeks included, and know when every target was met', () => {
  const list = s.finished([
    workout('2026-11-01', [item({}, [{ kg: 100, reps: 5 }])], { target: 40 }), // Sunday
    workout('2026-11-02', [item({}, [{ kg: 100, reps: 5 }])], { target: 60 }), // Monday
    workout('2026-11-04', [item({}, [{ kg: 50, reps: 2 }])]),                  // Wednesday, no target
  ]);
  const monday = s.weeks(list, { start: '2026-10-19', end: '2026-11-05' }, 1);
  assert.deepEqual(monday.map((w) => w.key), ['2026-10-19', '2026-10-26', '2026-11-02']);
  assert.deepEqual(monday.map((w) => w.power), [0, 50, 60]);
  assert.deepEqual(monday.map((w) => s.weekMet(w)), [false, true, false]);
  const sunday = s.weeks(list, { start: '2026-10-19', end: '2026-11-05' }, 0);
  assert.deepEqual(sunday.map((w) => w.key), ['2026-10-18', '2026-10-25', '2026-11-01']);
  assert.deepEqual(sunday.map((w) => w.power), [0, 0, 110]);
  assert.deepEqual(sunday.map((w) => w.workouts), [0, 0, 3]);
  assert.equal(sunday[2].targeted, 2);
  assert.equal(sunday[2].met, 1);
});

test('streaks: weeks in a row up to this one, and targets met in a row', () => {
  const at = (day, met) => workout(day, [item({}, [{ kg: 100, reps: 10 }])], { target: met ? 50 : 500 });
  const list = s.finished([
    at('2026-11-03', true),  // this week (Thursday 5 Nov, weeks from Monday)
    at('2026-10-27', true),
    at('2026-10-20', false),
    workout('2026-10-21', [item({}, [{ kg: 10, reps: 1 }])]), // no target: doesn't break a run
    at('2026-09-29', true),
    at('2026-09-22', true),
    at('2026-09-15', true),
    at('2026-09-08', true),
  ]);
  const st = s.streaks(list, '2026-11-05', 1);
  assert.equal(st.weeks, 3);
  assert.equal(st.bestWeeks, 4);
  assert.equal(st.targets, 2);
  assert.equal(st.bestTargets, 4);
  assert.equal(st.lastWeeks.length, 8);
  assert.equal(st.lastWeeks.at(-1), true);
  assert.deepEqual(st.lastTargets.slice(-3), [false, true, true]);
  // nothing yet this week: last week's run still stands
  assert.equal(s.streaks(list, '2026-11-12', 1).weeks, 3);
  // a whole week missed ends it
  assert.equal(s.streaks(list, '2026-11-19', 1).weeks, 0);
});

test('muscles: the main ones count a whole set, the helping ones half, and share the power the same way', () => {
  const list = s.finished([workout('2026-11-02', [
    item({}, [{ kg: 100, reps: 5 }, { kg: 100, reps: 5 }]),                                                           // bench: chest, helped by shoulders and triceps
    item({ id: 'pushups', kind: 'body', equip: 'body', share: 0.5, muscles: ['chest', 'triceps'], also: [] }, [{ reps: 10 }]),
  ])]);
  const load = s.muscleLoad(list);
  assert.equal(load.chest.sets, 3);
  assert.equal(load.shoulders.sets, 1);
  assert.equal(load.triceps.sets, 2);
  assert.equal(load.lats.sets, 0);
  assert.equal(load.lats.last, null);
  assert.equal(load.chest.last, '2026-11-02');
  // bench is 100 ⚡: half to chest, a quarter each to shoulders and triceps; push-ups (6 ⚡: body moves count 15%) split between chest and triceps
  assert.equal(Math.round(load.chest.power * 100) / 100, 53);
  assert.equal(load.shoulders.power, 25);
  assert.equal(Math.round(load.triceps.power * 100) / 100, 28);
  const total = Object.values(load).reduce((a, x) => a + x.power, 0);
  assert.equal(total, list[0].power);
  const heat = s.muscleHeat(load);
  assert.equal(heat.chest, 1);
  assert.equal(heat.shoulders, 1 / 3);
  assert.equal(heat.lats, undefined);
  const groups = s.groupLoad(load, { chest: 'push', shoulders: 'push', triceps: 'push', lats: 'pull', neck: 'pull', traps: 'pull', biceps: 'pull', forearms: 'pull', 'middle back': 'pull', 'lower back': 'core', abdominals: 'core', glutes: 'legs', abductors: 'legs', adductors: 'legs', quadriceps: 'legs', hamstrings: 'legs', calves: 'legs' });
  assert.equal(groups.push, 6);
  assert.equal(groups.pull, 0);
  const moves = s.movesFor(list, 'triceps');
  // one set each as triceps counts them; the bench's is the more power
  assert.deepEqual(moves.map((m) => m.move.id), ['bench', 'pushups']);
});

test('rested longest: the muscles worked longest ago first, the never-worked apart', () => {
  const list = s.finished([
    workout('2026-11-01', [item({}, [{ kg: 60, reps: 5 }])]),
    workout('2026-10-20', [item({ id: 'squat', muscles: ['quadriceps'], also: [] }, [{ kg: 100, reps: 5 }])]),
  ]);
  const r = s.rested(s.muscleLoad(list), '2026-11-05');
  assert.deepEqual(r.worked.map((x) => [x.muscle, x.days]), [['quadriceps', 16], ['shoulders', 4], ['chest', 4], ['triceps', 4]]);
  assert.ok(r.never.includes('calves'));
  assert.ok(!r.never.includes('chest'));
});

test('exercise records: heaviest, best one-rep max, most reps, best set and best workout', () => {
  const list = s.finished([
    workout('2026-10-01', [item({}, [{ kg: 60, reps: 10 }, { kg: 70, reps: 5 }])]),
    workout('2026-10-08', [item({}, [{ kg: 80, reps: 3 }, { kg: 50, reps: 15 }])]),
    workout('2026-10-15', [item({}, [{ kg: 75, reps: 6 }]), item({}, [{ kg: 75, reps: 6 }])]), // done twice in one workout
  ]);
  const [bench] = s.moveStats(list);
  assert.equal(bench.times, 3);
  assert.equal(bench.sets, 6);
  assert.equal(bench.heaviest.value, 80);
  assert.equal(bench.heaviest.day, '2026-10-08');
  assert.equal(Math.round(bench.best1rm.value * 10) / 10, 90); // 75 × (1 + 6/30)
  assert.equal(bench.best1rm.day, '2026-10-15');
  assert.equal(bench.mostReps.value, 15);
  assert.equal(bench.bestSet.value, 75);    // 50 kg × 15
  assert.equal(bench.bestDay.value, 99);    // the 8th: 24 and 75
  assert.equal(bench.bestDay.day, '2026-10-08');
  assert.equal(bench.oneRm.length, 3);
  assert.deepEqual(bench.recent.map((r) => r.day), ['2026-10-15', '2026-10-08', '2026-10-01']);
  assert.equal(s.trendOf(bench), bench.oneRm);
  const holds = s.moveStats(s.finished([workout('2026-10-01', [item({ id: 'plank', kind: 'time', share: 0.6, muscles: ['abdominals'], also: [] }, [{ secs: 60 }, { secs: 90 }])])]));
  assert.equal(holds[0].longest.value, 90);
  assert.equal(holds[0].best1rm, null);
  assert.equal(s.trendOf(holds[0]), holds[0].setPower);
});

test('a workout breaks a record when it beats every workout before it, never on an exercise’s first time', () => {
  const list = s.finished([
    workout('2026-10-01', [item({}, [{ kg: 60, reps: 5 }]), item({ id: 'row', muscles: ['lats'] }, [{ kg: 50, reps: 8 }])]),
    workout('2026-10-08', [item({}, [{ kg: 55, reps: 5 }])]),                                   // nothing beaten
    workout('2026-10-15', [item({}, [{ kg: 65, reps: 5 }]), item({ id: 'row', muscles: ['lats'] }, [{ kg: 50, reps: 10 }])]), // both beaten
    workout('2026-10-22', [item({}, [{ kg: 50, reps: 5 }])]),                                   // nothing beaten
    workout('2026-10-29', [item({ id: 'curl', muscles: ['biceps'] }, [{ kg: 20, reps: 10 }])]), // a first time
  ]);
  const broke = s.recordBreaks(list);
  const id = (day) => list.find((d) => d.day === day).w.id;
  assert.equal(broke.get(id('2026-10-01')), undefined);
  assert.equal(broke.get(id('2026-10-08')), undefined);
  assert.equal(broke.get(id('2026-10-15')), 2);
  assert.equal(broke.get(id('2026-10-22')), undefined);
  assert.equal(broke.get(id('2026-10-29')), undefined);
});

test('the wall of bests and the averages', () => {
  const list = s.finished([
    workout('2026-10-01', [item({}, [{ kg: 60, reps: 5 }])], { feel: 4 }),
    workout('2026-10-02', [item({}, [{ kg: 100, reps: 5 }])], { feel: 2, mins: 30 }),
    workout('2026-10-09', [item({}, [{ kg: 100, reps: 5 }, { kg: 100, reps: 5 }])], { mins: 120 }),
  ]);
  const wl = s.wall(list, s.moveStats(list), 1);
  assert.equal(wl.mostPower.power, 100);
  assert.equal(wl.longest.mins, 120);
  assert.equal(wl.bestWeek.power, 100);
  assert.equal(wl.busiestWeek.workouts, 2);
  assert.equal(wl.lifts.length, 1);
  const t = s.totals(list);
  assert.equal(t.workouts, 3);
  assert.equal(t.power, 180);
  assert.equal(t.feel, 3);
  const a = s.averages(t);
  assert.equal(a.power, 60);
  assert.equal(a.mins, 70);
  assert.equal(a.perMin, 180 / 210);
  assert.equal(s.averages(s.totals([])), null);
  assert.equal(s.metShare(t), null);
});

test('when you train, and what the power came from', () => {
  const list = s.finished([
    workout('2026-11-02', [item({}, [{ kg: 100, reps: 5 }])], { hour: 7 }),  // Monday, 6–9
    workout('2026-11-09', [item({ kind: 'cardio', met: 8, muscles: [] }, [{ secs: 1800 }])], { hour: 7, bw: 75 }),
    workout('2026-11-08', [item({}, [{ kg: 10, reps: 1 }])], { hour: 22 }),  // Sunday, 21–24
  ]);
  const { heat, max } = s.whenHeat(list);
  assert.equal(heat[0][2], 2);
  assert.equal(heat[6][7], 1);
  assert.equal(max, 2);
  const k = s.kindPower(list);
  assert.equal(k.weight, 51);
  assert.equal(k.cardio, 8 * 75 * 30 / 30);
});

test('body weight: weigh-ins, with the workouts’ weights filling in until there are two', () => {
  const list = s.finished([workout('2026-10-05', [], { bw: 81 }), workout('2026-10-12', [], { bw: 80 })]);
  const span = { start: '2026-10-01', end: '2026-10-31' };
  const w = (day, kg, updated = 1) => ({ id: day + kg, day, kg, created: 1, updated });
  assert.deepEqual(s.weightSeries([], list, span).map((p) => [p.day, p.kg, p.logged]), [['2026-10-05', 81, false], ['2026-10-12', 80, false]]);
  assert.deepEqual(s.weightSeries([w('2026-10-12', 79)], list, span).map((p) => [p.day, p.kg, p.logged]), [['2026-10-05', 81, false], ['2026-10-12', 79, true]]);
  const two = s.weightSeries([w('2026-10-02', 82), w('2026-10-20', 79, 1), w('2026-10-20', 78.5, 2), w('2026-09-01', 90)], list, span);
  assert.deepEqual(two.map((p) => [p.day, p.kg]), [['2026-10-02', 82], ['2026-10-20', 78.5]]);
});
