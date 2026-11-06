// An exercise's options in a plan or a workout, behind its "…": swap it for another, read about it, count dumbbells as a
// pair, how long to rest between sets, a note, its place in the list, and taking it out.
import { useRef } from 'preact/hooks';
import type { Item } from '../../lib/fitness';
import { t } from '../../lib/i18n';
import { Sheet } from '../Sheet';
import { Icon } from '../icons';
import { restText } from './shared';

/** The rest timer's lengths, seconds (0 is no timer). */
const RESTS = [0, 30, 60, 90, 120, 180];

export function ItemMenu({ item, first, last, onClose, onChange, onReplace, onInfo, onMove, onRemove }: {
  item: Item | null;
  first: boolean;
  last: boolean;
  onClose: () => void;
  onChange: (it: Item) => void;
  onReplace: () => void;
  onInfo: () => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  // the sheet slides away showing the exercise it had
  const held = useRef(item);
  if (item) held.current = item;
  const it = held.current;
  const pairs = it && (it.move.equip === 'dumbbell' || it.move.equip === 'kettlebell');
  const then = (f: () => void) => () => {
    onClose();
    f();
  };
  return (
    <Sheet open={!!item} onClose={onClose} title={it?.move.name ?? ''} label={t('Options for {name}', { name: it?.move.name ?? '' })}>
      {it && (
        <div class="wo-menu">
          <div class="card list menu-list">
            <button class="list-row action" onClick={then(onReplace)}>
              <span class="row gap-s"><Icon name="replace" size={18} /> {t('Replace exercise')}</span>
            </button>
            <button class="list-row action" onClick={then(onInfo)}>
              <span class="row gap-s"><Icon name="info-circle" size={18} /> {t('How to do it')}</span>
            </button>
            {pairs && (
              <label class="list-row">
                <span class="row gap-s"><Icon name="dumbbell" size={18} /> {t('One in each hand (counts ×2)')}</span>
                <button type="button" class="switch" role="switch" aria-checked={it.pair} aria-label={t('One in each hand (counts ×2)')} onClick={() => onChange({ ...it, pair: !it.pair })} />
              </label>
            )}
          </div>

          <section class="wo-menu-part">
            <h3 class="field-label row gap-s"><Icon name="alarm" size={16} /> {t('Rest between sets')}</h3>
            <div class="chips">
              {RESTS.map((s) => (
                <button key={s} class="chip" aria-pressed={it.rest === s} onClick={() => onChange({ ...it, rest: s })}>{restText(s)}</button>
              ))}
            </div>
          </section>

          <label class="wo-menu-part">
            <span class="field-label row gap-s"><Icon name="pencil" size={16} /> {t('Note')}</span>
            <textarea class="input" rows={2} maxLength={2000} value={it.note} placeholder={t('Seat height, grip, how it felt…')} onInput={(e) => onChange({ ...it, note: e.currentTarget.value })} />
          </label>

          <div class="card list menu-list">
            <button class="list-row action" onClick={() => onMove(-1)} disabled={first}>
              <span class="row gap-s"><Icon name="arrow-up" size={18} /> {t('Move up')}</span>
            </button>
            <button class="list-row action" onClick={() => onMove(1)} disabled={last}>
              <span class="row gap-s"><Icon name="arrow-down" size={18} /> {t('Move down')}</span>
            </button>
            <button class="list-row action danger" onClick={then(onRemove)}>
              <span class="row gap-s"><Icon name="trash" size={18} /> {t('Remove exercise')}</span>
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
