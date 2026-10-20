import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';
import { i18n } from './i18n-stub.mjs';

const compiled = new Map();
/** Start-up effects that only touch the page (fades): nothing to see in these tests, so they do nothing. */
const effects = { './lib/fadeImages': { startImageFade() {} }, './lib/reveal': { startReveal() {} } };
async function load(file, mocks = {}, globals = {}) {
  if (!compiled.has(file)) {
    const bundle = await rolldown({ input: file, external: (_id, importer) => !!importer, transform: { define: { 'import.meta.env.PROD': 'false' } } });
    try { compiled.set(file, (await bundle.generate({ format: 'cjs' })).output[0].code); }
    finally { await bundle.close(); }
  }
  const module = { exports: {} };
  // Supply lazy screen modules through the same boundary mocks as static imports.
  const code = file === 'src/lib/views.ts' || file === 'src/main.tsx'
    ? compiled.get(file).replace(/\bimport\((['"])([^'"]+)\1\)/g, 'Promise.resolve().then(() => require("$2"))')
    : compiled.get(file);
  vm.runInNewContext(code, {
    module, exports: module.exports, require: (id) => mocks[id] ?? (id.endsWith('/i18n') ? i18n : effects[id] ?? {}),
    console, Blob, URL, URLSearchParams, atob, Uint8Array, Event, AbortController, AbortSignal, setTimeout, clearTimeout,
    ...globals,
    // the start-up code reads the page's address to tell a public note's link from the app
    ...(file === 'src/main.tsx' ? { location: { pathname: '/', ...globals.location } } : {}),
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
/** The page's root element, as far as the router touches it (the loading bar's attribute). */
function rootElement() {
  const attrs = new Set();
  return { setAttribute: (name) => attrs.add(name), removeAttribute: (name) => attrs.delete(name), hasAttribute: (name) => attrs.has(name) };
}

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
    './Sheet': { focusIn: () => {}, giveBack: () => {} },
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
  FormatBar({ swap: 'Suggestions', swapLabel: 'Tag' });
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
    './app': { App }, './lib/db': { onBlocked() {} }, './lib/auth': { signedInHere: () => true, stillSignedIn: async () => true }, 
    './lib/router': { routeName: () => 'journal' }, './lib/views': { preloadViews() {}, prepareView() {} },
    './lib/store': { applyTheme() {}, init: async () => { throw new Error('Unavailable'); } },
  }, {
    console: { error() {} }, navigator: {}, addEventListener() {},
    document: { getElementById: () => ({}), addEventListener() {} },
  });
  await settle();
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].type, 'div');
  assert.match(JSON.stringify(rendered[0]), /Couldn’t open your journal/);
});

test('startup keeps the app unmounted until the current deep link screen is loaded', async () => {
  const rendered = [], journal = deferred(), brain = deferred(), timers = [], attributes = new Map();
  let route = 'journal', weather = 0, sync = 0;
  function App() {}
  await load('src/main.tsx', {
    preact: { render: node => rendered.push(node) }, 'preact/jsx-runtime': { jsx, jsxs: jsx },
    './app': { App }, './lib/db': { onBlocked() {} }, './lib/store': { applyTheme() {}, init: async () => {} },
    './lib/auth': { signedInHere: () => true, stillSignedIn: async () => true }, './lib/router': { routeName: () => route },
    './lib/views': { preloadViews() {}, prepareView: name => ({ journal, brain }[name].promise) },
    './lib/weather': { startWeather: () => weather++ }, './lib/sync': { initSync: () => sync++ }, './lib/status': { initStatus() {} },
  }, {
    navigator: {}, addEventListener() {}, setTimeout: fn => timers.push(fn),
    document: {
      getElementById: () => ({}),
      querySelector: () => ({ setAttribute: (name, value) => attributes.set(name, value) }), addEventListener() {},
    },
  });
  route = 'brain'; journal.resolve(); await settle();
  assert.equal(rendered.length, 0, 'loading the old deep link cannot render the new screen before it is ready');
  brain.resolve(); await settle();
  assert.equal(rendered[0].type, App); assert.equal(weather, 1); assert.equal(sync, 1);
  timers.forEach(fn => fn());
  assert.ok(attributes.has('data-boot'), 'the initial page keeps its entrance style after startup timers settle');
});

test('a failed initial screen load reports a connection problem and offers a reload', async () => {
  const rendered = [];
  await load('src/main.tsx', {
    preact: { render: node => rendered.push(node) }, 'preact/jsx-runtime': { jsx, jsxs: jsx },
    './lib/db': { onBlocked() {} }, './lib/store': { applyTheme() {}, init: async () => {} }, './lib/auth': { signedInHere: () => true, stillSignedIn: async () => true }, 
    './lib/router': { routeName: () => 'journal' },
    './lib/views': { preloadViews() {}, prepareView: () => Promise.reject(new Error('Offline')) },
  }, {
    console: { error() {} }, navigator: {}, addEventListener() {},
    document: { getElementById: () => ({}), addEventListener() {} },
  });
  await settle();
  assert.match(JSON.stringify(rendered[0]), /Check your connection/);
  assert.doesNotMatch(JSON.stringify(rendered[0]), /storage is unavailable/);
});

test('a signed-out device opens on the intro without touching storage, and the journal comes in after the dive', async () => {
  const rendered = [], dive = deferred(), replaced = [];
  let inits = 0, remembered = null;
  function App() {}
  function Intro() {}
  await load('src/main.tsx', {
    preact: { render: node => rendered.push(node) }, 'preact/jsx-runtime': { jsx, jsxs: jsx },
    './app': { App }, './lib/db': { onBlocked() {} }, './lib/weather': { startWeather() {} }, './lib/sync': { initSync() {} }, './lib/status': { initStatus() {} }, './lib/store': { applyTheme() {}, init: async () => { inits++; } },
    './lib/auth': {
      signedInHere: () => false, authStatus: async () => ({ configured: true, admin: false }),
      opensOn: (s) => (s && (!s.configured || s.admin) ? 'app' : 'intro'), rememberSignedIn: (on) => { remembered = on; },
    },
    './lib/router': { routeName: () => 'intro' },
    './lib/views': { preloadViews() {}, prepareView: () => Promise.resolve(), viewFor: (name) => (name === 'intro' ? Intro : null) },
  }, {
    navigator: {}, addEventListener() {},
    history: { state: null, replaceState: (_s, _t, hash) => replaced.push(hash) },
    document: { getElementById: () => ({}), querySelector: () => null, addEventListener() {} },
  });
  await settle();
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].type, Intro);
  assert.equal(inits, 0, 'the journal stays closed behind the intro');
  assert.equal(remembered, null);

  rendered[0].props.onEnter(dive.promise);
  await settle();
  assert.equal(inits, 1, 'storage opens while the brain dives');
  assert.deepEqual(replaced, ['#/'], 'signing in from #/intro lands on the journal');
  assert.equal(rendered.length, 1, 'the app waits for the dive to finish');
  dive.resolve(); await settle();
  assert.equal(rendered[1].type, App);
});

