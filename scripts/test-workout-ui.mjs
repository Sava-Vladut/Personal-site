import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after } from 'node:test';
import { JSDOM } from 'jsdom';
import { rolldown } from 'rolldown';

// The Workout pages and Insights › Workouts rendered in jsdom (a DOM in Node, no browser): the power gauge's drawing,
// the set scrubbers (dragging, keys, typing), the live workout's stage and rail on wide screens, ticking a set off (sparks,
// flying power), the target-met moment, the home screen, the plan editor, the exercise sheet and every Insights tab. The
// real store runs on an in-memory db seeded with a few workouts; PageHead, the sky, sync and the push-up camera are
// stubbed. How it all looks and moves still wants a look on a phone and a computer.
const root = new URL('..', import.meta.url).pathname;

let code = null;
async function bundle() {
  if (code) return code;
  const b = await rolldown({
    input: 'smoke:entry',
    logLevel: 'silent',
    transform: { jsx: { runtime: 'automatic', importSource: 'preact' } },
    resolve: { alias: { preact: root + 'node_modules/preact' } },
    plugins: [{
      name: 'smoke',
      resolveId(id, importer) {
        if (id === 'smoke:entry') return '\0smoke:entry';
        if (id.endsWith('.css')) return '\0css';
        if (id.includes('?worker')) return '\0worker';
        if (/\/db$/.test(id) && importer?.includes('/src/lib/')) return '\0db';
        if (/(^|\/)sync$/.test(id) && importer?.includes('/src/')) return '\0sync';
        if (/\/PageHead$/.test(id)) return '\0pagehead';
        if (/\/Sky$/.test(id)) return '\0sky';
        if (/\/PushupCounter$/.test(id)) return '\0pushups';
      },
      load(id) {
        if (id === '\0css' || id === '\0worker') return 'export default {};';
        if (id.endsWith('/src/lib/i18n.ts')) return readFileSync(id, 'utf8').replace("await import('../data/ro')", 'null');
        if (id === '\0db') return `
          const kv = globalThis.__KV ??= new Map();
          export const onBlocked = () => {};
          const done = (v) => Promise.resolve(v);
          export const db = {
            update: async (key, change) => { const next = change(kv.get(key)); kv.set(key, next); return next; },
            reconcileEntries: async () => {},
            all: () => done([]), put: () => done(), putMany: () => done(), del: () => done(), clear: () => done(),
            get: (key) => done(kv.get(key)), set: (key, v) => (kv.set(key, v), done()),
            photo: () => done(undefined), photos: () => done([]), photoIds: () => done([]), putPhotos: () => done(), delPhotos: () => done(), clearPhotos: () => done(),
          };`;
        if (id === '\0sync') return `
          import { observable } from '${root}src/lib/store.ts';
          const status$ = observable({ on: true, state: 'idle' });
          export const useSync = status$.use;
          export const syncNow = () => Promise.resolve();
          export const formatCode = (c) => c; export const parseCode = (c) => c; export const docJSON = () => ({});
          export const startSync = () => {}; export const stopSync = () => {}; export const initSync = () => {};
          export const joinSync = async () => {}; export const removeServerCopy = async () => {};`;
        if (id === '\0pagehead') return `
          import { h } from 'preact';
          export function PageHead({ title, subtitle, actions, back }) {
            return h('header', { class: 'page-head' }, back && h('button', { class: 'back' }, '<'), h('h1', { class: 'title' }, title), subtitle && h('p', { class: 'subtitle' }, subtitle), actions);
          }`;
        if (id === '\0sky') return `export function Sky() { return null; }`;
        if (id === '\0pushups') return `export function PushupCounter() { return null; } export const unlockSound = () => {};`;
        if (id === '\0smoke:entry') return `
          export { Workout } from '${root}src/views/Workout.tsx';
          export { Training } from '${root}src/views/Training.tsx';
          export * as power from '${root}src/components/power.tsx';
          export * as store from '${root}src/lib/store.ts';
          export { h, render } from 'preact';
          export { act } from 'preact/test-utils';`;
      },
    }],
  });
  code = (await b.generate({ format: 'iife', name: 'SM', codeSplitting: false })).output[0].code;
  await b.close();
  return code;
}

/* ---------- fixtures ---------- */

