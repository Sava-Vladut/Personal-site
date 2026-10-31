import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { rolldown } from 'rolldown';

// The note's editor itself (src/editor/NoteBody.tsx): the ProseMirror view with its plugins, node views and paste
// handling, mounted in jsdom (a DOM in Node, no browser). What the keys and rules do to the document is tested in
// scripts/test-notedoc-edit.mjs; this checks they're wired up: typing, keys, ticking a task, tags, pictures, pasting
// and what's written back. Real typing on phones (autocorrect, IME) still wants a check on a device.
const root = new URL('..', import.meta.url).pathname;
const bundle = await rolldown({
  input: 'review:notebody',
  logLevel: 'silent',
  transform: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  plugins: [{
    name: 'notebody-entry',
    resolveId(id, importer) {
      if (id === 'review:notebody') return '\0' + id;
      // the app's chips read the store; here they're just their names
      if (id.endsWith('/components/mentions') || (id === './mentions' && importer?.endsWith('/components/Markdown.tsx'))) return '\0mentions';
      // the traps, laws and principles aren't read here (their Romanian text arrives by top-level await, which this IIFE bundle can't hold)
      if (/\/data\/(traps|laws|principles)$/.test(id)) return '\0learn-data';
    },
    load(id) {
      // English only: the Romanian dictionary arrives by top-level await too
      if (id.endsWith('/src/lib/i18n.ts')) return readFileSync(id, 'utf8').replace("await import('../data/ro')", 'null');
      if (id === '\0review:notebody') return `
        export { NoteBody } from '${root}src/editor/NoteBody.tsx';
        export { tidyPastedHTML } from '${root}src/editor/paste.ts';
        export { tagDecorations } from '${root}src/editor/plugins.ts';
        export { Ribbon } from '${root}src/components/ribbon/Ribbon.tsx';
        export { CommentsPane } from '${root}src/components/CommentsPane.tsx';
        export { Markdown } from '${root}src/components/Markdown.tsx';
        export { docView, setDocView } from '${root}src/lib/docView.ts';
        export { h, render } from 'preact';
        export { act } from 'preact/test-utils';
      `;
      if (id === '\0learn-data') return 'export const TRAPS = [], LAWS = [], PRINCIPLES = [], FAMILIES = {}, REALMS = {}, PARTS = {};';
      if (id === '\0mentions') return `
        import { createContext, h } from 'preact';
        const chip = (cls) => ({ text }) => h('span', { role: 'button', class: 'mention ' + cls }, text);
        export const PersonMention = chip('is-person'), SongMention = chip('is-song'), WikiLink = chip('is-wiki');
        export const InText = createContext(false);
      `;
    },
  }],
});
const code = (await bundle.generate({ format: 'iife', name: 'NB' })).output[0].code;
await bundle.close();

/**
 * Phones, as ProseMirror tells them apart (by the browser's name, read once as its code loads): on these it lets the
 * phone's keyboard change the page itself and reads the change back, its Enter included.
 */
const PHONES = {
  android: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', vendor: 'Google Inc.' },
  ios: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', vendor: 'Apple Computer, Inc.' },
};

/** A page with the editor's code loaded (as on a phone, with `phone`). */
function page(phone) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  for (const [k, v] of Object.entries(PHONES[phone] ?? {})) Object.defineProperty(window.navigator, k, { get: () => v });
  // what jsdom lacks and ProseMirror asks for: where things are on the screen (nothing is laid out here)
  window.Range.prototype.getClientRects = () => [];
  window.Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  window.document.elementFromPoint = () => null;
  window.ClipboardEvent = class extends window.Event { constructor(type, o) { super(type, o); this.clipboardData = null; } };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  // (the comments' sheet, components/Sheet.tsx, asks at load whether the browser has linear() easing)
  window.CSS ??= { supports: () => false, escape: (s) => s };
  window.eval(code);
  return window;
}

const KEYS = { m: 'KeyM', b: 'KeyB', i: 'KeyI', z: 'KeyZ', y: 'KeyY', u: 'KeyU', '=': 'Equal', '+': 'Equal', e: 'KeyE', l: 'KeyL', r: 'KeyR', j: 'KeyJ', f: 'KeyF', h: 'KeyH' };

/** Mounts the editor on `text`; returns its handle and what it reported. */
function mount(text, opts = {}) {
  const window = page(opts.phone);
  const { NoteBody, h, render: draw, act } = window.NB;
  const render = (vnode, el) => act(() => draw(vnode, el));
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const seen = { changes: 0, typed: [], slots: [], handle: null };
  const props = {
    text, editable: opts.editable ?? true,
    onChange: () => seen.changes++,
    onTyped: (t) => seen.typed.push(t),
    suggestKey: opts.suggestKey ?? (() => false),
    onLink: () => (seen.link = true),
    onSave: () => (seen.saved = (seen.saved ?? 0) + 1),
    onFind: (mode) => (seen.find ??= []).push(mode),
    onMedia: (s) => (seen.slots = s),
    knows: () => true,
    margins: () => ({ top: 0, bottom: 0 }),
    onReady: (handle) => (seen.handle = handle),
  };
  render(h(NoteBody, props), host);
  const n = seen.handle;
  assert.ok(n, 'the editor hands over its handle once mounted');
  const view = n.view;
  /** Types text a character at a time, as the browser would (input rules and the like see each). */
  const type = (s) => {
    for (const ch of s) {
      const { from, to } = view.state.selection;
      if (!view.someProp('handleTextInput', (f) => f(view, from, to, ch))) view.dispatch(view.state.tr.insertText(ch, from, to));
    }
  };
  /** Presses a key ("Enter", "Backspace", "Mod-b"…): true when the editor took it. */
  const press = (combo) => {
    const parts = combo.split('-');
    const key = parts.pop();
    const mods = new Set(parts);
    const e = new window.KeyboardEvent('keydown', {
      key, code: KEYS[key.toLowerCase()] ?? '', ctrlKey: mods.has('Mod'), shiftKey: mods.has('Shift'), altKey: mods.has('Alt'), bubbles: true, cancelable: true,
    });
    return !!view.someProp('handleKeyDown', (f) => f(view, e));
  };
  /** Puts the caret at the end of the note's text. */
  const end = () => n.focus('end');
  return { n, view, seen, type, press, end, host, window };
}

/**
 * A phone keyboard's own Enter in the line at `el`, `at` letters into its text: the key goes down (ProseMirror lets it
 * through on a phone), then the browser splits the block the caret is in, copying its element for the words after
 * the caret, and ProseMirror reads what changed.
 */
function phoneEnter({ view, window }, el, at) {
  const e = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  Object.defineProperty(e, 'keyCode', { value: 13 });
  view.dom.dispatchEvent(e);
  const rest = el.firstChild.splitText(at);
  const next = el.cloneNode(false);
  el.after(next);
  if (rest.data) next.append(rest);
  else (rest.remove(), next.append(window.document.createElement('br')));
  window.document.getSelection().collapse(next, 0);
  view.domObserver.flush();
}

test('a note opens as its text, drawn as the reading view draws it, and writes back exactly', () => {
  const text = '# Day\nhello **bold** and *soft* @[person:p1|Ann] #tag\n- one\n- [x] done\n> a quote\n\n```\ncode **not bold**\n```\nend';
  const { n, host } = mount(text);
  assert.equal(n.text(), text);
  const ed = host.querySelector('.note-editor');
  assert.ok(ed.classList.contains('md'));
  assert.equal(ed.getAttribute('contenteditable'), 'true');
  assert.equal(ed.querySelector('h2.md-h.md-h1').textContent, 'Day');
  assert.equal(ed.querySelector('strong').textContent, 'bold');
  assert.equal(ed.querySelector('em').textContent, 'soft');
  assert.equal(ed.querySelector('.note-chip .mention').textContent, 'Ann');
  assert.equal(ed.querySelector('.md-tag').textContent, '#tag');
  assert.equal(ed.querySelectorAll('.md-li').length, 2);
  assert.ok(ed.querySelector('.md-task.is-done input').checked);
  assert.equal(ed.querySelector('blockquote p').textContent, 'a quote');
  assert.equal(ed.querySelector('pre code').textContent, 'code **not bold**');
});