test('a device without the note goes straight in when its cookie is still good, or the server has no password', async () => {
  for (const [status, note] of [[{ configured: true, admin: true }, true], [{ configured: false, admin: false }, null]]) {
    const rendered = [];
    let remembered = null;
    function App() {}
    await load('src/main.tsx', {
      preact: { render: node => rendered.push(node) }, 'preact/jsx-runtime': { jsx, jsxs: jsx },
      './app': { App }, './lib/db': { onBlocked() {} }, './lib/weather': { startWeather() {} }, './lib/sync': { initSync() {} }, './lib/status': { initStatus() {} }, './lib/store': { applyTheme() {}, init: async () => {} },
      './lib/auth': {
        signedInHere: () => false, authStatus: async () => status,
        opensOn: (s) => (s && (!s.configured || s.admin) ? 'app' : 'intro'), rememberSignedIn: (on) => { remembered = on; },
      },
      './lib/router': { routeName: () => 'journal' }, './lib/views': { preloadViews() {}, prepareView: () => undefined, viewFor() {} },
    }, {
      navigator: {}, addEventListener() {},
      document: { getElementById: () => ({}), querySelector: () => null, addEventListener() {} },
    });
    await settle(); await settle();
    assert.equal(rendered[0]?.type, App);
    assert.equal(remembered, note);
  }
});

test('a signed-in device reloads into the intro once the server says it was signed out', async () => {
  let reloads = 0;
  await load('src/main.tsx', {
    preact: { render() {} }, 'preact/jsx-runtime': { jsx, jsxs: jsx },
    './app': { App() {} }, './lib/db': { onBlocked() {} }, './lib/weather': { startWeather() {} }, './lib/sync': { initSync() {} }, './lib/status': { initStatus() {} }, './lib/store': { applyTheme() {}, init: async () => {} },
    './lib/auth': { signedInHere: () => true, stillSignedIn: async () => false },
    './lib/router': { routeName: () => 'journal' }, './lib/views': { preloadViews() {}, prepareView: () => undefined },
  }, {
    navigator: {}, addEventListener() {}, location: { reload: () => reloads++ },
    document: { getElementById: () => ({}), querySelector: () => null, addEventListener() {} },
  });
  await settle();
  assert.equal(reloads, 1);
});

test('sign-in state: the note opens the app at once, and only a clear no from the server signs a device out', async () => {
  const store = new Map();
  const localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  let answer = null;
  const fetch = async (_url, init = {}) => {
    if (answer === 'offline') throw new TypeError('Failed to fetch');
    if (init.method === 'POST') {
      const ok = JSON.parse(init.body).password === 'right';
      return { ok, json: async () => (ok ? { configured: true, admin: true } : { error: 'That’s not the password.' }) };
    }
    if (init.method === 'DELETE') return { ok: true, json: async () => ({ configured: true, admin: false }) };
    return { ok: true, json: async () => answer };
  };
  const auth = await load('src/lib/auth.ts', {}, { localStorage, fetch, AbortController, setTimeout, clearTimeout });

  assert.equal(auth.opensOn(null), 'intro', 'offline with no note: the intro');
  assert.equal(auth.opensOn({ configured: true, admin: false }), 'intro');
  assert.equal(auth.opensOn({ configured: true, admin: true }), 'app');
  assert.equal(auth.opensOn({ configured: false, admin: false }), 'app');

  await assert.rejects(auth.signIn('wrong'), /not the password/);
  assert.equal(auth.signedInHere(), false);
  await auth.signIn('right');
  assert.equal(auth.signedInHere(), true);

  answer = 'offline';
  assert.equal(await auth.stillSignedIn(), true, 'offline it stays signed in');
  answer = { configured: true, admin: true };
  assert.equal(await auth.stillSignedIn(), true);
  answer = { configured: true, admin: false };
  assert.equal(await auth.stillSignedIn(), false);
  assert.equal(auth.signedInHere(), false);

  await auth.signIn('right');
  await auth.signOut();
  assert.equal(auth.signedInHere(), false);
  answer = 'offline';
  await assert.rejects(auth.signIn('right'), /reach the server/);
});

