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
// Low latency: the playlists also list the two segments Twitch is still making (server/watch.js), so their end is
// ~4 s further ahead, about at "now"; the second one is only done ~3.5 s after it's listed, hence a bit more room.
// Their downloads take as long as the video does, which hls.js would read as a slow connection and drop quality, so
// the quality is picked here instead: the best up to 1080p, one step down after two stalls within 30 s.
const BEHIND_LOW = 4.5;
const STALLS = 2;
const STALL_WINDOW = 30_000;
const RECENT_KEY = 'mm-watch-recent';
const LOW_KEY = 'mm-watch-low';
const readLow = () => {
  try { return localStorage.getItem(LOW_KEY) !== '0'; } catch { return true; }
};
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
  const [low, setLow] = useState(readLow);
  useEffect(() => setTyped(channel), [channel]);
  const toggleLow = () => {
    setLow(!low);
    try { localStorage.setItem(LOW_KEY, low ? '0' : '1'); } catch {}
  };

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
        <Player key={`${channel}|${low}`} login={channel} low={low} onLow={toggleLow} onPlaying={() => setRecent(remember(channel))} />
      ) : (
        <section class="card sr-note cl-intro">
          <p>{t('Type a Twitch channel to watch it live.')}</p>
          <p>{t('Most players wait 15 seconds behind Twitch’s newest video. This one waits about 4, and with low latency on it also fetches the video Twitch is still making, like Twitch’s own player, for a few seconds more.')}</p>
        </section>
      )}
    </div>
  );
}

type State = 'loading' | 'playing' | 'offline' | 'ended' | 'error';

/** "1080p60", "720p", or "Audio" for the sound-only quality. */
const levelName = (l: { height: number; frameRate: number }) => (l.height ? `${l.height}p${l.frameRate >= 50 ? '60' : ''}` : t('Audio'));

function Player({ login, low, onLow, onPlaying }: { login: string; low: boolean; onLow: () => void; onPlaying: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [state, setState] = useState<State>('loading');
  const [muted, setMuted] = useState(false);
  const [behind, setBehind] = useState<number | null>(null);
  const [again, setAgain] = useState(0);
  const [levels, setLevels] = useState<string[]>([]);
  const [level, setLevel] = useState(-1); // -1: hls.js picks
  const [steppedDown, setSteppedDown] = useState(false);

  useEffect(() => {
    const v = video.current!;
    const src = `/api/watch/${login}.m3u8${low ? '?ll=1' : ''}`;
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
        liveSyncDuration: low ? BEHIND_LOW : BEHIND,
        liveMaxLatencyDuration: (low ? BEHIND_LOW : BEHIND) + 8, // further back than this, it jumps forward
        maxLiveSyncPlaybackRate: 1.1, // and up to this far, it plays a little faster to catch up
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      const h = hls;
      const stalls: number[] = [];
      h.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLevels(data.levels.map(levelName));
        if (low) {
          let best = -1;
          data.levels.forEach((l, i) => {
            if (l.height && l.height <= 1080 && (best < 0 || l.bitrate > data.levels[best].bitrate)) best = i;
          });
          if (best >= 0) {
            h.currentLevel = best;
            setLevel(best);
          }
        }
        start();
      });
      h.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) {
          if (!low || data.details !== Hls.ErrorDetails.BUFFER_STALLED_ERROR) return;
          const now = Date.now();
          stalls.push(now);
          while (stalls.length && now - stalls[0] > STALL_WINDOW) stalls.shift();
          if (stalls.length < STALLS) return;
          stalls.length = 0;
          // the next quality down that shows video
          const lv = h.levels;
          const cur = h.currentLevel;
          let next = -1;
          lv.forEach((l, i) => {
            if (l.height && l.bitrate < lv[cur]?.bitrate && (next < 0 || l.bitrate > lv[next].bitrate)) next = i;
          });
          if (next >= 0) {
            h.nextLevel = next;
            setLevel(next);
            setSteppedDown(true);
          }
          return;
        }
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
  const pick = (i: number) => {
    const h = hlsRef.current;
    if (!h) return;
    h.currentLevel = i;
    setLevel(i);
    setSteppedDown(false);
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
          <button class="chip" aria-pressed={low} onClick={onLow} title={t('Also fetch the video Twitch is still making')}>{t('Low latency')}</button>
        </div>
      )}
      {state === 'playing' && levels.length > 1 && (
        <div class="chips filters scroll-x" role="toolbar" aria-label={t('Quality')}>
          {!low && <button class="chip" aria-pressed={level < 0} onClick={() => pick(-1)}>{t('Auto')}</button>}
          {levels.map((name, i) => <button class="chip" aria-pressed={level === i} onClick={() => pick(i)}>{name}</button>)}
        </div>
      )}
      {steppedDown && <p class="empty-note">{t('It kept stopping to load, so the quality went down a step.')}</p>}
    </section>
  );
}
