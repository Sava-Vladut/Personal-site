import { useEffect, useRef, useState } from 'preact/hooks';
import { connectSpotify, disconnectSpotify, spotifyStatus, type SpotifyStatus } from '../lib/spotify';
import { navigate } from '../lib/router';
import { deleteAll, exportJSON, importJSON, setSettings, toast, useEntries, useSettings, type Settings as S } from '../lib/store';
import { resolveIcon } from '../lib/icons';
import { todayKey } from '../lib/dates';
import { Icon, type UiName } from '../components/icons';
import { ConnectSetup } from '../components/ConnectSetup';

// Chrome/Android offer an install prompt; iOS uses Share → Add to Home Screen.
let installEvent: (Event & { prompt: () => Promise<void> }) | null = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e as typeof installEvent;
});

export function Settings({ query }: { query: URLSearchParams }) {
  const settings = useSettings();
  const entries = useEntries();
  const [sp, setSp] = useState<SpotifyStatus | null>(null);
  const [setup, setSetup] = useState(false);
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
  const upload = async (f: File) => {
    try {
      const r = await importJSON(await f.text());
      r.icons.forEach((id) => resolveIcon(id));
      toast(r.changed ? `Imported ${r.changed} ${r.changed === 1 ? 'entry' : 'entries'}` : 'Nothing new in that backup');
    } catch {
      toast('That file isn’t a My Mind backup');
    }
  };
  const wipe = async () => {
    if (!confirm(`Delete all ${entries.length} entries from this device? This can’t be undone — export a backup first if you might want them.`)) return;
    await deleteAll();
    toast('All entries deleted');
  };

  const notes = entries.filter((e) => e.kind === 'note').length;
  const themes: [S['theme'], string, UiName][] = [['system', 'System', 'device-desktop'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']];
  const pickers: [S['picker'], string, UiName][] = [['grid', 'Grid', 'layout-grid'], ['wheel', 'Wheel', 'chart-donut-2']];

  return (
    <div class="page">
      <header class="page-head">
        <div class="eyebrow">Settings</div>
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
                  : sp.connected ? 'Search songs and pick from your playlists while writing a note.'
                  : 'Log in to search music and pick songs from your playlists.'}
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

      <section class="section">
        <h2 class="section-title">Your data</h2>
        <div class="card list">
          <div class="list-row">
            <div>
              <div class="row gap-s"><Icon name="lock" size={18} /> Stored on this device only</div>
              <div class="muted small">{notes} notes · {entries.length - notes} check-ins. Nothing is uploaded — export a backup to move it to another device.</div>
            </div>
          </div>
          <button class="list-row action" onClick={download}><span class="row gap-s"><Icon name="download" size={18} /> Export backup</span><Icon name="chevron-right" size={18} /></button>
          <button class="list-row action" onClick={() => file.current?.click()}><span class="row gap-s"><Icon name="upload" size={18} /> Import backup</span><Icon name="chevron-right" size={18} /></button>
          <button class="list-row action danger" onClick={wipe} disabled={!entries.length}><span class="row gap-s"><Icon name="trash" size={18} /> Delete all entries</span></button>
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

      <p class="credit">
        Emotion wheel from Mindful · Emotion Quest. Music, artwork and player from Spotify. Images from Openverse, each under its own open license. Icons: Tabler Icons and Microsoft Fluent Emoji (MIT). Type: Source Serif 4 and Instrument Sans (OFL).
      </p>

      <ConnectSetup redirect={sp?.redirect} open={setup} onClose={() => setSetup(false)} />
    </div>
  );
}
