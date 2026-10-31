import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNoteDoc, root } from './notedoc-bundle.mjs';

// The note editor's behaviour (src/lib/noteDoc/edit): what Enter, Backspace, Tab, the ribbon, pictures, tags and
// pasting do to the document. Written as the old editor's tests were (scripts/test-markdown.mjs on lib/markdown.ts):
// a note's text with the caret in it (`|`, or a selection from `«` to `»`), a command, and the text after it. Pictures
// are checked against lib/body.ts, which moved them in the old editor. Node only: ProseMirror runs without a DOM here.
const nd = await loadNoteDoc({
  entries: [
    `export * as edit from '${root}src/lib/noteDoc/edit/index.ts';`,
    `export * as body from '${root}src/lib/body.ts';`,
    `export * as pmHistory from '@tiptap/pm/history';`,
    `export * as pmCommands from '@tiptap/pm/commands';`,
  ],
  // lib/mentions.ts and lib/links.ts reach the store (and the browser) through lib/books.ts
  stubs: { '/src/lib/store.ts': 'export const getBooks = () => [];' },
});
const { edit: E, stateFrom, show, body: B } = nd;
const { history, undo, redo } = nd.pmHistory;
const { joinBackward, joinForward, deleteSelection } = nd.pmCommands;

/** Runs `cmd` on the text, the caret where its markers are: [the text after, what the command returned, the state]. */
function run(text, cmd, opts = {}) {
  let s = typeof text === 'string' ? stateFrom(text, opts) : text;
  const ok = cmd(s, (tr) => (s = s.apply(tr)));
  return [show(s, opts), ok, s];
}
const after = (text, cmd, opts) => run(text, cmd, opts)[0];
/** Types each character of `chars` at the caret, the input rules applying. */
const type = (s, chars) => {
  for (const c of chars) s = s.apply(E.typeText(s, c));
  return s;
};
/** A command made of the first that applies, as a keymap runs them (ours first, then ProseMirror's). */
const keys = (...cmds) => (s, d) => cmds.some((c) => c(s, d));
// (with a selection, the keymap's next is ProseMirror's deleteSelection, as in baseKeymap)
const Backspace = keys(E.backspace, deleteSelection, joinBackward);
const Delete = keys(E.deleteForward, deleteSelection, joinForward);
/** The position just before the `n`th (0-based) textblock of the document. */
const blockPos = (s, n) => {
  const out = [];
  s.doc.descendants((node, pos) => (node.isTextblock ? (out.push(pos), false) : true));
  return out[n];
};

/* ---------- Backspace and Delete ---------- */

test('Backspace at the start of a heading, item or quote turns it back into text', () => {
  for (const [from, to] of [['# |Day', '|Day'], ['- [ ] |Milk', '|Milk'], ['- |a', '|a'], ['1. |a', '|a'], ['> |q', '|q'], ['> [!note] |hi', '|hi'], ['x\n## |H', 'x\n|H']]) {
    const [text, ok] = run(from, E.backspace);
    assert.equal(ok, true, from);
    assert.equal(text, to, from);
  }
  // a nested item steps out first
  assert.equal(after('- a\n\t- |b', E.backspace), '- a\n- |b');
  // a callout's body stays a quote; a line in the middle of a quote splits it
  assert.equal(after('> [!note] |hi\n> body', E.backspace), '|hi\n> body');
  assert.equal(after('> a\n> |b\n> c', E.backspace), '> a\n|b\n> c');
  assert.equal(after('> [!note] T\n> |b\n> c', E.backspace), '> [!note] T\n|b\n> c', 'the callout keeps its title, the rest stays quoted');
  // anywhere but a line's start, and at the start of a plain line, it's ProseMirror's own
  assert.equal(run('ab|c', E.backspace)[1], false);
  assert.equal(run('a\n|b', E.backspace)[1], false);
});

test('Backspace and Delete join lines; a list marker goes with the line break', () => {
  assert.equal(after('x\n**|b** y', Backspace), 'x|**b** y', 'before a style at a line’s start, the lines join');
  assert.equal(after('plain|\n- item', Delete), 'plain|item', 'joining a list item on drops its marker');
  // arrowing back to before a list item's text and Backspace: the item becomes text, then the lines join
  let [text, , s] = run('a\n- |item', Backspace);
  assert.equal(text, 'a\n|item');
  assert.equal(after(s, Backspace), 'a|item');
});

test('Backspace and Delete on a selection from a quote into a callout take it out (ProseMirror’s own throws)', () => {
  // (put in shape after, as the editor does)
  const shaped = { plugins: [new nd.pmState.Plugin({ appendTransaction: (trs, _old, state) => nd.normalizeTr(state) })] };
  for (const cmd of [E.backspace, E.deleteForward]) {
    const [text, ok] = run(stateFrom('> a«b\n\n> [!note] T»t\n> body', shaped), cmd);
    assert.equal(ok, true);
    assert.equal(text, '> a|\n\n> [!note] t\n> body', 'the words at both ends go, the lines stay apart');
  }
  assert.equal(after('a«b\nc»d', E.backspace), 'a|d', 'any other selection: as ProseMirror deletes it');
});

test('Backspace on a numbered item counts the rest again', () => {
  assert.equal(after('1. a\n2. |b\n3. c\n4. d', E.backspace), '1. a\n|b\n2. c\n3. d');
});

test('a picture never goes by a stray Backspace or Delete', () => {
  const pic = '[[photo:p1]]';
  // just after it: nothing, unless the line is empty and the picture keeps a line below
  assert.deepEqual(run(`a\n${pic}\n|b`, Backspace).slice(0, 2), [`a\n${pic}\n|b`, true]);
  assert.deepEqual(run(`a\n${pic}\n|\nb`, Backspace).slice(0, 2), [`a\n${pic}\n|b`, true]);
  assert.deepEqual(run(`a\n${pic}\n|`, Backspace).slice(0, 2), [`a\n${pic}\n|`, true], 'the last line stays');
  // just before it
  assert.deepEqual(run(`a|\n${pic}\nb`, Delete).slice(0, 2), [`a|\n${pic}\nb`, true]);
  assert.equal(run(`a|b\n${pic}\nc`, E.deleteForward)[1], false, 'inside the words, Delete is the usual one');
});

/* ---------- Enter ---------- */

test('Enter before a line’s first word opens a plain line above and keeps the line', () => {
  assert.equal(after('# |Title', E.enter), '\n# |Title');
  assert.equal(after('- [ ] |milk', E.enter), '\n- [ ] |milk');
  assert.equal(after('- [x] milk|', E.enter), '- [x] milk\n- [ ] |', 'a new task starts unticked');
  assert.equal(after('# Tit|le', E.enter), '# Tit\n|le', 'the words after the caret go on a plain line');
  assert.equal(after('# Title|', E.enter), '# Title\n|', 'the end of a heading starts a plain line');
  assert.equal(after('plain|', E.enter), 'plain\n|');
});

test('Enter carries a list on, counting the rest again, and an empty item ends it', () => {
  assert.equal(after('1. a|\n2. b', E.enter), '1. a\n2. |\n3. b');
  assert.equal(after('- [x] a|', E.enter), '- [x] a\n- [ ] |');
  assert.equal(after('- a\n- |', E.enter), '- a\n|', 'Enter on an empty item ends the list');
  assert.equal(after('- a\n\t- |', E.enter), '- a\n- |', 'a nested one steps out first');
  assert.equal(after('1. a\n2. |\n3. b', E.enter), '1. a\n|\n2. b');
  assert.equal(after('- a|b', E.enter), '- a\n- |b');
  assert.equal(after('3) x|', E.enter), '3) x\n4) |', 'the number’s style is kept');
  assert.equal(after('\t* x|', E.enter), '\t* x\n\t* |', 'and the bullet and indent');
  assert.equal(after('> quote|', E.enter), '> quote\n> |');
  assert.equal(after('> quote\n> |', E.enter), '> quote\n|', 'an empty line ends the quote');
  assert.equal(after('> [!note] Ti|tle\n> body', E.enter), '> [!note] Ti\n> |tle\n> body', 'a callout’s title goes on into its body');
  assert.equal(after('> [!note] T\n> b\n> |', E.enter), '> [!note] T\n> b\n|', 'an empty line ends a callout too');
});

test('Enter in code: new lines, and out after two empty ones; a fence line opens a code block', () => {
  assert.equal(after('```\na|\n```', E.enter), '```\na\n|\n```');
  assert.equal(after('```\na\n\n|\n```', E.enter), '```\na\n```\n|');
  // a line that's only a fence (typed, so it's text yet): Enter makes it a code block
  let s = stateFrom('|');
  s = s.apply(s.tr.insertText('```js'));
  assert.equal(after(s, E.enter), '```js\n|\n```');
  assert.equal(E.fenceEnter(stateFrom('a|')), false);
  assert.equal(after('```\na|\n```', E.exitCode), '```\na\n```\n|');
  assert.equal(after('```\na|\n```\nb', E.exitCode), '```\na\n```\n|b', 'onto the line after it');
  assert.equal(E.exitCode(stateFrom('```\na|\nb\n```')), false, 'ArrowDown inside the code is the usual one');
});

test('Shift+Enter makes a plain line, never a new item or heading', () => {
  assert.equal(after('- a|b', E.newLine), '- a\n|b');
  assert.equal(after('## a|b', E.newLine), '## a\n|b');
  assert.equal(after('```\na|b\n```', E.newLine), '```\na\n|b\n```');
});

test('undo takes a list carried on back in two steps, as Word does', () => {
  let s = stateFrom('- a|', { plugins: [history()] });
  E.enter(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), '- a\n- |');
  undo(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), '- a\n|', 'undo leaves the line break, without the list carried on');
  undo(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), '- a|');
  redo(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), '- a\n|');
});

/* ---------- Tab and numbering ---------- */

test('Tab moves list items in and out (counting again), and elsewhere never leaves the note', () => {
  assert.deepEqual(run('- a\n- |b', E.tab(false)).slice(0, 2), ['- a\n\t- |b', true]);
  let [text, , s] = run('1. a\n2. |b\n3. c', E.tab(false));
  assert.equal(text, '1. a\n\t1. |b\n2. c');
  assert.equal(after(s, E.tab(true)), '1. a\n2. |b\n3. c');
  assert.deepEqual(run('ab|c', E.tab(false)).slice(0, 2), ['ab\t|c', true]);
  assert.deepEqual(run('# |Head', E.tab(false)).slice(0, 2), ['# |Head', true], 'handled, so the focus stays; no tab before a heading’s words');
  assert.deepEqual(run('pl|ain', E.tab(true)).slice(0, 2), ['pl|ain', true]);
  assert.equal(after('\tpl|ain', E.tab(true)), 'pl|ain');
  assert.equal(after('«a\nb»', E.tab(false)), '\t«a\n\tb»', 'selected lines move together');
  assert.equal(after('- «a\n- b»\n- c', E.tab(false)), '\t- «a\n\t- b»\n- c');
  assert.equal(after('```\nx|\n```', E.tab(false)), '```\nx\t|\n```');
  assert.equal(E.indentList(false)(stateFrom('plain|')), false, 'the ribbon’s indent is for lists only');
});

test('numbered lists count on at each level', () => {
  const renumbered = (text) => {
    const s = stateFrom(text);
    return show(s.apply(E.renumber(s.tr, 0)));
  };
  assert.equal(renumbered('|1. a\n1. b\n\t5. x\n\t1. y\n1. c'), '1. |a\n2. b\n\t1. x\n\t2. y\n3. c');
  assert.equal(renumbered('|3. a\n1. b'), '3. |a\n4. b', 'a list keeps the number it starts from');
  assert.equal(renumbered('|1. a\n- b\n1. c'), '1. |a\n- b\n1. c');
  assert.equal(renumbered('|plain\n1. a'), '|plain\n1. a');
  assert.equal(renumbered('|01. a\n2. b'), '01. |a\n2. b', 'a number already right is left as written');
});

/** A state with the editor's numbering pass (renumberChanged after each change, as src/editor runs it) and history. */
const numbered = (text) =>
  stateFrom(text, { plugins: [history(), new nd.pmState.Plugin({ appendTransaction: (trs, _old, state) => E.renumberChanged(trs, state) })] });

test('numbered lists count again after any change to their lines, whatever made it', () => {
  const counted = (text, cmd) => after(numbered(text), cmd);
  assert.equal(counted('1. a«a\n2. b\n3. c»c\n4. d', Backspace), '1. a|c\n2. d', 'a selection across items deleted');
  assert.equal(counted('1. a\n«2. b\n»3. c', Backspace), '1. a\n2. |c', 'a whole item deleted');
  assert.equal(counted('1. a|\n2. b\n3. c', Delete), '1. a|b\n2. c', 'the next item joined on');
  assert.equal(counted('1. a\n|b\n2. c', Backspace), '1. a|b\n2. c', 'a line joined into an item');
  assert.equal(counted('1. a|\n2. b', E.pasteText('\n1. x\n2. y')), '1. a\n2. x\n3. y\n4. |b', 'a list pasted into one');
  assert.equal(counted('1. «a»\n2. b', E.pasteText('1. x\n2. y')), '1. x\n2. y\n3. |b');
  assert.equal(show(type(numbered('1. a\n2. b\n|'), '1. ')), '1. a\n2. b\n3. |', '"1. " typed under a list counts on');
  assert.equal(counted('3. a\n«4. b\n»5. c', Backspace), '3. a\n4. |c', 'a list keeps the number it starts from');
  assert.equal(counted('«1. a\n»2. b\n3. c', Backspace), '1. |b\n2. c', 'even when its first item goes');
  assert.equal(counted('«5. a\n»6. b', Backspace), '5. |b');
  const moved = (st, d) => {
    // the last item dragged to the top
    const last = st.doc.lastChild, at = st.doc.content.size - last.nodeSize;
    d(st.tr.delete(at, st.doc.content.size).insert(0, last));
    return true;
  };
  assert.equal(nd.serializeNote(run(numbered('1. a\n2. b\n3. c'), moved)[2].doc), '1. c\n2. a\n3. b', 'an item dragged to the top');
  assert.equal(counted('1. a\n\n«1. b\n»1. c', Backspace), '1. a\n\n1. |c', 'a list apart from it is its own');
  assert.equal(counted('1. a\n\t1. x\n«\t2. y\n»\t3. z\n2. b', Backspace), '1. a\n\t1. x\n\t2. |z\n2. b', 'each level counts on');
  // what isn't a change to the list's lines leaves the numbers as they're written
  assert.equal(show(type(numbered('1. a|\n1. b'), 'x')), '1. ax|\n1. b', 'words typed in an item');
  assert.equal(counted('1. «a»\n1. b', E.toggleMarkSmart('bold')), '1. **«a»**\n1. b', 'a style');
  const s = numbered('1. a\n1. b\n- [ ] t|');
  assert.equal(after(s, E.toggleTask(blockPos(s, 2))), '1. a\n1. b\n- [x] t|', 'a task ticked');
});

