import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// Model the DOM shapes WebKit leaves in a contenteditable after line breaks and
// composition. Exercise the real editor adapter, including DOM selection points.
class TestNode {
  constructor(nodeName, nodeType = 1, data = '') {
    this.nodeName = nodeName;
    this.nodeType = nodeType;
    this.data = data;
    this.childNodes = [];
    this.parentNode = null;
  }
  append(...nodes) {
    for (const node of nodes) { node.parentNode = this; this.childNodes.push(node); }
  }
  insertBefore(node, before) {
    node.parentNode = this;
    const at = before ? this.childNodes.indexOf(before) : -1;
    if (at < 0) this.childNodes.push(node); else this.childNodes.splice(at, 0, node);
    return node;
  }
  removeChild(node) {
    this.childNodes.splice(this.childNodes.indexOf(node), 1);
    node.parentNode = null;
    return node;
  }
  contains(node) {
    for (let current = node; current; current = current.parentNode) if (current === this) return true;
    return false;
  }
  get lastChild() { return this.childNodes.at(-1) ?? null; }
  get textContent() { return this.nodeType === 3 ? this.data : this.childNodes.map((node) => node.textContent).join(''); }
  set textContent(value) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    if (value) this.append(text(value));
  }
}
const text = (value) => new TestNode('#text', 3, value);
const element = (name, ...children) => { const node = new TestNode(name); node.append(...children); return node; };

function browser() {
  let selected = null;
  const document = {
    activeElement: null,
    createElement: (name) => element(name.toUpperCase()),
    createTextNode: (value) => text(value),
    createTreeWalker(root) {
      const all = [];
      const visit = (node) => { for (const child of node.childNodes) { all.push(child); visit(child); } };
      visit(root);
      return { nextNode: () => all.shift() ?? null };
    },
    createRange() {
      const check = (node, offset) => assert.ok(Number.isInteger(offset) && offset >= 0 && offset <= (node.nodeType === 3 ? node.data.length : node.childNodes.length), 'DOM range offset is valid');
      return {
        setStart(node, offset) { check(node, offset); this.startContainer = node; this.startOffset = offset; },
        setEnd(node, offset) { check(node, offset); this.endContainer = node; this.endOffset = offset; },
        get collapsed() { return this.startContainer === this.endContainer && this.startOffset === this.endOffset; },
      };
    },
  };
  const selection = {
    anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0,
    get rangeCount() { return selected ? 1 : 0; },
    getRangeAt() { return selected; },
    removeAllRanges() { selected = null; },
    addRange(range) {
      selected = range;
      this.anchorNode = range.startContainer; this.anchorOffset = range.startOffset;
      this.focusNode = range.endContainer; this.focusOffset = range.endOffset;
    },
    setBaseAndExtent(anchor, anchorOffset, focus, focusOffset) {
      this.anchorNode = anchor; this.anchorOffset = anchorOffset;
      this.focusNode = focus; this.focusOffset = focusOffset;
    },
  };
  return {
    globals: { document, getSelection: () => selection, Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 }, NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1 } },
    document, selection,
    select(node, start, end = start, backward = false) {
      const range = document.createRange();
      range.setStart(node, start); range.setEnd(node, end);
      selection.addRange(range);
      if (backward) selection.setBaseAndExtent(node, end, node, start);
    },
  };
}