test('a bullet or numbered line is one plain block of words, its marker drawn in the margin (never an element)', () => {
  const { n, host, type, press } = mount('1. Academic escape. Getting out this way is hard\n- a point\n- [ ] a task');
  const [ol, ul, task] = host.querySelectorAll('.note-editor > .md-li');
  // the words are the line's only content: nothing beside them a phone could type around, delete or squeeze them by
  assert.equal(ol.getAttribute('data-marker'), '1.');
  assert.equal(ol.children.length, 0);
  assert.equal(ol.textContent, 'Academic escape. Getting out this way is hard');
  assert.equal(ul.getAttribute('data-marker'), '•');
  assert.equal(ul.children.length, 0);
  // a task's box sits apart from its words
  assert.equal(task.hasAttribute('data-marker'), false);
  assert.deepEqual([...task.children].map((c) => c.tagName + '.' + c.className), ['INPUT.', 'DIV.md-li-text']);
  // the number follows the list as it changes
  n.focus(ol.textContent.length + 1);
  press('Enter');
  type('Second');
  const items = host.querySelectorAll('.note-editor > .md-ol');
  assert.deepEqual([...items].map((li) => li.getAttribute('data-marker')), ['1.', '2.']);
  assert.equal(items[1].children.length, 0);
  assert.equal(n.text(), '1. Academic escape. Getting out this way is hard\n2. Second\n- a point\n- [ ] a task');
  // copied and pasted, the old drawing (a marker beside .md-li-text) and the new one read as the same items: the
  // marker never comes along as words
  const legacy = '<div class="md-li md-ul" data-kind="ul"><span class="md-marker" contenteditable="false">•</span><span class="md-li-text">old</span></div>';
  const fresh = '<div class="md-li md-ul" data-kind="ul" data-marker="•">new</div>';
  const t = '<div class="md-li md-task" data-kind="task" data-checked="true" data-check="x"><input type="checkbox"><div class="md-li-text">done</div></div>';
  n.focus('end');
  press('Enter');
  n.view.pasteHTML(legacy + fresh + t);
  assert.match(n.text(), /\n- old\n- new\n- \[x\] done$/);
});

test('a list copied from a public note’s page (drawn without data-*) pastes back as the same items', () => {
  const { n } = mount('');
  n.focus('end');
  // as components/Markdown.tsx draws it
  n.view.pasteHTML('<div class="md-li md-ol" data-marker="3.">three</div><div class="md-li md-ul" data-marker="•" style="--depth: 1">under</div>'
    + '<div class="md-li md-task is-done"><input type="checkbox" checked><div class="md-li-text">done</div></div>');
  assert.equal(n.text(), '3. three\n\t- under\n- [x] done');
});

test('Markdown typed at the start of a line or around words becomes what it writes', () => {
  const { n, type, press, end, seen } = mount('');
  end();
  type('# Title');
  press('Enter');
  type('some **bold** and `code` then ');
  press('Enter');
  type('- first');
  press('Enter');
  type('second');
  assert.equal(n.text(), '# Title\nsome **bold** and `code` then \n- first\n- second');
  assert.ok(seen.changes > 0, 'each change is reported, to be saved');
  // Enter on an empty item ends the list
  press('Enter');
  press('Enter');
  type('[] task');
  assert.equal(n.text(), '# Title\nsome **bold** and `code` then \n- first\n- second\n- [ ] task');
});

test('Backspace straight after a rule takes it back, and undo and redo work from the keys', () => {
  const { n, type, press, end } = mount('');
  end();
  type('- ');
  assert.equal(n.text(), '- ');
  press('Backspace');
  // what was typed comes back as text, written so that it reads back as text
  assert.equal(n.text(), '\\- ');
  // the typing, the rule and taking it back were one step
  press('Mod-z');
  assert.equal(n.text(), '');
  press('Mod-y');
  assert.equal(n.text(), '\\- ');
});

test('the ribbon’s commands and Word’s shortcuts style the words and light up the ribbon', () => {
  const { n, view, press } = mount('make this loud');
  const TextSelection = view.state.selection.constructor;
  // select "loud"
  const at = view.state.doc.textContent.indexOf('loud') + 1;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at, at + 4)));
  assert.equal(press('Mod-b'), true);
  assert.equal(n.text(), 'make this **loud**');
  assert.equal(n.lit().ranged, true);
  n.view.focus();
  n.cmds.list('ul');
  assert.equal(n.text(), '- make this **loud**');
  n.cmds.undo();
  assert.equal(n.text(), 'make this **loud**');
  assert.equal(press('Mod-k'), true);
});

test('a task’s box ticks it, writing or reading, and the caret stays put', () => {
  const { n, host, seen } = mount('- [ ] milk\n- [ ] eggs');
  const before = n.selection();
  const boxes = host.querySelectorAll('.md-task input');
  boxes[1].dispatchEvent(new host.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(n.text(), '- [ ] milk\n- [x] eggs');
  assert.deepEqual({ ...n.selection() }, { ...before });
  // reading: the words can't change, but a task still ticks
  n.setEditable(false);
  assert.equal(host.querySelector('.note-editor').getAttribute('contenteditable'), 'false');
  host.querySelectorAll('.md-task input')[0].dispatchEvent(new host.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(n.text(), '- [x] milk\n- [x] eggs');
  assert.ok(seen.changes >= 2);
});

test('an @ brings up suggestions, and picking one puts the tag in as a chip with a space after', () => {
  const { n, type, host } = mount('Hi ');
  n.focus('end');
  const typed = n.trigger('@');
  assert.deepEqual({ ...typed }, { from: 4, to: 5, q: '', link: false });
  type('An');
  const t = n.typed();
  assert.equal(t.q, 'An');
  assert.equal(n.pick(t, '@[person:p1|Ann]'), true);
  assert.equal(n.text(), 'Hi @[person:p1|Ann] ');
  assert.equal(host.querySelector('.note-chip .mention').textContent, 'Ann');
  // the text changed since: the tag doesn't go in
  assert.equal(n.pick(t, '@[person:p1|Ann]'), false);
  // a full stop after the tag takes the place of its space
  type('.');
  assert.equal(n.text(), 'Hi @[person:p1|Ann].');
});

test('tags inside a selection light up with it, and a tap on one puts the caret on the side tapped', () => {
  const { view, host } = mount('a @[person:p1|Ann] b');
  const TextSelection = view.state.selection.constructor; // the editor's own copy (it opens with a caret)
  const chip = host.querySelector('.note-chip');
  assert.equal(chip.querySelector('.mention').getAttribute('role'), 'button', 'drawn in the text, not as a <button>');
  // the chip is at 3 (after "a "), one character long
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)));
  assert.ok(chip.classList.contains('is-in-range'), 'a selection across the tag lights it');
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 2)));
  assert.ok(!chip.classList.contains('is-in-range'), 'a selection beside it does not');
  chip.getBoundingClientRect = () => ({ left: 100, right: 140, top: 0, bottom: 20, width: 40, height: 20 });
  const tap = (clientX) => view.someProp('handleClickOn', (f) => f(view, 3, view.state.doc.nodeAt(3), 3, { clientX }, true));
  assert.ok(tap(110));
  assert.equal(view.state.selection.head, 3, 'its left half: before it');
  assert.ok(tap(130));
  assert.equal(view.state.selection.head, 4, 'its right half: after it');
  assert.ok(view.state.selection.empty, 'never the tag itself selected');
});

test('while reading, Tab reaches the tags; while writing, a press on one leaves the focus in the words', () => {
  const { n, host } = mount('a @[person:p1|Ann] b', { editable: false });
  const tag = () => host.querySelector('.note-chip [role="button"]');
  assert.equal(tag().getAttribute('tabindex'), '0');
  n.setEditable(true);
  assert.equal(tag().getAttribute('tabindex'), null);
  n.setEditable(false);
  assert.equal(tag().getAttribute('tabindex'), '0');
});

