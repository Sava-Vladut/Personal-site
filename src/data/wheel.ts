// What the journal's wheel holds: categories around the middle, what's in them around those.
// A category can hold categories of its own; tapping one zooms in so it fills the wheel.
// A node with no children is a place to go (`to`, a route).
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
  kids?: WheelNode[];
}

export const WHEEL: WheelNode[] = [
  // the app's places, one tap each
  { id: 'journal', name: t('Journal'), sub: t('Your notes and check-ins, day by day'), icon: 'notebook', hue: 'joy', to: '' },
  { id: 'people', name: t('People'), sub: t('The people in your life'), icon: 'users', hue: 'love-connection', to: 'people' },
  { id: 'media', name: t('Media'), sub: t('Your records and your shelf'), icon: 'library', hue: 'anger', to: 'media' },
  // everything that's numbers about you, in one place
  {
    id: 'insights', name: t('Insights'), sub: t('Your patterns, your places and your points'), icon: 'chart-dots', hue: 'hope-interest',
    kids: [
      { id: 'stats', name: t('Stats'), sub: t('What your feelings add up to'), icon: 'chart-bar', to: 'stats' },
      { id: 'map', name: t('Map'), sub: t('Where you’ve been, as a heatmap'), icon: 'map', hue: 'calm-safety', to: 'map' },
      { id: 'brain', name: t('Your brain'), sub: t('A brain in letters, glowing with your journal'), icon: 'brain', hue: 'love-connection', to: 'brain' },
      { id: 'twitch', name: t('Channel points'), sub: t('Your Twitch points from the miner'), icon: 'brand-twitch', hue: 'fear', to: 'twitch' },
    ],
  },
  { id: 'settings', name: t('Settings'), sub: t('Look, sync, privacy and more'), icon: 'settings', hue: 'sadness', to: 'settings' },
];