const DAY = 864e5;
const now = Date.now();
const set = (kg, reps, done = true, extra = {}) => ({ kg, reps, secs: null, km: null, tag: '', done, ...extra });
const snap = (id, name, kind, equip, muscles, more = {}) => ({ id, name, kind, equip, cat: 'strength', muscles, also: [], share: 0, met: 0, foot: false, ...more });
const PUSHUPS = snap('Pushups', 'Pushups', 'body', 'body', ['chest'], { share: 0.64, also: ['shoulders', 'triceps'] });
const CURLS = snap('Hammer_Curls', 'Hammer Curls', 'weight', 'dumbbell', ['biceps'], { also: ['forearms'] });
const BENCH = snap('Barbell_Bench_Press_-_Medium_Grip', 'Barbell Bench Press - Medium Grip', 'weight', 'barbell', ['chest'], { also: ['shoulders', 'triceps'] });
const PLANK = snap('Plank', 'Plank', 'time', 'body', ['abdominals'], { share: 0.5 });
const item = (move, sets, more = {}) => ({ move, sets, pair: move.equip === 'dumbbell', rest: 60, note: '', ...more });

function fixtures({ live = false, empty = false } = {}) {
  if (empty) return { routines: [], workouts: [], weighins: [] };
  const plan = {
    id: 'planpush', name: 'Push day', icon: 'barbell', target: 260, created: now - 30 * DAY, updated: now - 30 * DAY,
    items: [item(PUSHUPS, [set(null, 15, false), set(null, 15, false), set(null, 15, false), set(null, 15, false)]), item(CURLS, [set(10, 8, false), set(10, 8, false), set(10, 8, false)])],
  };
  const plan2 = { id: 'planlegs', name: 'Core', icon: 'flame', target: 80, created: now - 20 * DAY, updated: now - 20 * DAY, items: [item(PLANK, [{ ...set(null, null, false), secs: 60 }, { ...set(null, null, false), secs: 60 }]), item(BENCH, [set(40, 8, false), set(40, 8, false)])] };
  const past = (k, start, plan, items, target, feel = 4) => ({ id: 'w' + k, plan, name: plan === 'planpush' ? 'Push day' : 'Core', icon: 'barbell', target, bw: 75, start, end: start + 45 * 60e3, items, feel, note: '', created: start, updated: start });
  const workouts = [
    past(1, now - 1 * DAY, 'planpush', [item(PUSHUPS, [set(null, 19), set(null, 15), set(null, 12)]), item(CURLS, [set(10, 8), set(10, 8), set(12, 6)])], 260),
    past(2, now - 4 * DAY, 'planlegs', [item(PLANK, [{ ...set(null, null), secs: 60 }]), item(BENCH, [set(40, 8), set(45, 6)])], 80),
    past(3, now - 9 * DAY, 'planpush', [item(PUSHUPS, [set(null, 14), set(null, 12)]), item(CURLS, [set(8, 10), set(8, 10)])], 200),
  ];
  if (live) workouts.unshift({ id: 'wlive', plan: 'planpush', name: 'Push day', icon: 'barbell', target: 260, bw: 75, start: now - 12 * 60e3, end: null, items: [item(PUSHUPS, [set(null, 15), set(null, null, false), set(null, null, false), set(null, null, false)]), item(CURLS, [set(null, null, false), set(null, null, false), set(null, null, false)])], feel: 0, note: '', created: now, updated: now });
  return { routines: [plan, plan2], workouts, weighins: [{ id: 'wi1', day: new Date(now - 2 * DAY).toISOString().slice(0, 10), kg: 74.5, created: now, updated: now }] };
}

/* ---------- the page ---------- */

/** Every page opened, closed once the tests are done (their clocks and timers would keep Node running). */
const windows = [];
after(() => windows.forEach((w) => w.close()));

const WIDTH = /\((min|max)-width:\s*([\d.]+)px\)/g;

