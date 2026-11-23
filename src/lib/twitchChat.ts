// A Twitch channel's live chat, read anonymously: Twitch's IRC over a WebSocket, as a logged-out viewer
// ("justinfan…"), which can read any chat but not write in it. The last ~100 lines come first from
// recent-messages.robotty.de, so the chat isn't empty when it opens. For the Watch live page (views/Watch.tsx).

/** One raw IRC line → its tags, command, channel/target params and text. */
export function parseIrc(line: string) {
  let i = 0;
  const tags: Record<string, string> = {};
  if (line[0] === '@') {
    const end = line.indexOf(' ');
    for (const kv of line.slice(1, end).split(';')) {
      const eq = kv.indexOf('=');
      const k = eq < 0 ? kv : kv.slice(0, eq);
      tags[k] = eq < 0 ? '' : kv.slice(eq + 1).replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\').replace(/\\r/g, '\r').replace(/\\n/g, '\n');
    }
    i = end + 1;
  }
  let prefix = '';
  if (line[i] === ':') {
    const end = line.indexOf(' ', i);
    prefix = line.slice(i + 1, end);
    i = end + 1;
  }
  const t = line.indexOf(' :', i);
  const head = (t < 0 ? line.slice(i) : line.slice(i, t)).trim().split(' ');
  return { tags, prefix, command: head[0] || '', params: head.slice(1), trailing: t < 0 ? '' : line.slice(t + 2) };
}

/** The emotes Twitch marked in a line ("25:0-4,6-10/1902:12-16") as { name: code } for lib/emotes.ts. */
export function twitchEmotes(text: string, tag: string | undefined): Record<string, string> | undefined {
  if (!tag || !text) return undefined;
  const chars = [...text];
  const words = new Set(text.split(/\s+/));
  const found: [string, string][] = [];
  for (const part of tag.split('/')) {
    const colon = part.indexOf(':');
    const [from, to] = part.slice(colon + 1).split(',')[0].split('-').map(Number);
    if (colon < 1 || !(to >= from) || to >= chars.length) continue;
    const name = chars.slice(from, to + 1).join('');
    if (name && words.has(name)) found.push([name, `t${part.slice(0, colon)}`]);
  }
  return found.length ? Object.fromEntries(found) : undefined;
}

/**
 * A line in the chat: id, when (ms), login, display name, colour, text, kind, Twitch's emotes in it, its badges
 * ("set/version"), and whether a moderator took it down. `note` is Twitch's own line about a sub, raid, gift…
 */
export interface ChatLine {
  id: string; t: number; u: string; n: string; c: string; m: string;
  k: 'msg' | 'me' | 'sub'; note?: string; e?: Record<string, string>; b: string[]; gone?: boolean;
}

/** What the room allows, from ROOMSTATE. */
export interface Room { emoteOnly?: boolean; subsOnly?: boolean; slow?: number; followers?: number }

export type ChatEvent =
  | { kind: 'line'; line: ChatLine }
  | { kind: 'delete'; id: string }
  | { kind: 'clear'; login: string | null } // a timeout or ban (login), or the whole chat cleared (null)
  | { kind: 'room'; room: Room };

const badgeList = (tag: string | undefined) => (tag ? tag.split(',').filter(Boolean) : []);
let counter = 0;

/** One IRC line as something the chat shows or does; null for the rest. */
export function chatEvent(raw: string): ChatEvent | null {
  const p = parseIrc(raw);
  const tags = p.tags;
  const t = Number(tags['tmi-sent-ts']) || Date.now();
  const login = tags.login || p.prefix.split('!')[0] || '';
  const base = { id: tags.id || `x${++counter}`, t, u: login, n: tags['display-name'] || login, c: tags.color || '', b: badgeList(tags.badges) };
  if (p.command === 'PRIVMSG') {
    let m = p.trailing;
    const me = /^\u0001ACTION (.*)\u0001$/.exec(m);
    if (me) m = me[1];
    return { kind: 'line', line: { ...base, m, k: me ? 'me' : 'msg', e: twitchEmotes(m, tags.emotes) } };
  }
  if (p.command === 'USERNOTICE') {
    const note = tags['system-msg'] || '';
    if (!note && !p.trailing) return null;
    return { kind: 'line', line: { ...base, m: p.trailing, k: 'sub', note, e: twitchEmotes(p.trailing, tags.emotes) } };
  }
  if (p.command === 'CLEARMSG') return tags['target-msg-id'] ? { kind: 'delete', id: tags['target-msg-id'] } : null;
  if (p.command === 'CLEARCHAT') return { kind: 'clear', login: p.trailing.trim().toLowerCase() || null };
  if (p.command === 'ROOMSTATE') {
    const room: Room = {};
    if ('emote-only' in tags) room.emoteOnly = tags['emote-only'] === '1';
    if ('subs-only' in tags) room.subsOnly = tags['subs-only'] === '1';
    if ('slow' in tags) room.slow = Number(tags.slow) || 0;
    if ('followers-only' in tags) room.followers = Number(tags['followers-only']);
    return { kind: 'room', room };
  }
  return null;
}

