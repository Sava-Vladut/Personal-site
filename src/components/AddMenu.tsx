import type { WheelNode } from '../data/wheel';
import { LOCALE, t } from '../lib/i18n';
import { Icon } from './icons';
import { NavWheel } from './NavWheel';

// the things to add, round the wheel; each wears a world's colour
const ADD: WheelNode[] = [
  { id: 'note', name: t('Note'), sub: t('Write about your day'), icon: 'pencil', hue: 'hope-interest', to: 'note/new' },
  { id: 'check-in', name: t('Check-in'), sub: t('How you feel right now'), icon: 'mood-plus', hue: 'calm-safety', to: 'tracker' },
  { id: 'person', name: t('Person'), sub: t('Someone who matters'), icon: 'user-plus', hue: 'love-connection', to: 'person/new' },
  { id: 'book', name: t('Book'), sub: t('Read, reading or wanted'), icon: 'books', hue: 'sadness', to: 'media?tab=books&add' },
  { id: 'music', name: t('Music'), sub: t('A song, album or playlist'), icon: 'vinyl', hue: 'fear', to: 'media?tab=music&add' },
];

/**
 * The + button: it opens a wheel of the things you can add, the same wheel as the places one
 * (components/NavWheel.tsx). On phones the + sits alone in the bottom bar; on desktop it's the
 * sidebar's "New".
 */
export function AddMenu({ label }: { label?: string }) {
  const today = new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <NavWheel
      world="hope-interest"
      tree={ADD}
      look={{
        label: t('Add'),
        kicker: today,
        title: t('What would you like to keep?'),
        hint: t('Tap one to add it, the middle to close'),
        class: 'nav-new add-btn glass glass-btn tinted',
        mark: () => (
          <>
            <span class="nav-plus"><Icon name="plus" size={label ? 20 : 28} stroke={2} /></span>
            {label && <span class="nav-new-label">{label}</span>}
          </>
        ),
      }}
    />
  );
}
