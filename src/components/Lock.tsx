import { useEffect, useState } from 'preact/hooks';
import { lockError, replacePasskey, unlockApp, unlockName, unlockPeople } from '../lib/lock';
import { Icon } from './icons';

const Name = unlockName[0].toUpperCase() + unlockName.slice(1);

/**
 * What shows in place of the app (or of People) until Face ID says it's you. It asks by itself when it
 * appears; if the browser wants a tap first, the button is right there.
 */
export function LockScreen({ scope }: { scope: 'app' | 'people' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = async (how: () => Promise<void>, quiet = false) => {
    setBusy(true);
    setError(null);
    try {
      await how();
    } catch (e) {
      // the first, automatic ask can be turned down by the browser for want of a tap: that's not a failure
      if (quiet) return;
      const m = lockError(e);
      if (m) { setError(m); setFailed(true); }
    } finally {
      setBusy(false);
    }
  };
  const unlock = scope === 'app' ? unlockApp : unlockPeople;

  useEffect(() => { void run(unlock, true); }, []);

  return (
    <div class={`page lock-page lock-${scope}`}>
      <div class="lock">
        <span class="lock-icon"><Icon name="face-id" size={36} stroke={1.5} /></span>
        <h1 class="title-s">{scope === 'app' ? 'My Mind is locked' : 'People is locked'}</h1>
        <p class="muted">{scope === 'app' ? `Use ${unlockName} to open your journal.` : `Use ${unlockName} to see the people in your life.`}</p>
        <button class="btn btn-primary" onClick={() => run(unlock)} disabled={busy}>
          <Icon name="lock-open" size={18} /> Unlock with {Name}
        </button>
        {error && <p class="lock-error" role="alert">{error}</p>}
        {failed && (
          <button class="lock-reset" onClick={() => run(() => replacePasskey(scope))} disabled={busy}>
            Still not working? Set up {Name} again
          </button>
        )}
      </div>
    </div>
  );
}
