import type { ComponentType } from 'preact';
import type { RouteName } from './router';

type View = ComponentType<{ id: string; query: URLSearchParams }>;
const loaders: Record<RouteName, () => Promise<View>> = {
  journal: () => import('../views/Journal').then((m) => m.Journal),
  note: () => import('../views/Editor').then((m) => m.Editor),
  person: () => import('../views/Person').then((m) => m.PersonView),
  people: () => import('../views/People').then((m) => m.People),
  mind: () => import('../views/Mind').then((m) => m.Mind),
  book: () => import('../views/Book').then((m) => m.BookView),
  media: () => import('../views/Media').then((m) => m.Media),
  song: () => import('../views/Song').then((m) => m.SongView),
  tracker: () => import('../views/Tracker').then((m) => m.Tracker),
  stats: () => import('../views/Stats').then((m) => m.Stats),
  settings: () => import('../views/Settings').then((m) => m.Settings),
  twitch: () => import('../views/Twitch').then((m) => m.Twitch),
  brain: () => import('../views/BrainView').then((m) => m.BrainView),
  map: () => import('../views/Places').then((m) => m.MapView),
};
const loaded = new Map<RouteName, View>();
const pending = new Map<RouteName, Promise<void>>();

/** Fetch a screen and its styles before taking the page transition's snapshot. */
export function prepareView(name: RouteName): Promise<void> | undefined {
  if (loaded.has(name)) return;
  let request = pending.get(name);
  if (!request) {
    request = loaders[name]().then((view) => { loaded.set(name, view); }).finally(() => { pending.delete(name); });
    pending.set(name, request);
  }
  return request;
}

export const viewFor = (name: RouteName) => loaded.get(name)!;
