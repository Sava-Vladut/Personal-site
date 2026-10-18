import { useEffect, useState } from 'preact/hooks';
import { EMOTION, shortName } from '../data/emotions';
import { fmtTemp, weatherName } from '../data/weather';
import { timeLabel } from '../lib/dates';
import { toast, useEntries } from '../lib/store';
import { SHOW_NONE, latestCheckin, loadStatus, publicCheckin, shareStatus, statusUrl, stopStatus, useStatus, useStatusError, type Show } from '../lib/status';
import { countdownOn } from '../lib/countdown';
import { INTENSITY } from './emotion';
import { Icon, Sprite, type UiName } from './icons';
import { Sheet } from './Sheet';
import { ask } from './Confirm';
import { LANGS, lang, t, type Lang } from '../lib/i18n';
import '../styles/shared.css';

const PARTS: { key: keyof Show; icon: UiName; label: string; hint: string }[] = [
  { key: 'note', icon: 'quote', label: t('The note'), hint: t('What you wrote with the check-in') },
  { key: 'people', icon: 'heart', label: t('Thinking of'), hint: t('The people you tagged, by name') },
  { key: 'place', icon: 'map-pin', label: t('Place'), hint: t('Where you were, by its name only') },
  { key: 'weather', icon: 'cloud', label: t('Weather'), hint: t('The sky and temperature then') },
  { key: 'countdown', icon: 'hourglass', label: t('Countdown'), hint: t('The timer to 30 October, 07:00, ticking live') },
];

/**
 * Sharing your status: one link that always shows your latest check-in. Off until turned on here; the note, the people
 * you were thinking of, the place and the weather each only show when switched on. The link is secret, but anyone who
 * has it can see it, so it can be stopped any time. The page is in the language chosen here, whatever the reader's device uses.
 */
export function StatusSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const status = useStatus();
  const loadError = useStatusError();
  const entries = useEntries();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState<Show>(SHOW_NONE);
  const [owner, setOwner] = useState('');
  const [pageLang, setPageLang] = useState<Lang>(lang);
  useEffect(() => {
    if (!open) return;
    setError('');
    void loadStatus();
  }, [open]);
  useEffect(() => {
    if (!status) return;
    setShow(status.show);
    setOwner(status.owner);
    // a status from before it had a language showed in English to nearly everyone; a new one starts in the app's
    setPageLang(status.token ? status.lang || 'en' : lang);
  }, [status?.token, JSON.stringify(status?.show), status?.owner, status?.lang]);

  const on = !!status?.token;
  const url = status?.token ? statusUrl(status.token) : '';
  const latest = latestCheckin(entries);
  const preview = latest && publicCheckin(latest, show);
  const em = preview && EMOTION[preview.emotion];
  const d = preview?.details;

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
    await shareStatus(show, owner, pageLang);
    toast(t('Your status is public'));
  });
  const toggle = (key: keyof Show) => {
    const before = show;
    const next = { ...show, [key]: !show[key] };
    setShow(next);
    if (on) void run(async () => {
      try {
        await shareStatus(next, owner, pageLang);
      } catch (e) {
        setShow(before);
        throw e;
      }
    });
  };
  const saveOwner = () => {
    const name = owner.replace(/\s+/g, ' ').trim();
    setOwner(name);
    if (on && name !== status?.owner) void run(async () => {
      await shareStatus(show, name, pageLang);
      toast(t('Name updated'));
    });
  };
  const pickLang = (next: Lang) => {
    if (next === pageLang) return;
    const before = pageLang;
    setPageLang(next);
    if (on) void run(async () => {
      try {
        await shareStatus(show, owner, next);
        toast(t('Language updated'));
      } catch (e) {
        setPageLang(before);
        throw e;
      }
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
  const send = () => navigator.share({ title: owner ? t('How {name} is feeling', { name: owner }) : t('How I’m feeling'), url }).catch(() => {});

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
                {(d?.people || d?.place || d?.weather) && (
                  <span class="status-preview-extra">
                    {d.people && <span><Icon name="heart" size={13} /> {d.people.map((p) => p.name).join(', ')}</span>}
                    {d.place && <span><Icon name="map-pin" size={13} /> {d.place.name}</span>}
                    {d.weather && <span><Icon name="cloud" size={13} /> {fmtTemp(d.weather.temp)} · {weatherName(d.weather.code)}</span>}
                  </span>
                )}
              </span>
            </>
          ) : (
            <span class="muted">{t('No check-in yet. The page shows your next one.')}</span>
          )}
        </div>

        <label class="status-owner">
          <span class="field-label">{t('Your name')} <span class="muted">· {t('optional')}</span></span>
          <input
            class="input"
            value={owner}
            maxLength={40}
            placeholder={t('So they know whose status it is')}
            onInput={(e) => setOwner(e.currentTarget.value)}
            onBlur={saveOwner}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            enterkeyhint="done"
            autocomplete="given-name"
          />
        </label>

        <div class="status-lang">
          <span class="field-label">{t('Page language')}</span>
          <div class="seg compact" role="radiogroup" aria-label={t('Page language')}>
            {LANGS.map(([v, l]) => (
              <button role="radio" lang={v} aria-checked={pageLang === v} aria-selected={pageLang === v} onClick={() => pickLang(v)} disabled={busy}>{l}</button>
            ))}
          </div>
        </div>

        <div class="share-parts">
          <div class="share-parts-head">{t('Also show')}</div>
          {PARTS.filter((p) => p.key !== 'countdown' || countdownOn()).map((p) => (
            <label class="share-part" key={p.key}>
              <Icon name={p.icon} size={18} />
              <span class="share-part-main">
                <span class="share-part-name">{p.label}</span>
                <span class="share-part-value">{p.hint}</span>
              </span>
              <button class="switch" role="switch" aria-checked={show[p.key]} aria-label={p.label} onClick={() => toggle(p.key)} disabled={busy} />
            </label>
          ))}
          <p class="share-parts-note">
            <Icon name="lock" size={14} />
            {show.note ? t('Off stays private. Names written in the note can be read by anyone with the link.') : t('Off stays private. People show by name only, a place by its name only.')}
          </p>
        </div>

        {on ? (
          <>
            <div class="share-link">
              <input class="input" readOnly value={url} aria-label={t('Public link')} onFocus={(e) => e.currentTarget.select()} />
              <button class="btn btn-quiet" onClick={copy}><Icon name="copy" size={16} /> {t('Copy')}</button>
              {'share' in navigator && <button class="btn btn-quiet" onClick={send} aria-label={t('Share')}><Icon name="share" size={16} /></button>}
            </div>
            <a class="btn btn-quiet share-stop" href={url} target="_blank" rel="noopener"><Icon name="external-link" size={16} /> {t('Open the page')}</a>
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
