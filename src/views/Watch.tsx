import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import Hls from 'hls.js/light';
import { goBack, navigate } from '../lib/router';
import { PageHead } from '../components/PageHead';
import { Icon } from '../components/icons';
import { Sky } from '../components/Sky';
import { t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/twitch.css';
import '../styles/streamer.css';
import '../styles/chatlogs.css';
import '../styles/watch.css';

/**
 * Watch a live Twitch stream, played by hls.js instead of Twitch's player. The server (server/watch.js) hands out the
 * playlists; the video comes straight from Twitch's CDN. Players left to their defaults (Safari's own HLS, and hls.js
 * too) start three segments' "target duration" back from the newest one, which on Twitch is 15 s; here the player is
 * asked to sit 4 s back instead, and to speed up a little to get there again after a stall.
 */
const BEHIND = 4; // seconds behind the newest segment the player aims for
const RECENT_KEY = 'mm-watch-recent';
const cleanLogin = (s: string) => s.trim().toLowerCase().replace(/^.*twitch\.tv\//, '').replace(/^@/, '').replace(/[^a-z0-9_]/g, '').slice(0, 25);

function readRecent(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}
function remember(login: string) {
  const next = [login, ...readRecent().filter((s) => s !== login)].slice(0, 8);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
  return next;
}

function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', 'var(--emo-fear)');
    return () => root.removeProperty('--accent');
  }, []);
}

export function Watch({ query }: { query: URLSearchParams }) {
  useAccent();
  const channel = cleanLogin(query.get('channel') ?? '');
  const [typed, setTyped] = useState(channel);
  const [recent, setRecent] = useState(readRecent);
  useEffect(() => setTyped(channel), [channel]);

  const go = (c: string) => navigate(`watch?channel=${c}`, true);
  const submit = (e: Event) => {
    e.preventDefault();
    const c = cleanLogin(typed);
    if (c) go(c);
  };

  return (
    <div class="page stats-page tw-page sr-page cl-page">
      <div class="journal-top stats-top" style={{ '--sky': 'var(--emo-fear)' }}>
        <Sky world="fear" letters="live" />
        <PageHead title={t('Watch live')} back={() => goBack()} subtitle={channel || t('A Twitch stream, a few seconds behind live')} />
        <form class="cl-find wt-find" onSubmit={submit} role="search">
          <label class="search">
            <Icon name="brand-twitch" size={18} />
            <input
              value={typed}
              onInput={(e) => setTyped(e.currentTarget.value)}
              placeholder={t('Channel')}
              aria-label={t('Channel')}
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
              enterKeyHint="go"
            />
          </label>
          <button class="btn btn-primary" disabled={!cleanLogin(typed)}>{t('Watch')}</button>
        </form>
        {recent.length > 0 && (
          <div class="chips filters scroll-x" role="toolbar" aria-label={t('Recent channels')}>
            {recent.map((c) => <button class="chip" aria-pressed={c === channel} onClick={() => go(c)}>{c}</button>)}
          </div>
        )}
      </div>

      {channel ? (
        <Player key={channel} login={channel} onPlaying={() => setRecent(remember(channel))} />
      ) : (
        <section class="card sr-note cl-intro">
          <p>{t('Type a Twitch channel to watch it live.')}</p>
          <p>{t('The stream plays about 4 seconds behind the newest video Twitch has, instead of the 15 seconds most players wait.')}</p>
        </section>
      )}
    </div>
  );
}

type State = 'loading' | 'playing' | 'offline' | 'ended' | 'error';