test('undo and a text put in from outside keep the numbers as they were written', () => {
  const text = '1. a\n1. b\n«1. c\n»1. d';
  let s = numbered(text);
  Backspace(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), '1. a\n2. b\n3. |d');
  undo(s, (tr) => (s = s.apply(tr)));
  assert.equal(nd.serializeNote(s.doc), text.replace(/[«»]/g, ''), 'undo gives back the numbers written');
  redo(s, (tr) => (s = s.apply(tr)));
  assert.equal(nd.serializeNote(s.doc), '1. a\n2. b\n3. d');
  s = numbered('x|');
  s = s.apply(nd.replaceDoc(s.tr, nd.parseNote('1. a\n1. b\n5. c')));
  assert.equal(nd.serializeNote(s.doc), '1. a\n1. b\n5. c');
});

test('a numbered item that stops being numbered: the numbers after it count on from its own, at its level', () => {
  assert.equal(after('1. a\n2. |b\n\t1. x\n3. c', E.backspace), '1. a\n|b\n\t1. x\n2. c', 'a nested list under it keeps its numbers');
  assert.equal(after('1. a\n2. |\n\t1. x\n3. c', E.enter), '1. a\n|\n\t1. x\n2. c');
  assert.equal(after('1. a\n2. |b\n\t1. x\n3. c', E.setStyle('h1')), '1. a\n# |b\n\t1. x\n2. c');
  assert.equal(after('1. a\n2. |b\n3. c', E.toggleList('ol')), '1. a\n|b\n2. c', 'numbering taken off');
  assert.equal(after('1. a\n2. |b\n3. c', E.toggleList('ul')), '1. a\n- |b\n2. c', 'made a bullet');
  assert.equal(after('1. a\n2. |b\n3. c', E.toggleList('task')), '1. a\n- [ ] |b\n2. c', 'made a task');
  assert.equal(after('1. «a\n2. b»\n3. c', E.toggleList('ol')), '«a\nb»\n1. c', 'several: from the first one’s number');
  assert.equal(after('1. a\n2. «b\n3. c»\n4. d', E.toggleList('ul')), '1. a\n- «b\n- c»\n2. d');
  assert.equal(after('1. «a\n2. b»\n3. c', E.setStyle('h1')), '# «a\n# b»\n1. c');
});

test('Enter on a selection that starts in a list item carries the list on', () => {
  assert.equal(after('- a«a\n- b»b', E.enter), '- a\n- |b');
  assert.equal(after('1. a«b\n2. »c\n3. d', E.enter), '1. a\n2. |c\n3. d');
  assert.equal(after('- a«a\nb»b', E.enter), '- a\n- |b', 'into a plain line: it joins the item');
  assert.equal(after('x«x\n- b»b', E.enter), 'x\n|b', 'from a plain line, a plain line');
});

test('Delete at the end of a quote: the line after runs on from it, never into the quote as a line of its own', () => {
  assert.equal(after('> q|\na', Delete), '> q|a');
  assert.equal(after('> [!note] T\n> b|\nx', Delete), '> [!note] T\n> b|x', 'a callout too');
  assert.equal(after('> [!note] T|\nb', Delete), '> [!note] T|b', 'a callout’s title');
  assert.equal(after('> > q|\nb', Delete), '> > q|b');
  assert.equal(after('> q|\n\nb', Delete), '> q|\nb', 'an empty line just goes');
  assert.equal(after('> q|\n- i', Delete), '> q|i', 'an item’s marker goes with the line break');
  assert.equal(after('> q|\n```\nx\n```', Delete), '> q|\n```\nx\n```', 'code stays apart');
  assert.equal(after('> ```\n> x|\n> ```\nb', Delete), '> ```\n> x|\n> ```\nb');
  // and it's the same text as Backspace at the start of the line after
  assert.equal(after('> q\n|a', Backspace), '> q|a');
});

test('Quote on lines some of which are quoted already quotes the rest, without nesting', () => {
  assert.equal(after('«> a\nb»', E.toggleQuote), '> «a\n> b»');
  assert.equal(after('«a\n> b»', E.toggleQuote), '> «a\n> b»');
  assert.equal(after('> «a\n\n> b»', E.toggleQuote), '> «a\n> \n> b»');
  assert.equal(after('«a\n> b\nc»', E.setStyle('quote')), '> «a\n> b\n> c»');
  assert.equal(after('> [!note] «T\n> b\nc»', E.toggleQuote), '> [!note] «T\n> b\n\n> c»', 'a callout stays as it is, apart from the quote');
});

/* ---------- styles and blocks ---------- */

test('formatting at position zero preserves a leading blank line correctly', () => {
  assert.equal(after('|\nSecond line', E.setStyle('h1')), '# |\nSecond line');
});

test('formatting a selection ending at the next line start only affects selected lines', () => {
  assert.equal(after('«First\n»Second', E.toggleList('ul')), '- «First\n»Second');
  assert.equal(after('«First\n»Second', E.tab(false)), '\t«First\n»Second');
  assert.equal(E.toggleTask(100)(stateFrom('Words')), false);
});

test('lists on and off the selected lines', () => {
  assert.equal(after('«a\nb»', E.toggleList('ol')), '1. «a\n2. b»');
  assert.equal(after('- «a\n- b»', E.toggleList('ul')), '«a\nb»', 'off when they all are one');
  assert.equal(after('- «a\n- b»', E.toggleList('task')), '- [ ] «a\n- [ ] b»');
  assert.equal(after('«a\n\nb»', E.toggleList('ul')), '- «a\n\n- b»', 'blank lines between are left be');
  assert.equal(after('1. a\n«b»', E.toggleList('ol')), '1. a\n2. «b»', 'a numbered list counts on');
  assert.equal(after('  in|dented', E.toggleList('ul')), '  - in|dented', 'spaces before the words are the indent');
  assert.equal(after('## He|ad', E.toggleList('ul')), '- He|ad');
});

test('Normal turns headings, quotes and callouts back into plain lines, and leaves lists be', () => {
  assert.deepEqual(run('## Day|', E.setStyle('normal')).slice(0, 2), ['Day|', true]);
  assert.equal(after('«# a\n> b\n- c\n> [!note] d»', E.setStyle('normal')), '«a\nb\n- c\nd»');
  assert.equal(after('x\n> q|uote\ny', E.setStyle('normal')), 'x\nq|uote\ny', 'only the caret’s line');
  assert.equal(run('plain| text', E.setStyle('normal'))[1], false);
  assert.equal(run('- item|', E.setStyle('normal'))[1], false);
});

test('headings and quotes from the style gallery', () => {
  assert.equal(after('Da|y', E.setStyle('h2')), '## Da|y');
  assert.equal(after('# Da|y', E.setStyle('h3')), '### Da|y');
  assert.equal(run('# Da|y', E.setStyle('h1'))[1], false, 'the style it has already leaves it be');
  assert.equal(after('1. a\n2. |b\n3. c', E.setStyle('h1')), '1. a\n# |b\n2. c', 'numbers after a heading made from an item count again');
  assert.equal(after('a|', E.setStyle('quote')), '> a|');
  assert.equal(after('«a\nb»', E.toggleQuote), '> «a\n> b»');
  assert.equal(after('> «a\n> b»', E.toggleQuote), '«a\nb»');
  assert.equal(run('> a|', E.setStyle('quote'))[1], false);
});

test('dividers, code blocks and callouts go in at the caret', () => {
  assert.equal(after('|', E.insertBlock('hr')), '---\n|');
  assert.equal(after('a|', E.insertBlock('hr')), 'a\n---\n|');
  assert.equal(after('a|b', E.insertBlock('hr')), 'a\n---\n|b');
  assert.equal(after('|a', E.insertBlock('hr')), '---\n|a');
  assert.equal(after('a\n|\nb', E.insertBlock('code')), 'a\n```\n|\n```\nb');
  assert.equal(after('a|', E.insertBlock('callout')), 'a\n> [!note] |');
  assert.equal(run('```\nx|\n```', E.insertBlock('hr'))[1], false, 'not in code');
});

test('ticking a task keeps the caret where it was', () => {
  const s = stateFrom('- [ ] one\n- [ ] tw|o');
  assert.equal(after(s, E.toggleTask(blockPos(s, 1))), '- [ ] one\n- [x] tw|o');
  const away = stateFrom('|- [x] done');
  assert.equal(after(away, E.toggleTask(0)), '- [ ] |done');
  assert.equal(after('> - [X] q|', (st, d) => E.toggleTask(blockPos(st, 0))(st, d)), '> - [ ] q|');
  assert.equal(E.toggleTask(0)(stateFrom('- not a task')), false);
});

/* ---------- typing: Markdown at a line's start ---------- */

test('"[] " at the start of a line becomes a task, and other Markdown its block', () => {
  const typed = (text, chars) => show(type(stateFrom(text), chars));
  assert.equal(typed('|', '[] '), '- [ ] |');
  assert.equal(typed('  [x]|', ' '), '  - [x] |');
  assert.equal(typed('a []|', ' '), 'a [] |', 'only at a line’s start');
  assert.equal(typed('- |', '[x] '), '- [x] |', 'in a bullet too');
  assert.equal(typed('|', '## '), '## |');
  assert.equal(typed('|', '- a'), '- a|');
  assert.equal(typed('|', '\t* '), '\t* |');
  assert.equal(typed('|', '3) '), '3) |');
  assert.equal(typed('|', '> x'), '> x|');
  assert.equal(typed('> |', '[!tip] Hey'), '> [!tip] Hey|');
  assert.equal(typed('|', '---'), '---\n|');
  assert.equal(typed('|', '```js '), '```js\n|\n```');
  assert.equal(typed('```\n|\n```', '# '), '```\n# |\n```', 'never in code');
  assert.equal(typed('# |', '- '), '# - |', 'a heading stays a heading');
});

/* ---------- styling words ---------- */

/** The text after a style is toggled (written without the selection, which a style never moves), the result, the state. */
const styled = (text, mark) => {
  const [, ok, s] = run(text, E.toggleMarkSmart(mark));
  return [nd.serializeNote(s.doc), ok, s];
};
const strip = (t) => t.replace(/[«»|]/g, '');

test('styling keeps out of a line’s own marker, however the selection starts', () => {
  assert.equal(styled('«### test»', 'highlight')[0], strip('### ==«test»=='));
  assert.equal(styled('«- item»', 'bold')[0], strip('- **«item»**'));
  assert.equal(styled('«- [ ] item»', 'italic')[0], strip('- [ ] *«item»*'));
  assert.equal(styled('«> [!note] hello there»', 'highlight')[0], strip('> [!note] ==«hello there»=='));
  assert.equal(styled('«1. one»', 'strike')[0], strip('1. ~~«one»~~'));
  // and a second press takes it off again
  assert.equal(styled('### ==«test»==', 'highlight')[0], strip('### «test»'));
});

test('each selected line gets its own markers', () => {
  assert.equal(styled('«# Title\n- item two\nplain»', 'bold')[0], strip('# **«Title**\n- **item two**\n**plain»**'));
  assert.equal(styled('# **«Title**\n- **item two**\n**plain»**', 'bold')[0], strip('# «Title\n- item two\nplain»'));
  assert.equal(styled('«one\n\ntwo»', 'highlight')[0], strip('==«one==\n\n==two»=='));
});

test('a caret in a word styles the word, and not a line’s marker', () => {
  assert.equal(styled('say hel|lo there', 'bold')[0], strip('say **hel|lo** there'));
  assert.equal(styled('say **hel|lo** there', 'bold')[0], strip('say hel|lo there'));
  assert.equal(styled('«  »', 'highlight')[1], false);
  assert.equal(styled('«a » b', 'bold')[0], strip('**«a** » b'), 'spaces stay outside');
});

test('styling fits in with what is there already', () => {
  // part of a styled run comes out of it
  assert.equal(styled('==t«es»t==', 'highlight')[0], strip('==t==«es»==t=='));
  assert.equal(styled('==«te»st==', 'highlight')[0], strip('«te»==st=='));
  assert.equal(styled('==te«st»==', 'highlight')[0], strip('==te==«st»'));
  // a run the selection touches or holds is merged
  assert.equal(styled('«a ==b== c»', 'highlight')[0], strip('==«a b c»=='));
  assert.equal(styled('==a== «b»', 'highlight')[0], strip('==a== ==«b»=='));
  assert.equal(styled('«ab ==cd==» ef', 'highlight')[0], strip('==«ab cd»== ef'));
  assert.equal(styled('ab ==c«d== e»f', 'highlight')[0], strip('ab ==c«d e»==f'));
  // a run the selection covers entirely goes
  assert.equal(styled('x «==bold==» y', 'highlight')[0], strip('x «bold» y'));
});

test('styles nest, so the markers never cross', () => {
  // (the old editor left the space between out, cutting the run where bold ended; marks don't need that)
  assert.equal(styled('**bo«ld** te»xt', 'highlight')[0], '**bo**==**ld** te==xt');
  assert.equal(styled('**«bold»**', 'italic')[0], strip('***«bold»***'));
  assert.equal(styled('***«bold»***', 'italic')[0], strip('**«bold»**'));
  assert.equal(styled('«`x` and y»', 'highlight')[0], strip('==«`x` and y»=='));
  assert.equal(styled('`a«b»c`', 'bold')[1], false, 'never inside code');
  assert.equal(styled('```\n«code»\n```', 'bold')[1], false);
  for (const [text, mark] of [['«### test»', 'highlight'], ['«a **b** c»', 'italic'], ['**bo«ld** te»xt', 'highlight'], ['«# T\n- a ==b== c»', 'bold']]) {
    const [once, , s] = styled(text, mark);
    const [, , s2] = run(s, E.toggleMarkSmart(mark));
    assert.equal(styled(s2, mark)[0], once, 'on, off, on gives the same text: ' + text);
    const plain = (t) => t.replace(/==|\*\*|\*|~~|[«»]/g, '');
    assert.equal(plain(once), plain(text), 'the same words');
  }
});

