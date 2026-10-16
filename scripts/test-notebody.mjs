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
    },
    load(id) {
      if (id === '\0review:notebody') return `
        export { NoteBody } from '${root}src/editor/NoteBody.tsx';
        export { tidyPastedHTML } from '${root}src/editor/paste.ts';
        export { h, render } from 'preact';
        export { act } from 'preact/test-utils';
      `;
      if (id === '\0mentions') return `
        import { h } from 'preact';
        const chip = (cls) => ({ text }) => h('button', { class: 'mention ' + cls }, text);
        export const PersonMention = chip('is-person'), SongMention = chip('is-song'), WikiLink = chip('is-wiki');
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
