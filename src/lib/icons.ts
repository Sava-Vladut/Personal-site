import { rememberIcon } from './store';

export interface IconCategory { name: string; icons: string[] }
interface Curated { categories: IconCategory[]; bodies: Record<string, string> }

let curated: Promise<Curated> | null = null;
let all: Promise<Record<string, string>> | null = null;

/** ~290 hand-picked icons, loaded when the picker first opens. */
export const loadCurated = () => (curated ??= import('../data/icons-curated.json').then((m) => m.default as Curated));

/** Every icon (~4,900), fetched only when searching beyond the curated set. */
export const loadAll = () =>
  (all ??= fetch('/icons/all.json').then((r) => {
    if (!r.ok) throw new Error('Icon set unavailable');
    return r.json();
  }).catch((e) => {
    all = null;
    throw e;
  }));

/** Finds an icon body for an id not in the local cache (e.g. after importing a backup). */
export async function resolveIcon(id: string) {
  const c = await loadCurated();
  const body = c.bodies[id] ?? (await loadAll().catch(() => ({}) as Record<string, string>))[id];
  if (body) await rememberIcon(id, body);
  return body;
}

/** Tabler icons are stored without their stroke wrapper, so the stroke weight is ours to choose. */
export function svgInner(id: string, body: string, stroke = 1.6) {
  return id.startsWith('t:')
    ? `<g fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
    : body;
}
export const viewBoxOf = (id: string) => (id.startsWith('t:') ? '0 0 24 24' : '0 0 32 32');

/** "e:anxious-face-with-sweat" → "anxious face with sweat" */
export const iconLabel = (id: string) => id.slice(2).replace(/-/g, ' ');
