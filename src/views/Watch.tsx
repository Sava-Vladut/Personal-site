import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import Hls, { FetchLoader } from 'hls.js/light';
import type { FragmentLoaderConstructor } from 'hls.js';
import { goBack, navigate } from '../lib/router';
import { PageHead } from '../components/PageHead';
import { Icon } from '../components/icons';
import { Sky } from '../components/Sky';
import { t } from '../lib/i18n';
import { LiveChat } from '../components/LiveChat';
import { channelInfo, type ChannelInfo } from '../lib/twitchChat';
import { hours } from '../lib/streamer';
import '../styles/stats.css';
import '../styles/twitch.css';
import '../styles/streamer.css';
import '../styles/chatlogs.css';
import '../styles/watch.css';

/**
 * Watch a live Twitch stream, played by hls.js instead of Twitch's player. The server (server/watch.js) hands out the
 * playlists; the video comes straight from Twitch's CDN. Players left to their defaults (Safari's own HLS, and hls.js
 * too) start three segments' "target duration" back from the newest one, which on Twitch is 15 s.
 *
 * How close it can sit: Twitch lists a 2 s segment only once it's whole, ~2.5 s after its last frame, and hls.js
 * plays a segment only once it has all of it. So between two playlist updates the newest playable video falls from
 * the playlist's end to ~2 s before it, and the playhead needs that much plus room for a slow download behind the end.
 * Twitch's listings also wander by ~1 s. 5 s keeps ~2 s buffered at the worst moment (~7–8 s behind the broadcast). (v1.206.0 also played the segments Twitch is still
 * making, #EXT-X-TWITCH-PREFETCH, 4.5 s from that later end: they finish only ~0.5 s before Twitch lists them, so that
 * left no buffer at all and stalled every few seconds.)
 */
const BEHIND = 5; // seconds behind the end of the playlist the player aims for

/*
 * Low latency (a toggle, kept per device): the playlists also list the two segments Twitch is still making
 * (server/watch.js), and they're played while they stream in. The CDN sends them in ~100 ms moof+mdat chunks as
 * they're made; hls.js's progressive mode appends whole chunks, but only in 128 KB batches (0.3–0.8 s of 480p–720p),
 * so the fragment loader below hands them on every 16 KB. The newest playable video is then ~2.4 s behind the
 * broadcast, ~4 s before the end of a playlist that holds the two prefetches; 6 s keeps ~2 s loaded (~4.5 s behind).
 * A streaming download lasts as long as its video, which hls.js's automatic quality reads as a slow connection (and
 * its "abandon slow download" rule as a reason to drop quality), so in this mode the quality is set by hand: the best
 * up to what the player shows (at least 480p, at most 1080p), one step down after two stalls within 30 s.
 */
const BEHIND_LOW = 6;
const CHUNK = 16 * 1024;
const STALLS = 2;
const STALL_WINDOW = 30_000;
const LOW_KEY = 'mm-watch-low';
const readLow = () => {
  try { return localStorage.getItem(LOW_KEY) === '1'; } catch { return false; }
};

/** hls.js's fetch loader, handing on streamed media every 16 KB instead of every 128 KB. */
class ChunkLoader extends FetchLoader {
  load(...[context, config, callbacks]: Parameters<FetchLoader['load']>) {
    const small = Number.isFinite(config.highWaterMark) ? { ...config, highWaterMark: CHUNK } : config;
    super.load(context, small, callbacks);
  }
}

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

const CHAT_KEY = 'mm-watch-chat';
const readChatOn = () => {
  try { return localStorage.getItem(CHAT_KEY) !== '0'; } catch { return true; }
};
const INFO_EVERY = 120_000;

