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
      export { inline, plainInline } from '${src('inline.ts')}';
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
