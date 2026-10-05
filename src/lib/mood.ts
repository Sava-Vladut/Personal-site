// The feeling of a whole day, from its check-ins and notes: which worlds it leaned toward and how it went.
import { coreOf, shortName } from '../data/emotions';
import type { Entry } from './store';

/** How a day reads when one world fills most of it. */
const DAY_WORD: Record<string, string> = {
  joy: 'A bright day',
  'hope-interest': 'A hopeful day',
  'love-connection': 'A tender day',
  'calm-safety': 'A calm day',
  sadness: 'A heavy day',
  fear: 'An uneasy day',
  anger: 'A tense day',
  'shame-aversion': 'A raw day',
};

export interface DayMood {
  /** Worlds by how much of the day they took, most first. */
  worlds: string[];
  /** "A calm day", or "Anger, then joy" when it moved from one to another. */
  word: string;
  /** The day's colours at the hours they were felt, as a CSS gradient. */
  ribbon: string;
}

const hourOf = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() + d.getMinutes() / 60;
};

/** A main feeling counts its full strength, the others half of it. */
export function dayMood(list: Entry[]): DayMood | null {
  const felt = list.filter((e) => e.emotions.length && coreOf(e.emotions[0])).sort((a, b) => a.time - b.time);
  if (!felt.length) return null;
  const weight = new Map<string, number>();
  for (const e of felt) {
    e.emotions.forEach((id, i) => {
      const c = coreOf(id)?.id;
      if (c) weight.set(c, (weight.get(c) ?? 0) + e.intensity * (i ? 0.5 : 1));
    });
  }
  const total = [...weight.values()].reduce((a, b) => a + b, 0);
  const worlds = [...weight.keys()].sort((a, b) => weight.get(b)! - weight.get(a)!);
  const first = coreOf(felt[0].emotions[0]).id, last = coreOf(felt[felt.length - 1].emotions[0]).id;

  let word = DAY_WORD[worlds[0]] ?? '';
  if (worlds.length > 1 && weight.get(worlds[0])! / total < 0.55) {
    word = first !== last
      ? `${shortName(first)}, then ${shortName(last).toLowerCase()}`
      : `${shortName(worlds[0])} and ${shortName(worlds[1]).toLowerCase()}`;
  }

  const at = felt.map((e) => [coreOf(e.emotions[0]).id, Math.round((hourOf(e.time) / 24) * 100)] as const);
  const stops = at.map(([c, p]) => `var(--emo-${c}) ${p}%`);
  const ribbon = `linear-gradient(90deg, transparent ${Math.max(0, at[0][1] - 14)}%, ${stops.join(', ')}, transparent ${Math.min(100, at[at.length - 1][1] + 14)}%)`;
  return { worlds, word, ribbon };
}