export function Watch({ query }: { query: URLSearchParams }) {
  useAccent();
  const channel = cleanLogin(query.get('channel') ?? '');
  const [recent, setRecent] = useState(readRecent);
  const [low, setLow] = useState(readLow);
  const [chatOn, setChatOn] = useState(readChatOn);
  const [finding, setFinding] = useState(false);
  const [info, setInfo] = useState<ChannelInfo | null>(null);
  const behind = useRef<number | null>(null);
  const toggleLow = () => {
    setLow(!low);
    try { localStorage.setItem(LOW_KEY, low ? '0' : '1'); } catch {}
  };
  const toggleChat = () => {
    setChatOn(!chatOn);
    try { localStorage.setItem(CHAT_KEY, chatOn ? '0' : '1'); } catch {}
  };

  // who's on: name, badges and emotes for the chat, title, game and viewers for the top
  useEffect(() => {
    setInfo(null);
    setFinding(false);
    if (!channel) return;
    let live = true;
    const load = () => channelInfo(channel).then((i) => { if (live && i) setInfo(i); });
    load();
    const every = setInterval(load, INFO_EVERY);
    return () => { live = false; clearInterval(every); };
  }, [channel]);

  const go = (c: string) => navigate(`watch?channel=${c}`, true);

  if (!channel) {
    return (
      <div class="page stats-page tw-page sr-page cl-page">
        <div class="journal-top stats-top" style={{ '--sky': 'var(--emo-fear)' }}>
          <Sky world="fear" letters="live" />
          <PageHead title={t('Watch live')} back={() => goBack()} subtitle={t('A Twitch stream, a few seconds behind live')} />
          <Find channel="" recent={recent} go={go} />
        </div>
        <section class="card sr-note cl-intro">
          <p>{t('Type a Twitch channel to watch it live, with its chat and emotes beside the video.')}</p>
          <p>{t('Most players wait 15 seconds behind Twitch’s newest video. This one waits 5, with enough kept loaded to play without stopping.')}</p>
          <p>{t('Low latency, under the video, plays the video Twitch is still making as it streams in, like Twitch’s own player: a few seconds closer to live, at a quality picked for the player instead of for your connection.')}</p>
        </section>
      </div>
    );
  }

  const s = info?.stream;
  const about = s ? [t('{n} watching', { n: s.viewers.toLocaleString() }), s.game].filter(Boolean).join(' · ') : null;
  return (
    <div class="page wt-page" data-chat={chatOn ? '' : undefined}>
      <header class="wt-top">
        <button class="glass glass-btn round" onClick={() => goBack()} aria-label={t('Back')}><Icon name="arrow-left" /></button>
        <div class="wt-title">
          <h1>{info?.name ?? channel}</h1>
          {about && <p title={s?.title}>{about}{s?.title && <span class="wt-title-more"> · {s.title}</span>}</p>}
        </div>
        <button class="glass glass-btn round" aria-pressed={finding} onClick={() => setFinding(!finding)} aria-label={t('Another channel')} title={t('Another channel')}>
          <Icon name={finding ? 'x' : 'search'} />
        </button>
      </header>
      {finding && <div class="wt-switch"><Find channel={channel} recent={recent} go={go} focus /></div>}
      <Player
        key={`${channel}|${low}`}
        login={channel}
        low={low}
        onLow={toggleLow}
        chat={chatOn}
        onChat={toggleChat}
        onBehind={(n) => { behind.current = n; }}
        onPlaying={() => setRecent(remember(channel))}
      >
        {s && (
          <div class="wt-info">
            {s.title && <h2 title={s.title}>{s.title}</h2>}
            <p>{[s.game, t('{n} watching', { n: s.viewers.toLocaleString() }), s.since ? t('Live for {time}', { time: hours(Date.now() - s.since) }) : null].filter(Boolean).join(' · ')}</p>
          </div>
        )}
      </Player>
      {chatOn && <LiveChat key={channel} login={channel} info={info} behind={behind} />}
    </div>
  );
}

/** The channel box, and the channels watched lately. */
function Find({ channel, recent, go, focus }: { channel: string; recent: string[]; go: (c: string) => void; focus?: boolean }) {
  const [typed, setTyped] = useState(channel);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focus) input.current?.focus(); }, []);
  const submit = (e: Event) => {
    e.preventDefault();
    const c = cleanLogin(typed);
    if (c) go(c);
  };
  return (
    <>
      <form class="cl-find wt-find" onSubmit={submit} role="search">
        <label class="search">
          <Icon name="brand-twitch" size={18} />
          <input
            ref={input}
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
    </>
  );
}

type State = 'loading' | 'playing' | 'offline' | 'ended' | 'error';

/** "1080p60", "720p", or "Audio" for the sound-only quality. */
const levelName = (l: { height: number; frameRate: number }) => (l.height ? `${l.height}p${l.frameRate >= 50 ? '60' : ''}` : t('Audio'));