test('the intro brain flies in out of the sky, settles into a lit brain with a ring of words, flinches, and bursts away', async () => {
  const shape = await load('src/lib/brainShape.ts');
  const brain3d = await load('src/lib/brain3d.ts', { './brainShape': shape });
  const draws = [];
  const ctx = new Proxy({}, { get: (_t, name) => (name === 'drawImage' ? (...a) => draws.push(a) : () => {}), set: () => true });
  const atlas = { width: 0, height: 0, getContext: () => ({ fillText() {} }) };
  const listeners = new Map();
  const el = {
    width: 0, height: 0, getContext: () => ctx, setPointerCapture() {},
    parentElement: { getBoundingClientRect: () => ({ width: 600, height: 360 }) },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 360 }),
    addEventListener: (n, fn) => listeners.set(n, fn), removeEventListener: (n) => listeners.delete(n),
  };
  const timers = [];
  let frame = null, now = 1000, seeded = false;
  const { hooks, render, dispose } = componentHooks();
  const { AsciiBrain } = await load('src/components/AsciiBrain.tsx', {
    'preact/hooks': { ...hooks, useRef: (v) => { const r = hooks.useRef(v); if (!seeded) { r.current = el; seeded = true; } return r; } },
    '../lib/brainShape': shape, '../lib/brain3d': brain3d,
    '../lib/inView': { watchView: (_el, cb) => (cb(true), () => {}) },
    'preact/jsx-runtime': { jsx: () => null, jsxs: () => null },
  }, {
    document: { createElement: () => atlas, hidden: false, addEventListener() {}, removeEventListener() {} },
    getComputedStyle: () => ({ getPropertyValue: () => '#808080' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (fn) => { frame = fn; return 1; }, cancelAnimationFrame() {},
    setTimeout: (fn) => timers.push(fn), clearTimeout() {},
    performance: { now: () => now }, devicePixelRatio: 1, innerWidth: 600,
  });
  const spots = [];
  const props = { words: [{ text: 'calm', world: 'calm-safety' }, { text: 'curious', world: 'hope-interest' }], label: 'brain', flinch: 0, diving: false, onSpot: (w) => spots.push(w) };
  render(AsciiBrain, props);
  assert.equal(draws.length, 0, 'nothing is built or drawn before the page has painted');
  timers.splice(0).forEach((fn) => fn());
  const run = (n) => { let drawn = 0; for (let i = 0; i < n; i++) { draws.length = 0; const f = frame; frame = null; f((now += 34)); drawn = draws.length; } return drawn; };
  const rows = () => new Set(draws.map((a) => a[2] / a[3]));

  assert.ok(run(15) > 50, 'letters are flying in');
  const settled = run(60);
  assert.ok(settled > 600, `a whole brain of letters: ${settled}`);
  assert.ok([...rows()].some((r) => r >= 3), 'a region glows in its own colour');
  assert.ok(spots.length >= 1 && spots.every((w) => shape.PATCHES.some((p) => p.world === w)), 'the spotlight names real regions');
  assert.ok(draws.every((a) => Number.isFinite(a[5]) && Number.isFinite(a[6])));

  run(200); // a few seconds: the spotlight moves on, sparks fly
  assert.ok(new Set(spots).size >= 3, `the regions take turns: ${spots.join(', ')}`);

  render(AsciiBrain, { ...props, flinch: 1 });
  run(3);
  const anger = 3 + shape.PATCHES.findIndex((p) => p.world === 'anger');
  assert.ok(draws.filter((a) => a[2] / a[3] === anger).length > 200, 'a wrong password turns the brain red');

  // a tap lights the region under it
  const tapAt = draws.find((a) => a[2] / a[3] >= 3);
  listeners.get('pointerdown')({ pointerId: 1, clientX: tapAt[5] + 4, clientY: tapAt[6] + 6 });
  listeners.get('pointerup')({ pointerId: 1, clientX: tapAt[5] + 4, clientY: tapAt[6] + 6 });
  run(2);

  render(AsciiBrain, { ...props, flinch: 1, diving: true });
  const before = run(1);
  const after = run(30);
  assert.ok(after < before / 3, `the letters burst away and fade: ${before} → ${after}`);
  dispose();
  assert.equal(listeners.size, 0, 'cleaned up');
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

test('the map heat draws feeling letters where entries gather, and one thread branches out from home to every place', async () => {
  const calls = { glyphs: [], puffs: 0 };
  const ctx = (kind) => new Proxy({}, {
    get: (_t, name) => name === 'drawImage'
      ? (...a) => { if (kind === 'glyph') calls.glyphs.push(a); else if (kind === 'cloud') calls.puffs++; }
      : name === 'createRadialGradient' || name === 'createLinearGradient' ? () => ({ addColorStop() {} })
      : () => {},
    set: () => true,
  });
  const canvas = (kind) => ({ width: 0, height: 0, getContext: () => ctx(kind) });
  const refs = [canvas('glyph'), canvas('cloud')];
  let frame = null;
  const props = { points: [{ x: 0.5, y: 0.5, core: 'joy', weight: 1.5 }], view: { x: 0.5, y: 0.5, z: 12 }, w: 300, h: 300 };
  const px = 1 / (256 * 2 ** 12); // one screen pixel in world units at zoom 12
  const { MapHeat } = await load('src/components/MapHeat.tsx', {
    'preact/hooks': { useRef: (v) => ({ current: refs.length ? refs.shift() : v }), useEffect: (fn) => fn() },
    './Sky': { RAMPS: { default: [' ', '.', ':', '+', '*', 'o', 'O', '#'], joy: [' ', '·', '.', '+', '*', 'o', 'O', '@'] } },
    'preact/jsx-runtime': { jsx: () => null, jsxs: () => null, Fragment: 'f' },
  }, {
    document: { createElement: () => canvas('atlas'), documentElement: { dataset: { theme: 'dark' } }, hidden: false, addEventListener() {}, removeEventListener() {} },
    getComputedStyle: () => ({ getPropertyValue: (n) => (n === '--emo-joy' ? '#eda100' : '#808080') }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    MutationObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (fn) => { frame = fn; return 1; }, cancelAnimationFrame() {},
    devicePixelRatio: 1,
  });
  MapHeat(props);
  let now = 1000;
  const step = (n) => { for (let i = 0; i < n; i++) { const f = frame; frame = null; f((now += 40)); } };
  step(40);
  assert.ok(calls.puffs > 0);
  const near = calls.glyphs.filter((a) => Math.hypot(a[5] - 150, a[6] - 150) < 80).length;
  assert.ok(near > 10, `letters around the entry: ${near}`);
  assert.equal(calls.glyphs.filter((a) => Math.hypot(a[5] - 150, a[6] - 150) > 140).length, 0);

  // a second place: the thread runs between them, through empty map, and is gone once there's only one place again
  props.points = [props.points[0], { x: 0.5 + 280 * px, y: 0.5 + 280 * px, core: 'sadness', weight: 1 }];
  props.view = { x: 0.5 + 140 * px, y: 0.5 + 140 * px, z: 12 };
  // well away from both places (on screen at 10,10 and 290,290), where only the thread's arc can put letters
  const middle = () => calls.glyphs.filter((a) => Math.hypot(a[5] - 10, a[6] - 10) > 110 && Math.hypot(a[5] - 290, a[6] - 290) > 110).length;
  calls.glyphs.length = 0;
  step(1);
  assert.ok(middle() > 0, 'letters along the thread');
  props.points = [props.points[0]];
  calls.glyphs.length = 0;
  step(1);
  assert.equal(middle(), 0);

  // the thread's shape: one tree from home (where most was felt), no going back and forth, thickest near home
  const { spillTree } = await load('src/components/MapHeat.tsx', {
    'preact/hooks': { useRef: () => ({}), useEffect() {} },
    './Sky': { RAMPS: { default: [' ', '#'] } },
    'preact/jsx-runtime': { jsx: () => null, jsxs: () => null, Fragment: 'f' },
  });
  const home = { x: 0.6, y: 0.4 }, d = 1e-3;
  const at = (x, y, core = 'joy', weight = 1) => ({ x, y, core, weight });
  // home, a trip north and back three times, and a branch east
  const pts = [at(home.x, home.y), at(home.x, home.y - d), at(home.x, home.y - 2 * d, 'fear'), at(home.x, home.y), at(home.x, home.y - 2 * d, 'fear'),
    at(home.x, home.y), at(home.x + 2e-8, home.y + 2e-8), at(home.x + d, home.y - d, 'sadness')];
  const tree = spillTree(pts);
  assert.equal(tree.length, 4, 'one node per place');
  assert.deepEqual([tree[0].x, tree[0].y].map((v) => +v.toFixed(6)), [home.x, home.y].map((v) => +v.toFixed(6)));
  assert.equal(tree[0].parent, -1);
  assert.equal(tree.filter((n) => n.parent >= 0).length, 3, 'n − 1 edges: a tree, so never two lines between places');
  tree.forEach((n, i) => i && assert.ok(n.parent < i && n.flow <= tree[n.parent].flow));
  assert.equal(Math.round(tree[0].flow * 1000), Math.round(pts.reduce((s, p) => s + p.weight, 0) * 1000));
  assert.equal(tree.find((n) => n.wi === 5)?.parent, tree.findIndex((n) => Math.abs(n.y - (home.y - d)) < 1e-9), 'the far place hangs off the nearer one');
  assert.equal(spillTree([]).length, 0);
});

test('writing again soon after uses the last location instead of asking the browser again', async () => {
  const store = new Map();
  let asked = 0, clock = 1_000_000;
  const { locate, forgetFix } = await load('src/lib/weather.ts', {
    './dates': { todayKey: () => '2026-10-01', addDays: () => '2026-08-01', keyOf: (d) => d.toISOString().slice(0, 10) },
    './store': { getEntries: () => [], getSettings: () => ({}), normalizeWeather: (w) => w, normalizePlace: (p) => p, annotateEntries: async () => {}, saveEntry: async () => {} },
  }, {
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) },
    navigator: { geolocation: { getCurrentPosition: (ok) => { asked++; ok({ coords: { latitude: 44.43, longitude: 26.1 } }); } } },
    Date: class extends Date { static now() { return clock; } },
  });
  const ten = 10 * 60_000;
  assert.deepEqual({ ...(await locate(ten)) }, { lat: 44.43, lon: 26.1 });
  assert.equal(asked, 1);
  clock += ten - 1000;
  await locate(ten);
  assert.equal(asked, 1, 'a fix from nine minutes ago is reused');
  await locate();
  assert.equal(asked, 2, 'asking on purpose always asks');
  clock += ten + 1;
  await locate(ten);
  assert.equal(asked, 3, 'an old fix is not');
  forgetFix();
  await locate(ten);
  assert.equal(asked, 4, 'nothing is reused once forgotten');
});

test('reused date formatters preserve English and Romanian labels, including invalid dates', async () => {
  for (const locale of ['en-GB', 'ro-RO']) {
    let made = 0;
    class DateTimeFormat extends Intl.DateTimeFormat { constructor(...args) { super(...args); made++; } }
    const dates = await load('src/lib/dates.ts', { './i18n': { ...i18n, LOCALE: locale } }, { Intl: { DateTimeFormat } });
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    for (const date of [new Date(2024, 1, 29, 0, 1), new Date(2025, 11, 31, 23, 59), new Date(2026, 9, 9, 12, 30)]) {
      for (let i = 0; i < 50; i++) {
        assert.equal(dates.timeLabel(+date), date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }));
        assert.equal(dates.formatDate(date, options), date.toLocaleDateString(locale, options));
      }
    }
    assert.equal(made, 2, 'one formatter per distinct format, shared by all rows');
    assert.equal(dates.timeLabel(NaN), new Date(NaN).toLocaleTimeString(locale));
    assert.equal(dates.formatDate(new Date(NaN), options), 'Invalid Date');
  }
});

