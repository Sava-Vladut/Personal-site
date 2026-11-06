// Ready-made plans for a first visit, each one tap from being yours: the classic push, pull and legs split, and one with
// nothing but your body. Made of the database's exercises, with sets to aim for and a target worked out from them.
import { suggestTarget, type Item, type Move, type Routine } from '../../lib/fitness';
import { uid } from '../../lib/store';
import { t } from '../../lib/i18n';
import { itemOf } from './shared';

/** An exercise in a starter: its database id, how many sets, the reps (seconds for a hold) and the kilograms, if any. */
type Line = [id: string, sets: number, reps: number, kg?: number];
interface Starter { name: string; icon: Routine['icon']; lines: Line[] }

const STARTERS: Starter[] = [
  { name: t('Push day'), icon: 'barbell', lines: [['Barbell_Bench_Press_-_Medium_Grip', 3, 8, 40], ['Standing_Military_Press', 3, 8, 25], ['Dips_-_Triceps_Version', 3, 10], ['Triceps_Pushdown', 3, 12, 20]] },
  { name: t('Pull day'), icon: 'dumbbell', lines: [['Pullups', 3, 6], ['Bent_Over_Barbell_Row', 3, 8, 40], ['Seated_Cable_Rows', 3, 10, 35], ['Barbell_Curl', 3, 10, 20]] },
  { name: t('Leg day'), icon: 'stairs-up', lines: [['Barbell_Squat', 3, 8, 50], ['Romanian_Deadlift', 3, 8, 40], ['Dumbbell_Lunges', 3, 10, 10], ['Standing_Calf_Raises', 3, 12, 40]] },
  { name: t('Body only'), icon: 'gymnastics', lines: [['Pushups', 3, 12], ['Bodyweight_Squat', 3, 15], ['Plank', 3, 45], ['mm_Burpee', 3, 10]] },
];

/** The starters as plans, at your weight (each with a fresh id: adding one makes it yours). Empty until the database is in. */
export function starterPlans(byId: Map<string, Move>, bw: number): Routine[] {
  const now = Date.now();
  return STARTERS.flatMap((s) => {
    const items: Item[] = s.lines.flatMap(([id, n, reps, kg]) => {
      const m = byId.get(id);
      if (!m) return [];
      const hold = m.kind === 'time';
      const sets = Array.from({ length: n }, () => ({ kg: kg ?? null, reps: hold ? null : reps, secs: hold ? reps : null, km: null, tag: '' as const, done: false }));
      return [{ ...itemOf(m, undefined, false), sets }];
    });
    if (!items.length) return [];
    return [{ id: uid(), name: s.name, icon: s.icon, target: suggestTarget({ items }, bw), items, created: now, updated: now }];
  });
}
