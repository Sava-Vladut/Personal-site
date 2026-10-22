import { render, type ComponentType } from 'preact';
import '@fontsource-variable/source-serif-4/wght.css';
import '@fontsource-variable/instrument-sans/index.css';
import './styles/app.css';
// Styles that stay global, in their original cascade with desktop.css last: the app shell's own (glass, wheel, objects,
// mentions, books), ones whose classes are also used by screens that don't import them (notes' sky banner, stats'
// charts, twitch's journal card, brain), and ones desktop.css overrides (map). The song of the day's styles come with
// components/SongOfDay.tsx and the photo viewer's with lib/viewer.ts, so they load with the screens that use them.
import './styles/books.css';
import './styles/glass.css';
import './styles/brain.css';
import './styles/objects.css';
import './styles/mentions.css';
import './styles/wheel.css';
import './styles/notes.css';
import './styles/map.css';
import './styles/stats.css';
import './styles/twitch.css';
import './styles/fade-images.css';
import './styles/fade-scroll.css';
import './styles/fade-data.css';
import { App } from './app';
import './styles/desktop.css';
import { applyTheme, init } from './lib/store';
import { onBlocked } from './lib/db';
import { initSync } from './lib/sync';
import { initStatus } from './lib/status';
import { startWeather } from './lib/weather';
import { t } from './lib/i18n';
import { haptic } from './lib/haptics';
import { startImageFade } from './lib/fadeImages';
import { startReveal } from './lib/reveal';
import { routeName } from './lib/router';
import { preloadViews, prepareView, viewFor } from './lib/views';
import { authStatus, introSeen, opensOn, rememberSignedIn, signedInHere, stillSignedIn } from './lib/auth';
import type { IntroProps } from './views/Intro';

applyTheme();
startImageFade();
startReveal();
// iOS only shows :active (the press feedback on cards and buttons) once the page listens for touches.
addEventListener('touchstart', () => {}, { passive: true });
// The page doesn't zoom (see the viewport tag and html's touch-action); Safari still pinches unless its gestures are stopped.
for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
// Every switch ticks as it flips, wherever it is.
addEventListener('click', (e) => {
  if ((e.target as Element | null)?.closest?.('.switch:not(:disabled)')) haptic();
});
// Pictures aren't meant to be dragged: dropped on a text box, the browser writes the image's address into the note.
addEventListener('dragstart', (e) => {
  if (e.target instanceof HTMLImageElement) e.preventDefault();
});
// Until the upgrade can finish, say why the journal isn't showing instead of leaving the page blank.
onBlocked(() =>
  render(
    <div class="page">
      <div class="empty">
        <h2 class="title-s">{t('Finishing an update')}</h2>
        <p>{t('My Mind is open somewhere else on this device (another tab or the installed app). Close it and this page will continue by itself.')}</p>
      </div>
    </div>,
    document.getElementById('app')!,
  ),
);
// A public note's link opens just that note, and a public status's link just the latest check-in, for anyone: no sign-in
// and nothing of the journal is loaded.
// Otherwise, a device that's signed in opens the journal at once and checks with the server in the background, first playing
// the intro when the app opens on the journal; one that isn't (or no longer is) gets the intro, which boots the journal once
// you sign in.
const shared = location.pathname.match(/^\/s\/([A-Za-z0-9_-]{32})\/?$/);
const status = location.pathname.match(/^\/status\/([A-Za-z0-9_-]{32})\/?$/);
if (shared) void bootShared(shared[1]);
else if (status) void bootStatus(status[1]);
else if (signedInHere()) {
  if (routeName() === 'journal' && !introSeen() && !matchMedia('(prefers-reduced-motion: reduce)').matches) void openWithIntro();
  else boot();
  void stillSignedIn().then((ok) => ok || location.reload());
} else void gate();

async function bootShared(token: string) {
  try {
    const { Shared } = await import('./views/Shared');
    render(<Shared token={token} />, document.getElementById('app')!);
  } catch (e) {
    failed(e, false);
  }
}

/** A public status's link: just the latest check-in, for anyone, like a public note. */
async function bootStatus(token: string) {
  try {
    const { Status } = await import('./views/Status');
    render(<Status token={token} />, document.getElementById('app')!);
  } catch (e) {
    failed(e, false);
  }
}

/** Signed out here: the intro, unless the server has no password to ask for or this browser's cookie is still good. */
async function gate() {
  const intro = prepareView('intro');
  intro?.catch(() => {}); // only waited for below, when the intro is what opens
  const status = await authStatus();
  if (opensOn(status) === 'app') {
    if (status?.admin) rememberSignedIn(true);
    return boot();
  }
  try {
    await intro;
  } catch (e) {
    return failed(e, false);
  }
  const Intro = viewFor('intro') as ComponentType<IntroProps>;
  render(
    <Intro
      onEnter={(dive) => {
        if (routeName() === 'intro') history.replaceState(history.state, '', '#/');
        boot(dive);
      }}
    />,
    document.getElementById('app')!,
  );
}

/** Opening the app, signed in: the intro plays and goes in by itself, while storage and the journal load behind it. */
async function openWithIntro() {
  let entered!: (dive: Promise<void>) => void;
  boot(new Promise<void>((done) => { entered = (dive) => void dive.then(done); }));
  try {
    await prepareView('intro');
  } catch {
    return entered(Promise.resolve()); // offline without it: straight in
  }
  const Intro = viewFor('intro') as ComponentType<IntroProps>;
  render(<Intro auto onEnter={entered} />, document.getElementById('app')!);
}

/** Start storage and the first screen together (and the intro's dive, when coming from it). Other screens load only
 * when visited; the service worker still precaches every screen for offline use. */
function boot(dive?: Promise<void>) {
  let databaseError = false;
  const database = init().catch((error) => { databaseError = true; throw error; });
  Promise.all([database, prepareView(routeName()), dive]).then(async () => {
    // A deep link may change while storage or a screen is loading.
    let name;
    do { name = routeName(); await prepareView(name); } while (name !== routeName());
  }).then(
    () => {
      render(<App />, document.getElementById('app')!);
      // Keep the entrance style on this page for its lifetime. Removing it after a
      // timeout starts the normal page-in animation and briefly hides the page again.
      document.querySelector('.app .page')?.setAttribute('data-boot', '');
      startWeather();
      initSync();
      initStatus();
      enableOffline();
      preloadViews();
    },
    // not over the intro while it's still playing
    (e) => void Promise.resolve(dive).then(() => failed(e, databaseError)),
  );
}

function failed(e: unknown, databaseError: boolean) {
  console.error('Could not start My Mind', e);
  render(
    <div class="page"><div class="empty">
      <h2 class="title-s">{t('Couldn’t open your journal')}</h2>
      <p>{databaseError ? t('Your browser’s storage is unavailable. Try reopening the app or reloading this page.') : t('Couldn’t load the app. Check your connection and try again.')}</p>
      <button class="btn" onClick={() => location.reload()}>{t('Try again')}</button>
    </div></div>,
    document.getElementById('app')!,
  );
}

function enableOffline() {
  // Precaching other screens must not compete with loading the first screen.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = () => navigator.serviceWorker.register('/sw.js').catch((e) => console.error('Could not enable offline access', e));
  if (document.readyState === 'complete') void register();
  else addEventListener('load', register, { once: true });
}
