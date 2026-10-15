import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// The note's editing: the commands on a plain text box (styling, lists, Backspace and Enter, ticking tasks), the
// inline syntax both views read, undo, and the editable block itself on a small stand-in for the DOM. No browser is used.
const src = (f) => new URL(`../src/lib/${f}`, import.meta.url).pathname;
const bundle = await rolldown({
  input: 'review:markdown',
  plugins: [{
    name: 'markdown-entry',
    resolveId: (id) => (id === 'review:markdown' ? '\0' + id : null),
    load: (id) => id === '\0review:markdown' ? `
      export * from '${src('markdown.ts')}';
      export { hiddenRanges, styleSpans, decorate, caretStops } from '${src('liveMarkdown.ts')}';
      export { inline, plainInline } from '${src('inline.ts')}';
      export { History } from '${src('history.ts')}';
      export { Editable } from '${src('editable.ts')}';
      export { clearFormatting, setNormal } from '${new URL('../src/components/ribbon/commands.ts', import.meta.url).pathname}';
    ` : null,
  }],
});
const code = (await bundle.generate({ format: 'cjs' })).output[0].code;
await bundle.close();

/* ---------- a small stand-in for the DOM: just what lib/editable.ts uses ---------- */

class FakeNode {
  constructor(type, name) { this.nodeType = type; this.nodeName = name; this.parentNode = null; this.childNodes = []; }
  get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null; }
  get textContent() { return this.nodeType === 3 ? this.data : this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; if (v) this.appendChild(new FakeText(v)); }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
  appendChild(n) { return this.insertBefore(n, null); }
  append(...ns) { for (const n of ns) this.appendChild(n); }
  insertBefore(n, ref) {
    if (n.parentNode) n.parentNode.removeChild(n);
    const i = ref ? this.childNodes.indexOf(ref) : this.childNodes.length;
    this.childNodes.splice(i, 0, n);
    n.parentNode = this;
    return n;
  }
  removeChild(n) { this.childNodes.splice(this.childNodes.indexOf(n), 1); n.parentNode = null; return n; }
}
class FakeText extends FakeNode {
  constructor(data) { super(3, '#text'); this.data = data; }
}
class FakeElement extends FakeNode {
  constructor(tag) { super(1, tag.toUpperCase()); this.className = ''; this.attrs = new Map(); }
  get classList() { return { contains: (c) => this.className.split(' ').includes(c) }; }
  setAttribute(k, v) { this.attrs.set(k, v); }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  closest(sel) {
    const any = sel.split(',').map((x) => x.trim().slice(1));
    for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (any.some((c) => n.classList.contains(c))) return n;
    return null;
  }
  focus() { document.activeElement = this; }
  dispatchEvent() { return true; }
}
const selection = {
  anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0,
  get rangeCount() { return this.anchorNode ? 1 : 0; },
  get isCollapsed() { return this.anchorNode === this.focusNode && this.anchorOffset === this.focusOffset; },
  setBaseAndExtent(a, ao, f, fo) { Object.assign(this, { anchorNode: a, anchorOffset: ao, focusNode: f, focusOffset: fo }); this.moves++; },
  moves: 0,
  getRangeAt() {
    return { startContainer: this.anchorNode, startOffset: this.anchorOffset, endContainer: this.focusNode, endOffset: this.focusOffset, collapsed: this.isCollapsed };
  },
  removeAllRanges() { this.anchorNode = this.focusNode = null; },
  addRange(r) { this.setBaseAndExtent(r.startContainer, r.startOffset, r.endContainer, r.endOffset); },
};
const document = {
  activeElement: null,
  createElement: (tag) => new FakeElement(tag),
  createTextNode: (data) => new FakeText(data),
  createRange: () => ({ setStart(n, o) { this.startContainer = n; this.startOffset = o; }, setEnd(n, o) { this.endContainer = n; this.endOffset = o; } }),
  createTreeWalker(root) {
    const all = [];
    const walk = (n) => n.childNodes.forEach((c) => (all.push(c), walk(c)));
    walk(root);
    let i = -1;
    return { nextNode: () => all[++i] ?? null };
  },
  execCommand: () => false,
};

const module = { exports: {} };
class Event { constructor(type) { this.type = type; } }
vm.runInNewContext(code, {
  module, exports: module.exports, Event, document, getSelection: () => selection,
  Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 }, NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1 },
});
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

