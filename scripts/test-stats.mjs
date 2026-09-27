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
        export { computeStats } from '${new URL('../src/lib/stats.ts', import.meta.url).pathname}';
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
const { computeStats, MoodChart, TooltipLayer } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
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
    rolling: 0, entries: [{}],
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
