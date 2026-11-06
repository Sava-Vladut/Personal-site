// Chat logs: everything one Twitch user wrote in one channel's chat, by month, with a year of activity in days.
// Three sources, merged and de-duplicated:
//  • The public justlog/rustlog archives that the Twitch tools community runs (logs.ivr.fi and friends, the same list
//    logs.zonian.dev searches). Each logs its own set of channels, so every one is asked, by Twitch id so renames
//    don't matter. logs.zonian.dev also names any archive this list doesn't know about. Users can opt out on them.
//  • recent-messages.robotty.de: the last 24 hours of any channel's chat (it joins a channel when it's asked for
//    one and keeps reading it for a day), so small channels nobody archives still show what was said lately.
//  • A recorder here: an anonymous chat connection (no Twitch account needed) that reads the channels the admin
//    picks and keeps every line in `directory/<channel>/<YYYY-MM-DD>.ndjson`. That's how a small channel that no
//    archive covers gets logged, from the moment it's added.
// Reading a year is the slow part, so it's done at once, month by month, without waiting for the slowest archive, and a
// finished month is kept on disk as counts per quarter hour. The emotes of 7TV, BetterTTV and FrankerFaceZ
// come from chatlog-emotes.js; Twitch's own are in each line.
import { appendFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import tls from 'node:tls';
import { HttpError } from './http-error.js';
import { REVALIDATE, json } from './http-response.js';
import { createEmotes } from './chatlog-emotes.js';

const UA = 'MyMind chat logs (savavlad.com)';
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** The archives asked for every lookup. Ones that are down or behind a bot check just don't answer. */
export const ARCHIVES = [
  'logs.ivr.fi', 'logs.zonian.dev', 'logs.susgee.dev', 'logs.nadeko.net', 'logs.spanix.team', 'logs.magichack.xyz',
  'logs.supa.codes', 'logs.mejkiz.com', 'logs.folhinhabot.com', 'logs.cyex.app', 'logs.mrchuw.com.br',
  'logs.twitchmetrics.xyz', 'logs.jimmyboy.dev', 'logs.lotuslabs.dev', 'logs.potat.app', 'logs.fais.al',
  'harambelogs.pl', 'vtlogs.moe',
];
const FINDER = 'https://logs.zonian.dev/api';
const RECENT = 'https://recent-messages.robotty.de/api/v2/recent-messages';
const IVR = 'https://api.ivr.fi/v2/twitch/user';

const LOGIN = /^[a-z0-9_]{2,25}$/;
const MONTH = /^(\d{4})-(\d{2})$/;
const LOOKUPS_PER_MIN = 20;     // fresh lookups (each ~20 small calls) the whole server starts in a minute
const LOOKUP_FRESH = 10 * MIN;
const PAST_FRESH = 12 * HOUR;   // a finished month hardly changes
const NOW_FRESH = 2 * MIN;      // this month's is fetched again after this
const CACHE_MESSAGES = 120_000; // messages kept in memory across all cached months
const MAX_WATCHED = 30;
const MONTH_CAP = 50_000;       // messages returned for one month at most (the newest)
const SEARCH_CAP = 500;
const QUARTER = 15 * MIN;
// One slow archive must not hold everyone up: a wait ends at the cap, or a little after the first archive that has
// something has answered. Whatever hasn't answered by then keeps going and joins what's cached when it does.
const LOOKUP_CAP = 2_500;
const LOOKUP_GRACE = 700;
const MONTH_CAP_WAIT = 30_000;
const MONTH_GRACE = 1_000;
const MONTHS_AT_ONCE = 6;       // months being read from the archives at the same time, server-wide
const PARTIAL_FRESH = MIN;      // a month that no archive answered is asked again soon
const COUNTS_FRESH = DAY;       // a finished month's saved counts are read again in the background after this
const COUNTS_PAIRS = 500;       // users' saved counts kept on disk

/* ---------- small helpers ---------- */

async function getJson(url, ms = 10_000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
  const type = r.headers.get('content-type') || '';
  if (!type.includes('json')) {
    await r.body?.cancel().catch(() => {});
    return { status: r.status, body: null };
  }
  return { status: r.status, body: await r.json().catch(() => null) };
}

/**
 * Waits for the promises (none may reject), but no longer than `cap` ms, and, once one has answered with something
 * `useful`, no longer than `grace` ms more. Whatever is still out keeps running.
 */
function waitFor(tasks, { cap, grace, useful }) {
  return new Promise((resolve) => {
    const end = Date.now() + cap;
    let left = tasks.length;
    let timer = setTimeout(done, cap);
    let graced = false;
    function done() { clearTimeout(timer); resolve(); }
    if (!left) return done();
    for (const task of tasks) {
      task.then((r) => {
        if (!--left) return done();
        if (!graced && useful(r)) {
          graced = true;
          clearTimeout(timer);
          timer = setTimeout(done, Math.max(0, Math.min(grace, end - Date.now())));
        }
      });
    }
  });
}

/** At most `n` jobs run at once; the rest wait their turn. */
function gate(n) {
  let used = 0;
  const queue = [];
  return async (work) => {
    if (used >= n) await new Promise((r) => queue.push(r));
    used++;
    try { return await work(); } finally { used--; queue.shift()?.(); }
  };
}

/** A login, link or @name as a Twitch login; null when it isn't one. */
export function cleanLogin(s) {
  const n = String(s ?? '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.|m\.)?twitch\.tv\//i, '').replace(/[/?#].*$/, '').toLowerCase();
  return LOGIN.test(n) ? n : null;
}

const pad = (n) => String(n).padStart(2, '0');
const monthOf = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };
const dayKey = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

/** Day keys in a time zone. Every zone's offset is a multiple of 15 minutes, so a quarter hour has one day. */
function dayKeyer(tz) {
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return dayKey;
  }
  const memo = new Map();
  return (ms) => {
    const q = Math.floor(ms / (15 * MIN));
    let k = memo.get(q);
    if (!k) memo.set(q, (k = fmt.format(q * 15 * MIN)));
    return k;
  };
}

