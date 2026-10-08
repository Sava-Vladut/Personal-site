// Reads the last seven weeks of the journal as a brain: each emotion world lives in a region, glows with how much it was
// felt (recent days count more, the way memories fade), and a few findings from psychology are checked against what was written.
import { EMOTION, coreOf, shortName, valence } from '../data/emotions';
import { addDays, diffDays, keyOf, shortDate, todayKey } from './dates';
import { plainText } from './body';
import { count, listOf, t } from './i18n';
import { dex, moodOf, pct, streaks } from './stats';
import type { Entry } from './store';

export const SPAN = 49; // seven weeks
const HALF_LIFE = 21;   // days until a day counts half as much

/** Where each world lives in the brain, and what that part does. */
export const ZONES: Record<string, { name: string; role: string }> = {
  'hope-interest': { name: t('Prefrontal cortex'), role: t('The planner. It holds goals in mind, weighs what comes next and turns curiosity into action.') },
  joy: { name: t('Nucleus accumbens'), role: t('The reward hub. Dopamine here makes good things worth repeating, and the wanting often feels better than the having.') },
  'love-connection': { name: t('Temporal lobe'), role: t('The social brain. It reads faces, voices and intentions, and it files away the people who matter to you.') },
  'calm-safety': { name: t('Brainstem and vagus nerve'), role: t('The brake pedal. The vagus nerve slows your heart and tells the body it is safe to rest.') },
  sadness: { name: t('Subgenual cingulate'), role: t('A deep, slow hub for low mood and loss. Sadness is the brain slowing down to take in something that mattered.') },
  fear: { name: t('Amygdala'), role: t('The smoke detector. It flags danger in a fraction of a second, before you have had time to think, and errs on the side of caution on purpose.') },
  anger: { name: t('Hypothalamus'), role: t('The body’s alarm panel. It turns a perceived wrong or threat into heat, heartbeat and hormones.') },
  'shame-aversion': { name: t('Insula'), role: t('Where the body’s signals become feelings. It fires for disgust, for the sting of social pain and for the urge to look away.') },
};

const TITLE: Record<string, string> = {
  joy: t('Bright and buzzing'),
  'hope-interest': t('Curious and reaching'),
  'love-connection': t('Warm and connected'),
  'calm-safety': t('Settled and steady'),
  sadness: t('Heavy, and processing'),
  fear: t('On alert'),
  anger: t('Running hot'),
  'shame-aversion': t('Turned inward'),
};

export interface Region {
  world: string;
  /** 0 (quiet) to 1 (lit up): how much of the recent feeling lives here. */
  level: number;
  /** Word for the level: Quiet, Faint, Present, Busy, Dominant. */
  word: string;
  /** Feelings named from this world, and on how many days. */
  feelings: number;
  days: number;
  /** The exact feeling named most. */
  top: string | null;
}

export interface Note { id: string; title: string; text: string; core?: string; weight: number }

export interface Day { date: string; mood: number | null; n: number }

export interface BrainState {
  entries: number;
  activeDays: number;
  longestRun: number;
  named: number;
  words: number;
  lead: string | null;
  regions: Record<string, Region>;
  /** How awake the whole brain is, 0–1: the share of the 49 days with something written. */
  alive: number;
  /** How hard the feelings hit, 0–1, from their intensity. */
  force: number;
  title: string;
  sub: string;
  days: Day[];
  /** The brightest and heaviest weeks, when there is enough to tell. */
  arc: { high: { start: string; mood: number }; low: { start: string; mood: number } } | null;
  notes: Note[];
}

const label = (id: string) => (EMOTION[id].depth === 0 ? shortName(id) : EMOTION[id].name);
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function levelWord(share: number) {
  return share >= 0.3 ? t('Dominant') : share >= 0.15 ? t('Busy') : share >= 0.05 ? t('Present') : share > 0 ? t('Faint') : t('Quiet');
}

