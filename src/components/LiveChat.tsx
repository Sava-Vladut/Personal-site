import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { memo } from 'preact/compat';
import { Icon } from './icons';
import { ChatText } from './ChatText';
import { loadEmotes } from '../lib/chatlogs';
import type { Emotes } from '../lib/emotes';
import { bigEmote, nameColor, readChat, recentLines, type ChannelInfo, type ChatEvent, type ChatLine, type ChatStatus } from '../lib/twitchChat';
import { navigate } from '../lib/router';
import { t } from '../lib/i18n';

/*
 * The chat beside the video on Watch live, read-only (writing in it takes a Twitch login): Twitch's emotes and the
 * channel's 7TV, BetterTTV and FrankerFaceZ ones, badges, name colours, lines moderators took down greyed out.
 *  • In step with the video: the chat comes straight from Twitch, seconds ahead of a picture that's 5–8 s behind,
 *    so each line waits until the video reaches the moment it was said (less the ~2.5 s Twitch's own viewers are
 *    behind, as they're the ones writing). Off: lines show the moment they arrive.
 *  • It follows the newest line unless you scroll up; then it stays put and counts what's new.
 *  • Tap an emote for a close-up, a name for what they've said here (and their chat history in Chat logs).
 */
const TWITCH_BEHIND = 2.5;
const KEEP = 250;        // lines kept while following
const KEEP_READING = 1500; // while scrolled up, so what you're reading doesn't move
const TICK = 200;

type Peek = { kind: 'emote'; name: string; src: string; from: string } | { kind: 'user'; login: string };