test('suggestions take Enter while they are up', () => {
  let took = 0;
  const { n, press } = mount('x', { suggestKey: (e) => e.key === 'Enter' && ++took > 0 });
  n.focus('end');
  assert.equal(press('Enter'), true);
  assert.equal(took, 1);
  assert.equal(n.text(), 'x', 'Enter went to the suggestions, not the text');
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('pictures: a slot for each, added at the caret or the end, moved and resized as body.ts does', async () => {
  const { n, seen } = mount('one\n[[photo:a]]\ntwo');
  // slots come a frame later
  await sleep(60);
  {
    assert.equal(seen.slots.length, 1);
    assert.equal(seen.slots[0].media.id, 'a');
    assert.ok(seen.slots[0].dom.classList.contains('media-node'));
    n.media.insert([{ kind: 'photo', id: 'b' }], true);
    assert.equal(n.text(), 'one\n[[photo:a]]\ntwo\n[[photo:b]]\n');
    n.media.layout('photo:b', { size: 50, align: 'left' });
    assert.equal(n.text(), 'one\n[[photo:a]]\ntwo\n[[photo:b 50 left]]\n');
    n.media.step('photo:b', -1);
    assert.equal(n.text(), 'one\n[[photo:a]]\n\n[[photo:b 50 left]]\ntwo');
    n.setText('one\ntwo');
    assert.equal(n.text(), 'one\ntwo');
  }
});

test('dragging a picture: the place it would land is drawn in the note, the picture lifted out, nothing written', async () => {
  const { n, view, seen } = mount('one\n[[photo:a 40 right]]\ntwo\nthree');
  await sleep(60);
  const changes = seen.changes;
  const from = n.media.posOf('photo:a');
  assert.equal(from, 5);
  const editor = view.dom;
  // picked up: drawn where it is, the picture itself lifted out of the page
  n.media.preview({ at: from, side: 'right', size: 40, ratio: 1.5, lifted: from, pic: () => view.dom.ownerDocument.createElement('img') });
  const preview = editor.querySelector('.media-preview');
  assert.ok(preview?.classList.contains('is-right'), 'on its side');
  assert.equal(preview.style.width, '40%');
  assert.equal(preview.querySelector('.media-preview-label').textContent, 'Text wraps around');
  assert.ok(preview.querySelector('img'), 'a faint copy of the picture in it');
  assert.ok(editor.querySelector('.media-node').classList.contains('is-lifted'));
  // moved below "two", centred: drawn there instead, the words above it now
  n.media.preview({ at: n.media.dropTargets().map((t) => t.pos).at(-2), side: 'center', size: 40, ratio: 1.5, lifted: from });
  const kids = [...editor.children];
  const at = kids.findIndex((el) => el.classList.contains('media-preview'));
  assert.deepEqual([kids[at - 1].textContent, kids[at + 1].textContent], ['two', 'three'], 'between the lines it would go between');
  assert.equal(editor.querySelector('.media-preview-label').textContent, 'On its own line');
  assert.equal(n.text(), 'one\n[[photo:a 40 right]]\ntwo\nthree', 'only drawn: the note is as it was');
  assert.equal(seen.changes, changes, 'nothing to save');
  // dropped there: the preview goes, the picture is in its new place with its new side
  n.media.preview(null);
  assert.equal(editor.querySelector('.media-preview'), null);
  assert.equal(editor.querySelector('.is-lifted'), null);
  n.media.move('photo:a', n.media.dropTargets().map((t) => t.pos).at(-2), { size: 40 });
  assert.equal(n.text(), 'one\ntwo\n[[photo:a 40]]\nthree');
});

test('a row: its pictures dropped on, put in order, taken out to a place, and one replaced', async () => {
  const { n } = mount('a\n[[photo:p1]]\nb\n[[photo:p2 50 left]]\nc');
  await sleep(60);
  n.media.merge('photo:p2', 'photo:p1', 0);
  assert.equal(n.text(), 'a\n[[album:photo:p2 photo:p1]]\nb\nc', 'side by side, where it was dropped among them');
  n.media.reorder({ kind: 'photo', id: 'p1' }, 0);
  assert.equal(n.text(), 'a\n[[album:photo:p1 photo:p2]]\nb\nc');
  n.media.moveOut({ kind: 'photo', id: 'p2' }, n.media.dropTargets().at(-1).pos, { size: 30, align: 'right' });
  assert.equal(n.text(), 'a\n[[photo:p1]]\nb\nc\n[[photo:p2 30 right]]\n', 'the one left stands on its own again');
  n.media.moveInto({ kind: 'photo', id: 'p2' }, 'photo:p1', 1);
  assert.equal(n.text(), 'a\n[[photo:p1]]\nb\nc\n[[photo:p2 30 right]]\n', 'only a row\u2019s pictures move this way');
  n.media.replace({ kind: 'photo', id: 'p1' }, { kind: 'photo', id: 'p9' });
  assert.equal(n.text(), 'a\n[[photo:p9]]\nb\nc\n[[photo:p2 30 right]]\n');
});

test('typing only moves the pictures along: the page isn\u2019t told again', async () => {
  const { seen, type, end } = mount('one\n[[photo:a]]\ntwo');
  await sleep(60);
  const told = seen.slots;
  assert.equal(told.length, 1);
  end();
  type('more');
  await sleep(60);
  assert.equal(seen.slots, told, 'the same list, not a new one');
});

test('#tags stay right after edits anywhere in a long note (only the lines changed are read again)', () => {
  const lines = Array.from({ length: 40 }, (_, i) => (i % 5 === 0 ? `## head #h${i}` : i % 7 === 0 ? '```\n#not a tag\n```' : `line ${i} #t${i} and [#link](https://x.y) \`#code\``));
  const { view, press } = mount(lines.join('\n'));
  const { tagDecorations } = view.dom.ownerDocument.defaultView.NB;
  const tagsPlugin = view.state.plugins.find((pl) => pl.key.startsWith('tags$'));
  const spans = (set) => set.find().map((d) => `${d.from}-${d.to}`).sort().join(' ');
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 300; k++) {
    const size = view.state.doc.content.size;
    const at = 1 + Math.floor(r() * (size - 1));
    const tr = view.state.tr;
    const pick = r();
    try {
      if (pick < 0.5) tr.insertText(['#', 'a', ' ', '#x', '(', '`'][Math.floor(r() * 6)], at);
      else if (pick < 0.8) tr.delete(at, Math.min(size, at + 1 + Math.floor(r() * 4)));
      else tr.split(at);
    } catch {
      continue; // a change that can't be made there
    }
    view.dispatch(tr);
    if (r() < 0.1) press('Mod-z');
    assert.equal(spans(tagsPlugin.getState(view.state)), spans(tagDecorations(view.state.doc)), `edit ${k}`);
  }
});

test('pasting from Word or a web page keeps lists, styles and line breaks, and leaves pictures out', () => {
  const { n, view, end } = mount('');
  end();
  view.pasteHTML('<p>Intro <b>bold</b><br>next line</p><ul><li>apple<ul><li>seed</li></ul></li><li><input type="checkbox" checked> done</li></ul><p><img src="x.png">after</p>');
  assert.equal(n.text(), 'Intro **bold**\nnext line\n- apple\n\t- seed\n- [x] done\nafter');
  const word = '<p class=MsoListParagraph style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1.<span>  </span></span>First</p>'
    + '<p class=MsoListParagraph style="mso-list:l0 level2 lfo1"><span style="mso-list:Ignore">o<span> </span></span>Inner</p>';
  n.setText('');
  end();
  view.pasteHTML(word);
  assert.equal(n.text(), '1. First\n\t- Inner');
});

test('pasted plain text is read as Markdown (Shift+paste as it is), and copying writes Markdown', () => {
  const { n, view, end } = mount('');
  end();
  const paste = (text, plain) => {
    const slice = view.someProp('clipboardTextParser', (f) => f(text, view.state.selection.$from, plain, view));
    view.dispatch(view.state.tr.replaceSelection(slice));
  };
  paste('# Head\n- item **b**', false);
  assert.equal(n.text(), '# Head\n- item **b**');
  const Sel = view.state.selection.constructor;
  view.dispatch(view.state.tr.setSelection(Sel.create(view.state.doc, 1, view.state.doc.content.size - 1)));
  assert.equal(view.someProp('clipboardTextSerializer', (f) => f(view.state.selection.content(), view)), '# Head\n- item **b**');
  n.setText('');
  end();
  paste('# not a heading', true);
  assert.equal(n.text(), '\\# not a heading');
});

test('closing ** or * around words that hold a link keeps the link, and an escaped star never pairs', () => {
  const { n, type, view } = mount('see [the site](https://example.com) now');
  // the caret after "now", then wrap "see … now" as bold by typing the markers around it
  view.dispatch(view.state.tr.insertText('**', 1));
  n.focus('end');
  type('**');
  assert.equal(n.text(), '**see [the site](https://example.com) now**');
  const m = mount('a *b [c](https://example.com) d');
  m.n.focus('end');
  m.type('*');
  assert.equal(m.n.text(), 'a *b [c](https://example.com) d*');
  const e = mount('\\*word');
  e.n.focus('end');
  e.type('*');
  assert.equal(e.n.text(), '\\*word*', 'a star written as itself stays a star');
});

test('an address typed then a space becomes a link with one space after it', () => {
  const { n, type, end } = mount('');
  end();
  type('go https://example.com ');
  assert.equal(n.text(), 'go https://example.com ');
  type('x');
  assert.equal(n.text(), 'go https://example.com x');
});

test('the caret at the end of a note ending in a divider goes on a new line, never the divider selected', () => {
  const { n, view, type } = mount('words\n---');
  n.focus('end');
  assert.equal(view.state.selection.constructor.name, 'TextSelection');
  type('more');
  assert.match(n.text(), /^words\n---\n+more$/);
  const t = mount('a\n```\ncode\n```');
  t.n.insertToken('@[person:p1|Ann]', true);
  assert.match(t.n.text(), /```\n@\[person:p1\|Ann\]/, 'a tag picked while the note ends in code goes on a line after it');
});

for (const phone of ['android', 'ios']) {
  test(`${phone}: the keyboard's Enter in a task's words makes a new task of the words after the caret, none lost`, async () => {
    for (const at of [2, 4, 0]) {
      // what Enter does there from a computer's keyboard (the editor's own Enter)
      const key = mount('- [ ] milk\nafter');
      key.n.focus(1 + at);
      key.press('Enter');
      const want = key.n.text();
      const m = mount('- [ ] milk\nafter', { phone });
      m.n.focus(1 + at);
      // the browser splits the task's words (its .md-li-text), inside the line beside the box
      phoneEnter(m, m.host.querySelector('.md-task .md-li-text'), at);
      assert.equal(m.n.text(), want, `Enter ${at} letters in`);
      if (at === 2) assert.equal(want, '- [ ] mi\n- [ ] lk\nafter');
      // drawn as the document says: no stray block of words left in a line, each task with its box
      for (const li of m.host.querySelectorAll('.md-task')) assert.deepEqual([li.querySelectorAll('input').length, li.querySelectorAll('.md-li-text').length], [1, 1]);
      assert.equal(m.host.querySelector('.note-editor').textContent, key.host.querySelector('.note-editor').textContent);
      // (iOS's own fallback for an Enter it didn't see comes 200 ms later: it doesn't make another line)
      await sleep(250);
      assert.equal(m.n.text(), want);
    }
  });

  test(`${phone}: the keyboard's Enter in a numbered line makes the next number`, () => {
    const m = mount('1. milk\n2. eggs', { phone });
    m.n.focus(3);
    phoneEnter(m, m.host.querySelector('.md-ol'), 2);
    assert.equal(m.n.text(), '1. mi\n2. lk\n3. eggs');
  });
}

test('a line copied by the browser reads back as the same kind of item (several lines a keyboard puts in at once)', () => {
  const { n, host, view } = mount('1. milk\n- [x] done', { phone: 'android' });
  const ol = host.querySelector('.md-ol');
  // the line's element says what it is, as the schema's own HTML does
  assert.equal(ol.getAttribute('data-kind'), 'ol');
  assert.equal(host.querySelector('.md-task').getAttribute('data-checked'), 'true');
  n.focus(5);
  ol.firstChild.appendData(' one');
  const copy = ol.cloneNode(false);
  copy.append('two');
  ol.after(copy);
  view.domObserver.flush();
  // and the list counts on (the editor's numbering pass, lib/noteDoc/edit/lists.ts renumberChanged)
  assert.match(n.text(), /^1\. milk one\n2\. two\n- \[x\] done$/);
});

test('a phone’s Backspace that takes a task’s box out: the box comes back and the task stays', () => {
  for (const phone of ['android', 'ios']) {
    const { n, host, view } = mount('- [ ] milk', { phone });
    n.focus(1);
    host.querySelector('.md-task input').remove();
    view.domObserver.flush();
    assert.equal(n.text(), '- [ ] milk');
    assert.equal(host.querySelectorAll('.md-task > input[type=checkbox]').length, 1);
  }
});

test('a full stop after a tag takes its space when typed at the caret, not when the keyboard writes ". " itself', () => {
  for (const phone of ['android', 'ios']) {
    // typed at the caret, through the page as a phone does: it takes the tag's space
    const a = mount('Hi @[person:p1|Ann] ', { phone });
    a.n.focus('end');
    let t = a.host.querySelector('p').lastChild;
    t.data = ' .';
    a.window.document.getSelection().collapse(t, 2);
    a.view.domObserver.flush();
    assert.equal(a.n.text(), 'Hi @[person:p1|Ann].');
    // iOS's double-space full stop: the tag's space becomes ". ", the caret after it; the space stays
    const b = mount('Hi @[person:p1|Ann] ', { phone });
    b.n.focus('end');
    t = b.host.querySelector('p').lastChild;
    t.data = '. ';
    b.window.document.getSelection().collapse(t, 2);
    b.view.domObserver.flush();
    assert.equal(b.n.text(), 'Hi @[person:p1|Ann]. ');
    assert.equal(b.view.state.selection.from, b.view.state.doc.content.size - 1, 'the caret after the space');
  }
});

test('pasted line breaks come in as the page showed them: an empty line once, a line’s closing <br> as nothing', () => {
  const cases = [
    // Notes, Mail and most editors: an empty line is a block holding only a <br>
    ['<div>one</div><div><br></div><div>two</div>', 'one\n\ntwo'],
    ['<p>one</p><p><br></p><p>two</p>', 'one\n\ntwo'],
    // Google Docs: a <br> between paragraphs
    ['<b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span>one</span></p><br><p dir="ltr"><span>two</span></p></b>', 'one\n\ntwo'],
    // a copy from Safari or Chrome that started or ended at a line's end
    ['<br class="Apple-interchange-newline"><p>one</p><p>two</p><br class="Apple-interchange-newline">', 'one\ntwo'],
    // a <br> keeping a line's end, and two for an empty line in the middle
    ['<p>one<br>two<br></p>', 'one\ntwo'],
    ['<div>one<br><br></div><div>two</div>', 'one\n\ntwo'],
    ['<p>one<br><br>two</p>', 'one\n\ntwo'],
    ['<span>one<br></span>two', 'one\ntwo'],
  ];
  for (const [html, want] of cases) {
    const { n, view, end } = mount('');
    end();
    view.pasteHTML(html);
    assert.equal(n.text(), want, html);
  }
});

test('a ribbon command from the title acts on the words from their start; from another field, where the caret was', () => {
  const { n, view, window } = mount('one\ntwo');
  const field = (html) => {
    const box = window.document.createElement('div');
    box.innerHTML = html;
    window.document.body.append(box);
    return box.firstChild;
  };
  n.focus('end');
  field('<input class="sheet-field">').focus();
  assert.equal(view.hasFocus(), false);
  n.cmds.list('ul');
  assert.equal(n.text(), 'one\n- two', 'a sheet’s field: the caret’s line');
  field('<textarea class="title-input"></textarea>').focus();
  n.cmds.list('ul');
  assert.equal(n.text(), '- one\n- two', 'the title: the first line');
});

test('numbers count again whatever takes a numbered line out, and undo puts them back as written', () => {
  const { n, view } = mount('1. a\n2. b\n3. c\n4. d');
  // from the end of "a" to the end of "b": the second line goes, as a selection deleted or a drag would take it
  view.dispatch(view.state.tr.delete(2, 5));
  assert.equal(n.text(), '1. a\n2. c\n3. d');
  n.cmds.undo();
  assert.equal(n.text(), '1. a\n2. b\n3. c\n4. d');
});

test('AutoCorrect as it is typed, Backspace straight after taking it back; the text says autocorrect is on', () => {
  const { n, type, press, end, host } = mount('');
  assert.equal(host.querySelector('.note-editor').getAttribute('autocorrect'), 'on');
  end();
  type('"Hi" -- it\'s (c) 2026...');
  assert.equal(n.text(), '“Hi” — it’s © 2026…');
  press('Backspace');
  assert.equal(n.text(), '“Hi” — it’s © 2026...');
  type(' x -- ');
  press('Backspace');
  assert.equal(n.text(), '“Hi” — it’s © 2026... x -- ');
  // and the Markdown rules are still the line's at its start
  press('Enter');
  type('---');
  assert.match(n.text(), /\n---\n$/);
});

test('Ctrl+S saves the note now and Ctrl+P prints it, never the browser’s page', () => {
  const { press, seen, window } = mount('words');
  let printed = 0;
  window.print = () => printed++;
  assert.equal(press('Mod-s'), true);
  assert.equal(seen.saved, 1);
  assert.equal(press('Mod-p'), true);
  assert.equal(printed, 1);
});

test('a newer copy put in from sync is no step to undo; a change the page puts in is', () => {
  const { n, press, end, type } = mount('mine');
  end();
  type(' and more');
  n.setText('from the laptop', false);
  assert.equal(n.text(), 'from the laptop');
  press('Mod-z');
  assert.equal(n.text(), 'from the laptop', 'undo never brings back the older copy');
  n.setText('from the laptop, changed here');
  press('Mod-z');
  assert.equal(n.text(), 'from the laptop');
});

test('Alt+Shift+Up and Down move the caret’s line, as in Word', () => {
  const { n, press, view } = mount('one\ntwo\nthree');
  n.focus(6); // in "two"
  assert.equal(press('Alt-Shift-ArrowUp'), true);
  assert.equal(n.text(), 'two\none\nthree');
  assert.equal(view.state.selection.$from.parent.textContent, 'two', 'the caret goes with it');
  press('Alt-Shift-ArrowDown');
  press('Alt-Shift-ArrowDown');
  assert.equal(n.text(), 'one\nthree\ntwo');
});

test('the selected text is told to the status bar; deeper numbers show as letters, then Roman numerals', async () => {
  const { n, view, host, window } = mount('1. a\n\t1. b\n\t\t1. c\nsome words here');
  assert.deepEqual([...host.querySelectorAll('.md-ol')].map((li) => li.getAttribute('data-marker')), ['1.', 'a.', 'i.']);
  const seen = [];
  n.watchSelection((t) => seen.push(t));
  const TextSelection = view.state.selection.constructor;
  const at = view.state.doc.content.size - 1 - 'some words here'.length; // the last line's start
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at, at + 10)));
  await new Promise((r) => window.requestAnimationFrame(r));
  assert.deepEqual(seen, [null, 'some words']);
});

