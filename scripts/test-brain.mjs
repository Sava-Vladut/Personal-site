import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: new URL('../src/lib/brain.ts', import.meta.url).pathname });
const { output } = await bundle.generate({ format: 'esm' });
const { readBrain, RANGES, SPAN, shiftLine } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
await bundle.close();

const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const entry = (n, emotion) => ({ id: `${n}-${emotion}`, kind: 'note', title: '', text: '', emotions: [emotion], intensity: 3, date: key(ago(n)), time: ago(n).getTime(), people: [] });

test('the stretch is as long as asked and can end in the past', () => {
  const all = [entry(1, 'joy'), entry(60, 'fear'), entry(120, 'sadness')];
  const now = readBrain(all);
  assert.equal(now.span, SPAN);
  assert.equal(now.days.length, SPAN);
  assert.equal(now.entries, 1);
  assert.equal(now.lead, 'joy');

  assert.equal(readBrain(all, 91).entries, 2);

  const then = readBrain(all, SPAN, key(ago(55)));
  assert.equal(then.end, key(ago(55)));
  assert.equal(then.entries, 1);
  assert.equal(then.lead, 'fear');
});

test('the ranges are 7 weeks, 13 weeks and everything', () => {
  assert.deepEqual(RANGES.map((r) => r[2]), [49, 91, null]);
});

test('older entries fade more in a longer stretch only as slowly as the stretch is long', () => {
  const all = [entry(40, 'fear'), entry(2, 'joy')];
  const short = readBrain(all, 49), long = readBrain(all, 91);
  assert.ok(short.regions.joy.share > long.regions.joy.share);
});

test('a region is compared with the stretch before when asked, and only when that has entries', () => {
  const all = [entry(3, 'joy'), entry(4, 'joy'), entry(5, 'joy'), entry(60, 'fear'), entry(61, 'fear'), entry(62, 'fear')];
  const plain = readBrain(all, SPAN);
  assert.equal(plain.regions.joy.before, null);
  const cmp = readBrain(all, SPAN, undefined, true);
  assert.equal(cmp.regions.joy.before, 0);
  assert.equal(cmp.regions.fear.before, 1);
  assert.match(shiftLine(cmp.regions.joy, cmp.span), /^Up/);
  assert.equal(readBrain([entry(3, 'joy')], SPAN, undefined, true).regions.joy.before, null);
});

/* ---------- the intro's brain in three dimensions ---------- */

const bundle3 = await rolldown({ input: new URL('../src/lib/brain3d.ts', import.meta.url).pathname });
const { output: output3 } = await bundle3.generate({ format: 'esm' });
const { buildBrain, insideBrain, CORTEX, CEREBELLUM, STEM } = await import('data:text/javascript;base64,' + Buffer.from(output3[0].code).toString('base64'));
await bundle3.close();
const shape = await import('data:text/javascript;base64,' + Buffer.from((await (await rolldown({ input: new URL('../src/lib/brainShape.ts', import.meta.url).pathname })).generate({ format: 'esm' })).output[0].code).toString('base64'));

test('the 3D brain is about as many points as asked, all its parts, and the same every time', () => {
  const b = buildBrain(12000);
  assert.ok(b.n > 8000 && b.n < 12000, `${b.n} points`);
  const parts = [0, 0, 0];
  for (const p of b.part) parts[p]++;
  assert.ok(parts[CORTEX] > parts[CEREBELLUM] && parts[CEREBELLUM] > parts[STEM] && parts[STEM] > 0, String(parts));
  const again = buildBrain(12000);
  assert.deepEqual(again.pos, b.pos);
});

test('the 3D brain has two matching hemispheres and every region shows on its surface', () => {
  const b = buildBrain(12000);
  let left = 0, right = 0;
  for (let i = 0; i < b.n; i++) {
    const z = b.pos[i * 3 + 2];
    if (z > 0.1) left++;
    else if (z < -0.1) right++;
  }
  assert.ok(Math.abs(left - right) / (left + right) < 0.05, `${left} vs ${right}`);
  const seen = new Set(b.region);
  shape.PATCHES.forEach((_, r) => assert.ok(seen.has(r), `${shape.PATCHES[r].world} has points`));
  // and each region's middle (where sparks run between) is on the +z side, near its patch in the side view
  shape.PATCHES.forEach((p, r) => {
    assert.ok(b.centres[r * 3 + 2] > 0);
    assert.ok(Math.abs(b.centres[r * 3] + 0.76 - p.x) < 0.25, p.world);
  });
});

test('the 3D brain faces outward: a step along each point\'s direction leaves it, a step back stays in', () => {
  const b = buildBrain(12000);
  let out = 0, inside = 0;
  for (let i = 0; i < b.n; i++) {
    const [x, y, z] = [b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2]];
    const [nx, ny, nz] = [b.nrm[i * 3], b.nrm[i * 3 + 1], b.nrm[i * 3 + 2]];
    assert.ok(Math.abs(Math.hypot(nx, ny, nz) - 1) < 1e-3);
    if (!insideBrain(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03)) out++;
    if (insideBrain(x - nx * 0.03, y - ny * 0.03, z - nz * 0.03)) inside++;
  }
  assert.ok(out / b.n > 0.9, `${(out / b.n).toFixed(3)} face out`);
  assert.ok(inside / b.n > 0.98, `${(inside / b.n).toFixed(3)} sit on the surface`);
});
