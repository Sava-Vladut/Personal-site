import { useRef } from 'preact/hooks';
import { GROUP_ICONS, HUES, defaultLayout, groupOf, isDefault, isGroup, nodeOf, saveLayout, treeOf, useWheelLayout, type WheelLayout } from '../lib/wheelLayout';
import { toast } from '../lib/store';
import { haptic } from '../lib/haptics';
import { count, t } from '../lib/i18n';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import '../styles/wheel.css';

const copy = (l: WheelLayout): WheelLayout => ({ top: [...l.top], kids: Object.fromEntries(Object.entries(l.kids).map(([k, v]) => [k, [...v]])), hidden: [...l.hidden], groups: { ...l.groups } });

/** The list an id sits in: the ring itself, or a group's. */
const listOf = (l: WheelLayout, id: string) => (l.top.includes(id) ? l.top : l.kids[groupOf(l, id) ?? '']);

/**
 * Arranging the places wheel (components/NavWheel.tsx): hide what you don't use, change the order,
 * and gather places into groups so the ring holds fewer, bigger slices. Every change shows on the wheel at once.
 */
export function WheelEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const layout = useWheelLayout();
  const fresh = useRef<string | null>(null); // a group just made, whose name gets the focus

  const change = (f: (l: WheelLayout) => void) => {
    const next = copy(layout);
    f(next);
    if (!treeOf(next).length) return toast(t('Keep at least one place on the wheel'));
    haptic(4);
    saveLayout(next);
  };
  const shift = (id: string, by: number) => change((l) => {
    const list = listOf(l, id), i = list.indexOf(id), j = i + by;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  });
  const toggle = (id: string) => change((l) => {
    l.hidden = l.hidden.includes(id) ? l.hidden.filter((h) => h !== id) : [...l.hidden, id];
  });
  const moveTo = (id: string, to: string) => change((l) => {
    const list = listOf(l, id);
    list.splice(list.indexOf(id), 1);
    (to ? l.kids[to] : l.top).push(id);
  });
  const addGroup = () => {
    const id = 'g' + Math.random().toString(36).slice(2, 8);
    fresh.current = id;
    const used = Object.keys(layout.groups).length;
    const next = copy(layout);
    next.groups[id] = { name: t('New group'), icon: 'folder', hue: HUES[(used + 3) % HUES.length] };
    next.top.push(id);
    next.kids[id] = [];
    saveLayout(next);
  };
  const ungroup = (id: string) => change((l) => {
    l.top.splice(l.top.indexOf(id), 1, ...l.kids[id]);
    delete l.kids[id];
    delete l.groups[id];
    l.hidden = l.hidden.filter((h) => h !== id);
  });
  const restyle = (id: string, what: 'icon' | 'hue') => change((l) => {
    const g = { ...l.groups[id] };
    if (what === 'icon') g.icon = GROUP_ICONS[(GROUP_ICONS.indexOf(g.icon) + 1) % GROUP_ICONS.length];
    else g.hue = HUES[(HUES.indexOf(g.hue) + 1) % HUES.length];
    l.groups[id] = g;
  });
  const rename = (id: string, name: string) => {
    const next = copy(layout);
    next.groups[id] = { ...next.groups[id], name: name.trim() };
    saveLayout(next);
  };

  const groups = layout.top.filter((id) => isGroup(layout, id));
  const ring = treeOf(layout);

  const row = (id: string, inGroup: string | null, list: string[]) => {
    const n = nodeOf(layout, id);
    const group = isGroup(layout, id);
    const own = !!layout.groups[id];
    const hidden = layout.hidden.includes(id) || (inGroup != null && layout.hidden.includes(inGroup));
    const hue = n.hue ?? (inGroup ? nodeOf(layout, inGroup).hue : null) ?? 'sadness';
    const i = list.indexOf(id);
    return (
      <div class={`we-row${inGroup ? ' inner' : ''}${group ? ' group' : ''}${hidden ? ' off' : ''}`} style={{ '--c': `var(--emo-${hue})` }} key={id}>
        {own ? (
          <button class="we-icon" onClick={() => restyle(id, 'icon')} aria-label={t('Change its icon')} title={t('Change its icon')}><Icon name={n.icon} size={18} /></button>
        ) : (
          <span class="we-icon"><Icon name={n.icon} size={18} /></span>
        )}
        <div class="we-name">
          {own ? (
            <input
              class="we-input"
              value={layout.groups[id].name}
              placeholder={t('Group name')}
              aria-label={t('Group name')}
              maxLength={40}
              ref={(el) => {
                if (el && fresh.current === id) {
                  fresh.current = null;
                  requestAnimationFrame(() => (el.focus(), el.select()));
                }
              }}
              onChange={(e) => rename(id, (e.target as HTMLInputElement).value)}
            />
          ) : (
            <span>{n.name}</span>
          )}
          {group && <small>{layout.kids[id].length ? count(layout.kids[id].length, 'place', 'places') : t('Empty: move places into it')}</small>}
        </div>
        <div class="we-tools">
          {own && <button class="we-dot" onClick={() => restyle(id, 'hue')} aria-label={t('Change its colour')} title={t('Change its colour')} />}
          {!group && groups.length > 0 && (
            <label class="we-move" title={t('Move to')}>
              <Icon name="folder" size={16} />
              <select aria-label={t('Move {name} to', { name: n.name })} value={inGroup ?? ''} onChange={(e) => moveTo(id, (e.target as HTMLSelectElement).value)}>
                <option value="">{t('The ring itself')}</option>
                {groups.map((g) => <option value={g}>{nodeOf(layout, g).name}</option>)}
              </select>
            </label>
          )}
          <button class="icon-btn" disabled={i <= 0} onClick={() => shift(id, -1)} aria-label={t('Move {name} up', { name: n.name })}><Icon name="arrow-up" size={16} /></button>
          <button class="icon-btn" disabled={i >= list.length - 1} onClick={() => shift(id, 1)} aria-label={t('Move {name} down', { name: n.name })}><Icon name="arrow-down" size={16} /></button>
          <button class="icon-btn" aria-pressed={!layout.hidden.includes(id)} onClick={() => toggle(id)} aria-label={layout.hidden.includes(id) ? t('Show {name}', { name: n.name }) : t('Hide {name}', { name: n.name })}>
            <Icon name={layout.hidden.includes(id) ? 'eye-off' : 'eye'} size={16} />
          </button>
          {own && <button class="icon-btn" onClick={() => ungroup(id)} aria-label={t('Remove the group {name}', { name: n.name })} title={t('Remove the group (what’s in it stays)')}><Icon name="trash" size={16} /></button>}
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('Edit the wheel')} tall>
      <div class="we">
        <Preview layout={layout} />
        <p class="hint we-hint">
          {t('Hide what you don’t use, change the order, or gather places into groups: fewer things on the ring means bigger, calmer slices.')}
          {' '}<b>{count(ring.length, 'slice', 'slices')}</b>
        </p>
        <div class="card we-list">
          {layout.top.map((id) => (
            <div class="we-block" key={id}>
              {row(id, null, layout.top)}
              {isGroup(layout, id) && layout.kids[id].map((k) => row(k, id, layout.kids[id]))}
            </div>
          ))}
        </div>
        <div class="we-foot">
          <button class="btn btn-quiet" onClick={addGroup}><Icon name="folder-plus" size={18} /> {t('New group')}</button>
          <button class="btn btn-quiet" disabled={isDefault(layout)} onClick={() => { saveLayout(defaultLayout()); toast(t('The wheel is back to how it came')); }}>
            <Icon name="restore" size={18} /> {t('Reset')}
          </button>
        </div>
        <p class="muted small we-note">{t('Kept on this device. Hidden places are still here to bring back.')}</p>
      </div>
    </Sheet>
  );
}

