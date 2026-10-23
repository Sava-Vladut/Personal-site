import { useLayoutEffect, useState } from 'preact/hooks';
import { navigate, useRoute, type RouteName } from './lib/router';
import { TooltipLayer } from './components/charts';
import { PeekLayer } from './components/mentions';
import { AddMenu } from './components/AddMenu';
import { EntryMenu } from './components/EntryMenu';
import { Toasts } from './components/Toasts';
import { ConfirmLayer } from './components/Confirm';
import { Icon, type UiName } from './components/icons';
import { prepareView, viewFor } from './lib/views';
import { toast } from './lib/store';
import { t } from './lib/i18n';
import { useWheel } from './lib/wheelLayout';
import type { WheelNode } from './data/wheel';

// the Face ID lock is gone: forget the passkey id it kept
try { localStorage.removeItem('mm-lock'); } catch {}

/** Which sidebar item a page belongs under. */
const SECTION: Partial<Record<RouteName, RouteName>> = { note: 'journal', mind: 'people', person: 'people', book: 'media', song: 'media', repo: 'repos' };

export function App() {
  const route = useRoute(prepareView, () => toast(t('Couldn’t open this page. Try again.')));
  const View = viewFor(route.name);
  const key = route.name === 'note' || route.name === 'person'
    ? route.id === 'new' ? `new-${route.visit}` : route.id
    : route.name === 'book' || route.name === 'song' || route.name === 'repo' ? route.id
    : route.name === 'media' ? route.query.has('add') ? route.visit : 'media'
    : route.name === 'tracker' ? `${route.query.get('world') ?? ''}|${route.query.get('person') ?? ''}`
    : route.name === 'map' ? route.query.get('focus') ?? '' : undefined;
  // before paint, so a page transition captures the new page from its top
  useLayoutEffect(() => {
    if (!history.state?.mmSheet) scrollTo(0, 0);
  }, [route.name, route.id]);

  return (
    <>
      <main class={`app route-${route.name}`}>
        <View key={key} id={route.id!} query={route.query} />
      </main>
      {route.name !== 'note' && route.name !== 'person' && route.name !== 'book' && route.name !== 'song' && route.name !== 'repo' && route.name !== 'map' && route.name !== 'settings' && route.name !== 'intro' && <TabBar />}
      {route.name !== 'intro' && <SideNav active={SECTION[route.name] ?? route.name} here={route.name} />}
      <EntryMenu />
      <ConfirmLayer />
      <Toasts />
      <TooltipLayer />
      <PeekLayer />
    </>
  );
}

const SIDE_KEY = 'mm-side-hidden';

/** Apply the saved sidebar state before the first paint, so a hidden sidebar never flashes open. */
function readSideHidden() {
  let hidden = false;
  try { hidden = localStorage.getItem(SIDE_KEY) === '1'; } catch {}
  if (hidden) document.documentElement.dataset.side = 'hidden';
  return hidden;
}
const sideHiddenAtStart = readSideHidden();

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

/**
 * The desktop navigation: the wheel's places as a list, in the order and groups you gave the wheel, with Check in
 * after Journal. Hidden below 1024px (desktop.css).
 */
function SideNav({ active, here }: { active: RouteName; here: RouteName }) {
  const [hidden, setHidden] = useState(sideHiddenAtStart);
  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    if (next) document.documentElement.dataset.side = 'hidden';
    else delete document.documentElement.dataset.side;
    try { localStorage.setItem(SIDE_KEY, next ? '1' : '0'); } catch {}
  };
  const wheel = useWheel();
  const item = (n: WheelNode) => <NavItem key={n.id} active={active === (n.to || 'journal')} here={here === (n.to || 'journal')} label={n.name} icon={n.icon} path={n.to ?? ''} />;
  const checkIn = <NavItem key="tracker" active={active === 'tracker'} here={here === 'tracker'} label={t('Check in')} icon="mood-smile" path="tracker" />;
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
        {!wheel.some((n) => n.id === 'journal') && checkIn}
        {wheel.map((n) => n.kids ? (
          <div class="side-group" key={n.id}>
            <p class="side-label">{n.name}</p>
            {n.kids.map((k) => item(k))}
          </div>
        ) : [item(n), n.id === 'journal' && checkIn])}
      </div>
      <button class="side-toggle" onClick={toggle} aria-expanded={!hidden} aria-label={hidden ? t('Show sidebar') : t('Hide sidebar')}>
        <Icon name={hidden ? 'chevron-right' : 'chevron-left'} size={16} stroke={2} />
      </button>
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
