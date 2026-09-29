import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

export type RouteName = 'journal' | 'tracker' | 'people' | 'books' | 'stats' | 'settings' | 'note' | 'person' | 'book' | 'mind' | 'brain';
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
  if (head === 'book' && id) return { name: 'book', id, query, visit };
  if (head === 'people' && id === 'mind') return { name: 'mind', query, visit };
  if (head === 'brain') return { name: 'brain', query, visit };
  if (head === 'tracker' || head === 'people' || head === 'books' || head === 'stats' || head === 'settings') return { name: head, query, visit };
  return { name: 'journal', query, visit };
}

/* ---------- page transitions ----------
   Tabs slide sideways toward the tab you picked; opening a note, person, stats or the mind page pushes the new page
   in from the right, and going back pops it off again. The CSS lives under "Page transitions". */

type Motion = 'push' | 'pop' | 'tab-left' | 'tab-right' | 'fade';
const TABS: RouteName[] = ['journal', 'tracker', 'people', 'books'];
const depth = (n: RouteName) => (n === 'note' || n === 'brain' ? 2 : TABS.includes(n) ? 0 : 1);

function motionFor(a: Route, b: Route): Motion | null {
  if (a.name === b.name) return a.id !== b.id ? 'fade' : null; // same page, new query: the page animates itself
  const da = depth(a.name), db = depth(b.name);
  if (da !== db) return db > da ? 'push' : 'pop';
  if (da === 0) return TABS.indexOf(b.name) > TABS.indexOf(a.name) ? 'tab-right' : 'tab-left';
  return 'fade';
}

// Safari's swipe-back gesture already slid the page; animating again would play it twice.
let uaAnimated = false;
addEventListener('popstate', (e) => {
  uaAnimated = !!(e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition;
});
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let transitions = 0;

export function useRoute() {
  const [route, setRoute] = useState(parse);
  const current = useRef(route);
  current.current = route;
  const rendered = useRef<(() => void) | null>(null);
  // The transition snapshots the new page as soon as it has rendered.
  useLayoutEffect(() => {
    rendered.current?.();
    rendered.current = null;
  }, [route]);
  useEffect(() => {
    const f = () => {
      const next = parse();
      const motion = uaAnimated || reduced.matches || !document.startViewTransition ? null : motionFor(current.current, next);
      uaAnimated = false;
      if (!motion) return setRoute(next);
      const root = document.documentElement;
      const n = ++transitions;
      root.dataset.nav = motion;
      const t = document.startViewTransition(
        () =>
          new Promise<void>((done) => {
            rendered.current = done;
            setRoute(next);
            setTimeout(done, 300); // never hold the page frozen if the render is slow
          }),
      );
      t.finished.finally(() => {
        if (n !== transitions) return;
        delete root.dataset.nav;
        // The page's own entrance animations were held off while it slid in. Letting them go now would
        // play them a second time, like a refresh, so skip them to the end before the next paint.
        for (const a of document.getAnimations()) {
          const el = a.effect instanceof KeyframeEffect ? a.effect.target : null;
          if (a instanceof CSSAnimation && el?.matches('.page, .page > *')) a.finish();
        }
      });
    };
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

/** Navigates once an open sheet has finished closing — its history entry popping would otherwise undo it. */
export function navigateAfterSheet(to: string) {
  if (history.state?.mmSheet) addEventListener('popstate', () => navigate(to), { once: true });
  else navigate(to);
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
