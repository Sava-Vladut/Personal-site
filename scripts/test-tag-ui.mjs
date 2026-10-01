import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: 'src/components/mentions.tsx', external: (_id, importer) => !!importer });
const code = (await bundle.generate({ format: 'cjs' })).output[0].code;
await bundle.close();

function harness({ viewport = { offsetLeft: 0, offsetTop: 0, width: 390, height: 844 }, target = null, reduced = false } = {}) {
  const slots = [], layouts = [], effects = [], appended = [];
  let cursor = 0;
  const hooks = {
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useState(initial) {
      const slot = slots[cursor++] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slot.value, (value) => { slot.value = typeof value === 'function' ? value(slot.value) : value; }];
    },
    useLayoutEffect(fn) { layouts.push(fn); },
    useEffect(fn) { effects.push(fn); },
  };
  const vnode = (type, props, key) => ({ type, props, key });
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: (id) => ({
      'preact/hooks': hooks,
      'preact/jsx-runtime': { jsx: vnode, jsxs: vnode, Fragment: 'fragment' },
      '../lib/store': {
        observable: () => ({ get: () => target, set: (value) => { target = value; }, use: () => target }),
        usePeople: () => [{ id: 'person', name: 'Person', emotions: [] }],
        useBooks: () => [], useSongs: () => [], useEntries: () => [],
      },
    }[id] ?? {}),
    window: { visualViewport: viewport }, innerWidth: 390, innerHeight: 844,
    matchMedia: () => ({ matches: reduced }),
    document: {
      createElement: () => ({ style: { setProperty() {} }, append() {}, remove() {} }),
      body: { append: (node) => appended.push(node) },
    },
    setTimeout: () => 0,
  });
  return {
    ...module.exports, appended,
    render(component, props, node) {
      cursor = 0;
      layouts.length = effects.length = 0;
      const tree = component(props);
      if (node && tree?.props.ref) tree.props.ref.current = node;
      layouts.forEach((fn) => fn());
      return tree;
    },
  };
}

const person = (id) => ({ kind: 'person', item: { id, name: id, relation: '', emotions: [] } });
const buttons = (tree) => tree.props.children.flat(Infinity).filter((child) => child?.type === 'button');
const event = (patch = {}) => ({ pointerType: 'touch', pointerId: 7, clientX: 10, clientY: 10, preventDefault() {}, ...patch });

test('touch tagging picks once without relying on a synthesized click and horizontal swipes do not pick', () => {
  const h = harness();
  let picks = 0;
  const props = { items: [person('Ana')], active: 0, q: 'a', canAdd: false, onPick: () => picks++, onAdd() {} };
  const button = buttons(h.render(h.MentionStrip, props))[0].props;
  button.onPointerDown(event());
  button.onPointerUp(event());
  assert.equal(picks, 1);
  button.onClick(event({ detail: 1 }));
  assert.equal(picks, 1, 'the compatibility click must not insert a second tag');
  button.onPointerDown(event());
  button.onPointerMove(event({ clientX: 30 }));
  button.onPointerUp(event({ clientX: 10 }));
  button.onClick(event({ detail: 1 }));
  assert.equal(picks, 1, 'a horizontal swipe must not insert a tag');
  button.onPointerDown(event());
  button.onPointerCancel();
  button.onPointerUp(event());
  assert.equal(picks, 1, 'a canceled gesture must not insert a tag');
});

test('mouse and keyboard clicks still select suggestions and newly created people', () => {
  const h = harness();
  let picks = 0, additions = 0;
  const tree = h.render(h.MentionStrip, { items: [person('Ana')], active: 0, q: 'new', canAdd: true, onPick: () => picks++, onAdd: () => additions++ });
  const [existing, added] = buttons(tree).map((button) => button.props);
  existing.onPointerDown(event({ pointerType: 'mouse' }));
  existing.onClick(event({ detail: 1 }));
  existing.onClick(event({ detail: 0 }));
  added.onPointerDown(event());
  added.onPointerUp(event());
  added.onClick(event({ detail: 1 }));
  assert.equal(picks, 2);
  assert.equal(additions, 1);
  assert.equal(existing.type, 'button');
  assert.equal(existing.tabIndex, -1);
});

test('suggestions retain stable identity when reordered and expose the active option to the editor', () => {
  const h = harness();
  const props = { items: [person('Ana'), person('Alex')], active: 1, q: 'a', canAdd: false, onPick() {}, onAdd() {} };
  const first = h.render(h.MentionStrip, props);
  const second = h.render(h.MentionStrip, { ...props, items: [...props.items].reverse() });
  assert.equal(first.props.id, 'mention-suggestions');
  assert.deepEqual(Array.from(buttons(first), (button) => button.key), ['person:Ana', 'person:Alex']);
  assert.deepEqual(Array.from(buttons(second), (button) => button.key), ['person:Alex', 'person:Ana']);
  assert.equal(buttons(second)[1].props.id, 'mention-suggestions-option-1');
  assert.equal(buttons(second)[1].props['aria-selected'], true);
});

test('keyboard selection scrolls only its toolbar without moving the note or page', () => {
  const h = harness();
  const scroller = { scrollLeft: 0, getBoundingClientRect: () => ({ left: 0, right: 100 }) };
  const selected = { getBoundingClientRect: () => ({ left: 120, right: 160 }), scrollIntoView: () => { throw new Error('Must not scroll the page'); } };
  const node = { closest: () => scroller, querySelector: () => selected };
  h.render(h.MentionStrip, { items: [person('Ana')], active: 0, q: 'a', canAdd: false, onPick() {}, onAdd() {} }, node);
  assert.equal(scroller.scrollLeft, 84);
});

test('tag cards fit the visible iOS viewport even when neither side of the tag has enough room', () => {
  const viewport = { offsetLeft: 20, offsetTop: 100, width: 350, height: 280 };
  const h = harness({ viewport, target: { kind: 'person', id: 'person', x: 380, top: 240, bottom: 270 } });
  const node = { offsetHeight: 240 };
  h.render(h.PeekLayer, {}, node);
  const tree = h.render(h.PeekLayer, {}, node);
  const style = tree.props.style;
  const left = parseFloat(style.left), top = parseFloat(style.top), width = parseFloat(style.width);
  assert.ok(left >= viewport.offsetLeft + 12);
  assert.ok(left + width <= viewport.offsetLeft + viewport.width - 12);
  assert.ok(top >= viewport.offsetTop + 12);
  assert.ok(top + node.offsetHeight <= viewport.offsetTop + viewport.height - 12);
  assert.equal(style.maxHeight, '256px');
  assert.ok(parseFloat(style['--tail']) <= width - 20);
});

test('tag bursts skip reduced motion, invalid measurements and coordinates hidden behind the keyboard', () => {
  const rect = { left: 20, top: 20, width: 100, height: 20 };
  const reduced = harness({ reduced: true });
  reduced.burst(rect);
  assert.equal(reduced.appended.length, 0);
  const h = harness({ viewport: { offsetLeft: 0, offsetTop: 0, width: 390, height: 300 } });
  h.burst({ ...rect, top: 500 });
  h.burst({ ...rect, left: NaN });
  h.burst({ ...rect, width: 0 });
  assert.equal(h.appended.length, 0);
  h.burst(rect);
  assert.equal(h.appended.length, 1);
});
