// Robert Greene's The Art of Seduction (2001): the nine seducer types and their opposite, the Anti-Seducer; the
// eighteen kinds of victim; and the 24 moves of the seductive process in its four phases. Each with the history it came
// from, the psychology that makes it work, the mind traps it springs, the laws of power it echoes and how to see it
// coming. The content lives in seducers.ts, victims-1/2.ts and moves-1/2/3.ts. The prose is ours: only the titles are the book's.

import { lang } from '../../lib/i18n';
import { localize } from '../../lib/localize';
import type { Entry, Flock, Kind, Move, Phase, Seducer, Victim } from './types';
import { SEDUCERS as S } from './seducers';
import { VICTIMS as V1 } from './victims-1';
import { VICTIMS as V2 } from './victims-2';
import { MOVES as M1 } from './moves-1';
import { MOVES as M2 } from './moves-2';
import { MOVES as M3 } from './moves-3';

export type { Entry, Flock, Kind, Move, Phase, Seducer, Victim };

// In Romanian the text comes from a separate file that only loads then (see data/ro-learn/); the rest of each entry stays as written.
const RO = lang === 'ro' ? (await import('../ro-learn/seduction')).RO_SEDUCTION : null;
const local = <T extends Entry>(x: T): T => (RO ? localize(x, RO[x.id]) : x);

export const SEDUCERS: Seducer[] = S.map(local).sort((a, b) => a.n - b.n);
export const VICTIMS: Victim[] = [...V1, ...V2].map(local).sort((a, b) => a.n - b.n);
export const MOVES: Move[] = [...M1, ...M2, ...M3].map(local).sort((a, b) => a.n - b.n);
/** All of them, in the book's order: the seducers, the victims, then the process. */
export const ENTRIES: Entry[] = [...SEDUCERS, ...VICTIMS, ...MOVES];
export const BY_ID = new Map(ENTRIES.map((x) => [x.id, x]));

export interface GroupInfo { name: string; motto: string; hue: string; about: string }

export const PHASES: Record<Phase, GroupInfo> = {
  separate: { name: 'Separation', motto: 'Stirring interest and desire', hue: 'hope-interest', about: 'The first eight moves draw someone out of their ordinary life: you pick them, slip past their guard, become intriguing and wanted, and leave them a little restless with what they had.' },
  astray: { name: 'Leading astray', motto: 'Pleasure and confusion', hue: 'joy', about: 'Interest becomes absorption. Suspense, words, small attentions and a touch of weakness build an illusion until the rest of their world seems far away.' },
  precipice: { name: 'The precipice', motto: 'Going further, and deeper', hue: 'fear', about: 'With the bond in place, the seducer raises the stakes: proving themselves, stirring old longings and forbidden ones, lending the affair a higher meaning, and mixing the sweet with the painful.' },
  close: { name: 'Moving in', motto: 'The close, and what comes after', hue: 'love-connection', about: 'The book calls it moving in for the kill: stepping back so the other comes forward, the physical, the bold move. And then the hardest part, the aftermath.' },
};

export const FLOCKS: Record<Flock, GroupInfo> = {
  restless: { name: 'The restless', motto: 'Hungry for excitement', hue: 'anger', about: 'Bored, spoiled or tamed, they miss danger, novelty or a fight. Whoever brings back the thrill brings back their life.' },
  unseen: { name: 'The unseen', motto: 'Wanting to be seen whole', hue: 'sadness', about: 'Admired for one thing, or for nothing any more, they long for someone who notices the rest of them: the body, the mind, the person behind the role.' },
  longing: { name: 'The longing', motto: 'Hungry for an ideal, or the forbidden', hue: 'shame-aversion', about: 'Their real life feels thin beside the one they imagine: the romance, the faith, the senses, or the wildness they disapprove of in public.' },
  roles: { name: 'The role-players', motto: 'Parent or child, teacher or pupil', hue: 'calm-safety', about: 'They want a part to play, and someone to play the other half: to be led or to lead, to be looked after or to save, to stay young or to feel young again.' },
};

export interface KindInfo { name: string; icon: 'flame' | 'users' | 'spiral'; about: string }

export const KINDS: Record<Kind, KindInfo> = {
  seducer: { name: 'Seducers', icon: 'flame', about: 'Nine ways of being irresistible, and the one way of not being' },
  victim: { name: 'Victims', icon: 'users', about: 'Eighteen kinds of hunger, and who they fall for' },
  move: { name: 'The 24 moves', icon: 'spiral', about: 'The process, in its four phases, from first notice to the aftermath' },
};

/** The seducers' two groups on the page: the nine, and their opposite. */
export const SEDUCER_GROUPS: Record<'nine' | 'anti', GroupInfo> = {
  nine: { name: 'The nine seducers', motto: 'Each feeds a different hunger', hue: 'love-connection', about: 'Greene’s nine types: the qualities that have drawn people in through history, from the Siren’s spectacle to the Star’s distance. Most people have a touch of one or two already.' },
  anti: { name: 'Their opposite', motto: 'The one who repels', hue: 'shame-aversion', about: 'The Anti-Seducer: insecure, self-absorbed, unable to read anyone. Worth knowing first, because everyone plays it sometimes.' },
};

/** The group an entry sits in on the page: its phase, its flock, or the nine seducers or their opposite. */
export function groupOf(x: Entry): GroupInfo {
  if (x.kind === 'move') return PHASES[x.phase];
  if (x.kind === 'victim') return FLOCKS[x.flock];
  return SEDUCER_GROUPS[x.anti ? 'anti' : 'nine'];
}

/** The world colour an entry wears: its phase's, its flock's or the seducers'. */
export function hueOf(x: Entry): string {
  if (x.kind === 'move') return PHASES[x.phase].hue;
  if (x.kind === 'victim') return FLOCKS[x.flock].hue;
  return SEDUCER_GROUPS[x.anti ? 'anti' : 'nine'].hue;
}

/** How many of its kind there are, for "Move 3 of 24" (the Anti-Seducer stands apart from the nine). */
export const COUNT: Record<Kind, number> = { seducer: SEDUCERS.filter((x) => !x.anti).length, victim: VICTIMS.length, move: MOVES.length };

/** For each seducer type, the victims who fall for it (from the victims' own pairings), and why. */
export const DRAWS = (() => {
  const by = new Map<string, { v: Victim; how: string }[]>();
  for (const v of VICTIMS) for (const { id, how } of v.seducers) by.set(id, [...(by.get(id) ?? []), { v, how }]);
  return by;
})();
