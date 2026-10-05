import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { navigate, useRoute, type RouteName } from './lib/router';
import { useLens } from './lib/glass';
import { leftPeople, useLock } from './lib/lock';
import { LockScreen } from './components/Lock';
import { TooltipLayer } from './components/charts';
import { PeekLayer } from './components/mentions';
import { AddMenu } from './components/AddMenu';
import { EntryMenu } from './components/EntryMenu';
import { Toasts } from './components/Toasts';
import { Icon, type UiName } from './components/icons';
import { BookView } from './views/Book';
import { Editor } from './views/Editor';
import { Journal } from './views/Journal';
import { Media } from './views/Media';
import { Mind } from './views/Mind';
import { People } from './views/People';
import { MapView } from './views/Places';
import { PersonView } from './views/Person';
import { Settings } from './views/Settings';
import { SongView } from './views/Song';
import { Stats } from './views/Stats';
import { Tracker } from './views/Tracker';

const NAV: [RouteName, string, UiName, string][] = [
  ['journal', 'Journal', 'notebook', ''],
  ['tracker', 'Check in', 'mood-smile', 'tracker'],
  ['people', 'People', 'users', 'people'],
  ['media', 'Media', 'library', 'media'],
];

/** Which sidebar item a page belongs under. */
const SECTION: Partial<Record<RouteName, RouteName>> = { note: 'journal', mind: 'people', person: 'people', book: 'media', song: 'media', map: 'settings' };

export function App() {
  const route = useRoute();
  const lock = useLock();
  // People, someone's page and the mind page ask for Face ID each time you go in, and lock again when you leave
  const inPeople = route.name === 'people' || route.name === 'person' || route.name === 'mind';
  useEffect(() => { if (!inPeople) leftPeople(); }, [inPeople]);

  // before paint, so a page transition captures the new page from its top
  useLayoutEffect(() => {
    if (!history.state?.mmSheet) scrollTo(0, 0);
  }, [route.name, route.id]);

  if (lock.locked) {
    return (
      <>
        <main class="app route-lock"><LockScreen scope="app" /></main>
        <Toasts />
      </>
    );
  }

  return (
    <>
      <main class={`app route-${route.name}`}>
        {inPeople && lock.on && !lock.people ? (
          <LockScreen scope="people" />
        ) : route.name === 'note' ? (
          <Editor key={route.id === 'new' ? `new-${route.visit}` : route.id} id={route.id!} query={route.query} />
        ) : route.name === 'person' ? (
          <PersonView key={route.id === 'new' ? `new-${route.visit}` : route.id} id={route.id!} />
        ) : route.name === 'people' ? (
          <People />
        ) : route.name === 'mind' ? (
          <Mind />
        ) : route.name === 'book' ? (
          <BookView key={route.id} id={route.id!} />
        ) : route.name === 'media' ? (
          <Media key={route.query.has('add') ? route.visit : 'media'} query={route.query} />
        ) : route.name === 'song' ? (
          <SongView key={route.id} id={route.id!} />
        ) : route.name === 'tracker' ? (
          <Tracker key={`${route.query.get('world') ?? ''}|${route.query.get('person') ?? ''}`} query={route.query} />
        ) : route.name === 'stats' ? (
          <Stats query={route.query} />
        ) : route.name === 'settings' ? (
          <Settings query={route.query} />
        ) : route.name === 'map' ? (
          <MapView key={route.query.get('focus') ?? ''} query={route.query} />
        ) : (
          <Journal />
        )}
      </main>
      {route.name !== 'note' && route.name !== 'person' && route.name !== 'book' && route.name !== 'song' && route.name !== 'map' && <TabBar active={route.name === 'mind' ? 'people' : route.name} />}
      <SideNav active={SECTION[route.name] ?? route.name} here={route.name} />
      <EntryMenu />
      <Toasts />
      <TooltipLayer />
      <PeekLayer />
    </>
  );
}

/** iOS-style floating glass tab bar, with the "add" menu as its own glass button. */
function TabBar({ active }: { active: RouteName }) {
  const bar = useRef<HTMLDivElement>(null);
  useLens(bar);
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
      <div ref={bar} class="tabbar glass" data-dir={dir.current} style={{ '--n': NAV.length }} inert={adding}>
        {i >= 0 && <span class="tab-pill" style={{ '--i': i }} aria-hidden="true" />}
        {NAV.map(([name, label, icon, path]) => <NavItem key={name} active={active === name} label={label} icon={icon} path={path} />)}
      </div>
      <AddMenu open={adding} onOpenChange={setAdding} />
    </nav>
  );
}

/** The desktop navigation: a sidebar with the same places as the tab bar, plus Stats and Settings. Hidden below 1024px (desktop.css). */
function SideNav({ active, here }: { active: RouteName; here: RouteName }) {
  const [adding, setAdding] = useState(false);
  return (
    <nav class="side" aria-label="Main">
      <a
        href="#/"
        class="side-brand"
        onClick={(e) => {
          e.preventDefault();
          if (here !== 'journal') navigate('');
        }}
      >
        My Mind
      </a>
      <div class="side-add">
        <AddMenu open={adding} onOpenChange={setAdding} label="New" />
      </div>
      <div class="side-links">
        {NAV.map(([name, label, icon, path]) => <NavItem key={name} active={active === name} here={here === name} label={label} icon={icon} path={path} />)}
      </div>
      <div class="side-links side-foot">
        <NavItem active={active === 'stats'} here={here === 'stats'} label="Stats" icon="chart-dots" path="stats" />
        <NavItem active={active === 'settings'} here={here === 'settings'} label="Settings" icon="settings" path="settings" />
      </div>
    </nav>
  );
}

function NavItem({ active, here = active, label, icon, path }: { active: boolean; here?: boolean; label: string; icon: UiName; path: string }) {
  return (
    <a
      href={'#/' + path}
      class="nav-item"
      aria-current={active ? 'page' : undefined}
      onClick={(e) => {
        e.preventDefault();
        if (!here) navigate(path);
      }}
    >
      <Icon name={icon} size={22} stroke={active ? 2 : 1.6} />
      <span>{label}</span>
    </a>
  );
}
