import { useEffect, useState } from 'preact/hooks';
import { changedSince, publish, shareUrl, unpublish } from '../lib/share';
import { toast, type Entry, type Share } from '../lib/store';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { t } from '../lib/i18n';
import '../styles/shared.css';

/**
 * Making this one note public. Off until turned on here, for this note only. The link is secret (nobody can guess it),
 * but anyone who has it can read the note, so it can be switched off again at any time.
 */
export function ShareSheet({ open, onClose, entry, onChange }: { open: boolean; onClose: () => void; entry: Entry; onChange: (share: Share | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) setError('');
  }, [open]);

  const share = entry.share;
  const url = share ? shareUrl(share.token) : '';
  const changed = changedSince(entry);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const makePublic = () =>
    run(async () => {
      onChange(await publish(entry));
      toast(share ? t('Public copy updated') : t('This note is public'));
    });
  const stop = () => {
    if (!share || !confirm(t('Stop sharing this note? Its link will stop working for everyone.'))) return;
    return run(async () => {
      await unpublish(share.token);
      onChange(null);
      toast(t('Not public anymore'));
    });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t('Link copied'));
    } catch {
      toast(t('Couldn’t copy — select it and copy by hand'));
    }
  };
  const send = () => navigator.share({ title: entry.title.trim() || undefined, url }).catch(() => {});

  return (
    <Sheet open={open} onClose={onClose} title={t('Public link')}>
      <div class="share-sheet">
        {!share ? (
          <>
            <p class="share-lead">{t('Anyone with the link can read this note without signing in. Only this note is shared, and you can stop at any time.')}</p>
            <ul class="share-facts">
              <li><Icon name="check" size={16} /> <span>{t('Shared: the title, the text, the pictures and the day.')}</span></li>
              <li><Icon name="lock" size={16} /> <span>{t('Stays private: feelings, people, place, weather and music.')}</span></li>
              <li><Icon name="alert-circle" size={16} /> <span>{t('Names written in the text can be read by anyone with the link.')}</span></li>
            </ul>
            <button class="btn btn-primary share-main" onClick={makePublic} disabled={busy}>
              {busy ? t('Making it public…') : t('Make public')}
            </button>
          </>
        ) : (
          <>
            <p class="share-lead">{t('Anyone with this link can read this note. Nobody can find it without the link.')}</p>
            <div class="share-link">
              <input class="input" readOnly value={url} aria-label={t('Public link')} onFocus={(e) => e.currentTarget.select()} />
              <button class="btn btn-quiet" onClick={copy}><Icon name="copy" size={16} /> {t('Copy')}</button>
              {'share' in navigator && <button class="btn btn-quiet" onClick={send} aria-label={t('Share')}><Icon name="share" size={16} /></button>}
            </div>
            {changed ? (
              <div class="share-changed">
                <span>{t('You’ve edited this note since it was shared. The public page still shows the earlier version.')}</span>
                <button class="btn btn-primary btn-s" onClick={makePublic} disabled={busy}>{busy ? t('Updating…') : t('Update public copy')}</button>
              </div>
            ) : (
              <p class="share-ok"><Icon name="check" size={16} /> {t('The public page shows this note as it is now.')}</p>
            )}
            <button class="btn btn-quiet share-stop" onClick={stop} disabled={busy}>{t('Stop sharing')}</button>
          </>
        )}
        {error && <p class="share-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
