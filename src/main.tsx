import { render } from 'preact';
import '@fontsource-variable/source-serif-4/wght.css';
import '@fontsource-variable/instrument-sans/index.css';
import './styles/app.css';
import './styles/glass.css';
import { App } from './app';
import { applyTheme, init } from './lib/store';
import { onBlocked } from './lib/db';
import { initSync } from './lib/sync';
import { startWeather } from './lib/weather';

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
        <h2 class="title-s">Finishing an update</h2>
        <p>My Mind is open somewhere else on this device (another tab or the installed app). Close it and this page will continue by itself.</p>
      </div>
    </div>,
    document.getElementById('app')!,
  ),
);
init()
  .then(() => {
    startWeather();
    return initSync();
  })
  .catch((e) => console.error('Could not open the journal database', e))
  .finally(() => {
    render(<App />, document.getElementById('app')!);
    setTimeout(() => document.documentElement.classList.remove('booting'), 1000);
  });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
