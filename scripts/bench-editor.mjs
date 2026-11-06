import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { rolldown } from 'rolldown';

// How long the note editor takes with a long note, in jsdom (no browser, so no layout or paint: the numbers are the
// script's own work, what a phone's main thread does on top of drawing). Opens a note of `words` words (default 20,000)
// full of tags, links, pictures, lists and headings, then types into its middle and times each key, the work done in
// the frame after it (the ribbon's lit state, the comments, the pictures' slots), writing the text back, and what the
// page does with that text after a pause (reading its pictures, counting its words).
//   node scripts/bench-editor.mjs [words]
// Not part of npm test: it prints numbers, it checks nothing.
const root = new URL('..', import.meta.url).pathname;
const WORDS = Number(process.argv[2]) || 20000;

const bundle = await rolldown({
  input: 'bench:editor',
  logLevel: 'silent',
  transform: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  plugins: [{
    name: 'bench-entry',
    resolveId(id, importer) {
      if (id === 'bench:editor') return '\0' + id;
      if (id.endsWith('.css')) return '\0css';
      if (id.endsWith('/components/mentions') || (id === './mentions' && importer?.endsWith('/components/Markdown.tsx'))) return '\0mentions';
      if (/\/data\/(traps|laws|principles)$/.test(id)) return '\0learn-data';
    },
    load(id) {
      if (id === '\0css') return '';
      if (id.endsWith('/src/lib/i18n.ts')) return readFileSync(id, 'utf8').replace("await import('../data/ro')", 'null');
      if (id === '\0bench:editor') return `
        export { NoteBody } from '${root}src/editor/NoteBody.tsx';
        export { CommentsPane } from '${root}src/components/CommentsPane.tsx';
        export { parseNote, serializeNote, normalizeDoc, noteSchema } from '${root}src/lib/noteDoc/index.ts';
        export { parseBody, plainText } from '${root}src/lib/body.ts';
        export { stripMarkdown } from '${root}src/lib/markdown.ts';
        export { h, render } from 'preact';
        export { act } from 'preact/test-utils';
      `;
      if (id === '\0learn-data') return 'export const TRAPS = [], LAWS = [], PRINCIPLES = [], FAMILIES = {}, REALMS = {}, PARTS = {};';
      if (id === '\0mentions') return `
        import { createContext, h } from 'preact';
        const chip = (cls) => ({ text }) => h('span', { role: 'button', class: 'mention ' + cls }, text);
        export const PersonMention = chip('is-person'), SongMention = chip('is-song'), WikiLink = chip('is-wiki');
        export const InText = createContext(false);
      `;
    },
  }],
});
const code = (await bundle.generate({ format: 'iife', name: 'NB' })).output[0].code;
await bundle.close();

/** A long note: paragraphs of words with tags, links, styles and #tags, headings, lists, tasks, quotes and pictures. */
function longNote(words) {
  const vocab = 'the a quiet morning walk river light coffee friend talked about work tired happy because we went home later thought maybe tomorrow better slowly city rain window book'.split(' ');
  let seed = 7;
  // mulberry32: the same note every run
  const rnd = (n) => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
  const word = () => vocab[rnd(vocab.length)];
  const lines = [];
  let n = 0, k = 0;
  while (n < words) {
    k++;
    if (k % 25 === 1) lines.push(`## Part ${k}`);
    if (k % 9 === 0) {
      lines.push(`[[photo:p${k} 50 ${k % 2 ? 'left' : 'right'}]]`);
      continue;
    }
    if (k % 7 === 0) {
      for (let i = 0; i < 3; i++) lines.push(`${i === 1 ? '- [ ] ' : '- '}${word()} ${word()} ${word()} @[person:p${i}|Ann ${i}]`);
      n += 12;
      continue;
    }
    if (k % 11 === 0) lines.push(`> ${word()} ${word()} ${word()} ${word()}`);
    const len = 40 + rnd(40);
    const parts = [];
    for (let i = 0; i < len; i++) {
      const r = rnd(60);
      parts.push(r === 0 ? `@[person:p${rnd(30)}|Person ${rnd(30)}]` : r === 1 ? `[[note:n${rnd(50)}|Note ${rnd(50)}]]` : r === 2 ? `**${word()}**` : r === 3 ? `#tag${rnd(9)}` : r === 4 ? `♪[song:s${rnd(9)}|Song]` : r === 5 ? `[${word()}](https://example.com/${rnd(99)})` : word());
    }
    n += len;
    lines.push(parts.join(' ') + '.');
  }
  return lines.join('\n');
}

