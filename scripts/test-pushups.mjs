import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// lib/pushups.ts: counting push-ups from pose points, fed made-up frames of a body seen from the side and from the front.
async function load(file) {
  const bundle = await rolldown({ input: file });
  let code = (await bundle.generate({ format: 'esm', codeSplitting: false })).output[0].code;
  await bundle.close();
  code = code.replace(/export\s*\{([^}]*)\};?\s*$/, (_, list) => `return { ${list.split(',').map((s) => s.trim()).filter(Boolean)
    .map((s) => { const [local, name = local] = s.split(/\s+as\s+/); return `${name}: ${local}`; }).join(', ')} };`);
  return vm.runInNewContext(`(() => {\n${code}\n})()`, { Math });
}
const p = await load('src/lib/pushups.ts');
const W = 1000, H = 1000;
const hidden = { x: 0.5, y: 0.5, visibility: 0.1 };

/** 33 pose points, all hidden but the ones given (in pixels). */
function pose(points) {
  const marks = Array.from({ length: 33 }, () => ({ ...hidden }));
  for (const [i, [x, y, v = 0.95]] of Object.entries(points)) marks[i] = { x: x / W, y: y / H, visibility: v };
  return marks;
}

/**
 * A body seen from its left side, lying across the frame with its hands on the floor under the shoulder. `elbow` is the
 * angle at the elbow; `sag` drops the hips by that many pixels; `upright` stands the body up instead.
 */
function side(elbow, { sag = 0, upright = false } = {}) {
  const arm = 160; // upper arm and forearm
  const floor = 700;
  // the hand stays on the floor; the shoulder sits above it at the height the elbow's bend allows
  const reach = Math.sqrt(2 * arm * arm * (1 - Math.cos((elbow * Math.PI) / 180)));
  const sh = [300, floor - reach];
  const hand = [300, floor];
  // the elbow out to the side of the line between shoulder and hand
  const half = reach / 2;
  const out = Math.sqrt(Math.max(0, arm * arm - half * half));
  const el = [300 + out, floor - half];
  if (upright) return pose({ 11: [500, 200], 13: [500, 360], 15: [500, 520], 23: [500, 520], 25: [500, 720], 27: [500, 900] });
  const hip = [600, sh[1] + 30 + sag];
  const knee = [800, sh[1] + 60];
  const ankle = [950, sh[1] + 80];
  return pose({ 11: sh, 13: el, 15: hand, 23: hip, 25: knee, 27: ankle, 12: [sh[0] + 4, sh[1] - 2, 0.4] });
}

/**
 * A body seen from the front, head toward the camera: shoulders apart, hands below them on the floor, hips hidden.
 * `lift` is how far the hands sit below the shoulders, in shoulder widths.
 */
function facing(lift) {
  const width = 200, handsY = 800;
  const y = handsY - lift * width;
  return pose({ 0: [500, y - 60], 11: [400, y], 12: [600, y], 13: [380, y + 80], 14: [620, y + 80], 15: [390, handsY], 16: [610, handsY] });
}

/** Feeds frames 1/30 s apart, from `t`; returns the counter, the cues heard and the time after the last frame. */
function play(c, frames, t = 0) {
  const cues = [];
  for (const f of frames) {
    t += 33;
    const out = c.step(f, W, H, t);
    if (out.cue) cues.push(out.cue);
  }
  return { cues, t, last: c.step(frames.at(-1), W, H, t + 33) };
}

/** `n` frames easing from one value to another. */
const ease = (from, to, n = 12) => Array.from({ length: n }, (_, i) => from + ((to - from) * (i + 1)) / n);
const hold = (v, n = 15) => Array.from({ length: n }, () => v);
/** A full rep's elbow angles: down to `bottom` and back up. */
const rep = (bottom = 80) => [...ease(170, bottom), ...hold(bottom, 4), ...ease(bottom, 170), ...hold(170, 6)];

test('the elbow angle is measured between shoulder and wrist', () => {
  assert.equal(Math.round(p.angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })), 90);
  assert.equal(Math.round(p.angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })), 180);
  for (const a of [70, 90, 120, 170]) {
    const m = side(a);
    const at = (i) => ({ x: m[i].x * W, y: m[i].y * H });
    assert.ok(Math.abs(p.angle(at(11), at(13), at(15)) - a) < 0.5, `the made-up side view bends to ${a}°`);
  }
});

test('from the side, full reps count once each after a plank is held', () => {
  const c = p.createCounter();
  const { cues, last } = play(c, [...hold(170, 15), ...rep(), ...rep(85), ...rep(70)].map((a) => side(a)));
  assert.equal(last.count, 3);
  assert.deepEqual(cues, ['rep', 'rep', 'rep']);
  assert.equal(last.view, 'side');
  assert.equal(last.phase, 'up');
});

test('nothing counts before the plank has been held a moment', () => {
  const c = p.createCounter();
  // straight into a rep: the first few frames at the top are too short to start counting
  const { last } = play(c, [...hold(170, 3), ...ease(170, 80), ...ease(80, 170)].map((a) => side(a)));
  assert.equal(last.count, 0);
});

