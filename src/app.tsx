import { useEffect, useRef } from 'preact/hooks';
import { navigate, useRoute, type RouteName } from './lib/router';
import { dismissToast, useToasts } from './lib/store';
import { useLens } from './lib/glass';
import { TooltipLayer } from './components/charts';
import { Icon, type UiName } from './components/icons';
import { Editor } from './views/Editor';
import { Journal } from './views/Journal';
import { Settings } from './views/Settings';
import { Stats } from './views/Stats';
import { Tracker } from './views/Tracker';

const NAV: [RouteName, string, UiName, string][] = [
  ['journal', 'Journal', 'notebook', ''],
  ['tracker', 'Check in', 'mood-smile', 'tracker'],
  ['stats', 'Stats', 'chart-dots', 'stats'],
  ['settings', 'Settings', 'settings', 'settings'],
];

export function App() {
  const route = useRoute();

  useEffect(() => {
    if (!history.state?.mmSheet) scrollTo(0, 0);
  }, [route.name, route.id]);

  return (
    <>
      <main class={`app route-${route.name}`}>
        {route.name === 'note' ? (
          <Editor key={route.id === 'new' ? `new-${route.visit}` : route.id} id={route.id!} query={route.query} />
        ) : route.name === 'tracker' ? (
          <Tracker key={route.query.get('world') ?? ''} query={route.query} />
        ) : route.name === 'stats' ? (
          <Stats query={route.query} />
        ) : route.name === 'settings' ? (
          <Settings query={route.query} />
        ) : (
          <Journal />
        )}
      </main>
      {route.name !== 'note' && <TabBar active={route.name} />}
      <Toasts />
      <TooltipLayer />
    </>
  );
}

/** iOS-style floating glass tab bar, with the "new note" action as its own glass button. */
function TabBar({ active }: { active: RouteName }) {
  const bar = useRef<HTMLDivElement>(null);
  const plus = useRef<HTMLButtonElement>(null);
  useLens(bar);
  useLens(plus, { strength: 14 });
  const i = NAV.findIndex(([name]) => name === active);
  // The pill's leading edge moves first and the trailing edge catches up, so it stretches like a drop.
  const prev = useRef(i);
  const dir = useRef<'left' | 'right'>('right');
  if (i !== prev.current) {
    dir.current = i > prev.current ? 'right' : 'left';
    prev.current = i;
  }
  return (
    <nav class="nav" aria-label="Main">
      <div ref={bar} class="tabbar glass" data-dir={dir.current}>
        {i >= 0 && <span class="tab-pill" style={{ '--i': i }} aria-hidden="true" />}
        {NAV.map(([name, label, icon, path]) => <NavItem active={active === name} label={label} icon={icon} path={path} />)}
      </div>
      <button ref={plus} class="nav-new glass glass-btn tinted" onClick={() => navigate('note/new')} aria-label="New note">
        <Icon name="plus" size={26} stroke={2} />
      </button>
    </nav>
  );
}

function NavItem({ active, label, icon, path }: { active: boolean; label: string; icon: UiName; path: string }) {
  return (
    <a
      href={'#/' + path}
      class="nav-item"
      aria-current={active ? 'page' : undefined}
      onClick={(e) => {
        e.preventDefault();
        if (!active) navigate(path);
      }}
    >
      <Icon name={icon} size={22} stroke={active ? 2 : 1.6} />
      <span>{label}</span>
    </a>
  );
}

function Toasts() {
  const toasts = useToasts();
  return (
    <div class="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div class="toast glass" key={t.id}>
          <span>{t.text}</span>
          {t.action && (
            <button class="toast-action" onClick={() => { t.action!.run(); dismissToast(t.id); }}>{t.action.label}</button>
          )}
        </div>
      ))}
    </div>
  );
}
