import { useLayoutEffect } from 'preact/hooks';
import { navigate, useRoute, type RouteName } from './lib/router';
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
import { Twitch } from './views/Twitch';
import { BrainView } from './views/BrainView';
import { t } from './lib/i18n';

// the Face ID lock is gone: forget the passkey id it kept
try { localStorage.removeItem('mm-lock'); } catch {}

const NAV: [RouteName, string, UiName, string][] = [
  ['journal', t('Journal'), 'notebook', ''],
  ['tracker', t('Check in'), 'mood-smile', 'tracker'],
  ['people', t('People'), 'users', 'people'],
  ['media', t('Media'), 'library', 'media'],
];

/** Which sidebar item a page belongs under. */
const SECTION: Partial<Record<RouteName, RouteName>> = { note: 'journal', mind: 'people', person: 'people', book: 'media', song: 'media', map: 'settings', twitch: 'stats', brain: 'stats' };

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
        ) : route.name === 'twitch' ? (
          <Twitch query={route.query} />
        ) : route.name === 'brain' ? (
          <BrainView />
        ) : route.name === 'map' ? (
          <MapView key={route.query.get('focus') ?? ''} query={route.query} />
        ) : (
          <Journal />
        )}
      </main>
      {route.name !== 'note' && route.name !== 'person' && route.name !== 'book' && route.name !== 'song' && route.name !== 'map' && route.name !== 'settings' && <TabBar />}
      <SideNav active={SECTION[route.name] ?? route.name} here={route.name} />
      <EntryMenu />
      <Toasts />
      <TooltipLayer />
      <PeekLayer />
    </>
  );
}

/**
 * The phone's bottom bar: just the + in the middle. The places it used to hold (Journal, People,
 * Media) are on the wheel at the top of each page.
 */
function TabBar() {
  return (
    <nav class="nav add-nav" aria-label={t('Add')}>
      <AddMenu />
    </nav>
  );
}

/** The desktop navigation: a sidebar with the same places as the tab bar, plus Stats and Settings. Hidden below 1024px (desktop.css). */
function SideNav({ active, here }: { active: RouteName; here: RouteName }) {
  return (
    <nav class="side" aria-label={t('Main')}>
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
        <AddMenu label={t('New')} />
      </div>
      <div class="side-links">
        {NAV.map(([name, label, icon, path]) => <NavItem key={name} active={active === name} here={here === name} label={label} icon={icon} path={path} />)}
      </div>
      <div class="side-links side-foot">
        <NavItem active={active === 'stats'} here={here === 'stats'} label={t('Stats')} icon="chart-dots" path="stats" />
        <NavItem active={active === 'settings'} here={here === 'settings'} label={t('Settings')} icon="settings" path="settings" />
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