test('lazy screens share pending loads, keep loaded screens synchronous and retry failures', async () => {
  let attempts = 0;
  const screen = deferred();
  function Journal() {}
  function Settings() {}
  const views = await load('src/lib/views.ts', {
    '../views/Journal': screen.promise,
    '../views/Settings': { get Settings() { if (++attempts === 1) throw new Error('Offline'); return Settings; } },
  });
  const first = views.prepareView('journal');
  assert.equal(views.prepareView('journal'), first);
  screen.resolve({ Journal });
  await first;
  assert.equal(views.viewFor('journal'), Journal);
  assert.equal(views.prepareView('journal'), undefined);
  await assert.rejects(views.prepareView('settings'), /Offline/);
  await views.prepareView('settings');
  assert.equal(views.viewFor('settings'), Settings);
  assert.equal(attempts, 2);
});

test('navigation waits for a screen and discards stale or unmounted loads', async () => {
  const h = componentHooks(), listeners = new Map(), location = { hash: '#/' }, root = rootElement();
  const journal = deferred(), settings = deferred(), brain = deferred();
  let failures = 0;
  const { useRoute } = await load('src/lib/router.ts', { 'preact/hooks': h.hooks }, {
    location, matchMedia: () => ({ matches: true }), console: { error() {} },
    document: { documentElement: root },
    history: { state: {}, replaceState(_state, _title, hash) { location.hash = hash; } },
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
  });
  const prepare = name => ({ journal, settings, brain }[name]?.promise);
  const render = () => h.render(() => useRoute(prepare, () => failures++));
  assert.equal(render().name, 'journal');
  location.hash = '#/settings'; listeners.get('hashchange')();
  assert.equal(render().name, 'journal', 'the current screen stays mounted while loading');
  location.hash = '#/brain'; listeners.get('hashchange')();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(root.hasAttribute('data-loading'), true, 'a slow load shows the loading bar');
  settings.resolve(); await settle();
  assert.equal(render().name, 'journal', 'an older slow navigation cannot replace the latest request');
  assert.equal(root.hasAttribute('data-loading'), true, 'the bar stays while a load is still pending');
  brain.resolve(); await settle();
  assert.equal(render().name, 'brain');
  assert.equal(root.hasAttribute('data-loading'), false, 'the bar goes once nothing is loading');
  location.hash = '#/note/new'; listeners.get('hashchange')();
  assert.equal(render().name, 'note', 'an already available screen navigates synchronously');
  // The pending request must also be discarded if the router unmounts.
  location.hash = '#/'; listeners.get('hashchange')();
  h.dispose(); journal.resolve(); await settle();
  assert.equal(listeners.has('hashchange'), false);
  assert.equal(failures, 0);
});

