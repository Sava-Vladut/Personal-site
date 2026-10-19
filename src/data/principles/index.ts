// Dale Carnegie's How to Win Friends and Influence People (1936): its thirty principles, each with the story
// behind it, the psychology that makes it work, the mind traps it disarms, the laws of power it answers, and how
// to practise it. The principles' content lives in part-1 … part-3. The prose is ours: only the titles are the book's.

import { lang } from '../../lib/i18n';
import { localize } from '../../lib/localize';
import type { Part, Principle } from './types';
import { PRINCIPLES as P1 } from './part-1';
import { PRINCIPLES as P2 } from './part-2';
import { PRINCIPLES as P3 } from './part-3';

export type { Part, Principle };

const ENGLISH: Principle[] = [...P1, ...P2, ...P3].sort((a, b) => a.n - b.n);

// In Romanian the text comes from a separate file that only loads then (see data/ro-learn/); the rest of each principle stays as written.
const RO = lang === 'ro' ? (await import('../ro-learn/principles')).RO_PRINCIPLES : null;
export const PRINCIPLES: Principle[] = RO ? ENGLISH.map((x) => localize(x, RO[x.n])) : ENGLISH;

export interface PartInfo { name: string; motto: string; hue: string; about: string }

export const PARTS: Record<Part, PartInfo> = {
  handling: { name: 'Handling people', motto: 'The fundamentals', hue: 'calm-safety', about: 'Three rules underneath all the rest: drop the criticism, give real appreciation, and start from what the other person wants.' },
  liked: { name: 'Being liked', motto: 'Six ways to warmth', hue: 'joy', about: 'Interest, a smile, their name, a good ear. Small habits that make people glad to see you, because you were glad to see them.' },
  convince: { name: 'Winning agreement', motto: 'Bringing people round', hue: 'hope-interest', about: 'How to change a mind without a fight: avoid the argument, admit your own mistakes, and let the other person find the idea.' },
  lead: { name: 'Leading', motto: 'Changing people without offence', hue: 'love-connection', about: 'Correcting, asking and encouraging so people improve and still like you afterwards. Leadership as making it easy to do better.' },
};
