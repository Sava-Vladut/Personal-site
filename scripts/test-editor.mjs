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
  });
  try {
    return (await bundle.generate({ format: 'cjs' })).output[0].code;
  } finally {
    await bundle.close();
  }
}

let editorCode, peopleCode;
before(async () => {
  editorCode = await compile('src/views/Editor.tsx');
  peopleCode = await compile('src/components/people.tsx');
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
  const entries = new Map();
  const entry = {
    id: 'note-1', kind: 'note', title: 'Before', text: 'Existing words',
    date: '2026-09-27', dateEnd: null, time: 1, icon: null, emotions: [], intensity: 3,
    photos: [], images: [], music: [], people: [], cover: null,
  };
  entries.set(entry.id, entry);
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
    getEntries: () => [...entries.values()], getPeople: () => [],
    saveEntry: async (e) => { entries.set(e.id, e); return e; },
    deleteEntry: async (id) => { const old = entries.get(id); entries.delete(id); return old; },
    toast: (message) => messages.push(message), isEmpty: () => false,
    usePeople: () => initial.people ?? [], useEntries: () => initial.entries ?? [], useBooks: () => [], useSongs: () => [],
  };
  const context = {
    exports: {},
    require(id) {
      if (id === 'preact/hooks') return hooks;
      if (id === 'preact/jsx-runtime') return { jsx: vnode, jsxs: vnode, Fragment: 'fragment' };
      if (id.endsWith('/store')) return store;
      if (id.endsWith('/photos')) return { addPhotos: () => importing };
      if (!modules.has(id)) modules.set(id, new Proxy({}, { get: (_, name) => child(name) }));
      return modules.get(id);
    },
    setTimeout(fn) { const id = {}; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener() {}, removeEventListener() {},
    document: { addEventListener() {}, removeEventListener() {}, activeElement: null },
    history: { state: {}, replaceState() {} }, location: { hash: '#/note/note-1' },
  };
  vm.runInNewContext(code, context);
  function vnode(type, props) { return { type, props }; }
  return {
    entries, messages, resolveImport, rejectImport,
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