test('a sheet opened as another closes keeps its history entry, and the back button still closes it', async () => {
  const listeners = new Map();
  // the browser's session history: a traversal lands later, on the entry it was aimed at when asked
  const entries = [{}];
  let at = 0;
  const history = {
    get state() { return entries[at]; },
    pushState(state) { entries.length = ++at; entries.push(state); },
    replaceState(state) { entries[at] = state; },
    go(n) { const to = Math.max(0, at + n); setTimeout(() => { at = to; listeners.get('popstate')({ state: entries[at] }); }); },
    back() { this.go(-1); },
  };
  const { pushBack } = await load('src/lib/router.ts', {}, {
    location: { hash: '#/' }, matchMedia: () => ({ matches: true }), queueMicrotask, history,
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
  });
  const wait = () => new Promise((resolve) => setTimeout(resolve, 5));
  let more = true, icon = false;
  const releaseMore = pushBack(() => { more = false; });
  // More → Add icon: the menu's entry is released in the same tick the picker's is added
  releaseMore();
  const releaseIcon = pushBack(() => { icon = false; });
  icon = true;
  await wait();
  assert.equal(icon, true, 'the picker stays open');
  assert.equal(at, 1, 'one entry for the one open sheet');
  history.back(); await wait();
  assert.equal(icon, false, 'the back button closes the picker');
  assert.equal(at, 0);
  releaseIcon(); await wait();
  assert.equal(at, 0, 'releasing an already closed sheet goes nowhere');
  // closing on its own still pops its entry
  const release = pushBack(() => {});
  release(); await wait();
  assert.equal(at, 0);
  assert.equal(more, true, 'releasing never calls the sheet’s own close');
});

test('a failed screen load restores the current address and permits a retry', async () => {
  const h = componentHooks(), listeners = new Map(), location = { hash: '#/people' };
  let failures = 0, attempt = 0;
  const { useRoute } = await load('src/lib/router.ts', { 'preact/hooks': h.hooks }, {
    location, matchMedia: () => ({ matches: true }), console: { error() {} }, document: { documentElement: rootElement() },
    history: { state: { mmInApp: 1 }, replaceState(_state, _title, hash) { location.hash = hash; } },
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener() {},
  });
  const prepare = () => ++attempt === 1 ? Promise.reject(new Error('Offline')) : Promise.resolve();
  const render = () => h.render(() => useRoute(prepare, () => failures++));
  render();
  location.hash = '#/settings'; listeners.get('hashchange')(); await settle();
  assert.equal(render().name, 'people'); assert.equal(location.hash, '#/people'); assert.equal(failures, 1);
  location.hash = '#/settings'; listeners.get('hashchange')(); await settle();
  assert.equal(render().name, 'settings');
  h.dispose();
});

test('offscreen photos defer database reads but remain responsive to arriving photos once visible', async () => {
  const h = componentHooks(), records = new Map();
  let reads = 0;
  const photos = await load('src/lib/photos.ts', {
    'preact/hooks': h.hooks,
    './db': { db: {
      photo: async id => { reads++; return records.get(id); },
      putPhotos: async list => list.forEach(photo => records.set(photo.id, photo)),
    } },
  });
  const render = active => h.render(() => photos.usePhotoUrl('p1234567', active));
  assert.equal(render(false), null); await settle(); assert.equal(reads, 0);
  render(true); await settle(); assert.equal(reads, 1);
  await photos.storePhotos([{ id: 'p1234567', w: 20, h: 10, blob: new Blob(['photo']) }]);
  assert.match(render(true), /^blob:/);
  h.dispose();
});

