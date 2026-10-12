import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// The note's editing commands, on a plain text box: the hidden Markdown markers, Backspace and Delete beside them,
// Enter before a line's first word, and ticking tasks. No browser is used.
const bundle = await rolldown({
  input: 'review:markdown',
  plugins: [{
    name: 'markdown-entry',
    resolveId: (id) => (id === 'review:markdown' ? '\0' + id : null),
    load: (id) => id === '\0review:markdown' ? `
      export * from '${new URL('../src/lib/markdown.ts', import.meta.url).pathname}';
      export { hiddenRanges } from '${new URL('../src/lib/liveMarkdown.ts', import.meta.url).pathname}';
    ` : null,
  }],
});
const code = (await bundle.generate({ format: 'cjs' })).output[0].code;
await bundle.close();
const module = { exports: {} };
class Event { constructor(type) { this.type = type; } }
vm.runInNewContext(code, { module, exports: module.exports, Event, document: { execCommand: () => false } });
const md = module.exports;

/** A text box with the caret at the | in `text`. */
function box(text) {
  const at = text.indexOf('|');
  const b = {
    value: text.replace('|', ''), selectionStart: at, selectionEnd: at, inputs: 0,
    focus() {}, dispatchEvent() { this.inputs++; return true; },
    setSelectionRange(s, e) { this.selectionStart = s; this.selectionEnd = e; },
    setRangeText(t, s, e) { this.value = this.value.slice(0, s) + t + this.value.slice(e); },
  };
  return b;
}
const shown = (b) => b.value.slice(0, b.selectionStart) + '|' + b.value.slice(b.selectionStart);
const key = (k, extra = {}) => ({ key: k, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, isComposing: false, keyCode: 0, ...extra });

test('markers are hidden, words, numbers and tags are not', () => {
  const ranges = (t) => [...md.hiddenRanges(t)].map(([a, b]) => t.slice(a, b));
  assert.deepEqual(ranges('# Day'), ['# ']);
  assert.deepEqual(ranges('a **b** c'), ['**', '**']);
  assert.deepEqual(ranges('- [ ] x\n- y\n1. z'), ['- [ ] ', '- ']);
  assert.deepEqual(ranges('> **q**'), ['> **', '**']);
  assert.deepEqual(ranges('> [!note] hi'), ['> [!note] ']);
  assert.deepEqual(ranges('see [site](https://x.y) #tag'), ['[', '](https://x.y)']);
  assert.deepEqual(ranges('```\n**x**\n```'), []);
});

test('Backspace at the start of a heading, item or quote turns it back into text', () => {
  for (const [from, to] of [['# |Day', '|Day'], ['- [ ] |Milk', '|Milk'], ['- |a', '|a'], ['1. |a', '|a'], ['> |q', '|q'], ['> [!note] |hi', '|hi'], ['x\n## |H', 'x\n|H']]) {
    const b = box(from);
    assert.equal(md.deleteKey(b, true), true, from);
    assert.equal(shown(b), to, from);
  }
  // a nested item steps out first
  const b = box('- a\n\t- |b');
  md.deleteKey(b, true);
  assert.equal(b.value, '- a\n- b');
});

test('Backspace and Delete beside hidden markers take out the letter that shows', () => {
  let b = box('a **bold**| c');
  assert.equal(md.deleteKey(b, true), true);
  assert.equal(b.value, 'a **bol** c');
  b = box('a **b**| c');
  md.deleteKey(b, true);
  assert.equal(b.value, 'a  c', 'an emptied style goes with its last letter');
  b = box('a |**bold** c');
  assert.equal(md.deleteKey(b, false), true);
  assert.equal(b.value, 'a **old** c');
  b = box('x **😀**| y');
  md.deleteKey(b, true);
  assert.equal(b.value, 'x  y', 'emoji are one letter');
  b = box('plain|\n- item');
  md.deleteKey(b, false);
  assert.equal(b.value, 'plainitem', 'joining a list item on drops its marker');
  // ordinary letters are the browser's to delete
  assert.equal(md.deleteKey(box('ab|c'), true), false);
  assert.equal(md.deleteKey(box('ab|c'), false), false);
});

test('Enter before a line’s first word opens a plain line above and keeps the line', () => {
  let b = box('# |Title');
  assert.equal(md.listKey(b, key('Enter')), true);
  assert.equal(shown(b), '\n# |Title');
  b = box('- [ ] |milk');
  md.listKey(b, key('Enter'));
  assert.equal(shown(b), '\n- [ ] |milk');
  b = box('- [x] milk|');
  md.listKey(b, key('Enter'));
  assert.equal(shown(b), '- [x] milk\n- [ ] |', 'a new task starts unticked');
  assert.equal(md.listKey(box('# Tit|le'), key('Enter')), false);
});

test('ticking a task keeps the caret where it was', () => {
  const b = box('- [ ] one\n- [ ] tw|o');
  md.toggleTaskAt(b, 10, true);
  assert.equal(shown(b), '- [ ] one\n- [x] tw|o');
  const away = box('|- [x] done');
  md.toggleTaskAt(away, 0, false);
  assert.equal(away.value, '- [ ] done');
  assert.equal(away.inputs, 1);
});
