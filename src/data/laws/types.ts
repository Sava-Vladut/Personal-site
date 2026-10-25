// The shape of one law. The laws themselves are split across part-1.ts … part-4.ts, twelve each.

/** The six arenas the laws are grouped into on the page. */
export type Realm = 'mask' | 'stage' | 'court' | 'lure' | 'war' | 'long';

export interface Law {
  /** 1–48, the law's number in the book. */
  n: number;
  id: string;
  /** The law's title, as the book words it. */
  title: string;
  realm: Realm;
  /** One line, the hook: what the law really says, in our words. */
  line: string;
  /** The law, explained plainly: what it claims and why it holds. */
  gist: string;
  /** A moment from history where it played out, retold. */
  scene: { who: string; when: string; text: string };
  /** The psychology underneath: why it works on people. */
  mind: string;
  /** The mechanisms it pulls on, each a named effect or idea from psychology. */
  levers: { name: string; text: string }[];
  /** Mind traps (ids from data/traps.ts) the law exploits, and how. */
  traps: { id: string; how: string }[];
  /** A real experiment that shows the lever at work. */
  study: { who: string; title: string; text: string };
  /** The same move today: at work, in love, online. */
  today: string[];
  /** A short modern scene where someone plays it, for the “name the move” game. Doesn't name the law. */
  scenario: string;
  /** How to tell it's being played on you. */
  signs: string[];
  /** How to get out from under it. */
  defense: string[];
  /** Where it backfires, and when the opposite is the wiser move. */
  shadow: string;
  /** The cleaner version: what's worth keeping if you don't want to be a schemer. */
  honest: string;
  /** A question to sit with. */
  question: string;
  /** 1–10: how manipulative it is. */
  dark: number;
  /** 1–10: how often it plays out in ordinary life. */
  everyday: number;
  /** Numbers of related laws (and the laws it contradicts). */
  kin: number[];
}