test('people indexes are shared across cards and refreshed when the people collection changes', async () => {
  let people = [{ id: 'a', name: 'Ada' }];
  const h1 = componentHooks(), h2 = componentHooks();
  let currentHooks = h1.hooks;
  const { usePeopleById } = await load('src/components/people.tsx', {
    'preact/hooks': { useMemo: (...args) => currentHooks.useMemo(...args) },
    '../lib/store': { usePeople: () => people },
  });
  const first = h1.render(usePeopleById);
  currentHooks = h2.hooks;
  assert.equal(h2.render(usePeopleById), first, 'all cards reuse the same lookup');
  people = [{ id: 'a', name: 'Ada updated' }];
  const updated = h2.render(usePeopleById);
  assert.notEqual(updated, first); assert.equal(updated.get('a').name, 'Ada updated');
});

test('the brain stops drawing while covered, hidden or out of view and releases all animation work', async () => {
  const effects = [], listeners = new Map(), frames = new Map(), observers = [];
  let nextFrame = 0, viewed, covered = false, draws = 0, resize;
  const root = { hasAttribute: () => covered };
  const document = { documentElement: root, hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const context = { setTransform() {}, clearRect() { draws++; }, fillText() {} };
  const canvas = { getContext: () => context, parentElement: { getBoundingClientRect: () => ({ width: 320 }) }, style: {} };
  const shape = await load('src/lib/brainShape.ts');
  let ref = 0;
  const { BrainCanvas } = await load('src/components/Brain.tsx', {
    'preact/hooks': { useRef: value => ({ current: ref++ === 0 ? canvas : value }), useEffect: fn => effects.push(fn) },
    'preact/jsx-runtime': { jsx, jsxs: jsx },
    '../lib/brainShape': shape,
    '../lib/brain': { ZONES: Object.fromEntries(shape.PATCHES.map(p => [p.world, {}])) },
    '../lib/inView': { watchView: (_el, cb) => { viewed = cb; return () => { viewed = null; }; } },
    './Sky': { RAMPS: Object.fromEntries(['default', ...shape.PATCHES.map(p => p.world)].map(world => [world, [' ', '.', '#']])) },
  }, {
    document, devicePixelRatio: 1, performance: { now: () => 100 },
    getComputedStyle: () => ({ getPropertyValue: () => '#808080' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} disconnect() {} },
    MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} disconnect() {} },
  });
  const regions = Object.fromEntries(shape.PATCHES.map(p => [p.world, { level: 0 }]));
  BrainCanvas({ brain: { lead: null, entries: 0, alive: 0, force: 0, regions }, selected: null, onPick() {} });
  const cleanups = effects.map(fn => fn());
  assert.equal(frames.size, 0);
  const drawn = draws; resize(); assert.equal(draws, drawn, 'unchanged size does not rebuild or redraw the brain');
  viewed(true); assert.equal(frames.size, 1);
  covered = true; observers[0]([{ attributeName: 'data-covered' }]); assert.equal(frames.size, 0);
  covered = false; observers[0]([{ attributeName: 'data-covered' }]); assert.equal(frames.size, 1);
  document.hidden = true; listeners.get('visibilitychange')(); assert.equal(frames.size, 0);
  document.hidden = false; listeners.get('visibilitychange')(); assert.equal(frames.size, 1);
  viewed(false); assert.equal(frames.size, 0);
  viewed(true);
  cleanups.forEach(cleanup => cleanup?.());
  assert.equal(frames.size, 0); assert.equal(listeners.size, 0); assert.equal(viewed, null);
});

test('README card excerpts keep prose without badges, code, tables or interactive markup', async () => {
  const { readmeExcerpt } = await load('src/components/Readme.tsx');
  assert.equal(readmeExcerpt('# Project\n\n[![Build](https://example.com/badge.svg)](https://example.com)\n\nA **small** tool with [docs](guide.md) and `code`.\n\n```sh\nnpm install\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |'), 'A small tool with docs and code.');
  assert.equal(readmeExcerpt('<!-- hidden -->\n<img src="https://example.com/a.png">'), '');
  assert.equal(readmeExcerpt('# Only a title'), 'Only a title');
  assert.equal(readmeExcerpt('<p>Hello <b>world</b></p>'), 'Hello world');
  assert.equal(readmeExcerpt('Read [the guide][docs].\n\n[docs]: https://example.com'), 'Read the guide.');
  assert.ok(readmeExcerpt('Long introduction '.repeat(100)).length <= 280);
});

test('README requests share memory cache and forget it on refresh or disconnect', async () => {
  let calls = 0;
  const { getReadme, forgetRepos } = await load('src/lib/github.ts', { './retry': await load('src/lib/retry.ts') }, {
    fetch: async () => { calls++; return { ok: true, json: async () => ({ text: '# Hello' }) }; },
  });
  await Promise.all([getReadme(1), getReadme('1')]);
  assert.equal(calls, 1);
  forgetRepos();
  await getReadme(1);
  assert.equal(calls, 2);
});

test('a GitHub request that stalls gives up with a timeout, once, instead of spinning', async () => {
  let calls = 0, signal;
  const { getGhRepo } = await load('src/lib/github.ts', { './retry': await load('src/lib/retry.ts', {}, { navigator: { onLine: true }, setTimeout: (fn) => setImmediate(fn) }) }, {
    AbortSignal,
    fetch: async (_url, init) => { calls++; signal = init.signal; throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); },
  });
  await assert.rejects(getGhRepo(1), (e) => e.status === 504 && /took too long/.test(e.message));
  assert.equal(calls, 1, 'a timeout is not tried again');
  assert.ok(signal instanceof AbortSignal, 'the request carries a deadline');
});