const bundle = await rolldown({
  input: 'review:mentions',
  plugins: [{
    name: 'mention-test-boundaries',
    resolveId(id) {
      if (id === 'review:mentions') return '\0' + id;
      if (id === './store') return '\0store';
    },
    load(id) {
      if (id === '\0store') return 'export const getBooks = () => [];';
      if (id === '\0review:mentions') return `
        export * from '${new URL('../src/lib/mentions.ts', import.meta.url).pathname}';
        export { Editable, messy } from '${new URL('../src/lib/editable.ts', import.meta.url).pathname}';
        export { decorate } from '${new URL('../src/lib/liveMarkdown.ts', import.meta.url).pathname}';
      `;
    },
  }],
});
const { output } = await bundle.generate({ format: 'cjs' });
await bundle.close();
function load() {
  const env = browser();
  const module = { exports: {} };
  vm.runInNewContext(output[0].code, { module, exports: module.exports, ...env.globals });
  return { ...env, ...module.exports };
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const person = (id, name, extra = {}) => ({ id, name, relation: '', emotions: [], ...extra });

test('Safari nested line blocks keep caret and mention range offsets consistent', () => {
  const env = load();
  const second = text('@Andrei');
  const root = element('DIV', text('@Ana'), element('DIV', second), element('BR'));
  env.document.activeElement = root;
  const box = new env.Editable(root);
  assert.equal(box.value, '@Ana\n@Andrei');
  env.select(second, 3);
  assert.equal(box.selectionStart, 8);
  assert.deepEqual(plain(env.typedMention(box.value, box.selectionStart)), { start: 5, end: 8, q: 'An' });
  const highlight = box.range(5, 12);
  assert.equal(highlight.startContainer, second);
  assert.equal(highlight.startOffset, 0);
  assert.equal(highlight.endContainer, second);
  assert.equal(highlight.endOffset, 7);
  box.tidy();
  assert.equal(box.value, '@Ana\n@Andrei');
  assert.equal(box.selectionStart, 8);
});

test('tidying preserves backward selections and does not steal an unfocused selection', () => {
  const env = load();
  const second = text('@Andrei');
  const root = element('DIV', text('@Ana'), element('P', second), element('BR'));
  env.document.activeElement = root;
  env.select(second, 1, 7, true);
  const box = new env.Editable(root);
  box.tidy();
  assert.equal(box.selectionStart, 6);
  assert.equal(box.selectionEnd, 12);
  assert.equal(env.selection.anchorOffset, 12);
  assert.equal(env.selection.focusOffset, 6);
  const elsewhere = text('Other field');
  env.document.activeElement = element('INPUT', elsewhere);
  env.select(elsewhere, 3);
  box.tidy();
  assert.equal(env.selection.anchorNode, elsewhere);
});

test('inline wrappers, BR lines, emoji and stale range bounds remain valid', () => {
  const env = load();
  const root = element('DIV', element('SPAN', text('☕️ ')), element('BR'), element('SPAN', text('@Ștefan')), element('BR'));
  const box = new env.Editable(root);
  assert.equal(box.value, '☕️ \n@Ștefan');
  const range = box.range(4, box.value.length);
  assert.equal(range.startContainer.data, '@Ștefan');
  assert.equal(range.startOffset, 0);
  assert.equal(range.endOffset, 7);
  assert.doesNotThrow(() => box.range(-100, 999));
  assert.doesNotThrow(() => box.setSelectionRange(NaN, Infinity));
});

test('typed tags terminate on newlines, carriage returns, tabs and sentence punctuation', () => {
  const env = load();
  for (const value of ['@Ana\n', '@Ana\r', '@Ana\r\n', '@Ana\t', '@Ana.', '@Ana!', '@Ana  ', 'mail@example', 'word@Ana'])
    assert.equal(env.typedMention(value, value.length), null, value);
  for (const opening of ['', '(', '[', '{', '“', '‘', '"', "'"])
    assert.deepEqual(plain(env.typedMention(opening + '@An', opening.length + 3)), { start: opening.length, end: opening.length + 3, q: 'An' });
  assert.equal(env.typedMention('@Ana', NaN), null);
  assert.deepEqual(plain(env.typedMention('@Ana', 999)), { start: 0, end: 4, q: 'Ana' });
  const title = '@The Hitchhiker’s Guide to the Galaxy';
  assert.equal(env.typedMention(title, title.length).q, title.slice(1));
  for (const value of ['@[Ana @em]', '♪[Live @em]', '[[Book @em]]'])
    assert.equal(env.typedMention(value, value.indexOf('@em') + 3), null, value);
});

test('first-letter suggestions work across composed accents and iOS nonbreaking spaces', () => {
  const env = load();
  const people = [person('st', 'Ștefan'), person('ana', 'Ana Maria'), person('em', 'Émilie')];
  assert.equal(env.suggest('s', people, [], [], [])[0].item.id, 'st');
  assert.equal(env.suggest('e\u0301m', people, [], [], [])[0].item.id, 'em');
  assert.equal(env.suggest('ana\u00a0ma', people, [], [], [])[0].item.id, 'ana');
  assert.equal(env.suggest(' ana   ma ', people, [], [], [])[0].item.id, 'ana');
});

test('mention tokens disambiguate canonical Unicode duplicates and highlights follow text order', () => {
  const env = load();
  const people = [person('a', 'Émilie'), person('b', 'E\u0301milie')];
  const token = env.mentionOfPerson(people[1], people);
  assert.match(token, /person:b\|/);
  assert.equal(env.resolvePerson('b', 'Émilie', people).id, 'b');
  assert.equal(env.resolvePerson(undefined, 'E\u0301milie', [people[0]]).id, 'a');
  const song = { id: 'song', music: { title: 'Blue' }, emotions: [] };
  const found = env.mentionsIn('♪[Blue] then @[Émilie]', people, [], [song]);
  assert.deepEqual(plain(found.map((mention) => mention.kind)), ['song', 'person']);
  assert.doesNotThrow(() => env.mentionsIn('@[Ana]', [person('ana', 'Ana', { emotions: ['unknown'] })], [], []));
});

test('Markdown is styled while writing without changing the text or the caret', () => {
  const env = load();
  const root = element('DIV');
  env.document.activeElement = root;
  const box = new env.Editable(root);
  const source = '# Day\nSome **bold** and *soft* ==bright== words\n- [x] done\n> [!note] mind @[Ana] **';
  box.value = source;
  assert.equal(box.value, source);
  const kinds = [];
  const visit = (node) => { if (node.className) kinds.push(node.className); node.childNodes.forEach(visit); };
  visit(root);
  for (const c of ['md-h md-h1', 'md-b', 'md-i', 'md-hl', 'md-li-mark md-task-mark', 'md-done', 'md-quote', 'md-mark md-callout-mark']) assert.ok(kinds.includes(c), c);
  // tags stay plain text, for their own highlight
  assert.ok(!kinds.some((c) => c.includes('link')));
  const at = source.indexOf('bold') + 2;
  box.setSelectionRange(at, at);
  assert.equal(box.selectionStart, at);
  assert.equal(env.selection.anchorNode.data, 'bold');
  // laying out the same text again leaves the nodes alone
  const before = [...root.childNodes];
  box.tidy();
  assert.deepEqual(root.childNodes, before);
  assert.equal(box.selectionStart, at);
});

test('typing a closing marker restyles only what changed and keeps the caret', () => {
  const env = load();
  const root = element('DIV');
  env.document.activeElement = root;
  const box = new env.Editable(root);
  box.value = 'One *two*\nmake it **loud';
  const first = root.childNodes[0];
  // the browser types the closing ** into the text node at the caret
  const last = root.childNodes.at(-1);
  last.data = last.data.replace(/\n$/, '**\n');
  env.select(last, last.data.length - 1);
  assert.equal(box.value, 'One *two*\nmake it **loud**');
  box.tidy();
  assert.equal(box.value, 'One *two*\nmake it **loud**');
  assert.equal(root.childNodes[0], first, 'untouched text keeps its node');
  assert.ok(root.childNodes.some((n) => n.className === 'md-b'));
  assert.equal(box.selectionStart, box.value.length);
});

test('plain text and code keep their characters', () => {
  const env = load();
  const flat = (list) => list.map((d) => (typeof d === 'string' ? d : flat(d.k))).join('');
  for (const t of ['', 'plain', 'a\n\nb', '```\n**not bold**\n```\nafter', '1. one\n   - two', '---', 'see [site](https://x.y) #tag', '**', '`a` ~~b~~ *'])
    assert.equal(flat(env.decorate(t)), t && t + '\n', t);
  const code = env.decorate('```\n**x**\n```');
  assert.ok(!JSON.stringify(code).includes('md-b'));
});
