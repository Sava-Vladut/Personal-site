import { useEffect, useState } from 'preact/hooks';

export type RouteName = 'journal' | 'tracker' | 'people' | 'stats' | 'settings' | 'note' | 'person';
export interface Route {
  name: RouteName;
  id?: string;
  query: URLSearchParams;
  visit: number; // increments on every navigation, so "new note" twice gives two fresh editors
}
let visits = 0;

function parse(): Route {
  const [path, qs = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [head, id] = path.split('/');
  const query = new URLSearchParams(qs);
  const visit = ++visits;
  if (head === 'note') return { name: 'note', id: id || 'new', query, visit };
  if (head === 'person') return { name: 'person', id: id || 'new', query, visit };
  if (head === 'tracker' || head === 'people' || head === 'stats' || head === 'settings') return { name: head, query, visit };
  return { name: 'journal', query, visit };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const f = () => setRoute(parse());
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return route;
}

/** In-app navigation. Entries are tagged so goBack() knows whether "back" stays inside the app. */
export function navigate(to: string, replace = false) {
  const hash = '#/' + to.replace(/^[#/]+/, '');
  if (replace) history.replaceState({ mmInApp: history.state?.mmInApp }, '', hash);
  else history.pushState({ mmInApp: 1 }, '', hash);
  dispatchEvent(new HashChangeEvent('hashchange'));
}

export function goBack(fallback = '') {
  if (history.state?.mmInApp) history.back();
  else navigate(fallback, true);
}

/* ---------- back button closes sheets ----------
   Each open sheet pushes a history entry; the Android/browser back button pops it and closes the
   sheet instead of leaving the page. Closing a sheet from the UI pops its entry too. */

const closers: Array<() => void> = [];

addEventListener('popstate', (e) => {
  const depth = (e.state && e.state.mmSheet) || 0;
  while (closers.length > depth) closers.pop()!();
});

export function pushBack(close: () => void) {
  closers.push(close);
  history.pushState({ ...history.state, mmSheet: closers.length }, '');
  return () => {
    const i = closers.indexOf(close);
    if (i === -1) return; // already closed by the back button
    closers.splice(i, 1);
    history.back();
  };
}