test('Ctrl+U underlines, Ctrl++ and Ctrl+= raise and lower, and the colours and Format Painter work from the ribbon', async () => {
  const { n, view, press, window } = mount('make this loud and that');
  const TextSelection = view.state.selection.constructor;
  // what's lit is read again a frame after each change
  const lit = () => new Promise((r) => window.requestAnimationFrame(() => r(n.lit())));
  const select = (word) => {
    const at = view.state.doc.textContent.indexOf(word) + 1;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at, at + word.length)));
  };
  select('loud');
  assert.equal(press('Mod-u'), true);
  assert.equal(n.text(), 'make this <u>loud</u> and that');
  assert.equal((await lit()).underline, true);
  assert.equal(press('Mod-Shift-+'), true);
  assert.equal(n.text(), 'make this <u><sup>loud</sup></u> and that');
  assert.equal(press('Mod-='), true);
  assert.equal(n.text(), 'make this <u><sub>loud</sub></u> and that', 'subscript takes superscript’s place');
  press('Mod-=');
  press('Mod-u');
  assert.equal(n.text(), 'make this loud and that');
  n.cmds.color('blue');
  n.cmds.highlight('lightgreen');
  assert.equal(n.text(), 'make this <span style="color:blue"><mark style="background:lightgreen">loud</mark></span> and that');
  assert.equal((await lit()).color, 'blue');
  // the Format Painter: copied from "loud", painted on "that" when the mouse lets go
  n.cmds.painter(false);
  assert.equal((await lit()).painter, 'once');
  assert.ok(view.dom.classList.contains('is-painting'), 'the pointer shows it');
  select('that');
  view.dom.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(n.text(), 'make this <span style="color:blue"><mark style="background:lightgreen">loud</mark></span> and <span style="color:blue"><mark style="background:lightgreen">that</mark></span>');
  assert.equal((await lit()).painter, null);
  assert.ok(!view.dom.classList.contains('is-painting'));
  // double-clicked it stays on, and Esc puts it away
  n.cmds.painter(true);
  assert.equal((await lit()).painter, 'sticky');
  assert.equal(press('Escape'), true);
  assert.equal((await lit()).painter, null);
  assert.equal(press('Escape'), false, 'then Esc is the page’s again');
});