test('Bold with nothing selected: the word, or what’s typed next', () => {
  assert.equal(styled('say hel|lo', 'bold')[0], strip('say **hel|lo**'));
  const bold = (s) => !!s.schema.marks.bold.isInSet(s.storedMarks ?? s.selection.$from.marks());
  let [text, ok, s] = styled('a | b', 'bold');
  assert.equal(ok, true);
  assert.equal(text, 'a  b');
  assert.equal(bold(s), true, 'typing goes on in bold');
  assert.equal(show(type(s, 'x')), 'a **x|** b');
  assert.equal(bold(run(s, E.toggleMarkSmart('bold'))[2]), false, 'tapped again, it’s off');
  [, , s] = styled('**bold|** x', 'bold');
  assert.equal(show(type(s, 'y')), '**bold**y| x', 'at the end of bold words, typing steps out');
  assert.equal(styled('**|bold**', 'bold')[0], strip('|bold'), 'at their start, it takes the bold off');
  [, , s] = styled('- |item', 'italic');
  assert.equal(show(type(s, 'x')), '- *x|*item');
  assert.equal(styled('```\n|\n```', 'bold')[1], false);
});

test('Code on a selection or word; chips never go in code', () => {
  assert.equal(styled('a «b c» d', 'code')[0], strip('a `«b c»` d'));
  assert.equal(styled('wo|rd', 'code')[0], strip('`wo|rd`'));
  assert.equal(styled('«x @[Ann] y»', 'code')[0], strip('`«x` @[Ann] `y»`'));
});

test('Clear formatting takes the styles off the selection, or off the word at the caret, and leaves links be', () => {
  assert.deepEqual(run('a «**bold** and *it*» b', E.clearFormatting).slice(0, 2), ['a «bold and it» b', true]);
  // a style the selection only touches comes off whole
  assert.equal(after('**bo«ld** x» y', E.clearFormatting), 'bo«ld x» y');
  assert.deepEqual(run('say ==hel|lo== `x`', E.clearFormatting).slice(0, 2), ['say hel|lo `x`', true]);
  assert.equal(after('~~**bo|th**~~', E.clearFormatting), 'bo|th');
  assert.equal(run('plain wo|rd', E.clearFormatting)[1], false);
  const [text, ok] = run('«[site](https://x.y)»', E.clearFormatting);
  assert.equal(ok, false, 'a link stays a link');
  assert.equal(text, '«[site](https://x.y)»');
  assert.equal(after('«[**site**](https://x.y)»', E.clearFormatting), '«[site](https://x.y)»');
  const [, , s] = styled('a |', 'bold');
  assert.equal(run(s, E.clearFormatting)[1], true, 'and off what’s typed next');
});

test('Link with nothing selected links the word, or puts in one with its words', () => {
  const s = stateFrom('see wo|rd');
  assert.deepEqual({ ...E.linkAt(s), from: 0, to: 0 }, { from: 0, to: 0, text: 'word', href: null });
  assert.equal(after(s, E.setLink({ href: 'https://x.y' })), 'see [word](https://x.y)|');
  assert.equal(after('a |', E.setLink({ text: 'site', href: 'x.y' })), 'a [site](https://x.y)|');
  // (written without the caret: show's caret would run into the address)
  assert.equal(nd.serializeNote(run('a |', E.setLink({ href: 'https://x.y' }))[2].doc), 'a https://x.y', 'an address alone is written as it is');
  assert.equal(after('a «**big** news» b', E.setLink({ href: 'mail@x.y' })), 'a [**big** news](mailto:mail@x.y)| b', 'words kept keep their styles');
});

test('a link is edited and taken off whole', () => {
  const s = stateFrom('see [the si|te](https://a.b) now');
  assert.deepEqual(E.linkAt(s), { from: 5, to: 13, text: 'the site', href: 'https://a.b' });
  assert.equal(after(s, E.setLink({ text: 'the site', href: 'https://c.d' })), 'see [the site](https://c.d)| now');
  assert.equal(after(s, E.setLink({ text: 'it', href: 'https://a.b' })), 'see [it](https://a.b)| now');
  assert.equal(after(s, E.removeLink), 'see the si|te now');
  assert.equal(after(s, E.setLink({ href: '' })), 'see the si|te now', 'an empty address takes it off');
  assert.equal(run('plain|', E.removeLink)[1], false);
  assert.equal(E.normalizeHref(' example.com/a b '), 'https://example.com/a%20b');
  assert.equal(E.normalizeHref('mailto:a@b.c'), 'mailto:a@b.c');
});

/* ---------- tags ---------- */

test('an @query or [[query typed before the caret is found, in document positions', () => {
  const typed = (text) => E.typedAt(stateFrom(text, { caret: '‸' }));
  assert.deepEqual(typed('hi @an‸'), { from: 4, to: 7, q: 'an', link: false });
  assert.deepEqual(typed('# @[Bo] and @an‸'), { from: 7, to: 10, q: 'an', link: false }, 'a chip counts as one');
  assert.deepEqual(typed('see [[Du‸'), { from: 5, to: 9, q: 'Du', link: true });
  assert.equal(typed('mail@an‸'), null, 'not inside a word');
  assert.equal(typed('@an. ‸'), null);
  assert.equal(typed('```\n@an‸\n```'), null, 'not in code');
  assert.equal(E.typedAt(stateFrom('«@an»')), null, 'not with a selection');
});

test('picking a tag swaps the query for its chip, with a space after it', () => {
  const pick = (text, atom) => {
    const s = stateFrom(text, { caret: '‸' });
    return run(s, E.replaceTyped(E.typedAt(s), atom), { caret: '‸' });
  };
  assert.equal(pick('hi @an‸', '@[person:p1|Ann]')[0], 'hi @[person:p1|Ann] ‸');
  assert.equal(pick('hi @an‸ there', '@[Ann]')[0], 'hi @[Ann]‸ there', 'a space already there is used');
  // brackets typed closed already (as text: they'd read as a link once written)
  let s = stateFrom('see ‸ x', { caret: '‸' });
  s = s.apply(s.tr.insertText('[[Du]]'));
  s = s.apply(s.tr.setSelection(nd.pmState.TextSelection.create(s.doc, 9)));
  assert.deepEqual(E.typedAt(s), { from: 5, to: 9, q: 'Du', link: true });
  assert.equal(after(s, E.replaceTyped(E.typedAt(s), '[[book:b1|Dune]]'), { caret: '‸' }), 'see [[book:b1|Dune]]‸ x', 'a link in closed brackets takes their place');
  assert.equal(pick('**hi @an‸**', '@[Ann]')[0], '**hi @[Ann] ‸**', 'it takes the styles there');
  assert.equal(E.replaceTyped({ from: 3, to: 5, q: 'x', link: false }, '♪[Song]')(stateFrom('a ♪y')), false, 'not what was typed: nothing picked');
  // the text changed while a person was being made
  s = stateFrom('hi @an‸', { caret: '‸' });
  const t = E.typedAt(s);
  const changed = s.apply(s.tr.insertText('x', 1));
  assert.equal(E.replaceTyped(t, '@[Ann]')(changed), false);
});

test('the arrows go past a tag in one press; Backspace and Delete select it first, the next press takes it out', () => {
  const { NodeSelection } = nd.pmState;
  const C = { caret: '‸' };
  assert.equal(after('hi @[person:p1|Ann]‸ x', E.stepOverChip(-1), C), 'hi ‸@[person:p1|Ann] x');
  assert.equal(after('hi ‸@[person:p1|Ann] x', E.stepOverChip(1), C), 'hi @[person:p1|Ann]‸ x');
  assert.equal(after('[[note:n1|N]]‸♪[Song]', E.stepOverChip(1), C), '[[note:n1|N]]♪[Song]‸', 'from one tag straight past the next');
  assert.equal(run('hi‸ @[Ann]', E.stepOverChip(1), C)[1], false, 'beside a letter: the browser’s own');
  assert.equal(run('a «b» @[Ann]', E.stepOverChip(1))[1], false, 'not with a selection');
  for (const [text, cmd] of [['hi @[person:p1|Ann]‸ x', Backspace], ['hi ‸@[person:p1|Ann] x', Delete]]) {
    let [, ok, s] = run(text, cmd, C);
    assert.equal(ok, true);
    assert.ok(s.selection instanceof NodeSelection && s.selection.node.type.name === 'person', 'the tag selected, nothing gone');
    assert.equal(nd.serializeNote(s.doc), 'hi @[person:p1|Ann] x');
    assert.equal(after(s, cmd, C), 'hi ‸ x', 'the second press takes it out');
  }
  assert.equal(run('Ann‸ @[Bo]', Backspace, C)[1], false, 'after a letter: the browser’s own, as before');
});

test('a tag’s card takes it out (and a space with it) or puts its @ or [[ back for another', () => {
  const chipAt = (s) => {
    let at = -1;
    s.doc.descendants((n, pos) => (E.isChip(n) && at < 0 ? ((at = pos), false) : true));
    return at;
  };
  const C = { caret: '‸' };
  const on = (text, cmd) => {
    const s = stateFrom(text, C);
    return after(s, cmd(chipAt(s)), C);
  };
  assert.equal(on('I met @[person:p1|Ann] today‸', E.removeChip), 'I met ‸today');
  assert.equal(on('with @[person:p1|Ann].‸', E.removeChip), 'with‸.');
  assert.equal(on('with @[person:p1|Ann]‸', E.removeChip), 'with‸');
  assert.equal(on('@[person:p1|Ann] came‸', E.removeChip), '‸came');
  assert.equal(on('(@[person:p1|Ann]) x‸', E.removeChip), '(‸) x');
  assert.equal(on('a @[Ann]@[Bo] b‸', E.removeChip), 'a ‸@[Bo] b', 'a tag beside it stays where it was');
  assert.equal(on('I met @[person:p1|Ann] today‸', E.retypeChip), 'I met @‸ today');
  assert.equal(on('see [[note:n1|Note]]‸', E.retypeChip), 'see [[‸');
  assert.equal(on('**hi @[Ann]**‸', E.retypeChip), '**hi @‸**', 'with the styles it had');
  assert.equal(on('x♪[Song]‸', E.retypeChip), 'x @‸', 'apart from the word before, so the suggestions come');
  const s = stateFrom('I met @[person:p1|Ann] today‸', C);
  assert.deepEqual(E.typedAt(run(s, E.retypeChip(chipAt(s)))[2]), { from: 7, to: 8, q: '', link: false });
  assert.equal(E.removeChip(1)(stateFrom('plain‸', C)), false, 'not a tag: nothing');
});

test('the @ and link buttons type their sign, apart from the word before', () => {
  assert.equal(after('hi|', E.insertTrigger('@')), 'hi @|');
  assert.equal(after('hi |', E.insertTrigger('@')), 'hi @|');
  assert.equal(after('(|', E.insertTrigger('[[')), '([[|');
  assert.equal(after('|', E.insertTrigger('@')), '@|');
  assert.deepEqual(E.typedAt(run('hi|', E.insertTrigger('@'))[2]), { from: 4, to: 5, q: '', link: false });
  assert.equal(after('a «b» c', E.insertAtom('@[Ann]')), 'a @[Ann]| c');
  assert.equal(after('a «b»', E.insertAtom('@[Ann]')), 'a @[Ann] |');
});

test('a full stop typed after a tag takes the place of its space', () => {
  const tidy = (text, ch) => run(text, E.tidyAfterTag(ch), { caret: '‸' });
  assert.deepEqual(tidy('hi @[Ann] ‸', '.').slice(0, 2), ['hi @[Ann].‸', true]);
  assert.deepEqual(tidy('[[note:n|N]] ‸', ')').slice(0, 2), ['[[note:n|N]])‸', true]);
  assert.equal(tidy('hi @[Ann]‸', '.')[1], false);
  assert.equal(tidy('hi Ann ‸', '.')[1], false);
  assert.equal(tidy('hi @[Ann] ‸', 'a')[1], false);
});

/* ---------- what the ribbon shows ---------- */

test('the ribbon lights the styles and the line’s kind', () => {
  const lit = (text) => E.litOf(stateFrom(text));
  let l = lit('**bo|ld** x');
  assert.deepEqual([l.bold, l.italic, l.block, l.style, l.ranged, l.canUndo], [true, false, 'p', 'normal', false, false]);
  l = lit('## «a **b**»');
  assert.deepEqual([l.bold, l.block, l.style, l.ranged], [false, 'h2', 'h2', true]);
  assert.equal(lit('**«a b»**').bold, true);
  l = lit('> - [ ] t|');
  assert.deepEqual([l.block, l.quote, l.callout, l.inList, l.style], ['task', true, false, true, 'quote']);
  l = lit('> [!tip] t|');
  assert.deepEqual([l.quote, l.callout, l.style], [true, true, null]);
  assert.equal(lit('[a|b](https://x.y)').link, true);
  assert.equal(lit('```\nx|\n```').block, 'code');
  assert.equal(E.litOf(styled('a |', 'italic')[2]).italic, true, 'what’s typed next counts');
  let s = stateFrom('a|', { plugins: [history()] });
  s = s.apply(s.tr.insertText('b'));
  assert.equal(E.litOf(s).canUndo, true);
});

/* ---------- pasting plain text ---------- */

test('pasted text is read as Markdown; in code it goes in as it is', () => {
  const paste = (text, clip, ...rest) => after(text, E.pasteText(clip, ...rest));
  assert.equal(paste('a|b', 'x **y**'), 'ax **y|**b');
  assert.equal(paste('a|b', 'x\ny'), 'ax\ny|b');
  assert.equal(paste('|', '- one\n- two'), '- one\n- two|');
  assert.equal(paste('a|', '\n# H\n- i'), 'a\n# H\n- i|');
  assert.equal(paste('```\n|\n```', '# not\n**x**'), '```\n# not\n**x**|\n```');
  assert.equal(paste('a|', 'x\r\ny'), 'a\nx\ny|'.replace('a\nx', 'ax'));
  assert.equal(paste('a|', 'x\n[[photo:p9]]\ny'), 'ax\ny|', 'a picture the note doesn’t know is dropped');
  assert.equal(paste('a|', 'x\n[[photo:p9]]\ny', false, { media: (m) => m }), 'ax\n[[photo:p9]]\ny|');
  assert.equal(paste('a|', '# x', true), 'a# x|', 'plain: as it is');
  assert.equal(paste('a|', '[[photo:p9]]'), 'a|', 'nothing left to paste');
  assert.equal(paste('a|', '\n[[photo:p9]]\nb'), 'ab|');
  assert.equal(paste('a|b', '- one'), 'a\n- one\n|b', 'a line of another kind stays what it is');
  assert.equal(paste('> q|', '- i\n- j'), '> q\n> - i\n> - j|');
  assert.equal(paste('- a|', 'x\ny'), '- ax\ny|');
});

/* ---------- pictures, against lib/body.ts ---------- */

