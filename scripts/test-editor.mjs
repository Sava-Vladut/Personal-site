import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';
import { i18n } from './i18n-stub.mjs';

// Exercise the actual component handlers with deferred photo storage and a small
// hook renderer. Dependencies are isolated; no browser or user's database is used.
async function compile(input) {
  const bundle = await rolldown({
    input,
    external: (id, importer) => Boolean(importer) && !/(?:^|\/)lib\/body(?:\.ts)?$/.test(id),
    plugins: /SpotifySheet\.tsx$/.test(input) ? [{
      name: 'expose-component-handlers',
      transform(source, id) {
        if (id.endsWith('/SpotifySheet.tsx')) return source + '\nexport { SearchTab };';
      },
    }] : [],
  });
  try {
    return (await bundle.generate({ format: 'cjs' })).output[0].code;
  } finally {
    await bundle.close();
  }
}

let editorCode, peopleCode, personCode, trackerCode, bookCode, songCode, imageCode, spotifyCode, mediaCode, homeCode;
before(async () => {
  [editorCode, peopleCode, personCode, trackerCode, bookCode, songCode, imageCode, spotifyCode, mediaCode, homeCode] = await Promise.all([
    'src/views/Editor.tsx', 'src/components/people.tsx', 'src/views/Person.tsx', 'src/views/Tracker.tsx',
    'src/views/Book.tsx', 'src/views/Song.tsx', 'src/components/ImageSearchSheet.tsx',
    'src/components/SpotifySheet.tsx', 'src/components/NoteMedia.tsx', 'src/components/weather.tsx',
  ].map(compile));
});
const settle = () => new Promise((resolve) => setImmediate(resolve));
const photo = { id: 'pphoto123', w: 100, h: 100 };
const file = { name: 'photo.jpg', type: 'image/jpeg' };