test('reads are tried again when the server can’t be reached, but not when it answered', async () => {
  const { retry } = await load('src/lib/retry.ts', {}, { navigator: { onLine: true }, setTimeout: (fn) => setImmediate(fn) });
  let calls = 0;
  const flaky = (failures, status) => () => (++calls <= failures ? Promise.reject(Object.assign(new Error('x'), { status })) : Promise.resolve('ok'));
  assert.equal(await retry(flaky(2)), 'ok', 'a network failure (no status) is retried');
  assert.equal(calls, 3);
  calls = 0;
  assert.equal(await retry(flaky(1, 502)), 'ok', 'a redeploy’s bad gateway is retried');
  for (const status of [401, 404, 429, 504]) {
    calls = 0;
    await assert.rejects(retry(flaky(1, status)));
    assert.equal(calls, 1, `${status} is answered at once`);
  }
  calls = 0;
  await assert.rejects(retry(flaky(9)));
  assert.equal(calls, 4, 'gives up after three more tries');
});

test('with no connection, reads wait for it to come back instead of failing at once', async () => {
  const listeners = new Set();
  const nav = { onLine: false };
  const { retry } = await load('src/lib/retry.ts', {}, {
    navigator: nav,
    setTimeout: (fn, ms) => (ms >= 1000 ? setTimeout(fn, 50) : setImmediate(fn)),
    clearTimeout,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  });
  let calls = 0;
  const pending = retry(() => (++calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve('ok')));
  await new Promise((r) => setImmediate(r));
  assert.equal(listeners.size, 1, 'it waits for the connection');
  nav.onLine = true;
  for (const fn of [...listeners]) fn();
  assert.equal(await pending, 'ok');
  assert.equal(listeners.size, 0, 'and stops listening');

  nav.onLine = false;
  await assert.rejects(retry(() => Promise.reject(new Error('still offline'))), /still offline/, 'gives up when no connection comes back');
});

test('a login the server can’t be asked about is shown as kept, until the server says otherwise', async () => {
  const store = new Map();
  const localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const lastLogin = await load('src/lib/lastLogin.ts', {}, { localStorage });
  const { remember } = lastLogin;
  // plain objects, so they compare with this realm's
  const recall = (...args) => JSON.parse(JSON.stringify(lastLogin.recall(...args)));
  const offline = { configured: false, connected: false, offline: true };
  assert.deepEqual(recall('github', offline), offline, 'nothing known: offline, not connected');
  remember('github', { configured: true, connected: true, user: { name: 'octo' } });
  assert.deepEqual(recall('github', offline), { configured: true, connected: true, offline: true, user: { name: 'octo' } });
  remember('github', { configured: true, connected: true, error: 'GitHub didn’t answer.' });
  assert.equal(recall('github', offline).user.name, 'octo', 'a hiccup with no name keeps what was known');
  assert.equal(recall('spotify', offline).connected, false, 'each service is remembered apart');
  remember('github', { configured: true, connected: false });
  assert.deepEqual(recall('github', offline), offline, 'logged out is forgotten');
});

test('a README is shown as elements: pictures and links stay on GitHub, and nothing in it can run', async () => {
  const jsx = (type, props) => ({ type, props });
  const { Readme } = await load('src/components/Readme.tsx', { 'preact/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' } });
  // flatten the element tree into one list of what it shows
  const walk = (n, out = []) => {
    if (Array.isArray(n)) n.forEach((x) => walk(x, out));
    else if (n && typeof n === 'object') {
      if (typeof n.type === 'function') walk(n.type(n.props), out);
      else { out.push(n); walk(n.props?.children, out); }
    } else if (typeof n === 'string') out.push(n);
    return out;
  };
  const show = (text, base = { repo: 'octo/hello', branch: 'main', private: false }) => walk(Readme({ text, base }));
  const tags = (list, type) => list.filter((n) => n?.type === type);

  const doc = show(`# Hello

Some **bold** and a [link](docs/guide.md) and [bad](javascript:alert(1)) and ![logo](./img/logo.png)

<img src="https://example.com/a.png" alt="badge">
<script>alert(1)</script>

| a | b |
|---|---|
| 1 | 2 |

- [x] done
- item

\`\`\`js
const x = 1;
\`\`\``);
  const links = tags(doc, 'a').map((a) => a.props.href);
  assert.deepEqual(links, ['https://github.com/octo/hello/blob/main/docs/guide.md'], 'a javascript: address is never a link');
  assert.deepEqual(tags(doc, 'img').map((i) => i.props.src), ['https://raw.githubusercontent.com/octo/hello/main/img/logo.png', 'https://example.com/a.png']);
  assert.equal(tags(doc, 'script').length, 0, 'tags are dropped, not passed on');
  assert.equal(tags(doc, 'table').length, 1);
  assert.equal(tags(doc, 'pre')[0].props['data-lang'], 'js');
  assert.ok(doc.includes('const x = 1;'));

  // a private repo's own pictures can't be fetched without its token, so only their text is left
  const secret = show('![diagram](docs/a.png) and ![logo](https://example.com/l.png) and ![plain](http://example.com/l.png)', { repo: 'octo/hello', branch: 'main', private: true });
  assert.deepEqual(tags(secret, 'img').map((i) => i.props.src), ['https://example.com/l.png'], 'https pictures from elsewhere stay; http and relative ones are dropped');
});

test('a public note’s link opens just that note: no sign-in check, no journal storage', async () => {
  const rendered = [];
  const touched = [];
  const token = 'Ab_-'.repeat(8);
  function Shared() {}
  await load('src/main.tsx', {
    preact: { render: (tree) => rendered.push(tree) }, 'preact/jsx-runtime': { jsx, jsxs: jsx },
    './app': { App() {} }, './lib/db': { onBlocked() {} },
    './lib/weather': { startWeather: () => touched.push('weather') }, './lib/sync': { initSync: () => touched.push('sync') }, './lib/status': { initStatus: () => touched.push('status') },
    './lib/store': { applyTheme() {}, init: async () => touched.push('init') },
    './lib/auth': { signedInHere: () => touched.push('signedInHere'), authStatus: async () => touched.push('authStatus'), opensOn: () => 'intro' },
    './lib/router': { routeName: () => 'journal' }, './lib/views': { preloadViews() {}, prepareView: () => touched.push('views') },
    './views/Shared': { Shared },
  }, {
    navigator: {}, addEventListener() {}, location: { pathname: `/s/${token}` },
    document: { getElementById: () => ({}), querySelector: () => null, addEventListener() {} },
  });
  await settle(); await settle();
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].type, Shared);
  assert.equal(rendered[0].props.token, token);
  assert.deepEqual(touched, []);
});

