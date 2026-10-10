import { useEffect, useRef, useState } from 'preact/hooks';
import { connectSpotify, disconnectSpotify, spotifyStatus, type SpotifyStatus } from '../lib/spotify';
import { goBack, navigate } from '../lib/router';
import { exportText } from '../lib/exportText';
import { deleteAll, exportJSON, getSettings, importJSON, setSettings, toast, useBooks, useEntries, usePeople, useSettings, useSongs, type Place, type Settings as S } from '../lib/store';
import { resolveIcon } from '../lib/icons';
import { shortDate, todayKey } from '../lib/dates';
import { fillWeather, forgetFix, here, locationError } from '../lib/weather';
import { Icon, type UiName } from '../components/icons';
import { ConnectSetup } from '../components/ConnectSetup';
import { Sheet } from '../components/Sheet';
import { VoiceLanguage, VoiceModels, VoiceProgress } from '../components/VoiceButton';
import { downloadModel, removeModels, useVoice, voiceModel, voiceSupported } from '../lib/voice';
import { HomeSheet, placeLabel } from '../components/weather';
import { CHANGELOG, VERSION } from '../data/changelog';
import { formatCode, joinSync, removeServerCopy, startSync, stopSync, useSync } from '../lib/sync';
import { LOCALE, LANGS, count, lang, listOf, rich, setLang, t } from '../lib/i18n';

// Chrome/Android offer an install prompt; iOS uses Share → Add to Home Screen.
let installEvent: (Event & { prompt: () => Promise<void> }) | null = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e as typeof installEvent;
});

// Safari on an iPhone or iPad forgets a site's location answer when it closes, unless the site is set to Allow
const iOS = typeof navigator !== 'undefined' && (/iPhone|iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('Copied'));
  } catch {
    toast(t('Couldn’t copy — select it and copy by hand'));
  }
};

function ago(time: number) {
  const m = Math.round((Date.now() - time) / 60_000);
  return m < 1 ? t('just now') : m < 60 ? t('{n} min ago', { n: m }) : m < 1440 ? t('{n} h ago', { n: Math.round(m / 60) }) : new Date(time).toLocaleDateString(LOCALE);
}

