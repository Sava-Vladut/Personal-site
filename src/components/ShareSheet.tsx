import { useEffect, useState } from 'preact/hooks';
import { EMOTION, shortName } from '../data/emotions';
import { fingerprint, partsOf, publicNote, publish, shareUrl, unpublish } from '../lib/share';
import { toast, type Entry, type Share, type SharePart } from '../lib/store';
import { INTENSITY } from './emotion';
import { Icon, type UiName } from './icons';
import { usePeopleById } from './people';
import { placeLabel, weatherLine } from './weather';
import { Sheet } from './Sheet';
import { t } from '../lib/i18n';
import { ask } from './Confirm';
import '../styles/shared.css';

const PART_LABEL: Record<SharePart, string> = {
  feelings: t('Feelings'),
  people: t('People'),
  place: t('Place'),
  weather: t('Weather'),
  music: t('Music'),
};
const PART_ICON: Record<SharePart, UiName> = { feelings: 'mood-smile', people: 'users', place: 'map-pin', weather: 'cloud', music: 'music' };

/** What a detail would show, so it's clear what turning it on gives away. */
function PartValue({ part, entry }: { part: SharePart; entry: Entry }) {
  const byId = usePeopleById();
  switch (part) {
    case 'feelings':
      return <>{entry.emotions.map((id) => (EMOTION[id]?.depth === 0 ? shortName(id) : EMOTION[id]?.name ?? '')).filter(Boolean).join(', ')} · {INTENSITY[entry.intensity - 1]}</>;
    case 'people':
      return <>{entry.people.map((id) => byId.get(id)?.name.trim()).filter(Boolean).join(', ')}</>;
    case 'place':
      return <>{entry.place && placeLabel(entry.place)}</>;
    case 'weather':
      return <>{entry.weather && weatherLine(entry.weather)}</>;
    case 'music':
      return <>{entry.music.map((m) => m.title).join(', ')}</>;
  }
}

/**
 * Making this one note public. Off until turned on here, for this note only. The link is secret (nobody can guess it),
 * but anyone who has it can read the note, so it can be switched off again at any time.
 */
export function ShareSheet({ open, onClose, entry, onChange }: { open: boolean; onClose: () => void; entry: Entry; onChange: (share: Share | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [parts, setParts] = useState<SharePart[]>(entry.share?.parts ?? []);
  useEffect(() => {
    if (!open) return;
    setError('');
    setParts(entry.share?.parts ?? []);
  }, [open]);

  const share = entry.share;
  const url = share ? shareUrl(share.token) : '';
  const offered = partsOf(entry);
  const chosen = parts.filter((p) => offered.includes(p));
  const changed = !!share && share.hash !== fingerprint(publicNote(entry, chosen));
  const toggle = (p: SharePart) => setParts((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));

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
      onChange(await publish(entry, chosen));
      toast(share ? t('Public copy updated') : t('This note is public'));
    });
  const stop = async () => {
    if (!share || !(await ask({ title: t('Stop sharing this note?'), text: t('Its link will stop working for everyone.'), ok: t('Stop sharing'), danger: true }))) return;
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

  const parts_ = offered.length > 0 && (
    <div class="share-parts">
      <div class="share-parts-head">{t('Also show')}</div>
      {offered.map((p) => (
        <label class="share-part" key={p}>
          <Icon name={PART_ICON[p]} size={18} />
          <span class="share-part-main">
            <span class="share-part-name">{PART_LABEL[p]}</span>
            <span class="share-part-value"><PartValue part={p} entry={entry} /></span>
          </span>
          <button class="switch" role="switch" aria-checked={chosen.includes(p)} aria-label={PART_LABEL[p]} onClick={() => toggle(p)} disabled={busy} />
        </label>
      ))}
      <p class="share-parts-note">
        <Icon name="lock" size={14} />
        {t('Off stays private. People show by name only, a place by its name only.')}
      </p>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={t('Public link')}>
      <div class="share-sheet">
        {!share ? (
          <>
            <p class="share-lead">{t('Anyone with the link can read this note without signing in. Only this note is shared, and you can stop at any time.')}</p>
            <ul class="share-facts">
              <li><Icon name="check" size={16} /> <span>{t('Always shared: the title, the text, the pictures and the day.')}</span></li>
              <li><Icon name="alert-circle" size={16} /> <span>{t('Names written in the text can be read by anyone with the link.')}</span></li>
            </ul>
            {parts_}
            <button class="btn btn-primary share-main" onClick={makePublic} disabled={busy}>
              {busy ? t('Making it public…') : t('Make public')}
            </button>
          </>
        ) : (
          <>
            <p class="share-lead">{t('Anyone with this link can read this note. Nobody can find it without the link.')}</p>
            {parts_}
            <div class="share-link">
              <input class="input" readOnly value={url} aria-label={t('Public link')} onFocus={(e) => e.currentTarget.select()} />
              <button class="btn btn-quiet" onClick={copy}><Icon name="copy" size={18} /> {t('Copy')}</button>
              {'share' in navigator && <button class="btn btn-quiet" onClick={send} aria-label={t('Share')}><Icon name="share" size={18} /></button>}
            </div>
            {changed ? (
              <div class="share-changed">
                <span>{t('The public page shows an earlier version of this note, or other details than the ones chosen here.')}</span>
                <button class="btn btn-primary btn-s" onClick={makePublic} disabled={busy}>{busy ? t('Updating…') : t('Update public copy')}</button>
              </div>
            ) : (
              <p class="share-ok"><Icon name="check" size={16} /> {t('The public page shows this note as it is now.')}</p>
            )}
            <button class="btn btn-quiet share-stop danger" onClick={stop} disabled={busy}>{t('Stop sharing')}</button>
          </>
        )}
        {error && <p class="share-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