test('pasting underline, superscript, subscript and colours from another app: the palette’s nearest, or none', () => {
  const { n, view, end } = mount('');
  end();
  view.pasteHTML('<p><u>u</u> <span style="text-decoration: underline">du</span> x<sup>2</sup> <span style="vertical-align: super">vs</span> H<sub>2</sub>O'
    + ' <span style="color:#c00000">red</span> <span style="color:#000000">black</span> <font color="#1f4e79">navy</font>'
    + ' <span style="background-color:#00ff00">green</span> <span style="background-color:yellow">yellow</span> <mark>mark</mark>'
    + ' <a href="https://x.y" style="color:#1155cc;text-decoration:underline"><span style="color:#1155cc">link</span></a></p>');
  assert.equal(n.text(), '<u>u</u> <u>du</u> x<sup>2</sup> <sup>vs</sup> H<sub>2</sub>O <span style="color:red">red</span> black <span style="color:blue">navy</span>'
    + ' <mark style="background:lightgreen">green</mark> ==yellow== ==mark== [link](https://x.y)');
  // copied from a note and pasted back: the same
  const Sel = view.state.selection.constructor;
  view.dispatch(view.state.tr.setSelection(Sel.create(view.state.doc, 1, view.state.doc.content.size - 1)));
  const html = [...view.dom.querySelectorAll('p')].map((p) => p.outerHTML).join('');
  n.setText('');
  end();
  view.pasteHTML(html);
  assert.equal(n.text(), '<u>u</u> <u>du</u> x<sup>2</sup> <sup>vs</sup> H<sub>2</sub>O <span style="color:red">red</span> black <span style="color:blue">navy</span>'
    + ' <mark style="background:lightgreen">green</mark> ==yellow== ==mark== [link](https://x.y)');
});

test('Ctrl+L, E, R and J align as in Word (Ctrl+Shift+E is code now), and the page doesn’t reload on Ctrl+R', async () => {
  const { n, view, press, window } = mount('a line\n- a list item');
  const lit = () => new Promise((r) => window.requestAnimationFrame(() => r(n.lit())));
  n.focus(3);
  assert.equal(press('Mod-e'), true);
  assert.equal(n.text(), 'a line <!-- align:center -->\n- a list item');
  assert.equal(view.dom.querySelector('p').style.textAlign, 'center');
  assert.equal((await lit()).align, 'center');
  assert.equal(press('Mod-r'), true);
  assert.equal(n.text(), 'a line <!-- align:right -->\n- a list item');
  assert.equal(press('Mod-j'), true);
  assert.equal(press('Mod-j'), true);
  assert.equal(n.text(), 'a line\n- a list item', 'again: back to the left');
  press('Mod-e');
  assert.equal(press('Mod-l'), true);
  assert.equal(n.text(), 'a line\n- a list item');
  // a word made code by Ctrl+Shift+E, not Ctrl+E
  const Sel = view.state.selection.constructor;
  view.dispatch(view.state.tr.setSelection(Sel.create(view.state.doc, 1, 2)));
  assert.equal(press('Mod-Shift-E'), true);
  assert.equal(n.text(), '`a` line\n- a list item');
  // on a list, nothing to align, but Ctrl+R is still the note's: the browser never reloads the page from the text
  n.focus('end');
  const e = new window.KeyboardEvent('keydown', { key: 'r', code: 'KeyR', ctrlKey: true, bubbles: true, cancelable: true });
  view.dom.dispatchEvent(e);
  assert.equal(e.defaultPrevented, true);
  assert.equal(n.text(), '`a` line\n- a list item');
  // from the ribbon
  n.focus(3);
  n.cmds.align('justify');
  assert.equal(n.text(), '`a` line <!-- align:justify -->\n- a list item');
  // pasted from Word, a centred paragraph stays centred
  n.setText('');
  n.focus('end');
  view.pasteHTML('<p>top</p><p style="text-align:center">middle</p><h2 align="right">side</h2><p style="text-align:left">left</p>');
  assert.equal(n.text(), 'top\nmiddle <!-- align:center -->\n## side <!-- align:right -->\nleft');
});

test('Ctrl+Enter puts a page break in (Shift+Enter is still a new line), drawn as a dashed line saying so', () => {
  const { n, press } = mount('beforeafter');
  n.focus(7);
  assert.equal(press('Mod-Enter'), true);
  assert.equal(n.text(), 'before\n<div style="page-break-after: always"></div>\nafter');
  const pb = n.view.dom.querySelector('.md-pagebreak');
  assert.equal(pb.textContent, 'Page break');
  assert.equal(pb.getAttribute('contenteditable'), 'false');
  press('Shift-Enter');
  assert.equal(n.text(), 'before\n<div style="page-break-after: always"></div>\n\nafter');
  // in code, Ctrl+Enter is a new line of code
  n.setText('```\ncode\n```');
  n.focus(5);
  press('Mod-Enter');
  assert.equal(n.text(), '```\ncode\n\n```');
});

