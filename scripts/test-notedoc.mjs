import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNoteDoc } from './notedoc-bundle.mjs';

// The note as a document (src/lib/noteDoc): reading a note's text into it and writing it back. Texts read and
// written come back exactly, apart from the few listed in the normalisation table; the blocks are the ones the
// reading view (components/Markdown.tsx) shows; and random documents, put in shape, write text that reads back as
// the same document. Node only: ProseMirror runs without a DOM here.
const nd = await loadNoteDoc({ markdown: true });
const S = nd.noteSchema();
const { EditorState, TextSelection } = nd.pmState;

/* ---------- building documents by hand ---------- */

const mark = (m) => (typeof m === 'string' ? S.marks[m].create() : m);
const txt = (s, ...marks) => S.text(s, marks.map(mark));
const code = (tick = '`') => S.marks.code.create({ tick });
const link = (href, bare = false) => S.marks.link.create({ href, bare });
const node = (type, attrs, ...content) => S.nodes[type].create(attrs, content.flat());
const p = (...c) => node('paragraph', null, ...c);
const doc = (...blocks) => S.nodes.doc.create(null, blocks);
const photo = (id, layout = {}) => node('media', { media: { kind: 'photo', id, ...layout } });

/** a === b for documents and transactions (assert.equal would print the whole schema when they differ). */
const same = (a, b, msg) => assert.ok(a === b, msg);
const roundTrip = (t) => nd.serializeNote(nd.parseNote(t));
/** The characters a document holds, in order: text, and each chip as its token. Pictures as their marker. */
const charsOf = (d) => {
  let out = '';
  d.descendants((n) => {
    if (n.isText) out += n.text;
    else if (n.isAtom && n.isInline) out += nd.atomToken(n.type.name, n.attrs);
    else if (n.type.name === 'media') out += '\0' + JSON.stringify(n.attrs.media);
    return true;
  });
  return out;
};

/* ---------- the corpus: texts that come back exactly ---------- */

const CORPUS = {
  lines: ['', 'a', 'a\nb', 'a\n\n\n\nb', '\n\na\n\n', '\n', '   ', ' \t x', 'a  \nb\t', '\t', 'two  spaces  inside'],
  headings: [
    '# H', '######', '###### ', '#\tTab', '#  x', '# ', '#tag', '####### 7', '## **b** and *i*', '### # hash', '# a\n## b\n###### f',
  ],
  lists: [
    '- a\n* b\n+ c', '-\ta', '1. a', '3) b', '01. x', '123456789. big',
    '1. a\n\t1. b\n\t2. c\n  - d\n    - e\n\t\t- f',
    '              - deeper than six', '- [ ] a\n- [x] b\n- [X] c', '-  [ ]  t', '- ', '- [ ] ', '- [ ]', '1. [ ] x',
    '*\t[x]\tdone', '+ [ ] **bold** task', '- a\n\n- b', '-a', '1.a', '- - x', '1. - x',
  ],
  quotes: [
    '> a\n> b', '>  x', '> a\n> \n> b', '> ', '> - [ ] task\n> # head\n> ```\n> code\n> ```', '> > nested', '> > a\n> b\n> > c',
    '> a\nb', 'a\n> b\nc', '> 1. one\n> 2. two', '> ```\n> unclosed', '> ---', '>   ',
  ],
  callouts: [
    '> [!NOTE] Title', '> [!tip]+ open', '> [!warning]- closed\n> body\n> - item', '> [!info]', '> [!info] ', '> [!note]\ttab',
    '> [!my-kind]  two', '> [!Note] **b** @[Ann]\n> \n> > inner', '> [!todo] t\n> [!note] not a callout', '> [!x]+',
  ],
  code: [
    '```js\nconst a = 1;\n```', '~~~ py\nx\n~~~', '  ```\n  indented\n  ```', '```\nunclosed\nto end', '```\nx\n```js', '```\n\n```',
    '```\n**not bold** # nor heading\n- nor item\n```', '~~~\n```\n~~~', '```\na\n\n', '```\n   \n\t\n```', 'a\n```\nb\n```\nc',
    '```\n> q\n```\n> q',
  ],
  hr: ['---', '***', '___', '- - -', '-----', ' * * * ', '___\t', 'a\n---\nb'],
  inline: [
    '***bi***', '**bold **', '*a *', 'a * b * c', '\\*x\\*', 'a \\* b', '\\\\', '\\#x', '****', 'a ~~~~ b', '====',
    '**b *i* b**', '~~**x**~~', '~~==x==~~', '[**b** t](u)', '[](https://)', '[x]()', 'see https://ex.am/p.', 'https://a.b/c?d=e&f#g',
    '(https://a.b) and <https://c.d>', '[https://a.b](https://a.b)', '#a/b-c', 'not#tag', '(#tag)', '#ünï_1 #2x',
    '@[person:p1|Ann]', '@[Ann]', '♪[song:s1|Song]', '♪[Song]', '[[note:n1|Note]]', '[[book:b1|Book]]', '[[Plain]]',
    '[[a|b|c]]', '@[Ann|x]', '@[person:|x]', '**@[Ann]**', '*[[Note]]*', '~~♪[Song]~~ ==@[A]==', 'emoji 😀👍🏽 and ♪ alone',
    '`code`', '``a`b``', 'a ` b', '`**x**`', '**`x`**', '`a` `b`', '\\`x\\`', '[a](u) [b](v)', '[a *b*](https://x.y/a_b)',
    '**a** **b**', '*a* *b*', '**a*', '*a**', '**', '*', '~~', '\\', 'a\\b', '\\a', '\\ ', 'x: y', 'mailto:a@b.c',
    'snake_case and __dunder__', '[[x]](u)', '@[a]@[b]', '!@#$%^&*()_+-=[]{}|;\':",./<>?', 'tab\there', '**a\\**', '*a\\*b*',
  ],
  pictures: [
    'a\n[[photo:p1]]\nb', '\n[[photo:p1]]\n', 'a\n[[album:photo:p1 image:https://x.y/i.png]]\nb', 'a\n[[photo:p1 50 left]]\nb',
    'a\n[[image:https://x.y/i.png 30]]\nb', 'a\n[[album:photo:p1 photo:p2 40 right]]\nb', 'a\n\n[[photo:p1]]\n\nb',
    'a\n[[photo:p1]]\n\n[[photo:p2]]\nb', '\n[[photo:p1]]\n\n[[photo:p2]]\n', '```\ncode\n[[photo:p1]]\nmore\n```',
    '> quote\n[[photo:p1]]\n> quote', '- item\n[[photo:p1]]\n1. item', '[[photo:p1]] not alone', '[[photo:p1 big]]x',
  ],
};
const corpus = Object.values(CORPUS).flat();

