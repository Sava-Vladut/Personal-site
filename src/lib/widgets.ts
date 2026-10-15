// How you've set up the feed's widgets: their order, which are hidden, and each one's settings.
// Kept on this device. What's saved is only ids and chosen values, laid over data/widgets.ts, so a widget added in a
// later version turns up (in its usual place) and one that's gone, or a value that's no longer offered, drops out.
import { WIDGETS, type WidgetDef, type WidgetId } from '../data/widgets';
import { observable } from './store';

export interface WidgetLayout {
  /** Every widget once, in order. Each zone shows its own in this relative order. */
  order: WidgetId[];
  hidden: WidgetId[];
  /** Only what differs from the default: widget id → option key → value. */
  options: Partial<Record<WidgetId, Record<string, number>>>;
}

const KEY = 'mm-widgets';
const defs = new Map<string, WidgetDef>(WIDGETS.map((w) => [w.id, w]));

export const defaultLayout = (): WidgetLayout => ({ order: WIDGETS.map((w) => w.id), hidden: [], options: {} });

const ids = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is WidgetId => typeof s === 'string' && defs.has(s)) : []);

/** Every widget exactly once, and only settings that exist and hold an offered value, whatever was saved. */
export function normalize(raw: Partial<WidgetLayout> | null | undefined): WidgetLayout {
  const order = [...new Set(ids(raw?.order))];
  // ones that weren't saved (new in this version) go in after the one before them in the default order
  WIDGETS.forEach((w, i) => {
    if (order.includes(w.id)) return;
    const before = WIDGETS.slice(0, i).map((x) => x.id).reverse().find((id) => order.includes(id));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, w.id);
  });
  const options: WidgetLayout['options'] = {};
  const saved = raw?.options && typeof raw.options === 'object' ? raw.options : {};
  for (const w of WIDGETS) {
    const mine = saved[w.id];
    if (!mine || typeof mine !== 'object') continue;
    for (const o of w.options) {
      const v = (mine as Record<string, unknown>)[o.key];
      if (typeof v === 'number' && v !== o.fallback && o.choices.some(([c]) => c === v)) (options[w.id] ??= {})[o.key] = v;
    }
  }
  return { order, hidden: [...new Set(ids(raw?.hidden))], options };
}

function read(): WidgetLayout {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY) || 'null'));
  } catch {
    return defaultLayout();
  }
}

const layout$ = observable<WidgetLayout>(read());
export const useWidgets = layout$.use;
export const isDefault = (l: WidgetLayout) => JSON.stringify(l) === JSON.stringify(defaultLayout());

export function saveWidgets(next: WidgetLayout) {
  const l = normalize(next);
  layout$.set(l);
  try {
    if (isDefault(l)) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(l));
  } catch {}
}

/** The widgets of a zone you haven't hidden, in your order. */
export const shownIn = (l: WidgetLayout, zone: WidgetDef['zone']) =>
  l.order.filter((id) => !l.hidden.includes(id) && defs.get(id)!.zone === zone);

/** A widget's setting as chosen, or its default. */
export function optionOf(l: WidgetLayout, id: WidgetId, key: string): number {
  const o = defs.get(id)?.options.find((x) => x.key === key);
  return l.options[id]?.[key] ?? o?.fallback ?? 0;
}