test('a rep cut short is told to go lower and not counted', () => {
  const c = p.createCounter();
  const { cues, last } = play(c, [...hold(170), ...rep(115), ...rep(80)].map((a) => side(a)));
  assert.equal(last.count, 1);
  assert.deepEqual(cues, ['shallow', 'rep']);
});

test('small wobbles at the top are neither reps nor cut-short reps', () => {
  const c = p.createCounter();
  const { cues, last } = play(c, [...hold(170), ...ease(170, 140, 6), ...ease(140, 170, 6), ...hold(170)].map((a) => side(a)));
  assert.equal(last.count, 0);
  assert.deepEqual(cues, []);
});

test('a rep with sagging hips does not count', () => {
  const c = p.createCounter();
  const angles = [...hold(170), ...ease(170, 80), ...hold(80, 6), ...ease(80, 170), ...hold(170)];
  const frames = angles.map((a, i) => side(a, { sag: i > 15 && i < 40 ? 140 : 0 }));
  const { cues, last } = play(c, frames);
  assert.equal(last.count, 0);
  assert.deepEqual(cues, ['hips']);
});

test('standing up and bending the arms never counts', () => {
  const c = p.createCounter();
  const { last } = play(c, hold(side(170, { upright: true }), 60));
  assert.equal(last.count, 0);
  assert.equal(last.phase, 'ready');
});

test('getting up mid-set stops counting until the next plank', () => {
  const c = p.createCounter();
  let r = play(c, [...hold(170), ...rep()].map((a) => side(a)));
  assert.equal(r.last.count, 1);
  r = play(c, hold(side(170, { upright: true }), 60), r.t);
  assert.equal(r.last.phase, 'ready');
  assert.equal(r.last.view, null);
  r = play(c, [...hold(170), ...rep()].map((a) => side(a)), r.t);
  assert.equal(r.last.count, 2);
});

test('losing sight of you for a moment keeps counting; for longer, it waits for a new plank', () => {
  const c = p.createCounter();
  let r = play(c, [...hold(170), ...rep()].map((a) => side(a)));
  r = play(c, hold(undefined, 10), r.t); // a third of a second
  assert.equal(r.last.view, 'side');
  r = play(c, [...rep()].map((a) => side(a)), r.t);
  assert.equal(r.last.count, 2);
  r = play(c, hold(undefined, 40), r.t); // over a second
  assert.equal(r.last.phase, 'unseen');
  assert.equal(r.last.view, null);
});

test('someone half in view is asked to show more of themselves', () => {
  const c = p.createCounter();
  const out = c.step(pose({ 11: [300, 300], 13: [350, 400] }), W, H, 0);
  assert.equal(out.phase, 'partial');
  assert.equal(c.step(pose({}), W, H, 33).phase, 'unseen');
});

test('depth reads 0 at the top and 1 at the bottom', () => {
  const c = p.createCounter();
  const r = play(c, hold(side(170), 20));
  assert.equal(r.last.depth, 0);
  const deep = play(c, hold(side(100), 30), r.t).last.depth;
  assert.ok(deep > 0.9 && deep < 1.1, String(deep));
});

test('from the front, reps count from how far the shoulders come down to the hands', () => {
  const c = p.createCounter();
  const lifts = [...hold(1.6), ...ease(1.6, 0.4), ...hold(0.4, 4), ...ease(0.4, 1.6), ...hold(1.6, 6),
    ...ease(1.6, 0.5), ...ease(0.5, 1.6), ...hold(1.6, 6)];
  const { cues, last } = play(c, lifts.map(facing));
  assert.equal(last.view, 'front');
  assert.equal(last.count, 2);
  assert.deepEqual(cues, ['rep', 'rep']);
});

test('from the front, a shallow dip is told to go lower', () => {
  const c = p.createCounter();
  const lifts = [...hold(1.6), ...ease(1.6, 1.0), ...ease(1.0, 1.6), ...hold(1.6, 6)];
  const { cues, last } = play(c, lifts.map(facing));
  assert.equal(last.count, 0);
  assert.deepEqual(cues, ['shallow']);
});

test('reset goes back to zero', () => {
  const c = p.createCounter();
  const r = play(c, [...hold(170), ...rep()].map((a) => side(a)));
  assert.equal(r.last.count, 1);
  c.reset();
  assert.equal(c.count, 0);
  assert.equal(play(c, rep().map((a) => side(a)), r.t).last.count, 1);
});

test('the camera is offered for push-ups, not for other moves or handstands', () => {
  const m = (id, name = id, kind = 'body') => ({ id, name, kind });
  for (const ok of [m('Pushups'), m('Push-Up_Wide', 'Push-Up Wide'), m('mm_Knee_Push-Up', 'Knee Push-Up'), m('myabc', 'My push ups')]) assert.ok(p.countsPushups(ok), ok.id);
  for (const no of [m('Handstand_Push-Ups', 'Handstand Push-Ups'), m('Push_Press', 'Push Press', 'weight'), m('Pullups'), m('Plyo_Kettlebell_Pushups', 'Plyo Kettlebell Pushups', 'weight')]) assert.ok(!p.countsPushups(no), no.id);
});