export function readBrain(all: Entry[]): BrainState {
  const today = todayKey();
  const start = addDays(today, -(SPAN - 1));
  const list = all.filter((e) => e.date >= start && e.date <= today);
  const felt = list.filter((e) => e.emotions.length && e.emotions.every((id) => EMOTION[id]));

  /* how much each world lit up: a main feeling counts its full intensity, the others half, and older days fade */
  const weight = new Map<string, number>();
  const seen = new Map<string, { n: number; days: Set<string>; ids: Map<string, number> }>();
  for (const e of felt) {
    const fade = Math.pow(0.5, Math.max(0, diffDays(e.date, today)) / HALF_LIFE);
    e.emotions.forEach((id, i) => {
      const w = coreOf(id).id;
      weight.set(w, (weight.get(w) ?? 0) + e.intensity * (i ? 0.5 : 1) * fade);
      const s = seen.get(w) ?? { n: 0, days: new Set<string>(), ids: new Map<string, number>() };
      s.n++;
      s.days.add(e.date);
      s.ids.set(id, (s.ids.get(id) ?? 0) + 1);
      seen.set(w, s);
    });
  }
  const total = [...weight.values()].reduce((a, b) => a + b, 0);
  const peak = Math.max(0, ...weight.values());
  const regions: Record<string, Region> = {};
  for (const world of Object.keys(ZONES)) {
    const share = total ? (weight.get(world) ?? 0) / total : 0;
    const s = seen.get(world);
    regions[world] = {
      world, word: levelWord(share), feelings: s?.n ?? 0, days: s?.days.size ?? 0,
      level: share > 0 ? Math.min(1, 0.2 + 0.8 * Math.pow(share / (peak / total), 0.85)) : 0,
      top: s ? [...s.ids].sort((a, b) => b[1] - a[1])[0][0] : null,
    };
  }
  const lead = total ? [...weight].sort((a, b) => b[1] - a[1])[0][0] : null;

  /* day by day, and week by week */
  const byDay = new Map<string, Entry[]>();
  for (const e of list) (byDay.get(e.date) ?? byDay.set(e.date, []).get(e.date)!).push(e);
  const days: Day[] = Array.from({ length: SPAN }, (_, i) => {
    const date = addDays(start, i);
    const es = byDay.get(date) ?? [];
    return { date, n: es.length, mood: mean(es.map(moodOf).filter((m): m is number => m !== null)) };
  });
  const moodsOf = (from: number, to: number) => days.slice(from, to).flatMap((d) => (byDay.get(d.date) ?? []).map(moodOf)).filter((m): m is number => m !== null);
  const recent = moodsOf(SPAN - 21, SPAN), earlier = moodsOf(0, SPAN - 21);
  const weeks = Array.from({ length: 7 }, (_, w) => ({ start: days[w * 7].date, moods: moodsOf(w * 7, w * 7 + 7) })).filter((w) => w.moods.length >= 2);
  const weekMood = weeks.map((w) => ({ start: w.start, mood: mean(w.moods)! }));
  const high = weekMood.reduce((a, b) => (b.mood > a.mood ? b : a), weekMood[0]);
  const low = weekMood.reduce((a, b) => (b.mood < a.mood ? b : a), weekMood[0]);
  const arc = weekMood.length >= 3 && high.mood - low.mood >= 0.6 ? { high, low } : null;

  const activeDays = byDay.size;
  const alive = activeDays / SPAN;
  const force = felt.length ? felt.reduce((s, e) => s + e.intensity, 0) / felt.length / 5 : 0;

  let sub: string;
  if (!list.length) sub = t('Nothing in the last 7 weeks yet. Write a note or check in and it wakes up.');
  else if (recent.length < 3 || earlier.length < 3) sub = t('Still learning your patterns. A few more entries sharpen the picture.');
  else {
    const d = mean(recent)! - mean(earlier)!;
    sub = d >= 0.6 ? t('Lighter lately than it was earlier in these 7 weeks.') : d <= -0.6 ? t('Heavier lately than it was earlier in these 7 weeks.') : t('Steady across these 7 weeks.');
  }

  return {
    entries: list.length, activeDays, longestRun: streaks(list).longest,
    named: new Set(felt.flatMap((e) => e.emotions).filter((id) => EMOTION[id].depth === 2)).size,
    words: list.reduce((s, e) => s + wordCount(plainText(e.text)), 0),
    lead, regions, alive, force,
    title: lead ? TITLE[lead] : list.length ? t('Quiet') : t('Asleep'),
    sub, days, arc,
    notes: list.length ? notesFor(all, list, felt, start) : [],
  };
}