for (const [name, texts] of Object.entries(CORPUS)) {
  test(`${name} come back exactly`, () => {
    for (const t of texts) {
      assert.equal(roundTrip(t), t, JSON.stringify(t));
      const d = nd.parseNote(t);
      same(nd.normalizeDoc(d), d, `already in shape: ${JSON.stringify(t)}`);
    }
  });
}

test('what each kind of line reads as', () => {
  const kinds = (t) => nd.parseNote(t).content.content.map((n) => n.type.name).join(' ');
  assert.equal(kinds('# H\n- a\n1. b\n- [ ] c\n> q\n---\n```\nx\n```\nplain'), 'heading listItem listItem listItem blockquote horizontalRule codeBlock paragraph');
  assert.equal(kinds('> [!note] t\n> b'), 'callout');
  assert.equal(kinds('a\n[[photo:p1]]\nb'), 'paragraph media paragraph');
  assert.equal(kinds('- - -'), 'horizontalRule');

  const item = (t) => ({ ...nd.parseNote(t).firstChild.attrs });
  assert.deepEqual(item('\t01) x'), { kind: 'ol', indent: '\t', bullet: '-', num: '01', delim: ')', checked: false, check: ' ', gap: ' ', sep: ' ' });
  assert.deepEqual(item('*  [X]\tdone'), { kind: 'task', indent: '', bullet: '*', num: '1', delim: '.', checked: true, check: 'X', gap: '  ', sep: '\t' });
  assert.deepEqual({ ...nd.parseNote('###\tx').firstChild.attrs }, { level: 3, sep: '\t' });
  assert.deepEqual({ ...nd.parseNote('> [!Tip]-  t').firstChild.attrs }, { kind: 'Tip', fold: '-', sep: '  ' });
  assert.deepEqual({ ...nd.parseNote('~~~ py\nx').firstChild.attrs }, { open: '~~~ py', close: null });
  assert.equal(kinds(' * * '), 'listItem', 'two stars aren\'t a rule: a bullet holding a star');

  const inl = (t) => nd.parseNote(t).firstChild.toString();
  assert.equal(inl('**b *i* b**'), 'paragraph(bold("b "), bold(italic("i")), bold(" b"))');
  assert.equal(inl('a \\* b'), 'paragraph("a ", escaped("*"), " b")');
  assert.equal(inl('``a`b``'), 'paragraph("`", code("a"), "b``")', 'code never holds a backtick');
  assert.equal(nd.parseNote('``ab``').firstChild.firstChild.marks[0].attrs.tick, '``');
  assert.equal(inl('[**b** t](u)'), 'paragraph(link(bold("b")), link(" t"))');
  assert.equal(inl('[https://a.b](https://a.b)'), 'paragraph(link("https://a.b"))');
  assert.equal(nd.parseNote('[https://a.b](https://a.b)').firstChild.firstChild.marks[0].attrs.bare, false, 'an address in [text](…) is the text');
  assert.deepEqual({ ...nd.parseNote('go https://a.b.').firstChild.child(1).marks[0].attrs }, { href: 'https://a.b', bare: true });
  const chips = nd.parseNote('@[person:p1|Ann] @[Bo] ♪[song:s|S] [[note:n|N]] [[W]] **@[C]**').firstChild;
  assert.deepEqual(
    [0, 2, 4, 6, 8, 10].map((i) => [chips.child(i).type.name, { ...chips.child(i).attrs }, chips.child(i).marks.map((m) => m.type.name)]),
    [
      ['person', { target: 'p1', label: 'Ann' }, []], ['person', { target: null, label: 'Bo' }, []], ['song', { target: 's', label: 'S' }, []],
      ['wiki', { target: 'note:n', label: 'N' }, []], ['wiki', { target: null, label: 'W' }, []], ['person', { target: null, label: 'C' }, ['bold']],
    ],
  );
  assert.equal(chips.textContent.startsWith('@[person:p1|Ann] @[Bo]'), true, 'chips give their token as text');
});

/* ---------- normalisations: texts that come back different ---------- */

// Content is never lost: what changes is how it's written.
const READ_NORMALISED = [
  ['>x', '> x'],
  ['>', '> '],
  ['  > x', '> x'],
  ['> a\n>b\n\t>\tc', '> a\n> b\n> c'],
  ['>> x', '> > x'],
  ['> [!note] t\n>body', '> [!note] t\n> body'],
  ['```\n```', '```\n\n```'],
  ['```\n', '```'],
  ['> ```\n> ', '> ```'],
  ['[[photo:p1]]', '\n[[photo:p1]]\n'],
  ['[[photo:p1]]\n[[photo:p2]]', '\n[[photo:p1]]\n\n[[photo:p2]]\n'],
  ['a\n[[photo:p1]]', 'a\n[[photo:p1]]\n'],
  ['[[photo:p1]]\nb', '\n[[photo:p1]]\nb'],
  ['a\n[[photo:p1 100]]\nb', 'a\n[[photo:p1]]\nb'],
  ['a\n[[photo:p1 left]]\nb', 'a\n[[photo:p1]]\nb'],
  ['a\n[[photo:p1 5 right]]\nb', 'a\n[[photo:p1 20 right]]\nb'],
  ['a\n[[photo:p1 right 50 x]]\nb', 'a\n[[photo:p1 50 right]]\nb'],
  // styles over the same words nest in one order: link, strike, highlight, bold, italic, code (outermost first)
  ['==~~x~~==', '~~==x==~~'],
  ['**[b](u)**', '[**b**](u)'],
  ['*~~x~~* and *==y==*', '~~*x*~~ and ==*y*=='],
];

