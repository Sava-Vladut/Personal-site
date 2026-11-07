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
const plain = (x) => JSON.parse(JSON.stringify(x));

/** 33 pose points, all hidden but the ones given (in pixels). */
function pose(points) {
  const marks = Array.from({ length: 33 }, () => ({ ...hidden }));
  for (const [i, [x, y, v = 0.95]] of Object.entries(points)) marks[i] = { x: x / W, y: y / H, visibility: v };
  return marks;
}

/**
 * A body seen from its left side, lying across the frame with its hands on the floor under the shoulder. `elbow` is the
 * angle at the elbow. `sag` drops the hips by that many pixels and `pike` raises them; `knee` bends the legs at the knee
 * (180 is straight); `upright` stands the body up instead.
 */
function side(elbow, { sag = 0, pike = 0, knee = 180, upright = false } = {}) {
  if (upright) return pose({ 11: [500, 200], 13: [500, 360], 15: [500, 520], 23: [500, 520], 25: [500, 720], 27: [500, 900] });
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
  const hip = [600, sh[1] + 30 + sag - pike];
  const kn = [800, sh[1] + 60];
  // the shin goes on from the knee, turned down toward the floor by however much the knee bends
  const dx = kn[0] - hip[0], dy = kn[1] - hip[1], len = Math.hypot(dx, dy);
  const turn = ((180 - knee) * Math.PI) / 180;
  const ankle = [kn[0] + (150 * (dx * Math.cos(turn) - dy * Math.sin(turn))) / len, kn[1] + (150 * (dx * Math.sin(turn) + dy * Math.cos(turn))) / len];
  return pose({ 11: sh, 13: el, 15: hand, 23: hip, 25: kn, 27: ankle, 12: [sh[0] + 4, sh[1] - 2, 0.4] });
}

/**
 * A body seen from the front, head toward the camera: shoulders apart, hands below them on the floor, hips hidden.
 * `lift` is how far the hands sit below the shoulders, in shoulder widths. `standing` puts the hips in view a long torso
 * below the shoulders; `near` scales the body as if it had come closer.
 */
function facing(lift, { standing = false, near = 1 } = {}) {
  const width = 200 * near, handsY = 800, cx = 500;
  const y = handsY - lift * width;
  const points = { 0: [cx, y - 60], 11: [cx - width / 2, y], 12: [cx + width / 2, y], 13: [cx - width / 2 - 20, y + 80], 14: [cx + width / 2 + 20, y + 80], 15: [cx - width / 2 + 10, handsY], 16: [cx + width / 2 - 10, handsY] };
  if (standing) Object.assign(points, { 23: [cx - 80, y + 2.2 * width], 24: [cx + 80, y + 2.2 * width] });
  return pose(points);
}

/** Feeds frames 1/30 s apart, from `t`; returns the cues heard, the time after the last frame and the last frame. */
function play(c, frames, t = 0) {
  const cues = [];
  let last;
  for (const f of frames) {
    t += 33;
    last = c.step(f, W, H, t);
    if (last.cue) cues.push(last.cue);
  }
  return { cues, t, last };
}

/** `n` frames easing from one value to another. */
const ease = (from, to, n = 12) => Array.from({ length: n }, (_, i) => from + ((to - from) * (i + 1)) / n);
const hold = (v, n = 20) => Array.from({ length: n }, () => v);
/** A full rep's elbow angles: down to `bottom` and back up. */
const rep = (bottom = 80) => [...ease(170, bottom), ...hold(bottom, 4), ...ease(bottom, 170), ...hold(170, 6)];
const reps = (n, bottom) => Array.from({ length: n }, () => rep(bottom)).flat();
/** A plank held long enough to start counting, then `n` reps, from the side. */
const set = (n, opts) => [...hold(170), ...reps(n)].map((a) => side(a, opts));

test('the elbow angle is measured between shoulder and wrist', () => {
  assert.equal(Math.round(p.angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })), 90);
  assert.equal(Math.round(p.angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })), 180);
  for (const a of [70, 90, 120, 170]) {
    const m = side(a);
    const at = (i) => ({ x: m[i].x * W, y: m[i].y * H });
    assert.ok(Math.abs(p.angle(at(11), at(13), at(15)) - a) < 0.5, `the made-up side view bends to ${a}°`);
  }
  const m = side(170, { knee: 90 });
  const at = (i) => ({ x: m[i].x * W, y: m[i].y * H });
  assert.ok(Math.abs(p.angle(at(23), at(25), at(27)) - 90) < 0.5, 'and its knee to 90°');
});

