// The shape of one principle. The principles themselves are split across part-1.ts … part-3.ts.

/** The book's four parts, which the principles are grouped into on the page. */
export type Part = 'handling' | 'liked' | 'convince' | 'lead';

export interface Principle {
  /** 1–30, the principle's number in the book's order. */
  n: number;
  id: string;
  /** The principle, as the book words it. */
  title: string;
  part: Part;
  /** One line, the hook: what the principle really asks of you, in our words. */
  line: string;
  /** The principle, explained plainly: what Carnegie claims and why he thinks it works. */
  gist: string;
  /** A story from the book (or from history) where it played out, retold in our words. */
  story: { who: string; when: string; text: string };
  /** The psychology underneath: why it works on people. */
  mind: string;
  /** The mechanisms it pulls on, each a named effect or idea from psychology. */
  levers: { name: string; text: string }[];
  /** Mind traps (ids from data/traps.ts) it disarms or works with, and how. */
  traps: { id: string; how: string }[];
  /** Laws of power (numbers from data/laws) it echoes or turns on their head, and how. */
  laws: { n: number; how: string }[];
  /** A real experiment that backs it up (or complicates it). */
  study: { who: string; title: string; text: string };
  /** The same principle today: at work, in love, online. */
  today: string[];
  /** A short modern scene where someone uses it well, for the “name the principle” game. Doesn't name it. */
  scenario: string;
  /** Small, concrete things to try this week. */
  practice: string[];
  /** The ways people get it wrong: the slips that undo it. */
  slips: string[];
  /** Where it turns into flattery or manipulation, and when the opposite is wiser. */
  shadow: string;
  /** The sincere version: what it looks like done from real goodwill. */
  honest: string;
  /** A question to sit with. */
  question: string;
  /** 1–10: how hard it is to actually do. */
  hard: number;
  /** 1–10: how often it comes up in ordinary life. */
  everyday: number;
  /** Numbers of related principles. */
  kin: number[];
}
