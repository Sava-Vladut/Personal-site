// How you've arranged the places wheel: its order, what you've hidden, and groups of your own.
// Kept on this device. What's saved is only ids, laid over the wheel in data/wheel.ts, so a place
// added in a later version still turns up (in its usual spot) and one that's gone simply drops out.
import { WHEEL, type WheelNode } from '../data/wheel';
import type { UiName } from '../components/icons';
import { observable } from './store';
import { t } from './i18n';

export interface Group { name: string; icon: UiName; hue: string }

export interface WheelLayout {
  /** The wheel's own ring, in order: places and groups. */
  top: string[];
  /** What's inside each group, in order. */
  kids: Record<string, string[]>;
  hidden: string[];
  /** Groups you made (the built-in ones, like Insights, live in data/wheel.ts). */
  groups: Record<string, Group>;
}

const KEY = 'mm-wheel-layout';
export const HUES = ['sadness', 'hope-interest', 'calm-safety', 'joy', 'love-connection', 'fear', 'anger', 'shame-aversion'];
export const GROUP_ICONS: UiName[] = ['folder', 'star', 'heart', 'brain', 'sparkles', 'book', 'chart-dots', 'flame', 'eye', 'spiral'];

const places = new Map<string, WheelNode>(); // every place you can go
const builtIn = new Map<string, WheelNode>(); // the categories that come with the app
const home = new Map<string, string | null>(); // where each place sits by default
for (const n of WHEEL) {
  if (n.kids?.length) {
    builtIn.set(n.id, n);
    for (const k of n.kids) places.set(k.id, k), home.set(k.id, n.id);
  } else places.set(n.id, n), home.set(n.id, null);
}

export function defaultLayout(): WheelLayout {
  return {
    top: WHEEL.map((n) => n.id),
    kids: Object.fromEntries([...builtIn].map(([id, n]) => [id, n.kids!.map((k) => k.id)])),
    hidden: [],
    groups: {},
  };
}

const isGroup = (l: WheelLayout, id: string) => builtIn.has(id) || id in l.groups;
const strings = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);

/** Every place exactly once and every group on the ring, whatever was saved. */
export function normalize(raw: Partial<WheelLayout> | null | undefined): WheelLayout {
  const groups: Record<string, Group> = {};
  for (const [id, g] of Object.entries(raw?.groups ?? {})) {
    if (!/^g[a-z0-9]{1,12}$/.test(id) || typeof g?.name !== 'string') continue;
    groups[id] = { name: g.name.slice(0, 40), icon: GROUP_ICONS.includes(g.icon) ? g.icon : 'folder', hue: HUES.includes(g.hue) ? g.hue : 'sadness' };
  }
  const l: WheelLayout = { top: [], kids: {}, hidden: [], groups };
  const placed = new Set<string>();
  const seen = new Set<string>();
  for (const id of strings(raw?.top)) {
    if (seen.has(id)) continue;
    if (isGroup(l, id)) seen.add(id), l.top.push(id), (l.kids[id] = []);
    else if (places.has(id)) seen.add(id), placed.add(id), l.top.push(id);
  }
  for (const id of l.top) {
    if (!isGroup(l, id)) continue;
    for (const k of strings(raw?.kids?.[id])) if (places.has(k) && !placed.has(k)) placed.add(k), l.kids[id].push(k);
  }
  // groups that weren't saved (new, or a broken save) come back where they belong
  for (const id of [...builtIn.keys(), ...Object.keys(groups)]) {
    if (seen.has(id)) continue;
    const at = WHEEL.findIndex((n) => n.id === id);
    l.top.splice(at < 0 ? l.top.length : Math.min(at, l.top.length), 0, id);
    l.kids[id] = [];
  }
  // places that weren't saved: in their own group, else on the ring where they'd be
  for (const [id] of places) {
    if (placed.has(id)) continue;
    const parent = home.get(id);
    if (parent) l.kids[parent].push(id);
    else {
      const at = WHEEL.findIndex((n) => n.id === id);
      l.top.splice(Math.min(at, l.top.length), 0, id);
    }
  }
  l.hidden = strings(raw?.hidden).filter((id) => places.has(id) || isGroup(l, id));
  return l;
}

/** Saves from before 1.106 split Insights: what still sat where it came moves to its new group (what you moved yourself stays). */
const VERSION = 2;
const MOVED: Record<string, string | null> = { traps: 'insights', laws: 'insights', twitch: 'insights', status: 'insights', countdown: 'insights', repos: null };
function migrate(raw: (Partial<WheelLayout> & { v?: number }) | null): Partial<WheelLayout> | null {
  if (!raw || (raw.v ?? 1) >= VERSION) return raw;
  const top = strings(raw.top);
  const kids = Object.fromEntries(Object.entries(raw.kids ?? {}).map(([g, ids]) => [g, strings(ids)]));
  for (const [id, was] of Object.entries(MOVED)) {
    if (was == null) { if (top.includes(id)) top.splice(top.indexOf(id), 1); }
    else if (kids[was]?.includes(id)) kids[was] = kids[was].filter((k) => k !== id);
  }
  return { ...raw, top, kids };
}

function read(): WheelLayout {
  try {
    return normalize(migrate(JSON.parse(localStorage.getItem(KEY) || 'null')));
  } catch {
    return defaultLayout();
  }
}

const layout$ = observable<WheelLayout>(read());
export const useWheelLayout = layout$.use;
export const isDefault = (l: WheelLayout) => JSON.stringify(l) === JSON.stringify(defaultLayout());

export function saveLayout(next: WheelLayout) {
  const l = normalize(next);
  layout$.set(l);
  try {
    if (isDefault(l)) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ ...l, v: VERSION }));
  } catch {}
}

/** The place or group an id names, with its name and look (the editor's rows and the wheel both use this). */
export function nodeOf(l: WheelLayout, id: string): WheelNode {
  const g = l.groups[id];
  if (g) return { id, name: g.name || t('Untitled group'), sub: '', icon: g.icon, hue: g.hue };
  return builtIn.get(id) ?? places.get(id)!;
}
export const groupOf = (l: WheelLayout, id: string) => l.top.find((g) => l.kids[g]?.includes(id)) ?? null;
export { isGroup };

/** The wheel as you've arranged it: hidden things left out, and groups with nothing left in them gone. */
export function treeOf(l: WheelLayout): WheelNode[] {
  const hidden = new Set(l.hidden);
  const out: WheelNode[] = [];
  for (const id of l.top) {
    if (hidden.has(id)) continue;
    const n = nodeOf(l, id);
    if (!isGroup(l, id)) {
      // a place that isn't in its usual group wears its own colour, or the one it had there
      out.push({ ...n, hue: n.hue ?? builtIn.get(home.get(id) ?? '')?.hue });
      continue;
    }
    const kids = l.kids[id].filter((k) => !hidden.has(k)).map((k) => nodeOf(l, k));
    if (!kids.length) continue;
    const sub = l.groups[id] ? kids.map((k) => k.name).join(' · ') : n.sub;
    out.push({ ...n, sub, kids });
  }
  return out;
}

let cache: [WheelLayout, WheelNode[]] | null = null;
/** The places wheel, as arranged here; it follows the editor as you change it. */
export function useWheel() {
  const l = useWheelLayout();
  if (cache?.[0] !== l) cache = [l, treeOf(l)];
  return cache[1];
}
