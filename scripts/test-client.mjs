import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

const compiled = new Map();
async function load(file, mocks = {}, globals = {}) {
  if (!compiled.has(file)) {
    const bundle = await rolldown({ input: file, external: (_id, importer) => !!importer, transform: { define: { 'import.meta.env.PROD': 'false' } } });
    try { compiled.set(file, (await bundle.generate({ format: 'cjs' })).output[0].code); }
    finally { await bundle.close(); }
  }
  const module = { exports: {} };
  vm.runInNewContext(compiled.get(file), {
    module, exports: module.exports, require: (id) => mocks[id] ?? {},
    console, Blob, URL, URLSearchParams, atob, Uint8Array, Event, AbortController, setTimeout, clearTimeout,
    ...globals,
  });
  return module.exports;
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};
const plain = (value) => JSON.parse(JSON.stringify(value));

function componentHooks() {
  const slots = [];
  let cursor = 0, effects = [];
  const hooks = {
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useState(initial) {
      const slot = slots[cursor++] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slot.value, (next) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((value, k) => value !== slots[i].deps[k])) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      const old = slots[i];
      if (!old || !deps || deps.some((value, k) => value !== old.deps[k])) {
        slots[i] = { deps, cleanup: old?.cleanup };
        effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  hooks.useLayoutEffect = hooks.useEffect;
  return {
    hooks,
    render(component, props) {
      cursor = 0;
      effects = [];
      const tree = component(props);
      effects.forEach(fn => fn());
      return tree;
    },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
const jsx = (type, props, key) => ({ type, props, key });
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}

test('closing a nested sheet retains the parent scroll lock and cancels pending focus', async () => {
  const classes = new Set(), effects = [], frames = new Map();
  let frame = 0;
  const { Sheet } = await load('src/components/Sheet.tsx', {
    'preact/hooks': {
      useRef: current => ({ current }), useState: value => [value, () => {}],
      useEffect: fn => effects.push(fn),
    },
    'preact/jsx-runtime': { jsx, jsxs: jsx },
    '../lib/router': { pushBack: () => () => {} },
  }, {
    CSS: { supports: () => false },
    document: { activeElement: null, documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } } },
    requestAnimationFrame: fn => { frames.set(++frame, fn); return frame; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  Sheet({ open: true, onClose() {}, children: [] });
  Sheet({ open: true, onClose() {}, children: [] });
  const cleanups = effects.map(fn => fn());
  assert.equal(frames.size, 2);
  cleanups[2]();
  assert.ok(classes.has('sheet-open'), 'the parent still blocks page scrolling');
  assert.equal(frames.size, 1);
  cleanups[0]();
  assert.equal(classes.has('sheet-open'), false);
  assert.equal(frames.size, 0);
});

test('pending location lookup cannot change a note after its details are dismissed', async () => {
  const h = componentHooks(), location = deferred(), patches = [], frames = new Map();
  const { NoteDetails } = await load('src/components/NoteDetails.tsx', {
    'preact/hooks': h.hooks, 'preact/jsx-runtime': { jsx, jsxs: jsx },
    '../lib/router': { pushBack: () => () => {} },
    '../lib/weather': { here: () => location.promise },
    '../lib/dates': { rangeLabel: () => '' },
    './weather': { weatherOf: () => null },
  }, {
    document: { activeElement: null },
    requestAnimationFrame: fn => { frames.set(1, fn); return 1; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const props = { open: true, onClose() {}, update: patch => patches.push(patch), draft: { title: '', emotions: [], people: [], photos: [], images: [], date: '2026-10-02', place: null } };
  const tree = h.render(NoteDetails, props);
  const button = nodes(tree).find(node => node.type === 'button' && nodes(node).some(child => child.props?.name === 'current-location'));
  const pending = button.props.onClick();
  h.render(NoteDetails, { ...props, open: false });
  location.resolve({ lat: 10, lon: 20 });
  await pending;
  assert.equal(patches.length, 0);
  assert.equal(frames.size, 0);
  h.dispose();
});

test('creating a person rejects repeated submissions and keeps intervening selections', async () => {
  for (const dismissed of [false, true]) {
    const h = componentHooks(), saved = deferred(), selections = [];
    let saves = 0;
    const { PeopleSheet } = await load('src/components/people.tsx', {
      'preact/hooks': h.hooks, 'preact/jsx-runtime': { jsx, jsxs: jsx },
      '../lib/store': { usePeople: () => [], useEntries: () => [], blankPerson: name => ({ name }), savePerson: () => { saves++; return saved.promise; } },
    });
    const props = { open: true, onClose() {}, selected: [], onChange: value => selections.push(Array.from(value)) };
    let tree = h.render(PeopleSheet, props);
    nodes(tree).find(node => node.type === 'input').props.onInput({ currentTarget: { value: 'Ana' } });
    tree = h.render(PeopleSheet, props);
    const submit = nodes(tree).find(node => node.type === 'form').props.onSubmit;
    submit({ preventDefault() {} });
    submit({ preventDefault() {} });
    assert.equal(saves, 1);
    h.render(PeopleSheet, { ...props, open: !dismissed, selected: ['existing'] });
    saved.resolve({ id: 'new-person', name: 'Ana' });
    await settle();
    assert.deepEqual(selections, dismissed ? [] : [['existing', 'new-person']]);
    h.dispose();
  }
});

test('the icon picker reports failed icon loading and permits a later open to retry', async () => {
  const h = componentHooks();
  let attempts = 0;
  const { IconSheet } = await load('src/components/IconPicker.tsx', {
    'preact/hooks': h.hooks, 'preact/jsx-runtime': { jsx, jsxs: jsx },
    '../lib/icons': { loadCurated: async () => { if (++attempts === 1) throw new Error('Offline'); return { categories: [], bodies: {} }; } },
  });
  const props = { open: true, value: null, onChange() {}, onClose() {} };
  h.render(IconSheet, props);
  await settle();
  assert.match(JSON.stringify(h.render(IconSheet, props)), /Couldn’t load icons/);
  h.render(IconSheet, { ...props, open: false });
  h.render(IconSheet, props);
  await settle();
  assert.doesNotMatch(JSON.stringify(h.render(IconSheet, props)), /Couldn’t load icons/);
  assert.equal(attempts, 2);
  h.dispose();
});

test('keeping music ignores repeated taps, uses an existing record and reports storage failure', async () => {
  for (const failed of [false, true]) {
    const h = componentHooks(), stored = deferred(), messages = [], songs = [];
    const music = { kind: 'track', id: 'track', title: 'Song' };
    let saves = 0;
    const { MusicDeck } = await load('src/components/music.tsx', {
      'preact/hooks': h.hooks, 'preact/jsx-runtime': { jsx, jsxs: jsx },
      '../lib/store': {
        useSongs: () => [], getSongs: () => songs, findSong: list => list[0], blankSong: m => ({ music: m }),
        saveSong: async () => { saves++; await stored.promise; if (failed) throw new Error('Full'); const song = { id: 'song' }; songs.push(song); return song; },
        toast: message => messages.push(message),
      },
    });
    let tree = h.render(MusicDeck, { m: music });
    nodes(tree).find(node => node.type === 'button').props.onClick();
    tree = h.render(MusicDeck, { m: music });
    const keep = nodes(tree).find(node => node.type === 'button' && node.props.children?.some?.(child => typeof child === 'string' && child.includes('Keep in Media'))).props.onClick;
    const pending = keep();
    await keep();
    assert.equal(saves, 1);
    stored.resolve();
    await pending;
    assert.deepEqual(messages, failed ? ['Couldn’t save this music. Try again.'] : ['Song is in your records']);
    if (!failed) {
      await keep();
      assert.equal(saves, 1, 'a now-kept record must be reused');
    }
    h.dispose();
  }
});

function textBox(value, start = 0, end = start) {
  return {
    value, selectionStart: start, selectionEnd: end,
    focus() {}, dispatchEvent() {},
    setSelectionRange(s, e) { this.selectionStart = s; this.selectionEnd = e; },
    setRangeText(text, s, e) { this.value = this.value.slice(0, s) + text + this.value.slice(e); },
  };
}

test('formatting at position zero preserves a leading blank line correctly', async () => {
  const md = await load('src/lib/markdown.ts', {}, { document: { execCommand: () => false } });
  const box = textBox('\nSecond line');
  md.toggleLines(box, 'h1');
  assert.equal(box.value, '# \nSecond line');
});

test('formatting a selection ending at the next line start only affects selected lines', async () => {
  const md = await load('src/lib/markdown.ts', {}, { document: { execCommand: () => false } });
  for (const operation of [box => md.toggleLines(box, 'ul'), box => md.indentLines(box, false)]) {
    const box = textBox('First\nSecond', 0, 6);
    operation(box);
    assert.ok(box.value.endsWith('\nSecond'), box.value);
  }
  assert.equal(md.toggleTask('Words', 20), 'Words');
});

test('the editor toolbar follows the visible keyboard viewport and releases its listeners', async () => {
  const styles = {}, effects = [], cleanups = [], listeners = new Map(), frames = new Map();
  const scroll = { scrollLeft: 240 };
  const el = { style: { setProperty: (key, value) => { styles[key] = value; } }, querySelector: () => scroll };
  const body = {};
  const events = (prefix) => ({
    addEventListener: (name, fn) => listeners.set(prefix + name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(prefix + name) === fn) listeners.delete(prefix + name); },
  });
  const viewport = { width: 390, height: 380, offsetTop: 80, offsetLeft: 12, ...events('viewport:') };
  let portalTarget;
  const jsx = (type, props) => ({ type, props });
  const { FormatBar } = await load('src/components/FormatBar.tsx', {
    // only the keyboard placement (the layout effects) is under test here
    'preact/hooks': { useRef: () => ({ current: el }), useLayoutEffect: (fn) => effects.push(fn), useEffect: () => {}, useState: (v) => [v, () => {}] },
    'preact/compat': { createPortal: (node, target) => { portalTarget = target; return node; } },
    'preact/jsx-runtime': { jsx, jsxs: jsx },
  }, {
    innerHeight: 844,
    window: { visualViewport: viewport },
    document: { body, documentElement: { clientHeight: 844 }, ...events('document:') },
    ...events('window:'),
    requestAnimationFrame: (fn) => { frames.set(1, fn); return 1; },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  FormatBar({ target: () => null, swap: 'Suggestions', swapLabel: 'Tag' });
  for (const effect of effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
  assert.equal(portalTarget, body, 'toolbar must be outside the animated page');
  assert.deepEqual(styles, { '--kb': '384px', '--toolbar-left': '207px', '--toolbar-width': '390px' });
  assert.equal(scroll.scrollLeft, 0, 'old formatting scroll must not hide first matches');
  viewport.height = 844;
  viewport.offsetTop = 0;
  viewport.offsetLeft = 0;
  listeners.get('viewport:resize')();
  assert.equal(styles['--kb'], '0px');
  assert.equal(styles['--toolbar-left'], '195px');
  listeners.get('document:focusin')();
  assert.equal(frames.size, 1);
  for (const cleanup of cleanups) cleanup();
  assert.equal(frames.size, 0);
  assert.equal(listeners.size, 0);
});

test('photo backup import skips damaged base64 and cleans invalid dimensions', async () => {
  const stored = [];
  const photos = await load('src/lib/photos.ts', {
    './db': { db: { photoIds: async () => [], putPhotos: async (list) => stored.push(...list) } },
  });
  const count = await photos.importPhotos({
    pbroken1: { data: 'data:image/png;base64,A', w: 10, h: 10 },
    pvalid12: { data: 'data:image/png;base64,aW1hZ2U=', w: -5, h: Infinity },
  }, new Set(['pbroken1', 'pvalid12']));
  assert.equal(count, 1);
  assert.deepEqual(stored.map(p => [p.id, p.w, p.h]), [['pvalid12', 1, 1]]);
});

test('failed photo conversion always closes its decoded bitmap', async () => {
  let closed = 0;
  const photos = await load('src/lib/photos.ts', {}, {
    createImageBitmap: async () => ({ width: 3000, height: 1000, close() { closed++; } }),
    document: { createElement: () => ({ getContext: () => null }) },
  });
  const result = await photos.addPhotos([new Blob(['image'])]);
  assert.deepEqual(plain(result), { photos: [], failed: 1 });
  assert.equal(closed, 1);
});

test('invalid saved color data cannot crash color extraction or become a CSS color', async () => {
  for (const raw of ['4', '[]', '{"cover":"broken","valid":"#123456"}']) {
    const colors = await load('src/lib/colors.ts', {}, {
      localStorage: { getItem: () => raw },
      Image: class { set src(_src) { queueMicrotask(() => this.onerror()); } },
    });
    assert.equal(await colors.colorOf('cover'), null);
    if (raw.startsWith('{')) assert.equal(await colors.colorOf('valid'), '#123456');
  }
});

async function weatherHarness({ place = null } = {}) {
  const response = deferred();
  let entries = [{ id: 'note', date: '2026-10-01', time: Date.now(), place, weather: null }];
  let settings = { weather: true, places: !!place, home: { lat: 46, lon: 23 } };
  const annotated = [], saved = [];
  const weather = await load('src/lib/weather.ts', {
    './dates': { todayKey: () => '2026-10-01', addDays: () => '2026-08-01', keyOf: date => date.toISOString().slice(0, 10) },
    './store': {
      getEntries: () => entries, getSettings: () => settings,
      normalizeWeather: (w) => w, normalizePlace: (p) => p,
      annotateEntries: async (patches) => annotated.push(...patches),
      saveEntry: async (entry) => saved.push(entry),
    },
  }, {
    fetch: () => response.promise,
    navigator: { language: 'en', geolocation: { getCurrentPosition: (resolve) => resolve({ coords: { latitude: 47, longitude: 24 } }) } },
    setTimeout: (fn, ms) => { if (ms < 15000) queueMicrotask(fn); return 0; }, clearTimeout() {},
  });
  return {
    weather, annotated, saved,
    entry: () => entries[0],
    edit: (patch) => { entries = [{ ...entries[0], ...patch }]; },
    settings: (patch) => { settings = { ...settings, ...patch }; },
    respond: (data) => response.resolve({ ok: true, json: async () => data }),
  };
}
const forecast = { daily: { time: ['2026-10-01'], weather_code: [2], temperature_2m_max: [20], daylight_duration: [36000] } };

test('weather responses cannot attach a previous place or home after it changes', async () => {
  for (const mode of ['place', 'home', 'disabled', 'time']) {
    const h = await weatherHarness();
    const pending = h.weather.fillWeather();
    if (mode === 'place') h.edit({ place: { lat: 10, lon: 20, name: 'Elsewhere' } });
    if (mode === 'home') h.settings({ home: { lat: 10, lon: 20 } });
    if (mode === 'disabled') h.settings({ weather: false });
    if (mode === 'time') h.edit({ time: h.entry().time + 10000 });
    h.respond(forecast);
    assert.equal(await pending, 0, mode);
    assert.equal(h.annotated.length, 0, mode);
  }
});

test('reverse lookup cannot give a new place the old place name', async () => {
  const h = await weatherHarness({ place: { lat: 46, lon: 23, name: '' } });
  h.settings({ weather: false });
  const pending = h.weather.fillWeather();
  await settle();
  h.edit({ place: { lat: 10, lon: 20, name: '' } });
  h.respond({ address: { city: 'Old city' } });
  await pending;
  assert.equal(h.annotated.length, 0);
});

test('background current weather preserves edit timestamps and ignores moved entries', async () => {
  for (const moved of [false, true]) {
    const h = await weatherHarness();
    const pending = h.weather.addContext(h.entry());
    if (moved) h.edit({ date: '2026-09-30' });
    h.respond({ current: { weather_code: 2, temperature_2m: 20, is_day: 1 }, daily: { daylight_duration: [36000] } });
    await pending;
    assert.equal(h.saved.length, 0);
    assert.equal(h.annotated.length, moved ? 0 : 1);
  }
});

test('weather fetched with a new location replaces background weather from home', async () => {
  const h = await weatherHarness();
  h.settings({ places: true });
  const pending = h.weather.addContext(h.entry());
  await settle();
  h.edit({ weather: { day: '2026-10-01', temp: 10 } });
  h.respond({ address: { city: 'Here' }, current: { weather_code: 2, temperature_2m: 20, is_day: 1 }, daily: { daylight_duration: [36000] } });
  await pending;
  assert.equal(h.saved.length, 1);
  assert.equal(h.saved[0].weather.temp, 20);
  assert.equal(h.saved[0].place.lat, 47);
});

test('turning off places discards weather whose location was also discarded', async () => {
  const h = await weatherHarness();
  h.settings({ places: true });
  const pending = h.weather.contextNow(h.entry());
  await settle();
  h.settings({ places: false });
  h.respond({ address: { city: 'Here' }, current: { weather_code: 2, temperature_2m: 20, is_day: 1 }, daily: { daylight_duration: [36000] } });
  assert.equal(await pending, null);
});

test('rapid viewer requests share the pending open and the viewer can reopen after closing', async () => {
  const images = [], viewers = [];
  class Viewer {
    constructor() { this.events = {}; viewers.push(this); }
    on(name, fn) { this.events[name] = fn; }
    init() { this.events.beforeOpen(); return true; }
    destroy() { this.events.destroy(); }
  }
  const viewer = await load('src/lib/viewer.ts', {
    photoswipe: Viewer, '../data/ui-icons.json': {},
    './icons': { svgInner: () => '' }, './router': { pushBack: () => () => {} },
  }, { Image: class { constructor() { images.push(this); } } });
  const items = [{ src: 'image' }];
  const a = viewer.openViewer(items, 0);
  const b = viewer.openViewer(items, 0);
  assert.equal(images.length, 1);
  images[0].naturalWidth = images[0].naturalHeight = 100;
  images[0].onload();
  await Promise.all([a, b]);
  assert.equal(viewers.length, 1);
  viewers[0].destroy();
  const reopening = viewer.openViewer([{ src: 'image', w: 100, h: 100 }], 0);
  await reopening;
  assert.equal(viewers.length, 2);
  viewers[1].destroy();
});

test('partial viewer startup releases history and allows another viewer to open', async () => {
  let attempts = 0, releases = 0, destroyed = 0;
  class Viewer {
    constructor() { this.events = {}; }
    on(name, fn) { this.events[name] = fn; }
    init() {
      this.events.beforeOpen();
      if (++attempts === 1) throw new Error('Failed before opening');
      return true;
    }
    destroy() {
      // Real PhotoSwipe delegates to close unless explicitly destroying; a partial
      // open has no opener animation, so that close path does not dispatch destroy.
      if (!this.isDestroying) return;
      destroyed++;
      this.events.destroy();
    }
  }
  const viewer = await load('src/lib/viewer.ts', {
    photoswipe: Viewer, '../data/ui-icons.json': {},
    './icons': { svgInner: () => '' }, './router': { pushBack: () => () => { releases++; } },
  });
  const items = [{ src: 'image', w: 100, h: 100 }];
  await assert.rejects(viewer.openViewer(items, 0), /Failed before opening/);
  assert.equal(releases, 1);
  assert.equal(destroyed, 1);
  await viewer.openViewer(items, 0);
  assert.equal(attempts, 2);
});

test('a failed database startup offers recovery without rendering an empty journal', async () => {
  const rendered = [];
  function App() {}
  await load('src/main.tsx', {
    preact: { render: (node) => rendered.push(node) },
    'preact/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    './app': { App }, './lib/db': { onBlocked() {} },
    './lib/store': { applyTheme() {}, init: async () => { throw new Error('Unavailable'); } },
  }, {
    console: { error() {} }, navigator: {}, addEventListener() {},
    document: { documentElement: { classList: { add() {}, remove() {} } }, getElementById: () => ({}) },
  });
  await settle();
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].type, 'div');
  assert.match(JSON.stringify(rendered[0]), /Couldn’t open your journal/);
});

test('a rejected page transition still clears navigation state and tolerates infinite animations', async () => {
  const listeners = new Map();
  const root = { dataset: {} };
  const location = { hash: '#/' };
  const finished = deferred();
  let animationAttempts = 0;
  class KeyframeEffect { target = { matches: () => true }; }
  class CSSAnimation {
    effect = new KeyframeEffect();
    finish() { animationAttempts++; throw new Error('Infinite animation'); }
  }
  const router = await load('src/lib/router.ts', {
    'preact/hooks': {
      useState: (fn) => [fn(), () => {}], useRef: (current) => ({ current }),
      useLayoutEffect() {}, useEffect: (fn) => fn(),
    },
  }, {
    location, matchMedia: () => ({ matches: false }),
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener() {},
    KeyframeEffect, CSSAnimation, setTimeout: () => 0,
    document: {
      documentElement: root, startViewTransition: () => ({ finished: finished.promise.then(() => { throw new Error('Skipped'); }) }),
      getAnimations: () => [new CSSAnimation()],
    },
  });
  router.useRoute();
  location.hash = '#/note/new';
  listeners.get('hashchange')();
  assert.equal(root.dataset.nav, 'push');
  finished.resolve();
  await settle();
  assert.equal(root.dataset.nav, undefined);
  assert.equal(animationAttempts, 1);
});