test('a public status’s link opens just the latest check-in: no sign-in check, no journal storage', async () => {
  const rendered = [];
  const touched = [];
  const token = 'Zz9_'.repeat(8);
  function Status() {}
  await load('src/main.tsx', {
    preact: { render: (tree) => rendered.push(tree) }, 'preact/jsx-runtime': { jsx, jsxs: jsx },
    './app': { App() {} }, './lib/db': { onBlocked() {} },
    './lib/weather': { startWeather: () => touched.push('weather') }, './lib/sync': { initSync: () => touched.push('sync') }, './lib/status': { initStatus: () => touched.push('status') },
    './lib/store': { applyTheme() {}, init: async () => touched.push('init') },
    './lib/auth': { signedInHere: () => touched.push('signedInHere'), authStatus: async () => touched.push('authStatus'), opensOn: () => 'intro' },
    './lib/router': { routeName: () => 'journal' }, './lib/views': { preloadViews() {}, prepareView: () => touched.push('views') },
    './views/Status': { Status },
  }, {
    navigator: {}, addEventListener() {}, location: { pathname: `/status/${token}` },
    document: { getElementById: () => ({}), querySelector: () => null, addEventListener() {} },
  });
  await settle(); await settle();
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].type, Status);
  assert.equal(rendered[0].props.token, token);
  assert.deepEqual(touched, []);
});

test('the wheel keeps your order, hidden places and groups, and new places still turn up', async () => {
  const wheel = await load('src/data/wheel.ts');
  const store = new Map();
  const localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const observable = (value) => ({ get: () => value, set(v) { value = v; }, use: () => value });
  const mod = await load('src/lib/wheelLayout.ts', { '../data/wheel': wheel, './store': { observable } }, { localStorage });
  const ids = (tree) => plain(tree.map((n) => (n.kids ? [n.id, n.kids.map((k) => k.id)] : n.id)));

  assert.deepEqual(ids(mod.treeOf(mod.defaultLayout())), ids(wheel.WHEEL), 'untouched, it is the wheel as shipped');

  // a save from before Mind traps existed, with Media moved into a group of your own and Repos hidden
  const saved = mod.normalize({
    top: ['journal', 'gwork', 'people', 'insights', 'settings', 'repos', 'nope'],
    kids: { gwork: ['media'], insights: ['stats', 'map', 'brain', 'twitch'] },
    hidden: ['repos', 'gone'],
    groups: { gwork: { name: 'Work', icon: 'folder', hue: 'fear' }, 'bad id': { name: 'x' } },
  });
  assert.deepEqual(plain(saved.kids.insights), ['stats', 'map', 'brain', 'twitch'], 'your own grouping stays as you left it');
  assert.deepEqual(plain(saved.kids.learn), ['traps', 'laws', 'friends'], 'new places land in their usual group, which turns up too');
  assert.deepEqual(plain(saved.hidden), ['repos']);
  assert.deepEqual(plain(Object.keys(saved.groups)), ['gwork']);
  assert.deepEqual(ids(mod.treeOf(saved)), ['journal', ['gwork', ['media']], 'people', ['insights', ['stats', 'map', 'brain', 'twitch']], ['learn', ['traps', 'laws', 'friends']], ['extras', ['status', 'countdown']], 'settings']);
  const loose = mod.normalize({ ...mod.defaultLayout(), top: ['stats', ...mod.defaultLayout().top], kids: { insights: ['map'] } });
  assert.equal(mod.treeOf(loose)[0].hue, 'hope-interest', 'a place taken out of its group keeps the group’s colour');

  // every place exactly once, even from a broken save
  const broken = mod.normalize({ top: ['journal', 'journal', 'insights'], kids: { insights: ['journal', 'stats', 'stats'] } });
  const all = [...broken.top.filter((id) => !broken.kids[id]), ...Object.values(broken.kids).flat()];
  assert.equal(new Set(all).size, all.length);
  assert.equal(all.length, wheel.WHEEL.reduce((n, x) => n + (x.kids?.length ?? 1), 0));

  // a group with everything in it hidden leaves the wheel; saving the default forgets the save
  const empty = mod.normalize({ ...mod.defaultLayout(), hidden: ['stats', 'map', 'brain', 'twitch', 'traps'] });
  assert.ok(!mod.treeOf(empty).some((n) => n.id === 'insights'));
  mod.saveLayout(saved);
  assert.ok(store.has('mm-wheel-layout'));
  mod.saveLayout(mod.defaultLayout());
  assert.ok(!store.has('mm-wheel-layout'));
});

test('book and picture searches give up on a stalled request with a readable message', async () => {
  for (const [file, run, message] of [
    ['src/lib/books.ts', (m) => m.searchBooks('dune'), /Can’t reach Open Library/],
    ['src/lib/images.ts', (m) => m.searchImages('sea'), /Can’t reach Openverse/],
  ]) {
    let signal;
    const fetch = async (_url, init) => {
      signal = init?.signal;
      throw new DOMException('The operation timed out.', 'TimeoutError');
    };
    const lib = await load(file, {}, { fetch, AbortSignal, DOMException });
    await assert.rejects(run(lib), message);
    assert.ok(signal instanceof AbortSignal, `${file} sets a deadline on its request`);
  }
});
