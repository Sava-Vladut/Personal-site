import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
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
    resolveId(id) {
      if (id === 'review:notebody') return '\0' + id;
      // the app's chips read the store; here they're just their names
      if (id.endsWith('/components/mentions')) return '\0mentions';
      // the traps, laws and principles aren't read here (their Romanian text arrives by top-level await, which this IIFE bundle can't hold)
      if (/\/data\/(traps|laws|principles)$/.test(id)) return '\0learn-data';
    },
    load(id) {
      if (id === '\0review:notebody') return `
        export { NoteBody } from '${root}src/editor/NoteBody.tsx';
        export { tidyPastedHTML } from '${root}src/editor/paste.ts';
        export { tagDecorations } from '${root}src/editor/plugins.ts';
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

/** A page with the editor's code loaded. */
function page() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  // what jsdom lacks and ProseMirror asks for: where things are on the screen (nothing is laid out here)
  window.Range.prototype.getClientRects = () => [];
  window.Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  window.document.elementFromPoint = () => null;
  window.ClipboardEvent = class extends window.Event { constructor(type, o) { super(type, o); this.clipboardData = null; } };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.eval(code);
  return window;
}

const KEYS = { b: 'KeyB', i: 'KeyI', z: 'KeyZ', y: 'KeyY' };

/** Mounts the editor on `text`; returns its handle and what it reported. */
function mount(text, opts = {}) {
  const window = page();
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
  return { n, view, seen, type, press, end, host };
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
