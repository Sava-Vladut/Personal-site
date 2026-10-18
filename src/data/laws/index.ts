// Robert Greene's 48 Laws of Power (1998), each with the history it came from, the psychology that makes it
// work, the mind traps it springs, and how to see it coming. The laws' content lives in part-1 … part-4.
// The prose is ours: only the laws' titles are the book's.

import type { Law, Realm } from './types';
import { LAWS as P1 } from './part-1';
import { LAWS as P2 } from './part-2';
import { LAWS as P3 } from './part-3';
import { LAWS as P4 } from './part-4';

export type { Law, Realm };

export const LAWS: Law[] = [...P1, ...P2, ...P3, ...P4].sort((a, b) => a.n - b.n);

export interface RealmInfo { name: string; motto: string; hue: string; about: string }

export const REALMS: Record<Realm, RealmInfo> = {
  mask: { name: 'The mask', motto: 'What you let them see', hue: 'fear', about: 'Concealment and misdirection. Whoever reveals less keeps more of their options, and other people fill the silence with their own guesses.' },
  stage: { name: 'The stage', motto: 'How you’re seen', hue: 'joy', about: 'Reputation, presence and image. People react to the story about you long before they meet the person.' },
  court: { name: 'The court', motto: 'Above you and beside you', hue: 'sadness', about: 'Bosses, allies and rivals. Most power is borrowed from people who can take it back, so you read them before you move.' },
  lure: { name: 'The lure', motto: 'Moving other people', hue: 'love-connection', about: 'Desire, belief and self-interest. People are hard to push and easy to draw, if you know what they already want.' },
  war: { name: 'The war', motto: 'When it comes to a fight', hue: 'anger', about: 'Open conflict: when to strike, how hard, and when to stop. The laws of the battlefield, applied to offices and families.' },
  long: { name: 'The long game', motto: 'Time, patience and form', hue: 'calm-safety', about: 'Timing, dependence and adaptability. The quiet laws, about outlasting rather than overpowering.' },
};

const NUMERALS: [number, string][] = [[40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
/** 1–48 in Roman numerals. */
export function roman(n: number) {
  let out = '';
  for (const [v, s] of NUMERALS) while (n >= v) { out += s; n -= v; }
  return out;
}
