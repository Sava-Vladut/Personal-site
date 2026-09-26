import { render } from 'preact';
import '@fontsource-variable/source-serif-4/wght.css';
import '@fontsource-variable/instrument-sans/index.css';
import './styles/app.css';
import './styles/glass.css';
import { App } from './app';
import { applyTheme, init } from './lib/store';

applyTheme();
init()
  .catch((e) => console.error('Could not open the journal database', e))
  .finally(() => render(<App />, document.getElementById('app')!));

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