test('Ctrl+Alt+F puts a footnote in; numbers by first reference; a click goes from one to the other', async () => {
  const { n, view, press, type, window } = mount('first claim and second');
  n.focus(12);
  assert.equal(press('Mod-Alt-f'), true);
  type('a source');
  assert.equal(n.text(), 'first claim[^1] and second\n\n[^1]: a source');
  // a second one, before the first: it shows 1, the first now 2
  n.focus(6);
  n.cmds.footnote();
  type('earlier');
  assert.equal(n.text(), 'first[^2] claim[^1] and second\n\n[^1]: a source\n[^2]: earlier');
  const refs = [...view.dom.querySelectorAll('.fn-ref')];
  assert.deepEqual(refs.map((r) => r.style.getPropertyValue('--fn')), ['"1"', '"2"']);
  const defs = [...view.dom.querySelectorAll('.md-fn')];
  assert.deepEqual(defs.map((d) => [d.getAttribute('data-fn'), d.style.getPropertyValue('--fn')]), [['1', '"2"'], ['2', '"1"']]);
  // a click on a reference: the caret goes to its text; on the text's number, back
  refs[1].dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
  view.someProp('handleClick', (f) => f(view, 0, { target: refs[1] }));
  assert.equal(view.state.selection.$from.parent.attrs.label, '1');
  view.someProp('handleClick', (f) => f(view, 0, { target: defs[1].querySelector('.md-fn-num') }));
  assert.equal(view.state.selection.from, 7, 'just after the reference to [^2]');
  // a reference deleted: its text is faded, not left behind unseen
  n.setText('only text now\n\n[^1]: a source');
  assert.ok(view.dom.querySelector('.md-fn').classList.contains('is-orphan'));
  // typed out in full, [^4] becomes a reference
  n.setText('x');
  n.focus('end');
  type(' see[^4]');
  assert.equal(view.dom.querySelectorAll('.fn-ref').length, 1);
  assert.equal(n.text(), 'x see[^4]');
  assert.ok(view.dom.querySelector('.fn-ref').classList.contains('is-missing'), 'no text for it yet');
});

/** A value from the page's window, as one of this realm's (to compare with deepEqual). */
const plain = (x) => JSON.parse(JSON.stringify(x));

test('Ctrl+F and Ctrl+H open the find bar from the text; F3 goes from match to match; Esc puts the caret on the match', async () => {
  const { n, view, press, seen, window } = mount('One cat, two cats\n- a cat\n**Cat** nap');
  n.focus('start');
  assert.equal(press('Mod-f'), true);
  assert.equal(press('Mod-h'), true);
  assert.deepEqual(plain(seen.find), ['find', 'replace']);
  assert.equal(press('Mod-Shift-h'), true, 'Ctrl+Shift+H is still the highlight');
  assert.deepEqual(plain(seen.find), ['find', 'replace']);
  // the bar asks: every match lit, the current one apart
  assert.deepEqual(plain(n.find.set({ text: 'cat' })), { count: 4, current: 0 });
  const lit = () => [...view.dom.querySelectorAll('.find-match')].map((el) => el.textContent + (el.classList.contains('is-current') ? '*' : ''));
  assert.deepEqual(plain(lit()), ['cat*', 'cat', 'cat', 'Cat']);
  assert.deepEqual(plain(n.find.set({ text: 'cat', wholeWord: true, caseSensitive: true })), { count: 2, current: 0 });
  // F3 in the text: the next match, selected
  assert.equal(press('F3'), true);
  assert.equal(press('F3'), true);
  assert.equal(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to), 'cat');
  assert.deepEqual(plain(lit()), ['cat', 'cat*']);
  press('Shift-F3');
  assert.deepEqual(plain(lit()), ['cat*', 'cat']);
  // what Find has found is told as the note changes
  const told = [];
  const stop = n.watchFind((f) => told.push(f));
  n.setText('cat cat cat');
  await new Promise((r) => window.requestAnimationFrame(r));
  assert.deepEqual(told.at(-1).count, 3);
  stop();
  // Replace All: one undo
  assert.equal(n.find.replaceAll('dog'), 3);
  assert.equal(n.text(), 'dog dog dog');
  press('Mod-z');
  assert.equal(n.text(), 'cat cat cat');
  // Replace: selects the match first, then replaces it and goes on
  n.find.set({ text: 'cat' });
  n.find.replace('cow');
  assert.equal(n.text(), 'cat cat cat');
  n.find.replace('cow');
  assert.equal(n.text(), 'cow cat cat');
  // Esc in the bar: nothing lit, the current match selected in the text
  n.find.close();
  assert.deepEqual(plain(lit()), []);
  assert.equal(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to), 'cat');
  assert.equal(view.state.selection.from, 5);
  assert.equal(press('F3'), false, 'closed: F3 is nobody\'s');
  // reading: Find works, Replace doesn't
  n.setEditable(false);
  assert.deepEqual(plain(n.find.set({ text: 'cat' })), { count: 2, current: 0 });
  assert.equal(n.find.replaceAll('x'), 0);
  assert.equal(n.text(), 'cow cat cat');
  // the words selected (on one line) are what the bar starts with
  n.find.close();
  n.setEditable(true);
  const Sel = view.state.selection.constructor;
  view.dispatch(view.state.tr.setSelection(Sel.create(view.state.doc, 1, 4)));
  assert.equal(n.find.selected(), 'cow');
});

test('the Navigation pane’s outline: headings as they change, the one the caret is under; a click goes there', async () => {
  const { n, view, window } = mount('intro\n# One\ntext\n## Two\nmore');
  const frame = () => new Promise((r) => window.requestAnimationFrame(r));
  const seen = [];
  const stop = n.outline.watch((o) => seen.push(o));
  assert.deepEqual(plain(seen[0].headings.map((h) => [h.level, h.text])), [[1, 'One'], [2, 'Two']]);
  n.outline.go(seen[0].headings[1].pos);
  await frame();
  assert.equal(seen.at(-1).current, 1);
  assert.equal(view.state.selection.$from.parent.textContent, 'Two');
  assert.equal(view.state.selection.$from.parentOffset, 0, 'the caret at its start');
  n.setText('intro\n# One\n### Three');
  await frame();
  assert.deepEqual(plain(seen.at(-1).headings.map((h) => h.text)), ['One', 'Three']);
  stop();
});

test('a picture’s caption and alt text are kept in its line', () => {
  const { n } = mount('a\n[[photo:p1 50 left]]\nb');
  n.media.meta('photo:p1', { caption: 'Our trip', alt: 'A boat' });
  assert.equal(n.text(), 'a\n[[photo:p1 50 left|caption=Our trip|alt=A boat]]\nb');
  assert.deepEqual(plain(n.media.list()[0]), { kind: 'photo', id: 'p1', size: 50, align: 'left', caption: 'Our trip', alt: 'A boat' });
  n.media.meta('photo:p1', { caption: '' });
  assert.equal(n.text(), 'a\n[[photo:p1 50 left|alt=A boat]]\nb');
});

/* ---------- tables ---------- */

test('a table opens drawn as a table (scrolling across in its box), and writes back exactly', () => {
  const text = 'Intro\n| Name | **Age** |\n| :--- | :---: |\n| @[person:p1|Ann] | 3 \\| 4 |\n|  | x |\nafter';
  const { n, host } = mount(text);
  assert.equal(n.text(), text);
  const box = host.querySelector('.note-editor > .md-table');
  assert.ok(box, 'a box around it');
  const rows = [...box.querySelectorAll('table > tbody > tr')];
  assert.equal(rows.length, 3);
  assert.deepEqual([...rows[0].children].map((c) => [c.tagName, c.textContent, c.style.textAlign]), [['TH', 'Name', 'left'], ['TH', 'Age', 'center']]);
  assert.deepEqual([...rows[1].children].map((c) => [c.tagName, c.style.textAlign]), [['TD', 'left'], ['TD', 'center']]);
  assert.equal(rows[1].querySelector('.mention').textContent, 'Ann');
  assert.equal(rows[0].querySelector('strong').textContent, 'Age');
  // reading: the same view, not editable
  const r = mount(text, { editable: false });
  assert.equal(r.host.querySelectorAll('.md-table td').length, 4);
});