const P = (id, more = '') => `[[photo:${id}${more}]]`;
const ALBUM = '[[album:photo:a1 photo:a2 photo:a3 50 left]]';
/** Notes with pictures in many places, each reading back as itself. */
const NOTES = [
  `a\n${P('p1')}\nb`,
  `\n${P('p1')}\n`,
  `a\nb\n${P('p1')}\nc\n\nd`,
  `a\n\n${P('p1')}\n\nb`,
  `${'\n'}${P('p1')}\n\n${P('p2')}\nend`,
  `x\n${P('p1')}\n\n${P('p2')}\n\n${P('p3', ' 40 right')}\n`,
  `# H\n- i\n${P('p1')}\n> q\n> r\n${ALBUM}\n1. n\n`,
  `a\n\n\n${P('p1')}\n\n\nb\n${P('p2')}\nc`,
  `  \n${P('p1')}\n  x`,
  `\`\`\`\ncode\n\`\`\`\n${P('p1')}\n---\nz`,
  // with a caption and alt text: they stay with the picture, and an album's go with the album (ungrouped, they go)
  `a\n[[photo:p1 50 left|caption=Cap|alt=Alt]]\n\n[[album:photo:p2 photo:p3|caption=Two|alt=Both]]\nb`,
];

const docOf = (t) => nd.parseNote(t);
/** The state for a note with the caret at its start. */
const stateOf = (t) => nd.pmState.EditorState.create({ doc: docOf(t) });
/** The note's text after `cmd`, or null when it didn't apply. */
const textAfter = (t, cmd) => {
  let s = stateOf(t);
  return cmd(s, (tr) => (s = s.apply(tr))) ? nd.serializeNote(s.doc) : null;
};
const bodyText = (t, op) => B.serializeBody(op(B.parseBody(t)));
/** For a top-level place in the document: body.ts's text block and character there (the start of that line). */
function bodyPlace(doc, pos) {
  let seg = 0, chars = 0, first = true;
  let at = null;
  doc.forEach((node, p) => {
    // the start of this line, or (before a picture) the end of the stretch
    if (at || p >= pos) return void (at ??= { seg, pos: first || node.type.name === 'media' ? chars : chars + 1 });
    if (node.type.name === 'media') {
      seg++;
      chars = 0;
      first = true;
      return;
    }
    chars += (first ? 0 : 1) + nd.serializeBlocks([node]).length;
    first = false;
  });
  return at ?? { seg, pos: chars };
}

test('the picture notes read back as themselves', () => {
  for (const t of NOTES) assert.equal(nd.serializeNote(docOf(t)), t, JSON.stringify(t));
});

