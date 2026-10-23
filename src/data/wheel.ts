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
    id: 'insights', name: t('Insights'), sub: t('Your patterns, your places and your brain'), icon: 'chart-dots', hue: 'hope-interest',
    kids: [
      { id: 'stats', name: t('Stats'), sub: t('What your feelings add up to'), icon: 'chart-bar', to: 'stats' },
      { id: 'map', name: t('Map'), sub: t('Where you’ve been, as a heatmap'), icon: 'map', hue: 'calm-safety', to: 'map' },
      { id: 'brain', name: t('Your brain'), sub: t('A brain in letters, glowing with your journal'), icon: 'brain', hue: 'love-connection', to: 'brain' },
    ],
  },
  // things to read: how minds, power and people work
  {
    id: 'learn', name: t('Learn'), sub: t('How minds slip, how power plays and how to win people over'), icon: 'books', hue: 'shame-aversion',
    kids: [
      { id: 'traps', name: t('Mind traps'), sub: t('40 ways your brain fools you, ranked by how hard they pull'), icon: 'spiral', hue: 'sadness', to: 'traps' },
      { id: 'laws', name: t('Laws of power'), sub: t('Robert Greene’s 48 laws: the history, the psychology and how to see them coming'), icon: 'crown', hue: 'anger', to: 'laws' },
      { id: 'friends', name: t('Win friends'), sub: t('Dale Carnegie’s 30 principles: why they work and how to practise them'), icon: 'heart-handshake', hue: 'joy', to: 'friends' },
    ],
  },
  // what's linked to the outside, and small tools
  {
    id: 'extras', name: t('Extras'), sub: t('GitHub, Twitch, your public link and a countdown'), icon: 'layout-grid', hue: 'fear',
    kids: [
      { id: 'repos', name: t('Repos'), sub: t('Your GitHub work, rated and journaled'), icon: 'git-branch', hue: 'calm-safety', to: 'repos' },
      { id: 'twitch', name: t('Channel points'), sub: t('Your Twitch points from the miner'), icon: 'brand-twitch', hue: 'fear', to: 'twitch' },
      { id: 'streamer', name: t('Streamer stats'), sub: t('What a Twitch channel plays, when and for how long'), icon: 'device-gamepad-2', hue: 'fear', to: 'streamer' },
      { id: 'status', name: t('Public status'), sub: t('One link that always shows your latest check-in'), icon: 'world', hue: 'joy', to: 'status' },
      { id: 'countdown', name: t('Countdown'), sub: t('Count the days to something, and change when'), icon: 'hourglass', hue: 'calm-safety', to: 'countdown' },
    ],
  },
  { id: 'settings', name: t('Settings'), sub: t('Look, sync, privacy and more'), icon: 'settings', hue: 'sadness', to: 'settings' },
];
