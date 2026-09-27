import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { navigate, navigateAfterSheet, useRoute, type RouteName } from './lib/router';
import { dismissToast, useToasts, type Toast } from './lib/store';
import { useLens } from './lib/glass';
import { TooltipLayer } from './components/charts';
import { EntryMenu } from './components/EntryMenu';
import { Sheet } from './components/Sheet';
import { Icon, type UiName } from './components/icons';
import { BookView } from './views/Book';
import { Books } from './views/Books';
import { Editor } from './views/Editor';
import { Journal } from './views/Journal';
import { Mind } from './views/Mind';
import { People } from './views/People';
import { PersonView } from './views/Person';
import { Settings } from './views/Settings';
import { Stats } from './views/Stats';
import { Tracker } from './views/Tracker';

const NAV: [RouteName, string, UiName, string][] = [
  ['journal', 'Journal', 'notebook', ''],
  ['tracker', 'Check in', 'mood-smile', 'tracker'],
  ['people', 'People', 'users', 'people'],
  ['books', 'Books', 'books', 'books'],
];

export function App() {
  const route = useRoute();

  // before paint, so a page transition captures the new page from its top
  useLayoutEffect(() => {
    if (!history.state?.mmSheet) scrollTo(0, 0);
  }, [route.name, route.id]);

  return (
    <>
      <main class={`app route-${route.name}`}>
        {route.name === 'note' ? (
          <Editor key={route.id === 'new' ? `new-${route.visit}` : route.id} id={route.id!} query={route.query} />
        ) : route.name === 'person' ? (
          <PersonView key={route.id === 'new' ? `new-${route.visit}` : route.id} id={route.id!} />
        ) : route.name === 'people' ? (
          <People />
        ) : route.name === 'mind' ? (
          <Mind />
        ) : route.name === 'book' ? (
          <BookView key={route.id} id={route.id!} />
        ) : route.name === 'books' ? (
          <Books query={route.query} />
        ) : route.name === 'tracker' ? (
          <Tracker key={`${route.query.get('world') ?? ''}|${route.query.get('person') ?? ''}`} query={route.query} />
        ) : route.name === 'stats' ? (
          <Stats query={route.query} />
        ) : route.name === 'settings' ? (
          <Settings query={route.query} />
        ) : (
          <Journal />
        )}
      </main>
      {route.name !== 'note' && route.name !== 'person' && route.name !== 'book' && <TabBar active={route.name === 'mind' ? 'people' : route.name} />}
      <EntryMenu />
      <Toasts />
      <TooltipLayer />
    </>
  );
}

const ADD: [string, string, string, UiName][] = [
  ['note/new', 'Note', 'Write about your day', 'pencil'],
  ['tracker', 'Check-in', 'Log how you feel right now', 'mood-plus'],
  ['person/new', 'Person', 'Someone who matters to you', 'user-plus'],
  ['books?add', 'Book', 'Something you’re reading or want to', 'books'],
];

/** iOS-style floating glass tab bar, with the "add" menu as its own glass button. */
function TabBar({ active }: { active: RouteName }) {
  const bar = useRef<HTMLDivElement>(null);
  const plus = useRef<HTMLButtonElement>(null);
  useLens(bar);
  useLens(plus, { strength: 14 });
  const [adding, setAdding] = useState(false);
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
      <div ref={bar} class="tabbar glass" data-dir={dir.current} style={{ '--n': NAV.length }}>
        {i >= 0 && <span class="tab-pill" style={{ '--i': i }} aria-hidden="true" />}
        {NAV.map(([name, label, icon, path]) => <NavItem active={active === name} label={label} icon={icon} path={path} />)}
      </div>
      <button ref={plus} class="nav-new glass glass-btn tinted" onClick={() => setAdding(true)} aria-label="Add" aria-haspopup="dialog">
        <Icon name="plus" size={26} stroke={2} />
      </button>
      <AddMenu open={adding} onClose={() => setAdding(false)} />
    </nav>
  );
}

function AddMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pick = (to: string) => {
    navigateAfterSheet(to);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Add">
      <div class="card list menu-list">
        {ADD.map(([to, label, sub, icon]) => (
          <button class="list-row action add-row" onClick={() => pick(to)}>
            <span class="add-icon"><Icon name={icon} size={20} /></span>
            <span class="add-main"><span class="add-label">{label}</span><span class="muted small">{sub}</span></span>
            <Icon name="chevron-right" size={18} class="muted" />
          </button>
        ))}
      </div>
    </Sheet>
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

/** Toasts rise in and, once dismissed, stay a moment longer to fade away. */
function Toasts() {
  const toasts = useToasts();
  const [leaving, setLeaving] = useState<Toast[]>([]);
  const prev = useRef(toasts);
  useEffect(() => {
    const gone = prev.current.filter((t) => !toasts.some((x) => x.id === t.id));
    prev.current = toasts;
    if (!gone.length) return;
    setLeaving((l) => [...l, ...gone]);
    setTimeout(() => setLeaving((l) => l.filter((t) => !gone.includes(t))), 220);
  }, [toasts]);
  return (
    <div class="toasts" aria-live="polite">
      {leaving.map((t) => (
        <div class="toast glass leaving" key={t.id} aria-hidden="true">
          <span>{t.text}</span>
        </div>
      ))}
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
