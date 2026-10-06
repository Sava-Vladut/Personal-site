// What the journal's wheel holds: categories around the middle, what's in them around those.
// A category can hold categories of its own; tapping one zooms in so it fills the wheel.
// A node with no children is a place to go (`to`, a route) or a thing the page does (`run`).
import type { UiName } from '../components/icons';
import { t } from '../lib/i18n';

export interface WheelNode {
  id: string;
  name: string;
  /** One line about it, under the wheel. */
  sub: string;
  icon: UiName;
  /** The emotion world whose colour it wears; children take their category's. */
  hue?: string;
  to?: string;
  /** An action the page that holds the wheel provides, like opening its search. */
  run?: string;
  kids?: WheelNode[];
}

export const WHEEL: WheelNode[] = [
  {
    id: 'look-back', name: t('Look back'), sub: t('Find a day, a word or a place'), icon: 'clock', hue: 'calm-safety',
    kids: [
      { id: 'search', name: t('Search'), sub: t('Notes, feelings, people, songs and books'), icon: 'search', run: 'search' },
      { id: 'calendar', name: t('Calendar'), sub: t('Your days, month by month'), icon: 'calendar', run: 'calendar' },
      { id: 'map', name: t('Map'), sub: t('Where you’ve been, as a heatmap'), icon: 'map', to: 'map' },
    ],
  },
  {
    id: 'insights', name: t('Insights'), sub: t('What your feelings add up to'), icon: 'chart-dots', hue: 'hope-interest',
    kids: [
      { id: 'overview', name: t('Overview'), sub: t('The shape of the last while'), icon: 'chart-bar', to: 'stats?tab=overview' },
      { id: 'emotions', name: t('Emotions'), sub: t('Which worlds you spend time in'), icon: 'chart-pie', to: 'stats?tab=emotions' },
      { id: 'patterns', name: t('Patterns'), sub: t('What tends to come together'), icon: 'chart-donut-2', to: 'stats?tab=patterns' },
      { id: 'weather', name: t('Weather'), sub: t('How the sky and your mood line up'), icon: 'cloud', to: 'stats?tab=weather' },
      { id: 'dex', name: t('Dex'), sub: t('Every feeling you have named'), icon: 'trophy', to: 'stats?tab=dex' },
    ],
  },
  {
    id: 'you', name: t('You'), sub: t('Check in, write, think'), icon: 'heart', hue: 'love-connection',
    kids: [
      { id: 'check-in', name: t('Check in'), sub: t('How you feel right now'), icon: 'mood-plus', to: 'tracker' },
      { id: 'write', name: t('Write'), sub: t('Write about your day'), icon: 'pencil', to: 'note/new' },
      { id: 'mind', name: t('Mind'), sub: t('Who and what is on your mind'), icon: 'sparkles', to: 'people/mind' },
    ],
  },
  { id: 'settings', name: t('Settings'), sub: t('Look, sync, privacy and more'), icon: 'settings', hue: 'sadness', to: 'settings' },
];