/* ---------- IRC lines (the recorder and recent-messages both speak it) ---------- */

/**
 * The emotes Twitch itself found in a line, as { name: code } (code: 't' and the emote's id), from the emotes tag
 * ("25:0-4,6-10/1902:12-16") and the text its positions count in. Only names that really stand as words are kept.
 */
export function twitchEmotes(text, tag) {
  if (!tag || !text) return undefined;
  const chars = [...text];
  const words = new Set(text.split(/\s+/));
  const found = [];
  for (const part of tag.split('/')) {
    const colon = part.indexOf(':');
    const [from, to] = part.slice(colon + 1).split(',')[0].split('-').map(Number);
    if (colon < 1 || !(to >= from) || to >= chars.length) continue;
    const name = chars.slice(from, to + 1).join('');
    if (name && words.has(name)) found.push([name, `t${part.slice(0, colon)}`]);
  }
  return found.length ? Object.fromEntries(found) : undefined;
}

/** One raw Twitch IRC line → { tags, prefix, command, params, trailing }. */
export function parseIrc(line) {
  let i = 0;
  const tags = {};
  if (line[0] === '@') {
    const end = line.indexOf(' ');
    for (const kv of line.slice(1, end).split(';')) {
      const eq = kv.indexOf('=');
      const k = eq < 0 ? kv : kv.slice(0, eq);
      const v = eq < 0 ? '' : kv.slice(eq + 1).replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\').replace(/\\r/g, '\r').replace(/\\n/g, '\n');
      tags[k] = v;
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

/**
 * A chat line as what's kept: { t: ms, i: user id, u: login, n: display name, c: colour, m: text, k: kind, e? }.
 * Kinds: 'msg' (what they wrote), 'me' (a /me), 'ban' (a timeout or ban, aimed at them), 'sub' (a sub, gift or raid
 * notice). `e` holds the Twitch emotes in the text (twitchEmotes), when there are any.
 */
export function slimIrc(p) {
  const t = Number(p.tags['tmi-sent-ts']) || Date.now();
  if (p.command === 'PRIVMSG') {
    const login = p.prefix.split('!')[0];
    let m = p.trailing;
    const action = /^\u0001ACTION (.*)\u0001$/.exec(m);
    if (action) m = action[1];
    return withEmotes({ t, i: p.tags['user-id'] || '', u: login, n: p.tags['display-name'] || login, c: p.tags.color || '', m, k: action ? 'me' : 'msg' }, twitchEmotes(m, p.tags.emotes));
  }
  if (p.command === 'CLEARCHAT' && p.trailing) {
    const secs = Number(p.tags['ban-duration']);
    return { t, i: p.tags['target-user-id'] || '', u: p.trailing, n: p.trailing, c: '', m: secs ? `timed out for ${secs}s` : 'banned', k: 'ban' };
  }
  if (p.command === 'USERNOTICE') {
    const login = p.tags.login || '';
    const sys = p.tags['system-msg'] || '';
    return withEmotes({ t, i: p.tags['user-id'] || '', u: login, n: p.tags['display-name'] || login, c: p.tags.color || '', m: p.trailing ? `${sys} · ${p.trailing}` : sys, k: 'sub' }, twitchEmotes(p.trailing, p.tags.emotes));
  }
  return null;
}

const withEmotes = (line, e) => (e ? { ...line, e } : line);

/** A justlog JSON message as what's kept (the same shape as the recorder's). */
export function slimArchive(x) {
  const tags = x.tags || {};
  const t = Number(tags['tmi-sent-ts']) || Date.parse(x.timestamp) || 0;
  if (x.type === 2) { // CLEARCHAT
    const secs = Number(tags['ban-duration']);
    const who = String(x.username || '').replace(/^:/, '');
    return { t, i: tags['target-user-id'] || '', u: who, n: who, c: '', m: secs ? `timed out for ${secs}s` : 'banned', k: 'ban' };
  }
  if (x.type === 4) { // USERNOTICE
    const sys = tags['system-msg'] || '';
    // an archive may keep the system message in front of what they wrote; Twitch's emote positions count in what they wrote
    const said = sys && x.text?.startsWith(sys) ? x.text.slice(sys.length).trim() : x.text;
    return withEmotes({ t, i: tags['user-id'] || '', u: x.username || '', n: x.displayName || x.username || '', c: tags.color || '', m: x.text && x.text !== sys ? (sys ? `${sys} · ${x.text}` : x.text) : sys, k: 'sub' }, twitchEmotes(said, tags.emotes));
  }
  if (x.type !== 1) return null; // joins, room states, whispers…
  let m = String(x.text ?? '');
  const action = /^\u0001ACTION (.*)\u0001$/.exec(m);
  if (action) m = action[1];
  return withEmotes({ t, i: tags['user-id'] || '', u: x.username || '', n: x.displayName || x.username || '', c: tags.color || '', m, k: action ? 'me' : 'msg' }, twitchEmotes(m, tags.emotes));
}

/** Two archives logging the same channel hold the same lines; Twitch's send time and the text tell them apart. */
export function merge(lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const x of list) {
      const key = `${Math.floor(x.t / 1000)}|${x.k}|${x.m}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(x);
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/* ---------- the recorder ---------- */

function createRecorder(directory, onLine) {
  let sock = null;
  let buf = '';
  let wanted = new Set();
  let joined = new Set();
  let retry = 0;
  let timer = null;
  let alive = null;
  let connectedAt = 0;
  let stopped = false;
  const pending = new Map(); // file → lines waiting to be written

  const send = (s) => sock?.writable && sock.write(s + '\r\n');

  function connect() {
    timer = null;
    if (stopped || !wanted.size) return;
    sock = tls.connect({ host: 'irc.chat.twitch.tv', port: 6697, servername: 'irc.chat.twitch.tv' });
    sock.setEncoding('utf8');
    sock.setKeepAlive(true, 60_000);
    sock.on('secureConnect', () => {
      send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      send('PASS SCHMOOPIIE');
      send(`NICK justinfan${10000 + Math.floor(Math.random() * 80000)}`);
    });
    sock.on('data', (chunk) => {
      buf += chunk;
      let n;
      while ((n = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, n);
        buf = buf.slice(n + 2);
        if (line) handle(line);
      }
      if (buf.length > 1 << 20) buf = '';
      bump();
    });
    const down = () => {
      if (!sock) return;
      sock.removeAllListeners();
      sock.destroy();
      sock = null;
      joined = new Set();
      connectedAt = 0;
      clearTimeout(alive);
      if (stopped) return;
      const wait = Math.min(5 * MIN, 2000 * 2 ** retry++);
      timer = setTimeout(connect, wait);
    };
    sock.on('error', (e) => { console.warn(`Chat logs: chat connection: ${e.message}`); down(); });
    sock.on('close', down);
    bump();
  }

  // Twitch pings every ~5 minutes; a connection silent for 7 is gone
  function bump() {
    clearTimeout(alive);
    alive = setTimeout(() => sock?.destroy(new Error('no reply from Twitch chat')), 7 * MIN);
  }

  function handle(line) {
    if (line.startsWith('PING')) return send('PONG' + line.slice(4));
    const p = parseIrc(line);
    if (p.command === '001') {
      retry = 0;
      connectedAt = Date.now();
      sync();
      return;
    }
    if (p.command === 'RECONNECT') return sock?.destroy();
    if (p.command !== 'PRIVMSG' && p.command !== 'CLEARCHAT' && p.command !== 'USERNOTICE') return;
    const channel = (p.params[0] || '').replace(/^#/, '');
    if (!wanted.has(channel)) return;
    const x = slimIrc(p);
    if (!x || !x.u) return;
    const file = join(directory, channel, `${dayKey(x.t)}.ndjson`);
    if (!pending.has(file)) pending.set(file, []);
    pending.get(file).push(JSON.stringify(x));
    onLine(channel, x);
  }

  /** Join what's wanted and leave what isn't, a few at a time (Twitch allows 20 joins per 10 seconds). */
  function sync() {
    if (!connectedAt) return;
    const join_ = [...wanted].filter((c) => !joined.has(c));
    const part = [...joined].filter((c) => !wanted.has(c));
    if (part.length) send(`PART ${part.map((c) => '#' + c).join(',')}`);
    for (const c of part) joined.delete(c);
    for (let i = 0; i < join_.length; i += 15) {
      const group = join_.slice(i, i + 15);
      setTimeout(() => send(`JOIN ${group.map((c) => '#' + c).join(',')}`), (i / 15) * 11_000);
      for (const c of group) joined.add(c);
    }
  }

  // lines go to disk once a second, a file at a time
  const flusher = setInterval(async () => {
    const batch = [...pending];
    pending.clear();
    for (const [file, lines] of batch) {
      try {
        await appendFile(file, lines.join('\n') + '\n');
      } catch (e) {
        if (e.code === 'ENOENT') {
          await mkdir(join(file, '..'), { recursive: true }).catch(() => {});
          await appendFile(file, lines.join('\n') + '\n').catch((e2) => console.warn(`Chat logs: ${e2.message}`));
        } else console.warn(`Chat logs: ${e.message}`);
      }
    }
  }, 1000);
  flusher.unref();

  return {
    set(channels) {
      wanted = new Set(channels);
      if (!wanted.size) {
        clearTimeout(timer);
        timer = null;
        sock?.destroy(); // and connect() won't come back while nothing is wanted
        return;
      }
      if (sock) return sync();
      clearTimeout(timer);
      connect();
    },
    connected: () => !!connectedAt,
    since: () => connectedAt,
  };
}

/* ---------- the handler ---------- */

export function createChatLogs({ directory, isAdmin, archives = ARCHIVES, finder = FINDER, recent = RECENT, ivr = IVR, record = true }) {
  const watchFile = join(directory, 'watch.json');
  let watched = [];             // [{ login, id, name, since }]
  const counts = new Map();     // login → { today: day key, n: lines today, last: ms }
  let lookups = [];
  const lookupCache = new Map(); // `${channel}|${user}` → { at, body }
  const months = new Map();      // `${cid}|${uid}|${YYYY-MM}` → { at, list, sources }, oldest first
  let cachedMessages = 0;
  const inflight = new Map();
  const emotes = createEmotes(getJson);

  const recorder = record ? createRecorder(directory, (channel, x) => {
    const c = counts.get(channel) ?? { today: '', n: 0, last: 0 };
    const today = dayKey(x.t);
    if (c.today !== today) { c.today = today; c.n = 0; }
    c.n++;
    c.last = x.t;
    counts.set(channel, c);
  }) : null;

  async function loadWatched() {
    try {
      const list = JSON.parse(await readFile(watchFile, 'utf8'));
      watched = Array.isArray(list) ? list.filter((w) => w && LOGIN.test(w.login)) : [];
    } catch { watched = []; }
  }
  async function saveWatched() {
    await mkdir(directory, { recursive: true });
    const tmp = `${watchFile}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(watched, null, 1));
    await rename(tmp, watchFile);
    recorder?.set(watched.map((w) => w.login));
  }

  /** Only one copy of a slow call runs at a time; everyone waiting gets its answer. */
  function once(key, work) {
    if (inflight.has(key)) return inflight.get(key);
    const p = work().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  function limit() {
    const now = Date.now();
    lookups = lookups.filter((t) => now - t < MIN);
    if (lookups.length >= LOOKUPS_PER_MIN) throw new HttpError(429, 'Too many lookups at once. Try again in a minute.');
    lookups.push(now);
  }

  /** Twitch users by login, from ivr.fi: id, display name, avatar, whether they're banned. */
  async function users(logins) {
    try {
      const { body } = await getJson(`${ivr}?login=${logins.join(',')}`);
      const out = new Map();
      for (const u of Array.isArray(body) ? body : []) {
        if (u?.login) out.set(u.login.toLowerCase(), { login: u.login.toLowerCase(), id: String(u.id), name: u.displayName || u.login, logo: u.logo || null, banned: !!u.banned, color: u.chatColor || null });
      }
      return out;
    } catch {
      return new Map();
    }
  }

  /** Which months each archive holds of this user in this channel. */
  async function archiveMonths(host, cid, uid) {
    try {
      const { status, body } = await getJson(`https://${host}/list?channelid=${cid}&userid=${uid}`, 6_000);
      if (status === 403) return { host, optedOut: true, months: [] };
      const list = Array.isArray(body?.availableLogs) ? body.availableLogs : [];
      const months = [...new Set(list.map((m) => `${m.year}-${pad(m.month)}`).filter((m) => MONTH.test(m)))];
      return { host, optedOut: false, months };
    } catch {
      return { host, optedOut: false, months: [] };
    }
  }

  /** The days the recorder has of a channel, as YYYY-MM-DD. */
  async function recordedDays(login) {
    try {
      return (await readdir(join(directory, login))).filter((f) => /^\d{4}-\d{2}-\d{2}\.ndjson$/.test(f)).map((f) => f.slice(0, 10)).sort();
    } catch {
      return [];
    }
  }

  /** What the recorder kept of one user in one month. */
  async function recorded(login, uid, ulogin, month) {
    const days = (await recordedDays(login)).filter((d) => d.startsWith(month));
    const out = [];
    const needle = `"i":"${uid}"`;
    const byName = `"u":"${ulogin}"`;
    for (const d of days) {
      let text;
      try { text = await readFile(join(directory, login, `${d}.ndjson`), 'utf8'); } catch { continue; }
      for (const line of text.split('\n')) {
        if (!line || (!line.includes(needle) && !line.includes(byName))) continue;
        try {
          const x = JSON.parse(line);
          if (x.i === uid || (!x.i && x.u === ulogin)) out.push(x);
        } catch {}
      }
    }
    return out;
  }

  /** The last day of the channel's chat, from recent-messages, for one user. */
  async function lately(login, uid) {
    try {
      const { body } = await getJson(`${recent}/${login}?hide_moderation_messages=false&hide_moderated_messages=false`, 8_000);
      const out = [];
      for (const raw of Array.isArray(body?.messages) ? body.messages : []) {
        const x = slimIrc(parseIrc(raw));
        if (x && x.i === uid) out.push(x);
      }
      return out;
    } catch {
      return [];
    }
  }

  /* lookups: who the two are, and where their logs are */

  async function lookup(channel, user) {
    const key = `${channel}|${user}`;
    const hit = lookupCache.get(key);
    if (hit && Date.now() - hit.at < LOOKUP_FRESH) return hit.body;
    return once(`lookup:${key}`, async () => {
      limit();
      const who = await users([...new Set([channel, user])]);
      const c = who.get(channel), u = who.get(user);
      if (!c) throw new HttpError(404, `There’s no Twitch channel called ${channel}.`);
      if (!u) throw new HttpError(404, `There’s no Twitch user called ${user}.`);
      const w = watched.find((x) => x.login === channel);
      const body = { channel: c, user: u, sources: [], optedOut: false, recorded: w ? { since: w.since } : null, recordedDays: 0, lately: 0, months: [], at: Date.now() };

      // Everything is asked at once, and `body` is filled in as the answers come, so a slow archive can be left behind
      // and still joins it later: the lookup is cached as `body`. Each task answers with how much it found.
      const hosts = [...archives];
      const found = new Map(); // host → { host, optedOut, months }
      let days = [];
      let lateCount = 0;
      const assemble = () => {
        const answered = hosts.map((h) => found.get(h)).filter(Boolean);
        body.sources = answered.filter((s) => s.months.length).map((s) => ({ host: s.host, months: [...s.months].sort() }));
        body.optedOut = answered.some((s) => s.optedOut) && !body.sources.length;
        body.recordedDays = days.length;
        body.lately = lateCount;
        const all = new Set(body.sources.flatMap((s) => s.months));
        for (const d of days) all.add(d.slice(0, 7));
        // the last day is read on every month request for this month, so it counts as a source when it has lines
        if (lateCount) all.add(monthOf(Date.now()));
        body.months = [...all].sort();
      };
      const ask = (h) => archiveMonths(h, c.id, u.id).then((s) => { found.set(h, s); assemble(); return s.months.length; });
      const tasks = archives.map(ask);
      // the finder knows archives this list doesn't
      tasks.push(
        getJson(`${finder}/${c.id ? 'id:' + c.id : channel}/${u.id ? 'id:' + u.id : user}`, 8_000)
          .then(({ body: b }) => (b?.userLogs?.instances ?? []).map((x) => String(x).replace(/^https?:\/\//, '').replace(/\/.*$/, '')))
          .catch(() => [])
          .then((extra) => {
            const more = [...new Set(extra.filter((h) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(h) && !hosts.includes(h)))];
            hosts.push(...more);
            return Promise.all(more.map(ask)).then(() => 0);
          }),
        recordedDays(channel).then((d) => { days = d; assemble(); return d.length; }),
        lately(channel, u.id).then((l) => { lateCount = l.length; assemble(); return l.length; }),
      );
      await waitFor(tasks, { cap: LOOKUP_CAP, grace: LOOKUP_GRACE, useful: (n) => n > 0 });
      assemble();
      lookupCache.set(`${channel}|${user}`, { at: Date.now(), body });
      if (lookupCache.size > 200) lookupCache.delete(lookupCache.keys().next().value);
      return body;
    });
  }

  /* one month of one user's lines, from every source that has it */

  const reading = gate(MONTHS_AT_ONCE);

  async function month(look, ym, fresh = false) {
    const { channel: c, user: u } = look;
    const key = `${c.id}|${u.id}|${ym}`;
    const now = monthOf(Date.now());
    const hit = months.get(key);
    if (!fresh && hit && Date.now() - hit.at < (ym === now ? NOW_FRESH : hit.partial ? PARTIAL_FRESH : PAST_FRESH)) {
      months.delete(key); // most recently used goes last
      months.set(key, hit);
      return hit;
    }
    return once(`month:${key}`, () => reading(async () => {
      const [y, m] = ym.split('-');
      const from = look.sources.filter((s) => s.months.includes(ym));
      const sources = [
        ...from.map(async (s) => {
          try {
            const { status, body } = await getJson(`https://${s.host}/channelid/${c.id}/userid/${u.id}/${y}/${Number(m)}?json=1`, MONTH_CAP_WAIT);
            const ok = status === 200 && Array.isArray(body?.messages);
            return { name: s.host, ok, list: ok ? body.messages.map(slimArchive).filter(Boolean) : [] };
          } catch {
            return { name: s.host, ok: false, list: [] };
          }
        }),
        recorded(c.login, u.id, u.login, ym).then((list) => ({ name: 'here', ok: true, local: true, list })),
        ...(ym === now ? [lately(c.login, u.id).then((list) => ({ name: 'lately', ok: true, local: true, list }))] : []),
      ];
      const got = new Array(sources.length);
      const entry = { at: Date.now(), list: [], sources: [], partial: false };
      let settled = false;
      const build = () => {
        const here = got.filter(Boolean);
        entry.list = merge(here.map((g) => g.list)).filter((x) => monthOf(x.t) === ym);
        entry.sources = here.filter((g) => g.list.length).map((g) => g.name);
        // none of the archives holding this month answered: not worth remembering for long
        entry.partial = from.length > 0 && !here.some((g) => g.ok && !g.local);
      };
      sources.forEach((p, i) => p.then((g) => {
        got[i] = g;
        if (!settled) return;
        // it came in after the month was served: it's in what's cached from now on
        const old = entry.list.length;
        build();
        if (months.get(key) === entry) cachedMessages += entry.list.length - old;
      }));
      await waitFor(sources, { cap: MONTH_CAP_WAIT, grace: MONTH_GRACE, useful: (g) => g.list.length > 0 });
      settled = true;
      build();
      entry.at = Date.now();
      const old = months.get(key);
      if (old) { months.delete(key); cachedMessages -= old.list.length; }
      months.set(key, entry);
      cachedMessages += entry.list.length;
      while (cachedMessages > CACHE_MESSAGES && months.size > 1) {
        const [k, drop] = months.entries().next().value;
        months.delete(k);
        cachedMessages -= drop.list.length;
      }
      return entry;
    }));
  }

  /* a finished month, as counts per quarter hour: all the activity grid needs, kept on disk */

  const activityDir = join(directory, 'activity');
  const savedFiles = new Map(); // `${cid}-${uid}` → Promise<{ [YYYY-MM]: { at, q: [[quarter, n], ...] } }>
  const unsaved = new Map();    // key → that file, until it's written
  let flushTimer = null;
  let flushes = 0;

  function savedOf(cid, uid) {
    const key = `${cid}-${uid}`;
    let p = savedFiles.get(key);
    if (p) savedFiles.delete(key); // most recently used goes last
    else p = readFile(join(activityDir, `${key}.json`), 'utf8').then((text) => { const f = JSON.parse(text); return f && typeof f === 'object' ? f : {}; }, () => ({})).catch(() => ({}));
    savedFiles.set(key, p);
    if (savedFiles.size > 100) savedFiles.delete(savedFiles.keys().next().value);
    return p;
  }

  async function keep(cid, uid, ym, q) {
    const file = await savedOf(cid, uid);
    file[ym] = { at: Date.now(), q };
    unsaved.set(`${cid}-${uid}`, file);
    flushTimer ??= setTimeout(flush, 1000);
    flushTimer.unref?.();
  }

  async function flush() {
    flushTimer = null;
    const batch = [...unsaved];
    unsaved.clear();
    try {
      await mkdir(activityDir, { recursive: true });
      for (const [key, file] of batch) {
        const tmp = join(activityDir, `${key}.${process.pid}.tmp`);
        await writeFile(tmp, JSON.stringify(file));
        await rename(tmp, join(activityDir, `${key}.json`));
      }
      if (++flushes % 50 === 0) await prune();
    } catch (e) {
      console.warn(`Chat logs: saving counts: ${e.message}`);
    }
  }

  /** The least recently written users' counts go when there are more than COUNTS_PAIRS. */
  async function prune() {
    const names = (await readdir(activityDir).catch(() => [])).filter((f) => f.endsWith('.json'));
    if (names.length <= COUNTS_PAIRS) return;
    const aged = await Promise.all(names.map(async (f) => [f, await stat(join(activityDir, f)).then((s) => s.mtimeMs, () => 0)]));
    aged.sort((a, b) => a[1] - b[1]);
    for (const [f] of aged.slice(0, names.length - COUNTS_PAIRS)) await rm(join(activityDir, f), { force: true });
  }

  const quartersOf = (list) => {
    const q = new Map();
    for (const x of list) {
      const k = Math.floor(x.t / QUARTER);
      q.set(k, (q.get(k) ?? 0) + 1);
    }
    return [...q];
  };

  /** How much they wrote in each quarter hour of a month. A finished month comes from disk when it's there. */
  async function monthCounts(look, ym) {
    const { channel: c, user: u } = look;
    const finished = ym < monthOf(Date.now());
    if (finished) {
      const hit = (await savedOf(c.id, u.id))[ym];
      if (hit && Array.isArray(hit.q)) {
        if (Date.now() - hit.at > COUNTS_FRESH) {
          // what's saved is served now, and read again from the archives for next time
          once(`counts:${c.id}|${u.id}|${ym}`, async () => {
            const e = await month(look, ym, true);
            if (!e.partial) await keep(c.id, u.id, ym, quartersOf(e.list));
          }).catch(() => {});
        }
        return hit.q;
      }
    }
    const e = await month(look, ym);
    const q = quartersOf(e.list);
    if (finished && !e.partial) keep(c.id, u.id, ym, q).catch(() => {});
    return q;
  }

  /** A month in days (in the viewer's time zone): how many lines each day holds. A day at the edge can be in the next month's too. */
  async function monthDays(look, ym, tz) {
    const keyOf = dayKeyer(tz);
    const days = {};
    let total = 0;
    for (const [quarter, n] of await monthCounts(look, ym)) {
      const d = keyOf(quarter * QUARTER);
      days[d] = (days[d] ?? 0) + n;
      total += n;
    }
    return { month: ym, days, total };
  }

  /** A year in days: every month of it read at once (the server paces them), and the days added up. */
  async function activity(look, year, tz) {
    const want = look.months.filter((m) => m.startsWith(`${year}-`));
    const days = {};
    let total = 0;
    for (const got of await Promise.all(want.map((m) => monthDays(look, m, tz)))) {
      for (const [d, n] of Object.entries(got.days)) {
        if (!d.startsWith(`${year}-`)) continue; // the first or last hours of the year, across the time zone
        days[d] = (days[d] ?? 0) + n;
        total += n;
      }
    }
    return { year, days, total };
  }

  async function search(look, year, q) {
    const needle = q.toLowerCase();
    const want = look.months.filter((m) => m.startsWith(`${year}-`)).reverse();
    const hits = [];
    let more = false;
    for (const m of want) {
      const { list } = await month(look, m);
      for (let i = list.length - 1; i >= 0; i--) {
        if (!list[i].m.toLowerCase().includes(needle)) continue;
        if (hits.length >= SEARCH_CAP) { more = true; break; }
        hits.push(list[i]);
      }
      if (more) break;
    }
    return { q, year, messages: hits.reverse(), more };
  }

  /* the API */

  // What the archives hold is public, and the page asks for it again as months are flipped back and forth: the
  // browser keeps each answer (REVALIDATE) and gets a 304 with no body while it's the same, instead of a month again.

  async function watchList(req) {
    const out = [];
    for (const w of watched) {
      const days = await recordedDays(w.login);
      let bytes = 0;
      for (const d of days.slice(-62)) bytes += await stat(join(directory, w.login, `${d}.ndjson`)).then((s) => s.size, () => 0);
      const c = counts.get(w.login);
      out.push({ ...w, days: days.length, bytes, today: c && c.today === dayKey(Date.now()) ? c.n : 0, last: c?.last ?? null });
    }
    return { watched: out, connected: recorder?.connected() ?? false, admin: isAdmin(req), max: MAX_WATCHED };
  }

  async function api(req, res, path, url) {
    const q = url.searchParams;
    if (path === '/api/chatlogs/watch' || path.startsWith('/api/chatlogs/watch/')) {
      if (req.method === 'GET') return json(res, 200, await watchList(req));
      if (!isAdmin(req)) throw new HttpError(403, 'Sign in with the admin password to change which channels are logged here.');
      if (req.method === 'POST') {
        const login = cleanLogin(q.get('channel'));
        if (!login) throw new HttpError(400, 'That isn’t a Twitch channel name.');
        if (!watched.some((w) => w.login === login)) {
          if (watched.length >= MAX_WATCHED) throw new HttpError(400, `Up to ${MAX_WATCHED} channels can be logged here.`);
          const c = (await users([login])).get(login);
          if (!c) throw new HttpError(404, `There’s no Twitch channel called ${login}.`);
          watched.push({ login, id: c.id, name: c.name, since: Date.now() });
          await saveWatched();
          for (const k of lookupCache.keys()) if (k.startsWith(`${login}|`)) lookupCache.delete(k);
        }
        return json(res, 200, await watchList(req));
      }
      if (req.method === 'DELETE') {
        const login = cleanLogin(path.slice('/api/chatlogs/watch/'.length));
        const keep = q.get('keep') !== '0';
        watched = watched.filter((w) => w.login !== login);
        await saveWatched();
        if (login && !keep) await rm(join(directory, login), { recursive: true, force: true });
        for (const k of lookupCache.keys()) if (k.startsWith(`${login}|`)) lookupCache.delete(k);
        return json(res, 200, await watchList(req));
      }
      throw new HttpError(405, 'Method not allowed');
    }

    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
    if (path === '/api/chatlogs/emotes') {
      const id = q.get('channel') ?? '';
      if (!/^\d{1,12}$/.test(id)) throw new HttpError(400, 'Pick a channel by its Twitch id.');
      return json(res, 200, { emotes: await emotes.forChannel(id) }, { 'Cache-Control': 'public, max-age=3600' });
    }
    const channel = cleanLogin(q.get('channel'));
    const user = cleanLogin(q.get('user'));
    if (!channel) throw new HttpError(400, 'Type a Twitch channel.');
    if (!user) throw new HttpError(400, 'Type a Twitch user.');
    if (q.get('fresh') === '1') lookupCache.delete(`${channel}|${user}`);
    const look = await lookup(channel, user);

    if (path === '/api/chatlogs/lookup') return json(res, 200, look, REVALIDATE);
    if (path === '/api/chatlogs/month') {
      const ym = q.get('month') || look.months.at(-1) || monthOf(Date.now());
      if (!MONTH.test(ym)) throw new HttpError(400, 'Pick a month as YYYY-MM.');
      const { list, sources } = await month(look, ym);
      return json(res, 200, { month: ym, total: list.length, messages: list.length > MONTH_CAP ? list.slice(-MONTH_CAP) : list, sources }, REVALIDATE);
    }
    if (path === '/api/chatlogs/days') {
      const ym = q.get('month') ?? '';
      if (!MONTH.test(ym)) throw new HttpError(400, 'Pick a month as YYYY-MM.');
      return json(res, 200, await monthDays(look, ym, String(q.get('tz') || 'UTC').slice(0, 64)), REVALIDATE);
    }
    if (path === '/api/chatlogs/activity') {
      const year = Number(q.get('year')) || new Date().getUTCFullYear();
      return json(res, 200, await activity(look, year, String(q.get('tz') || 'UTC').slice(0, 64)), REVALIDATE);
    }
    if (path === '/api/chatlogs/search') {
      const year = Number(q.get('year')) || new Date().getUTCFullYear();
      const text = String(q.get('q') ?? '').trim().slice(0, 100);
      if (!text) throw new HttpError(400, 'Type something to search for.');
      return json(res, 200, await search(look, year, text), REVALIDATE);
    }
    throw new HttpError(404, 'Not found');
  }

  return {
    api,
    async start() {
      await loadWatched();
      recorder?.set(watched.map((w) => w.login));
      prune().catch(() => {});
      emotes.warm().catch(() => {});
    },
  };
}
