import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { rolldown } from 'rolldown';

// What an @ or a [[ costs on each key while its suggestions are up, with a big journal: 400 people, 600 books, 1,500
// songs and 3,000 notes (a third untitled, named by their first line).
//   node scripts/bench-suggest.mjs
// Not part of npm test: it prints numbers, it checks nothing.
const root = new URL('..', import.meta.url).pathname;
const bundle = await rolldown({
  input: 'bench:suggest',
  cwd: root,
  logLevel: 'silent',
  plugins: [{
    name: 'bench-suggest',
    resolveId: (id) => (id === 'bench:suggest' ? '\0' + id : /\/data\/(traps|laws|principles)$/.test(id) ? '\0learn-data' : null),
    load(id) {
      if (id === '\0bench:suggest') return `export { suggest } from '${root}src/lib/mentions.ts'; export { suggestLinks, linkedFrom } from '${root}src/lib/links.ts';`;
      // English only (the Romanian dictionary arrives by a top-level await), and no traps, laws or principles
      if (id.endsWith('/src/lib/i18n.ts')) return readFileSync(id, 'utf8').replace("await import('../data/ro')", 'null');
      // (the store needs a browser: only books.ts's getBooks is asked of it)
      if (id.endsWith('/src/lib/store.ts')) return 'export const getBooks = () => [];';
      if (id === '\0learn-data') return 'export const TRAPS = [], LAWS = [], PRINCIPLES = [], FAMILIES = {}, REALMS = {}, PARTS = {};';
    },
  }],
});
const code = (await bundle.generate({ format: 'esm' })).output[0].code;
await bundle.close();
const { suggest, suggestLinks, linkedFrom } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const names = ['Ana', 'Andrei', 'Ioana', 'Mihai', 'Elena', 'Radu', 'Maria', 'Ștefan', 'Bianca', 'Vlad'];
const people = Array.from({ length: 400 }, (_, i) => ({ id: 'p' + i, name: `${names[i % 10]} ${names[(i * 7) % 10]}escu ${i}`, relation: i % 3 ? 'friend' : 'colleague from work', emotions: [] }));
const books = Array.from({ length: 600 }, (_, i) => ({ id: 'b' + i, title: `The Book of ${names[i % 10]} ${i}`, authors: `${names[(i * 3) % 10]} Writer`, status: i % 5 ? 'read' : 'reading', emotions: [] }));
const songs = Array.from({ length: 1500 }, (_, i) => ({ id: 's' + i, repeat: i % 50 === 0, music: { kind: 'track', id: 't' + i, title: `Song for ${names[i % 10]} ${i}`, sub: `Band ${i % 40}` }, emotions: [] }));
const entries = Array.from({ length: 3000 }, (_, i) => ({
  id: 'n' + i, kind: 'note', title: i % 3 ? `Day with ${names[i % 10]} ${i}` : '', people: i % 4 ? [] : ['p' + (i % 400)], emotions: [],
  // (a picture in every other note, a link to another note in one in five)
  text: `First line about ${names[i % 10]} and the day\n` + 'more words '.repeat(200) + (i % 2 ? '\n[[photo:p' + i + ']]\nafter' : '') + (i % 5 ? '' : `\nsee [[note:n${(i * 7) % 3000}|Day]]`),
}));

const time = (fn, runs = 30) => {
  fn();
  const out = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    out.push(performance.now() - t0);
  }
  return out.sort((a, b) => a - b)[Math.floor(runs / 2)];
};
// each key of a word as typed: the suggestions read again for each; the time per key
const typing = (word, fn) => (time(() => { for (let i = 1; i <= word.length; i++) fn(word.slice(0, i)); }) / word.length).toFixed(2) + ' ms';
console.log('@ suggestions, per key (typing "mihai"):', typing('mihai', (q) => suggest(q, people, books, songs, entries)));
console.log('[[ suggestions, per key (typing "day wi"):', typing('day wi', (q) => suggestLinks(q, entries, books, 'self')));
// opening a note: the notes linking to it, read from every note (a new list each time, as after a save)
console.log('Linked from, on opening a note:', time(() => linkedFrom('n7', [...entries], books)).toFixed(2) + ' ms');