/** The last lines said in a channel, from before the page opened. [] when they can't be had. */
export async function recentLines(login: string): Promise<ChatEvent[]> {
  try {
    const r = await fetch(`https://recent-messages.robotty.de/api/v2/recent-messages/${login}?limit=100`, { signal: AbortSignal.timeout(6_000) });
    const body = r.ok ? await r.json() : null;
    const list: unknown = body?.messages;
    return Array.isArray(list) ? list.flatMap((raw) => (typeof raw === 'string' ? chatEvent(raw) ?? [] : [])) : [];
  } catch {
    return [];
  }
}

export type ChatStatus = 'connecting' | 'live' | 'retrying';

/**
 * Read a channel's chat as it happens: every line, deletion, timeout and room change goes to `on`. Reconnects by
 * itself (1 s, 2 s, 4 s … up to 30 s apart). Returns a function that closes it.
 */
export function readChat(login: string, on: (e: ChatEvent) => void, status: (s: ChatStatus) => void): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let wait = 1000;
  let timer = 0;
  let quiet = 0;

  const open = () => {
    status(wait === 1000 ? 'connecting' : 'retrying');
    const s = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    ws = s;
    // Twitch PINGs every ~5 min; nothing at all for 6 means the line is dead
    const alive = () => { clearTimeout(quiet); quiet = window.setTimeout(() => s.close(), 6 * 60_000); };
    s.onopen = () => {
      s.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      s.send('PASS SCHMOOPIIE');
      s.send(`NICK justinfan${10000 + Math.floor(Math.random() * 80000)}`);
      s.send(`JOIN #${login}`);
      alive();
    };
    s.onmessage = (m) => {
      alive();
      for (const raw of String(m.data).split('\r\n')) {
        if (!raw) continue;
        if (raw.startsWith('PING')) { s.send(raw.replace('PING', 'PONG')); continue; }
        const p = parseIrc(raw);
        if (p.command === 'RECONNECT') { s.close(); return; }
        if (p.command === 'JOIN' || p.command === 'ROOMSTATE') { wait = 1000; status('live'); }
        const e = chatEvent(raw);
        if (e) on(e);
      }
    };
    s.onclose = () => {
      clearTimeout(quiet);
      if (closed) return;
      status('retrying');
      timer = window.setTimeout(open, wait);
      wait = Math.min(wait * 2, 30_000);
    };
  };
  open();
  return () => {
    closed = true;
    clearTimeout(timer);
    clearTimeout(quiet);
    ws?.close();
  };
}

/** What the page shows about a channel: its id (for its emotes), name, badges, and what's on now. */
export interface ChannelInfo {
  id: string; name: string;
  stream: { title: string; game: string; viewers: number; since: number | null } | null;
  badges: Record<string, [string, string]>;
}
export async function channelInfo(login: string): Promise<ChannelInfo | null> {
  try {
    const r = await fetch(`/api/watch/chat/${login}`, { signal: AbortSignal.timeout(15_000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// Twitch's colours for a name that never picked one, chosen by the name so it's always the same
const DEFAULT_COLORS = ['#FF0000', '#0000FF', '#008000', '#B22222', '#FF7F50', '#9ACD32', '#FF4500', '#2E8B57', '#DAA520', '#D2691E', '#5F9EA0', '#1E90FF', '#FF69B4', '#8A2BE2', '#00FF7F'];
export function nameColor(line: Pick<ChatLine, 'c' | 'u'>) {
  if (line.c) return line.c;
  let h = 0;
  for (const ch of line.u) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return DEFAULT_COLORS[Math.abs(h) % DEFAULT_COLORS.length];
}

/** An emote picture's address at its largest, and who it's from, for the close-up. */
export function bigEmote(src: string): { src: string; from: string } {
  if (src.includes('static-cdn.jtvnw.net')) return { src: src.replace(/\/\d\.0$/, '/3.0'), from: 'Twitch' };
  if (src.includes('7tv.app')) return { src: src.replace(/\/\dx\.webp$/, '/4x.webp'), from: '7TV' };
  if (src.includes('betterttv.net')) return { src: src.replace(/\/\dx\.webp$/, '/3x.webp'), from: 'BetterTTV' };
  if (src.includes('frankerfacez.com')) return { src: src.replace(/\/\d$/, '/4'), from: 'FrankerFaceZ' };
  return { src, from: '' };
}
