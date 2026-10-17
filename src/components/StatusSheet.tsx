import { useEffect, useState } from 'preact/hooks';
import { EMOTION, shortName } from '../data/emotions';
import { timeLabel } from '../lib/dates';
import { toast, useEntries } from '../lib/store';
import { latestCheckin, loadStatus, publicCheckin, shareStatus, statusUrl, stopStatus, useStatus, useStatusError } from '../lib/status';
import { INTENSITY } from './emotion';
import { Icon, Sprite } from './icons';
import { Sheet } from './Sheet';
import { ask } from './Confirm';
import { t } from '../lib/i18n';
import '../styles/shared.css';

/**
 * Sharing your status: one link that always shows your latest check-in. Off until turned on here; the note of a check-in
 * only shows when "Show the note" is on. The link is secret, but anyone who has it can see it, so it can be stopped any time.
 */
export function StatusSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const status = useStatus();
  const loadError = useStatusError();
  const entries = useEntries();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState(false);
  useEffect(() => {
    if (!open) return;
    setError('');
    void loadStatus();
  }, [open]);
  useEffect(() => {
    if (status) setNote(status.note);
  }, [status?.token, status?.note]);

  const on = !!status?.token;
  const url = status?.token ? statusUrl(status.token) : '';
  const latest = latestCheckin(entries);
  const preview = latest && publicCheckin(latest, note);
  const em = preview && EMOTION[preview.emotion];

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
  const start = () => run(async () => {
    await shareStatus(note);
    toast(t('Your status is public'));
  });
  const toggleNote = () => {
    const next = !note;
    setNote(next);
    if (on) void run(async () => {
      try {
        await shareStatus(next);
      } catch (e) {
        setNote(!next);
        throw e;
      }
      toast(next ? t('The note shows on your status') : t('The note is hidden from your status'));
    });
  };
  const stop = async () => {
    if (!(await ask({ title: t('Stop sharing your status?'), text: t('Its link will stop working for everyone. Sharing it again makes a new link.'), ok: t('Stop sharing'), danger: true }))) return;
    return run(async () => {
      await stopStatus();
      toast(t('Your status isn’t public anymore'));
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
  const send = () => navigator.share({ title: t('How I’m feeling'), url }).catch(() => {});

  return (
    <Sheet open={open} onClose={onClose} title={t('Public status')}>
      <div class="share-sheet">
        <p class="share-lead">
          {on
            ? t('Anyone with this link sees your latest check-in. It updates by itself each time you check in.')
            : t('Share a link that always shows your latest check-in: the feeling, how strong it is and when. It updates by itself each time you check in.')}
        </p>

        <div class="status-preview" style={em ? { '--c': `var(--emo-${em.core})` } : undefined}>
          {em && preview ? (
            <>
              <Sprite core={em.core} size={22} />
              <span class="status-preview-main">
                <span class="status-preview-name">{em.depth === 0 ? shortName(em.id) : em.name} · <span class="muted">{INTENSITY[preview.intensity - 1]} · {timeLabel(preview.time)}</span></span>
                {preview.text && <span class="status-preview-note">“{preview.text}”</span>}
              </span>
            </>
          ) : (
            <span class="muted">{t('No check-in yet. The page shows your next one.')}</span>
          )}
        </div>

        <label class="share-part">
          <Icon name="quote" size={18} />
          <span class="share-part-main">
            <span class="share-part-name">{t('Show the note')}</span>
            <span class="share-part-value">{t('What you wrote with the check-in')}</span>
          </span>
          <button class="switch" role="switch" aria-checked={note} aria-label={t('Show the note')} onClick={toggleNote} disabled={busy} />
        </label>
        {note && (
          <p class="share-parts-note"><Icon name="alert-circle" size={14} /> {t('Names written in the note can be read by anyone with the link.')}</p>
        )}

        {on ? (
          <>
            <div class="share-link">
              <input class="input" readOnly value={url} aria-label={t('Public link')} onFocus={(e) => e.currentTarget.select()} />
              <button class="btn btn-quiet" onClick={copy}><Icon name="copy" size={16} /> {t('Copy')}</button>
              {'share' in navigator && <button class="btn btn-quiet" onClick={send} aria-label={t('Share')}><Icon name="share" size={16} /></button>}
            </div>
            <button class="btn btn-quiet share-stop" onClick={stop} disabled={busy}>{t('Stop sharing')}</button>
          </>
        ) : (
          <button class="btn btn-primary share-main" onClick={start} disabled={busy || (!status && !!loadError)}>
            {busy ? t('Making it public…') : t('Make public')}
          </button>
        )}
        {(error || (!status && loadError)) && <p class="share-error" role="alert">{error || loadError}</p>}
      </div>
    </Sheet>
  );
}
