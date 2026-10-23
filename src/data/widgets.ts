// The cards you can put on the main feed (views/Journal.tsx). What you've chosen (the order, what's hidden, each
// card's settings) is kept in lib/widgets.ts; this is only what exists. To add a widget: list it here, then give it
// a case in Journal's `Widget`.
import type { UiName } from '../components/icons';
import { t } from '../lib/i18n';

export type WidgetId = 'notices' | 'on-this-day' | 'coming-up' | 'reading' | 'song' | 'points';

/** A setting of one widget: a few named choices, each a number. */
export interface WidgetOption {
  key: string;
  name: string;
  choices: [value: number, label: string][];
  fallback: number;
}

export interface WidgetDef {
  id: WidgetId;
  name: string;
  sub: string;
  icon: UiName;
  hue: string;
  /** `panel`: on the day's panel, under the date. `side`: the column beside the feed, which only wide screens have. */
  zone: 'panel' | 'side';
  options: WidgetOption[];
}

export const WIDGETS: WidgetDef[] = [
  { id: 'notices', name: t('Today’s reminders'), sub: t('What’s still to do today, and what’s worth knowing'), icon: 'sparkles', hue: 'hope-interest', zone: 'panel', options: [] },
  { id: 'on-this-day', name: t('On this day'), sub: t('The same date, a year or more ago'), icon: 'clock', hue: 'hope-interest', zone: 'panel', options: [] },
  {
    id: 'coming-up', name: t('Coming up'), sub: t('Birthdays and dates of the people you keep'), icon: 'cake', hue: 'love-connection', zone: 'panel',
    options: [
      { key: 'days', name: t('Look ahead'), fallback: 14, choices: [[7, t('1 week')], [14, t('2 weeks')], [30, t('1 month')], [90, t('3 months')]] },
      { key: 'max', name: t('Show up to'), fallback: 3, choices: [[1, '1'], [3, '3'], [5, '5']] },
    ],
  },
  {
    id: 'reading', name: t('Reading now'), sub: t('The books you’re in the middle of'), icon: 'book', hue: 'calm-safety', zone: 'panel',
    options: [{ key: 'max', name: t('Show up to'), fallback: 0, choices: [[1, '1'], [2, '2'], [3, '3'], [0, t('All')]] }],
  },
  { id: 'song', name: t('Song of the day'), sub: t('Today’s record, and the days before it'), icon: 'music', hue: 'sadness', zone: 'side', options: [] },
  {
    id: 'points', name: t('Channel points'), sub: t('Your Twitch total, a tap from its page'), icon: 'brand-twitch', hue: 'fear', zone: 'side',
    options: [{ key: 'graph', name: t('Last 30 days graph'), fallback: 1, choices: [[1, t('Show')], [0, t('Hide')]] }],
  },
];
