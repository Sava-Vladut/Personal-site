// What the Workout page (views/Workout.tsx) and its Insights page (views/Training.tsx) share: the icon and name of each
// muscle, piece of equipment and kind of exercise, and how power (⚡) is shown. The body drawings are in BodyMap.tsx.
import type { Cat, Equip, Kind, Muscle, Tag } from '../lib/fitness';
import { fmtPower } from '../lib/fitness';
import { t } from '../lib/i18n';
import { Icon, type UiName } from './icons';
import '../styles/fitness.css';

export const MUSCLE_NAME: Record<Muscle, string> = {
  neck: t('Neck'), traps: t('Trapezius'), shoulders: t('Shoulders'), chest: t('Chest'), biceps: t('Biceps'), triceps: t('Triceps'),
  forearms: t('Forearms'), lats: t('Lats'), 'middle back': t('Middle back'), 'lower back': t('Lower back'), abdominals: t('Abs'),
  glutes: t('Glutes'), abductors: t('Outer thighs'), adductors: t('Inner thighs'), quadriceps: t('Quads'), hamstrings: t('Hamstrings'),
  calves: t('Calves'),
};

/** The broad groups the muscles fall into, for summaries and balance. */
export const MUSCLE_GROUP: Record<Muscle, 'push' | 'pull' | 'legs' | 'core'> = {
  chest: 'push', shoulders: 'push', triceps: 'push',
  lats: 'pull', 'middle back': 'pull', traps: 'pull', biceps: 'pull', forearms: 'pull', neck: 'pull',
  quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', abductors: 'legs', adductors: 'legs',
  abdominals: 'core', 'lower back': 'core',
};
export const GROUP_NAME = { push: t('Pushing'), pull: t('Pulling'), legs: t('Legs'), core: t('Core') };

export const EQUIP_ICON: Record<Equip, UiName> = {
  body: 'body-scan', barbell: 'barbell', dumbbell: 'dumbbell', kettlebell: 'weight', machine: 'stack-2', cable: 'arrows-up-down',
  bands: 'wave-sine', ezbar: 'barbell', medball: 'ball-volleyball', ball: 'ball-bowling', foam: 'cylinder', other: 'dots',
};
export const EQUIP_NAME: Record<Equip, string> = {
  body: t('Body weight'), barbell: t('Barbell'), dumbbell: t('Dumbbells'), kettlebell: t('Kettlebell'), machine: t('Machine'),
  cable: t('Cable'), bands: t('Bands'), ezbar: t('EZ bar'), medball: t('Medicine ball'), ball: t('Exercise ball'),
  foam: t('Foam roller'), other: t('Other'),
};

export const KIND_ICON: Record<Kind, UiName> = { weight: 'barbell', body: 'body-scan', time: 'stopwatch', cardio: 'run' };
export const KIND_NAME: Record<Kind, string> = { weight: t('Weights'), body: t('Body moves'), time: t('Holds and stretches'), cardio: t('Cardio') };

export const CAT_NAME: Record<Cat, string> = {
  strength: t('Strength'), powerlifting: t('Powerlifting'), olympic: t('Olympic lifting'), strongman: t('Strongman'),
  plyometrics: t('Plyometrics'), cardio: t('Cardio'), stretching: t('Stretching'),
};

/** A set's kind, as the short mark on its row: a number for a normal set, W, D or F. */
export const TAG_MARK: Record<Exclude<Tag, ''>, string> = { warm: t('W'), drop: t('D'), fail: t('F') };
export const TAG_NAME: Record<Tag, string> = { '': t('Normal set'), warm: t('Warm-up (counts half)'), drop: t('Drop set'), fail: t('To failure') };

/** How a workout went, 1 to 5 (index 0 is "not said"): a face and its word. */
export const FEELS: [UiName, string][] = [
  ['mood-neutral', ''], ['mood-cry', t('Awful')], ['mood-sad', t('Hard')], ['mood-neutral', t('Okay')], ['mood-smile', t('Good')], ['mood-happy', t('Great')],
];

/** Power as the page shows it: the bolt and the number. */
export function Power({ value, size = 14, class: cls }: { value: number; size?: number; class?: string }) {
  return (
    <span class={`power${cls ? ' ' + cls : ''}`}>
      <Icon name="bolt" size={size} />
      <span class="power-n">{fmtPower(value)}</span>
    </span>
  );
}
