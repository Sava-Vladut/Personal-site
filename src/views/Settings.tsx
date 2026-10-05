import { useEffect, useRef, useState } from 'preact/hooks';
import { connectSpotify, disconnectSpotify, spotifyStatus, type SpotifyStatus } from '../lib/spotify';
import { goBack, navigate } from '../lib/router';
import { exportText } from '../lib/exportText';
import { deleteAll, exportJSON, getSettings, importJSON, setSettings, toast, useBooks, useEntries, usePeople, useSettings, useSongs, type Place, type Settings as S } from '../lib/store';
import { resolveIcon } from '../lib/icons';
import { shortDate, todayKey } from '../lib/dates';
import { fillWeather, here, locationError } from '../lib/weather';
import { Icon, type UiName } from '../components/icons';
import { ConnectSetup } from '../components/ConnectSetup';
import { Sheet } from '../components/Sheet';
import { VoiceLanguage, VoiceModels, VoiceProgress } from '../components/VoiceButton';
import { downloadModel, removeModels, useVoice, voiceModel, voiceSupported } from '../lib/voice';
import { HomeSheet, placeLabel } from '../components/weather';
import { CHANGELOG, VERSION } from '../data/changelog';
import { formatCode, joinSync, removeServerCopy, startSync, stopSync, useSync } from '../lib/sync';

