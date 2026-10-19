// The Romanian text of the Learn pages. Each entry mirrors the English one but holds only the words to translate:
// ids, numbers, families, parts and every other non-text field stay as they are in the English data and aren't repeated here.
// Arrays keep the English length and order (a quiz's options keep their order, so the right answer stays the same).

export interface StudyRo { who: string; title: string; text: string }

/** One mind trap (data/traps.ts), keyed by its id. */
export interface TrapRo {
  name: string;
  aka?: string;
  line: string;
  tell: string;
  what: string;
  why: string;
  study: StudyRo;
  life: string[];
  escape: string[];
  fact: string;
  test?: { q: string; options: string[]; reveal: string };
}

/** One law of power (data/laws), keyed by its number. */
export interface LawRo {
  title: string;
  line: string;
  gist: string;
  scene: { who: string; when: string; text: string };
  mind: string;
  levers: { name: string; text: string }[];
  traps: { how: string }[];
  study: StudyRo;
  today: string[];
  scenario: string;
  signs: string[];
  defense: string[];
  shadow: string;
  honest: string;
  question: string;
}

/** One of Carnegie's principles (data/principles), keyed by its number. */
export interface PrincipleRo {
  title: string;
  line: string;
  gist: string;
  story: { who: string; when: string; text: string };
  mind: string;
  levers: { name: string; text: string }[];
  traps: { how: string }[];
  laws: { how: string }[];
  study: StudyRo;
  today: string[];
  scenario: string;
  practice: string[];
  slips: string[];
  shadow: string;
  honest: string;
  question: string;
}

/** The three "gut answer" questions at the end of data/traps.ts, in order. */
export interface ReflectRo { q: string; options: string[]; why: string }