test('Insert › Table from the ribbon, then Tab, Enter and the Table tab\'s commands in it', async () => {
  const { n, view, press, type, window } = mount('');
  const lit = () => new Promise((r) => window.requestAnimationFrame(() => r(n.lit())));
  n.focus('end');
  assert.equal((await lit()).table, false);
  assert.ok(n.cmds.insertTable(2, 2));
  assert.equal((await lit()).table, true);
  type('a');
  press('Tab');
  type('b');
  press('Tab');
  type('c');
  press('Enter'); // the cell below: a row added
  type('d');
  assert.equal(n.text(), '| a | b |\n| --- | --- |\n| c |  |\n| d |  |\n');
  press('Shift-Tab'); // back a cell: its words selected
  assert.equal(view.state.selection.empty, true, 'an empty cell');
  assert.ok(n.cmds.table('center'));
  assert.ok(n.cmds.table('rowAbove'));
  assert.equal((await lit()).cellAlign, 'center');
  assert.equal(n.text(), '| a | b |\n| --- | :---: |\n|  |  |\n| c |  |\n| d |  |\n');
  assert.ok(n.cmds.table('deleteColumn'));
  assert.equal(n.text(), '| a |\n| --- |\n|  |\n| c |\n| d |\n');
  assert.ok(n.cmds.table('deleteTable'));
  assert.equal(n.text(), '');
  // the commands that can't go in a cell don't
  n.cmds.insertTable(1, 1);
  assert.equal(n.cmds.list('ul'), false);
  assert.equal(n.cmds.style('h1'), false);
  assert.equal(n.cmds.quote(), false);
  assert.equal(n.cmds.insert('pagebreak'), false);
  assert.equal(n.cmds.insertTable(2, 2), false, 'no table in a table');
  assert.equal(press('Mod-Enter'), true);
  assert.equal(n.text(), '|  |\n| --- |\n|  |\n', 'Ctrl+Enter in a cell goes to the cell below');
});

test('pasting a table from Word, Google Docs or a web page keeps it a table', () => {
  const cases = [
    // Word: cells holding paragraphs (aligned there), widths and borders, an empty paragraph after it
    ['<table class=MsoTableGrid border=1 cellspacing=0 cellpadding=0 style="border-collapse:collapse"><tr><td width=200 valign=top style="width:150pt;border:solid windowtext 1.0pt"><p class=MsoNormal align=center style="text-align:center"><b>Name</b><o:p></o:p></p></td><td width=200 valign=top><p class=MsoNormal>Age<o:p></o:p></p></td></tr><tr><td valign=top><p class=MsoNormal>Ann</p><p class=MsoNormal>Smith</p></td><td valign=top><p class=MsoNormal>3 | 4</p></td></tr></table>',
      '| **Name** | Age |\n| :---: | --- |\n| Ann Smith | 3 \\| 4 |'],
    // Google Docs: wrapped in its <b>, a table in a div, a shaded header (not a highlight), a line break in a cell
    ['<b style="font-weight:normal;" id="docs-internal-guid-1"><div dir="ltr" style="margin-left:0pt;" align="left"><table style="border:none;border-collapse:collapse;"><colgroup><col width="100"><col width="100"></colgroup><tbody><tr style="height:0pt"><td style="border-left:solid #000000 1pt;background-color:#cccccc;vertical-align:top;padding:5pt"><p dir="ltr" style="line-height:1.2;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-family:Arial;color:#000000;background-color:transparent;font-weight:700;">Day</span></p></td><td style="background-color:#cccccc"><p dir="ltr"><span style="font-weight:400;">Mood</span></p></td></tr><tr><td><p dir="ltr"><span style="font-style:italic;">Mon</span></p></td><td><p dir="ltr"><span>ok<br>good</span></p></td></tr></tbody></table></div></b>',
      '| **Day** | Mood |\n| --- | --- |\n| *Mon* | ok good |'],
    // a web page: a caption, a header in <thead>, a cell across two columns and one down two rows (the others left empty), a list in a cell
    ['<table><caption>Scores</caption><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead><tbody><tr><td colspan="2">wide</td><td rowspan="2">tall</td></tr><tr><td><ul><li>x</li><li>y</li></ul></td><td><a href="https://ex.am">link</a></td></tr></tbody></table>',
      'Scores\n| A | B | C |\n| --- | --- | --- |\n| wide |  | tall |\n| x y | [link](https://ex.am) |  |'],
    // a page laid out in a table of one cell: just its words
    ['<table><tr><td><p>just</p><p>words</p></td></tr></table>', 'just\nwords'],
  ];
  for (const [html, want] of cases) {
    const { n, view, end } = mount('');
    end();
    view.pasteHTML(html);
    assert.equal(n.text(), want, html);
  }
});

test('pasting into a cell: a table goes in cell by cell, anything else as one line; pipe text pastes as a table', () => {
  const { n, view, end, window } = mount('');
  /** A paste from the clipboard, as the browser hands it over (plain text, and HTML when given). */
  const paste = (text, html = '') => {
    const e = new window.ClipboardEvent('paste', { bubbles: true, cancelable: true });
    e.clipboardData = { getData: (type) => (type === 'text/plain' ? text : type === 'text/html' ? html : ''), types: html ? ['text/plain', 'text/html'] : ['text/plain'], files: [] };
    view.dom.dispatchEvent(e);
  };
  end();
  paste('| a | b |\n| --- | :-: |\n| 1 | 2 |');
  assert.equal(n.text(), '| a | b |\n| --- | :---: |\n| 1 | 2 |');
  // the caret into the first body cell: lines pasted there run together
  const cellPos = (row, col) => {
    let found = -1, r = -1;
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableRow') (r++, (node.forEach((c, off, k) => { if (r === row && k === col) found = pos + 1 + off + 1; })));
      return found < 0;
    });
    return found;
  };
  const Sel = view.state.selection.constructor;
  view.dispatch(view.state.tr.setSelection(Sel.create(view.state.doc, cellPos(1, 0) + 1)));
  paste('one two three', '<p>one</p><ul><li>two</li></ul><p><b>three</b></p>');
  assert.equal(n.text(), '| a | b |\n| --- | :---: |\n| 1one two **three** | 2 |');
  view.pasteText('x\ny'); // Shift+paste
  assert.equal(n.text(), '| a | b |\n| --- | :---: |\n| 1one two **threex y** | 2 |', 'what\'s pasted takes the style at the caret');
  // a table pasted into a cell fills the cells from there, the table growing as it needs
  view.dispatch(view.state.tr.setSelection(Sel.create(view.state.doc, cellPos(1, 1))));
  paste('| p | q |\n| --- | --- |\n| r | s |');
  assert.equal(n.text(), '| a | b |  |\n| --- | :---: | --- |\n| 1one two **threex y** | p | q |\n|  | r | s |');
});

