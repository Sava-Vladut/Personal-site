import { render } from 'preact';
import '@fontsource-variable/source-serif-4/wght.css';
import '@fontsource-variable/instrument-sans/index.css';
import './styles/app.css';
import './styles/glass.css';
import { App } from './app';
import { applyTheme, init } from './lib/store';
import { onBlocked } from './lib/db';

applyTheme();
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
  .catch((e) => console.error('Could not open the journal database', e))
  .finally(() => render(<App />, document.getElementById('app')!));

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