function harness(code, initial = {}) {
  let cursor = 0;
  let mounted = true;
  const slots = [];
  const effects = [];
  const timers = new Map();
  const frames = new Map();
  const messages = [];
  const delays = []; // what each timer was set to wait (the harness runs them when asked, whatever they say)
  const navigations = [];
  const listeners = new Map();
  const documentListeners = new Map();
  // like the store, every change to the notes is heard by whoever listens (onEntries)
  const entrySubs = new Set();
  const entries = new Map();
  const putEntry = entries.set.bind(entries);
  entries.set = (id, e) => { putEntry(id, e); entrySubs.forEach((f) => f()); return entries; };
  const entry = {
    id: 'note-1', kind: 'note', title: 'Before', text: 'Existing words',
    date: '2026-09-27', dateEnd: null, time: 1, icon: null, emotions: [], intensity: 3,
    photos: [], images: [], music: [], people: [], cover: null,
    ...initial.entry,
  };
  entries.set(entry.id, entry);
  const people = new Map((initial.people ?? []).map((p) => [p.id, p]));
  const books = new Map((initial.books ?? []).map((b) => [b.id, b]));
  const songs = new Map((initial.songs ?? []).map((s) => [s.id, s]));
  let resolveImport, rejectImport;
  const importing = new Promise((resolve, reject) => { resolveImport = resolve; rejectImport = reject; });
  const hooks = {
    useState(value) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value;
      return [slots[i], (next) => {
        if (mounted) slots[i] = typeof next === 'function' ? next(slots[i]) : next;
      }];
    },
    useRef(value) {
      const i = cursor++;
      return slots[i] ??= { current: value };
    },
    useMemo(fn) { cursor++; return fn(); },
    useEffect(fn, deps) {
      const i = cursor++;
      const previous = slots[i];
      if (!previous || deps.some((d, j) => d !== previous.deps[j])) {
        slots[i] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  hooks.useLayoutEffect = hooks.useEffect;
  const modules = new Map();
  const child = (name) => Object.defineProperty(() => {}, 'name', { value: name });
  const store = {
    getEntries: () => [...entries.values()], getPeople: () => [...people.values()],
    getBooks: () => [...books.values()], getSongs: () => [...songs.values()],
    saveEntry: initial.saveEntry ?? (async (e) => { entries.set(e.id, e); return e; }),
    savePerson: initial.savePerson ?? (async (p) => { people.set(p.id, p); return p; }),
    saveBook: initial.saveBook ?? (async (b) => { books.set(b.id, b); return b; }),
    saveSong: initial.saveSong ?? (async (s) => { songs.set(s.id, s); return s; }),
    deletePerson: async (id) => { const p = people.get(id); people.delete(id); return p; },
    deleteBook: async (id) => { const b = books.get(id); books.delete(id); return b; },
    deleteSong: async (id) => { const s = songs.get(id); songs.delete(id); return s; },
    blankPerson: (name = '') => ({ id: 'person-new', name, text: '', emotions: [], relation: '' }),
    blankEntry: (kind) => ({ ...entry, id: 'checkin-new', kind }),
    deleteEntry: async (id) => { const old = entries.get(id); entries.delete(id); return old; },
    toast: (message) => messages.push(message), isEmpty: initial.isEmpty ?? (() => false),
    usePeople: () => [...people.values()], useEntries: () => initial.entries ?? [], onEntries: (f) => { entrySubs.add(f); return () => entrySubs.delete(f); }, useBooks: () => [...books.values()], useSongs: () => [...songs.values()],
    useSettings: () => ({ picker: 'grid' }),
    BOOK_STATUSES: ['want', 'reading', 'read', 'dnf'], MAX_PERSON_EMOTIONS: 3,
  };
  const context = {
    exports: {},
    require(id) {
      if (id === 'preact/hooks') return hooks;
      if (id.endsWith('/i18n')) return i18n;
      if (id === 'preact/compat') return { flushSync(fn) { fn(); initial.onFlush?.(); }, createPortal: (node) => node };
      if (id === 'preact/jsx-runtime') return { jsx: vnode, jsxs: vnode, Fragment: 'fragment' };
      const override = Object.entries(initial.modules ?? {}).find(([suffix]) => id.endsWith(suffix));
      if (override) return override[1];
      if (id.endsWith('/store')) return store;
      if (id.endsWith('/router')) return { goBack() { navigations.push('back'); }, navigate(to) { navigations.push(to); } };
      if (id.endsWith('/photos')) return { addPhotos: () => importing };
      if (id.endsWith('/lib/links')) return { linkedFrom: () => [], linkRanges: () => [], suggestLinks: () => [], typedLink: () => null, linkOf: (e) => `[[note:${e.id}|${e.title}]]`, noteLabel: (e) => e.title };
      if (!modules.has(id)) modules.set(id, new Proxy({}, { get: (_, name) => child(name) }));
      return modules.get(id);
    },
    setTimeout(fn, ms) { const id = {}; timers.set(id, fn); delays.push(ms); return id; },
    queueMicrotask: (fn) => queueMicrotask(fn),
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    document: {
      addEventListener(type, fn) { if (!documentListeners.has(type)) documentListeners.set(type, new Set()); documentListeners.get(type).add(fn); },
      removeEventListener(type, fn) { documentListeners.get(type)?.delete(fn); },
      activeElement: null,
      execCommand: initial.execCommand ?? (() => false),
    },
    requestAnimationFrame(fn) { const id = {}; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    getSelection: () => ({ isCollapsed: true }), HTMLDivElement: class {},
    history: { state: {}, replaceState() {} }, location: { hash: '#/note/note-1' },
    confirm: () => true, scrollTo() {}, navigator: {},
    // the time, when a test sets it
    ...(initial.clock && { Date: class extends Date { static now() { return initial.clock(); } } }),
  };
  vm.runInNewContext(code, context);
  function vnode(type, props) { return { type, props }; }
  return {
    entries, people, books, songs, messages, delays, navigations, listeners, documentListeners, document: context.document, resolveImport, rejectImport,
    render(name = 'Editor', props = { id: entry.id, query: new URLSearchParams() }) {
      cursor = 0;
      const tree = context.exports[name](props);
      while (effects.length) effects.shift()();
      return tree;
    },
    unmount() {
      mounted = false;
      slots.forEach((slot) => slot?.cleanup?.());
    },
    timers() {
      // timers set by timers (the text written back, then saved) run too
      for (let pass = 0; pass < 10 && timers.size; pass++)
        for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
    },
    frames() {
      for (const [id, fn] of [...frames]) { frames.delete(id); fn(); }
    },
  };
}

function find(tree, predicate) {
  if (Array.isArray(tree)) {
    for (const node of tree) { const found = find(node, predicate); if (found) return found; }
  } else if (tree && typeof tree === 'object') {
    if (predicate(tree)) return tree;
    return find(tree.props?.children, predicate);
  }
}
const button = (tree, label) => find(tree, (n) => n.type === 'button' && (n.props['aria-label'] === label || n.props.children === label));
function importPhoto(tree, cover) {
  if (cover) return find(tree, (n) => n.type.name === 'NoteDetails').props.uploadCover(file);
  find(tree, (n) => n.type === 'input' && n.props.type === 'file').props.onChange({ currentTarget: { files: [file], value: '' } });
}

for (const cover of [false, true]) {
  const kind = cover ? 'cover' : 'body photo';
  test(`${kind}: finishing an import cannot resurrect a deleted note`, async () => {
    const h = harness(editorCode);
    let tree = h.render();
    importPhoto(tree, cover);
    tree = h.render();
    assert.equal(button(tree, 'Done').props.disabled, true);
    await button(tree, 'Delete note').props.onClick();
    // Completion can happen before navigation has unmounted the editor, too.
    h.resolveImport({ photos: [photo], failed: 0 });
    await settle();
    h.unmount();
    h.timers();
    assert.equal(h.entries.size, 0);
  });

  test(`${kind}: leaving cancels pending work without overwriting a reopened note`, async () => {
    const h = harness(editorCode);
    importPhoto(h.render(), cover);
    h.unmount();
    const newer = { ...h.entries.get('note-1'), text: 'Written after reopening' };
    h.entries.set(newer.id, newer);
    h.resolveImport({ photos: [photo], failed: 0 });
    await settle();
    h.timers();
    assert.equal(h.entries.get(newer.id), newer);
    assert.match(h.messages[0], /import cancelled/);
  });

  test(`${kind}: successful import preserves edits made while it was loading`, async () => {
    const h = harness(editorCode);
    let tree = h.render();
    importPhoto(tree, cover);
    find(tree, (n) => n.type === 'textarea' && n.props['aria-label'] === 'Title').props.onInput({ currentTarget: { value: 'While importing' } });
    h.resolveImport({ photos: [photo], failed: 0 });
    await settle();
    tree = h.render();
    h.timers();
    const saved = h.entries.get('note-1');
    assert.equal(saved.title, 'While importing');
    assert.equal(cover ? saved.cover.photo.id : saved.photos[0].id, photo.id);
    assert.equal(button(tree, 'Done').props.disabled, false);
  });

  test(`${kind}: storage failure restores navigation and explains the failure`, async () => {
    const h = harness(editorCode);
    importPhoto(h.render(), cover);
    h.rejectImport(new Error('Storage full'));
    await settle();
    assert.equal(button(h.render(), 'Done').props.disabled, false);
    assert.match(h.messages[0], /Couldn’t save/);
  });
}

test('submitting an exact name chooses that person rather than a recent partial match', () => {
  const people = [{ id: 'ann', name: 'Ann', relation: '' }, { id: 'anna', name: 'Anna', relation: '' }];
  const h = harness(peopleCode, { people, entries: [{ people: ['anna'], time: 100 }, { people: ['ann'], time: 1 }] });
  let selected;
  const props = { open: true, selected: [], onClose() {}, onChange(ids) { selected = ids; } };
  let tree = h.render('PeopleSheet', props);
  find(tree, (n) => n.type === 'input').props.onInput({ currentTarget: { value: 'Ann' } });
  tree = h.render('PeopleSheet', props);
  find(tree, (n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(selected.length, 1);
  assert.equal(selected[0], 'ann');
});

const person = { id: 'ann', name: 'Ann', relation: '', text: '', emotions: [], icon: null };
const book = { id: 'book-1', title: 'Before', authors: '', text: '', emotions: [], from: null, status: 'want', pages: null, page: null, rating: 0, started: null, finished: null, year: null };
const song = { id: 'song-1', text: '', emotions: [], from: null, music: { kind: 'track', id: 'track-1', title: 'Song' } };
const personModules = { '/People': { useMoments: () => new Map(), usePages: () => new Map() }, '/lib/people': { monthsOf: () => [], trendOf: () => null }, '/mentions': { renamePersonMentions: () => [] } };
const bookModules = { '/books': { mentionsByBook: () => new Map(), STATUS_LABEL: {}, progressOf: () => null, renameMentions: () => [] } };
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

test('person: Done saves the last edit even before another render', async () => {
  const h = harness(personCode, { people: [person], modules: personModules });
  const tree = h.render('PersonView', { id: person.id });
  find(tree, (n) => n.type === 'textarea' && n.props['aria-label'] === 'Name').props.onInput({ currentTarget: { value: 'Anne' } });
  await button(tree, 'Done').props.onClick();
  assert.equal(h.people.get(person.id).name, 'Anne');
  assert.deepEqual(h.navigations, ['back']);
});

test('person: a new tag waits until the person has been stored', async () => {
  const saving = deferred();
  const h = harness(personCode, { modules: personModules, savePerson: () => saving.promise });
  let tree = h.render('PersonView', { id: 'new' });
  find(tree, (n) => n.type === 'textarea' && n.props['aria-label'] === 'Name').props.onInput({ currentTarget: { value: 'Ann' } });
  tree = h.render('PersonView', { id: 'new' });
  const writing = find(tree, (n) => n.type === 'button' && n.props.children?.includes?.('Check in')).props.onClick();
  assert.deepEqual(h.navigations, []);
  saving.resolve(person);
  await writing;
  assert.deepEqual(h.navigations, ['tracker?person=person-new']);
});

for (const [name, code, initial, props, label] of [
  ['note', () => editorCode, {}, undefined, 'Title'],
  ['person', () => personCode, { people: [person], modules: personModules }, { id: person.id }, 'Name'],
  ['book', () => bookCode, { books: [book], modules: bookModules }, { id: book.id }, 'Title'],
  ['music', () => songCode, { songs: [song] }, { id: song.id }, 'What it means to you'],
]) {
  test(`${name}: failed autosave keeps the editor open and can be retried`, async () => {
    let calls = 0;
    const save = async () => { if (!calls++) throw new Error('Storage full'); return {}; };
    const h = harness(code(), { ...initial, saveEntry: save, savePerson: save, saveBook: save, saveSong: save });
    let tree = h.render(name === 'note' ? 'Editor' : name === 'music' ? 'SongView' : name === 'person' ? 'PersonView' : 'BookView', props);
    // a plain textarea, or the tag-aware text box on a song's page
    const area = find(tree, (n) => (n.type === 'textarea' && n.props['aria-label'] === label) || n.props?.label === label);
    assert.ok(area, `Missing ${label} textarea`);
    if (area.props.onInput) area.props.onInput({ currentTarget: { value: 'Changed' } });
    else area.props.onChange('Changed');
    await button(tree, 'Done').props.onClick();
    assert.deepEqual(h.navigations, []);
    assert.match(h.messages[0], /Couldn’t save/);
    await button(tree, 'Done').props.onClick();
    assert.deepEqual(h.navigations, ['back']);
  });
}

for (const kind of ['person', 'book']) {
  test(`${kind}: deleting a renamed item preserves the original mentions`, async () => {
    let renames = 0;
    const initial = kind === 'person'
      ? { people: [person], modules: { ...personModules, '/mentions': { renamePersonMentions() { renames++; return []; } } } }
      : { books: [book], modules: { '/books': { ...bookModules['/books'], renameMentions() { renames++; return []; } } } };
    const h = harness(kind === 'person' ? personCode : bookCode, initial);
    const tree = h.render(kind === 'person' ? 'PersonView' : 'BookView', { id: kind === 'person' ? person.id : book.id });
    find(tree, (n) => n.type === 'textarea' && n.props['aria-label'] === (kind === 'person' ? 'Name' : 'Title')).props.onInput({ currentTarget: { value: 'Changed' } });
    await button(tree, kind === 'person' ? 'Remove person' : 'Remove book').props.onClick();
    h.unmount();
    await settle();
    assert.equal(renames, 0);
  });
}

const trackerModules = {
  '/emotions': { EMOTION: { joy: { id: 'joy', depth: 0, core: 'joy', name: 'Joy' } }, FEELINGS: [], shortName: () => 'Joy' },
  '/dates': { todayKey: () => '2026-10-01', keyOf: (d) => d.toISOString().slice(0, 10) },
  '/stats': { streaks: () => ({ current: 0 }) },
  // a check-in asks Spotify what's playing as it opens (aebcf60); nothing is, here
  '/spotify': { nowPlaying: () => Promise.resolve({ playing: false }) },
};
function pickFeeling(h) {
  const props = { query: new URLSearchParams() };
  let tree = h.render('Tracker', props);
  find(tree, (n) => n.type.name === 'WorldGrid').props.onSelect('joy');
  tree = h.render('Tracker', props);
  find(tree, (n) => n.type.name === 'WorldDetail').props.onPick('joy');
  return h.render('Tracker', props);
}

test('check-in: repeated taps only save once while storage is pending', async () => {
  const saving = deferred();
  let calls = 0;
  const h = harness(trackerCode, { modules: trackerModules, saveEntry: () => { calls++; return saving.promise; } });
  const tree = pickFeeling(h);
  const log = button(tree, 'Log feeling').props.onClick;
  const first = log();
  await log();
  assert.equal(calls, 1);
  saving.resolve({});
  await first;
});

test('check-in: failed save retains the selected feeling for retry', async () => {
  let calls = 0;
  const h = harness(trackerCode, { modules: trackerModules, saveEntry: async () => { if (!calls++) throw new Error('Storage full'); } });
  await button(pickFeeling(h), 'Log feeling').props.onClick();
  assert.match(h.messages[0], /Couldn’t save/);
  const tree = h.render('Tracker', { query: new URLSearchParams() });
  assert.ok(button(tree, 'Log feeling'));
  await button(tree, 'Log feeling').props.onClick();
  assert.equal(calls, 2);
});

test('check-in: malformed world query starts with the world picker', () => {
  const h = harness(trackerCode, { modules: trackerModules });
  const tree = h.render('Tracker', { query: new URLSearchParams('world=missing') });
  assert.ok(find(tree, (n) => n.type.name === 'WorldGrid'));
});

test('image search: a failed replacement search discards old pagination', async () => {
  let calls = 0;
  const h = harness(imageCode, { modules: { '/images': { searchImages: async () => {
    if (!calls++) return { items: [{ url: 'image-1', title: 'First' }], next: 2 };
    throw new Error('Offline');
  }, imageSrc: (i) => i.url } } });
  const props = { open: true, onClose() {}, onAdd() {} };
  const search = async (q) => {
    let tree = h.render('ImageSearchSheet', props);
    find(tree, (n) => n.type === 'input').props.onInput({ currentTarget: { value: q } });
    tree = h.render('ImageSearchSheet', props);
    find(tree, (n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
    await settle();
    return h.render('ImageSearchSheet', props);
  };
  assert.ok(button(await search('first'), 'More images'));
  assert.equal(button(await search('second'), 'More images'), undefined);
});

test('media gestures: leaving while holding a picture clears listeners and the pickup timer', () => {
  let drags = 0;
  const h = harness(mediaCode);
  const tree = h.render('MediaBlock', { m: { kind: 'photo', id: photo.id }, draft: { photos: [photo], images: [] }, editing: true, selected: false, onDrag() { drags++; } });
  find(tree, (n) => n.type === 'button').props.onPointerDown({ pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 });
  assert.equal(h.listeners.get('pointermove').size, 1);
  h.unmount();
  h.timers();
  assert.equal(h.listeners.get('pointermove').size, 0);
  assert.equal(h.listeners.get('pointerup').size, 0);
  assert.equal(drags, 0);
});

test('home location: closing cancels a late geolocation selection', async () => {
  const locating = deferred();
  let selections = 0;
  const h = harness(homeCode, { modules: { '/weather': { here: () => locating.promise } } });
  const props = { open: true, onClose() {}, onPick() { selections++; } };
  const tree = h.render('HomeSheet', props);
  const locatingTask = find(tree, (n) => n.type === 'button' && n.props.class === 'person-pick').props.onClick();
  h.render('HomeSheet', { ...props, open: false });
  locating.resolve({ lat: 1, lon: 2 });
  await locatingTask;
  assert.equal(selections, 0);
});

test('check-in: invalid and future timestamps never reach storage', async () => {
  let calls = 0;
  const h = harness(trackerCode, { modules: trackerModules, saveEntry: async () => { calls++; } });
  let tree = pickFeeling(h);
  button(tree, 'When: now. Change time').props.onClick();
  for (const value of ['invalid', '9999-01-01T00:00']) {
    tree = h.render('Tracker', { query: new URLSearchParams() });
    find(tree, (n) => n.type === 'input' && n.props.type === 'datetime-local').props.onInput({ currentTarget: { value } });
    tree = h.render('Tracker', { query: new URLSearchParams() });
    await button(tree, 'Log feeling').props.onClick();
  }
  assert.equal(calls, 0);
  assert.equal(h.messages.length, 2);
});

test('Spotify: changing the query invalidates a request during the debounce', async () => {
  const old = deferred();
  let calls = 0;
  const h = harness(spotifyCode, { modules: { '/spotify': { searchSpotify: () => { calls++; return old.promise; } } } });
  const props = { row: (m) => ({ type: 'music-row', props: { children: m.title } }) };
  let tree = h.render('SearchTab', props);
  find(tree, (n) => n.type === 'input').props.onInput({ currentTarget: { value: 'old' } });
  tree = h.render('SearchTab', props);
  h.timers();
  assert.equal(calls, 1);
  find(tree, (n) => n.type === 'input').props.onInput({ currentTarget: { value: 'new' } });
  h.render('SearchTab', props);
  old.resolve({ items: [{ title: 'Stale music' }], next: 20 });
  await settle();
  tree = h.render('SearchTab', props);
  assert.equal(calls, 1, 'New search is still waiting for the debounce');
  assert.equal(find(tree, (n) => n.type === 'music-row'), undefined);
  assert.equal(button(tree, 'More results'), undefined);
});

for (const kind of ['person', 'book']) {
  test(`${kind}: a failed rename save cannot update mentions on leaving`, async () => {
    let renames = 0;
    const save = async () => { throw new Error('Storage full'); };
    const initial = kind === 'person'
      ? { people: [person], savePerson: save, modules: { ...personModules, '/mentions': { renamePersonMentions() { renames++; return []; } } } }
      : { books: [book], saveBook: save, modules: { '/books': { ...bookModules['/books'], renameMentions() { renames++; return []; } } } };
    const h = harness(kind === 'person' ? personCode : bookCode, initial);
    const tree = h.render(kind === 'person' ? 'PersonView' : 'BookView', { id: kind === 'person' ? person.id : book.id });
    find(tree, (n) => n.type === 'textarea' && n.props['aria-label'] === (kind === 'person' ? 'Name' : 'Title')).props.onInput({ currentTarget: { value: 'Changed' } });
    h.unmount();
    await settle();
    assert.equal(renames, 0);
  });
}

test('new note: deleting waits for its pending save and leaves no resurrected note', async () => {
  const saving = deferred();
  let h;
  h = harness(editorCode, { saveEntry: async (e) => { await saving.promise; h.entries.set(e.id, e); return e; } });
  const tree = h.render('Editor', { id: 'new', query: new URLSearchParams() });
  find(tree, (n) => n.type === 'textarea' && n.props['aria-label'] === 'Title').props.onInput({ currentTarget: { value: 'Pending' } });
  h.timers();
  const deleting = button(tree, 'Delete note').props.onClick();
  saving.resolve();
  await deleting;
  assert.equal(h.entries.has('checkin-new'), false);
});

test('note: repeated Done taps navigate once after a pending save', async () => {
  const saving = deferred();
  const h = harness(editorCode, { saveEntry: () => saving.promise });
  const tree = h.render();
  find(tree, (n) => n.type === 'textarea' && n.props['aria-label'] === 'Title').props.onInput({ currentTarget: { value: 'Changed' } });
  const done = button(tree, 'Done').props.onClick;
  const first = done();
  await done();
  assert.deepEqual(h.navigations, []);
  saving.resolve({});
  await first;
  assert.deepEqual(h.navigations, ['back']);
});

test('photo viewer: leaving a note cancels a pending photo lookup before opening', async () => {
  const photoLookup = deferred();
  let opens = 0;
  const h = harness(editorCode, {
    entry: { photos: [photo] },
    modules: {
      '/photos': { photoUrl: () => photoLookup.promise },
      '/viewer': { openViewer: () => { opens++; } },
    },
  });
  find(h.render(), (n) => n.type.name === 'NoteBody').props.onMedia([{ dom: {}, pos: 1, media: { kind: 'photo', id: photo.id } }]);
  const media = find(h.render(), node => node.type.name === 'MediaBlock');
  const pending = media.props.onOpen(null, 0);
  h.unmount();
  photoLookup.resolve('blob:photo');
  await pending;
  assert.equal(opens, 0);
});

for (const leave of [false, true]) {
  test(`new note context: geolocation replaces weather from home${leave ? ' after leaving' : ''}`, async () => {
    const context = deferred();
    const homeWeather = { day: '2026-09-27', temp: 10 };
    const actualWeather = { day: '2026-09-27', temp: 25 };
    const h = harness(editorCode, { entry: { weather: homeWeather }, modules: { '/weather': {
      contextNow: () => context.promise, needsWeather: () => false,
    } } });
    const tree = h.render('Editor', { id: 'new', query: new URLSearchParams() });
    find(tree, (n) => n.type === 'textarea' && n.props['aria-label'] === 'Title').props.onInput({ currentTarget: { value: 'Pending location' } });
    h.timers();
    await settle();
    if (leave) h.unmount();
    context.resolve({ place: { lat: 1, lon: 2, name: 'Here' }, weather: actualWeather });
    await settle();
    h.timers();
    assert.equal(h.entries.get('checkin-new').weather.temp, 25);
    assert.equal(h.entries.get('checkin-new').place.name, 'Here');
  });
}

/**
 * The note's editor (editor/NoteBody.tsx) as the Editor sees it, over a plain string: what's typed before the caret,
 * the tags put in, the caret and the focus. The real one, on its document, is tested in scripts/test-notedoc-edit.mjs.
 */
function mockNote(value, h) {
  const el = {};
  const n = {
    el, value, from: value.length, to: value.length, ver: 0, editable: true, focusCalls: 0, props: null,
    changed() { this.ver++; this.props?.onChange(); },
    text() { return this.value; },
    version() { return this.ver; },
    setText(t) { if (t !== this.value) { this.value = t; this.changed(); } },
    focused() { return h().document.activeElement === el; },
    setEditable(on) { this.editable = on; },
    focus(at) {
      this.focusCalls++;
      h().document.activeElement = el;
      if (at === 'end') this.from = this.to = this.value.length;
      if (at === 'start') this.from = this.to = 0;
    },
    posAt: () => null,
    selection() { return { from: this.from, to: this.to }; },
    setSelection(a, b = a) { this.from = a; this.to = b; },
    typed() {
      const m = /@([^\n@[\]]*)$/.exec(this.value.slice(0, this.from));
      return m ? { from: this.from - m[1].length - 1, to: this.from, q: m[1], link: false } : null;
    },
    trigger(sigil) {
      const before = this.value.slice(0, this.from);
      const add = (before && !/[\s([{]$/.test(before) ? ' ' : '') + sigil;
      this.value = before + add + this.value.slice(this.to);
      this.from = this.to = before.length + add.length;
      this.changed();
      return this.typed();
    },
    pick(t, token) {
      if (this.value.slice(t.from, t.to) !== '@' + t.q) return false;
      const after = this.value.slice(t.to);
      const add = token + (/^\s/.test(after) ? '' : ' ');
      this.value = this.value.slice(0, t.from) + add + after;
      this.from = this.to = t.from + add.length;
      this.changed();
      return true;
    },
    insertToken() {},
    rangeOf(a, b) { return this.range ? this.range(a, b) : null; },
    linkAt: () => ({ from: 0, to: 0, text: '', href: null }),
    lit: () => null,
    watch: () => () => {},
    cmds: {},
    media: { list: () => [], insert() {}, layout() {}, dropTargets: () => [], move() {}, writeAfter() {} },
  };
  return n;
}
const tagModules = {
  '/lib/weather': { contextNow: async () => null, needsWeather: () => false },
  '/lib/mentions': {
    suggest: (q, people) => people.filter((p) => p.name.toLowerCase().startsWith(q.trim().toLowerCase())).map((item) => ({ kind: 'person', item })),
    mentionOfPerson: (p) => `@[${p.name}]`,
  },
};
/** Renders the editor and hands it the mock note editor, as NoteBody does once it's mounted. */
function withNote(h, note, props) {
  let tree = h.render('Editor', props);
  const body = find(tree, (n) => n.type.name === 'NoteBody');
  note.props = body.props;
  body.props.onReady(note);
  tree = h.render('Editor', props);
  return tree;
}

function mentionEditor(source, initial = {}) {
  let h;
  const note = mockNote(source, () => h);
  h = harness(editorCode, { ...initial, entry: { text: source }, modules: { ...tagModules, ...initial.modules } });
  const props = { id: 'new', query: new URLSearchParams() };
  withNote(h, note, props);
  note.focus();
  note.changed();
  note.props.onTyped(note.typed());
  const tree = h.render('Editor', props);
  const strip = find(tree, (n) => n.type.name === 'FormatBar').props.swap;
  return { h, note, props, tree, strip };
}

test('tagging: what is typed after an @ brings up the suggestions, and Escape puts them away', () => {
  const { h, note, props, strip } = mentionEditor('@An', { people: [person] });
  assert.equal(strip.type.name, 'MentionStrip');
  assert.equal(strip.props.q, 'An');
  const tree = h.render('Editor', props);
  assert.equal(find(tree, (n) => n.type.name === 'NoteBody').props.suggestKey({ key: 'Escape' }), true);
  assert.equal(find(h.render('Editor', props), (n) => n.type.name === 'FormatBar').props.swap, null);
  // the same @ stays put away, until it's somewhere else
  note.props.onTyped(note.typed());
  assert.equal(find(h.render('Editor', props), (n) => n.type.name === 'FormatBar').props.swap, null);
});

test('tagging: IME Enter cannot accept a suggestion', async () => {
  const p = { ...person, emotions: [] };
  const { h, note, props } = mentionEditor('@An', { people: [p] });
  const body = find(h.render('Editor', props), (n) => n.type.name === 'NoteBody');
  assert.equal(body.props.suggestKey({ key: 'Enter', isComposing: true }), false);
  await settle();
  assert.equal(note.value, '@An');
  assert.equal(body.props.suggestKey({ key: 'Enter' }), true);
  await settle();
  assert.equal(note.value, '@[Ann] ');
});

test('tagging: selecting a person restores focus, inserts once, and attaches their ID', async () => {
  const p = { ...person, emotions: [] };
  const { h, note, strip } = mentionEditor('@An', { people: [p] });
  h.document.activeElement = null;
  await strip.props.onPick({ kind: 'person', item: p });
  await strip.props.onPick({ kind: 'person', item: p });
  h.timers();
  assert.equal(note.value, '@[Ann] ');
  assert.equal(h.document.activeElement, note.el);
  assert.deepEqual(Array.from(h.entries.get('checkin-new').people), [p.id]);
  assert.equal(h.entries.get('checkin-new').text, '@[Ann] ');
});

test('tagging: the animation measures the inserted tag after rendering and anchors to the note body', async () => {
  const calls = [], measured = [];
  const range = { getClientRects: () => [] };
  const p = { ...person, emotions: [] };
  const { h, note, tree, strip } = mentionEditor('@An', { people: [p], modules: {
    '/components/mentions': { MentionStrip() {}, burst: (...args) => calls.push(args) },
  } });
  const host = { isConnected: true };
  find(tree, n => n.props?.class?.startsWith('note-body')).props.ref.current = host;
  note.range = (from, to) => { measured.push([from, to]); return range; };
  await strip.props.onPick({ kind: 'person', item: p });
  assert.equal(calls.length, 0, 'measure after the inserted tag has rendered');
  h.frames();
  assert.deepEqual(measured, [[0, 1]], 'the tag is one character of the document');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], range, 'pass the range rather than its union box');
  assert.equal(calls[0][1], host);
});

test('tagging: a pending animation does not run after the note leaves or its words change', async () => {
  for (const reason of ['unmounted', 'changed']) {
    const calls = [];
    const p = { ...person, emotions: [] };
    const { h, note, tree, strip } = mentionEditor('@An', { people: [p], modules: {
      '/components/mentions': { MentionStrip() {}, burst: (...args) => calls.push(args) },
    } });
    find(tree, n => n.props?.class?.startsWith('note-body')).props.ref.current = { isConnected: true };
    note.range = () => ({});
    await strip.props.onPick({ kind: 'person', item: p });
    if (reason === 'unmounted') h.unmount();
    if (reason === 'changed') note.setText('Replaced before paint');
    h.frames();
    assert.equal(calls.length, 0, reason);
  }
});

test('tagging: a deleted suggestion never creates an attachment to a missing person', async () => {
  const p = { ...person, emotions: [] };
  const { h, note, strip } = mentionEditor('@An', { people: [p] });
  h.people.delete(p.id);
  await strip.props.onPick({ kind: 'person', item: p });
  assert.equal(note.value, '@An');
  assert.deepEqual(Array.from(h.entries.get('note-1').people), []);
});

test('tagging: a renamed suggestion uses the latest saved name', async () => {
  const p = { ...person, emotions: [] };
  const { h, note, strip } = mentionEditor('@An', { people: [p] });
  h.people.set(p.id, { ...p, name: 'Anne' });
  await strip.props.onPick({ kind: 'person', item: p });
  assert.equal(note.value, '@[Anne] ');
});

test('tagging: an unmatched multiword name can be created and is saved before attachment', async () => {
  const saving = deferred();
  let calls = 0;
  const { h, note, strip } = mentionEditor('@Ana Maria', { savePerson: async (p) => { calls++; await saving.promise; h.people.set(p.id, p); return p; } });
  assert.equal(strip.type.name, 'MentionStrip');
  assert.equal(strip.props.canAdd, true);
  const picking = strip.props.onAdd();
  await strip.props.onAdd();
  assert.equal(calls, 1);
  assert.equal(note.value, '@Ana Maria');
  saving.resolve();
  await picking;
  h.timers();
  assert.equal(note.value, '@[Ana Maria] ');
  assert.deepEqual(Array.from(h.entries.get('checkin-new').people), ['person-new']);
});

test('tagging: failed person creation preserves the query and note draft', async () => {
  const { h, note, strip } = mentionEditor('@Ana', { savePerson: async () => { throw new Error('Storage full'); } });
  await strip.props.onAdd();
  assert.equal(note.value, '@Ana');
  assert.match(h.messages[0], /Couldn’t save/);
  assert.equal(h.people.size, 0);
});

test('tagging: typing during person creation never overwrites later words', async () => {
  const saving = deferred();
  const { h, note, strip } = mentionEditor('@Ana', { savePerson: async (p) => { await saving.promise; h.people.set(p.id, p); return p; } });
  const picking = strip.props.onAdd();
  note.setText('@Ana is here');
  saving.resolve();
  await picking;
  h.timers();
  assert.equal(h.entries.get('checkin-new').text, '@Ana is here');
  assert.deepEqual(Array.from(h.entries.get('checkin-new').people), []);
});

test('tagging: the Mention button types an @ at the caret and immediately opens suggestions', () => {
  let h;
  const note = mockNote('Words', () => h);
  h = harness(editorCode, { entry: { text: '' }, modules: tagModules });
  const props = { id: 'new', query: new URLSearchParams() };
  let tree = withNote(h, note, props);
  find(tree, (n) => n.type.name === 'FormatBar').props.ribbon.mention(); // the ribbon's Mention (Insert tab)
  assert.equal(note.value, 'Words @');
  assert.equal(note.from, 7);
  assert.equal(h.document.activeElement, note.el);
  tree = h.render('Editor', props);
  assert.equal(find(tree, (n) => n.type.name === 'FormatBar').props.swap.type.name, 'MentionStrip');
  h.timers();
  assert.equal(h.entries.get('checkin-new').text, 'Words @');
});

test('iOS tagging: @ from reading view makes the words editable and focuses them within the same touch', () => {
  let h, flushed = 0;
  const note = mockNote('Words', () => h);
  h = harness(editorCode, { entry: { text: 'Words' }, modules: tagModules, onFlush() { flushed++; } });
  const props = { id: 'note-1', query: new URLSearchParams() };
  const tree = withNote(h, note, props);
  assert.equal(find(tree, (n) => n.type.name === 'NoteBody').props.editable, false, 'a note with words opens to read');
  note.editable = false;
  note.setSelection(0);
  find(tree, (n) => n.type.name === 'FormatBar').props.ribbon.mention(); // the ribbon's Mention (Insert tab)
  assert.equal(flushed, 1, 'the writing view is rendered before the focus');
  assert.equal(note.editable, true);
  assert.equal(note.focusCalls, 1, 'Focus happens before any animation frame runs');
  assert.equal(note.value, 'Words @', 'from reading, the @ goes at the end');
});

test('tagging: a decomposed name never offers creation of an existing composed name', async () => {
  const p = { ...person, name: 'Ána' };
  let saves = 0;
  const { h, strip } = mentionEditor('@Ána', { people: [p], savePerson: async () => { saves++; } });
  assert.equal(strip.props.canAdd, false);
  await strip.props.onAdd();
  assert.equal(saves, 0);
  assert.equal(h.people.size, 1);
});

test('tagging: a stale new-person option reuses a canonically equivalent saved person', async () => {
  const p = { ...person, name: 'Ána' };
  let saves = 0;
  const { h, note, strip } = mentionEditor('@Ána', { savePerson: async () => { saves++; } });
  assert.equal(strip.props.canAdd, true);
  h.people.set(p.id, p);
  await strip.props.onAdd();
  h.timers();
  assert.equal(saves, 0);
  assert.equal(h.people.size, 1);
  assert.equal(note.value, '@[Ána] ');
  assert.deepEqual(Array.from(h.entries.get('checkin-new').people), [p.id]);
});

for (const movement of ['caret', 'focus']) {
  test(`tagging: pending person creation preserves a moved ${movement} even when text is unchanged`, async () => {
    const saving = deferred();
    const { h, note, strip } = mentionEditor('@Ana', { savePerson: async (p) => { await saving.promise; h.people.set(p.id, p); return p; } });
    const picking = strip.props.onAdd();
    const otherBlock = {};
    if (movement === 'caret') note.setSelection(0);
    else h.document.activeElement = otherBlock;
    saving.resolve();
    await picking;
    h.timers();
    assert.equal(h.entries.get('checkin-new').text, '@Ana');
    assert.deepEqual(Array.from(h.entries.get('checkin-new').people), []);
    assert.equal(h.people.size, 1, 'The selected person is still saved');
    if (movement === 'caret') assert.equal(note.from, 0);
    else assert.equal(h.document.activeElement, otherBlock);
  });
}

test('pictures: a picture the editor shows opens full screen from its slot', async () => {
  let opened = null;
  let h;
  const note = mockNote('', () => h);
  h = harness(editorCode, {
    entry: { photos: [photo], text: '[[photo:pphoto123]]' },
    modules: { ...tagModules, '/photos': { photoUrl: async () => 'blob:photo' }, '/viewer': { openViewer: (items, at) => { opened = { items, at }; } } },
  });
  note.value = '\n[[photo:pphoto123]]\n';
  const props = { id: 'note-1', query: new URLSearchParams() };
  let tree = withNote(h, note, props);
  note.props.onMedia([{ dom: {}, pos: 1, media: { kind: 'photo', id: photo.id } }]);
  tree = h.render('Editor', props);
  await find(tree, (n) => n.type.name === 'MediaBlock').props.onOpen(null, 0);
  assert.equal(opened.items.length, 1);
  assert.equal(opened.items[0].src, 'blob:photo');
});

test('pictures: photos follow the words — one cut from the note waits, and comes back with it', () => {
  let h;
  const note = mockNote('', () => h);
  const marker = '\n[[photo:pphoto123]]\n';
  h = harness(editorCode, { entry: { photos: [photo], text: marker }, modules: tagModules });
  note.value = marker;
  withNote(h, note, { id: 'note-1', query: new URLSearchParams() });
  note.setText('');
  h.timers();
  assert.equal(h.entries.get('note-1').photos.length, 0);
  note.setText(marker);
  h.timers();
  assert.deepEqual(Array.from(h.entries.get('note-1').photos, (p) => p.id), [photo.id]);
});

/* ---------- saving: never losing words ---------- */

const title = (tree) => find(tree, (n) => n.type === 'textarea' && n.props['aria-label'] === 'Title');
/** An open note with words, its editor the mock above; the store's copy has an `updated` stamp, as saved ones do. */
function openNote(initial = {}) {
  let h;
  const note = mockNote('Existing words', () => h);
  h = harness(editorCode, { ...initial, entry: { text: 'Existing words', updated: 1, ...initial.entry }, modules: { ...tagModules, ...initial.modules } });
  const props = { id: 'note-1', query: new URLSearchParams() };
  withNote(h, note, props);
  return { h, note, props };
}

test('saving: writing on without a pause still saves every couple of seconds', () => {
  let now = 10_000;
  const { h, note } = openNote({ clock: () => now });
  note.setText('Existing words and');
  assert.equal(h.delays.at(-1), 300, 'a change waits for the next pause');
  now = 11_800;
  note.setText('Existing words and more');
  assert.equal(h.delays.at(-1), 200, 'but not past two seconds after the first change waiting');
  now = 12_500;
  note.setText('Existing words and more still');
  assert.equal(h.delays.at(-1), 0);
  h.timers();
  assert.equal(h.entries.get('note-1').text, 'Existing words and more still');
  // saved: the next change waits for its own pause again
  now = 12_600;
  note.setText('Existing words and more still, on');
  assert.equal(h.delays.at(-1), 300);
});

test('sync: a newer copy arriving while the note is open is taken up, and what is typed next goes on from it', () => {
  const { h, note, props } = openNote();
  const remote = { ...h.entries.get('note-1'), title: 'From the laptop', text: 'Written on the laptop', updated: 5 };
  h.entries.set('note-1', remote); // what sync's merge puts in the store
  let tree = h.render('Editor', props);
  assert.equal(note.value, 'Written on the laptop');
  h.timers();
  tree = h.render('Editor', props);
  assert.equal(title(tree).props.value, 'From the laptop');
  assert.equal(h.entries.get('note-1'), remote, 'taking it up saves nothing');
  note.setText('Written on the laptop, and on the phone');
  h.timers();
  assert.equal(h.entries.get('note-1').text, 'Written on the laptop, and on the phone');
  assert.equal(h.entries.get('note-1').title, 'From the laptop');
});

test('sync: a newer copy never replaces words here still waiting to be saved', () => {
  const { h, note, props } = openNote();
  note.setText('Typed here just now');
  h.entries.set('note-1', { ...h.entries.get('note-1'), text: 'Written on the laptop', updated: 5 });
  h.render('Editor', props);
  assert.equal(note.value, 'Typed here just now');
  h.timers();
  assert.equal(h.entries.get('note-1').text, 'Typed here just now');
});

test('sync: an older copy (or the one this page saved) changes nothing', () => {
  const { h, note, props } = openNote({ entry: { updated: 9 } });
  h.entries.set('note-1', { ...h.entries.get('note-1'), text: 'Older', updated: 3 });
  h.render('Editor', props);
  assert.equal(note.value, 'Existing words');
});

for (const reopened of [false, true]) {
  test(`leaving: a save that failed is tried again after the note has gone${reopened ? ', unless it was saved again since' : ''}`, async () => {
    let calls = 0;
    let h;
    const save = async (e) => { if (!calls++) throw new Error('Storage busy'); h.entries.set(e.id, e); return e; };
    ({ h } = openNote({ saveEntry: (e) => save(e) }));
    const tree = h.render('Editor', { id: 'note-1', query: new URLSearchParams() });
    title(tree).props.onInput({ currentTarget: { value: 'Last words' } });
    h.unmount(); // straight out (a swipe back, the app switched away) while it's waiting
    await settle();
    assert.equal(calls, 1);
    assert.match(h.messages[0], /Couldn’t save/);
    const newer = { ...h.entries.get('note-1'), title: 'Reopened and written in', updated: 7 };
    if (reopened) h.entries.set('note-1', newer);
    h.timers();
    await settle();
    if (reopened) assert.equal(h.entries.get('note-1'), newer);
    else assert.equal(h.entries.get('note-1').title, 'Last words');
  });
}

test('new note: one typed in and emptied again is not kept on leaving', async () => {
  const blank = (e) => !e.title.trim() && !e.text.trim();
  const h = harness(editorCode, { entry: { text: '' }, isEmpty: blank, modules: tagModules });
  const props = { id: 'new', query: new URLSearchParams() };
  let tree = h.render('Editor', props);
  title(tree).props.onInput({ currentTarget: { value: 'A' } });
  h.timers();
  await settle();
  assert.ok(h.entries.has('checkin-new'), 'saved while being written');
  tree = h.render('Editor', props);
  title(tree).props.onInput({ currentTarget: { value: '' } });
  await button(tree, 'Done').props.onClick();
  assert.equal(h.entries.has('checkin-new'), false);
  assert.deepEqual(h.navigations, ['back']);
});

test('note: an existing note emptied is still saved, not taken out', async () => {
  const blank = (e) => !e.title.trim() && !e.text.trim();
  const { h, props } = openNote({ isEmpty: blank, entry: { text: '', title: 'Before' } });
  const tree = h.render('Editor', props);
  title(tree).props.onInput({ currentTarget: { value: '' } });
  await button(tree, 'Done').props.onClick();
  assert.equal(h.entries.get('note-1').title, '');
});

test('link: the Link sheet puts the link on the words that were selected, not on the note’s start', () => {
  const { h, note, props } = openNote();
  note.editable = true;
  const links = [];
  note.cmds = { link: (to) => links.push({ to, focused: h.document.activeElement === note.el }) };
  let tree = h.render('Editor', props);
  find(tree, (n) => n.type.name === 'FormatBar').props.ribbon.link();
  tree = h.render('Editor', props);
  h.document.activeElement = {}; // the sheet's address field
  find(tree, (n) => n.type.name === 'LinkSheet').props.onDone({ text: 'words', href: 'example.com' });
  assert.deepEqual(links, [{ to: { text: 'words', href: 'example.com' }, focused: true }]);
});

test('title: Return goes on to the words, but not the Return that ends an IME composition', () => {
  const { h, note, props } = openNote();
  const tree = h.render('Editor', props);
  const key = (e) => title(tree).props.onKeyDown({ key: 'Enter', preventDefault() {}, ...e });
  key({ isComposing: true });
  key({ keyCode: 229 });
  assert.equal(note.focusCalls, 0);
  key({});
  assert.equal(note.focusCalls, 1);
});
