import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// Tags and note links as the text has them: typing them, suggesting, resolving, renaming and linking back.
// (The note editor's own handling of them is scripts/test-notedoc-edit.mjs.)
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
        export { linkedFrom, linkOf, linkRanges, noteLabel, resolveNote, suggestLinks, typedLink } from '${new URL('../src/lib/links.ts', import.meta.url).pathname}';
        export { refOf, refTarget } from '${new URL('../src/lib/refs.ts', import.meta.url).pathname}';
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

const note = (id, title, text = '', extra = {}) => ({ id, kind: 'note', title, text, date: '2026-10-05', dateEnd: null, emotions: [], ...extra });

test('typing [[ offers a link until the brackets close, and not inside picture markers', () => {
  const env = load();
  assert.deepEqual(plain(env.typedLink('see [[Tri', 9)), { start: 4, end: 9, q: 'Tri', link: true });
  assert.deepEqual(plain(env.typedLink('[[', 2)), { start: 0, end: 2, q: '', link: true });
  for (const value of ['[[Trip]]', '[[Trip\n', '[[a|b', '[[photo:abc', '[[note:x', 'one [ [x'])
    assert.equal(env.typedLink(value, value.length), null, value);
  // an @ inside a [[ is a title being typed, not a tag
  assert.equal(env.typedMention('[[Ana @em', 9), null);
});

test('note links point at the note, so renaming it keeps them, and books keep [[Title]]', () => {
  const env = load();
  const trip = note('n1', 'Trip to Cluj');
  const untitled = note('n2', '', '[[photo:p1]]\n**First** line here\nmore');
  assert.equal(env.linkOf(trip), '[[note:n1|Trip to Cluj]]');
  assert.equal(env.noteLabel(untitled), 'First line here');
  assert.equal(env.linkOf(note('n3', 'a | b ] c')), '[[note:n3|a   b   c]]');
  const entries = [trip, untitled];
  const books = [{ id: 'b1', title: 'Dune', authors: '', status: 'reading', emotions: [] }];
  assert.equal(env.resolveNote('note:n1', 'Old title', entries, books).id, 'n1');
  assert.equal(env.resolveNote('note:gone', 'Gone', entries, books), undefined);
  assert.equal(env.resolveNote(undefined, 'trip to cluj', entries, books).id, 'n1');
  // a plain [[Title]] belongs to the book when one on the shelf has it
  assert.equal(env.resolveNote(undefined, 'Dune', [...entries, note('n4', 'Dune')], books), undefined);
  assert.equal(env.resolveNote('book:b1', 'Dune', entries, books), undefined);
  assert.equal(env.resolveNote(undefined, 'photo:p1', entries, books), undefined);
});

test('Linked from lists the notes linking here, with the line the link is on', () => {
  const env = load();
  const target = note('t', 'Target');
  const a = note('a', 'A', 'intro\nWent back to [[note:t|Old name]] **today**\nend');
  const b = note('b', 'B', 'nothing here [[Dune]]');
  const self = note('t2', 'Self', '[[note:t2|Self]]');
  const c = note('c', 'C', 'By hand: [[Target]]');
  const entries = [a, b, self, c, target];
  const found = env.linkedFrom('t', entries, []);
  assert.deepEqual(plain(found.map((f) => f.entry.id)), ['a', 'c']);
  assert.equal(found[0].context, 'Went back to Target today');
  assert.deepEqual(plain(env.linkedFrom('t2', entries, [])), []);
  const ranges = env.linkRanges(a.text, entries, []);
  assert.equal(ranges.length, 1);
  assert.equal(a.text.slice(ranges[0].start, ranges[0].end), '[[note:t|Old name]]');
  assert.equal(a.text.slice(ranges[0].start + 2, ranges[0].label), 'note:t|');
});

test('[[ suggests other notes first, then books, never the note being written', () => {
  const env = load();
  const entries = [note('self', 'Trip notes'), note('n1', 'Trip to Cluj'), { ...note('c1', 'Trip check-in'), kind: 'checkin' }, note('n2', 'Groceries')];
  const books = [{ id: 'b1', title: 'Travels', authors: '', status: 'reading', emotions: [] }];
  const picks = env.suggestLinks('tr', entries, books, 'self');
  assert.deepEqual(plain(picks.map((s) => `${s.kind}:${s.item.id}`)), ['note:n1', 'book:b1']);
  const recent = env.suggestLinks('', entries, books, 'self');
  assert.deepEqual(plain(recent.map((s) => `${s.kind}:${s.item.id}`)), ['note:n1', 'note:n2', 'book:b1']);
});

test('[[ suggests mind traps and laws of power by name, after notes and books, and links them by id', () => {
  const env = load();
  const ref = (kind, id, name) => ({ kind, id, name, sub: '', line: '', hue: 'joy', to: '' });
  const refs = [ref('trap', 'confirmation', 'Confirmation bias'), ref('law', '1', 'Never Outshine the Master'), ref('law', '3', 'Conceal Your Intentions')];
  const entries = [note('n1', 'Conference day')];
  const picks = env.suggestLinks('con', entries, [], 'self', refs);
  assert.deepEqual(plain(picks.map((s) => `${s.kind}:${s.item.id}`)), ['note:n1', 'trap:confirmation', 'law:3']);
  assert.deepEqual(plain(env.suggestLinks('outshine', [], [], 'self', refs).map((s) => s.item.id)), ['1']);
  assert.deepEqual(plain(env.suggestLinks('law 3', [], [], 'self', refs).map((s) => s.item.id)), ['3']);
  assert.deepEqual(plain(env.suggestLinks('', entries, [], 'self', refs).map((s) => s.kind)), ['note']);
  assert.equal(env.refOf(refs[0]), '[[trap:confirmation|Confirmation bias]]');
  assert.deepEqual(plain(env.refTarget('law:12')), { kind: 'law', id: '12' });
  assert.equal(env.refTarget('note:12'), null);
  assert.equal(env.typedLink('see [[trap:confirmation', 23), null);
  assert.equal(env.resolveNote('trap:confirmation', 'Confirmation bias', [{ ...note('x', 'Confirmation bias') }], []), undefined);
});

test('[[ suggests Carnegie principles by title and number, and links them by number', () => {
  const env = load();
  const ref = (kind, id, name) => ({ kind, id, name, sub: '', line: '', hue: 'joy', to: '' });
  const refs = [ref('law', '5', 'So Much Depends on Reputation'), ref('principle', '5', 'Talk in terms of the other person’s interests'), ref('principle', '6', 'Make the other person feel important')];
  assert.deepEqual(plain(env.suggestLinks('principle 5', [], [], 'self', refs).map((s) => `${s.kind}:${s.item.id}`)), ['principle:5']);
  assert.deepEqual(plain(env.suggestLinks('law 5', [], [], 'self', refs).map((s) => `${s.kind}:${s.item.id}`)), ['law:5']);
  assert.deepEqual(plain(env.suggestLinks('important', [], [], 'self', refs).map((s) => `${s.kind}:${s.item.id}`)), ['principle:6']);
  assert.equal(env.refOf(refs[2]), '[[principle:6|Make the other person feel important]]');
  assert.deepEqual(plain(env.refTarget('principle:6')), { kind: 'principle', id: '6' });
  assert.equal(env.typedLink('see [[principle:6', 17), null);
  assert.equal(env.resolveNote('principle:6', 'Make the other person feel important', [{ ...note('x', 'Make the other person feel important') }], []), undefined);
});