test('markers tuck away off the line being written; bullets, tasks, numbers and tags stay', () => {
  const ranges = (t) => [...md.hiddenRanges(t)].map(([a, b]) => t.slice(a, b));
  assert.deepEqual(ranges('# Day'), ['# ']);
  assert.deepEqual(ranges('a **b** c'), ['**', '**']);
  assert.deepEqual(ranges('- [ ] x\n- y\n1. z'), []);
  assert.deepEqual(ranges('> **q**'), ['> **', '**']);
  assert.deepEqual(ranges('> [!note] hi'), ['> [!note] ']);
  assert.deepEqual(ranges('see [site](https://x.y) #tag'), ['[', '](https://x.y)']);
  assert.deepEqual(ranges('```\n**x**\n```'), []);
  assert.deepEqual(ranges('a \\*b\\*'), ['\\', '\\'], 'an escape hides its backslash only');
});

/** The classes of a text's styled spans, with the text each holds, markers and all. */
const styled = (t) => [...md.styleSpans(t)].filter((p) => p.c !== 'md-mark').map((p) => `${p.c}:${t.slice(p.x, p.y)}`);

test('styles take the shortest run, so neighbouring ones stay apart', () => {
  assert.deepEqual(styled('**a** **b**'), ['md-b:**a**', 'md-b:**b**']);
  assert.deepEqual(styled('~~a~~ and ~~b~~'), ['md-s:~~a~~', 'md-s:~~b~~']);
  assert.deepEqual(styled('==a== ==b=='), ['md-hl:==a==', 'md-hl:==b==']);
  assert.deepEqual(styled('*a* *b*'), ['md-i:*a*', 'md-i:*b*']);
  // a space typed before the closing marker keeps the style, so it doesn't flicker word by word
  assert.deepEqual(styled('**bold **'), ['md-b:**bold **']);
  // half-typed syntax is plain text, never a stray italic
  assert.deepEqual(styled('**bold*'), []);
  assert.deepEqual(styled('**bold'), []);
  assert.deepEqual(styled('`code'), []);
  assert.deepEqual(styled('a * b * c'), []);
  // escapes
  assert.deepEqual(styled('\\*not italic\\*'), []);
  assert.deepEqual(styled('**a\\**'), []);
  // #Title without a space is a tag, not a heading; "# " is a heading even before its words
  assert.deepEqual(styled('#Title'), ['md-tag:#Title']);
  assert.deepEqual(styled('# '), ['md-h md-h1:# ']);
  assert.deepEqual(styled('#'), []);
  // an empty pair (from the toolbar) shows as it is, waiting for words
  assert.deepEqual(styled('a **** b'), ['md-empty:****']);
});

test('the reading view and excerpts read the same syntax', () => {
  const kinds = (t) => md.inline(t).map((p) => p.t + ':' + p.s).join(' | ');
  assert.equal(kinds('**a** **b**'), 'b:a | text:  | b:b');
  assert.equal(kinds('\\*x\\*'), 'esc:* | text:x | esc:*');
  assert.equal(kinds('see #tag and @[person:p1|Ann]'), 'text:see  | tag:#tag | text: and  | person:Ann');
  assert.equal(md.stripMarkdown('# **a** and **b**\n- [x] ~~done~~ \\*'), 'a and b\n☑ done *');
  assert.equal(md.stripMarkdown('[](https://) [site](https://x.y)'), ' site');
  assert.equal(md.plainInline('==hi== `x` [[note:1|Note]]'), 'hi x Note');
});

test('a quote can hold a list, a task or a heading', () => {
  assert.deepEqual(styled('> - [ ] x').map((x) => x.split(':')[0]), ['md-quote', 'md-li-mark md-task-mark']);
  assert.deepEqual(styled('> # T').map((x) => x.split(':')[0]), ['md-quote', 'md-h md-h1']);
});

test('only lines with markers get a line of their own, to show them while being written', () => {
  const lines = [...md.decorate('plain\n# Head\n- item\nx **b**')].filter((d) => typeof d === 'object').map((d) => d.c);
  assert.deepEqual(lines, ['md-line', 'md-li-mark md-bullet', 'md-line']);
  assert.equal(md.decorate('same text'), md.decorate('same text'), 'the last text asked for is kept');
});