function Player({ login, onPlaying }: { login: string; onPlaying: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [state, setState] = useState<State>('loading');
  const [muted, setMuted] = useState(false);
  const [behind, setBehind] = useState<number | null>(null);
  const [again, setAgain] = useState(0);

  useEffect(() => {
    const v = video.current!;
    const src = `/api/watch/${login}.m3u8`;
    setState('loading');
    setBehind(null);

    const start = () => {
      v.muted = false;
      v.play().catch(() => {
        // no sound without a tap: start muted, and offer the tap
        v.muted = true;
        setMuted(true);
        v.play().catch(() => {});
      });
    };
    const playing = () => { setState('playing'); onPlaying(); };
    v.addEventListener('playing', playing);

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      v.disableRemotePlayback = true; // iPhone's ManagedMediaSource plays only without AirPlay
      hls = new Hls({
        enableWorker: false, // the page's CSP has no blob: workers
        liveSyncDuration: BEHIND,
        liveMaxLatencyDuration: BEHIND + 8, // further back than this, it jumps forward
        maxLiveSyncPlaybackRate: 1.1, // and up to this far, it plays a little faster to catch up
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, start);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        const code = data.response?.code;
        if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) setState(code === 404 ? 'offline' : 'error');
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls!.recoverMediaError();
        else if (code === 410) setState('ended');
        else setState('error');
      });
      hls.loadSource(src);
      hls.attachMedia(v);
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      // an old Safari: its own player, which waits the full 15 s; jump forward once it knows where live is
      v.src = src;
      v.addEventListener('loadedmetadata', () => {
        const end = v.seekable.length ? v.seekable.end(v.seekable.length - 1) : 0;
        if (end > BEHIND) v.currentTime = end - BEHIND;
        start();
      }, { once: true });
      v.addEventListener('error', () => setState('error'), { once: true });
    } else setState('error');

    // how far behind the broadcast the picture is: now, against the time Twitch stamped on the frame
    const tick = setInterval(() => {
      const at = hls?.playingDate ?? (v as HTMLVideoElement & { getStartDate?: () => Date }).getStartDate?.();
      const date = hls ? at : at && !Number.isNaN(at.getTime()) ? new Date(at.getTime() + v.currentTime * 1000) : null;
      setBehind(date && !v.paused ? Math.max(0, (Date.now() - date.getTime()) / 1000) : null);
    }, 1000);

    return () => {
      clearInterval(tick);
      v.removeEventListener('playing', playing);
      hls?.destroy();
      hlsRef.current = null;
      v.removeAttribute('src');
      v.load();
    };
  }, [login, again]);

  const unmute = () => {
    const v = video.current!;
    v.muted = false;
    setMuted(false);
    v.play().catch(() => {});
  };
  const toLive = () => {
    const v = video.current!;
    const live = hlsRef.current?.liveSyncPosition ?? (v.seekable.length ? v.seekable.end(v.seekable.length - 1) - BEHIND : null);
    if (live != null) v.currentTime = live;
    v.play().catch(() => {});
  };

  const message = state === 'offline' ? t('{channel} isn’t live right now.', { channel: login })
    : state === 'ended' ? t('The stream ended.')
    : state === 'error' ? t('This stream can’t be played here right now.')
    : null;

  return (
    <section class="wt-player">
      <div class="wt-frame">
        <video ref={video} controls playsInline autoplay />
        {state === 'loading' && <p class="wt-over">{t('Starting {channel}…', { channel: login })}</p>}
        {message && (
          <div class="wt-over">
            <p>{message}</p>
            <button class="btn btn-quiet" onClick={() => setAgain((n) => n + 1)}><Icon name="refresh" size={18} /> {t('Try again')}</button>
          </div>
        )}
        {muted && state === 'playing' && (
          <button class="btn btn-primary wt-sound" onClick={unmute}><Icon name="volume" size={18} /> {t('Tap for sound')}</button>
        )}
      </div>
      {state === 'playing' && (
        <div class="wt-bar">
          <span class="chip wt-live"><span class="wt-dot" aria-hidden="true" /> {behind == null ? t('Live') : t('{n} s behind live', { n: behind.toFixed(1) })}</span>
          <button class="chip" onClick={toLive}><Icon name="player-skip-forward" size={16} /> {t('Jump to live')}</button>
        </div>
      )}
    </section>
  );
}
