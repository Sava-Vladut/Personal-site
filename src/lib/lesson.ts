// Today's lesson for the bar under the date: a law of power, a principle from Win friends or a mind trap, taking turns
// day by day and going through each in order. The books are big, so only the day's one loads, once: the pick is kept
// (small) for the rest of the day.
import { DAY, parseKey } from './dates';
import { lang } from './i18n';

export interface Lesson { day: string; lang: string; kind: 'law' | 'principle' | 'trap'; title: string; line: string; to: string }

const KEY = 'mm-lesson';

/** The lesson already picked for `day`, if there is one. */
export function keptLesson(day: string): Lesson | null {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) || 'null') as Lesson | null;
    return l && l.day === day && l.lang === lang && typeof l.title === 'string' ? l : null;
  } catch {
    return null;
  }
}

export async function lessonOf(day: string): Promise<Lesson> {
  const n = Math.round(parseKey(day).getTime() / DAY);
  const turn = Math.floor(n / 3);
  let l: Lesson;
  if (n % 3 === 0) {
    const { LAWS } = await import('../data/laws');
    const x = LAWS[turn % LAWS.length];
    l = { day, lang, kind: 'law', title: x.title, line: x.line, to: `laws?open=${x.n}` };
  } else if (n % 3 === 1) {
    const { PRINCIPLES } = await import('../data/principles');
    const x = PRINCIPLES[turn % PRINCIPLES.length];
    l = { day, lang, kind: 'principle', title: x.title, line: x.line, to: `friends?open=${x.n}` };
  } else {
    const { TRAPS } = await import('../data/traps');
    const x = TRAPS[turn % TRAPS.length];
    l = { day, lang, kind: 'trap', title: x.name, line: x.line, to: `traps?open=${x.id}` };
  }
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch {}
  return l;
}