async function open(scenario = 'home', { width = 375, reduced = false } = {}) {
  const src = await bundle();
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'https://savavlad.com/#/workout', pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  windows.push(window);
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.error?.stack ?? e.message)));
  window.console.error = (...a) => errors.push(a.map(String).join(' '));
  window.innerWidth = width;
  window.matchMedia = (q) => {
    let matches = true;
    for (const [, kind, px] of q.matchAll(WIDTH)) matches &&= kind === 'min' ? width >= +px : width <= +px;
    if (/prefers-reduced-motion:\s*reduce/.test(q)) matches = reduced;
    else if (/hover:\s*hover/.test(q)) matches = width >= 1024;
    else if (/prefers-color-scheme/.test(q)) matches = false;
    return { matches, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
  };
  window.CSS ??= { supports: () => false, escape: (s) => s };
  window.IntersectionObserver = class { constructor(f) { this.f = f; } observe(el) { this.f([{ target: el, isIntersecting: true, intersectionRatio: 1 }], this); } unobserve() {} disconnect() {} takeRecords() { return []; } };
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.requestIdleCallback = (f) => setTimeout(() => f({ timeRemaining: () => 10, didTimeout: false }), 1);
  window.cancelIdleCallback = (id) => clearTimeout(id);
  window.scrollTo = () => {};
  window.Element.prototype.scrollIntoView = function () {};
  const anims = [];
  window.Element.prototype.animate = function (frames, opts) {
    const a = { el: this, frames, opts, onfinish: null, oncancel: null, cancel() { this.oncancel?.(); }, finish() { this.onfinish?.(); }, finished: Promise.resolve(), playState: 'running' };
    anims.push(a);
    setTimeout(() => a.onfinish?.(), typeof opts === 'number' ? opts : opts?.duration ?? 0);
    return a;
  };
  window.Element.prototype.getAnimations = function () { return []; };
  window.Element.prototype.setPointerCapture = function (id) { this.__cap = id; };
  window.Element.prototype.releasePointerCapture = function () { this.__cap = undefined; };
  window.Element.prototype.hasPointerCapture = function (id) { return this.__cap === id; };
  // a rough layout: everything has a box, so the bits that measure (sparks, flying power) run
  window.Element.prototype.getBoundingClientRect = function () { return { x: 10, y: 10, left: 10, top: 10, right: 110, bottom: 50, width: 100, height: 40, toJSON() {} }; };
  Object.defineProperty(window.navigator, 'vibrate', { value: () => true, configurable: true });
  window.HTMLElement.prototype.focus = function () { window.document.__focus = this; Object.defineProperty(window.document, 'activeElement', { value: this, configurable: true }); };
  window.__KV = new Map();
  const data = fixtures({ live: /^(live|finish|info)/.test(scenario) && scenario !== 'live-empty', empty: /empty/.test(scenario) && scenario !== 'live-empty' });
  if (scenario === 'live-empty') data.workouts.unshift({ id: 'wlive', plan: null, name: 'Morning workout', icon: 'barbell', target: 0, bw: 75, start: now - 60e3, end: null, items: [], feel: 0, note: '', created: now, updated: now });
  for (const [k, v] of Object.entries(data)) window.__KV.set(k, v);
  window.eval(src);
  const { Workout, Training, h, render, act, store } = window.SM;
  await store.init();
  const host = window.document.getElementById('app');
  const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
  const draw = (vnode) => act(() => render(vnode, host));
  const [page, tab] = scenario.split(':');
  if (page.startsWith('training')) draw(h(Training, { id: 'training', query: new URLSearchParams(tab ? 'tab=' + tab : page === 'training-exercise' ? 'tab=exercises' : page === 'training-workout' ? 'tab=history' : '') }));
  else draw(h(Workout, { id: 'workout', query: new URLSearchParams(scenario === 'plan' ? 'plan=planpush' : '') }));
  // the exercise database arrives by dynamic import
  for (let i = 0; i < 20; i++) { await wait(30); if (window.document.querySelector('.wo-thumb img, .tr-sheet, .tab-panel, .wo-plan-card, .wo-item, .wo-live-empty')) break; }
  await wait(80);
  const $ = (s) => window.document.querySelector(s), $$ = (s) => [...window.document.querySelectorAll(s)];
  const click = async (el) => { if (typeof el === 'string') el = $(el); if (!el) throw new Error('nothing to click'); await act(() => el.click()); await wait(); };
  if (scenario === 'finish') await click('.wo-finish');
  if (scenario === 'info') await click('.wo-thumb-btn, .wo-item-name');
  if (page === 'training-exercise') await click('.tab-panel button');
  if (page === 'training-workout') await click('.tab-panel button');
  await wait(120);
  const pointer = (el, type, x, y = 0, o = {}) => act(() => el.dispatchEvent(new window.PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: o.type ?? 'touch', isPrimary: true, button: 0, ...o })));
  const key = (el, k, o = {}) => act(() => el.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o })));
  return { window, document: window.document, host, $, $$, click, wait, act, pointer, key, errors, anims, store, power: window.SM.power };
}

/** Text that shouldn't be on a page: a number gone wrong, a value missing. */
function badText(document) {
  const text = document.body.textContent ?? '';
  return ['NaN', 'undefined', '[object', 'Infinity', 'null'].filter((w) => new RegExp(`\\b${w.replace('[', '\\[')}`).test(text));
}

/* ---------- the tests ---------- */

const SCREENS = ['home', 'home-empty', 'plan', 'live', 'live-empty', 'finish', 'info', 'training:overview', 'training:muscles',
  'training:exercises', 'training:history', 'training:bests', 'training-exercise', 'training-workout'];