const text = longNote(WORDS);

function page() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  window.Range.prototype.getClientRects = () => [];
  window.Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  window.document.elementFromPoint = () => null;
  window.ClipboardEvent = class extends window.Event { constructor(type, o) { super(type, o); this.clipboardData = null; } };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.CSS ??= { supports: () => false, escape: (s) => s };
  // frames run when asked, so the work done in each is timed on its own
  const frames = new Map();
  let next = 1;
  window.requestAnimationFrame = (fn) => (frames.set(next, fn), next++);
  window.cancelAnimationFrame = (id) => frames.delete(id);
  window.runFrames = () => {
    const due = [...frames.values()];
    frames.clear();
    for (const fn of due) fn(0);
  };
  window.eval(code);
  return window;
}

const ms = (x) => x.toFixed(2) + ' ms';
const stats = (list) => {
  const s = [...list].sort((a, b) => a - b);
  return `median ${ms(s[Math.floor(s.length / 2)])}, p95 ${ms(s[Math.floor(s.length * 0.95)])}, max ${ms(s[s.length - 1])}`;
};
const time = (fn, runs = 5) => {
  fn();
  const out = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    out.push(performance.now() - t0);
  }
  return out.sort((a, b) => a - b)[Math.floor(runs / 2)];
};

const window = page();
const NB = window.NB;
console.log(`note: ${WORDS} words, ${text.length} characters, ${text.split('\n').length} lines`);

// the pure parts first
const schema = NB.noteSchema();
console.log('parseNote + normalizeDoc:', ms(time(() => NB.normalizeDoc(NB.parseNote(text, schema)))));
const doc = NB.normalizeDoc(NB.parseNote(text, schema));
console.log('serializeNote (text()):', ms(time(() => NB.serializeNote(doc))));
console.log('parseBody (syncText reads the pictures):', ms(time(() => NB.parseBody(text))));
const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
console.log('status bar word count:', ms(time(() => NB.stripMarkdown(NB.plainText(text)).replace(/\[\[(?:note|trap|law):[^|\]\n]*\|/g, '[[').replace(/^\s*[•☐☑] /gm, '').match(WORD)?.length)));

// the editor, mounted with the comments pane watching (as the note page has it)
const host = window.document.createElement('div');
window.document.body.append(host);
let handle = null, changes = 0;
const props = {
  text, editable: true,
  onChange: () => changes++, onTyped: () => {}, suggestKey: () => false, onLink: () => {}, onSave: () => {},
  onFind: () => {}, onMedia: () => {}, knows: () => true, margins: () => ({ top: 0, bottom: 0 }),
  onReady: (h) => (handle = h || handle),
};
const t0 = performance.now();
NB.act(() => NB.render(NB.h('div', null, NB.h(NB.NoteBody, props), NB.h(NB.CommentsPane, { note: null, wide: true, reading: false, open: null, onOpen: () => {} })), host));
const opened = performance.now() - t0;
console.log('open (mount, first draw):', ms(opened));
const view = handle.view;
// the ribbon and the panes watching, as on the page
handle.watch(() => {});
handle.comments.watch(() => {});
handle.outline.watch(() => {});
window.runFrames();

const TextSelection = view.state.selection.constructor;
const mid = Math.floor(view.state.doc.content.size / 2);
let at = mid;
while (!view.state.doc.resolve(at).parent.isTextblock) at++;
view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
window.runFrames();

const keys = [], frameWork = [];
const typed = 'and then we walked home slowly, talking about nothing in particular ';
for (let round = 0; round < 3; round++) {
  for (const ch of typed) {
    const { from, to } = view.state.selection;
    const a = performance.now();
    if (!view.someProp('handleTextInput', (f) => f(view, from, to, ch))) view.dispatch(view.state.tr.insertText(ch, from, to));
    const b = performance.now();
    window.runFrames();
    const c = performance.now();
    keys.push(b - a);
    frameWork.push(c - b);
  }
}
console.log(`key (transaction + view update), ${keys.length} keys:`, stats(keys));
console.log('frame after a key (lit, comments, outline, slots):', stats(frameWork));
console.log('text() on the open note:', ms(time(() => handle.text())));
const caretOnly = [];
for (let i = 0; i < 40; i++) {
  const pos = view.state.selection.from + (i % 2 ? 1 : -1);
  const a = performance.now();
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
  window.runFrames();
  caretOnly.push(performance.now() - a);
}
console.log('caret move (arrow key) + its frame:', stats(caretOnly));
process.exit(0);
