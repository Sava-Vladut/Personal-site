import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// Exercise the actual component handlers with deferred photo storage and a small
// hook renderer. Dependencies are isolated; no browser or user's database is used.
async function compile(input) {
  const bundle = await rolldown({
    input,
    external: (id, importer) => Boolean(importer) && !/(?:^|\/)lib\/body(?:\.ts)?$/.test(id),
    plugins: input.endsWith('SpotifySheet.tsx') ? [{
      name: 'expose-search-handler',
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
  const messages = [];
  const navigations = [];
  const listeners = new Map();
  const entries = new Map();
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
    blankPerson: () => ({ id: 'person-new', name: '', text: '', emotions: [], relation: '' }),
    blankEntry: (kind) => ({ ...entry, id: 'checkin-new', kind }),
    deleteEntry: async (id) => { const old = entries.get(id); entries.delete(id); return old; },
    toast: (message) => messages.push(message), isEmpty: () => false,
    usePeople: () => [...people.values()], useEntries: () => initial.entries ?? [], useBooks: () => [...books.values()], useSongs: () => [...songs.values()],
    useSettings: () => ({ picker: 'grid' }),
    BOOK_STATUSES: ['want', 'reading', 'read', 'dnf'], MAX_PERSON_EMOTIONS: 3,
  };
  const context = {
    exports: {},
    require(id) {
      if (id === 'preact/hooks') return hooks;
      if (id === 'preact/jsx-runtime') return { jsx: vnode, jsxs: vnode, Fragment: 'fragment' };
      const override = Object.entries(initial.modules ?? {}).find(([suffix]) => id.endsWith(suffix));
      if (override) return override[1];
      if (id.endsWith('/store')) return store;
      if (id.endsWith('/router')) return { goBack() { navigations.push('back'); }, navigate(to) { navigations.push(to); } };
      if (id.endsWith('/photos')) return { addPhotos: () => importing };
      if (!modules.has(id)) modules.set(id, new Proxy({}, { get: (_, name) => child(name) }));
      return modules.get(id);
    },
    setTimeout(fn) { const id = {}; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    document: { addEventListener() {}, removeEventListener() {}, activeElement: null },
    history: { state: {}, replaceState() {} }, location: { hash: '#/note/note-1' },
    confirm: () => true, scrollTo() {}, navigator: {},
  };
  vm.runInNewContext(code, context);
  function vnode(type, props) { return { type, props }; }
  return {
    entries, people, books, songs, messages, navigations, listeners, resolveImport, rejectImport,
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
      for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
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
const personModules = { '/People': { useMoments: () => new Map() }, '/mentions': { renamePersonMentions: () => [] } };
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
  const writing = find(tree, (n) => n.type === 'button' && n.props.children?.includes?.(' Check in')).props.onClick();
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
    const area = find(tree, (n) => n.type === 'textarea' && n.props['aria-label'] === label);
    assert.ok(area, `Missing ${label} textarea`);
    area.props.onInput({ currentTarget: { value: 'Changed' } });
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
    await button(tree, kind === 'person' ? 'Delete person' : 'Remove book').props.onClick();
    h.unmount();
    await settle();
    assert.equal(renames, 0);
  });
}

const trackerModules = {
  '/emotions': { EMOTION: { joy: { id: 'joy', depth: 0, core: 'joy', name: 'Joy' } }, FEELINGS: [], shortName: () => 'Joy' },
  '/dates': { todayKey: () => '2026-10-01', keyOf: (d) => d.toISOString().slice(0, 10) },
  '/stats': { streaks: () => ({ current: 0 }) },
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