/** The ring as it'll look: a slice for each place or group, in its colour. */
function Preview({ layout }: { layout: WheelLayout }) {
  const ring = treeOf(layout);
  const C = 60, r0 = 26, r1 = 56, gap = 2.4;
  const at = (r: number, a: number) => `${(C + r * Math.sin((a * Math.PI) / 180)).toFixed(2)} ${(C - r * Math.cos((a * Math.PI) / 180)).toFixed(2)}`;
  const span = 360 / ring.length;
  return (
    <svg class="we-preview" viewBox="0 0 120 120" aria-hidden="true">
      {ring.map((n, i) => {
        const a0 = i * span + (ring.length > 1 ? gap : 0), a1 = (i + 1) * span - (ring.length > 1 ? gap : 0);
        const big = a1 - a0 > 180 ? 1 : 0;
        const d = ring.length === 1
          ? `M${C - r1} ${C}a${r1} ${r1} 0 1 1 ${2 * r1} 0a${r1} ${r1} 0 1 1 ${-2 * r1} 0zM${C - r0} ${C}a${r0} ${r0} 0 1 0 ${2 * r0} 0a${r0} ${r0} 0 1 0 ${-2 * r0} 0z`
          : `M${at(r1, a0)}A${r1} ${r1} 0 ${big} 1 ${at(r1, a1)}L${at(r0, a1)}A${r0} ${r0} 0 ${big} 0 ${at(r0, a0)}z`;
        const m = (i + 0.5) * span;
        const [x, y] = at(41, m).split(' ').map(Number);
        return (
          <g key={n.id} style={{ '--c': `var(--emo-${n.hue ?? 'sadness'})`, '--i': i }} class="we-slice">
            <path d={d} fill-rule="evenodd" />
            <g transform={`translate(${x - 7} ${y - 7})`}><Icon name={n.icon} size={14} stroke={2} /></g>
          </g>
        );
      })}
    </svg>
  );
}
