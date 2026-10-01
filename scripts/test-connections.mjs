import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// The Connections page's reading of a journal: which things share notes, the thread through them, and how the
// feelings around one of them changed. Pure functions over plain data; the store is stubbed out.
const bundle = await rolldown({
  input: new URL('../src/lib/connections.ts', import.meta.url).pathname,
  plugins: [{
    name: 'connections-test-boundaries',
    resolveId(id) { if (id === './store') return '\0store'; },
    load(id) { if (id === '\0store') return 'export const getBooks = () => [];'; },
  }],
});
const { output } = await bundle.generate({ format: 'cjs' });
await bundle.close();
const module = { exports: {} };
vm.runInNewContext(output[0].code, { module, exports: module.exports, Intl, Date });
const cx = module.exports;
// arrays made inside the vm aren't this realm's Arrays
const plain = (v) => JSON.parse(JSON.stringify(v));

const person = (id, name, emotions = []) => ({ id, name, relation: '', emotions, text: '', icon: null, created: 0, updated: 0 });
const music = (id, title) => ({ kind: 'track', id, title, link: 'https://open.spotify.com/track/' + id });
let n = 0;
const note = (date, extra = {}) => ({
  id: 'e' + ++n, kind: 'note', title: '', icon: null, text: '', emotions: [], intensity: 3, date, dateEnd: null,
  time: Date.parse(date + 'T12:00:00'), images: [], photos: [], music: [], people: [], cover: null, pinned: false,
  place: null, weather: null, created: 0, updated: 0, ...extra,
});
const at = (name) => ({ lat: 0, lon: 0, name });
const newest = (list) => [...list].sort((a, b) => (a.date < b.date ? 1 : -1));

const people = [person('mad', 'Madalina', ['love-connection/affection']), person('ste', 'Stefania')];
const song = music('s1', 'Mall Lights');
const journal = newest([
  note('2025-05-03', { people: ['mad'], place: at('Sector 1, București'), emotions: ['love-connection/affection'], music: [song] }),
  note('2025-05-10', { title: 'The mall', people: ['mad'], place: at('Sector 3, București'), emotions: ['shame-aversion/guilt/regretful', 'love-connection/affection'], intensity: 5, music: [song], text: 'We walked for hours' }),
  note('2025-05-20', { text: 'Thinking of @[Madalina] again', place: at('Centru, Cluj-Napoca'), emotions: ['love-connection/affection'] }),
  note('2025-06-01', { place: at('Centru, Cluj-Napoca'), emotions: ['joy'] }),
  note('2025-06-02', { place: at('Centru, Cluj-Napoca'), emotions: ['joy'] }),
  note('2025-06-03', { place: at('Centru, Cluj-Napoca'), emotions: ['joy'] }),
]);

test('notes link the people, towns, months, feelings and music in them', () => {
  const g = cx.buildGraph(journal, people, [], []);
  assert.equal(g.notes.get('person:mad').length, 3, 'tags in the words count as well as tagged people');
  assert.equal(g.nodes.get('place:bucurești').label, 'București');
  assert.equal(g.notes.get('place:bucurești').length, 2, 'districts of one town are one place');
  assert.equal(g.nodes.get('month:2025-05').label.includes('2025'), true);
  assert.equal(g.nodes.get('feeling:shame-aversion/guilt/regretful').label, 'Regretful');
  assert.equal(g.nodes.get('music:track:s1').label, 'Mall Lights');
  assert.ok(!g.nodes.has('person:ste'), 'someone in no notes has no threads');
});

test('a thread follows the most telling link of each kind and ends in the note that holds it', () => {
  const g = cx.buildGraph(journal, people, [], []);
  const steps = cx.thread(g, 'person:mad');
  const label = (kind) => plain(steps.find((s) => s.kind === kind)?.picks.map((r) => r.node.label));
  // Cluj has as many of her notes as Bucharest would, but it's where everything else is written too
  assert.deepEqual(label('place'), ['București']);
  assert.equal(label('month').length, 1);
  assert.deepEqual(label('feeling'), ['Affection', 'Regretful']);
  assert.deepEqual(label('music'), ['Mall Lights']);
  const memory = steps.at(-1);
  assert.equal(memory.kind, 'memory');
  assert.equal(cx.memoryLabel(memory.memory), 'The mall');
  assert.ok(!steps.some((s) => s.kind === 'person'), 'a person thread does not start with people');
});

test('the arc names each stretch by its strongest feeling and notices notes drifting apart', () => {
  const ste = [
    note('2024-01-01', { people: ['ste'], emotions: ['fear/uncertainty'] }),
    note('2024-01-04', { people: ['ste'], emotions: ['fear/uncertainty'] }),
    note('2024-01-08', { people: ['ste'], place: at('Cluj-Napoca'), emotions: ['hope-interest/curiosity/fascinated'], intensity: 5 }),
    note('2024-01-10', { people: ['ste'], emotions: ['hope-interest/curiosity/fascinated'], intensity: 5 }),
    note('2024-01-13', { people: ['ste'], emotions: ['sadness/disappointment'] }),
    note('2024-03-20', { people: ['ste'], emotions: ['sadness/disappointment'] }),
    note('2024-07-01', { people: ['ste'], emotions: ['sadness/disappointment'] }),
  ];
  const g = cx.buildGraph(newest(ste), people, [], []);
  const a = cx.arc(g, 'person:ste', Date.parse('2024-07-02'));
  assert.deepEqual(plain(a.phases.map((p) => cx.feelingName(p.feeling))), ['Uncertainty', 'Fascinated', 'Disappointment']);
  assert.equal(a.ending.kind, 'drift');
  assert.equal(a.ending.label, 'Drifting apart');
  const later = cx.arc(g, 'person:ste', Date.parse('2025-03-01'));
  assert.ok(later.ending, 'a long silence is noticed too');
});

test('a long silence ends the arc quietly, and thin journals make no arc', () => {
  const g = cx.buildGraph(journal, people, [], []);
  const a = cx.arc(g, 'person:mad', Date.parse('2026-01-01'));
  assert.equal(a.ending.kind, 'quiet');
  assert.match(a.ending.label, /^Quiet since May 2025$/);
  const one = cx.buildGraph([note('2025-01-01', { people: ['mad'], emotions: ['joy'] })], people, [], []);
  assert.deepEqual(plain(cx.arc(one, 'person:mad')), { phases: [], ending: null });
  assert.equal(cx.arc(g, 'month:2025-05', Date.parse('2026-01-01')).ending, null, 'months are over, not fading');
});

test('spans and labels read naturally', () => {
  assert.equal(cx.spanLabel('2025-05-01', '2025-05-30'), 'May 2025');
  assert.equal(cx.spanLabel('2025-03-01', '2025-06-30'), 'Mar – Jun 2025');
  assert.equal(cx.spanLabel('2024-11-01', '2025-02-01'), 'Nov 2024 – Feb 2025');
  assert.equal(cx.cityOf('Centru, Cluj-Napoca'), 'Cluj-Napoca');
  assert.equal(cx.cityOf(''), '');
  assert.equal(cx.memoryLabel(note('2025-01-01', { text: '**A long** walk by the river that went on and on until late' })), 'A long walk by the river that…');
});