test('the few texts that are written differently, read and put in shape', () => {
  for (const [t, want] of READ_NORMALISED) {
    const d = nd.normalizeDoc(nd.parseNote(t));
    assert.equal(nd.serializeNote(d), want, JSON.stringify(t));
    assert.equal(roundTrip(want), want, `the result comes back exactly: ${JSON.stringify(want)}`);
    assert.ok(nd.sameDoc(nd.parseNote(want), d), `and reads as the same document: ${JSON.stringify(t)}`);
  }
});

// Edited or pasted content that can't be written as it is: styles, escapes and fences adjust; characters stay.
const EDITED = [
  ['leading spaces go out of a style', doc(p(txt('a'), txt('  b', 'bold'))), 'a  **b**'],
  ['a style of spaces only is left off', doc(p(txt('a'), txt(' ', 'italic'), txt('b'))), 'a b'],
  ['trailing spaces stay in', doc(p(txt('b ', 'bold'), txt('c'))), '**b **c'],
  ['code is split around a backtick', doc(p(txt('a`b', code()))), '`a```b`'],
  ['a code tick that isn\'t backticks', doc(p(txt('x', code('"')))), '`x`'],
  ['a link is split around ]', doc(p(txt('a]b', link('u')))), '[a](u)][b](u)'],
  ['spaces and ) in an address are encoded', doc(p(txt('t', link('https://x.y/a b)')))), '[t](https://x.y/a%20b%29)'],
  ['an address that isn\'t its text is written in full', doc(p(txt('https://a.b', link('https://c.d', true)))), '[https://a.b](https://c.d)'],
  ['an address that doesn\'t read as one alone', doc(p(txt('https://a.b.', link('https://a.b.', true)))), '[https://a.b.](https://a.b.)'],
  ['text typed right after an address', doc(p(txt('https://a.b', link('https://a.b', true)), txt('cd'))), '[https://a.b](https://a.b)cd'],
  ['an address followed by a style', doc(p(txt('https://a.b', link('https://a.b', true)), txt('bold', 'bold'))), '[https://a.b](https://a.b)**bold**'],
  ['… by a chip', doc(p(txt('https://a.b', link('https://a.b', true)), node('person', { target: null, label: 'A' }))), '[https://a.b](https://a.b)@[A]'],
  ['an address holding ] or ) stays bare', doc(p(txt('https://a.b/[x](y)z', link('https://a.b/[x](y)z', true)))), 'https://a.b/[x](y)z'],
  ['an address followed by a full stop stays bare', doc(p(txt('https://a.b', link('https://a.b', true)), txt('.'))), 'https://a.b.'],
  ['plain stars are escaped', doc(p(txt('*a*'))), '\\*a\\*'],
  ['plain doubled tildes and equals', doc(p(txt('~~a~~ ==b=='))), '\\~\\~a\\~\\~ \\=\\=b\\=\\='],
  ['a plain tilde next to a strike', doc(p(txt('a~'), txt('b', 'strike'))), 'a\\~~~b~~'],
  ['a style starting with code that starts with a space', doc(p(txt(' x', 'bold', code()), txt(' y', 'bold'))), '**` x` y**'],
  ['a plain backslash before punctuation', doc(p(txt('\\*'))), '\\\\\\*'],
  ['plain chip syntax', doc(p(txt('@[Ann] [[W]] ♪[S]'))), '\\@\\[Ann] \\[\\[W]] ♪\\[S]'],
  ['plain link syntax', doc(p(txt('[a](u)'))), '\\[a](u)'],
  ['plain code', doc(p(txt('`x`'))), '\\`x\\`'],
  ['a plain address', doc(p(txt('see https://a.b'))), 'see https\\://a.b'],
  ['a paragraph that looks like a heading', doc(p(txt('# not heading'))), '\\# not heading'],
  ['… a bullet', doc(p(txt('- x'))), '\\- x'],
  ['… a number', doc(p(txt('1. x'))), '1\\. x'],
  ['… a quote', doc(p(txt('  > x'))), '  \\> x'],
  ['… a rule', doc(p(txt('---'))), '\\---'],
  ['… a fence', doc(p(txt('```js'))), '\\```js'],
  ['… a picture', doc(p(txt('[[photo:p1]]'))), '\\[[photo:p1]]'],
  ['a bullet whose text is a box', doc(node('listItem', { kind: 'ul' }, txt('[ ] x'))), '- \\[ ] x'],
  ['a bullet whose text makes it a rule', doc(node('listItem', { kind: 'ul' }, txt('- -'))), '- \\- -'],
  ['a quote\'s first line that looks like a callout', doc(node('blockquote', null, p(txt('[!note] x')))), '> \\[!note] x'],
  ['a callout title starting with its fold', doc(node('callout', { kind: 'note', fold: '', sep: '' }, node('calloutTitle', null, txt('+x')))), '> [!note]\\+x'],
  ['a code line starting with the fence switches fences', doc(node('codeBlock', { open: '```js', close: '```' }, txt('```\nx'))), '~~~js\n```\nx\n~~~'],
  ['… and back', doc(node('codeBlock', { open: '~~~', close: '~~~' }, txt('~~~'))), '```\n~~~\n```'],
  ['an unclosed code block before more text is closed', doc(node('codeBlock', { open: '```', close: null }, txt('x')), p(txt('y'))), '```\nx\n```\ny'],
  ['leading spaces of a heading go to its marker', doc(node('heading', { level: 2, sep: ' ' }, txt('  x'))), '##   x'],
  ['… of a list item', doc(node('listItem', { kind: 'ol', num: '2' }, txt('\tx'))), '2. \tx'],
  ['… of a callout title', doc(node('callout', { kind: 'tip', fold: '', sep: '' }, node('calloutTitle', null, txt(' t')))), '> [!tip] t'],
  ['text holding line breaks becomes lines', doc(p(txt('a\nb', 'bold'), txt('\nc'))), '**a**\n**b**\nc'],
  ['… in a list item', doc(node('listItem', { kind: 'ul' }, txt('a\nb'))), '- a\nb'],
  ['quotes next to each other become one', doc(node('blockquote', null, p(txt('a'))), node('blockquote', null, p(txt('b')))), '> a\n> b'],
  ['a callout and a quote get a line between', doc(node('callout', null, node('calloutTitle', null, txt('t'))), node('blockquote', null, p(txt('q')))), '> [!note] t\n\n> q'],
  ['… a quote and a callout', doc(node('blockquote', null, p(txt('q'))), node('callout', null, node('calloutTitle', null, txt('t')))), '> q\n\n> [!note] t'],
  ['… two callouts, in a quote', doc(node('blockquote', null, node('callout', null, node('calloutTitle')), node('callout', null, node('calloutTitle')))), '> > [!note] \n> \n> > [!note] '],
  ['a picture first or last gets a line', doc(photo('p1')), '\n[[photo:p1]]\n'],
  ['two pictures get a line between', doc(p(txt('a')), photo('p1'), photo('p2'), p(txt('b'))), 'a\n[[photo:p1]]\n\n[[photo:p2]]\nb'],
  ['odd attributes give way to defaults', doc(node('heading', { level: 9, sep: '' }, txt('h')), node('listItem', { kind: 'zz', bullet: '>', indent: 'x', sep: '' }, txt('i')), node('horizontalRule', { raw: 'no' })), '###### h\n- i\n---'],
  ['a task\'s box follows whether it\'s done', doc(node('listItem', { kind: 'task', checked: true, check: ' ' }, txt('a')), node('listItem', { kind: 'task', checked: false, check: 'X' }, txt('b'))), '- [x] a\n- [ ] b'],
];