/** `sync`: in step with the video (its switch is in the player's menu, views/Watch.tsx). */
export function LiveChat({ login, info, behind, sync }: { login: string; info: ChannelInfo | null; behind: { current: number | null }; sync: boolean }) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [status, setStatus] = useState<ChatStatus>('connecting');
  const [emotes, setEmotes] = useState<Emotes | null>(null);
  const [following, setFollowing] = useState(true);
  const [unread, setUnread] = useState(0);
  const [peek, setPeek] = useState<Peek | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const followRef = useRef(true);
  const linesRef = useRef<ChatLine[]>([]);

  useEffect(() => {
    if (info?.id) loadEmotes(info.id).then(setEmotes, () => {});
  }, [info?.id]);

  // lines wait in `queue` until it's their time; events apply in the order they came
  useEffect(() => {
    let queue: { at: number; e: ChatEvent }[] = [];
    let seen = new Set<string>();
    let live = true;
    /** Apply events; `before` puts their lines ahead of the ones already shown (what was said before the page opened). */
    const apply = (events: ChatEvent[], before = false) => {
      if (!events.length) return;
      let next = linesRef.current;
      const fresh: ChatLine[] = [];
      for (const e of events) {
        if (e.kind === 'line') {
          if (seen.has(e.line.id)) continue;
          seen.add(e.line.id);
          fresh.push(e.line);
        } else if (e.kind === 'delete') {
          next = next.map((l) => (l.id === e.id ? { ...l, gone: true } : l));
          for (let i = 0; i < fresh.length; i++) if (fresh[i].id === e.id) fresh[i] = { ...fresh[i], gone: true };
        } else if (e.kind === 'clear' && e.login) {
          const off = (l: ChatLine) => (l.u === e.login && !l.gone ? { ...l, gone: true } : l);
          next = next.map(off);
          fresh.splice(0, fresh.length, ...fresh.map(off));
        }
      }
      if (fresh.length) next = before ? [...fresh, ...next] : [...next, ...fresh];
      const keep = followRef.current ? KEEP : KEEP_READING;
      if (next.length > keep) {
        next = next.slice(next.length - keep);
        if (seen.size > keep * 4) seen = new Set(next.map((l) => l.id));
      }
      if (next === linesRef.current) return;
      linesRef.current = next;
      setLines(next);
      if (!followRef.current && fresh.length && !before) setUnread((n) => n + fresh.length);
    };

    recentLines(login).then((events) => {
      if (live) apply(events.filter((e) => e.kind !== 'room'), true);
    });
    const stop = readChat(login, (e) => queue.push({ at: Date.now(), e }), setStatus);
    const tick = setInterval(() => {
      const wait = syncRef.current && behind.current != null ? Math.min(30, Math.max(0, behind.current - TWITCH_BEHIND)) * 1000 : 0;
      const now = Date.now();
      let n = 0;
      while (n < queue.length && queue[n].at + wait <= now) n++;
      if (!n) return;
      const due = queue.slice(0, n);
      queue = queue.slice(n);
      apply(due.map((q) => q.e));
    }, TICK);
    return () => {
      live = false;
      stop();
      clearInterval(tick);
    };
  }, [login]);

  // follow the newest line
  useLayoutEffect(() => {
    const el = list.current;
    if (el && followRef.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const onScroll = () => {
    const el = list.current!;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atEnd !== followRef.current) {
      followRef.current = atEnd;
      setFollowing(atEnd);
      if (atEnd) setUnread(0);
    }
  };
  const toEnd = () => {
    const el = list.current!;
    followRef.current = true;
    setFollowing(true);
    setUnread(0);
    el.scrollTop = el.scrollHeight;
  };
  // taps on emotes and names, for the whole list at once
  const onClick = (ev: MouseEvent) => {
    const el = ev.target as HTMLElement;
    if (el instanceof HTMLImageElement && el.classList.contains('cl-emote')) {
      const big = bigEmote(el.currentSrc || el.src);
      setPeek({ kind: 'emote', name: el.alt, ...big });
    } else {
      const who = el.closest<HTMLElement>('[data-u]')?.dataset.u;
      if (who) setPeek({ kind: 'user', login: who });
    }
  };

  return (
    <section class="lc" aria-label={t('Chat')}>
      {status !== 'live' && lines.length > 0 && <p class="lc-status">{status === 'connecting' ? t('Connecting…') : t('Reconnecting…')}</p>}
      <div class="lc-list" ref={list} onScroll={onScroll} onClick={onClick} role="log" aria-live="off">
        {lines.length === 0 && <p class="lc-empty">{status === 'live' ? t('No one has said anything yet.') : t('Connecting…')}</p>}
        {lines.map((l) => <Line key={l.id} line={l} emotes={emotes} badges={info?.badges ?? null} />)}
      </div>

      {!following && (
        <button class="btn btn-primary lc-more" onClick={toEnd}>
          <Icon name="arrow-down" size={16} /> {unread ? t('{n} new', { n: unread > 99 ? '99+' : unread }) : t('Back to newest')}
        </button>
      )}

      {peek && <PeekCard peek={peek} lines={lines} emotes={emotes} info={info} channel={login} close={() => setPeek(null)} />}

    </section>
  );
}

function Badges({ list, badges }: { list: string[]; badges: ChannelInfo['badges'] | null }) {
  if (!badges || !list.length) return null;
  return (
    <>
      {list.map((key) => {
        const b = badges[key];
        return b ? <img class="lc-badge" src={b[0]} srcset={`${b[0]} 1x, ${b[0].replace(/\/1$/, '/2')} 2x`} alt={b[1]} title={b[1]} /> : null;
      })}
    </>
  );
}

const Line = memo(function Line({ line: l, emotes, badges }: { line: ChatLine; emotes: Emotes | null; badges: ChannelInfo['badges'] | null }) {
  const color = nameColor(l);
  const name = l.n.toLowerCase() === l.u ? l.n : `${l.n} (${l.u})`;
  return (
    <div class={`lc-line k-${l.k}${l.gone ? ' gone' : ''}`}>
      {l.note && <p class="lc-note">{l.note}</p>}
      {(l.m || !l.note) && (
        <p>
          <Badges list={l.b} badges={badges} />
          <button class="lc-name" style={{ '--c': color }} data-u={l.u}>{name}</button>
          {l.k === 'me' ? ' ' : ': '}
          <span class="lc-text" style={l.k === 'me' ? { '--c': color } : undefined}><ChatText text={l.m} own={l.e} emotes={emotes} /></span>
        </p>
      )}
    </div>
  );
});

function PeekCard({ peek, lines, emotes, info, channel, close }: {
  peek: Peek; lines: ChatLine[]; emotes: Emotes | null; info: ChannelInfo | null; channel: string; close: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);

  if (peek.kind === 'emote') {
    return (
      <div class="lc-peek" role="dialog" aria-label={peek.name}>
        <button class="lc-peek-x" onClick={close} aria-label={t('Close')}><Icon name="x" size={18} /></button>
        <div class="lc-peek-emote">
          <img src={peek.src} alt={peek.name} />
          <div><strong>{peek.name}</strong>{peek.from && <span>{peek.from}</span>}</div>
        </div>
      </div>
    );
  }
  const theirs = lines.filter((l) => l.u === peek.login);
  const last = theirs[theirs.length - 1];
  return (
    <div class="lc-peek" role="dialog" aria-label={last?.n ?? peek.login}>
      <button class="lc-peek-x" onClick={close} aria-label={t('Close')}><Icon name="x" size={18} /></button>
      <p class="lc-peek-who">
        {last && <Badges list={last.b} badges={info?.badges ?? null} />}
        <strong style={{ color: last ? `color-mix(in oklab, ${nameColor(last)} 78%, var(--ink))` : undefined }}>{last?.n ?? peek.login}</strong>
      </p>
      <div class="lc-peek-lines">
        {theirs.length === 0 && <p class="lc-empty">{t('Nothing from them in the chat shown here.')}</p>}
        {theirs.slice(-20).map((l) => (
          <p class={l.gone ? 'gone' : ''}>
            <time>{new Date(l.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{' '}
            <ChatText text={l.m || l.note || ''} own={l.e} emotes={emotes} />
          </p>
        ))}
      </div>
      <div class="lc-peek-actions">
        <button class="chip" onClick={() => navigate(`chatlogs?channel=${channel}&user=${peek.login}`)}>
          <Icon name="history" size={14} /> {t('Their chat history')}
        </button>
        <a class="chip" href={`https://www.twitch.tv/${peek.login}`} target="_blank" rel="noopener noreferrer">
          <Icon name="external-link" size={14} /> {t('Twitch profile')}
        </a>
      </div>
    </div>
  );
}
