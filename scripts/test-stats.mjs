import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rolldown } from 'rolldown';

const bundle = await rolldown({
  input: 'review:stats',
  plugins: [{
    name: 'stats-test-environment',
    resolveId(id, importer) {
      if (id === 'review:stats' || id === 'preact/hooks') return '\0' + id;
      if (id === './icons' && importer?.endsWith('/components/charts.tsx')) return '\0icons';
    },
    load(id) {
      if (id === '\0review:stats') return `
        export { computeStats, weatherInsights, weatherStats } from '${new URL('../src/lib/stats.ts', import.meta.url).pathname}';
        export { MoodChart, TooltipLayer } from '${new URL('../src/components/charts.tsx', import.meta.url).pathname}';
      `;
      if (id === '\0icons') return 'export const Icon = () => null; export const Sprite = () => null;';
      if (id === '\0preact/hooks') return `
        export const useRef = () => ({ current: { clientWidth: 350 } });
        export const useState = (value) => [value === 0 ? 350 : value, () => {}];
        export const useEffect = () => {};
        export const useLayoutEffect = () => {};
      `;
    },
  }],
});
const { output } = await bundle.generate({ format: 'esm' });
const { computeStats, weatherInsights, weatherStats, MoodChart, TooltipLayer } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
await bundle.close();

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const now = new Date();
const yesterday = new Date(now);
yesterday.setDate(now.getDate() - 1);
const entry = (date, time, emotion) => ({ date, time, emotions: [emotion], intensity: 3, kind: 'note', text: '' });

test('emotion transitions follow journal dates even when an earlier note was written later', () => {
  const stats = computeStats([
    entry(dateKey(now), now.getTime(), 'joy'),
    entry(dateKey(yesterday), now.getTime() + 1000, 'sadness'),
  ], '7d', 1);
  assert.deepEqual(stats.transitions, [{ from: 'sadness', to: 'joy', count: 1 }]);
});

test('emotion transitions retain timestamp ordering within a day', () => {
  const stats = computeStats([
    entry(dateKey(now), now.getTime(), 'joy'),
    entry(dateKey(now), now.getTime() - 1000, 'sadness'),
  ], '7d', 1);
  assert.deepEqual(stats.transitions, [{ from: 'sadness', to: 'joy', count: 1 }]);
});

function findNode(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  const children = Array.isArray(node) ? node : node.props?.children;
  for (const child of [children].flat(Infinity)) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
}

test('mood chart pointer selects first, middle and last dates at different display scales', () => {
  globalThis.innerWidth = 1000;
  const buckets = Array.from({ length: 30 }, (_, i) => ({
    key: `2026-09-${String(i + 1).padStart(2, '0')}`, mood: i / 10,
    rolling: 0, entries: [{}], cores: {},
  }));
  const chart = MoodChart({ buckets, step: 1 });
  const target = findNode(chart, (node) => typeof node.props?.onPointerMove === 'function');
  assert.ok(target, 'chart has an interactive plot');
  for (const width of [310, 620]) {
    for (const i of [0, 14, 29]) {
      target.props.onPointerMove({
        clientX: 100 + (i / 29) * width,
        currentTarget: { getBoundingClientRect: () => ({ left: 100, top: 150, width }) },
      });
      const tip = TooltipLayer();
      const mood = findNode(tip, (node) => node.props?.label === 'mood · 1 entry');
      assert.equal(mood?.props.value, i === 0 ? '0.0' : `+${(i / 10).toFixed(1)}`);
    }
  }
});

test('weather stats compare moods by sky, temperature, daylight, dark and place, using only weather for the entry’s own day', () => {
  const day = dateKey(now);
  const at = (id, emotion, weather, place) => ({ ...entry(day, now.getTime(), emotion), id, weather: { day, ...weather }, place });
  const park = { lat: 1, lon: 1, name: 'Park' }, office = { lat: 2, lon: 2, name: 'Office' };
  const w = weatherStats([
    at('a', 'joy', { code: 0, temp: 22, daylight: 14, dark: false }, park),
    at('b', 'joy', { code: 1, temp: 24, daylight: 14, dark: false }, park),
    at('c', 'joy', { code: 0, temp: 21, daylight: 14, dark: true }, park),
    at('d', 'sadness', { code: 63, temp: 5, daylight: 9.5, dark: true }, office),
    at('e', 'sadness', { code: 61, temp: 6, daylight: 9.5, dark: true }, office),
    at('f', 'sadness', { code: 80, temp: 4, daylight: 9.5, dark: false }, office),
    { ...at('g', 'joy', { code: 95, temp: 30, daylight: 16 }), weather: { day: '2020-01-01', code: 95, temp: 30, daylight: 16 } },
  ]);
  assert.equal(w.covered, 6);
  assert.equal(w.located, 6);
  const sky = Object.fromEntries(w.sky.map((g) => [g.id, [g.n, g.mood]]));
  assert.deepEqual(sky.clear, [3, 3]);
  assert.deepEqual(sky.rain, [3, -3]);
  assert.deepEqual(sky.storm, [0, null]);
  assert.deepEqual(w.temps.map((b) => [b.name, b.n]), [['0–10°', 3], ['10–20°', 0], ['20–30°', 3]]);
  assert.deepEqual(w.light.map((b) => [b.name, b.n]), [['9–11 h', 3], ['11–13 h', 0], ['13–15 h', 3]]);
  assert.deepEqual(w.dark.map((d) => [d.name, d.n, d.mood]), [['In daylight', 3, 1], ['After dark', 3, -1]]);
  assert.deepEqual(w.places.map((p) => [p.name, p.n, p.mood, p.core]), [['Park', 3, 3, 'joy'], ['Office', 3, -3, 'sadness']]);

  const text = weatherInsights(w).map((i) => i.text);
  assert.ok(text.includes('You feel best on clear days (+3.0) and lowest when it rains (−3.0).'), text.join('\n'));
  assert.ok(text.some((t) => t.startsWith('Longer days suit you: +3.0 on days with 13–15 h of daylight')), text.join('\n'));
  assert.ok(text.includes('Your mood is lower after dark (−1.0) than in daylight (+1.0).'), text.join('\n'));
});

test('weather stats are empty without weather, and never divide by zero', () => {
  const w = weatherStats([entry(dateKey(now), now.getTime(), 'joy')]);
  assert.equal(w.covered, 0);
  assert.deepEqual([w.temps, w.light, w.dark, w.places], [[], [], [], []]);
  assert.equal(w.temp, null);
  assert.deepEqual(weatherInsights(w), []);
});