test('the caret goes on out of a bullet or between the stars of a **, never out of the words', () => {
  const stops = (t) => [...md.caretStops(t)].map(([a, b]) => t.slice(a, b));
  assert.deepEqual(stops('- [ ] a\n- b'), ['- [ ] ', '- ']);
  assert.deepEqual(stops('x **b** y'), ['**', '**']);
  assert.deepEqual(stops('***b***'), ['***', '***']);
  assert.deepEqual(stops('*i* 1. n # h'), [], 'single stars, numbers and headings are fine to sit in');
  assert.deepEqual(stops('- **b**'), ['- ', '**', '**'], 'a list marker stays apart from a style after it');
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

test('Backspace and Delete take out what shows, and never leave a lone marker', () => {
  // the markers show on the line being written, so Backspace takes out the one before the caret
  assert.equal(md.deleteKey(box('a **bold**| c'), true), false);
  assert.equal(md.deleteKey(box('see [site](https://x.y)|'), true), false, 'a shown link loses its last character');
  // the last letter of a style takes its markers with it
  let b = box('a **b|** c');
  assert.equal(md.deleteKey(b, true), true);
  assert.equal(b.value, 'a  c');
  b = box('x **😀|** y');
  md.deleteKey(b, true);
  assert.equal(b.value, 'x  y', 'emoji are one letter');
  b = box('***|b*** c');
  md.deleteKey(b, false);
  assert.equal(b.value, ' c', 'bold italic goes as one');
  // an empty pair goes as one
  b = box('a **|** c');
  md.deleteKey(b, true);
  assert.equal(shown(b), 'a | c');
  assert.equal(md.deleteKey(box('**a**|**b**'), true), false, 'two styles meeting are not an empty pair');
  b = box('plain|\n- item');
  md.deleteKey(b, false);
  assert.equal(b.value, 'plainitem', 'joining a list item on drops its marker');
  // ordinary letters are the browser's to delete
  assert.equal(md.deleteKey(box('ab|c'), true), false);
  assert.equal(md.deleteKey(box('ab|c'), false), false);
});

test('Backspace before a list marker (where arrowing back leaves the caret) turns the item into text too', () => {
  const b = box('a\n|- item');
  md.deleteKey(b, true);
  assert.equal(shown(b), 'a\n|item');
  md.deleteKey(b, true);
  assert.equal(md.deleteKey(b, true), false, 'the next one is the browser’s, joining the lines');
});

test('Backspace on a numbered item counts the rest again', () => {
  const b = box('1. a\n2. |b\n3. c\n4. d');
  md.deleteKey(b, true);
  assert.equal(b.value, '1. a\nb\n2. c\n3. d');
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

/* ---------- lists: Enter, Tab and numbering ---------- */

test('Enter carries a list on, counting the rest again, and an empty item ends it', () => {
  let b = box('1. a|\n2. b');
  assert.equal(md.listKey(b, key('Enter')), true);
  assert.equal(shown(b), '1. a\n2. |\n3. b');
  b = box('- [x] a|');
  md.listKey(b, key('Enter'));
  assert.equal(shown(b), '- [x] a\n- [ ] |');
  b = box('- a\n- |');
  md.listKey(b, key('Enter'));
  assert.equal(shown(b), '- a\n|', 'Enter on an empty item ends the list');
  b = box('- a\n\t- |');
  md.listKey(b, key('Enter'));
  assert.equal(shown(b), '- a\n- |', 'a nested one steps out first');
  b = box('1. a\n2. |\n3. b');
  md.listKey(b, key('Enter'));
  assert.equal(shown(b), '1. a\n|\n2. b');
  b = box('> quote|');
  md.listKey(b, key('Enter'));
  assert.equal(shown(b), '> quote\n> |');
  assert.equal(md.listKey(box('# Title|'), key('Enter')), false, 'the end of a heading starts a plain line');
  assert.equal(md.listKey(box('plain|'), key('Enter')), false);
});

test('Tab moves list items in and out (counting again), and elsewhere never leaves the note', () => {
  let b = box('- a\n- |b');
  assert.equal(md.listKey(b, key('Tab')), true);
  assert.equal(shown(b), '- a\n\t- |b');
  b = box('1. a\n2. |b\n3. c');
  md.listKey(b, key('Tab'));
  assert.equal(shown(b), '1. a\n\t1. |b\n2. c');
  md.listKey(b, key('Tab', { shiftKey: true }));
  assert.equal(shown(b), '1. a\n2. |b\n3. c');
  b = box('ab|c');
  assert.equal(md.listKey(b, key('Tab')), true);
  assert.equal(shown(b), 'ab\t|c');
  b = box('|# Head');
  assert.equal(md.listKey(b, key('Tab')), true, 'handled, so the focus stays');
  assert.equal(b.value, '# Head', 'a tab before a heading’s marker would undo it');
  b = box('pl|ain');
  assert.equal(md.listKey(b, key('Tab', { shiftKey: true })), true);
  assert.equal(b.value, 'plain');
});

test('numbered lists count on at each level', () => {
  assert.equal(md.renumber('1. a\n1. b\n\t5. x\n\t1. y\n1. c', 0), '1. a\n2. b\n\t1. x\n\t2. y\n3. c');
  assert.equal(md.renumber('3. a\n1. b', 0), '3. a\n4. b', 'a list keeps the number it starts from');
  assert.equal(md.renumber('1. a\n- b\n1. c', 0), '1. a\n- b\n1. c');
  assert.equal(md.renumber('plain\n1. a', 0), 'plain\n1. a');
});

test('"[] " at the start of a line becomes a task', () => {
  let b = box('[] |');
  assert.equal(md.shortcutKey(b), true);
  assert.equal(shown(b), '- [ ] |');
  b = box('  [x] |');
  md.shortcutKey(b);
  assert.equal(shown(b), '  - [x] |');
  assert.equal(md.shortcutKey(box('a [] |')), false);
});

/* ---------- the toolbar with nothing selected ---------- */

test('Bold with nothing selected: the word, a pair to type into, or a step out of the style', () => {
  let b = box('say hel|lo');
  assert.equal(md.wrapAtCaret(b, '**'), null);
  assert.equal(b.value, 'say **hello**');
  b = box('a | b');
  assert.deepEqual([...md.wrapAtCaret(b, '**')], [2, 6]);
  assert.equal(shown(b), 'a **|** b');
  md.wrapAtCaret(b, '**');
  assert.equal(shown(b), 'a | b', 'tapped again, the empty pair goes');
  b = box('**bold|** x');
  md.wrapAtCaret(b, '**');
  assert.equal(shown(b), '**bold**| x', 'at the end of bold words the caret steps out');
  b = box('**|bold**');
  md.wrapAtCaret(b, '**');
  assert.equal(b.value, 'bold', 'at their start, it takes the bold off');
  b = box('- |item');
  md.wrapAtCaret(b, '*');
  assert.equal(shown(b), '- *|*item');
});

test('Link with nothing selected links the word, or puts down one to fill in', () => {
  let b = box('see wo|rd');
  assert.equal(md.insertLink(b), null);
  assert.equal(picked(b), 'see [word](«https://»)');
  b = box('a |');
  assert.deepEqual([...md.insertLink(b)], [2, 14]);
  assert.equal(shown(b), 'a [|](https://)');
});

/* ---------- the ribbon's own commands ---------- */

test('Clear formatting takes the styles off the selection, or off the word at the caret, and leaves links be', () => {
  let b = pick('a «**bold** and *it*» b');
  assert.equal(md.clearFormatting(b), true);
  assert.equal(picked(b), 'a «bold and it» b');
  // a style the selection only touches comes off whole
  b = pick('**bo«ld** x» y');
  md.clearFormatting(b);
  assert.equal(picked(b), 'bo«ld x» y');
  b = box('say ==hel|lo== `x`');
  assert.equal(md.clearFormatting(b), true);
  assert.equal(shown(b), 'say hel|lo `x`');
  b = box('~~**bo|th**~~');
  md.clearFormatting(b);
  assert.equal(shown(b), 'bo|th');
  assert.equal(md.clearFormatting(box('plain wo|rd')), false);
  b = pick('«[site](https://x.y)»');
  assert.equal(md.clearFormatting(b), false, 'a link stays a link');
  assert.equal(b.value, '[site](https://x.y)');
});

test('Normal turns headings, quotes and callouts back into plain lines, and leaves lists be', () => {
  let b = box('## Day|');
  assert.equal(md.setNormal(b), true);
  assert.equal(shown(b), 'Day|');
  b = pick('«# a\n> b\n- c\n> [!note] d»');
  md.setNormal(b);
  assert.equal(b.value, 'a\nb\n- c\nd');
  assert.equal(b.selectionStart, 0);
  assert.equal(b.selectionEnd, b.value.length);
  b = box('x\n> q|uote\ny');
  md.setNormal(b);
  assert.equal(shown(b), 'x\nq|uote\ny', 'only the caret\u2019s line');
  assert.equal(md.setNormal(box('plain| text')), false);
  assert.equal(md.setNormal(box('- item|')), false);
});

/* ---------- undo ---------- */

test('undo groups typing by words and pauses, and a command is a step of its own', () => {
  const h = new md.History();
  const s = (text, at = text.length) => ({ text, start: at, end: at });
  h.before(s(''));
  let t = 0;
  for (const c of 'hi there') {
    const prev = h.cur?.text ?? '';
    h.before(s(prev));
    h.after(s(prev + c), c === ' ' ? 'space' : 'type', (t += 100));
  }
  h.before(s('hi there'));
  h.after(s('hi there!'), 'type', (t += 5000)); // after a pause
  h.before(s('hi there!'));
  h.after(s('**hi** there!', 6), 'other', (t += 10));
  assert.equal(h.undo(s('**hi** there!', 6)).text, 'hi there!');
  assert.equal(h.undo(s('hi there!')).text, 'hi there');
  assert.equal(h.undo(s('hi there')).text, 'hi ');
  const first = h.undo(s('hi '));
  assert.deepEqual({ ...first }, { text: '', start: 0, end: 0 });
  assert.equal(h.undo(s('')), null);
  assert.equal(h.redo(s('')).text, 'hi ');
  assert.equal(h.redo(s('hi ')).text, 'hi there');
  // typing after an undo drops what could be redone
  h.before(s('hi there'));
  h.after(s('hi there?'), 'type', (t += 10));
  assert.equal(h.redo(s('hi there?')), null);
  // a change the history didn't see is undone on its own
  assert.equal(h.undo(s('hi there? @[Ann]')).text, 'hi there?');
});

test('the caret moving elsewhere starts a new step', () => {
  const h = new md.History();
  h.before({ text: 'ab', start: 2, end: 2 });
  h.after({ text: 'abc', start: 3, end: 3 }, 'type', 1);
  h.before({ text: 'abc', start: 0, end: 0 });
  h.after({ text: 'xabc', start: 1, end: 1 }, 'type', 2);
  assert.equal(h.undo({ text: 'xabc', start: 1, end: 1 }).text, 'abc');
});

/* ---------- the editable block, on the stand-in DOM ---------- */

/** An editable block holding `text`, focused, its input event doing what the note's does. */
function editor(text) {
  const el = document.createElement('div');
  const b = new md.Editable(el);
  el.dispatchEvent = () => (b.tidy(), b.record('other'), true);
  b.value = text;
  el.focus();
  b.setSelectionRange(text.length, text.length);
  return b;
}
/** Types `s` the way a browser does: into the text node the caret is in, then the input event. */
function typeInto(b, s) {
  for (const c of s) {
    b.before();
    let n = selection.anchorNode, o = selection.anchorOffset;
    if (n.nodeType !== 3) {
      const t = document.createTextNode('');
      n.insertBefore(t, n.childNodes[o] ?? null);
      (n = t), (o = 0);
    }
    n.data = n.data.slice(0, o) + c + n.data.slice(o);
    selection.setBaseAndExtent(n, o + 1, n, o + 1);
    b.tidy();
    b.record(c === ' ' ? 'space' : 'type');
  }
}
const lineNodes = (b) => b.el.childNodes.filter((n) => n.nodeType === 1 && n.classList.contains('md-line'));
const caretOf = (b) => [selection.anchorNode.data ?? selection.anchorNode.nodeName, selection.anchorOffset];

test('the block reads back as its text, a line with markers in a span of its own', () => {
  const b = editor('# Head\nplain **b**\n- item\n\nend');
  assert.equal(b.value, '# Head\nplain **b**\n- item\n\nend');
  assert.equal(lineNodes(b).length, 2);
  b.value = '';
  assert.equal(b.value, '');
});

test('only the lines the selection is on show their markers', () => {
  const b = editor('# One\n**two**\nthree');
  const [one, two] = lineNodes(b);
  b.setSelectionRange(2, 2);
  assert.equal(one.hasAttribute('data-active'), true);
  assert.equal(two.hasAttribute('data-active'), false);
  b.setSelectionRange(8, 8);
  assert.equal(one.hasAttribute('data-active'), false);
  assert.equal(two.hasAttribute('data-active'), true);
  b.setSelectionRange(0, 8);
  assert.equal(one.hasAttribute('data-active') && two.hasAttribute('data-active'), true, 'a selection shows every line it touches');
  document.activeElement = null;
  b.settle();
  assert.equal(one.hasAttribute('data-active') || two.hasAttribute('data-active'), false, 'none away from the note');
});

test('the caret goes where typing does what you’d expect, never into a marker that can be avoided', () => {
  const b = editor('a **b** c');
  b.setSelectionRange(7, 7);
  assert.deepEqual(caretOf(b), [' c', 0], 'after a closing ** typing is plain');
  b.setSelectionRange(5, 5);
  assert.deepEqual(caretOf(b), ['b', 1], 'before it, typing goes on in bold');
  b.value = '# T';
  b.setSelectionRange(2, 2);
  assert.deepEqual(caretOf(b), ['T', 0], 'a heading’s words start after its marker');
  b.value = '# ';
  b.setSelectionRange(2, 2);
  assert.deepEqual(caretOf(b), ['# ', 2], 'an empty heading keeps the caret at its size');
  b.value = '- ';
  b.setSelectionRange(2, 2);
  assert.deepEqual(caretOf(b), [' \n', 1], 'an empty item’s caret is in text that shows, not in its see-through marker');
});

test('typing lays out again only the line that changed, and puts the caret back by text', () => {
  const b = editor('# Head\nx');
  const head = lineNodes(b)[0];
  typeInto(b, ' **b**');
  assert.equal(b.value, '# Head\nx **b**');
  assert.equal(lineNodes(b)[0], head, 'the heading line was left alone');
  assert.equal(lineNodes(b).length, 2);
  assert.equal(b.selectionStart, b.value.length);
  typeInto(b, ' c');
  assert.equal(b.value, '# Head\nx **b** c');
  assert.equal(b.selectionStart, b.value.length);
});

test('a caret that lands inside a bullet’s marker goes on out of it, the way it was going', () => {
  const b = editor('a\n- item');
  b.setSelectionRange(4, 4);
  b.settle();
  const mark = b.el.childNodes.find((n) => n.nodeType === 1);
  selection.setBaseAndExtent(mark.childNodes[0], 1, mark.childNodes[0], 1); // arrowing back into it
  b.settle();
  assert.equal(b.selectionStart, 2);
  selection.setBaseAndExtent(mark.childNodes[0], 1, mark.childNodes[0], 1); // and on into it again
  b.settle();
  assert.equal(b.selectionStart, 4);
  const moves = selection.moves;
  b.settle();
  assert.equal(selection.moves, moves, 'a caret at rest is left alone');
});

test('undo takes back typing, commands and a list carried on, as Word does', () => {
  const b = editor('');
  typeInto(b, 'hello world');
  assert.equal(b.undo(), true);
  assert.equal(b.value, 'hello ');
  b.undo();
  assert.equal(b.value, '');
  b.redo();
  assert.equal(b.value, 'hello ');
  assert.equal(b.selectionStart, 6);

  const l = editor('- a');
  md.listKey(l, key('Enter'));
  assert.equal(l.value, '- a\n- ');
  l.undo();
  assert.equal(l.value, '- a\n', 'undo leaves the line break, without the list carried on');
  l.undo();
  assert.equal(l.value, '- a');

  const t = editor('');
  typeInto(t, '[] ');
  md.shortcutKey(t);
  assert.equal(t.value, '- [ ] ');
  t.undo();
  assert.equal(t.value, '[] ', 'undo gives back what was typed');
  assert.equal(t.selectionStart, 3);

  const w = editor('');
  typeInto(w, 'word');
  w.setSelectionRange(0, 4);
  md.toggleWrap(w, '**');
  assert.equal(w.value, '**word**');
  w.undo();
  assert.equal(w.value, 'word');
  assert.deepEqual([w.selectionStart, w.selectionEnd], [0, 4], 'with the selection it had');
});