test('edited content is written so it reads back the same, keeping every character', () => {
  for (const [name, d, want] of EDITED) {
    const n = nd.normalizeDoc(d);
    const out = nd.serializeNote(n);
    assert.equal(out, want, name);
    assert.equal(roundTrip(out), out, `${name}: comes back exactly`);
    assert.equal(charsOf(nd.parseNote(out)).replace(/\0.*/g, ''), charsOf(n).replace(/\0.*/g, ''), `${name}: keeps its characters`);
  }
});

test('what can\'t be written there is left off, its characters kept', () => {
  // italic can't start right after a star (lib/inline.ts): the italic goes, the words stay; nor can a link or a
  // [[wiki]] chip follow a ♪ (it reads as a ♪[song], and ♪ can't be escaped): the link goes, the chip reads as a song
  for (const d of [
    doc(p(txt('a', 'bold'), txt('b', 'italic'))), doc(p(txt('*'), txt('b', 'italic'))),
    doc(p(txt('♪'), txt('a', link('u')))), doc(p(txt('♪'), node('wiki', { target: null, label: 'W' }))),
    // italic can't hold code with a star; the code of spaces a title starts with stays (plain, they'd be its marker's)
    doc(node('callout', { kind: 'tip', fold: '', sep: ' ' }, node('calloutTitle', null, txt(' [', code()), txt('a*b', 'italic', code())))),
    doc(node('heading', { level: 1, sep: ' ' }, txt(' ', code()), txt('*', 'bold', code()))),
  ]) {
    const out = nd.serializeNote(d);
    assert.equal(roundTrip(out), out);
    assert.equal(charsOf(nd.parseNote(out)), charsOf(d), out);
  }
});

/* ---------- the reading view reads the same blocks ---------- */

/** A line's inline content, compared by what it reads as (styles, chips, characters), not how it's written. */
const inlineKey = (content) => nd.docKey(S.nodes.paragraph.create(null, content));
const readKey = (s) => inlineKey(nd.parseInline(s));

/**
 * The document's blocks in the shape of Markdown.tsx `parse`: lines of text run together into paragraphs, blank
 * lines are gaps (none first or last), a quote's body as its blocks. `line` counts lines from the stretch's start.
 */
function project(nodes, line = 0) {
  const out = [];
  for (const n of nodes) {
    const a = n.attrs;
    switch (n.type.name) {
      case 'paragraph': {
        const last = out[out.length - 1];
        if (!nd.serializeBlocks([n]).trim()) { // a blank line (a code span of spaces isn't one)
          if (out.length && last.t !== 'gap') out.push({ t: 'gap' });
        } else if (last?.t === 'p') last.lines.push(inlineKey(n.content));
        else out.push({ t: 'p', lines: [inlineKey(n.content)] });
        break;
      }
      case 'heading': out.push({ t: 'h', level: a.level, text: inlineKey(n.content) }); break;
      case 'listItem':
        out.push({ t: 'li', kind: a.kind, depth: nd.depthOf(a.indent), marker: a.kind === 'ol' ? a.num + '.' : '', done: a.check === 'x' || a.check === 'X', text: inlineKey(n.content), line });
        break;
      case 'codeBlock': out.push({ t: 'code', text: n.textContent }); break;
      case 'horizontalRule': out.push({ t: 'hr' }); break;
      case 'blockquote': {
        const kids = [];
        n.forEach((c) => kids.push(c));
        out.push({ t: 'quote', callout: null, title: '', body: project(kids, line), line });
        break;
      }
      case 'callout': {
        const kids = [];
        n.forEach((c) => kids.push(c));
        const title = kids.shift();
        out.push({
          t: 'quote', callout: a.kind.toLowerCase(), title: title.content.size ? inlineKey(title.content) : readKey(nd.calloutDefaultTitle(a.kind)),
          body: project(kids, line + 1), line: line + 1,
        });
        break;
      }
      default: throw new Error('no ' + n.type.name + ' in a stretch of text');
    }
    line += nd.serializeBlocks([n]).split('\n').length;
  }
  if (out[out.length - 1]?.t === 'gap') out.pop();
  return out;
}