function Player({ login, low, onLow, chat, onChat, onBehind, onPlaying, children }: {
  login: string; low: boolean; onLow: () => void; chat: boolean; onChat: () => void; onBehind: (n: number | null) => void; onPlaying: () => void;
  /** what's on, under the controls (shown where there's room: see watch.css) */
  children?: ComponentChildren;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [state, setState] = useState<State>('loading');
  const [muted, setMuted] = useState(false);
  const [behind, setBehind] = useState<number | null>(null);
  const [again, setAgain] = useState(0);
  const [levels, setLevels] = useState<string[]>([]);
  const [level, setLevel] = useState(-1); // -1: picked by hls.js as the connection allows
  const [playingLevel, setPlayingLevel] = useState(-1);
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
        ...(low ? { progressive: true, fLoader: ChunkLoader as unknown as FragmentLoaderConstructor } : {}),
        liveSyncDuration: low ? BEHIND_LOW : BEHIND,
        // after a stall it falls behind; up to this far it catches up by playing 5% faster (gently, so the catching
        // up doesn't eat the buffer it needs), further back it jumps
        liveMaxLatencyDuration: (low ? BEHIND_LOW : BEHIND) + 15,
        maxLiveSyncPlaybackRate: 1.05,
        // no bigger picture than the player shows (a phone doesn't need 1080p60 at 8 Mbps), and start careful
        capLevelToPlayerSize: true,
        abrBandWidthUpFactor: 0.6,
        backBufferLength: 30,
        // a slow segment or playlist gets more tries before it's an error
        fragLoadPolicy: { default: { maxTimeToFirstByteMs: 10_000, maxLoadTimeMs: 20_000, timeoutRetry: { maxNumRetry: 4, retryDelayMs: 0, maxRetryDelayMs: 0 }, errorRetry: { maxNumRetry: 6, retryDelayMs: 1000, maxRetryDelayMs: 8000 } } },
        playlistLoadPolicy: { default: { maxTimeToFirstByteMs: 10_000, maxLoadTimeMs: 20_000, timeoutRetry: { maxNumRetry: 4, retryDelayMs: 0, maxRetryDelayMs: 0 }, errorRetry: { maxNumRetry: 4, retryDelayMs: 1000, maxRetryDelayMs: 8000 } } },
      });
      hlsRef.current = hls;
      const h = hls;
      const stalls: number[] = [];
      h.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLevels(data.levels.map(levelName));
        if (low) {
          // the best the player can show: its height in device pixels, at least 480p, at most 1080p
          const fits = Math.min(1080, Math.max(480, Math.ceil(v.clientHeight * (devicePixelRatio || 1))));
          let best = -1;
          data.levels.forEach((l, i) => {
            if (l.height && l.height <= fits && (best < 0 || l.bitrate > data.levels[best].bitrate)) best = i;
          });
          if (best >= 0) {
            h.currentLevel = best;
            setLevel(best);
          }
        }
        start();
      });
      h.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setPlayingLevel(data.level));
      h.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) {
          if (!low || data.details !== Hls.ErrorDetails.BUFFER_STALLED_ERROR) return;
          const now = Date.now();
          stalls.push(now);
          while (stalls.length && now - stalls[0] > STALL_WINDOW) stalls.shift();
          if (stalls.length < STALLS) return;
          stalls.length = 0;
          // the next quality down that still shows video
          const lv = h.levels;
          const cur = lv[h.currentLevel];
          let next = -1;
          lv.forEach((l, i) => {
            if (l.height && cur && l.bitrate < cur.bitrate && (next < 0 || l.bitrate > lv[next].bitrate)) next = i;
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
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) h.recoverMediaError();
        else if (code === 410) setState('ended');
        else setState('error');
      });
      h.loadSource(src);
      h.attachMedia(v);
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
      const n = date && !v.paused ? Math.max(0, (Date.now() - date.getTime()) / 1000) : null;
      setBehind(n);
      onBehind(n);
    }, 1000);

    return () => {
      clearInterval(tick);
      onBehind(null);
      v.removeEventListener('playing', playing);
      hls?.destroy();
      hlsRef.current = null;
      v.removeAttribute('src');
      v.load();
    };
  }, [login, low, again]);

  const unmute = () => {
    const v = video.current!;
    v.muted = false;
    setMuted(false);
    v.play().catch(() => {});
  };
  const pick = (i: number) => {
    const h = hlsRef.current;
    if (!h) return;
    h.nextLevel = i; // from the next segment on, without emptying what's loaded
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
      <div class="wt-bar scroll-x" role="toolbar" aria-label={t('Player')}>
        {state === 'playing' && (
          <>
            <button class="chip wt-live" onClick={toLive} title={t('Jump to live')}>
              <span class="wt-dot" aria-hidden="true" /> {behind == null ? t('Live') : t('{n} s behind', { n: behind.toFixed(1) })}
              <Icon name="player-skip-forward" size={14} />
            </button>
            <button class="chip" aria-pressed={low} onClick={onLow} title={t('Play the video Twitch is still making as it streams in')}>
              <Icon name="bolt" size={14} /> {t('Low latency')}
            </button>
            {levels.length > 1 && (
              <label class="chip wt-quality" title={t('Quality')}>
                <Icon name="adjustments-horizontal" size={14} />
                <select value={level} onChange={(e) => pick(Number(e.currentTarget.value))} aria-label={t('Quality')}>
                  {!low && <option value={-1}>{playingLevel >= 0 ? t('Auto ({quality})', { quality: levels[playingLevel] }) : t('Auto')}</option>}
                  {levels.map((name, i) => <option value={i}>{name}</option>)}
                </select>
              </label>
            )}
          </>
        )}
        <button class="chip wt-chat" aria-pressed={chat} onClick={onChat}>
          <Icon name={chat ? 'messages' : 'messages-off'} size={14} /> {t('Chat')}
        </button>
      </div>
      {steppedDown && <p class="empty-note">{t('It kept stopping to load, so the quality went down a step.')}</p>}
      {children}
    </section>
  );
}
