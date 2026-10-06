import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';
import { i18n } from './i18n-stub.mjs';

const bundle = await rolldown({ input: 'src/components/mentions.tsx', external: (_id, importer) => !!importer });
const code = (await bundle.generate({ format: 'cjs' })).output[0].code;
await bundle.close();

function harness({ viewport = { offsetLeft: 0, offsetTop: 0, width: 390, height: 844 }, target = null, reduced = false } = {}) {
  const slots = [], layouts = [], effects = [], appended = [], timers = [];
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
    }[id] ?? (id.endsWith('/i18n') ? i18n : {})),
    window: { visualViewport: viewport }, innerWidth: 390, innerHeight: 844,
    matchMedia: () => ({ matches: reduced }),
    document: {
      createElement: () => ({
        style: { setProperty() {} }, children: [], attributes: {},
        setAttribute(key, value) { this.attributes[key] = value; },
        append(node) { this.children.push(node); }, remove() { this.removed = true; },
      }),
      body: { append: () => { throw new Error('Tag bursts must stay inside the note'); } },
    },
    setTimeout: (fn) => { timers.push(fn); return 0; },
  });
  return {
    ...module.exports, appended,
    cleanup: () => timers.forEach(fn => fn()),
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

test('tag bursts skip reduced motion and invalid measurements', () => {
  const rect = { left: 20, top: 20, width: 100, height: 20 };
  const reduced = harness({ reduced: true });
  reduced.burst(textRange(rect), burstHost(reduced));
  assert.equal(reduced.appended.length, 0);
  const h = harness({ viewport: { offsetLeft: 0, offsetTop: 0, width: 390, height: 300 } });
  const host = burstHost(h);
  h.burst(textRange({ ...rect, left: NaN }), host);
  h.burst(textRange({ ...rect, width: 0 }), host);
  h.burst(textRange({ ...rect, height: -20 }), host);
  assert.equal(h.appended.length, 0);
  h.burst(textRange(rect), host);
  assert.equal(h.appended.length, 1);
});

function textRange(...rects) {
  return { getClientRects: () => rects, getBoundingClientRect: () => { throw new Error('A union box misplaces wrapped tags'); } };
}
function burstHost(h, origin = { left: 0, top: 0 }) {
  return { isConnected: true, clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0,
    getBoundingClientRect: () => origin, append: node => h.appended.push(node) };
}

test('tag bursts use note coordinates so iOS viewport panning and page scrolling cannot offset them', () => {
  const h = harness({ viewport: { offsetLeft: 25, offsetTop: 180, width: 350, height: 310 } });
  const origin = { left: 35, top: 210 };
  const host = burstHost(h, origin);
  const rect = { left: 90, top: 250, width: 100, height: 24 };
  h.burst(textRange(rect), host, '#123456');
  assert.equal(h.appended[0].style.cssText, 'left:105px;top:52px;--c:#123456;--w:100px;--h:24px');
  // Safari can move the note as its keyboard pans the visible viewport. Both
  // measurements move together; the animation's position within the note stays fixed.
  origin.left += 30;
  origin.top -= 200;
  rect.left += 30;
  rect.top -= 200;
  h.burst(textRange(rect), host, '#123456');
  assert.equal(h.appended[1].style.cssText, h.appended[0].style.cssText);
});

test('wrapped tag bursts land on their actual line fragments and clean up without changing the text', () => {
  const h = harness();
  const host = burstHost(h, { left: 30, top: 200 });
  h.burst(textRange(
    { left: 275, top: 220, width: 80, height: 24 },
    { left: 40, top: 248, width: 100, height: 24 },
    { left: 40, top: 276, width: 0, height: 24 },
  ), host);
  assert.equal(h.appended.length, 2);
  assert.equal(h.appended[0].style.cssText, 'left:285px;top:32px;--c:var(--ink);--w:80px;--h:24px');
  assert.equal(h.appended[1].style.cssText, 'left:60px;top:60px;--c:var(--ink);--w:100px;--h:24px');
  for (const node of h.appended) {
    assert.equal(node.attributes['aria-hidden'], 'true');
    assert.equal(node.children.length, 10);
  }
  h.cleanup();
  assert.ok(h.appended.every(node => node.removed));
});

test('tag burst positioning accounts for container borders and internal scrolling and skips detached notes', () => {
  const h = harness();
  const host = Object.assign(burstHost(h, { left: 10, top: 20 }), { clientLeft: 2, clientTop: 3, scrollLeft: 4, scrollTop: 8 });
  const range = textRange({ left: 20, top: 40, width: 100, height: 20 });
  h.burst(range, host);
  assert.equal(h.appended[0].style.cssText, 'left:62px;top:35px;--c:var(--ink);--w:100px;--h:20px');
  host.isConnected = false;
  h.burst(range, host);
  assert.equal(h.appended.length, 1);
});