test('every screen draws at a phone’s width and a computer’s, with nothing broken in its text', async () => {
  for (const scenario of SCREENS) for (const width of [375, 1300]) {
    const p = await open(scenario, { width });
    assert.deepEqual(p.errors, [], `${scenario} at ${width}`);
    assert.deepEqual(badText(p.document), [], `${scenario} at ${width}`);
  }
});

test('the gauge fills to the target, laps past it and turns its head to match', async () => {
  const p = await open('home-empty');
  const { h, render, act } = p.window.SM;
  const host = p.document.createElement('div');
  p.document.body.append(host);
  for (const [value, fill, lap, turn, cls] of [[0, 100, 100, 0, 'is-empty'], [130, 50, 100, 0.5, ''], [364, 0, 60, 1.4, 'is-over'], [598, 0, 0, 2, 'is-met']]) {
    await act(() => render(h(p.power.PowerGauge, { value, target: 260, size: 'l', ghost: 200 }), host));
    assert.equal(Math.round(+host.querySelector('.pw-gauge-fill').style.strokeDashoffset), fill, `fill at ${value}`);
    assert.equal(Math.round(+host.querySelector('.pw-gauge-lap').style.strokeDashoffset), lap, `lap at ${value}`);
    assert.equal(host.querySelector('.pw-gauge-head').style.transform, `rotate(${turn}turn)`);
    if (cls) assert.ok(host.querySelector('.pw-gauge').classList.contains(cls), cls);
  }
  // last time's notch, where 200 of 260 comes to
  assert.equal(host.querySelector('.pw-gauge-ghost').style.transform, `rotate(${200 / 260}turn)`);
});

test('sparks and flying power play, and not with reduced motion', async () => {
  const p = await open('home-empty');
  p.power.burst(p.document.body, { big: true });
  assert.equal(p.$$('.pw-spark').length, 16);
  const q = await open('home-empty', { reduced: true });
  q.power.burst(q.document.body);
  assert.equal(q.$$('.pw-spark').length, 0);
});

test('a live workout on a phone: a scrubber a number, a small gauge in the bar, no rail', async () => {
  const p = await open('live', { width: 375 });
  const open1 = p.$$('.wo-item').filter((c) => c.querySelector('.wo-sets'));
  assert.equal(open1.length, 1, 'only the exercise you’re on is open');
  assert.equal(p.$$('[role=slider]').length, open1[0].querySelectorAll('.wo-set:not(.wo-set-head)').length);
  assert.ok(p.$('.wo-bar .pw-gauge.is-s'));
  assert.equal(p.$$('.wo-rail, .is-stage').length, 0);
});

test('a live workout on a computer: one exercise on the stage, the rail, the cockpit', async () => {
  for (const width of [1100, 1300]) {
    const p = await open('live', { width });
    assert.equal(p.$$('.wo-item.is-stage').length, 1, `${width}`);
    assert.equal(p.$$('.wo-rail-step').length, p.$$('.wo-item').length);
    assert.equal(p.$$('.wo-rail-step [aria-current=step]').length, 1);
    assert.equal(p.$$('.wo-cockpit .pw-gauge.is-l').length, 1);
    const before = p.$('.wo-item.is-stage').id;
    await p.click('.wo-live-next');
    assert.notEqual(p.$('.wo-item.is-stage').id, before, 'Up next puts the next exercise on the stage');
  }
});

test('a scrubber: dragging sideways, not up and down, keys, and a tap to type', async () => {
  const p = await open('live', { width: 375 });
  const reps = () => p.$('.wo-set.is-next [role=slider][data-f=reps]');
  const now = () => reps().getAttribute('aria-valuenow');
  // empty, with last time's 15 faintly in it
  assert.equal(now(), null);
  assert.match(reps().getAttribute('aria-valuetext'), /15/);
  let el = reps();
  await p.pointer(el, 'pointerdown', 100, 0);
  await p.pointer(el, 'pointermove', 150, 0);
  await p.pointer(el, 'pointerup', 150, 0);
  await p.wait(30);
  assert.equal(now(), '18', '50px sideways is 3 reps on from last time');
  assert.match(reps().getAttribute('aria-valuetext'), /3 more than last time/);
  el = reps();
  await p.pointer(el, 'pointerdown', 100, 100);
  await p.pointer(el, 'pointermove', 104, 130);
  await p.pointer(el, 'pointermove', 140, 160);
  await p.pointer(el, 'pointerup', 140, 160);
  await p.wait(30);
  assert.equal(now(), '18', 'a scroll isn’t a drag');
  await p.key(reps(), 'ArrowRight');
  await p.wait(20);
  assert.equal(now(), '19');
  await p.key(reps(), 'ArrowLeft', { shiftKey: true });
  await p.wait(20);
  assert.equal(now(), '14');
  el = reps();
  await p.pointer(el, 'pointerdown', 50, 10, { type: 'mouse' });
  await p.pointer(el, 'pointerup', 51, 10, { type: 'mouse' });
  await p.wait(30);
  const input = p.$('.wo-set.is-next .wo-scrub input');
  assert.ok(input, 'a tap turns it into a field');
  assert.equal(p.document.activeElement, input);
  assert.deepEqual(p.errors, []);
});

