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