test('pictures go in where the caret is, as body.ts insertMedia put them', () => {
  const add = [{ kind: 'photo', id: 'new' }];
  const two = [{ kind: 'photo', id: 'n1' }, { kind: 'image', url: 'https://x.y/i.png' }];
  for (const t of NOTES) {
    const doc = docOf(t);
    const texts = B.parseBody(t).texts;
    // every place a caret can be in a top-level line (not code), against body.ts at that character
    let seg = 0, start = 0;
    doc.forEach((node, p) => {
      if (node.type.name === 'media') return void (seg++, (start = 0));
      const line = nd.serializeBlocks([node]);
      if (node.isTextblock && !node.type.spec.code) {
        const lead = line.length - nd.serializeInline(node).length; // the line's marker
        for (let k = 0; k <= node.content.size; k++) {
          if (!node.textBetween(0, node.content.size).match(/^[^*_~=`\\[\]@♪#]*$/)) break; // plain words: one character a position
          for (const media of [add, two]) {
            const want = bodyText(t, (b) => B.insertMedia(b, media, seg, start + lead + k));
            const got = textAfter(t, E.insertMediaAt(media, p + 1 + k));
            // body.ts splits a heading's or item's marker off its first words; here they stay with their line
            if (k === 0 && lead && node.content.size) continue;
            assert.equal(got, want, `${JSON.stringify(t)} line ${JSON.stringify(line)} at ${k}`);
          }
        }
      }
      start += line.length + 1;
    });
    assert.ok(texts.length);
  }
});

test('the caret goes to the line after the pictures put in', () => {
  let s = stateFrom('ab|cd');
  E.insertMediaAt([{ kind: 'photo', id: 'x' }])(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), `ab\n${P('x')}\n|cd`);
  s = stateFrom('|');
  E.insertMediaAt([{ kind: 'photo', id: 'x' }, { kind: 'photo', id: 'y' }])(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), `\n${P('x')}\n\n${P('y')}\n|`);
  s = stateFrom('> q|uote\nafter');
  E.insertMediaAt([{ kind: 'photo', id: 'x' }])(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), `> quote\n${P('x')}\n|after`, 'never inside a quote: after it');
  s = stateFrom('```\nco|de\n```');
  E.insertMediaAt([{ kind: 'photo', id: 'x' }])(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), `\`\`\`\ncode\n\`\`\`\n${P('x')}\n|`, 'nor inside code');
});

test('pictures are taken out, sized, grouped and ungrouped as body.ts does it', () => {
  for (const t of NOTES) {
    const list = E.mediaList(docOf(t));
    list.forEach(({ pos, media }, i) => {
      const where = `${JSON.stringify(t)} picture ${i}`;
      assert.equal(textAfter(t, E.removeMedia(pos)), bodyText(t, (b) => B.removeMedia(b, media)), 'remove: ' + where);
      for (const layout of [{ size: 50, align: 'left' }, { size: 30 }, { size: 100, align: 'right' }, { size: 5, align: 'right' }]) {
        const got = textAfter(t, E.setMediaLayout(pos, layout));
        const want = bodyText(t, (b) => B.setLayout(b, i, layout));
        assert.equal(got ?? t, want, 'layout: ' + where);
      }
      list.forEach((onto, j) => {
        if (i === j) return;
        assert.equal(textAfter(t, E.mergeMedia(pos, onto.pos)), bodyText(t, (b) => B.mergeMedia(b, i, j)), `merge ${i} onto ${j}: ${where}`);
      });
      if (media.kind === 'album') {
        assert.equal(textAfter(t, E.ungroupMedia(pos)), bodyText(t, (b) => B.ungroup(b, i)), 'ungroup: ' + where);
        for (const it of media.items) {
          assert.equal(textAfter(t, E.takeOutItem(pos, it)), bodyText(t, (b) => B.takeOut(b, i, it)), 'take out: ' + where);
          assert.equal(textAfter(t, E.removeItem(pos, it)), bodyText(t, (b) => B.removeItem(b, it)), 'remove item: ' + where);
        }
      } else {
        assert.equal(textAfter(t, E.ungroupMedia(pos)), null);
        assert.equal(textAfter(t, E.removeItem(pos, B.itemsOf(media)[0])), bodyText(t, (b) => B.removeItem(b, B.itemsOf(media)[0])));
      }
    });
  }
});

test('a picture dropped on another goes in at the place it was dropped among its pictures, as body.ts does it', () => {
  for (const t of NOTES) {
    const list = E.mediaList(docOf(t));
    list.forEach(({ pos }, i) => list.forEach((onto, j) => {
      if (i === j) return;
      for (let at = 0; at <= B.itemsOf(onto.media).length; at++) {
        assert.equal(textAfter(t, E.mergeMedia(pos, onto.pos, at)), bodyText(t, (b) => B.mergeMedia(b, i, j, at)), `merge ${i} onto ${j} at ${at}: ${JSON.stringify(t)}`);
      }
    }));
  }
  const [row, one] = E.mediaList(docOf(`a\n${ALBUM}\n\n${P('p1')}\nb`));
  assert.equal(textAfter(`a\n${ALBUM}\n\n${P('p1')}\nb`, E.mergeMedia(one.pos, row.pos, 1)), 'a\n[[album:photo:a1 photo:p1 photo:a2 photo:a3 50 left]]\nb');
});

test('a row’s pictures are put in another order, taken out to any place, moved into another, or replaced', () => {
  const ROWS = [
    `a\n${ALBUM}\nb\n\nc\n${P('p1', ' 40 right')}\nd`,
    `\n${ALBUM}\n\n[[album:photo:b1 image:https://x.y/i.png|caption=Two]]\n`,
    `x\n[[album:photo:a1 photo:a2|caption=Us|alt=Both]]\n- i\n> q`,
  ];
  for (const t of ROWS) {
    const doc = docOf(t);
    const list = E.mediaList(doc);
    list.forEach(({ pos, media }, i) => {
      if (media.kind !== 'album') return;
      for (const it of media.items) {
        const where = `${JSON.stringify(t)} row ${i} ${B.itemKey(it)}`;
        for (let at = 0; at <= media.items.length; at++) {
          assert.equal(textAfter(t, E.reorderItem(pos, it, at)) ?? t, bodyText(t, (b) => B.reorderItem(b, i, it, at)), `reorder to ${at}: ${where}`);
        }
        for (const to of E.dropPlaces(doc)) {
          const { seg, pos: at } = bodyPlace(doc, to);
          for (const layout of [{}, { size: 50, align: 'left' }]) {
            const want = bodyText(t, (b) => B.moveItemOut(b, i, it, seg, at, layout));
            assert.equal(textAfter(t, E.moveItemOut(pos, it, to, layout)), want, `out to ${to} ${JSON.stringify(layout)}: ${where}`);
          }
        }
        list.forEach((onto, j) => {
          if (i === j) return;
          const got = textAfter(t, E.moveItemInto(pos, it, onto.pos, 0));
          const m = B.parseBody(got);
          assert.equal(B.itemKey(B.itemsOf(m.media[j])[0]), B.itemKey(it), `into ${j}: ${where}`);
          assert.equal(m.media[i].kind === 'album' ? m.media[i].items.length : 1, media.items.length - 1, `the row keeps the others: ${where}`);
          assert.equal(nd.serializeNote(docOf(got)), got);
        });
        const next = { kind: 'photo', id: 'new1' };
        assert.equal(textAfter(t, E.replaceItem(pos, it, next)), bodyText(t, (b) => B.replaceItem(b, it, next)), `replace: ${where}`);
      }
    });
  }
  // order: the third first; then the first last
  const t = `a\n${ALBUM}\nb`;
  const [{ pos }] = E.mediaList(docOf(t));
  assert.equal(textAfter(t, E.reorderItem(pos, { kind: 'photo', id: 'a3' }, 0)), 'a\n[[album:photo:a3 photo:a1 photo:a2 50 left]]\nb');
  assert.equal(textAfter(t, E.reorderItem(pos, { kind: 'photo', id: 'a1' }, 3)), 'a\n[[album:photo:a2 photo:a3 photo:a1 50 left]]\nb');
  assert.equal(textAfter(t, E.reorderItem(pos, { kind: 'photo', id: 'a1' }, 1)), null, 'already there');
  // out on its own, to the end: the row keeps two; out of a row of two, the one left stands alone with the row's caption
  assert.equal(textAfter(t, E.moveItemOut(pos, { kind: 'photo', id: 'a2' }, docOf(t).content.size, { size: 30, align: 'right' })),
    'a\n[[album:photo:a1 photo:a3 50 left]]\nb\n[[photo:a2 30 right]]\n');
  const two = `x\n[[album:photo:a1 photo:a2|caption=Us|alt=Both]]\ny`;
  assert.equal(textAfter(two, E.moveItemOut(E.mediaList(docOf(two))[0].pos, { kind: 'photo', id: 'a1' }, 0)), '\n[[photo:a1]]\nx\n[[photo:a2|caption=Us|alt=Both]]\ny');
  // a picture already in the note can't replace another (it would be there twice)
  assert.equal(textAfter(t, E.replaceItem(pos, { kind: 'photo', id: 'a1' }, { kind: 'photo', id: 'a2' })), null);
  assert.equal(textAfter(`a\n${P('p1', ' 40 right|caption=C')}\nb`, E.replaceItem(3, { kind: 'photo', id: 'p1' }, { kind: 'photo', id: 'q' })),
    `a\n${P('q', ' 40 right|caption=C')}\nb`, 'a picture on its own keeps its layout and caption');
  // a row's pictures stand at one height, each as wide as its shape; one whose shape isn't known is a square
  const shapes = { photos: [{ id: 'a1', w: 300, h: 200 }, { id: 'a2', w: 200, h: 400 }], images: [{ url: 'https://x.y/i.png' }] };
  assert.deepEqual(B.rowRatios([{ kind: 'photo', id: 'a1' }, { kind: 'photo', id: 'a2' }, { kind: 'image', url: 'https://x.y/i.png' }, { kind: 'photo', id: 'gone' }], shapes), [1.5, 0.5, 1, 1]);
  // an old album's line reads, and writes back, as it was: a row now, the same line
  const old = 'a\n[[album:photo:a1 photo:a2 image:https://x.y/i.png 60 right|caption=Our trip|alt=Three]]\nb';
  assert.equal(nd.serializeNote(docOf(old)), old);
  assert.deepEqual(B.parseBody(old).media[0], { kind: 'album', items: [{ kind: 'photo', id: 'a1' }, { kind: 'photo', id: 'a2' }, { kind: 'image', url: 'https://x.y/i.png' }], size: 60, align: 'right', caption: 'Our trip', alt: 'Three' });
});

test('pictures move a step, and are dragged to any place, as body.ts does it', () => {
  for (const t of NOTES) {
    const doc = docOf(t);
    const s = stateOf(t);
    E.mediaList(doc).forEach(({ pos }, i) => {
      for (const dir of [-1, 1]) {
        const where = `${JSON.stringify(t)} picture ${i} step ${dir}`;
        assert.equal(E.canStep(s, pos, dir), B.canStep(B.parseBody(t), i, dir), where);
        const want = bodyText(t, (b) => B.stepMedia(b, i, dir));
        assert.equal(textAfter(t, E.stepMedia(pos, dir)) ?? t, want, where);
      }
      for (const to of E.dropPlaces(doc)) {
        const { seg, pos: at } = bodyPlace(doc, to);
        const where = `${JSON.stringify(t)} picture ${i} to ${to} (text ${seg} at ${at})`;
        const want = bodyText(t, (b) => B.moveMedia(b, i, seg, at));
        assert.equal(textAfter(t, E.moveMedia(pos, to)) ?? t, want, where);
        // with a layout, as a drop on a side gives it
        const sized = bodyText(t, (b) => {
          const moved = B.moveMedia(b, i, seg, at);
          const k = moved.media.findIndex((m) => B.mediaKey(m) === B.mediaKey(b.media[i]));
          return B.setLayout(moved, k, { size: 50, align: 'left' });
        });
        assert.equal(textAfter(t, E.moveMedia(pos, to, { size: 50, align: 'left' })) ?? t, sized, 'sized: ' + where);
      }
    });
  }
});

test('drop places are the top of each top-level block and the end; targets measure them', () => {
  const doc = docOf(`a\n${P('p1')}\n> q\n> r`);
  assert.deepEqual(E.dropPlaces(doc), [0, 3, 4, 12]);
  const rects = new Map([[0, 10], [3, 40], [4, 200]]);
  const view = { state: { doc }, nodeDOM: (pos) => ({ getBoundingClientRect: () => ({ top: rects.get(pos), bottom: rects.get(pos) + 30 }) }) };
  assert.deepEqual(E.dropTargets(view, 100), [{ pos: 0, y: 110 }, { pos: 3, y: 140 }, { pos: 4, y: 300 }, { pos: 12, y: 330 }]);
  assert.equal(E.findMedia(doc, 'photo:p1'), 3);
  assert.equal(E.findMedia(doc, 'photo:zz'), -1);
});

/* ---------- every command, everywhere ---------- */

test('every command at every caret leaves a document that writes text reading back as itself', () => {
  const NOTES2 = [
    'plain **bold** and *it* `code`\n\n# Head\n- a\n\t- b\n1. one\n2. two\n- [ ] task @[Ann] done',
    '> quote **q**\n> - item\n\n> [!note] Title\n> body\n> > inner',
    `a\n${P('p1')}\n\n${P('p2')}\nb\n\`\`\`js\nx\n\n\`\`\`\n---\nend [link](https://x.y) ==hl==`,
    '',
    '#tag and [[note:n1|N]] and ♪[Song] \\* esc',
    'centred **b** <!-- align:center -->\n## Head[^1] <!-- align:right -->\n<div style="page-break-after: always"></div>\nafter[^2]\n\n[^1]: one\n[^2]: two',
    'x | y\n| a | **b** |\n| --- | :---: |\n| c |  |\ny',
    'I said <span class="comment">**yes** and @[Ann]</span><!-- comment: did I %2D- mean it? --> then\n- <span class="comment">item</span><!-- comment: x %7C y -->\n| <span class="comment">a</span><!-- comment: c --> |\n| --- |',
  ];
  const CMDS = {
    enter: E.enter, newLine: E.newLine, backspace: Backspace, delete: Delete, tab: E.tab(false), untab: E.tab(true),
    exitCode: E.exitCode, normal: E.setStyle('normal'), h1: E.setStyle('h2'), quote: E.toggleQuote, ul: E.toggleList('ul'),
    ol: E.toggleList('ol'), task: E.toggleList('task'), hr: E.insertBlock('hr'), code: E.insertBlock('code'),
    callout: E.insertBlock('callout'), bold: E.toggleMarkSmart('bold'), codeMark: E.toggleMarkSmart('code'),
    clear: E.clearFormatting, link: E.setLink({ href: 'https://a.b' }), unlink: E.removeLink, at: E.insertTrigger('@'),
    chip: E.insertAtom('@[Bo]'), pic: E.insertMediaAt([{ kind: 'photo', id: 'z' }]), paste: E.pasteText('x\n- y\n**z**'),
    centre: E.setAlign('center'), justify: E.setAlign('justify', true), pagebreak: E.insertBlock('pagebreak'), footnote: E.insertFootnote,
    comment: E.addComment('why -- [x] | *y* ~~z~~ 100%'), uncomment: E.deleteComment(), nextComment: E.stepComment(1),
  };
  const { TextSelection } = nd.pmState;
  let runs = 0;
  const lossy = [];
  for (const t of NOTES2) {
    const start = stateOf(t);
    const places = [];
    start.doc.descendants((node, pos) => {
      if (node.isTextblock) for (let k = 0; k <= node.content.size; k++) places.push(pos + 1 + k);
      return !node.isTextblock;
    });
    // carets, and a few selections across lines
    const sels = [...places.map((p) => [p, p]), ...places.filter((_, i) => i % 7 === 0).map((p, i, a) => [p, a[Math.min(a.length - 1, i + 2)]])];
    for (const [a, h] of sels) {
      const s = start.apply(start.tr.setSelection(TextSelection.create(start.doc, a, h)));
      for (const [name, cmd] of Object.entries(CMDS)) {
        let next = s;
        const where = `${name} on ${JSON.stringify(t)} at ${a}-${h}`;
        try {
          cmd(s, (tr) => (next = next.apply(tr)));
          next.doc.check();
        } catch (e) {
          assert.fail(`${where}: ${e.message}`);
        }
        // the text written keeps every character and writes the same again; styles can only be lost where the
        // dialect can't say them (bold running straight into italic), which LOSSY lists
        const norm = nd.normalizeDoc(next.doc);
        const text = nd.serializeNote(norm);
        const back = nd.parseNote(text);
        assert.equal(back.textContent, norm.textContent, `${where}: characters → ${JSON.stringify(text)}`);
        assert.equal(nd.serializeNote(back), text, `${where}: written again → ${JSON.stringify(text)}`);
        if (!nd.sameDoc(back, norm)) lossy.push(`${where} → ${JSON.stringify(text)}`);
        runs++;
      }
    }
  }
  assert.ok(runs > 1000);
  if (process.env.LOSSY) console.log(lossy.join('\n'));
  assert.ok(lossy.length < runs / 50, `${lossy.length} of ${runs} lost a style:\n${lossy.slice(0, 5).join('\n')}`);
});

test('next to code, Backspace and Delete never run lines into it (or a code block into the line above)', () => {
  // a line after a code block: the caret goes into the code, the words stay where they are
  assert.equal(after('```\nx\n```\n|**b** *i*', Backspace), '```\nx|\n```\n**b** *i*');
  // an empty line after it goes
  assert.equal(after('```\nx\n```\n|\nnext', Backspace), '```\nx|\n```\nnext');
  // at the start of a code block, its lines stay its own
  assert.equal(after('a\n```\n|x\ny\n```', Backspace), 'a|\n```\nx\ny\n```');
  // Delete at the end of the line above a code block, or of the code: nothing runs together
  assert.equal(after('a|\n```\nx\n```', Delete), 'a|\n```\nx\n```');
  assert.equal(after('```\nx|\n```\nb', Delete), '```\nx|\n```\nb');
  assert.equal(after('|\n```\nx\n```', Delete), '```\n|x\n```', 'an empty line before code goes');
});

test('a line just out of a quote joins its last line on a second Backspace, not back in as its own', () => {
  let [text, , s] = run('> a\n> |b\n> c', Backspace);
  assert.equal(text, '> a\n|b\n> c');
  assert.equal(after(s, Backspace), '> a|b\n> c');
  assert.equal(after('> a\n|', Backspace), '> a|', 'an empty line after a quote goes');
});

test('ArrowDown leaves code without making a line when there are words after it to go to', () => {
  assert.equal(E.exitCode(stateFrom('> ```\n> a|\n> ```\n\nb')), false);
});

test('a line opens above code or a callout that starts the note', () => {
  assert.equal(after('```\n|x\n```', E.enter), '\n```\n|x\n```');
  assert.equal(after('> [!note] |T\n> b', E.enter), '\n> [!note] |T\n> b');
  assert.equal(after('a\n```\n|x\n```', E.enter), 'a\n```\n\n|x\n```', 'with a line above, Enter is a new line of code');
});

test('the ribbon lights a style exactly when its button would take it off', () => {
  const lit = (text) => E.litOf(stateFrom(text));
  assert.equal(lit('«**bold** »x').bold, true, 'a space selected at the end doesn’t count');
  assert.equal(lit('x |**bold**').bold, true, 'at the start of a bold word');
  assert.equal(lit('x| **bold**').bold, false);
  assert.equal(lit('**bo|ld**').bold, true);
});

/* ---------- Word's AutoCorrect, moving lines, numbering ---------- */

test('AutoCorrect: curly quotes, dashes, an ellipsis, symbols and arrows as they are typed', () => {
  const typed = (text, chars) => show(type(stateFrom(text), chars));
  assert.equal(typed('|', '"Hi," she said. \'Yes\''), '“Hi,” she said. ‘Yes’|');
  assert.equal(typed('|', 'don\'t (or "won\'t")'), 'don’t (or “won’t”)|', 'an apostrophe in a word closes');
  assert.equal(typed('|', 'wait -- what'), 'wait — what|');
  assert.equal(typed('|', 'well--known'), 'well—known|', 'between words');
  assert.equal(typed('|', 'a --'), 'a --|', 'not before it’s followed by something');
  assert.equal(typed('|', 'and so...'), 'and so…|');
  assert.equal(typed('|', '(c) (R) (tm)'), '© ® ™|');
  assert.equal(typed('|', 'a -> b <- c'), 'a → b ← c|');
  // the Markdown rules still work
  assert.equal(typed('|', '---'), '---\n|', 'a divider');
  assert.equal(typed('|', '- a'), '- a|', 'a bullet');
  assert.equal(typed('|', '-- a'), '— a|');
  // never in code, a code span being typed, or an address
  assert.equal(typed('```\n|\n```', '"a" -- b...'), '```\n"a" -- b...|\n```');
  assert.equal(typed('|', '`a -> "b"'), '`a -> "b"|');
  assert.equal(typed('`co|de`', '"'), '`co"|de`');
  assert.equal(type(stateFrom('|'), 'see https://x.com/a--b...').doc.textContent, 'see https://x.com/a--b...');
});

test('Alt+Shift+Up and Down move the line (or the selected lines) past the block beside it, the caret staying in it', () => {
  assert.equal(after('a\nb|\nc', E.moveBlocks(-1)), 'b|\na\nc');
  assert.equal(after('a\nb|\nc', E.moveBlocks(1)), 'a\nc\nb|');
  assert.equal(after('«a\nb»\nc', E.moveBlocks(1)), 'c\n«a\nb»');
  assert.equal(run('a|\nb', E.moveBlocks(-1))[1], false, 'nothing above the first line');
  // numbered items count again where they land (the editor's renumberChanged, after each change)
  const s0 = stateFrom('1. a\n2. b|');
  let moved;
  E.moveBlocks(-1)(s0, (t) => (moved = t));
  const s1 = s0.apply(moved);
  const fix = E.renumberChanged([moved], s1);
  assert.equal(show(fix ? s1.apply(fix) : s1), '1. b|\n2. a');
  // a line that's all of its quote takes the quote along; one of several moves inside it
  assert.equal(after('a\n> q|', E.moveBlocks(-1)), '> q|\na');
  assert.equal(after('> x\n> q|', E.moveBlocks(-1)), '> q|\n> x');
  // moving is one step to undo
  let s = stateFrom('a\nb|\nc', { plugins: [history()] });
  s = s.apply(s.tr.insertText('!'));
  E.moveBlocks(-1)(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), 'b!|\na\nc');
  undo(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), 'a\nb!|\nc');
});

test('Restart and Continue numbering, kept apart in the text as CommonMark reads it', () => {
  assert.equal(after('1. a\n2. b|\n3. c', E.restartNumbering), '1. a\n1) b|\n2) c');
  assert.equal(run('1. a|\n2. b', E.restartNumbering)[1], false, 'the first item starts at 1 already');
  assert.equal(after('1. a\n1) b|\n2) c', E.continueNumbering), '1. a\n2. b|\n3. c');
  // across plain lines: the list after counts on from the one before
  assert.equal(after('1. a\n2. b\n\nnote\n1. c|\n2. d', E.continueNumbering), '1. a\n2. b\n\nnote\n3. c|\n4. d');
  assert.equal(after('1. a\n\n3. c|', E.restartNumbering), '1. a\n\n1. c|');
  assert.equal(run('- a|', E.restartNumbering)[1], false, 'not on a bullet');
  // a restarted list stays apart after more changes to its lines
  let s = run('1. a\n2. b|\n3. c', E.restartNumbering)[2];
  s = s.apply(E.typeText(s, 'x'));
  assert.equal(after(s, E.enter), '1. a\n1) bx\n2) |\n3) c');
  // the ribbon knows which applies
  assert.deepEqual([E.litOf(stateFrom('1. a\n2. b|')).canRestart, E.litOf(stateFrom('1. a\n2. b|')).canContinue], [true, false]);
});

test('numbered items a level in show a., then i., then numbers again (the text keeps its digits)', () => {
  const look = (indent, num) => nd.listItemLook({ kind: 'ol', indent, num })['data-marker'];
  assert.deepEqual([look('', '3'), look('\t', '3'), look('\t\t', '4'), look('\t\t\t', '2'), look('\t', '28')], ['3.', 'c.', 'iv.', '2.', 'ab.']);
});

test('the style gallery lights Heading 4 to 6 as well', () => {
  assert.equal(E.litOf(stateFrom('#### |h')).style, 'h4');
  assert.equal(E.litOf(stateFrom('###### |h')).style, 'h6');
});

/* ---------- Word wave 2: underline, superscript, subscript, colours, the Format Painter ---------- */

test('Underline, Superscript and Subscript go on and off like the other styles; superscript and subscript never together', () => {
  assert.equal(styled('a «b c» d', 'underline')[0], 'a <u>b c</u> d');
  assert.equal(styled('<u>wo|rd</u>', 'underline')[0], 'word', 'off the word at the caret');
  assert.equal(styled('x«2»', 'sup')[0], 'x<sup>2</sup>');
  assert.equal(styled('H«2»O', 'sub')[0], 'H<sub>2</sub>O');
  assert.equal(styled('x<sub>«2»</sub>', 'sup')[0], 'x<sup>2</sup>', 'superscript takes subscript’s place');
  assert.equal(styled('x<sup>«2»</sup>', 'sub')[0], 'x<sub>2</sub>');
  assert.equal(styled('«a **b» c**', 'underline')[0], '<u>a </u>**<u>b</u> c**');
  assert.equal(styled('```\n|\n```', 'underline')[1], false, 'never in code');
  const lit = (text) => E.litOf(stateFrom(text));
  assert.deepEqual([lit('<u>wo|rd</u>').underline, lit('<sup>«x»</sup>').sup, lit('<sup>«x»</sup>').sub, lit('<sub>wo|rd</sub>').sub], [true, true, false, true]);
});

test('Font colour and highlight colours: put on, changed, taken off; Highlight’s own button toggles its colour', () => {
  const color = (text, c) => nd.serializeNote(run(text, E.noteCommands.color(c))[2].doc);
  const hl = (text, c) => nd.serializeNote(run(text, E.noteCommands.highlight(c))[2].doc);
  assert.equal(color('a «b c» d', 'red'), 'a <span style="color:red">b c</span> d');
  assert.equal(color('<span style="color:red">«b»</span>', 'blue'), '<span style="color:blue">b</span>', 'another colour takes its place');
  assert.equal(color('<span style="color:red">wo|rd</span>', null), 'word', 'Automatic takes it off');
  assert.equal(color('«**a** b»', 'green'), '<span style="color:green">**a** b</span>');
  assert.equal(hl('«a»', 'pink'), '<mark style="background:pink">a</mark>');
  assert.equal(hl('«a»', null), '==a==', 'null: the yellow one');
  assert.equal(hl('<mark style="background:pink">«a»</mark>', null), '==a==');
  assert.equal(hl('==«a»==', false), 'a', 'No colour');
  // the split button's own half: on in its colour, off on words with that colour, another colour replaced
  const toggle = (text, c) => nd.serializeNote(run(text, E.noteCommands.mark('highlight', c))[2].doc);
  assert.equal(toggle('«a»', 'plum'), '<mark style="background:plum">a</mark>');
  assert.equal(toggle('<mark style="background:plum">«a»</mark>', 'plum'), 'a');
  assert.equal(toggle('==«a»==', 'plum'), '<mark style="background:plum">a</mark>');
  assert.equal(toggle('==«a»==', null), 'a');
  // with nothing selected away from a word: what's typed next
  let s = run('a |', E.noteCommands.color('purple'))[2];
  s = type(s, 'xy');
  assert.equal(nd.serializeNote(s.doc), 'a <span style="color:purple">xy</span>');
  // what the ribbon shows
  const lit = (text) => E.litOf(stateFrom(text));
  assert.equal(lit('<span style="color:red">wo|rd</span>').color, 'red');
  assert.equal(lit('«<span style="color:red">a</span> b»').color, null, 'a mix shows none');
  assert.equal(lit('==wo|rd==').highlightColor, 'yellow');
  assert.equal(lit('<mark style="background:lightblue">«w»</mark>').highlightColor, 'lightblue');
  assert.equal(lit('<mark style="background:lightblue">«w»</mark>').highlight, true);
});

test('Clear formatting takes underline, superscript, subscript and colours off too', () => {
  assert.equal(after('«<u>a</u> <sup>b</sup> <sub>c</sub> <span style="color:red">d</span> <mark style="background:pink">e</mark>»', E.clearFormatting), '«a b c d e»');
  assert.equal(after('[<u>si|te</u>](https://x.y)', E.clearFormatting), '[si|te](https://x.y)', 'a link stays');
});

test('the Format Painter copies the styles at the caret and paints the next selection with exactly those', () => {
  const { painterPlugin, togglePainter, stopPainter, paint, painterOf } = E;
  const withPainter = (text) => stateFrom(text, { plugins: [painterPlugin()] });
  const apply = (s, cmd) => {
    let out = s;
    const ok = cmd(s, (tr) => (out = s.apply(tr)));
    return [out, ok];
  };
  const select = (s, from, to) => s.apply(s.tr.setSelection(nd.pmState.TextSelection.create(s.doc, from, to)));
  // copied from a bold, red word; painted on words that were italic and highlighted: they're bold and red only
  let [s] = apply(withPainter('<span style="color:red">**so|urce**</span> *one* ==two== three'), togglePainter(false));
  assert.equal(painterOf(s).sticky, false);
  assert.equal(E.litOf(s).painter, 'once');
  const text = s.doc.textContent;
  s = select(s, 1 + text.indexOf('one'), 1 + text.indexOf('two') + 3);
  [s] = apply(s, paint);
  assert.equal(nd.serializeNote(s.doc), '<span style="color:red">**source**</span> <span style="color:red">**one two**</span> three');
  assert.equal(painterOf(s), null, 'once: it’s off after painting');
  assert.equal(apply(s, paint)[1], false);
  // double-clicked it stays on until Esc; plain words copied take the styles off
  [s] = apply(withPainter('pl|ain **a** *b*'), togglePainter(true));
  const t2 = s.doc.textContent;
  s = select(s, 2 + t2.indexOf(' a'), 3 + t2.indexOf(' a'));
  [s] = apply(s, paint);
  s = select(s, 1 + t2.indexOf('b'), 2 + t2.indexOf('b'));
  [s] = apply(s, paint);
  assert.equal(nd.serializeNote(s.doc), 'plain a b');
  assert.equal(painterOf(s).sticky, true);
  [s] = apply(s, stopPainter);
  assert.equal(painterOf(s), null);
  assert.equal(apply(s, stopPainter)[1], false, 'Esc does nothing more when it’s off');
  // a second click on the button puts it away; a link is kept, and a word at the caret is painted whole
  [s] = apply(withPainter('<u>x|y</u> [link](https://a.b) word'), togglePainter(false));
  assert.equal(painterOf(apply(s, togglePainter(false))[0]), null);
  const t3 = s.doc.textContent;
  s = select(s, 1 + t3.indexOf('link'), 1 + t3.indexOf('link') + 4);
  [s] = apply(s, paint);
  assert.equal(nd.serializeNote(s.doc), '<u>xy</u> [<u>link</u>](https://a.b) word');
  [s] = apply(s, togglePainter(false));
  s = select(s, 3 + t3.indexOf('word'), 3 + t3.indexOf('word'));
  [s] = apply(s, paint);
  assert.equal(nd.serializeNote(s.doc), '<u>xy</u> [<u>link</u>](https://a.b) <u>word</u>');
  // copying from a selection takes its first letter's styles
  assert.deepEqual(E.copyMarks(stateFrom('« *a* b»')).map((m) => m.type.name), ['italic']);
  // without the plugin (in a test state) the button does nothing
  assert.equal(togglePainter(false)(stateFrom('a|'), () => {}), false);
});

test('AutoCorrect leaves a tag being typed alone', () => {
  const typed = (text, chars) => show(type(stateFrom(text), chars));
  assert.equal(typed('|', '<span style="color:red">'), '<span style="color:red">|');
  assert.equal(typed('|', '<a title="x">'), '<a title="x">|');
  assert.equal(typed('|', 'a "b"'), 'a “b”|', 'and goes on after it');
});

/* ---------- alignment, page breaks, footnotes ---------- */

test('Align left, centre, right and justify, on paragraphs and headings; the keys toggle back to the left', () => {
  assert.equal(after('wo|rd', E.setAlign('center')), 'wo|rd <!-- align:center -->');
  assert.equal(after('wo|rd <!-- align:center -->', E.setAlign('right')), 'wo|rd <!-- align:right -->');
  assert.equal(after('wo|rd <!-- align:center -->', E.setAlign('left')), 'wo|rd');
  assert.equal(after('wo|rd <!-- align:center -->', E.setAlign('center', true)), 'wo|rd', 'Ctrl+E again: back to the left');
  assert.equal(after('wo|rd <!-- align:center -->', E.setAlign('center')), 'wo|rd <!-- align:center -->', 'the button leaves it centred');
  assert.equal(after('# He|ad', E.setAlign('justify')), '# He|ad <!-- align:justify -->');
  assert.equal(after('«a\n- b\n# c»', E.setAlign('right')), '«a <!-- align:right -->\n- b\n# c» <!-- align:right -->', 'a list item stays as it is');
  assert.equal(run('- it|em', E.setAlign('center'))[1], false, 'a list can\'t be aligned');
  assert.equal(run('```\nco|de\n```', E.setAlign('center'))[1], false);
  // what the ribbon lights
  const lit = (text) => E.litOf(stateFrom(text));
  assert.deepEqual([lit('a|').align, lit('a|').canAlign], ['left', true]);
  assert.equal(lit('a| <!-- align:center -->').align, 'center');
  assert.equal(lit('«a <!-- align:center -->\nb»').align, null, 'lines aligned differently: none lit');
  assert.deepEqual([lit('- a|').align, lit('- a|').canAlign], [null, false]);
});

test('alignment goes on with Enter, and stays when a line becomes a heading or a heading a line', () => {
  assert.equal(after('ab| <!-- align:center -->', E.enter), 'ab <!-- align:center -->\n| <!-- align:center -->');
  assert.equal(after('a|b <!-- align:right -->', E.enter), 'a <!-- align:right -->\n|b <!-- align:right -->');
  assert.equal(after('# H|ead <!-- align:center -->', E.enter), '# H <!-- align:center -->\n|ead <!-- align:center -->');
  assert.equal(after('# |Head <!-- align:center -->', E.backspace), '|Head <!-- align:center -->');
  assert.equal(after('Da|y <!-- align:center -->', E.setStyle('h2')), '## Da|y <!-- align:center -->');
  assert.equal(after('## Da|y <!-- align:center -->', E.setStyle('normal')), 'Da|y <!-- align:center -->');
  assert.equal(show(type(stateFrom('|x <!-- align:right -->'), '# ')), '# |x <!-- align:right -->', 'typing # at the start');
  // an empty centred line is written without the space before its comment
  const [, , s] = run('ab| <!-- align:center -->', E.enter);
  assert.equal(nd.serializeNote(s.doc), 'ab <!-- align:center -->\n<!-- align:center -->');
});

test('a page break goes in at the caret (Ctrl+Enter), the caret on the line after it', () => {
  const PB = '<div style="page-break-after: always"></div>';
  assert.equal(after('|', E.insertBlock('pagebreak')), `${PB}\n|`);
  assert.equal(after('a|', E.insertBlock('pagebreak')), `a\n${PB}\n|`);
  assert.equal(after('a|b', E.insertBlock('pagebreak')), `a\n${PB}\n|b`);
  assert.equal(after('|a', E.insertBlock('pagebreak')), `${PB}\n|a`);
  assert.equal(after('a|b <!-- align:center -->', E.insertBlock('pagebreak')), `a <!-- align:center -->\n${PB}\n|b <!-- align:center -->`);
  assert.equal(run('```\nx|\n```', E.insertBlock('pagebreak'))[1], false, 'not in code');
  // Backspace on the line after it takes it out, as a divider
  assert.equal(after(`a\n${PB}\n|b`, Backspace), 'a\n|b');
});

test('Insert › Footnote: a reference at the caret, its text at the end of the note with the caret in it', () => {
  assert.equal(after('a claim| here', E.insertFootnote), 'a claim[^1] here\n\n[^1]: |');
  assert.equal(after('one[^1]| two\n\n[^1]: first', E.insertFootnote), 'one[^1][^2] two\n\n[^1]: first\n[^2]: |');
  assert.equal(after('x|\n', E.insertFootnote), 'x[^1]\n\n[^1]: |', 'an empty last line is the blank line before it');
  assert.equal(after('x|\n\n', E.insertFootnote), 'x[^1]\n\n[^1]: |');
  assert.equal(after('a «word» b', E.insertFootnote), 'a [^1] b\n\n[^1]: |', 'the selection is typed over');
  assert.equal(after('**bo|ld**', E.insertFootnote), '**bo[^1]ld**\n\n[^1]: |', 'it takes the words\' styles');
  assert.equal(after('a[^note] b[^7]|\n\n[^note]: n\n[^7]: s', E.insertFootnote), 'a[^note] b[^7][^8]\n\n[^note]: n\n[^7]: s\n[^8]: |', 'one past the highest number');
  assert.equal(after('- item|', E.insertFootnote), '- item[^1]\n\n[^1]: |');
  assert.equal(run('```\nx|\n```', E.insertFootnote)[1], false, 'not in code');
  assert.equal(run('`co|de`', E.insertFootnote)[1], false, 'nor in a code span');
  assert.equal(run('x[^1]\n\n[^1]: t|', E.insertFootnote)[1], false, 'nor in a footnote');
  // one step to undo
  let s = stateFrom('a|', { plugins: [history()] });
  s = s.apply((() => { let t; E.insertFootnote(s, (x) => (t = x)); return t; })());
  assert.equal(nd.serializeNote(s.doc), 'a[^1]\n\n[^1]: ');
  undo(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), 'a|');
});

test('footnotes are numbered by where they\'re first referred to; a click goes from one to the other', () => {
  const s = stateFrom('b[^b] a[^a] b again[^b] c[^c]|\n\n[^a]: A\n[^b]: B\n[^z]: nobody');
  const f = E.footnotesOf(s.doc);
  assert.deepEqual([...f.num], [['b', 1], ['a', 2], ['c', 3]]);
  assert.deepEqual(f.defs.map((d) => d.label), ['a', 'b', 'z']);
  assert.equal(E.nextLabel(s.doc), '1', 'no numbers used yet');
  assert.equal(E.hasFootnotes(s.doc), true);
  assert.equal(E.hasFootnotes(stateFrom('plain [^ x]').doc), false);
  assert.equal(after(s, E.goToFootnote('b')), 'b[^b] a[^a] b again[^b] c[^c]\n\n[^a]: A\n[^b]: B|\n[^z]: nobody');
  assert.equal(after(s, E.goToReference('a')), 'b[^b] a[^a]| b again[^b] c[^c]\n\n[^a]: A\n[^b]: B\n[^z]: nobody');
  assert.equal(E.goToFootnote('c')(s), false, 'a reference without a text');
  assert.equal(E.goToReference('z')(s), false, 'a text nothing refers to');
});

test('[^1]: typed at the start of a line (after its reference) makes it a footnote\'s text', () => {
  const s = type(stateFrom('[^3]|'), ': ');
  assert.equal(s.doc.firstChild.type.name, 'footnote');
  assert.equal(show(s), '[^3]: |');
  assert.equal(show(type(stateFrom('x[^3]|'), ': ')), 'x[^3]: |', 'not after other words');
});

/* ---------- Find and Replace, the Navigation pane, a picture's caption and alt text ---------- */

/** A state with Find's plugin and the history, from a text with its caret. */
const findState = (t, caret = '|') => stateFrom(t, { caret, plugins: [E.findPlugin(), history()] });
const apply = (s, cmd) => {
  let out = s;
  cmd(s, (tr) => (out = out.apply(tr)));
  return out;
};
/** What's found, as the words at each match (the current one in [brackets]). */
const found = (s) => {
  const f = E.findOf(s);
  return f.matches.map((m, i) => (i === f.current ? `[${s.doc.textBetween(m.from, m.to)}]` : s.doc.textBetween(m.from, m.to)));
};

test('Find: every match, case and whole words as asked, never across lines or into a tag', () => {
  let s = findState('¦The cat sat. CAT scatter cat\ncat-like @[person:p1|cat] **ca**t\nca\nt', '¦');
  s = apply(s, E.setFind({ text: 'cat' }));
  // "ca" + "t" over two styles is one match; "ca\nt" over two lines isn't; the tag's own name isn't searched
  assert.deepEqual(found(s), ['[cat]', 'CAT', 'cat', 'cat', 'cat', 'cat']);
  s = apply(s, E.setFind({ text: 'cat', caseSensitive: true }));
  assert.deepEqual(found(s), ['[cat]', 'cat', 'cat', 'cat', 'cat']);
  s = apply(s, E.setFind({ text: 'cat', wholeWord: true }));
  assert.deepEqual(found(s), ['[cat]', 'CAT', 'cat', 'cat', 'cat'], 'scatter is out; cat-like is a whole word, as in Word');
  s = apply(s, E.setFind({ text: 'Cat', caseSensitive: true, wholeWord: true }));
  assert.deepEqual(found(s), []);
  s = apply(s, E.setFind({ text: '' }));
  assert.deepEqual(found(s), []);
  // what looks like a pattern is looked for as it is
  s = apply(findState('a.b axb (x) [y]|'), E.setFind({ text: 'a.b' }));
  assert.deepEqual(found(s), ['[a.b]']);
  assert.deepEqual(found(apply(s, E.setFind({ text: '(x)' }))), ['[(x)]']);
  // the first after the caret is current; with none after, the first of all
  s = apply(findState('one x two x thr|ee x'), E.setFind({ text: 'x' }));
  assert.equal(E.findOf(s).current, 2);
  s = apply(findState('x x|'), E.setFind({ text: 'x' }));
  assert.equal(E.findOf(s).current, 0);
});

test('Find Next and Previous go round, selecting the match; F3 is the same step', () => {
  let s = apply(findState('|a x b x c x'), E.setFind({ text: 'x' }));
  assert.equal(E.findOf(s).current, 0);
  s = apply(s, E.findStep(1));
  assert.equal(show(s), 'a «x» b x c x', 'the first step selects the current one (just found)');
  s = apply(s, E.findStep(1));
  assert.equal(show(s), 'a x b «x» c x');
  s = apply(s, E.findStep(1));
  s = apply(s, E.findStep(1));
  assert.equal(show(s), 'a «x» b x c x', 'round the end');
  s = apply(s, E.findStep(-1));
  assert.equal(show(s), 'a x b x c «x»', 'and back round the start');
  assert.equal(E.findStep(1)(findState('nothing|'), () => {}), false, 'no search: nothing to do');
});

test('Replace: the current match (once selected), then the next; Replace All in one undo step', () => {
  let s = apply(findState('|Cat, cat and CAT. Concat.'), E.setFind({ text: 'cat', wholeWord: true }));
  assert.deepEqual(found(s), ['[Cat]', 'cat', 'CAT']);
  s = apply(s, E.replaceCurrent('dog'));
  assert.equal(show(s), '«Cat», cat and CAT. Concat.', 'the first press selects it, as in Word');
  s = apply(s, E.replaceCurrent('dog'));
  assert.equal(show(s), 'dog, «cat» and CAT. Concat.');
  assert.deepEqual(found(s), ['[cat]', 'CAT']);
  // a replacement that holds what's looked for isn't found again in a loop
  s = apply(s, E.replaceCurrent('cats cat'));
  assert.equal(show(s), 'dog, cats cat and «CAT». Concat.');
  undo(s, (tr) => (s = s.apply(tr)));
  assert.equal(nd.serializeNote(s.doc), 'dog, cat and CAT. Concat.', 'each Replace is its own undo');
  // Replace All: one change, so one undo
  s = apply(findState('a **cat** and a cat|\n- cat\n> cat'), E.setFind({ text: 'cat' }));
  let n = 0;
  let next = s;
  n = E.replaceAll(s, (tr) => (next = next.apply(tr)), 'dog');
  assert.equal(n, 4);
  assert.equal(nd.serializeNote(next.doc), 'a **dog** and a dog\n- dog\n> dog', 'the styles stay on what replaces');
  assert.deepEqual(found(next), [], 'nothing left to find');
  undo(next, (tr) => (next = next.apply(tr)));
  assert.equal(nd.serializeNote(next.doc), 'a **cat** and a cat\n- cat\n> cat');
  assert.equal(E.replaceAll(next, undefined, 'x'), 4);
  // replaced with nothing: the words go
  next = apply(findState('a-b-c|'), E.setFind({ text: '-' }));
  E.replaceAll(next, (tr) => (next = next.apply(tr)), '');
  assert.equal(nd.serializeNote(next.doc), 'abc');
  assert.equal(E.replaceAll(findState('x|'), () => {}, 'y'), 0, 'no search: nothing replaced');
});

test('Find keeps up with the note: the matches move with each change, and found again where it changed', () => {
  let s = apply(findState('cat |dog cat'), E.setFind({ text: 'cat' }));
  assert.deepEqual(found(s), ['cat', '[cat]']);
  const cur = E.findOf(s).matches[1];
  // typing before it: the current match moves along and stays current
  s = s.apply(s.tr.insertText('big ', 1));
  assert.deepEqual(found(s), ['cat', '[cat]']);
  assert.equal(E.findOf(s).matches[1].from, cur.from + 4);
  // a new match typed in is found, and one broken up isn't any more
  s = s.apply(s.tr.insertText(' cat', s.doc.content.size - 1));
  assert.deepEqual(found(s), ['cat', '[cat]', 'cat']);
  s = s.apply(s.tr.insertText('X', 7));
  assert.equal(nd.serializeNote(s.doc), 'big caXt dog cat cat');
  assert.deepEqual(found(s), ['[cat]', 'cat']);
  // the decorations are the matches, the current one apart
  const deco = E.findOf(s) && s.plugins.find((p) => p.spec.key?.key?.startsWith('find')).props.decorations(s);
  const drawn = deco.find().map((d) => [s.doc.textBetween(d.from, d.to), d.type.attrs.class]);
  assert.deepEqual(drawn.map(([w]) => w), ['cat', 'cat']);
  assert.equal(drawn.filter(([, c]) => c === 'find-match is-current').length, 1);
  // closed: nothing lit
  s = apply(s, E.clearFind);
  assert.equal(E.findOf(s), null);
});

test('the Navigation pane: the headings by level, the one the caret is under', () => {
  const s = stateFrom('intro\n# One **bold** @[person:p1|Ann]\ntext\n## Two¦\n#\n> ### In a quote\n###### Six', { caret: '¦' });
  const hs = E.headingsOf(s.doc);
  assert.deepEqual(hs.map((h) => [h.level, h.text]), [[1, 'One bold Ann'], [2, 'Two'], [3, 'In a quote'], [6, 'Six']], 'an empty heading is left out');
  assert.equal(E.headingAt(hs, s.selection.from), 1);
  assert.equal(E.headingAt(hs, 1), -1, 'above the first');
  assert.equal(s.doc.nodeAt(hs[0].pos).type.name, 'heading');
  assert.deepEqual(E.headingsOf(stateFrom('no headings|').doc), []);
});

test('a picture’s caption and alt text: put on, changed, taken off; each its own undo', () => {
  const t = `a\n${P('p1', ' 50 left')}\nb`;
  let s = stateFrom(t, { plugins: [history()] });
  const pos = E.mediaList(s.doc)[0].pos;
  s = apply(s, E.setMediaMeta(pos, { caption: '  Our  trip\n[1] ' }));
  assert.equal(nd.serializeNote(s.doc), 'a\n[[photo:p1 50 left|caption=Our trip %5B1%5D]]\nb');
  s = apply(s, E.setMediaMeta(pos, { alt: 'A boat | a lake' }));
  assert.equal(nd.serializeNote(s.doc), 'a\n[[photo:p1 50 left|caption=Our trip %5B1%5D|alt=A boat %7C a lake]]\nb');
  assert.equal(E.setMediaMeta(pos, { alt: 'A boat | a lake' })(s), false, 'the same words: nothing to do');
  s = apply(s, E.setMediaMeta(pos, { caption: '   ' }));
  assert.equal(nd.serializeNote(s.doc), 'a\n[[photo:p1 50 left|alt=A boat %7C a lake]]\nb');
  // resizing keeps them
  s = apply(s, E.setMediaLayout(pos, { size: 30 }));
  assert.equal(nd.serializeNote(s.doc), 'a\n[[photo:p1 30|alt=A boat %7C a lake]]\nb');
  assert.equal(E.setMediaMeta(1, { alt: 'x' })(s), false, 'not a picture there');
});

/* ---------- tables ---------- */

// (a table's text holds | of its own: the caret is ‸ here)
const C = { caret: '‸' };
const T = (text) => stateFrom(text, C);
const tAfter = (text, cmd) => after(text, cmd, C);
const tRun = (text, cmd) => run(text, cmd, C);

test('Insert › Table: an empty table with a header row, the caret in its first cell, a line after it to go on', () => {
  assert.equal(tAfter('‸', E.insertTable(3, 2)), '| ‸ |  |\n| --- | --- |\n|  |  |\n|  |  |\n');
  assert.equal(tAfter('a\n‸\nb', E.insertTable(1, 1)), 'a\n| ‸ |\n| --- |\nb', 'in place of an empty line');
  assert.equal(tAfter('ab‸', E.insertTable(2, 1)), 'ab\n| ‸ |\n| --- |\n|  |\n', 'after the line at its end');
  assert.equal(tAfter('‸ab', E.insertTable(1, 1)), '| ‸ |\n| --- |\nab', 'before the line at its start');
  assert.equal(tAfter('a‸b', E.insertTable(1, 2)), 'a\n| ‸ |  |\n| --- | --- |\nb', 'splitting it');
  assert.equal(tAfter('> q‸', E.insertTable(1, 1)), '> q\n> | ‸ |\n> | --- |\n> ', 'in a quote');
  assert.equal(tAfter('‸', E.insertTable(20, 0)).split('\n').length, 1 + 8 + 1, 'at most 8 rows (and at least a column)');
  for (const t of ['| a‸ |\n| --- |', '```\nx‸\n```']) assert.equal(tRun(t, E.insertTable(2, 2))[1], false, `not in ${t}`);
  // one step to undo
  let s = stateFrom('a|', { plugins: [history()] });
  E.insertTable(2, 2)(s, (tr) => (s = s.apply(tr)));
  undo(s, (tr) => (s = s.apply(tr)));
  assert.equal(show(s), 'a|');
});

const GRID = '| a | b |\n| --- | --- |\n| c | d |';
const at = (word) => GRID.replace(word, word + '‸');

test('a table typed as Markdown: Enter after its delimiter row makes it a table', () => {
  const enter = (s) => (E.enter(s, (tr) => (s = s.apply(tr))), s);
  let s = type(T('x\n‸'), '| Name | Age |');
  s = type(enter(s), '| :--- | ---: |');
  assert.equal(nd.serializeNote(s.doc), 'x\n| Name | Age |\n\\| :--- | ---: |', 'typed, the two lines are words (the second escaped, not to read as a table)');
  s = type(enter(s), 'Ann');
  assert.equal(show(s, C), 'x\n| Name | Age |\n| :--- | ---: |\n| Ann‸ |  |');
  // a header holding styles keeps them
  const b = E.toggleMarkSmart('bold');
  let h = T('| a | «bold» |');
  b(h, (tr) => (h = h.apply(tr)));
  h = h.apply(h.tr.setSelection(nd.pmState.TextSelection.atEnd(h.doc)));
  h = type(enter(h), '|-|-|');
  assert.equal(show(enter(h), C), '| a | **bold** |\n| --- | --- |\n| ‸ |  |');
  // not when the widths differ, nor from the middle of the line
  assert.equal(tAfter('| a | b |\n| --- |‸', E.enter), '| a | b |\n| --- |\n‸');
  assert.equal(tRun('| a |\n\\| -‸-- |', E.tableEnter)[1], false);
});

test('Tab and Shift+Tab go from cell to cell, the words selected; Tab in the last cell adds a row', () => {
  assert.equal(tAfter(at('a'), E.tab(false)), '| a | «b» |\n| --- | --- |\n| c | d |');
  assert.equal(tAfter(at('b'), E.tab(false)), '| a | b |\n| --- | --- |\n| «c» | d |', 'on to the next row');
  assert.equal(tAfter(at('c'), E.tab(true)), '| a | «b» |\n| --- | --- |\n| c | d |');
  assert.equal(tAfter(at('d'), E.tab(false)), '| a | b |\n| --- | --- |\n| c | d |\n| ‸ |  |', 'a new row, the caret in its first cell');
  const [text, ok] = tRun(at('a'), E.tab(true));
  assert.deepEqual([text, ok], [at('a'), true], 'Shift+Tab in the first cell stays (and never leaves the note)');
  // the tab key in a cell never types a tab
  assert.ok(!tAfter(at('c'), E.tab(false)).includes('\t'));
});

test('Enter in a cell goes to the cell below (a row added at the bottom), never splitting the cell', () => {
  assert.equal(tAfter(at('a'), E.enter), '| a | b |\n| --- | --- |\n| c‸ | d |');
  assert.equal(tAfter('| a | b |\n| --- | --- |\n| c | d‸ |', E.enter), '| a | b |\n| --- | --- |\n| c | d |\n|  | ‸ |');
  assert.equal(tAfter('| a‸b |\n| --- |', E.enter), '| ab |\n| --- |\n| ‸ |', 'from the middle of the words, nothing split');
  assert.equal(tAfter(at('a'), E.newLine), '| a | b |\n| --- | --- |\n| c‸ | d |', 'Shift+Enter too');
  assert.equal(tAfter('| «a» | b |\n| --- | --- |', E.enter), '| a | b |\n| --- | --- |\n| ‸ |  |', 'a selection in a cell stays');
});

test('the Table tab: rows and columns in and out, the table out, a column aligned', () => {
  const cmd = (a) => E.tableCommand(a);
  assert.equal(tAfter(at('c'), cmd('rowAbove')), '| a | b |\n| --- | --- |\n|  |  |\n| c‸ | d |');
  assert.equal(tAfter(at('a'), cmd('rowBelow')), '| a‸ | b |\n| --- | --- |\n|  |  |\n| c | d |');
  assert.equal(tAfter(at('a'), cmd('rowAbove')), '|  |  |\n| --- | --- |\n| a‸ | b |\n| c | d |', 'above the header row: the new row is the header');
  assert.equal(tAfter(at('b'), cmd('colLeft')), '| a |  | b‸ |\n| --- | --- | --- |\n| c |  | d |');
  assert.equal(tAfter(at('b'), cmd('colRight')), '| a | b‸ |  |\n| --- | --- | --- |\n| c | d |  |');
  assert.equal(tAfter(at('c'), cmd('deleteRow')), '| a | b‸ |\n| --- | --- |');
  assert.equal(nd.serializeNote(nd.normalizeDoc(run(at('a'), cmd('deleteRow'), C)[2].doc)), '| c | d |\n| --- | --- |', 'the header gone: the row under it is the header');
  assert.equal(tAfter('x\n| a‸ |\n| --- |\ny', cmd('deleteRow')), 'x\n‸y', 'its only row: the table goes');
  assert.equal(tAfter(at('a'), cmd('deleteColumn')), '| ‸b |\n| --- |\n| d |');
  assert.equal(tAfter('x\n| a‸ |\n| --- |\n| b |', cmd('deleteColumn')), 'x‸', 'its only column: the table goes (nothing after it: the caret at the end of the line before)');
  assert.equal(tAfter('x\n' + at('d') + '\ny', cmd('deleteTable')), 'x\n‸y');
  assert.equal(tAfter(at('d'), cmd('deleteTable')), '‸', 'a note that was only a table is left an empty line');
  assert.equal(tAfter('> q\n> ' + at('d').replace(/\n/g, '\n> '), cmd('deleteTable')), '> q‸', 'in a quote');
  // a column's alignment, in its delimiter cell: left is none written
  assert.equal(tAfter(at('a'), cmd('center')), '| a‸ | b |\n| :---: | --- |\n| c | d |');
  assert.equal(tAfter(at('d'), cmd('right')), '| a | b |\n| --- | ---: |\n| c | d‸ |');
  assert.equal(tAfter('| a‸ |\n| :---: |', cmd('left')), '| a‸ |\n| --- |');
  assert.equal(E.cellAlignAt(T('| a | b‸ |\n| :---: | ---: |')), 'right');
  assert.equal(E.cellAlignAt(T('| a‸ |\n| :--- |')), 'left');
  assert.equal(E.cellAlignAt(T('a‸')), null);
  // out of a table, none of them applies
  for (const a of ['rowAbove', 'rowBelow', 'colLeft', 'colRight', 'deleteRow', 'deleteColumn', 'deleteTable', 'left', 'center', 'right']) {
    assert.equal(tRun('a‸\n| b |\n| --- |', cmd(a))[1], false, a);
  }
});

test('in a cell: styles, AutoCorrect, Find and pasting work; lists, headings, quotes, alignment and blocks don\'t', () => {
  // styles and AutoCorrect
  assert.equal(tAfter('| wo‸rd |\n| --- |', E.toggleMarkSmart('bold')), '| **wo‸rd** |\n| --- |');
  assert.equal(show(type(T('| ‸ |\n| --- |'), '"a" (c) -- b...'), C), '| “a” © — b…‸ |\n| --- |');
  // Markdown typed at a cell's start stays words
  for (const typed of ['# ', '- ', '1. ', '> ', '[] ', '---', '```js ']) {
    const s = type(T('| ‸ |\n| --- |'), typed);
    assert.equal(s.doc.firstChild.type.name, 'table', typed);
    assert.equal(s.doc.firstChild.firstChild.firstChild.textContent, typed, typed);
  }
  // none of the line's commands applies
  for (const [name, cmd] of Object.entries({
    ul: E.toggleList('ul'), ol: E.toggleList('ol'), task: E.toggleList('task'), h1: E.setStyle('h1'), normal: E.setStyle('normal'), quote: E.toggleQuote,
    centre: E.setAlign('center'), hr: E.insertBlock('hr'), code: E.insertBlock('code'), callout: E.insertBlock('callout'), pagebreak: E.insertBlock('pagebreak'),
    indent: E.indentList(false), up: E.moveBlocks(-1), down: E.moveBlocks(1),
  })) {
    const [text, ok] = tRun('x\n| a‸ |\n| --- |\n| b |\ny', cmd);
    assert.deepEqual([text, ok], ['x\n| a‸ |\n| --- |\n| b |\ny', false], name);
  }
  // a footnote's reference can go in a cell; its text goes to the end of the note
  assert.equal(nd.serializeNote(run('| a‸ |\n| --- |', E.insertFootnote, C)[2].doc), '| a[^1] |\n| --- |\n\n[^1]: ');
  // Find finds in cells
  const s = T('| cat | dog |\n| --- | --- |\n| a cat‸ |  |');
  assert.equal(E.findMatches(s.doc, { text: 'cat' }).length, 2);
  // pasting: several lines in a cell come in as one; a table outside a table is a table
  assert.equal(tAfter('| a‸ |\n| --- |', E.pasteText('x\n- y\n**z**')), '| ax y **z‸** |\n| --- |');
  assert.equal(tAfter('| a‸ |\n| --- |', E.pasteText('x\ny', true)), '| ax y‸ |\n| --- |', 'Shift+paste too');
  assert.equal(nd.serializeNote(run('a\n‸', E.pasteText('| x | y |\n| --- | :-: |\n| 1 | 2 |'), C)[2].doc), 'a\n| x | y |\n| --- | :---: |\n| 1 | 2 |');
});

test('Backspace and Delete next to a table: cells never run together, nor a line into the table', () => {
  assert.deepEqual(tRun('| a | ‸b |\n| --- | --- |', Backspace).slice(0, 2), ['| a | ‸b |\n| --- | --- |', true], 'at a cell\'s start, nothing');
  assert.deepEqual(tRun('| a‸ | b |\n| --- | --- |', Delete).slice(0, 2), ['| a‸ | b |\n| --- | --- |', true], 'at a cell\'s end, nothing');
  assert.equal(tAfter('| a |\n| --- |\n‸b', Backspace), '| a‸ |\n| --- |\nb', 'a line after it: the caret into the last cell');
  assert.equal(tAfter('| a |\n| --- |\n‸\nb', Backspace), '| a‸ |\n| --- |\nb', 'an empty one goes');
  assert.equal(tAfter('b‸\n| a |\n| --- |', Delete), 'b‸\n| a |\n| --- |', 'a line before it: nothing');
  assert.equal(tAfter('x\n‸\n| a |\n| --- |', Delete), 'x\n| ‸a |\n| --- |', 'an empty one goes, the caret into the first cell');
});

test('Alt+Shift+Up and Down move a line past a table whole, and nothing inside one', () => {
  assert.equal(tAfter('x\n| a |\n| --- |\n| b |\ny‸', E.moveBlocks(-1)), 'x\ny‸\n| a |\n| --- |\n| b |');
  assert.equal(tAfter('x‸\n| a |\n| --- |', E.moveBlocks(1)), '| a |\n| --- |\nx‸');
  assert.equal(tRun('x\n| a |\n| --- |\n| b‸ |', E.moveBlocks(-1))[1], false);
});

test('the ribbon lights the table and its column\'s alignment', () => {
  const l = E.litOf(T('| a | b‸ |\n| --- | :---: |'));
  assert.deepEqual([l.table, l.cellAlign, l.block, l.canAlign, l.style], [true, 'center', 'p', false, 'normal']);
  assert.deepEqual([E.litOf(T('a‸')).table, E.litOf(T('a‸')).cellAlign], [false, null]);
});

test('every table command at every caret leaves a document that writes text reading back as itself', () => {
  const NOTES3 = [
    'before | x\n| **a** | b `c|d` |\n| :--- | ---: |\n| @[Ann] | [[note:n1|N]] |\nafter',
    '> q\n> | a |\n> | --- |\n\n| x | y | z |\n| --- | :---: | --- |\n|  | 1 |  |',
    '| a |\n| --- |\n\n| b |\n| --- |\n[[photo:p1]]\n| c |\n| --- |',
  ];
  const CMDS = {
    enter: E.enter, newLine: E.newLine, backspace: Backspace, delete: Delete, tab: E.tab(false), untab: E.tab(true), table: E.insertTable(2, 2),
    ...Object.fromEntries(['rowAbove', 'rowBelow', 'colLeft', 'colRight', 'deleteRow', 'deleteColumn', 'deleteTable', 'center', 'right', 'left'].map((a) => [a, E.tableCommand(a)])),
    bold: E.toggleMarkSmart('bold'), paste: E.pasteText('x | y\n- z'), pasteTable: E.pasteText('| p | q |\n| --- | --- |'), up: E.moveBlocks(-1), down: E.moveBlocks(1),
    quote: E.toggleQuote, ul: E.toggleList('ul'), h1: E.setStyle('h1'), hr: E.insertBlock('hr'), footnote: E.insertFootnote, pic: E.insertMediaAt([{ kind: 'photo', id: 'z' }]),
  };
  const { TextSelection } = nd.pmState;
  let runs = 0;
  for (const t of NOTES3) {
    const start = nd.pmState.EditorState.create({ doc: nd.parseNote(t) });
    assert.equal(nd.serializeNote(start.doc), t);
    const places = [];
    start.doc.descendants((node, pos) => {
      if (node.isTextblock) for (let k = 0; k <= node.content.size; k++) places.push(pos + 1 + k);
      return !node.isTextblock;
    });
    const sels = [...places.map((p) => [p, p]), ...places.filter((_, i) => i % 5 === 0).map((p, i, a) => [p, a[Math.min(a.length - 1, i + 2)]])];
    for (const [a, h] of sels) {
      const s = start.apply(start.tr.setSelection(TextSelection.create(start.doc, a, h)));
      for (const [name, cmd] of Object.entries(CMDS)) {
        let next = s;
        const where = `${name} on ${JSON.stringify(t)} at ${a}-${h}`;
        try {
          cmd(s, (tr) => (next = next.apply(tr)));
          next.doc.check();
        } catch (e) {
          assert.fail(`${where}: ${e.message}`);
        }
        const norm = nd.normalizeDoc(next.doc);
        const text = nd.serializeNote(norm);
        const back = nd.parseNote(text);
        assert.equal(back.textContent, norm.textContent, `${where}: characters → ${JSON.stringify(text)}`);
        assert.ok(nd.sameDoc(back, norm), `${where}: reads back the same → ${JSON.stringify(text)}`);
        assert.equal(nd.serializeNote(back), text, `${where}: written again → ${JSON.stringify(text)}`);
        runs++;
      }
    }
  }
  assert.ok(runs > 1000);
});

/* ---------- comments ---------- */

test('comments: New comment is a draft until it says something; saved, edited, emptied, deleted, gone to', () => {
  const { history, undo } = nd.pmHistory;
  const plugins = [E.commentsPlugin(), history()];
  let s = stateFrom('one «two three» four\n```\ncode\n```\nlast', { plugins });
  const go = (cmd) => cmd(s, (tr) => (s = s.apply(tr)));
  // a draft: nothing in the text yet, the words lit
  assert.ok(go(E.newComment));
  const { draft } = E.commentsState(s);
  assert.deepEqual(draft, { from: 5, to: 14 });
  assert.equal(nd.serializeNote(s.doc), 'one two three four\n```\ncode\n```\nlast');
  assert.equal(E.litOf(s).comment, true, 'Delete comment takes a draft away too');
  // its box done with: saying something, it's a comment (one line, written strictly)
  assert.ok(go(E.saveComment(draft.from, ' did I\nmean -- it? [x] ')));
  assert.equal(nd.serializeNote(s.doc), 'one <span class="comment">two three</span><!-- comment: did I mean %2D- it? %5Bx%5D --> four\n```\ncode\n```\nlast');
  assert.equal(E.commentsState(s).draft, null);
  assert.deepEqual(E.commentsOf(s.doc).map((c) => [c.from, c.to, c.text]), [[5, 14, 'did I mean -- it? [x]']]);
  // the caret in it: New comment writes in that one (no new one)
  s = s.apply(s.tr.setSelection(nd.pmState.TextSelection.create(s.doc, 7)));
  assert.ok(go(E.newComment));
  assert.deepEqual(E.commentsState(s), { draft: null, focus: 5 });
  assert.deepEqual(E.commentAt(s), E.commentsOf(s.doc)[0]);
  assert.ok(E.litOf(s).comment && E.litOf(s).comments);
  // edited, then emptied: it goes, its words stay
  assert.ok(go(E.saveComment(5, 'later')));
  assert.match(nd.serializeNote(s.doc), /<!-- comment: later -->/);
  assert.equal(go(E.saveComment(5, 'later')), false, 'nothing changed');
  assert.ok(go(E.saveComment(5, '  ')));
  assert.equal(nd.serializeNote(s.doc), 'one two three four\n```\ncode\n```\nlast');
  // undo brings it back, as it was
  s = s.apply(s.tr.setMeta('addToHistory', true));
  undo(s, (tr) => (s = s.apply(tr)));
  assert.match(nd.serializeNote(s.doc), /<!-- comment: later -->/);
  // a draft saying nothing goes without a trace
  s = s.apply(s.tr.setSelection(nd.pmState.TextSelection.create(s.doc, 1)));
  assert.ok(go(E.newComment));
  const before = s.doc;
  assert.ok(go(E.saveComment(E.commentsState(s).draft.from, '')));
  assert.ok(s.doc.eq(before));
  assert.equal(E.commentsState(s).draft, null);
  // none in code, nor where there's no word
  s = s.apply(s.tr.setSelection(nd.pmState.TextSelection.create(s.doc, 22)));
  assert.equal(E.litOf(s).block, 'code');
  assert.equal(go(E.newComment), false);
  assert.equal(E.litOf(s).canComment, false);
});

test('comments: Delete, Previous and Next, over lines, in a table, beside other styles', () => {
  const run2 = (t, cmd) => run(t, cmd)[0];
  // the word at the caret, without spaces; over two lines it's one comment (a mark on each)
  assert.equal(run2('a wo|rd here', E.addComment('c')), 'a <span class="comment">wo|rd</span><!-- comment: c --> here');
  const [two, , st] = run('ab «cd\nef» gh', E.addComment('both'));
  assert.equal(two, 'ab «<span class="comment">cd</span><!-- comment: both -->\n<span class="comment">ef</span><!-- comment: both -->» gh');
  assert.deepEqual(E.commentsOf(st.doc).map((c) => [c.text, c.ranges.length]), [['both', 2]]);
  assert.equal(run2('ab <span class="comment">c|d</span><!-- comment: both -->\n<span class="comment">ef</span><!-- comment: both --> gh', E.deleteComment()), 'ab c|d\nef gh', 'deleted whole');
  // with other styles on the same words: they stay
  assert.equal(run2('**a «b» c**', E.addComment('x')), '**a «<span class="comment">b</span><!-- comment: x -->» c**');
  assert.equal(run2('<span style="color:red">a «b»</span>', E.addComment('x')), '<span style="color:red">a «</span><span class="comment"><span style="color:red">b</span></span><!-- comment: x --><span style="color:red">»</span>');
  // in a table's cell
  const caret = { caret: '‸' };
  assert.equal(run('| a | b‸c |\n| --- | --- |', E.addComment('in | cell'), caret)[0], '| a | <span class="comment">b‸c</span><!-- comment: in %7C cell --> |\n| --- | --- |');
  // Delete with nothing there: false
  assert.equal(run('a |b', E.deleteComment())[1], false);
  // Previous and Next: round the comments, the words selected
  const t = 'x <span class="comment">a</span><!-- comment: 1 --> |y <span class="comment">b</span><!-- comment: 2 --> z <span class="comment">c</span><!-- comment: 3 -->';
  const sel = (r) => r[2].doc.textBetween(r[2].selection.from, r[2].selection.to);
  assert.equal(sel(run(t, E.stepComment(1))), 'b');
  assert.equal(sel(run(t, E.stepComment(-1))), 'a');
  assert.equal(sel(run(t.replace('|', '').replace(/c<\/span>/, 'c</span>') + '|', E.stepComment(1))), 'a', 'past the last: round to the first');
  assert.equal(run('no comments |here', E.stepComment(1))[1], false);
});