test('ticking a set off: last time’s numbers, sparks, power flying to the gauge, the rest', async () => {
  const p = await open('live', { width: 375 });
  await p.click('.wo-set.is-next .wo-tick');
  await p.wait(40);
  assert.ok(p.$$('.pw-spark').length > 0);
  assert.equal(p.$$('.pw-fly').length, 1);
  assert.ok(p.$('.wo-rest'));
  const q = await open('live', { width: 375, reduced: true });
  await q.click('.wo-set.is-next .wo-tick');
  await q.wait(40);
  assert.equal(q.$$('.pw-spark, .pw-fly').length, 0, 'reduced motion: none of it');
});

test('the target met: only by a set ticked off just now, and once a workout', async () => {
  const p = await open('live', { width: 1300 });
  const target = async (n) => {
    if (!p.$('.wo-target-input')) await p.click('.wo-bar-more');
    const input = p.$('.wo-target-input');
    input.value = String(n);
    await p.act(() => input.dispatchEvent(new p.window.Event('input', { bubbles: true })));
    await p.wait(30);
  };
  await target(5);
  assert.equal(p.$$('.pw-cel').length, 0, 'lowering the target under the power plays nothing');
  await target(15);
  await p.click('.wo-set.is-next .wo-tick');
  await p.wait(60);
  assert.equal(p.$$('.pw-cel').length, 1);
  assert.ok(p.$('.pw-cel .pw-gauge.is-met'));
  await p.wait(2600);
  assert.equal(p.$$('.pw-cel').length, 0, 'it goes by itself');
  await target(30);
  await p.click('.wo-set.is-next .wo-tick');
  await p.wait(60);
  assert.equal(p.$$('.pw-cel').length, 0, 'once a workout');
});

test('the home screen: the week in the sky, up next with its gauge, plans with their power', async () => {
  const p = await open('home', { width: 1300 });
  assert.ok(p.$('.wo-home-top .wo-wk'));
  assert.ok(p.$('.wo-up .pw-gauge.is-m'));
  assert.equal(p.$$('.wo-plan-card').length, 2);
  assert.equal(p.$$('.wo-plan-card.is-next').length, 1);
  assert.ok(p.$$('.wo-plan-card .pw-bar').length >= 2);
  await p.wait(1000);
  assert.equal(p.$('.wo-wk-n .pw-roll').textContent, '80', 'this week’s power rolls up to what it is');
});

test('a plan: a gauge of what it asks for, and scrubbers without ticks', async () => {
  const p = await open('plan', { width: 375 });
  assert.ok(p.$('.wo-plan-sum .pw-gauge'));
  if (!p.$('[role=slider]')) await p.click('.wo-item-sets');
  const el = p.$('[role=slider][data-f=reps]');
  assert.ok(el);
  assert.equal(p.$$('.wo-tick').length, 0);
  const was = Number(el.getAttribute('aria-valuenow'));
  await p.key(el, 'ArrowUp');
  await p.wait(20);
  assert.equal(Number(p.$('[role=slider][data-f=reps]').getAttribute('aria-valuenow')), was + 1);
});

test('an exercise up close: a solid sheet, its pictures played, two body views, the steps', async () => {
  const p = await open('info', { width: 375 });
  await p.wait(300);
  assert.ok(p.$('.sheet.wo-info-sheet'));
  assert.equal(p.$$('.pw-flip img').length, 2);
  assert.equal(p.$$('.bm-side').length, 2);
  assert.ok(p.$$('.wo-info-steps li').length > 0);
});

test('Insights: this week against your usual, the bars in History, an exercise’s sessions', async () => {
  const o = await open('training:overview', { width: 1300 });
  assert.ok(o.$('.tr-hero .pw-gauge'));
  const hst = await open('training:history', { width: 375 });
  assert.ok(hst.$$('.tr-row .pw-bar').length > 0);
  const ex = await open('training-exercise', { width: 375 });
  assert.ok(ex.$$('.tr-session').length > 0);
  await ex.click('.tr-session');
  await ex.wait(200);
  assert.ok(ex.$$('.sheet').length >= 2, 'a bar opens its workout');
});

