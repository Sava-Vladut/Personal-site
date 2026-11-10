import { useEffect, useState } from 'preact/hooks';
import { goBack } from '../lib/router';
import { signIn } from '../lib/auth';
import { PageHead } from '../components/PageHead';
import { Sky } from '../components/Sky';
import { t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/tiktok.css';

const WORLD = 'love-connection';
const VIEWER = '/api/tiktok/';

type State = 'checking' | 'open' | 'locked' | 'down';

async function check(): Promise<State> {
  try {
    const r = await fetch(VIEWER + 'api/status', { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    return r.ok ? 'open' : r.status === 403 ? 'locked' : 'down';
  } catch {
    return 'down';
  }
}

/**
 * Saved TikToks: the favorites viewer and its download page (github.com/Sava-Vladut/tiktok-favorites-viewer), which
 * run in their own container on the server and download with yt-dlp there. Only for the signed-in admin; the server
 * passes /api/tiktok/ on to it. Once signed in, this page hands the whole window to the viewer (replacing itself in
 * the history), so it fills the screen with nothing of My Mind around it.
 */
export function Tiktok() {
  const [state, setState] = useState<State>('checking');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { void check().then(setState); }, []);
  useEffect(() => { if (state === 'open') location.replace(VIEWER); }, [state]);

  const login = async (e: Event) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await signIn(password);
      setPassword('');
      setState(await check());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="page stats-page tt-page">
      <div class="journal-top stats-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead title={t('Saved TikToks')} back={() => goBack()} />
      </div>
      {state === 'open' || state === 'checking' ? (
        <p class="empty-note center loading-note">{t('Loading…')}</p>
      ) : state === 'locked' ? (
        <div class="empty fade-arrive-soft">
          <h2 class="title-s">{t('Saved TikToks are private')}</h2>
          <p>{t('Enter the admin password to see and download them. This device stays signed in.')}</p>
          <form class="tt-login" onSubmit={login}>
            <input
              class="input"
              type="password"
              value={password}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder={t('Admin password')}
              aria-label={t('Admin password')}
              autocomplete="current-password"
              enterkeyhint="go"
            />
            <button class="btn btn-primary" type="submit" disabled={busy || !password}>{busy ? t('Signing in…') : t('Sign in')}</button>
          </form>
          {error && <p class="hint danger fade-arrive-soft" role="alert">{error}</p>}
        </div>
      ) : (
        <div class="empty fade-arrive-soft">
          <h2 class="title-s">{t('The TikTok downloader isn’t running')}</h2>
          <p>{t('It runs in its own container on the server. Try again in a minute.')}</p>
          <button class="btn btn-primary" onClick={() => { setState('checking'); void check().then(setState); }}>{t('Try again')}</button>
        </div>
      )}
    </div>
  );
}