test('the ribbon: Insert › Table\'s grid puts a table in, the Table tab comes up with it and goes with the caret leaving it', async () => {
  const window = page();
  // a computer's screen: the ribbon across the top, its tabs and their commands
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const { Ribbon, h, render: draw, act } = window.NB;
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const calls = [];
  const cmds = new Proxy({}, { get: (_, k) => (...args) => (calls.push([k, ...args]), true) });
  const actions = new Proxy({ reading: false, title: 'T', busy: false, canAddPhotos: true, shared: false }, { get: (o, k) => (k in o ? o[k] : () => {}) });
  const show = (lit) => act(() => draw(h(Ribbon, { actions, cmds, lit, swapped: false, away: false, done: null, toText() {} }), host));
  const click = (el) => act(() => void el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
  const tab = (id) => host.querySelector('#rb-tab-' + id);
  const big = (name) => [...window.document.querySelectorAll('.rb-big')].find((b) => b.textContent === name);
  show({ table: false, cellAlign: null });
  assert.equal(tab('context'), null, 'no Table tab out of a table');
  click(tab('insert'));
  click(big('Table'));
  const grid = window.document.querySelector('.rb-pop .rb-grid');
  assert.equal(grid.querySelectorAll('button').length, 64, 'up to 8 × 8');
  act(() => void grid.querySelector('[data-at="3-2"]').dispatchEvent(new window.Event('pointerenter')));
  assert.equal(window.document.querySelector('.rb-grid-size').textContent, '2 × 3 table');
  assert.equal(grid.querySelectorAll('.is-on').length, 6);
  click(grid.querySelector('[data-at="3-2"]'));
  assert.deepEqual(calls.pop(), ['insertTable', 3, 2], 'three rows (the header row among them), two columns');
  assert.equal(window.document.querySelector('.rb-pop'), null, 'the grid goes');
  // the caret in the new table: its tab comes up by itself
  show({ table: true, cellAlign: 'left' });
  assert.equal(tab('context').textContent, 'Table');
  assert.equal(tab('context').getAttribute('aria-selected'), 'true');
  click(big('Insert below'));
  assert.deepEqual(calls.pop(), ['table', 'rowBelow']);
  click(big('Delete column'));
  assert.deepEqual(calls.pop(), ['table', 'deleteColumn']);
  const centre = host.querySelector('[aria-label="Centre column"]');
  assert.equal(host.querySelector('[aria-label="Align column left"]').getAttribute('aria-pressed'), 'true');
  click(centre);
  assert.deepEqual(calls.pop(), ['table', 'center']);
  // out of the table: the tab goes, the one before comes back; back in, it's there but doesn't open by itself
  show({ table: false, cellAlign: null });
  assert.equal(tab('context'), null);
  assert.equal(tab('insert').getAttribute('aria-selected'), 'true');
  show({ table: true, cellAlign: null });
  assert.equal(tab('context').getAttribute('aria-selected'), 'false');
  assert.equal(big('Table').disabled, true, 'no table in a table');

  // a phone's bar: the Table tab in its list of tabs, its commands in the row
  const phone = page();
  const P = phone.NB;
  const bar = phone.document.createElement('div');
  phone.document.body.append(bar);
  P.act(() => P.render(P.h(P.Ribbon, { actions, cmds, lit: { table: true, cellAlign: null }, swapped: false, away: false, done: null, toText() {} }), bar));
  P.act(() => void bar.querySelector('.rb-pick-btn').dispatchEvent(new phone.MouseEvent('click', { bubbles: true })));
  const item = [...bar.querySelectorAll('.rb-menu button')].find((b) => b.textContent === 'Table');
  assert.ok(item?.classList.contains('is-context'));
  P.act(() => void item.dispatchEvent(new phone.MouseEvent('click', { bubbles: true })));
  const row = bar.querySelector('.format-scroll');
  assert.ok([...row.querySelectorAll('.rb-big')].some((b) => b.textContent === 'Insert above'));
  assert.ok(bar.querySelector('.format-bar').classList.contains('is-context'));
});

/* ---------- comments ---------- */

test('comments: Ctrl+Alt+M makes a draft, its box in the margin is written in and saved, edited, deleted; a click selects its words', async () => {
  const { n, view, press, window, host } = mount('I said yes and left.\nnext <span class="comment">line</span><!-- comment: old one -->');
  const { CommentsPane, h, render: draw, act, setDocView } = window.NB;
  const frame = () => new Promise((r) => window.requestAnimationFrame(r));
  const pane = window.document.createElement('div');
  window.document.body.append(pane);
  const show = (o = {}) => act(() => draw(h(CommentsPane, { note: n, wide: true, reading: false, open: null, onOpen() {}, ...o }), pane));
  show();
  const cards = () => [...pane.querySelectorAll('.cm-card')];
  assert.deepEqual(cards().map((c) => c.querySelector('textarea').value), ['old one'], 'what a comment says, beside it');
  assert.ok(host.querySelector('.note-editor .cm'), 'its words marked in the text');
  // the word at the caret, Ctrl+Alt+M: a draft, its words lit, nothing in the text yet
  n.focus(9);
  assert.ok(press('Mod-Alt-m'));
  await frame();
  show();
  assert.deepEqual({ ...n.comments.get().draft }, { from: 8, to: 11 });
  assert.ok(host.querySelector('.note-editor .cm-draft'));
  assert.equal(n.text(), 'I said yes and left.\nnext <span class="comment">line</span><!-- comment: old one -->', 'nothing in the text yet');
  const draft = pane.querySelector('.cm-card.is-draft textarea');
  assert.equal(window.document.activeElement, draft, 'its box takes the focus');
  // written in, then Enter: saved, the focus back in the text
  act(() => {
    draft.value = 'did I --mean it? [x]';
    draft.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  act(() => void draft.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  await frame();
  show();
  assert.equal(n.text(), 'I said <span class="comment">yes</span><!-- comment: did I %2D-mean it? %5Bx%5D --> and left.\nnext <span class="comment">line</span><!-- comment: old one -->');
  assert.deepEqual(cards().map((c) => c.querySelector('textarea').value), ['did I --mean it? [x]', 'old one']);
  // a click on a box selects its words
  act(() => void cards()[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
  assert.equal(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to), 'line');
  // emptied, it goes; the ✕ deletes one (its words stay)
  const second = cards()[1].querySelector('textarea');
  act(() => second.focus());
  act(() => {
    second.value = '  ';
    second.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  act(() => second.blur());
  assert.equal(n.text(), 'I said <span class="comment">yes</span><!-- comment: did I %2D-mean it? %5Bx%5D --> and left.\nnext line');
  await frame();
  show();
  act(() => void cards()[0].querySelector('.cm-del').dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
  assert.equal(n.text(), 'I said yes and left.\nnext line');
  await frame();
  show();
  assert.equal(cards().length, 0);
  assert.equal(pane.querySelector('.cm-pane'), null, 'no comments: no column');
  // Show comments off: the column goes (the words stay unmarked by CSS)
  n.setText('a <span class="comment">b</span><!-- comment: c -->');
  await frame();
  act(() => setDocView({ comments: false }));
  show();
  assert.equal(pane.querySelector('.cm-pane'), null);
  act(() => setDocView({ comments: true }));
  show();
  assert.equal(cards().length, 1);
});

test('comments are private: copied as plain text they\'re left out (copied as the note\'s own HTML they come along), and the reading view never shows them', () => {
  const { n, view, window } = mount('a <span class="comment">**b**</span><!-- comment: my SECRET --> c');
  const slice = view.state.doc.slice(0, view.state.doc.content.size);
  assert.equal(view.someProp('clipboardTextSerializer', (f) => f(slice, view)), 'a **b** c');
  // between notes (ProseMirror's own HTML), the comment comes along
  const other = mount('');
  other.n.focus('end');
  const html = window.document.createElement('div');
  html.append(...[...view.dom.childNodes].map((c) => c.cloneNode(true)));
  other.view.pasteHTML(html.innerHTML);
  assert.equal(other.n.text(), 'a <span class="comment">**b**</span><!-- comment: my SECRET --> c');
  // the reading view (and a public note's page): the words, never what the comment says
  const { Markdown, h, render: draw, act } = window.NB;
  const box = window.document.createElement('div');
  act(() => draw(h(Markdown, { text: n.text() }), box));
  assert.equal(box.textContent, 'a b c');
  assert.ok(!/SECRET|comment/.test(box.innerHTML));
  assert.ok(box.querySelector('strong'));
});

test('the ribbon\'s Review tab: New comment, Delete, Previous, Next, Show comments', () => {
  const window = page();
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const { Ribbon, h, render: draw, act, docView } = window.NB;
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const calls = [];
  const cmds = new Proxy({}, { get: (_, k) => (...args) => (calls.push([k, ...args]), true) });
  const actions = new Proxy({ reading: false, title: 'T', busy: false, canAddPhotos: true, shared: false }, { get: (o, k) => (k in o ? o[k] : () => {}) });
  const show = (lit) => act(() => draw(h(Ribbon, { actions, cmds, lit, swapped: false, away: false, done: null, toText() {} }), host));
  const click = (el) => act(() => void el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
  const big = (name) => [...host.querySelectorAll('.rb-big')].find((b) => b.textContent === name);
  show({ canComment: true, comment: false, comments: false });
  click(host.querySelector('#rb-tab-review'));
  assert.equal(host.querySelector('#rb-tab-review').getAttribute('aria-selected'), 'true');
  assert.match(big('New comment').title, /Ctrl\+Alt\+M/);
  click(big('New comment'));
  assert.deepEqual(calls.pop(), ['comment']);
  assert.equal(big('Delete').disabled, true, 'no comment at the caret');
  assert.equal(big('Next').disabled, true, 'none in the note');
  show({ canComment: true, comment: true, comments: true });
  click(big('Delete'));
  click(big('Previous'));
  click(big('Next'));
  assert.deepEqual(calls.splice(0), [['deleteComment'], ['stepComment', -1], ['stepComment', 1]]);
  const toggle = big('Show comments');
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  click(toggle);
  assert.equal(docView().comments, false);
  click(big('Show comments'));
  assert.equal(docView().comments, true);
});
