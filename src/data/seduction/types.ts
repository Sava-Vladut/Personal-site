// The shape of the book's three kinds of entry: the seducers (and their opposite), the victims and the 24 moves.
// They live in seducers.ts, victims-1.ts … victims-2.ts and moves-1.ts … moves-3.ts.

export type Kind = 'seducer' | 'victim' | 'move';
/** The four phases the 24 moves are grouped into, as the book orders them. */
export type Phase = 'separate' | 'astray' | 'precipice' | 'close';
/** The four groups the eighteen victims are gathered into on the page, by what they hunger for (ours, not the book's). */
export type Flock = 'restless' | 'unseen' | 'longing' | 'roles';

interface Base {
  /** Unique across all three kinds: the link (`seduction?open=<id>`) and the mark (data/marks). */
  id: string;
  /** The entry's place in its kind, in the book's order: seducers 1–9 (the Anti-Seducer 10), victims 1–18, moves 1–24. */
  n: number;
  /** As the book words it. */
  title: string;
  /** One line, the hook: what it really is, in our words. */
  line: string;
  /** It, explained plainly: what it is and why it works. */
  gist: string;
  /** A moment from history (or from a novel the book leans on) where it played out, retold. */
  scene: { who: string; when: string; text: string };
  /** The psychology underneath: why it works on people. */
  mind: string;
  /** The mechanisms it pulls on, each a named effect or idea from psychology. */
  levers: { name: string; text: string }[];
  /** Mind traps (ids from data/traps.ts) it springs or leans on, and how. */
  traps: { id: string; how: string }[];
  /** Laws of power (numbers from data/laws) it echoes, and how. */
  laws: { n: number; how: string }[];
  /** A real experiment that shows the lever at work. */
  study: { who: string; title: string; text: string };
  /** The same thing today: in dating, at work, online, in marketing. */
  today: string[];
  /** A short modern scene for the “name it” game. Doesn't name the entry. */
  scenario: string;
  /** A move or a seducer: how to tell it's being played on you. A victim: how to recognise the type. The Anti-Seducer: signs it's you. */
  signs: string[];
  /** A move or a seducer: how to keep your head. A victim: if this is you. The Anti-Seducer: the cure. */
  defense: string[];
  /** Where it goes wrong: the type's dangers, the move's backfire, the way a victim's hunger gets used against them. */
  shadow: string;
  /** The version worth keeping, without the manipulation (for a victim: what would really meet the need). */
  honest: string;
  /** A question to sit with. */
  question: string;
  /** 1–10: how manipulative it is (a victim: how easily the hunger is played on). */
  dark: number;
  /** 1–10: how often you meet it in ordinary life. */
  everyday: number;
  /** Ids of related entries, of any kind. */
  kin: string[];
}

export interface Seducer extends Base {
  kind: 'seducer';
  /** The Anti-Seducer, the type who repels. */
  anti?: boolean;
  /** What the type offers that ordinary life withholds: the hunger it feeds. */
  offers: string;
  /** The type's faces as the book draws them: its varieties or its hallmarks (the Natural's kinds of child, the Charismatic's qualities, the Anti-Seducer's kinds). */
  faces: { name: string; text: string }[];
}

export interface Victim extends Base {
  kind: 'victim';
  flock: Flock;
  /** What's missing in their life: the gap a seducer steps into. */
  lack: string;
  /** Ids of the seducer types who suit them best, and why. */
  seducers: { id: string; how: string }[];
}

export interface Move extends Base {
  kind: 'move';
  phase: Phase;
}

export type Entry = Seducer | Victim | Move;