/** Markdown.tsx's blocks with each quote's body read as its blocks, as the reading view shows it. */
const reading = (text, offset = 0) =>
  nd.markdownParse(text, offset).map((b) =>
    b.t === 'quote' ? { ...b, title: b.callout ? readKey(b.title) : '', body: reading(b.body, b.line) }
    : b.t === 'p' ? { ...b, lines: b.lines.map(readKey) }
    : b.t === 'h' || b.t === 'li' ? { ...b, text: readKey(b.text) }
    : b);

/** The note's stretches of text (between pictures), each as the editor's top-level blocks. */
function stretches(d) {
  const out = [[]];
  d.forEach((n) => (n.type.name === 'media' ? out.push([]) : out[out.length - 1].push(n)));
  return out;
}

/** Blocks without their line numbers. */
const noLines = (bs) => bs.map(({ line, ...b }) => (b.t === 'quote' ? { ...b, body: noLines(b.body) } : b));

/**
 * Checks that the editor reads `t` as the reading view does. Line numbers (which a task's box ticks by) are those of
 * the text the editor saves, which differ from `t` only for an empty code block (```\n``` is saved ```\n\n```).
 */
function sameAsReading(t, why = JSON.stringify(t)) {
  const d = nd.parseNote(t);
  const { texts } = nd.parseBody(t);
  const saved = nd.parseBody(nd.serializeNote(d)).texts;
  const parts = stretches(d);
  assert.equal(parts.length, texts.length, why);
  parts.forEach((nodes, i) => {
    assert.deepEqual(noLines(project(nodes)), noLines(reading(texts[i])), why);
    assert.deepEqual(project(nodes), reading(saved[i]), `${why}: line numbers`);
  });
}

test('the editor reads the same blocks as the reading view', () => {
  for (const t of [...corpus, ...READ_NORMALISED.map(([x]) => x)]) sameAsReading(t);
});

test('the line kinds agree with Markdown.tsx', () => {
  // syntax.ts's regexes are copies of Markdown.tsx's: each line reads as the same kind of block
  const one = { blank: [], fence: 'code', hr: 'hr', heading: 'h', item: 'li', quote: 'quote', text: 'p' };
  for (const l of ['', ' ', '```x', ' ~~~', '---', '* * *', '#x', '# x', '- x', '-x', '1) x', '1)x', '> x', '>x', ' >', 'x', '- [ ]', '+\t[x]\tt', '__ _']) {
    const want = one[nd.classifyLine(l).t];
    const got = nd.markdownParse(l).map((b) => b.t);
    assert.deepEqual(got, Array.isArray(want) ? want : [want], JSON.stringify(l));
  }
});

/* ---------- random documents ---------- */

/** A small seeded random number generator (mulberry32), so a failing document can be made again. */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random documents. `wild` ones also hold what can't be written as it is (code holding a backtick, italic holding
 * bold, a style starting with a space, a link's text holding ], text holding a line break): the serializer leaves
 * off a style there, but never a character.
 */
