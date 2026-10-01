// Connections: what the journal ties together without saying so. Every note and check-in links the people in it, the
// city it was written in, its month, the feelings logged, the music and the books it mentions. Two things that keep
// turning up in the same notes are connected, and following the strongest link from each step gives a thread —
// Ana → Cluj → May → Affection, Regretful → ♪ a song → the note it all happened in. Over time, the feelings around one
// thing make an arc: what it felt like first, then, and lately — and whether it's been fading.
import { EMOTION, coreOf, shortName } from '../data/emotions';
import { plainText } from './body';
import { booksIn } from './books';
import { DAY, monthLabel, monthShort, parseKey } from './dates';
import { PERSON, SONG, resolvePerson, resolveSong } from './mentions';
import type { Book, Entry, Music, Person, Song } from './store';

export type NodeKind = 'person' | 'place' | 'month' | 'feeling' | 'music' | 'book';

/** One thing notes can share. `key` is `<kind>:<id>`. */
export interface Node {
  key: string;
  kind: NodeKind;
  label: string;
  core: string | null;      // the feeling world it's coloured with
  person?: Person;
  music?: Music;
  book?: Book;
}

export interface Graph {
  nodes: Map<string, Node>;
  /** node key → the notes it's in, newest first */
  notes: Map<string, Entry[]>;
  /** note id → the nodes it links */
  links: Map<string, string[]>;
}

/** Something connected to the focus: in `count` of its notes, and how specific that is to it. */
export interface Rel { node: Node; count: number; score: number }

const mainCore = (emotions: string[]) => (emotions[0] ? coreOf(emotions[0])?.id ?? null : null);

/** "Centru, Cluj-Napoca" → "Cluj-Napoca": connections are made at the scale of a town. */
export const cityOf = (name: string) => name.split(',').map((s) => s.trim()).filter(Boolean).pop() ?? '';

export const monthOf = (date: string) => date.slice(0, 7);
const monthName = (ym: string) => monthLabel(+ym.slice(0, 4), +ym.slice(5, 7) - 1);
export const feelingName = (id: string) => (EMOTION[id]?.depth === 0 ? shortName(id) : EMOTION[id]?.name ?? id);

export function buildGraph(entries: Entry[], people: Person[], books: Book[], songs: Song[]): Graph {
  const nodes = new Map<string, Node>();
  const notes = new Map<string, Entry[]>();
  const links = new Map<string, string[]>();
  const personById = new Map(people.map((p) => [p.id, p]));
  for (const e of entries) {
    const keys = new Set<string>();
    const add = (n: Node) => {
      if (!nodes.has(n.key)) nodes.set(n.key, n);
      keys.add(n.key);
    };
    const person = (p: Person | undefined) => p && add({ key: 'person:' + p.id, kind: 'person', label: p.name.trim() || 'Unnamed', core: mainCore(p.emotions), person: p });
    for (const id of e.people) person(personById.get(id));
    if (e.text.includes('@[')) for (const m of e.text.matchAll(PERSON)) person(resolvePerson(m[1], m[2], people));
    const city = e.place ? cityOf(e.place.name) : '';
    if (city) add({ key: 'place:' + city.toLowerCase(), kind: 'place', label: city, core: null });
    const ym = monthOf(e.date);
    add({ key: 'month:' + ym, kind: 'month', label: monthName(ym), core: null });
    for (const id of e.emotions) if (EMOTION[id]) add({ key: 'feeling:' + id, kind: 'feeling', label: feelingName(id), core: coreOf(id).id });
    const music = (m: Music, kept?: Song) =>
      add({ key: `music:${m.kind}:${m.id}`, kind: 'music', label: m.title, core: kept ? mainCore(kept.emotions) : null, music: m });
    for (const m of e.music) music(m, songs.find((s) => s.music.kind === m.kind && s.music.id === m.id));
    if (e.text.includes('♪[')) for (const m of e.text.matchAll(SONG)) {
      const s = resolveSong(m[1], m[2], songs);
      if (s) music(s.music, s);
    }
    for (const id of booksIn(e.text, books)) {
      const b = books.find((x) => x.id === id)!;
      add({ key: 'book:' + id, kind: 'book', label: b.title.trim() || 'Untitled', core: mainCore(b.emotions), book: b });
    }
    links.set(e.id, [...keys]);
    for (const k of keys) {
      const list = notes.get(k);
      if (list) list.push(e);
      else notes.set(k, [e]);
    }
  }
  return { nodes, notes, links };
}

/**
 * Everything that shares notes with `key`, strongest first. Strength is how many notes they share, tempered by how
 * much of the other thing's life that is — so the city you always write in counts for less than the one you only
 * write in about them.
 */
export function related(g: Graph, key: string): Rel[] {
  const counts = new Map<string, number>();
  for (const e of g.notes.get(key) ?? []) for (const k of g.links.get(e.id) ?? []) if (k !== key) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts]
    .map(([k, count]) => ({ node: g.nodes.get(k)!, count, score: count * Math.sqrt(count / (g.notes.get(k)?.length || 1)) }))
    .sort((a, b) => b.score - a.score || b.count - a.count || a.node.label.localeCompare(b.node.label));
}

export interface Step { kind: NodeKind | 'memory'; picks: Rel[]; alts: Rel[]; memory?: Entry }

const THREAD: [NodeKind, number][] = [['person', 1], ['place', 1], ['month', 1], ['feeling', 2], ['music', 1], ['book', 1]];

