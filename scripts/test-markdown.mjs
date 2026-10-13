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
      export { hiddenRanges, styleSpans } from '${new URL('../src/lib/liveMarkdown.ts', import.meta.url).pathname}';
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

/** A text box with « and » around the selected text. */
function pick(text) {
  const s = text.indexOf('«'), e = text.indexOf('»') - 1;
  const b = box(text.replace('«', '').replace('»', ''));
  b.selectionStart = s;
  b.selectionEnd = e;
  return b;
}
const picked = (b) => b.value.slice(0, b.selectionStart) + '«' + b.value.slice(b.selectionStart, b.selectionEnd) + '»' + b.value.slice(b.selectionEnd);
const wrapped = (text, mark) => {
  const b = text.includes('«') ? pick(text) : box(text);
  const did = md.toggleWrap(b, mark);
  return [picked(b), did];
};

test('styling keeps out of a line’s own marker, however the selection starts', () => {
  // dragging from the very start of a heading takes its hidden "### " into the selection
  assert.equal(wrapped('«### test»', '==')[0], '### ==«test»==');
  assert.equal(wrapped('«- item»', '**')[0], '- **«item»**');
  assert.equal(wrapped('«- [ ] item»', '*')[0], '- [ ] *«item»*');
  assert.equal(wrapped('«> [!note] hello there»', '==')[0], '> [!note] ==«hello there»==');
  assert.equal(wrapped('«1. one»', '~~')[0], '1. ~~«one»~~');
  // and a second press takes it off again
  assert.equal(wrapped('### ==«test»==', '==')[0], '### «test»');
  assert.equal(wrapped('«### ==test==»', '==')[0], '### «test»');
});

test('each selected line gets its own markers', () => {
  assert.equal(wrapped('«# Title\n- item two\nplain»', '**')[0], '# **«Title**\n- **item two**\n**plain»**');
  assert.equal(wrapped('# **«Title**\n- **item two**\n**plain»**', '**')[0], '# «Title\n- item two\nplain»');
  assert.equal(wrapped('«one\n\ntwo»', '==')[0], '==«one==\n\n==two»==');
});

test('a caret in a word styles the word, and not a line’s marker', () => {
  assert.equal(wrapped('say hel|lo there', '**')[0], 'say **«hello»** there');
  assert.equal(wrapped('say **hel|lo** there', '**')[0], 'say «hello» there');
  assert.equal(wrapped('- |item', '**')[0], '- **«item»**');
  assert.equal(wrapped('### |', '==')[1], false);
  assert.equal(wrapped('a | b', '==')[1], false);
  assert.equal(wrapped('«  »', '==')[1], false);
});

test('styling fits in with what is there already', () => {
  // part of a styled span comes out of it
  assert.equal(wrapped('==t«es»t==', '==')[0], '==t==«es»==t==');
  assert.equal(wrapped('==«te»st==', '==')[0], '«te»==st==');
  assert.equal(wrapped('==te«st»==', '==')[0], '==te==«st»');
  // a span the selection touches or holds is merged
  assert.equal(wrapped('«a ==b== c»', '==')[0], '==«a b c»==');
  assert.equal(wrapped('==a== «b»', '==')[0], '==a== ==«b»==');
  assert.equal(wrapped('«ab ==cd==» ef', '==')[0], '==«ab cd»== ef');
  assert.equal(wrapped('ab ==c«d== e»f', '==')[0], 'ab ==c«d e»==f');
  // a span the selection covers entirely goes
  assert.equal(wrapped('x «==bold==» y', '==')[0], 'x «bold» y');
});

test('styles nest, so the markers never cross', () => {
  assert.equal(wrapped('**bo«ld** te»xt', '==')[0], '**bo==«ld==** ==te»==xt');
  assert.equal(wrapped('«a **b** c»', '*')[0], '*«a* ***b*** *c»*');
  assert.equal(wrapped('«a *i*»', '**')[0], '**«a** ***i*»**');
  assert.equal(wrapped('**«bold»**', '*')[0], '***«bold»***');
  assert.equal(wrapped('***«bold»***', '*')[0], '**«bold»**');
  assert.equal(wrapped('«`x` and y»', '==')[0], '==«`x` and y»==');
  assert.equal(wrapped('`a«b»c`', '**')[1], false);
  assert.equal(wrapped('```\n«code»\n```', '**')[1], false);
});

test('the styled text reads back as the same words, and the same marks apply', () => {
  for (const [text, mark] of [['«### test»', '=='], ['«a **b** c»', '*'], ['**bo«ld** te»xt', '=='], ['«# T\n- a ==b== c»', '**']]) {
    const b = pick(text);
    md.toggleWrap(b, mark);
    const plain = (s) => s.replace(/==|\*\*|\*|~~/g, '');
    assert.equal(plain(b.value), plain(text.replace(/[«»]/g, '')));
    const once = b.value;
    md.toggleWrap(b, mark);
    md.toggleWrap(b, mark);
    assert.equal(b.value, once, 'on, off, on gives the same text');
  }
});

test('bold italic reads as both, and plain bold and italic still read as one', () => {
  const classes = (t) => md.styleSpans(t).map((s) => s.c).filter((c) => c !== 'md-mark').sort().join(' ');
  assert.equal(classes('***both***'), 'md-b md-i');
  assert.equal(classes('**bold** and *italic*'), 'md-b md-i');
  assert.equal(classes('**a *i* b**'), 'md-b md-i');
});