function generator(seed, { wild = false } = {}) {
  const r = rng(seed);
  const int = (n) => Math.floor(r() * n);
  const pick = (xs) => xs[int(xs.length)];
  const chance = (x) => r() < x;
  const str = (alphabet, max) => Array.from({ length: 1 + int(max) }, () => pick(alphabet)).join('');

  const LETTERS = [...'abcxyz  ', 'Ab', 'é', '😀'];
  const SPECIAL = [...'*~=`\\[]()#@!:/|♪\t.-_>+1{}<', '**', '~~', '==', '``', '[[', ']]', '@[', '♪[', '- ', '# ', '> ', '1. ', 'https://'];
  const plainText = (max = 8) => str(chance(0.5) ? [...LETTERS, ...SPECIAL, ...(wild ? ['\n', ' *', '* '] : [])] : LETTERS, max);
  const label = () => pick(['Ann', 'Bo b', 'x.y', 'Café', '1', 'a-b', 'Ünï']);
  const HREFS = ['https://ex.am/p', 'u', 'mailto:a@b.c', '', '#x', 'https://x.y/a_b'];
  const ESCAPABLE = /^[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]$/;

  // A line's content as styles nested in each other, the way text gets styled: what can't be written at all is left
  // out (the cases above show what the serializer does with it). Code never holds a backtick, nor a ] in a link,
  // nor stars, tildes or equals in another style; a link's text never holds a ]; a style never starts with a space;
  // italic never holds bold, nor starts right after a star (lib/inline.ts reads neither).
  const inlineContent = () => {
    const out = [];
    const fill = (ctx, depth) => {
      const names = ctx.map((m) => m.type.name);
      const inLink = names.includes('link');
      for (let k = 1 + int(depth ? 3 : 5); k > 0; k--) {
        const roll = r();
        const prev = out[out.length - 1];
        const afterNote = !wild && prev?.isText && prev.text.endsWith('♪'); // ♪ then [ reads as a song: tested above
        if (roll < 0.1) {
          const type = pick(['person', 'song', afterNote ? 'song' : 'wiki']);
          const target = chance(0.5) ? null : type === 'wiki' ? pick(['note:n1', 'book:b2', 'Page']) : 'id' + int(9);
          out.push(S.nodes[type].create({ target, label: label() }, null, ctx.filter((m) => m.type.name !== 'link')));
        } else if (roll < 0.2) {
          const alphabet = wild ? [...LETTERS, ...'\\[]#@*~=`'] : [...LETTERS, ...'\\[]#@', ...(names.some((n) => n !== 'link') ? '' : '*~=')].filter((c) => !(inLink && c === ']'));
          out.push(S.text(str(alphabet, 5), [...ctx, code(pick(['`', '``']))]));
        } else if (roll < 0.27 && !inLink) {
          // an address written as it is, then a space (text typed right after one is tested above)
          const url = 'https://' + pick(['a.b', 'ex.am/p_q', 'x.y/a?b=c']);
          out.push(S.text(url, [...ctx, link(url, true)]), S.text(' ', ctx));
        } else if (roll < 0.5 && depth < 3) {
          const name = pick(['bold', 'italic', 'strike', 'highlight', 'link'].filter((n) => !names.includes(n) && (wild || !(n === 'bold' && names.includes('italic'))) && !(n === 'link' && afterNote)));
          const afterStar = !wild && prev && (prev.marks.some((m) => m.type.name === 'bold' && !names.includes('bold')) || (prev.isText && prev.text.endsWith('*')));
          if (!name || (name === 'italic' && afterStar)) continue;
          const from = out.length;
          fill([...ctx, name === 'link' ? link(pick(HREFS)) : S.marks[name].create()], depth + 1);
          const first = out[from];
          if (!wild && first?.isText && !first.marks.some((m) => m.type.name === 'code') && /^\s/.test(first.text)) {
            out[from] = S.text(first.text.replace(/^\s+/, '') || 'w', first.marks);
          }
        } else {
          for (const c of plainText()) {
            if (inLink && c === ']' && !wild) continue;
            out.push(S.text(c, chance(0.1) && ESCAPABLE.test(c) ? [...ctx, S.marks.escaped.create()] : ctx));
          }
        }
      }
    };
    fill([], 0);
    return out;
  };

  const codeLines = () => {
    const inner = pick(['```', '~~~']); // one kind of fence inside, so the other can close it
    return Array.from({ length: int(4) }, () =>
      pick(['', 'x', '  y', '**b**', '# h', '- i', '> q', inner, inner + 'js', '  ' + inner, '\t', '[[x]]'])).join('\n');
  };

  const block = (depth) => {
    const roll = r();
    if (roll < 0.3) return p(chance(0.15) ? (chance(0.5) ? [] : [S.text(pick([' ', '  ', '\t']))]) : inlineContent());
    if (roll < 0.4) return node('heading', { level: 1 + int(chance(0.05) ? 9 : 6), sep: pick([' ', ' ', '  ', '\t']) }, inlineContent());
    if (roll < 0.6) {
      const kind = pick(['ul', 'ol', 'task']);
      const checked = kind === 'task' && chance(0.5);
      return node('listItem', {
        kind, checked,
        indent: pick(['', '', '  ', '\t', '    ', ' ', '\t  ', '              ']),
        bullet: pick(['-', '*', '+']), num: pick(['1', '2', '01', '10', '123456789']), delim: pick(['.', ')']),
        check: checked ? pick(['x', 'X']) : ' ', gap: pick([' ', '  ', '\t']), sep: pick([' ', ' ', '  ', '\t']),
      }, inlineContent());
    }
    if (roll < 0.68) {
      const open = pick(['```', '~~~', '```js', '  ```', '~~~ py']);
      const fence = open.trim().slice(0, 3);
      const text = codeLines();
      return node('codeBlock', { open, close: chance(0.2) ? null : pick([fence, fence, fence + 'x', ' ' + fence]) }, text ? [S.text(text)] : []);
    }
    if (roll < 0.73) return node('horizontalRule', { raw: pick(['---', '***', '___', '- - -', '-----', ' * * *', '***  ']) });
    if (roll < 0.86 && depth < 2) return node('blockquote', null, Array.from({ length: 1 + int(3) }, () => block(depth + 1)));
    if (roll < 0.95 && depth < 2) {
      return node('callout', { kind: pick(['note', 'NOTE', 'Tip', 'my-kind', 'warning']), fold: pick(['', '', '+', '-']), sep: pick(['', ' ', ' ', '  ', '\t']) },
        node('calloutTitle', null, inlineContent()), Array.from({ length: int(3) }, () => block(depth + 1)));
    }
    return p(inlineContent());
  };

  const item = () => (chance(0.5) ? { kind: 'photo', id: 'p' + int(99) } : { kind: 'image', url: `https://x.y/${int(99)}.png` });
  const media = () => {
    const m = chance(0.2) ? { kind: 'album', items: [item(), item()] } : item();
    if (chance(0.4)) Object.assign(m, { size: pick([20, 30, 50, 99]) }, chance(0.5) && { align: pick(['left', 'right']) });
    return node('media', { media: m });
  };

  return () => doc(...Array.from({ length: 1 + int(8) }, () => (chance(0.08) ? media() : block(0))));
}

/** The first block (going into quotes) where two documents differ, both ways, and its text. */
function firstDiff(want, got) {
  for (let i = 0; i < Math.max(want.childCount, got.childCount); i++) {
    const a = want.maybeChild(i), b = got.maybeChild(i);
    if (a && b && nd.docKey(a) === nd.docKey(b)) continue;
    if (a && b && a.type === b.type && /^(blockquote|callout)$/.test(a.type.name)) return firstDiff(a, b);
    return `\n  want ${a}\n  got  ${b}\n  text ${a && JSON.stringify(nd.serializeBlocks([a]))}\n  json ${a && JSON.stringify(a.toJSON())}`;
  }
  return 'nowhere';
}

test('random documents, put in shape, read back as themselves', () => {
  const seed = Number(process.env.SEED ?? 1);
  const random = generator(seed);
  const COUNT = Number(process.env.COUNT ?? 1000);
  for (let i = 0; i < COUNT; i++) {
    const d = random();
    const n = nd.normalizeDoc(d);
    const why = () => `document ${i} (SEED=${seed}):\n${n}`;
    same(nd.normalizeTr(EditorState.create({ doc: n })), null, `in shape stays in shape: ${why()}`);
    const text = nd.serializeNote(n);
    const back = nd.parseNote(text);
    assert.equal(charsOf(back), charsOf(n), `no character lost: ${JSON.stringify(text)}\n${why()}`);
    assert.ok(nd.sameDoc(back, n), `reads back differently: ${firstDiff(n, back)}\n${why()}`);
    assert.equal(nd.serializeNote(back), text, `written again the same: ${JSON.stringify(text)}`);
  }
});

