import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rolldown } from 'rolldown';

// the widget layout on its own: lib/store and lib/i18n are replaced by the smallest stand-ins
const bundle = await rolldown({
  input: new URL('../src/lib/widgets.ts', import.meta.url).pathname,
  plugins: [{
    name: 'widgets-test-environment',
    resolveId(id) {
      if (id === './store' || id === '../lib/i18n' || id === './i18n') return '\0' + id;
    },
    load(id) {
      if (id === '\0./store') return 'export const observable = (v) => ({ get: () => v, set: (n) => { v = n; }, use: () => v });';
      if (id.startsWith('\0')) return 'export const t = (s) => s;';
    },
  }],
});
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
globalThis.localStorage = { store: new Map(), getItem(k) { return this.store.get(k) ?? null; }, setItem(k, v) { this.store.set(k, v); }, removeItem(k) { this.store.delete(k); } };
const w = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));

const IDS = ['notices', 'on-this-day', 'coming-up', 'reading', 'song', 'points'];

test('nothing saved gives every widget once, in the usual order, none hidden', () => {
  assert.deepEqual(w.normalize(null), { order: IDS, hidden: [], options: {} });
  assert.ok(w.isDefault(w.normalize({})));
});

test('a saved order keeps its own sequence, drops strangers and repeats, and takes back what is missing', () => {
  const l = w.normalize({ order: ['reading', 'nope', 'notices', 'reading', 5], hidden: ['notices', 'nope'] });
  assert.equal(new Set(l.order).size, 6);
  assert.deepEqual([...l.order].sort(), [...IDS].sort());
  assert.ok(l.order.indexOf('reading') < l.order.indexOf('notices'));
  assert.deepEqual(l.hidden, ['notices']);
});

test('a widget added later turns up after the one before it', () => {
  const l = w.normalize({ order: ['notices', 'coming-up', 'reading', 'song', 'points'] });
  assert.deepEqual(l.order, ['notices', 'on-this-day', 'coming-up', 'reading', 'song', 'points']);
});

test('settings keep only offered values that differ from the default', () => {
  const l = w.normalize({ options: { 'coming-up': { days: 30, max: 3, bogus: 1 }, reading: { max: 99 }, points: { graph: 0 }, nope: { a: 1 } } });
  assert.deepEqual(l.options, { 'coming-up': { days: 30 }, points: { graph: 0 } });
  assert.equal(w.optionOf(l, 'coming-up', 'days'), 30);
  assert.equal(w.optionOf(l, 'coming-up', 'max'), 3);
  assert.equal(w.optionOf(l, 'reading', 'max'), 0);
});

test('each zone shows its own visible widgets in the layout order', () => {
  const l = w.normalize({ order: ['song', 'reading', 'points', 'notices', 'coming-up', 'on-this-day'], hidden: ['coming-up'] });
  assert.deepEqual(w.shownIn(l, 'panel'), ['reading', 'notices', 'on-this-day']);
  assert.deepEqual(w.shownIn(l, 'side'), ['song', 'points']);
});

test('saving stores the layout, and the default clears it', () => {
  w.saveWidgets({ order: [...IDS].reverse(), hidden: ['song'], options: {} });
  assert.ok(JSON.parse(localStorage.getItem('mm-widgets')).hidden.includes('song'));
  w.saveWidgets(w.defaultLayout());
  assert.equal(localStorage.getItem('mm-widgets'), null);
});