/** The words a note is remembered by: its title, or the start of what it says. */
export function memoryLabel(e: Entry, max = 34) {
  const t = (e.title.trim() || plainText(e.text).replace(/[#>*_~=`[\]@♪]/g, '').replace(/\s+/g, ' ').trim());
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t || (e.kind === 'checkin' ? 'A check-in' : 'A note');
}

/**
 * The thread from `key`: the strongest link of each kind in turn (two feelings, since a time is rarely one), ending in
 * the note that holds most of the thread together.
 */
export function thread(g: Graph, key: string): Step[] {
  const focus = g.nodes.get(key);
  if (!focus) return [];
  const rels = related(g, key);
  const steps: Step[] = [];
  for (const [kind, n] of THREAD) {
    if (kind === focus.kind) continue;
    const of = rels.filter((r) => r.node.kind === kind);
    if (of.length) steps.push({ kind, picks: of.slice(0, n), alts: of.slice(n, n + 2) });
  }
  const on = new Set(steps.flatMap((s) => s.picks.map((r) => r.node.key)));
  const notes = g.notes.get(key) ?? [];
  const weight = (e: Entry) =>
    (g.links.get(e.id) ?? []).filter((k) => on.has(k)).length * 10 + (e.emotions.length ? e.intensity : 0) + (e.title.trim() ? 2 : 0) +
    Math.min(3, plainText(e.text).length / 400) + (e.photos.length || e.images.length ? 1 : 0) + (e.kind === 'note' ? 2 : 0);
  const best = notes.reduce<Entry | undefined>((a, e) => (!a || weight(e) > weight(a) ? e : a), undefined);
  if (best && notes.length > 1) steps.push({ kind: 'memory', picks: [], alts: [], memory: best });
  return steps;
}

export interface Phase { feeling: string; from: string; to: string; n: number }
export interface Arc { phases: Phase[]; ending: null | { kind: 'drift' | 'quiet'; label: string; since: string } }

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

/**
 * How what's felt around `key` changed: its notes in order, cut into a few stretches, each named by the feeling
 * logged most strongly in it (the same feeling twice in a row is one stretch). Ends with how it's going lately: the
 * notes coming further and further apart, or none for a long while.
 */
export function arc(g: Graph, key: string, now = Date.now()): Arc {
  const focus = g.nodes.get(key);
  const list = [...(g.notes.get(key) ?? [])].reverse(); // oldest first
  if (!focus || list.length < 2) return { phases: [], ending: null };
  const phases: Phase[] = [];
  if (focus.kind !== 'feeling') {
    const k = Math.max(2, Math.min(5, Math.round(list.length / 2)));
    for (let i = 0; i < k; i++) {
      const chunk = list.slice(Math.floor((i * list.length) / k), Math.floor(((i + 1) * list.length) / k));
      if (!chunk.length) continue;
      const w = new Map<string, number>();
      for (const e of chunk) for (const [j, id] of e.emotions.entries()) if (EMOTION[id]) w.set(id, (w.get(id) ?? 0) + (e.intensity || 3) * (j ? 0.6 : 1));
      const top = [...w].sort((a, b) => b[1] - a[1] || EMOTION[b[0]].depth - EMOTION[a[0]].depth)[0];
      if (!top) continue;
      const last = phases[phases.length - 1];
      const from = chunk[0].date, to = chunk[chunk.length - 1].date;
      if (last && last.feeling === top[0]) {
        last.to = to;
        last.n += chunk.length;
      } else phases.push({ feeling: top[0], from, to, n: chunk.length });
    }
  }
  // how the notes are spaced: days between one day written about it and the next
  const days = [...new Set(list.map((e) => e.date))].map((d) => parseKey(d).getTime());
  const gaps = days.slice(1).map((t, i) => (t - days[i]) / DAY);
  const lastDay = days[days.length - 1];
  const silence = (now - lastDay) / DAY;
  const since = list[list.length - 1].date;
  const month = (d: string) => `${monthShort(+d.slice(0, 4), +d.slice(5, 7) - 1)} ${d.slice(0, 4)}`;
  let ending: Arc['ending'] = null;
  if (focus.kind === 'month') return { phases: phases.length >= 2 ? phases : [], ending }; // a month is over anyway
  if (gaps.length >= 3) {
    const before = median(gaps.slice(0, -2));
    const lately = (gaps[gaps.length - 1] + gaps[gaps.length - 2]) / 2;
    if (lately > Math.max(14, before * 2.5)) ending = { kind: 'drift', label: focus.kind === 'person' ? 'Drifting apart' : 'Fading', since };
  }
  if (!ending && days.length >= 2 && silence > Math.max(60, median(gaps) * 4)) ending = { kind: 'quiet', label: `Quiet since ${month(since)}`, since };
  return { phases: phases.length >= 2 || ending ? phases : [], ending };
}

/** The span of a phase, as short as it can be said: "May 2025", "Mar – Jun 2025", "Nov 2024 – Feb 2025". */
export function spanLabel(from: string, to: string) {
  const [y0, m0] = [+from.slice(0, 4), +from.slice(5, 7) - 1], [y1, m1] = [+to.slice(0, 4), +to.slice(5, 7) - 1];
  if (y0 === y1 && m0 === m1) return `${monthShort(y0, m0)} ${y0}`;
  if (y0 === y1) return `${monthShort(y0, m0)} – ${monthShort(y1, m1)} ${y1}`;
  return `${monthShort(y0, m0)} ${y0} – ${monthShort(y1, m1)} ${y1}`;
}

/** Where a thread can start: the things in the most notes, of each kind. */
export function starts(g: Graph, kind: NodeKind, min = 2) {
  return [...g.nodes.values()]
    .filter((n) => n.kind === kind && (g.notes.get(n.key)?.length ?? 0) >= min)
    .sort((a, b) => g.notes.get(b.key)!.length - g.notes.get(a.key)!.length || (g.notes.get(b.key)![0].time - g.notes.get(a.key)![0].time));
}