// Chrome/Android offer an install prompt; iOS uses Share → Add to Home Screen.
let installEvent: (Event & { prompt: () => Promise<void> }) | null = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e as typeof installEvent;
});

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } catch {
    toast('Couldn’t copy — select it and copy by hand');
  }
};

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60_000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString();
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
      toast(s === 'connected' ? 'Spotify connected' : s === 'cancelled' ? 'Spotify login cancelled' : 'Couldn’t connect Spotify — try again');
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
        r.changed ? `${r.changed} ${r.changed === 1 ? 'entry' : 'entries'}` : '',
        r.people ? `${r.people} ${r.people === 1 ? 'person' : 'people'}` : '',
        r.books ? `${r.books} ${r.books === 1 ? 'book' : 'books'}` : '',
        r.songs ? `${r.songs} ${r.songs === 1 ? 'record' : 'records'}` : '',
        r.photos ? `${r.photos} ${r.photos === 1 ? 'photo' : 'photos'}` : '',
      ].filter(Boolean);
      toast(parts.length ? `Imported ${parts.slice(0, -1).join(', ')}${parts.length > 1 ? ' and ' : ''}${parts[parts.length - 1]}` : 'Nothing new in that backup');
    } catch {
      toast('That file isn’t a My Mind backup');
    }
  };
  const wipe = async () => {
    const where = sync.on ? 'from this device and every device synced with it' : 'from this device';
    const them = [
      people.length ? `${people.length} ${people.length === 1 ? 'person' : 'people'}` : '', books.length ? `${books.length} ${books.length === 1 ? 'book' : 'books'}` : '',
      songs.length ? `${songs.length} ${songs.length === 1 ? 'record' : 'records'}` : '',
    ]
      .filter(Boolean).map((x) => ' and ' + x).join('');
    if (!confirm(`Delete all ${entries.length} entries${them} ${where}? This can’t be undone — export a backup first if you might want them.`)) return;
    await deleteAll();
    toast('All entries deleted');
  };
  const toggleSync = () => {
    if (!sync.on) return startSync();
    if (!confirm(`Stop syncing this device?\n\nYour entries stay here, and the copy on the server stays for your other devices. To reconnect, load with your code: ${formatCode(sync.code!)}`)) return;
    stopSync();
    toast('Sync turned off on this device');
  };
  const removeServer = async () => {
    if (!confirm('Delete the copy on the server? Every device stops syncing and your code stops working. Entries already on your devices stay.')) return;
    try {
      await removeServerCopy();
      toast('Server copy deleted');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  /** Fills in the weather for older entries, and says how many got it. */
  const fill = () =>
    fillWeather().then((n) => n && toast(`Weather added to ${n} ${n === 1 ? 'entry' : 'entries'}`));
  const toggleWeather = () => {
    if (settings.weather) return setSettings({ weather: false });
    setSettings({ weather: true });
    if (settings.home) fill();
    else setHomeOpen(true);
  };
  const setHome = (home: Place) => {
    setSettings({ home });
    toast(`Home set to ${placeLabel(home)}`);
    fill();
  };
  // Turning places on asks for your location there and then, so the browser's question comes with a reason.
  const togglePlaces = async () => {
    if (settings.places) return setSettings({ places: false });
    setLocating(true);
    try {
      const p = await here();
      setSettings({ places: true });
      if (!getSettings().home) {
        setSettings({ home: p });
        toast(p.name ? `Places are on · home set to ${p.name}` : 'Places are on');
      } else toast('Places are on');
      fill();
    } catch (e) {
      toast(locationError(e));
    } finally {
      setLocating(false);
    }
  };

  const notes = entries.filter((e) => e.kind === 'note').length;
  const themes: [S['theme'], string, UiName][] = [['system', 'System', 'device-desktop'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']];
  const pickers: [S['picker'], string, UiName][] = [['grid', 'Grid', 'layout-grid'], ['wheel', 'Wheel', 'chart-donut-2']];
  const densities: [S['density'], string, UiName][] = [['cards', 'Cards', 'layout-list'], ['compact', 'Compact', 'list']];

  return (
    <div class="page">
      <header class="page-head">
        <button class="back-link stats-back" onClick={() => goBack()}><Icon name="chevron-left" size={18} /> Back</button>
        <h1 class="title">Settings</h1>
      </header>

      <section class="section">
        <h2 class="section-title">Appearance</h2>
        <div class="card list">
          <div class="list-row">
            <span>Theme</span>
            <div class="seg compact" role="radiogroup" aria-label="Theme">
              {themes.map(([v, l, icon]) => (
                <button role="radio" aria-checked={settings.theme === v} aria-selected={settings.theme === v} onClick={() => setSettings({ theme: v })}>
                  <Icon name={icon} size={16} /> {l}
                </button>
              ))}
            </div>
          </div>
          <div class="list-row">
            <span>Week starts on</span>
            <div class="seg compact" role="radiogroup" aria-label="Week starts on">
              {([[1, 'Monday'], [0, 'Sunday']] as const).map(([v, l]) => (
                <button role="radio" aria-checked={settings.weekStart === v} aria-selected={settings.weekStart === v} onClick={() => setSettings({ weekStart: v })}>{l}</button>
              ))}
            </div>
          </div>
          <div class="list-row">
            <span>Emotion picker</span>
            <div class="seg compact" role="radiogroup" aria-label="Emotion picker">
              {pickers.map(([v, l, icon]) => (
                <button role="radio" aria-checked={settings.picker === v} aria-selected={settings.picker === v} onClick={() => setSettings({ picker: v })}>
                  <Icon name={icon} size={16} /> {l}
                </button>
              ))}
            </div>
          </div>
          <div class="list-row">
            <span>Journal layout</span>
            <div class="seg compact" role="radiogroup" aria-label="Journal layout">
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
        <h2 class="section-title">Weather & places</h2>
        <div class="card list">
          <div class="list-row">
            <div>
              <div class="row gap-s"><Icon name="haze" size={18} /> Weather</div>
              <div class="muted small">Adds the weather and hours of daylight to your entries, so Stats can show how they go with your mood. Open-Meteo is only sent a location, never what you write.</div>
            </div>
            <button class="switch" role="switch" aria-checked={settings.weather} aria-label="Weather" onClick={toggleWeather} />
          </div>
          <div class="list-row">
            <div>
              <div class="row gap-s"><Icon name="map-pin" size={18} /> Places</div>
              <div class="muted small">{locating ? 'Finding you…' : 'Saves where you are when you write, and puts your entries on a map. Uses your location, with names from OpenStreetMap.'}</div>
            </div>
            <button class="switch" role="switch" aria-checked={settings.places} aria-label="Places" onClick={togglePlaces} disabled={locating} />
          </div>
          {(settings.weather || settings.home) && (
            <button class="list-row action" onClick={() => setHomeOpen(true)}>
              <span class="grow">
                <span class="row gap-s"><Icon name="home" size={18} /> Home <span class="muted list-value">{settings.home ? placeLabel(settings.home) : 'Not set'}</span></span>
                <div class="muted small">{settings.home ? 'For the weather when an entry has no place, and for older entries.' : 'Set it to fill in the weather for entries without a place.'}</div>
              </span>
              <Icon name="chevron-right" size={18} />
            </button>
          )}
          {entries.some((e) => e.place) && (
            <button class="list-row action" onClick={() => navigate('map')}>
              <span class="row gap-s"><Icon name="map" size={18} /> Map of your entries</span>
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
              <div class="row gap-s"><Icon name="brand-spotify" size={18} /> {sp?.connected ? `Connected${sp.user ? ` as ${sp.user.name}` : ''}` : 'Not connected'}</div>
              <div class="muted small">
                {!sp ? 'Checking…'
                  : sp.offline ? 'The app’s server isn’t running, so only saved music shows.'
                  : sp.error ? sp.error
                  : !sp.configured ? 'Log in to search music and pick songs from your playlists. Pasting song links works without it.'
                  : sp.connected ? 'Add what you’re listening to, search songs, or pick from your playlists while writing a note.'
                  : 'Log in to add what you’re listening to, search music and pick songs from your playlists.'}
              </div>
            </div>
            {sp && !sp.offline && (sp.connected ? (
              <button class="btn btn-quiet" onClick={async () => { await disconnectSpotify(); setSp(await spotifyStatus()); toast('Spotify disconnected'); }}>Disconnect</button>
            ) : (
              <button class="btn btn-primary" onClick={sp.configured ? () => connectSpotify('#/settings') : () => setSetup(true)}>Log in</button>
            ))}
          </div>
        </div>
      </section>

      {voiceSupported() && <VoiceSettings />}

      <section class="section">
        <h2 class="section-title">Your data</h2>
        <div class="card list">
          <div class="list-row">
            <div>
              <div class="row gap-s"><Icon name={sync.on ? 'devices' : 'lock'} size={18} /> {sync.on ? 'Synced across your devices' : 'Stored on this device only'}</div>
              <div class="muted small">
                {notes} notes · {entries.length - notes} check-ins · {people.length} {people.length === 1 ? 'person' : 'people'} · {books.length} {books.length === 1 ? 'book' : 'books'} · {songs.length} {songs.length === 1 ? 'record' : 'records'}.{' '}
                {sync.on ? 'The server keeps an encrypted copy that only devices with your code can read.' : 'Nothing is uploaded unless you turn on saving to the server.'}
              </div>
            </div>
          </div>
          <div class="list-row">
            <div>
              <div class="row gap-s"><Icon name="cloud" size={18} /> Save on server</div>
              <div class="muted small">
                {!sync.on ? 'Keep an encrypted copy on the server and load it on your other devices with a code.'
                  : sync.busy ? 'Syncing…'
                  : sync.error ? sync.error
                  : sync.last ? `Last synced ${ago(sync.last)}`
                  : 'Waiting to sync…'}
              </div>
            </div>
            <button class="switch" role="switch" aria-checked={sync.on} aria-label="Save on server" onClick={toggleSync} />
          </div>
          {sync.on && sync.code && (
            <div class="list-row">
              <div>
                <div class="muted small">Your code</div>
                <code class="sync-code">{formatCode(sync.code)}</code>
                <div class="muted small">Enter it on another device under Settings → Load with a code. Anyone with it can read your journal, so keep it private.</div>
              </div>
              <button class="btn btn-quiet btn-s" onClick={() => copy(formatCode(sync.code!))}><Icon name="copy" size={16} /> Copy</button>
            </div>
          )}
          {!sync.on && (
            <button class="list-row action" onClick={() => setJoining(true)}><span class="row gap-s"><Icon name="key" size={18} /> Load with a code</span><Icon name="chevron-right" size={18} /></button>
          )}
          <button class="list-row action" onClick={download}><span class="row gap-s"><Icon name="download" size={18} /> Export backup</span><Icon name="chevron-right" size={18} /></button>
          <button class="list-row action" onClick={downloadText} disabled={!entries.length && !people.length && !books.length && !songs.length}>
            <span class="grow">
              <span class="row gap-s"><Icon name="download" size={18} /> Export as text</span>
              <div class="muted small">Your journal, feelings, people, books, music and picture captions in one file, without the pictures. Handy for asking an AI about your life. It can’t be imported back.</div>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>
          <button class="list-row action" onClick={() => file.current?.click()}><span class="row gap-s"><Icon name="upload" size={18} /> Import backup</span><Icon name="chevron-right" size={18} /></button>
          <button class="list-row action danger" onClick={wipe} disabled={!entries.length && !people.length && !books.length && !songs.length}><span class="row gap-s"><Icon name="trash" size={18} /> Delete all entries</span></button>
          {sync.on && (
            <button class="list-row action danger" onClick={removeServer}><span class="row gap-s"><Icon name="cloud" size={18} /> Delete server copy</span></button>
          )}
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) upload(f); e.currentTarget.value = ''; }} />
        </div>
      </section>

      {!standalone && (
        <section class="section">
          <h2 class="section-title">Install</h2>
          <div class="card list">
            <div class="list-row">
              <div class="muted small">
                {ios ? 'In Safari, tap Share → Add to Home Screen to use My Mind like an app, offline too.' : 'Add My Mind to your home screen to open it like an app, offline too.'}
              </div>
              {installEvent && <button class="btn btn-primary" onClick={() => installEvent?.prompt()}>Install</button>}
            </div>
          </div>
        </section>
      )}

      <button class="version" onClick={() => setChangelog(true)}>Version {VERSION}</button>

      <p class="credit">
        Emotion wheel from Mindful · Emotion Quest. Music, artwork and player from Spotify. Images from Openverse, each under its own open license.
        Weather and place search from Open-Meteo. Place names and maps © OpenStreetMap contributors. Icons: Tabler Icons and Microsoft Fluent Emoji (MIT). Type: Source Serif 4 and Instrument Sans (OFL).
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
      <h2 class="section-title">Voice typing</h2>
      <div class="card list">
        <div class="list-row">
          <div>
            <div class="row gap-s"><Icon name="microphone" size={18} /> {v.installed.length ? 'Ready to use' : 'Not set up'}</div>
            <div class="muted small">
              Tap the microphone while writing a note and say it instead of typing it. Your voice is turned into words on this device and never leaves it. The speech model downloads once and then works offline.
            </div>
          </div>
        </div>
        <div class="list-row">
          <VoiceModels />
        </div>
        {model.languages && (
          <div class="list-row">
            <span>Language</span>
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
                {v.preparing ? 'Downloading…' : `Download · ${model.mb} MB`}
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
              toast('Speech models removed from this device');
            }}
          >
            <span class="row gap-s"><Icon name="trash" size={18} /> Remove downloaded models</span>
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
      toast(added ? `Loaded ${added} ${added === 1 ? 'entry' : 'entries'} · sync is on` : 'Sync is on');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<span class="row gap-s"><Icon name="key" /> Load with a code</span>}
      label="Load with a code"
      footer={<button class="btn btn-primary" onClick={() => submit()} disabled={busy || !code.trim()}>{busy ? 'Loading…' : 'Load'}</button>}
    >
      <p class="hint">
        On the device that has your journal, turn on <b>Save on server</b> in Settings to get a code. Entries on this device are kept and merged with the ones saved there, and from then on both stay in sync.
      </p>
      <form onSubmit={submit}>
        <input
          class="input code-input"
          value={code}
          onInput={(e) => setCode(e.currentTarget.value)}
          placeholder="ABCD-EFGH-JKLM"
          aria-label="Sync code"
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
    <Sheet open={open} onClose={onClose} title={<span class="row gap-s"><Icon name="sparkles" /> What’s new</span>} label="What’s new" tall>
      {CHANGELOG.map((r) => (
        <section class="release" key={r.version}>
          <h3 class="release-head">{r.version} <span class="muted small">{shortDate(r.date)}</span></h3>
          <ul>{r.changes.map((c) => <li>{c}</li>)}</ul>
        </section>
      ))}
    </Sheet>
  );
}