/** What psychology would say about this stretch, checked against what was written. Strongest first. */
function notesFor(all: Entry[], list: Entry[], felt: Entry[], start: string): Note[] {
  const out: Note[] = [];
  const add = (id: string, weight: number, title: string, text: string, core?: string) => out.push({ id, weight, title, text, core });

  /* affect labelling: putting a feeling into words calms the amygdala */
  const heavy = felt.filter((e) => (moodOf(e) ?? 0) < 0);
  if (heavy.length >= 2) {
    const spoken = heavy.filter((e) => wordCount(plainText(e.text)) >= 8).length;
    add('label', 85, t('Naming it tames it'),
      spoken
        ? t('{a} of your {b} heavy entries came with words. Putting a feeling into words calms the amygdala, a finding called affect labelling (Lieberman, 2007).', { a: spoken, b: heavy.length })
        : t('None of your {b} heavy entries came with words. Even one sentence about a feeling calms the amygdala; it is called affect labelling (Lieberman, 2007).', { b: heavy.length }),
      'fear');
  }

  /* rumination: the same unpleasant feeling returning inside a week */
  const days = new Map<string, string[]>();
  for (const e of felt) for (const id of new Set(e.emotions)) if (valence(id) < 0) (days.get(id) ?? days.set(id, []).get(id)!).push(e.date);
  let loop: { id: string; n: number } | null = null;
  for (const [id, ds] of days) {
    const sorted = [...new Set(ds)].sort();
    for (let i = 0, j = 0; i < sorted.length; i++) {
      while (diffDays(sorted[j], sorted[i]) > 6) j++;
      if (i - j + 1 >= 4 && (!loop || i - j + 1 > loop.n)) loop = { id, n: i - j + 1 };
    }
  }
  if (loop)
    add('loop', 90, t('A loop in the default network'),
      t('{feeling} came back on {n} days within one week. Going over the same thought keeps the brain’s default-mode network spinning; writing down a next step, or walking, is a known way out.', { feeling: label(loop.id), n: loop.n }),
      EMOTION[loop.id].core);
  else if (heavy.length >= 3)
    add('noloop', 40, t('Nothing stuck'), t('No unpleasant feeling came back on four days of one week. Your brain is letting things go.'), 'calm-safety');

  /* peak-end rule */
  if (felt.length >= 2) {
    const strength = (e: Entry) => Math.abs(moodOf(e) ?? 0);
    const peak = felt.reduce((a, b) => (strength(b) >= strength(a) ? b : a));
    const end = felt.reduce((a, b) => (b.time >= a.time ? b : a));
    const name = (e: Entry) => `${label(e.emotions[0])}, ${shortDate(e.date)}`;
    add('peakend', 80, t('The peak–end rule'),
      peak.id === end.id
        ? t('Your latest entry is also the most intense of the 7 weeks: {moment}. Memory keeps the peak and the end of a stretch far more than its average.', { moment: name(peak) })
        : t('You will probably remember these 7 weeks by their peak ({peak}) and their end ({end}). Memory keeps those two moments far more than the average (Kahneman).', { peak: name(peak), end: name(end) }),
      coreOf(peak.emotions[0]).id);
  }

  /* emotional granularity */
  const fine = new Set(felt.flatMap((e) => e.emotions).filter((id) => EMOTION[id].depth === 2));
  if (felt.length >= 3) {
    const n = fine.size;
    add('granularity', 70, t('Emotional granularity'),
      n >= 10 ? t('You used {n} different exact feelings. People who name feelings this precisely tend to cope with them better (Lisa Feldman Barrett).', { n })
      : n >= 4 ? t('You used {n} different exact feelings. The more exact the word, the less a feeling has to shout; the finer ones in the wheel are worth trying.', { n })
      : t('Exact feelings you named: {n}. A broad “good” or “bad” gives the brain little to work with; an exact word gives it something to act on.', { n }));
  }

  /* sleep and the amygdala */
  const timed = list.filter((e) => keyOf(new Date(e.time)) === e.date);
  const late = timed.filter((e) => { const h = new Date(e.time).getHours(); return h >= 23 || h < 5; });
  if (late.length >= 3 && late.length / timed.length >= 0.15) {
    const a = mean(late.map(moodOf).filter((m): m is number => m !== null)), b = mean(timed.filter((e) => !late.includes(e)).map(moodOf).filter((m): m is number => m !== null));
    add('night', 75, t('The night shift'),
      a !== null && b !== null && a < b - 0.5
        ? t('{entries} came after 11 pm, and they run heavier ({a}) than the rest ({b}). A tired amygdala reacts about 60% more strongly (Walker, 2007).', { entries: count(late.length, 'entry', 'entries'), a: a.toFixed(1), b: b.toFixed(1) })
        : t('{entries} came after 11 pm. A tired amygdala reacts about 60% more strongly (Walker, 2007), so late feelings can be louder than they are by day.', { entries: count(late.length, 'entry', 'entries') }),
      'fear');
  }

  /* mixed feelings */
  const mixed = felt.filter((e) => e.emotions.some((id) => valence(id) > 0) && e.emotions.some((id) => valence(id) < 0)).length;
  if (mixed >= 2)
    add('mixed', 60, t('Bittersweet'), t('{entries} held pleasant and unpleasant feelings together. That is normal, and people who feel a wider palette tend to report better health (Quoidbach, 2014).', { entries: count(mixed, 'entry', 'entries') }), 'love-connection');

  /* neuroplasticity: feelings named for the first time */
  const known = dex(all.filter((e) => e.date < start));
  const fresh = [...fine].filter((id) => !known.has(id));
  if (fresh.length && known.size)
    add('fresh', 65, t('New pathways'),
      t('{n} you had never named before: {list}. A new word for a feeling builds a new category, and the brain learns by building them (Barrett).', { n: count(fresh.length, 'feeling', 'feelings'), list: listOf(fresh.slice(0, 3).map(label)) + (fresh.length > 3 ? '…' : '') }),
      EMOTION[fresh[0]].core);

  /* negativity bias */
  const occ = felt.flatMap((e) => e.emotions);
  if (occ.length >= 6) {
    const p = occ.filter((id) => valence(id) > 0).length / occ.length;
    add('bias', 55, t('The negativity bias'),
      p >= 0.55 ? t('The brain counts a bad moment more heavily than a good one. {share} of what you felt was pleasant, so you are tilting the scale back.', { share: pct(p) })
      : t('The brain counts a bad moment more heavily than a good one, so a heavy stretch feels heavier than it looks. {share} of what you felt was pleasant; noting small good moments rebalances it.', { share: pct(p) }),
      p >= 0.55 ? 'joy' : 'sadness');
  }

  /* the social brain */
  const people = new Set(list.flatMap((e) => e.people)).size;
  if (people)
    add('social', 50, t('The social brain'), t('{n} came up in your notes. Close relationships are the strongest predictor of a good later life in the Harvard Study of Adult Development.', { n: count(people, 'person', 'people') }), 'love-connection');

  /* habit loops */
  const run = streaks(list).longest;
  const active = new Set(list.map((e) => e.date)).size;
  add('habit', 45, t('Habit loop'),
    t('You showed up on {days} of 49 days, with a longest run of {run}. A new habit takes about 66 days on average to feel automatic (Lally, 2009); the basal ganglia are still learning.', { days: active, run }),
    'hope-interest');

  return out.sort((a, b) => b.weight - a.weight);
}

/** A sentence about one region, for when it is tapped. */
export function regionLine(r: Region): string {
  if (!r.feelings) return t('Quiet for 7 weeks. Nothing you wrote lives here.');
  return t('{word}: {feelings} across {days}. Named most: {top}.', {
    word: r.word, feelings: count(r.feelings, 'feeling', 'feelings'), days: count(r.days, 'day', 'days'), top: r.top ? label(r.top) : '—',
  });
}