test('from the side, full reps count once each after a plank is held', () => {
  const c = p.createCounter();
  const { cues, last } = play(c, [...hold(170), ...rep(), ...rep(85), ...rep(70)].map((a) => side(a)));
  assert.equal(last.count, 3);
  assert.deepEqual(plain(last.sets), [3]);
  assert.deepEqual(cues, ['rep', 'rep', 'rep']);
  assert.equal(last.view, 'side');
  assert.equal(last.phase, 'up');
});

test('nothing counts before the plank has been held a moment', () => {
  const c = p.createCounter();
  // straight into a rep: the first few frames at the top are too short to start counting
  const { last } = play(c, [...hold(170, 6), ...ease(170, 80), ...ease(80, 170)].map((a) => side(a)));
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

test('a rep with sagging hips does not count, and is not a rest', () => {
  const c = p.createCounter();
  const angles = [...hold(170), ...ease(170, 80), ...hold(80, 6), ...ease(80, 170), ...hold(170)];
  const frames = angles.map((a, i) => side(a, { sag: i > 25 && i < 50 ? 140 : 0 }));
  const { cues, last } = play(c, frames);
  assert.equal(last.count, 0);
  assert.deepEqual(cues, ['hips']);
  assert.equal(last.view, 'side');
});

test('standing up and bending the arms never counts', () => {
  const c = p.createCounter();
  const { last } = play(c, hold(side(170, { upright: true }), 60));
  assert.equal(last.count, 0);
  assert.equal(last.phase, 'ready');
});

test('getting up after a set rests: nothing counts until the next plank, which starts set two', () => {
  const c = p.createCounter();
  let r = play(c, set(3));
  assert.equal(r.last.count, 3);
  // down to the knees and sitting back (hips up toward the heels), the arms bending and straightening on the way
  const getUp = [...ease(170, 90, 8).map((a, i) => side(a, { knee: 180 - 10 * i, pike: 25 * i })), ...ease(90, 170, 8).map((a) => side(a, { knee: 100, pike: 200 })), ...hold(side(170, { knee: 100, pike: 200 }), 20)];
  r = play(c, getUp, r.t);
  assert.equal(r.last.count, 3);
  assert.equal(r.last.phase, 'rest');
  assert.deepEqual(r.cues, ['rest']);
  // standing about, arms moving
  r = play(c, [...hold(side(170, { upright: true }), 30), ...hold(side(90, { upright: true }), 10), ...hold(side(170, { upright: true }), 10)], r.t);
  assert.equal(r.last.count, 3);
  assert.equal(r.last.phase, 'rest');
  assert.ok(r.last.restSince > 0, 'the rest has a start, for its timer');
  // back into a plank: two more, as a second set
  r = play(c, set(2), r.t);
  assert.equal(r.last.count, 5);
  assert.deepEqual(plain(r.last.sets), [3, 2]);
  assert.equal(r.last.restSince, null);
});

test('dropping to the knees from a full plank is a rest, even mid-rep', () => {
  const c = p.createCounter();
  let r = play(c, set(2));
  // halfway down, the knees go to the floor, then the arms push back up
  const frames = [...ease(170, 90, 8).map((a, i) => side(a, { knee: 180 - 11 * i })), ...ease(90, 170, 8).map((a) => side(a, { knee: 95 })), ...hold(side(170, { knee: 95 }), 14)];
  r = play(c, frames, r.t);
  assert.equal(r.last.count, 2);
  assert.equal(r.last.phase, 'rest');
});

test('lying on the floor between sets, then pushing up, is not a rep', () => {
  const c = p.createCounter();
  let r = play(c, set(2));
  // all the way down, and a long lie on the floor
  r = play(c, [...ease(170, 60), ...hold(60, 110)].map((a) => side(a)), r.t);
  assert.equal(r.last.phase, 'rest');
  r = play(c, [...ease(60, 170), ...hold(170, 5)].map((a) => side(a)), r.t);
  assert.equal(r.last.count, 2);
  assert.deepEqual(plain(r.last.sets), [2]);
});

test('pushing up off the floor with the hips left down is not a rep', () => {
  const c = p.createCounter();
  let r = play(c, set(1));
  // down quickly, then the chest comes up first while the hips stay on the floor
  r = play(c, [...ease(170, 70).map((a) => side(a)), ...ease(70, 170).map((a, i) => side(a, { sag: Math.min(240, 24 * (i + 1)) }))], r.t);
  assert.equal(r.last.count, 1);
});

test('knee push-ups count, since the set started on the knees', () => {
  const c = p.createCounter();
  const { last } = play(c, set(3, { knee: 100 }));
  assert.equal(last.count, 3);
});

test('a glitch of a frame or two mid-rep does not lose the rep', () => {
  const c = p.createCounter();
  const frames = [...hold(170), ...rep()].map((a) => side(a));
  frames.splice(30, 2, side(170, { upright: true }), side(170, { upright: true }));
  const { last } = play(c, frames);
  assert.equal(last.count, 1);
});

test('losing sight of you for a moment keeps counting; for longer, it is a rest', () => {
  const c = p.createCounter();
  let r = play(c, set(1));
  r = play(c, hold(undefined, 10), r.t); // a third of a second
  assert.equal(r.last.view, 'side');
  r = play(c, rep().map((a) => side(a)), r.t);
  assert.equal(r.last.count, 2);
  r = play(c, hold(undefined, 40), r.t); // over a second
  assert.equal(r.last.phase, 'rest');
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

/** From the front: a plank held, then `n` reps. */
const frontSet = (n) => [...hold(1.6), ...Array.from({ length: n }, () => [...ease(1.6, 0.4), ...hold(0.4, 4), ...ease(0.4, 1.6), ...hold(1.6, 6)]).flat()].map((l) => facing(l));

test('from the front, reps count from how far the shoulders come down to the hands', () => {
  const c = p.createCounter();
  const { cues, last } = play(c, frontSet(2));
  assert.equal(last.view, 'front');
  assert.equal(last.count, 2);
  assert.deepEqual(cues, ['rep', 'rep']);
});

test('from the front, a shallow dip is told to go lower', () => {
  const c = p.createCounter();
  const lifts = [...hold(1.6), ...ease(1.6, 1.0), ...ease(1.0, 1.6), ...hold(1.6, 6)];
  const { cues, last } = play(c, lifts.map((l) => facing(l)));
  assert.equal(last.count, 0);
  assert.deepEqual(cues, ['shallow']);
});

test('from the front, standing up rests, and arms moving while standing never count', () => {
  const c = p.createCounter();
  let r = play(c, frontSet(2));
  const standing = [...hold(1.8, 25), ...ease(1.8, 0.3), ...ease(0.3, 1.8), ...ease(1.8, 0.3), ...ease(0.3, 1.8)].map((l) => facing(l, { standing: true }));
  r = play(c, standing, r.t);
  assert.equal(r.last.count, 2);
  assert.equal(r.last.phase, 'rest');
  r = play(c, frontSet(1), r.t);
  assert.deepEqual(plain(r.last.sets), [2, 1]);
});

test('from the front, coming up close to the phone rests', () => {
  const c = p.createCounter();
  let r = play(c, frontSet(1));
  r = play(c, [...ease(1, 1.8, 8).map((near) => facing(1.6, { near })), ...ease(1.6, 0.4).map((l) => facing(l, { near: 1.8 })), ...ease(0.4, 1.6).map((l) => facing(l, { near: 1.8 }))], r.t);
  assert.equal(r.last.count, 1);
  assert.equal(r.last.phase, 'rest');
});

test('start over goes back to zero', () => {
  const c = p.createCounter();
  const r = play(c, set(1));
  assert.equal(r.last.count, 1);
  c.reset();
  assert.equal(c.count, 0);
  assert.deepEqual(plain(c.sets), []);
  assert.equal(play(c, rep().map((a) => side(a)), r.t).last.count, 1);
});

test('the camera is offered for push-ups, not for other moves or handstands', () => {
  const m = (id, name = id, kind = 'body') => ({ id, name, kind });
  for (const ok of [m('Pushups'), m('Push-Up_Wide', 'Push-Up Wide'), m('mm_Knee_Push-Up', 'Knee Push-Up'), m('myabc', 'My push ups')]) assert.ok(p.countsPushups(ok), ok.id);
  for (const no of [m('Handstand_Push-Ups', 'Handstand Push-Ups'), m('Push_Press', 'Push Press', 'weight'), m('Pullups'), m('Plyo_Kettlebell_Pushups', 'Plyo Kettlebell Pushups', 'weight')]) assert.ok(!p.countsPushups(no), no.id);
});

test('a workout’s push-up sets are read out of it, done ones only', () => {
  const item = (id, kind, sets) => ({ move: { id, name: id, kind }, sets: sets.map(([reps, done]) => ({ reps, done })) });
  const w = { items: [item('Pushups', 'body', [[15, true], [12, true], [10, false]]), item('Bench', 'weight', [[8, true]]), item('Push-Up_Wide', 'body', [[9, true], [null, true]])] };
  assert.deepEqual(plain(p.pushupReps(w)), [15, 12, 9]);
});