test('random documents with what can\'t be written: no character lost, and what\'s written is stable', () => {
  const seed = Number(process.env.SEED ?? 1);
  const random = generator(seed, { wild: true });
  const COUNT = Number(process.env.COUNT ?? 1000);
  for (let i = 0; i < COUNT; i++) {
    const n = nd.normalizeDoc(random());
    const why = () => `document ${i} (SEED=${seed}, wild):\n${n}`;
    same(nd.normalizeTr(EditorState.create({ doc: n })), null, `in shape stays in shape: ${why()}`);
    const text = nd.serializeNote(n);
    const back = nd.parseNote(text);
    assert.equal(charsOf(back), charsOf(n), `no character lost: ${JSON.stringify(text)}\n${why()}`);
    same(nd.normalizeDoc(back), back, `reads back in shape: ${JSON.stringify(text)}`);
    // what it reads back as is written so it reads the same, and from then on the text stays as it is (the first
    // time, runs of a style that the left-off one kept apart can join: ==a====b== is written ==ab==)
    const again = nd.serializeNote(back);
    assert.ok(nd.sameDoc(nd.parseNote(again), back), `written again, reads the same: ${JSON.stringify(text)} → ${JSON.stringify(again)}`);
    assert.equal(roundTrip(again), again, `then stays the same: ${JSON.stringify(again)}`);
  }
});

/** Random note texts: lines of block markers and inline syntax mixed with words, the way notes are written and mistyped. */
function textGenerator(seed) {
  const r = rng(seed);
  const int = (n) => Math.floor(r() * n);
  const pick = (xs) => xs[int(xs.length)];
  const STARTS = [
    '', '', '', '', '# ', '##\t', '###### ', '#', '- ', '* ', '+ ', '-\t', '- [ ] ', '* [x] ', '-  [X]\t', '1. ', '01) ', '2.', '  - ', '\t1. ',
    '      - ', '> ', '>', '> > ', '  > ', '> [!note] ', '> [!Tip]- ', '>[!x]', '> - ', '> # ', '```', '~~~ js', '> ```', '---', '* * *', '___',
    ' ', '\t', '[[photo:p1]]', '[[album:photo:p1 image:https://x.y/i.png 50 left]]', '[[image:https://x.y/i.png 5 right]]',
  ];
  const BITS = [
    'a', 'b c', 'word', ' ', '  ', '\t', '😀', 'é', '**', '*', '~~', '==', '`', '``', '[', ']', '(', ')', '](u)', '](https://a.b)', '()',
    'https://x.y/z', 'https://a.b.', 'mailto:a@b.c', '@[', '@[Ann]', '@[person:p1|Ann]', '♪[', '♪[song:s|S]', '[[', ']]', '[[note:n|N]]', '[[W]]',
    '|', '\\', '\\*', '\\#', '#tag', ' #x/y', '!', ':', '-', '1.', '>', '[!note]', '****', '~~~~', '====', '***', '_', '{', '}',
  ];
  const line = () => pick(STARTS) + Array.from({ length: int(7) }, () => pick(BITS)).join('');
  return () => Array.from({ length: 1 + int(7) }, line).join('\n');
}

test('random texts: the reading view\'s blocks, and saved without losing or changing a thing', () => {
  const seed = Number(process.env.SEED ?? 1);
  const random = textGenerator(seed);
  const COUNT = Number(process.env.COUNT ?? 1000);
  for (let i = 0; i < COUNT; i++) {
    const t = random();
    const why = `${JSON.stringify(t)} (text ${i}, SEED=${seed})`;
    sameAsReading(t, `reading view: ${why}`);
    const d = nd.parseNote(t);
    const n = nd.normalizeDoc(d);
    assert.equal(charsOf(n), charsOf(d), `putting in shape keeps the characters: ${why}`);
    const out = nd.serializeNote(n);
    const back = nd.parseNote(out);
    assert.equal(charsOf(back), charsOf(n), `no character lost: ${why} → ${JSON.stringify(out)}`);
    assert.ok(nd.sameDoc(back, n), `reads back the same: ${why} → ${JSON.stringify(out)}${firstDiff(n, back)}`);
    assert.equal(roundTrip(out), out, `then stays the same: ${why} → ${JSON.stringify(out)}`);
  }
});

/* ---------- putting in shape ---------- */

test('normalizeTr fixes structure only, once, and gives null when there is nothing to do', () => {
  for (const t of corpus) {
    const s = EditorState.create({ doc: nd.parseNote(t) });
    same(nd.normalizeTr(s), null, JSON.stringify(t));
  }
  for (const [name, d] of EDITED) {
    const tr = nd.normalizeTr(EditorState.create({ doc: d }));
    const fixed = nd.normalizeDoc(d);
    if (fixed === d) {
      same(tr, null, name);
      continue;
    }
    assert.ok(tr, name);
    assert.ok(tr.doc.eq(fixed), `normalizeDoc gives the same: ${name}`);
    same(nd.normalizeTr(EditorState.create({ doc: tr.doc })), null, `idempotent: ${name}`);
    same(nd.normalizeDoc(fixed), fixed, `normalizeDoc is idempotent: ${name}`);
  }
  // styles and characters aren't touched
  const styled = doc(p(txt('a', 'bold'), txt(' *b* ', 'italic')));
  same(nd.normalizeDoc(styled), styled);
});

test('putting in shape keeps the caret where it was', () => {
  const d = doc(p(txt('ab\ncd')));
  const s = EditorState.create({ doc: d, selection: TextSelection.create(d, 5) }); // between c and d
  const tr = nd.normalizeTr(s);
  const next = s.apply(tr);
  assert.equal(nd.show(next), 'ab\nc|d');
  const quotes = EditorState.create({ doc: doc(node('blockquote', null, p(txt('a'))), node('blockquote', null, p(txt('b')))) });
  const caretInB = quotes.apply(quotes.tr.setSelection(TextSelection.create(quotes.doc, 7)));
  assert.equal(nd.show(caretInB.apply(nd.normalizeTr(caretInB))), '> a\n> |b');
});

