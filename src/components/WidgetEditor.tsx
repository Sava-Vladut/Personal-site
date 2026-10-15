import { WIDGETS, type WidgetDef } from '../data/widgets';
import { defaultLayout, isDefault, saveWidgets, useWidgets, type WidgetLayout } from '../lib/widgets';
import { toast } from '../lib/store';
import { haptic } from '../lib/haptics';
import { t } from '../lib/i18n';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import '../styles/wheel.css';
import '../styles/widgets.css';

const copy = (l: WidgetLayout): WidgetLayout => ({ order: [...l.order], hidden: [...l.hidden], options: Object.fromEntries(Object.entries(l.options).map(([k, v]) => [k, { ...v }])) });

const ZONES: [WidgetDef['zone'], string, string][] = [
  ['panel', t('On the day’s panel'), t('Under the date, above your notes')],
  ['side', t('Beside the feed'), t('Only on wide screens')],
];

/**
 * Choosing what the feed shows: hide the widgets you don't use, change their order, and set each one's own options.
 * Every change shows on the feed behind the sheet at once.
 */
export function WidgetEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const layout = useWidgets();

  const change = (f: (l: WidgetLayout) => void) => {
    const next = copy(layout);
    f(next);
    haptic(4);
    saveWidgets(next);
  };
  // a swap with the neighbour in the same zone, so the order you see in the sheet is the order on the feed
  const shift = (id: string, zone: string, by: number) => change((l) => {
    const mine = l.order.filter((x) => WIDGETS.find((w) => w.id === x)!.zone === zone);
    const other = mine[mine.indexOf(id as never) + by];
    if (!other) return;
    const i = l.order.indexOf(id as never), j = l.order.indexOf(other);
    [l.order[i], l.order[j]] = [l.order[j], l.order[i]];
  });
  const toggle = (id: string) => change((l) => {
    l.hidden = l.hidden.includes(id as never) ? l.hidden.filter((h) => h !== id) : [...l.hidden, id as never];
  });
  const choose = (w: WidgetDef, key: string, value: number) => change((l) => {
    l.options[w.id] = { ...l.options[w.id], [key]: value };
  });

  return (
    <Sheet open={open} onClose={onClose} title={t('Edit the feed')} tall>
      <div class="we">
        <p class="hint we-hint">{t('Hide the cards you don’t use, change their order, and set what each one shows.')}</p>
        {ZONES.map(([zone, name, sub]) => {
          const list = layout.order.map((id) => WIDGETS.find((w) => w.id === id)!).filter((w) => w.zone === zone);
          return (
            <section class="wd-zone" key={zone}>
              <h3 class="section-label wd-zone-head">{name} <small>{sub}</small></h3>
              <div class="card we-list">
                {list.map((w, i) => {
                  const off = layout.hidden.includes(w.id);
                  return (
                    <div class="we-block" key={w.id}>
                      <div class={`we-row${off ? ' off' : ''}`} style={{ '--c': `var(--emo-${w.hue})` }}>
                        <span class="we-icon"><Icon name={w.icon} size={18} /></span>
                        <div class="we-name">
                          <span>{w.name}</span>
                          <small>{w.sub}</small>
                        </div>
                        <div class="we-tools">
                          <button class="icon-btn" disabled={i === 0} onClick={() => shift(w.id, zone, -1)} aria-label={t('Move {name} up', { name: w.name })}><Icon name="arrow-up" size={17} /></button>
                          <button class="icon-btn" disabled={i === list.length - 1} onClick={() => shift(w.id, zone, 1)} aria-label={t('Move {name} down', { name: w.name })}><Icon name="arrow-down" size={17} /></button>
                          <button class="icon-btn" aria-pressed={!off} onClick={() => toggle(w.id)} aria-label={off ? t('Show {name}', { name: w.name }) : t('Hide {name}', { name: w.name })}>
                            <Icon name={off ? 'eye-off' : 'eye'} size={17} />
                          </button>
                        </div>
                      </div>
                      {!off && w.options.map((o) => {
                        const now = layout.options[w.id]?.[o.key] ?? o.fallback;
                        return (
                          <div class="wd-opt" style={{ '--c': `var(--emo-${w.hue})` }} key={o.key}>
                            <span>{o.name}</span>
                            <div class="seg compact" role="radiogroup" aria-label={`${w.name}: ${o.name}`}>
                              {o.choices.map(([v, label]) => (
                                <button role="radio" aria-checked={now === v} aria-selected={now === v} onClick={() => choose(w, o.key, v)}>{label}</button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        <div class="we-foot">
          <button class="btn btn-quiet" disabled={isDefault(layout)} onClick={() => { saveWidgets(defaultLayout()); toast(t('The feed is back to how it came')); }}>
            <Icon name="restore" size={18} /> {t('Reset')}
          </button>
        </div>
        <p class="muted small we-note">{t('Kept on this device. Hidden cards are still here to bring back.')}</p>
      </div>
    </Sheet>
  );
}
