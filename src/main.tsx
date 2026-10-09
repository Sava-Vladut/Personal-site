import { render } from 'preact';
import '@fontsource-variable/source-serif-4/wght.css';
import '@fontsource-variable/instrument-sans/index.css';
import './styles/app.css';
import './styles/books.css';
import './styles/glass.css';
import './styles/brain.css';
// Keep the original cascade (desktop last), even though screen code now loads separately.
import './styles/objects.css';
import './styles/mentions.css';
import './styles/wheel.css';
import './styles/notes.css';
import 'photoswipe/style.css';
import './styles/voice.css';
import './styles/sotd.css';
import './styles/map.css';
import './styles/stats.css';
import './styles/twitch.css';
import { App } from './app';
import './styles/desktop.css';
import { applyTheme, init } from './lib/store';
import { onBlocked } from './lib/db';
import { initSync } from './lib/sync';
import { startWeather } from './lib/weather';
import { t } from './lib/i18n';
import { routeName } from './lib/router';
import { prepareView } from './lib/views';

applyTheme();
// iOS only shows :active (the press feedback on cards and buttons) once the page listens for touches.
addEventListener('touchstart', () => {}, { passive: true });
// The first page to show rises in piece by piece; later pages use the route transitions instead.
document.documentElement.classList.add('booting');
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
// Start storage and the first screen together. Other screens load only when visited;
// the service worker still precaches every screen for offline use.
let databaseError = false;
const database = init().catch((error) => { databaseError = true; throw error; });
Promise.all([database, prepareView(routeName())]).then(async () => {
  // A deep link may change while storage or a screen is loading.
  let name;
  do { name = routeName(); await prepareView(name); } while (name !== routeName());
}).then(
  () => {
    render(<App />, document.getElementById('app')!);
    setTimeout(() => document.documentElement.classList.remove('booting'), 1000);
    startWeather();
    initSync();
    enableOffline();
  },
  (e) => {
    console.error('Could not start My Mind', e);
    document.documentElement.classList.remove('booting');
    render(
      <div class="page"><div class="empty">
        <h2 class="title-s">{t('Couldn’t open your journal')}</h2>
        <p>{databaseError ? t('Your browser’s storage is unavailable. Try reopening the app or reloading this page.') : t('Couldn’t load the app. Check your connection and try again.')}</p>
        <button class="btn" onClick={() => location.reload()}>{t('Try again')}</button>
      </div></div>,
      document.getElementById('app')!,
    );
  },
);

function enableOffline() {
  // Precaching other screens must not compete with loading the first screen.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = () => navigator.serviceWorker.register('/sw.js').catch((e) => console.error('Could not enable offline access', e));
  if (document.readyState === 'complete') void register();
  else addEventListener('load', register, { once: true });
}
