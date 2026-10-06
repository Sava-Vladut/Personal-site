import { useEffect, useState } from 'preact/hooks';
import { isIOS, lockError, replacePasskey, unlockApp, unlockName, unlockPeople } from '../lib/lock';
import { Icon } from './icons';
import { t } from '../lib/i18n';

const Name = unlockName[0].toUpperCase() + unlockName.slice(1);

/**
 * What shows in place of the app (or of People) until Face ID says it's you. It asks by itself when it
 * appears; on iPhone a tap anywhere on it asks again, if the system sheet was closed.
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
    <div class={`page lock-page lock-${scope}`} onClick={() => { if (isIOS && !busy) void run(unlock); }}>
      <div class="lock">
        <span class="lock-icon"><Icon name="face-id" size={36} stroke={1.5} /></span>
        <h1 class="title-s">{scope === 'app' ? t('My Mind is locked') : t('People is locked')}</h1>
        <p class="muted">{isIOS ? t('Tap anywhere to use {name}.', { name: unlockName }) : scope === 'app' ? t('Use {name} to open your journal.', { name: unlockName }) : t('Use {name} to see the people in your life.', { name: unlockName })}</p>
        <button class="btn btn-primary" onClick={(e) => { e.stopPropagation(); void run(unlock); }} disabled={busy}>
          <Icon name="lock-open" size={18} /> {t('Unlock with {name}', { name: Name })}
        </button>
        {error && <p class="lock-error" role="alert">{error}</p>}
        {failed && (
          <button class="lock-reset" onClick={(e) => { e.stopPropagation(); void run(() => replacePasskey(scope)); }} disabled={busy}>
            {t('Still not working? Set up {name} again', { name: Name })}
          </button>
        )}
      </div>
    </div>
  );
}
