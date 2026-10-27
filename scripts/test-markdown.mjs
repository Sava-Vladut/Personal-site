import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// The inline syntax every view reads (lib/inline.ts) and the plain words of excerpts (lib/markdown.ts). The editing
// commands are the note editor's: scripts/test-notedoc-edit.mjs. No browser is used.
const src = (f) => new URL(`../src/lib/${f}`, import.meta.url).pathname;
const bundle = await rolldown({
  input: 'review:markdown',
  plugins: [{
    name: 'markdown-entry',
    resolveId: (id) => (id === 'review:markdown' ? '\0' + id : null),
    load: (id) => id === '\0review:markdown' ? `
      export * from '${src('markdown.ts')}';
      export { inline, plainInline, dropTags } from '${src('inline.ts')}';
    ` : null,
  }],
});
const code = (await bundle.generate({ format: 'cjs' })).output[0].code;
await bundle.close();
const module = { exports: {} };
vm.runInNewContext(code, { module, exports: module.exports });
const md = module.exports;

test('the reading view and excerpts read the same syntax', () => {
  const kinds = (t) => md.inline(t).map((p) => p.t + ':' + p.s).join(' | ');
  assert.equal(kinds('**a** **b**'), 'b:a | text:  | b:b');
  assert.equal(kinds('\\*x\\*'), 'esc:* | text:x | esc:*');
  assert.equal(kinds('see #tag and @[person:p1|Ann]'), 'text:see  | tag:#tag | text: and  | person:Ann');
  assert.equal(md.stripMarkdown('# **a** and **b**\n- [x] ~~done~~ \\*'), 'a and b\n☑ done *');
  assert.equal(md.stripMarkdown('[](https://) [site](https://x.y)'), ' site');
  assert.equal(md.plainInline('==hi== `x` [[note:1|Note]]'), 'hi x Note');
});

test('excerpts drop fences, dividers, quote and heading markers, and show tasks and bullets as symbols', () => {
  assert.equal(md.stripMarkdown('```js\ncode\n```\n---\n> [!note] Title\n> quoted\n## Head\n- [ ] todo\n* item'), 'code\nTitle\nquoted\nHead\n☐ todo\n• item');
});

test('a card borrows the first line as its heading when there is no title', () => {
  assert.deepEqual({ ...md.previewOf('# First line\nsecond **line**', '') }, { heading: 'First line', preview: 'second line' });
  assert.deepEqual({ ...md.previewOf('words', 'Title') }, { heading: 'Title', preview: 'words' });
});

test('underline, superscript, subscript and colours: read in their strict form only, and dropped from the plain words', () => {
  const kinds = (t) => md.inline(t).map((p) => p.t + (p.color ? '(' + p.color + ')' : '') + ':' + p.s).join(' | ');
  assert.equal(kinds('<u>a</u> x<sup>2</sup><sub>i</sub>'), 'u:a | text: x | sup:2 | sub:i');
  assert.equal(kinds('<span style="color:red">**r**</span> <mark style="background:pink">p</mark> ==y=='), 'color(red):**r** | text:  | hl(pink):p | text:  | hl:y');
  assert.equal(kinds('<span style="color:pink">x</span> <u></u> <mark>m</mark> \\<u>e</u>'), 'text:<span style="color:pink">x</span> <u></u> <mark>m</mark>  | esc:< | text:u>e</u>');
  assert.equal(md.plainInline('<u>a</u> <span style="color:blue">*b*</span> <mark style="background:plum">c</mark> x<sup>2</sup>'), 'a b c x2');
  assert.equal(md.stripMarkdown('# <u>Title</u>\n- [ ] <span style="color:green">go</span>'), 'Title\n☐ go');
  assert.equal(md.dropTags('**<u>a</u>** <span style="color:red">b</span> <mark style="background:pink">c</mark> <sub>d</sub>'), '**a** b c d');
  assert.equal(md.previewOf('<span style="color:red">Heading</span>\nnext <u>line</u>', '').preview, 'next line');
});

test('alignment, page breaks and footnotes: left out of the plain words, the tags dropped from search and exports', () => {
  const PB = '<div style="page-break-after: always"></div>';
  assert.equal(md.stripMarkdown(`# Title <!-- align:center -->\nwords <!-- align:right -->\n${PB}\nmore[^1]\n\n[^1]: the source`), 'Title\nwords\nmore\n\nthe source');
  assert.equal(md.stripMarkdown('a<!-- align:center -->'), 'a<!-- align:center -->', 'not the strict form: as it is');
  assert.equal(md.plainInline('claim[^1] and **b[^x-2]** [^1](u)'), 'claim and b ^1');
  assert.equal(md.inline('a[^1] [[^2]] \\[^3]').map((p) => p.t + ':' + p.s).join(' | '), 'text:a | fn:1 | text:  | wiki:^2 | text:  | esc:[ | text:^3]');
  assert.equal(md.dropTags(`x <!-- align:center -->\n${PB}\ny[^1] <!-- align:right -->\n[^1]: z`), 'x\ny[^1]\n[^1]: z');
  assert.deepEqual({ ...md.previewOf(`Centred <!-- align:center -->\n${PB}\nnext[^1]`, '') }, { heading: 'Centred', preview: 'next' });
});