export function Settings({ query }: { query: URLSearchParams }) {
  const settings = useSettings();
  const entries = useEntries();
  const people = usePeople();
  const books = useBooks();
  const songs = useSongs();
  const sync = useSync();
  const [joining, setJoining] = useState(false);
  const [sp, setSp] = useState<SpotifyStatus | null>(null);
  const [setup, setSetup] = useState(false);
  const [changelog, setChangelog] = useState(false);
  const [homeOpen, setHomeOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const standalone = matchMedia('(display-mode: standalone)').matches;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);

  useEffect(() => {
    spotifyStatus().then(setSp);
    const s = query.get('spotify');
    if (s) {
      toast(s === 'connected' ? t('Spotify connected') : s === 'cancelled' ? t('Spotify login cancelled') : t('Couldn’t connect Spotify — try again'));
      navigate('settings', true);
    }
  }, []);

  const download = async () => {
    const blob = new Blob([await exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `my-mind-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const downloadText = () => {
    const blob = new Blob([exportText()], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `my-mind-${todayKey()}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const upload = async (f: File) => {
    try {
      const r = await importJSON(await f.text());
      r.icons.forEach((id) => { void resolveIcon(id).catch(() => {}); });
      const parts = [
        r.changed ? count(r.changed, 'entry', 'entries') : '',
        r.people ? count(r.people, 'person', 'people') : '',
        r.books ? count(r.books, 'book', 'books') : '',
        r.songs ? count(r.songs, 'record', 'records') : '',
        r.photos ? count(r.photos, 'photo', 'photos') : '',
      ].filter(Boolean);
      toast(parts.length ? t('Imported {list}', { list: listOf(parts) }) : t('Nothing new in that backup'));
    } catch {
      toast(t('That file isn’t a My Mind backup'));
    }
  };
  const wipe = async () => {
    const what = listOf([
      count(entries.length, 'entry', 'entries'), people.length ? count(people.length, 'person', 'people') : '', books.length ? count(books.length, 'book', 'books') : '',
      songs.length ? count(songs.length, 'record', 'records') : '',
    ].filter(Boolean));
    const question = sync.on
      ? t('Delete all {what} from this device and every device synced with it? This can’t be undone — export a backup first if you might want them.', { what })
      : t('Delete all {what} from this device? This can’t be undone — export a backup first if you might want them.', { what });
    if (!confirm(question)) return;
    await deleteAll();
    forgetFix();
    toast(t('All entries deleted'));
  };
  const toggleSync = () => {
    if (!sync.on) return startSync();
    if (!confirm(t('Stop syncing this device?\n\nYour entries stay here, and the copy on the server stays for your other devices. To reconnect, load with your code: {code}', { code: formatCode(sync.code!) }))) return;
    stopSync();
    toast(t('Sync turned off on this device'));
  };
  const removeServer = async () => {
    if (!confirm(t('Delete the copy on the server? Every device stops syncing and your code stops working. Entries already on your devices stay.'))) return;
    try {
      await removeServerCopy();
      toast(t('Server copy deleted'));
    } catch (e) {
      toast((e as Error).message);
    }
  };

  /** Fills in the weather for older entries, and says how many got it. */
  const fill = () =>
    fillWeather().then((n) => n && toast(t('Weather added to {count}', { count: count(n, 'entry', 'entries') })));
  const toggleWeather = () => {
    if (settings.weather) return setSettings({ weather: false });
    setSettings({ weather: true });
    if (settings.home) fill();
    else setHomeOpen(true);
  };
  const setHome = (home: Place) => {
    setSettings({ home });
    toast(t('Home set to {place}', { place: placeLabel(home) }));
    fill();
  };
  // Turning places on asks for your location there and then, so the browser's question comes with a reason.
  const togglePlaces = async () => {
    if (settings.places) return forgetFix(), setSettings({ places: false });
    setLocating(true);
    try {
      const p = await here();
      setSettings({ places: true });
      if (!getSettings().home) {
        setSettings({ home: p });
        toast(p.name ? t('Places are on · home set to {place}', { place: p.name }) : t('Places are on'));
      } else toast(t('Places are on'));
      fill();
    } catch (e) {
      toast(locationError(e));
    } finally {
      setLocating(false);
    }
  };

  const notes = entries.filter((e) => e.kind === 'note').length;
  const themes: [S['theme'], string, UiName][] = [['system', t('System'), 'device-desktop'], ['light', t('Light'), 'sun'], ['dark', t('Dark'), 'moon']];
  const pickers: [S['picker'], string, UiName][] = [['grid', t('Grid'), 'layout-grid'], ['wheel', t('Wheel'), 'chart-donut-2']];
  const densities: [S['density'], string, UiName][] = [['cards', t('Cards'), 'layout-list'], ['compact', t('Compact'), 'list']];

  return (
    <div class="page">
      <header class="page-head">
        <button class="back-link stats-back" onClick={() => goBack()}><Icon name="chevron-left" size={18} /> {t('Back')}</button>
        <h1 class="title">{t('Settings')}</h1>
      </header>

      <section class="section">
        <h2 class="section-title">{t('Appearance')}</h2>
        <div class="card list">
          <div class="list-row">
            <span>{t('Language')}</span>
            <div class="seg compact" role="radiogroup" aria-label={t('Language')}>
              {LANGS.map(([v, l]) => (
                <button role="radio" lang={v} aria-checked={lang === v} aria-selected={lang === v} onClick={() => setLang(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div class="list-row">
            <span>{t('Theme')}</span>
            <div class="seg compact" role="radiogroup" aria-label={t('Theme')}>
              {themes.map(([v, l, icon]) => (
                <button role="radio" aria-checked={settings.theme === v} aria-selected={settings.theme === v} onClick={() => setSettings({ theme: v })}>
                  <Icon name={icon} size={16} /> {l}
                </button>
              ))}
            </div>
          </div>
          <div class="list-row">
            <span>{t('Week starts on')}</span>
            <div class="seg compact" role="radiogroup" aria-label={t('Week starts on')}>
              {([[1, t('Monday')], [0, t('Sunday')]] as const).map(([v, l]) => (
                <button role="radio" aria-checked={settings.weekStart === v} aria-selected={settings.weekStart === v} onClick={() => setSettings({ weekStart: v })}>{l}</button>
              ))}
            </div>
          </div>
          <div class="list-row">
            <span>{t('Emotion picker')}</span>
            <div class="seg compact" role="radiogroup" aria-label={t('Emotion picker')}>
              {pickers.map(([v, l, icon]) => (
                <button role="radio" aria-checked={settings.picker === v} aria-selected={settings.picker === v} onClick={() => setSettings({ picker: v })}>
                  <Icon name={icon} size={16} /> {l}
                </button>
              ))}
            </div>
          </div>
          <div class="list-row">
            <span>{t('Journal layout')}</span>
            <div class="seg compact" role="radiogroup" aria-label={t('Journal layout')}>
              {densities.map(([v, l, icon]) => (
                <button role="radio" aria-checked={settings.density === v} aria-selected={settings.density === v} onClick={() => setSettings({ density: v })}>
                  <Icon name={icon} size={16} /> {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">{t('Privacy')}</h2>
        <div class="card list">
          <div class="list-row">
            <div>
              <div class="row gap-s"><Icon name="eye-off" size={18} /> {t('Blur notes & people')}</div>
              <div class="muted small">{t('Blurs your notes and the people in your lists, so no one can read them over your shoulder. Open a note to read it, or point at it on a computer.')}</div>
            </div>
            <button class="switch" role="switch" aria-checked={settings.blur} aria-label={t('Blur notes & people')} onClick={() => setSettings({ blur: !settings.blur })} />
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">{t('Weather & places')}</h2>
        <div class="card list">
          <div class="list-row">
            <div>
              <div class="row gap-s"><Icon name="haze" size={18} /> {t('Weather')}</div>
              <div class="muted small">{t('Adds the weather and hours of daylight to your entries, so Stats can show how they go with your mood. Open-Meteo is only sent a location, never what you write.')}</div>
            </div>
            <button class="switch" role="switch" aria-checked={settings.weather} aria-label={t('Weather')} onClick={toggleWeather} />
          </div>
          <div class="list-row">
            <div>
              <div class="row gap-s"><Icon name="map-pin" size={18} /> {t('Places')}</div>
              <div class="muted small">{locating ? t('Finding you…') : t('Saves where you are when you write, and puts your entries on a map. Uses your location, with names from OpenStreetMap.')}</div>
              {settings.places && iOS && (
                <div class="muted small settings-tip">
                  {rich('If your iPhone asks for your location every time: open {path} and choose {allow}. Then it won’t ask again.', { path: <b>{t('Settings › Apps › Safari › Location')}</b>, allow: <b>{t('Allow')}</b> })}
                </div>
              )}
            </div>
            <button class="switch" role="switch" aria-checked={settings.places} aria-label={t('Places')} onClick={togglePlaces} disabled={locating} />
          </div>
          {(settings.weather || settings.home) && (
            <button class="list-row action" onClick={() => setHomeOpen(true)}>
              <span class="grow">
                <span class="row gap-s"><Icon name="home" size={18} /> {t('Home')} <span class="muted list-value">{settings.home ? placeLabel(settings.home) : t('Not set')}</span></span>
                <div class="muted small">{settings.home ? t('For the weather when an entry has no place, and for older entries.') : t('Set it to fill in the weather for entries without a place.')}</div>
              </span>
              <Icon name="chevron-right" size={18} />
            </button>
          )}
          {entries.some((e) => e.place) && (
            <button class="list-row action" onClick={() => navigate('map')}>
              <span class="row gap-s"><Icon name="map" size={18} /> {t('Map of your entries')}</span>
              <Icon name="chevron-right" size={18} />
            </button>
          )}
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Spotify</h2>
        <div class="card list">
          <div class="list-row">
            <div>
              <div class="row gap-s"><Icon name="brand-spotify" size={18} /> {sp?.connected ? (sp.user ? t('Connected as {name}', { name: sp.user.name }) : t('Connected')) : t('Not connected')}</div>
              <div class="muted small">
                {!sp ? t('Checking…')
                  : sp.offline ? t('The app’s server isn’t running, so only saved music shows.')
                  : sp.error ? t(sp.error)
                  : !sp.configured ? t('Log in to search music and pick songs from your playlists. Pasting song links works without it.')
                  : sp.connected ? t('Add what you’re listening to, search songs, or pick from your playlists while writing a note.')
                  : t('Log in to add what you’re listening to, search music and pick songs from your playlists.')}
              </div>
            </div>
            {sp && !sp.offline && (sp.connected ? (
              <button class="btn btn-quiet" onClick={async () => { await disconnectSpotify(); setSp(await spotifyStatus()); toast(t('Spotify disconnected')); }}>{t('Disconnect')}</button>
            ) : (
              <button class="btn btn-primary" onClick={sp.configured ? () => connectSpotify('#/settings') : () => setSetup(true)}>{t('Log in')}</button>
            ))}
          </div>
        </div>
      </section>

      {voiceSupported() && <VoiceSettings />}

      <section class="section">
        <h2 class="section-title">{t('Your data')}</h2>
        <div class="card list">
          <div class="list-row">
            <div>
              <div class="row gap-s"><Icon name={sync.on ? 'devices' : 'lock'} size={18} /> {sync.on ? t('Synced across your devices') : t('Stored on this device only')}</div>
              <div class="muted small">
                {[count(notes, 'note', 'notes'), count(entries.length - notes, 'check-in', 'check-ins'), count(people.length, 'person', 'people'), count(books.length, 'book', 'books'), count(songs.length, 'record', 'records')].join(' · ')}.{' '}
                {sync.on ? t('The server keeps an encrypted copy that only devices with your code can read.') : t('Nothing is uploaded unless you turn on saving to the server.')}
              </div>
            </div>
          </div>
          <div class="list-row">
            <div>
              <div class="row gap-s"><Icon name="cloud" size={18} /> {t('Save on server')}</div>
              <div class="muted small">
                {!sync.on ? t('Keep an encrypted copy on the server and load it on your other devices with a code.')
                  : sync.busy ? t('Syncing…')
                  : sync.error ? t(sync.error)
                  : sync.last ? t('Last synced {when}', { when: ago(sync.last) })
                  : t('Waiting to sync…')}
              </div>
            </div>
            <button class="switch" role="switch" aria-checked={sync.on} aria-label={t('Save on server')} onClick={toggleSync} />
          </div>
          {sync.on && sync.code && (
            <div class="list-row">
              <div>
                <div class="muted small">{t('Your code')}</div>
                <code class="sync-code">{formatCode(sync.code)}</code>
                <div class="muted small">{t('Enter it on another device under Settings → Load with a code. Anyone with it can read your journal, so keep it private.')}</div>
              </div>
              <button class="btn btn-quiet btn-s" onClick={() => copy(formatCode(sync.code!))}><Icon name="copy" size={16} /> {t('Copy')}</button>
            </div>
          )}
          {!sync.on && (
            <button class="list-row action" onClick={() => setJoining(true)}><span class="row gap-s"><Icon name="key" size={18} /> {t('Load with a code')}</span><Icon name="chevron-right" size={18} /></button>
          )}
          <button class="list-row action" onClick={download}><span class="row gap-s"><Icon name="download" size={18} /> {t('Export backup')}</span><Icon name="chevron-right" size={18} /></button>
          <button class="list-row action" onClick={downloadText} disabled={!entries.length && !people.length && !books.length && !songs.length}>
            <span class="grow">
              <span class="row gap-s"><Icon name="download" size={18} /> {t('Export as text')}</span>
              <div class="muted small">{t('Your journal, feelings, people, books, music and picture captions in one file, without the pictures. Handy for asking an AI about your life. It can’t be imported back.')}</div>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>
          <button class="list-row action" onClick={() => file.current?.click()}><span class="row gap-s"><Icon name="upload" size={18} /> {t('Import backup')}</span><Icon name="chevron-right" size={18} /></button>
          <button class="list-row action danger" onClick={wipe} disabled={!entries.length && !people.length && !books.length && !songs.length}><span class="row gap-s"><Icon name="trash" size={18} /> {t('Delete all entries')}</span></button>
          {sync.on && (
            <button class="list-row action danger" onClick={removeServer}><span class="row gap-s"><Icon name="cloud" size={18} /> {t('Delete server copy')}</span></button>
          )}
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) upload(f); e.currentTarget.value = ''; }} />
        </div>
      </section>

      {!standalone && (
        <section class="section">
          <h2 class="section-title">{t('Install')}</h2>
          <div class="card list">
            <div class="list-row">
              <div class="muted small">
                {ios ? t('In Safari, tap Share → Add to Home Screen to use My Mind like an app, offline too.') : t('Add My Mind to your home screen to open it like an app, offline too.')}
              </div>
              {installEvent && <button class="btn btn-primary" onClick={() => installEvent?.prompt()}>{t('Install')}</button>}
            </div>
          </div>
        </section>
      )}

      <button class="version" onClick={() => setChangelog(true)}>{t('Version {v}', { v: VERSION })}</button>

      <p class="credit">
        {t('Emotion wheel from Mindful · Emotion Quest. Music, artwork and player from Spotify. Images from Openverse, each under its own open license.')}{' '}
        {t('Weather and place search from Open-Meteo. Place names and maps © OpenStreetMap contributors. Icons: Tabler Icons and Microsoft Fluent Emoji (MIT). Type: Source Serif 4 and Instrument Sans (OFL).')}
      </p>

      <ConnectSetup redirect={sp?.redirect} open={setup} onClose={() => setSetup(false)} />
      <HomeSheet open={homeOpen} onClose={() => setHomeOpen(false)} onPick={setHome} />
      <JoinSheet open={joining} onClose={() => setJoining(false)} />
      <ChangelogSheet open={changelog} onClose={() => setChangelog(false)} />
    </div>
  );
}

/** Enter a code from another device: loads what's saved under it and keeps this device in sync from then on. */
/** Speech-to-text for notes: which model, which language, what's on this device. */
function VoiceSettings() {
  const v = useVoice();
  const model = voiceModel(v.model);
  const ready = v.installed.includes(model.id);
  return (
    <section class="section">
      <h2 class="section-title">{t('Voice typing')}</h2>
      <div class="card list">
        <div class="list-row">
          <div>
            <div class="row gap-s"><Icon name="microphone" size={18} /> {v.installed.length ? t('Ready to use') : t('Not set up')}</div>
            <div class="muted small">
              {t('Tap the microphone while writing a note and say it instead of typing it. Your voice is turned into words on this device and never leaves it. The speech model downloads once and then works offline.')}
            </div>
          </div>
        </div>
        <div class="list-row">
          <VoiceModels />
        </div>
        {model.languages && (
          <div class="list-row">
            <span>{t('Language spoken')}</span>
            <VoiceLanguage />
          </div>
        )}
        {(!ready || v.preparing || v.error) && (
          <div class="list-row">
            <div class="voice-status">
              <VoiceProgress />
            </div>
            {!ready && (
              <button class="btn btn-primary" onClick={() => void downloadModel()} disabled={v.preparing}>
                {v.preparing ? t('Downloading…') : t('Download · {mb} MB', { mb: model.mb })}
              </button>
            )}
          </div>
        )}
        {v.installed.length > 0 && (
          <button
            class="list-row action danger"
            disabled={v.preparing}
            onClick={async () => {
              await removeModels();
              toast(t('Speech models removed from this device'));
            }}
          >
            <span class="row gap-s"><Icon name="trash" size={18} /> {t('Remove downloaded models')}</span>
          </button>
        )}
      </div>
    </section>
  );
}

function JoinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setCode(''), setError('');
  }, [open]);

  const submit = async (e?: Event) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const added = await joinSync(code);
      toast(added ? t('Loaded {count} · sync is on', { count: count(added, 'entry', 'entries') }) : t('Sync is on'));
      onClose();
    } catch (err) {
      setError(t((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<span class="row gap-s"><Icon name="key" /> {t('Load with a code')}</span>}
      label={t('Load with a code')}
      footer={<button class="btn btn-primary" onClick={() => submit()} disabled={busy || !code.trim()}>{busy ? t('Loading…') : t('Load')}</button>}
    >
      <p class="hint">
        {rich('On the device that has your journal, turn on {save} in Settings to get a code. Entries on this device are kept and merged with the ones saved there, and from then on both stay in sync.', { save: <b>{t('Save on server')}</b> })}
      </p>
      <form onSubmit={submit}>
        <input
          class="input code-input"
          value={code}
          onInput={(e) => setCode(e.currentTarget.value)}
          placeholder="ABCD-EFGH-JKLM"
          aria-label={t('Sync code')}
          autocomplete="off"
          autocapitalize="characters"
          spellcheck={false}
          enterkeyhint="go"
        />
      </form>
      {error && <p class="hint danger" role="alert">{error}</p>}
    </Sheet>
  );
}

/** Every version, newest first, with what it changed. */
function ChangelogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={<span class="row gap-s"><Icon name="sparkles" /> {t('What’s new')}</span>} label={t('What’s new')} tall>
      {CHANGELOG.map((r) => (
        <section class="release" key={r.version}>
          <h3 class="release-head">{r.version} <span class="muted small">{shortDate(r.date)}</span></h3>
          <ul>{r.changes.map((c) => <li>{c}</li>)}</ul>
        </section>
      ))}
    </Sheet>
  );
}