/* ---------- putting a new version in place ---------- */

test('replaceDoc changes only what differs and keeps the caret', () => {
  const check = (from, to) => {
    const s = EditorState.create({ doc: nd.parseNote(from) });
    const tr = nd.replaceDoc(s.tr, nd.parseNote(to));
    assert.equal(nd.serializeNote(tr.doc), to, `${JSON.stringify(from)} → ${JSON.stringify(to)}`);
    assert.ok(tr.doc.eq(nd.parseNote(to)));
    return tr;
  };
  assert.equal(check('a\nb', 'a\nb').steps.length, 0, 'nothing to do');
  const tr = check('one\ntwo\nthree', 'one\nTWO\nthree');
  assert.equal(tr.steps.length, 1);
  const { from, to } = tr.steps[0];
  assert.ok(from >= 5 && to <= 10, `only the middle line (${from}–${to})`);
  check('a\na', 'a\na\na');
  check('a\na\na', 'a\na');
  check('x', '');
  check('', '# new\n- list');
  check('a\n[[photo:p1]]\nb', 'a\n[[photo:p1 50 left]]\nb');
  check('a\n[[photo:p1]]\nb', 'b');
  check('> q\n> r', '> q\n\n> r');
  check('**bold** text', '*bold* text');

  const s = nd.stateFrom('top\nmiddle\nend|');
  const next = s.apply(nd.replaceDoc(s.tr, nd.parseNote('TOP\nmiddle\nend')));
  assert.equal(nd.show(next), 'TOP\nmiddle\nend|', 'a change above leaves the caret in its place');

  const random = generator(7);
  for (let i = 0; i < 200; i++) {
    const a = nd.normalizeDoc(random());
    const b = nd.normalizeDoc(random());
    const t = nd.replaceDoc(EditorState.create({ doc: a }).tr, b);
    assert.ok(t.doc.eq(b), `random pair ${i}`);
  }
});

/* ---------- copying ---------- */

test('serializeSlice: words alone from one line, Markdown lines from more', () => {
  const d = nd.parseNote('**bold** text\n- item one\n> quoted\n```\ncode\n```\n[[photo:p1]]\nafter');
  const slice = (from, to) => nd.serializeSlice(d.slice(from, to));
  const at = (s) => {
    let found = -1;
    d.descendants((n, pos) => {
      if (found < 0 && n.isText && n.text.includes(s)) found = pos + n.text.indexOf(s);
    });
    return found;
  };
  assert.equal(slice(at('old'), at('ext') + 3), '**old** text', 'part of a line: its words, styles kept');
  assert.equal(slice(at('tem'), at('tem') + 3), 'tem', 'part of a list item: no marker');
  assert.equal(slice(at('quoted'), at('quoted') + 3), 'quo', 'part of a quote');
  assert.equal(slice(at('code'), at('code') + 2), 'co', 'part of code: as it is');
  assert.equal(slice(at('ext'), at('one') + 3), 'ext\n- item one', 'over two lines: Markdown lines');
  assert.equal(slice(0, d.content.size), nd.serializeNote(d), 'everything: the note');
  assert.equal(slice(at('code'), d.content.size), '```\ncode\n```\n[[photo:p1]]\nafter', 'a block it starts in keeps its marker, pictures as their lines');
  assert.equal(slice(at('one'), at('quoted') + 6), '- one\n> quoted');
  assert.equal(slice(3, 3), '');
  assert.equal(nd.serializeSlice(nd.parseNote('a *b* c').slice(1, 6)), 'a *b* c');
  assert.equal(nd.serializeSlice(nd.parseNote('\\*x').slice(1, 3)), '\\*x', 'escapes stay');
  assert.equal(nd.serializeSlice(nd.parseNote('*a*').slice(1, 2)), '*a*', 'a word cut from a style keeps it');
});

/* ---------- the test helpers ---------- */

test('stateFrom and show write the selection into the text', () => {
  for (const t of [
    '|', '- a|b', '# «Day» one', '»Day« one', '**b|old**', '> q|', 'a\n|b', '```\nco|de\n```', '> [!note] T|i\n> b', '1. a\n\t2. |b',
    '«a\nb»', 'x «**y»** z', '[li|nk](u)', '- [ ] «task»', '[[photo:p1]]\n|', '> > dee|p',
  ]) {
    const want = t.startsWith('[[photo') ? '\n[[photo:p1]]\n|' : t;
    assert.equal(nd.show(nd.stateFrom(t)), want, JSON.stringify(t));
  }
  assert.equal(nd.show(nd.stateFrom('|- a')), '- |a', 'before a marker: the start of the text');
  assert.equal(nd.show(nd.stateFrom('**b**| c')), '**b|** c', 'at the end of a style: inside it, where typing goes on in it');
  assert.equal(nd.show(nd.stateFrom('|> [!note] x')), '> [!note] |x');
  assert.equal(nd.show(nd.stateFrom('a ‸@[person:p|Ann] [[x|y]]', { caret: '‸' }), { caret: '‸' }), 'a ‸@[person:p|Ann] [[x|y]]');

  const s = nd.stateFrom('- a|b');
  assert.equal(s.selection.from, 2);
  assert.equal(s.doc.firstChild.type.name, 'listItem');
  const r = nd.stateFrom('»ab«');
  assert.deepEqual([r.selection.anchor, r.selection.head], [3, 1], 'anchor and head as written');
  const b = nd.stateFrom('**a|b**');
  assert.deepEqual(b.selection.$from.marks().map((m) => m.type.name), ['bold'], 'the caret is inside the bold');
  assert.throws(() => nd.stateFrom('@[A|nn]'), /marker/, 'a caret in a chip\'s token');
});
