import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// lib/scrub.ts: a set's numbers dragged sideways (steps, flicks, the ends).
async function load(file) {
  const bundle = await rolldown({ input: file });
  let code = (await bundle.generate({ format: 'esm', codeSplitting: false })).output[0].code;
  await bundle.close();
  code = code.replace(/export\s*\{([^}]*)\};?\s*$/, (_, list) => `return { ${list.split(',').map((s) => s.trim()).filter(Boolean)
    .map((s) => { const [local, name = local] = s.split(/\s+as\s+/); return `${name}: ${local}`; }).join(', ')} };`);
  return vm.runInNewContext(`(() => {\n${code}\n})()`, { Math, Number });
}
const s = await load('src/lib/scrub.ts');

test('a step is a rep, a plate, five seconds, half a minute or 100 m', () => {
  assert.equal(s.stepOf('reps'), 1);
  for (const e of ['barbell', 'ezbar', 'machine', 'cable']) assert.equal(s.stepOf('kg', e), 2.5, e);
  for (const e of ['dumbbell', 'kettlebell']) assert.equal(s.stepOf('kg', e), 2, e);
  for (const e of ['body', 'bands', 'other', undefined]) assert.equal(s.stepOf('kg', e), 1, String(e));
  assert.equal(s.stepOf('secs'), 5);
  assert.equal(s.stepOf('mins'), 0.5);
  assert.equal(s.stepOf('km'), 0.1);
  // a few pixels a step, a little more for reps
  for (const f of ['reps', 'kg', 'secs', 'mins', 'km']) assert.ok(s.PX[f] >= 12 && s.PX[f] <= 16, f);
  assert.equal(s.PX.reps, 16);
});

test('steps count from where the drag started, kept to two decimals and inside 0 and the most', () => {
  assert.equal(s.stepped(20, 3, 2.5, 1000), 27.5);
  assert.equal(s.stepped(0, 3, 0.1, 1000), 0.3);
  assert.equal(s.stepped(1.2, -4, 0.1, 1000), 0.8);
  assert.equal(s.stepped(5, -9, 1, 1000), 0);
  assert.equal(s.stepped(998, 3, 1, 1000), 1000);
  // the start: the number, else last time's, else nothing
  assert.equal(s.startOf(12, 10), 12);
  assert.equal(s.startOf(null, 10), 10);
  assert.equal(s.startOf(null, null), 0);
  assert.equal(s.startOf(0, 10), 0);
  assert.deepEqual([...s.bounds(5, 1, 10)], [-5, 5]);
  assert.deepEqual([...s.bounds(22, 2.5, 1000)], [-8, 391]);
  assert.deepEqual([...s.bounds(0.3, 0.1, 1000)], [-3, 9997]);
});

test('a slow drag is a step every few pixels, a flick counts three times', () => {
  const t = s.tracker(16);
  t.start(100, 0);
  // the first move is never a flick: 50 px is 3 steps
  assert.equal(t.move(150, 2), 3);
  // slow: 16 px over 100 ms
  const slow = s.tracker(16);
  slow.start(0, 0);
  let n = 0;
  for (let i = 1; i <= 10; i++) n = slow.move(i * 8, i * 50);
  assert.equal(n, 5);
  // fast: 20 px every 8 ms (2.5 px/ms) for 6 moves, after the first two
  const fast = s.tracker(16);
  fast.start(0, 0);
  fast.move(20, 8);
  fast.move(40, 16);
  for (let i = 3; i <= 8; i++) n = fast.move(i * 20, i * 8);
  assert.ok(n > 160 / 16, `a flick goes further than its distance (${n})`);
  // back the other way
  const back = s.tracker(14);
  back.start(200, 0);
  assert.equal(back.move(200 - 29, 400), -2);
});

test('a drag stops at the ends, and turning back moves the number at once', () => {
  const t = s.tracker(10);
  t.start(0, 0);
  assert.equal(t.move(500, 1000, -2, 3), 3);
  assert.equal(t.move(490, 1100, -2, 3), 2);
  assert.equal(t.move(-500, 5000, -2, 3), -2);
  assert.equal(t.move(-499, 6000, -2, 3), -1);
  assert.equal(t.move(-489, 7000, -2, 3), 0);
});

test('the far end is half again the biggest of the number, last time and a usual amount', () => {
  assert.equal(s.scaleEnd(null, null, 'reps'), 23);
  assert.equal(s.scaleEnd(30, 12, 'reps'), 45);
  assert.equal(s.scaleEnd(null, 100, 'kg', 1000, 2.5), 150);
  assert.equal(s.scaleEnd(22, null, 'kg', 1000, 2.5), 60);
  assert.equal(s.scaleEnd(null, null, 'secs'), 90);
  assert.equal(s.scaleEnd(null, null, 'mins'), 45);
  assert.equal(s.scaleEnd(null, null, 'km'), 7.5);
  assert.equal(s.scaleEnd(900, null, 'kg', 1000, 2.5), 1000);
});
