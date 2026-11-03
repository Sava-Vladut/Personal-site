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
import { appendFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import tls from 'node:tls';
import { HttpError } from './http-error.js';
import { json } from './http-response.js';

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
 * A chat line as what's kept: { t: ms, i: user id, u: login, n: display name, c: colour, m: text, k: kind }.
 * Kinds: 'msg' (what they wrote), 'ban' (a timeout or ban, aimed at them), 'sub' (a sub, gift or raid notice).
 */
export function slimIrc(p) {
  const t = Number(p.tags['tmi-sent-ts']) || Date.now();
  if (p.command === 'PRIVMSG') {
    const login = p.prefix.split('!')[0];
    let m = p.trailing;
    const action = /^\u0001ACTION (.*)\u0001$/.exec(m);
    if (action) m = action[1];
    return { t, i: p.tags['user-id'] || '', u: login, n: p.tags['display-name'] || login, c: p.tags.color || '', m, k: action ? 'me' : 'msg' };
  }
  if (p.command === 'CLEARCHAT' && p.trailing) {
    const secs = Number(p.tags['ban-duration']);
    return { t, i: p.tags['target-user-id'] || '', u: p.trailing, n: p.trailing, c: '', m: secs ? `timed out for ${secs}s` : 'banned', k: 'ban' };
  }
  if (p.command === 'USERNOTICE') {
    const login = p.tags.login || '';
    const sys = p.tags['system-msg'] || '';
    return { t, i: p.tags['user-id'] || '', u: login, n: p.tags['display-name'] || login, c: p.tags.color || '', m: p.trailing ? `${sys} · ${p.trailing}` : sys, k: 'sub' };
  }
  return null;
}

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
    return { t, i: tags['user-id'] || '', u: x.username || '', n: x.displayName || x.username || '', c: tags.color || '', m: x.text && x.text !== sys ? (sys ? `${sys} · ${x.text}` : x.text) : sys, k: 'sub' };
  }
  if (x.type !== 1) return null; // joins, room states, whispers…
  let m = String(x.text ?? '');
  const action = /^\u0001ACTION (.*)\u0001$/.exec(m);
  if (action) m = action[1];
  return { t, i: tags['user-id'] || '', u: x.username || '', n: x.displayName || x.username || '', c: tags.color || '', m, k: action ? 'me' : 'msg' };
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
      // the finder knows archives this list doesn't
      const extra = await getJson(`${finder}/${c.id ? 'id:' + c.id : channel}/${u.id ? 'id:' + u.id : user}`, 8_000)
        .then(({ body }) => (body?.userLogs?.instances ?? []).map((s) => String(s).replace(/^https?:\/\//, '').replace(/\/.*$/, '')))
        .catch(() => []);
      const hosts = [...new Set([...archives, ...extra.filter((h) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(h))])];
      const found = await Promise.all(hosts.map((h) => archiveMonths(h, c.id, u.id)));
      const sources = found.filter((s) => s.months.length).map((s) => ({ host: s.host, months: s.months.sort() }));
      const optedOut = found.some((s) => s.optedOut);
      const days = await recordedDays(channel);
      const w = watched.find((x) => x.login === channel);
      const all = new Set(sources.flatMap((s) => s.months));
      for (const d of days) all.add(d.slice(0, 7));
      // the last day is read on every month request for this month, so it counts as a source when it has lines
      const late = await lately(channel, u.id);
      if (late.length) all.add(monthOf(Date.now()));
      const body = {
        channel: c,
        user: u,
        sources,
        optedOut: optedOut && !sources.length,
        recorded: w ? { since: w.since } : null,
        recordedDays: days.length,
        lately: late.length,
        months: [...all].sort(),
        at: Date.now(),
      };
      lookupCache.set(key, { at: Date.now(), body });
      if (lookupCache.size > 200) lookupCache.delete(lookupCache.keys().next().value);
      return body;
    });
  }

  /* one month of one user's lines, from every source that has it */

  async function month(look, ym) {
    const { channel: c, user: u } = look;
    const key = `${c.id}|${u.id}|${ym}`;
    const now = monthOf(Date.now());
    const hit = months.get(key);
    if (hit && Date.now() - hit.at < (ym === now ? NOW_FRESH : PAST_FRESH)) {
      months.delete(key); // most recently used goes last
      months.set(key, hit);
      return hit;
    }
    return once(`month:${key}`, async () => {
      const [y, m] = ym.split('-');
      const from = look.sources.filter((s) => s.months.includes(ym));
      const got = await Promise.all(from.map(async (s) => {
        try {
          const { body } = await getJson(`https://${s.host}/channelid/${c.id}/userid/${u.id}/${y}/${Number(m)}?json=1`, 30_000);
          return { host: s.host, list: (Array.isArray(body?.messages) ? body.messages : []).map(slimArchive).filter(Boolean) };
        } catch {
          return { host: s.host, list: [] };
        }
      }));
      const mine = await recorded(c.login, u.id, u.login, ym);
      const late = ym === now ? await lately(c.login, u.id) : [];
      const lists = [...got.map((g) => g.list), mine, late];
      const list = merge(lists).filter((x) => monthOf(x.t) === ym);
      const sources = [...got.filter((g) => g.list.length).map((g) => g.host), ...(mine.length ? ['here'] : []), ...(late.length ? ['lately'] : [])];
      const entry = { at: Date.now(), list, sources };
      if (hit) { months.delete(key); cachedMessages -= hit.list.length; }
      months.set(key, entry);
      cachedMessages += list.length;
      while (cachedMessages > CACHE_MESSAGES && months.size > 1) {
        const [k, old] = months.entries().next().value;
        months.delete(k);
        cachedMessages -= old.list.length;
      }
      return entry;
    });
  }

  /** A year in days (in the viewer's time zone): how many lines each day holds. Months are read three at a time. */
  async function activity(look, year, tz) {
    const keyOf = dayKeyer(tz);
    const want = look.months.filter((m) => m.startsWith(`${year}-`));
    const days = {};
    let total = 0;
    for (let i = 0; i < want.length; i += 3) {
      const got = await Promise.all(want.slice(i, i + 3).map((m) => month(look, m)));
      for (const g of got) {
        for (const x of g.list) {
          const d = keyOf(x.t);
          if (!d.startsWith(`${year}-`)) continue; // the first or last hours of the year, across the time zone
          days[d] = (days[d] ?? 0) + 1;
          total++;
        }
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
    const channel = cleanLogin(q.get('channel'));
    const user = cleanLogin(q.get('user'));
    if (!channel) throw new HttpError(400, 'Type a Twitch channel.');
    if (!user) throw new HttpError(400, 'Type a Twitch user.');
    if (q.get('fresh') === '1') lookupCache.delete(`${channel}|${user}`);
    const look = await lookup(channel, user);

    if (path === '/api/chatlogs/lookup') return json(res, 200, look);
    if (path === '/api/chatlogs/month') {
      const ym = q.get('month') || look.months.at(-1) || monthOf(Date.now());
      if (!MONTH.test(ym)) throw new HttpError(400, 'Pick a month as YYYY-MM.');
      const { list, sources } = await month(look, ym);
      return json(res, 200, { month: ym, total: list.length, messages: list.length > MONTH_CAP ? list.slice(-MONTH_CAP) : list, sources });
    }
    if (path === '/api/chatlogs/activity') {
      const year = Number(q.get('year')) || new Date().getUTCFullYear();
      return json(res, 200, await activity(look, year, String(q.get('tz') || 'UTC').slice(0, 64)));
    }
    if (path === '/api/chatlogs/search') {
      const year = Number(q.get('year')) || new Date().getUTCFullYear();
      const text = String(q.get('q') ?? '').trim().slice(0, 100);
      if (!text) throw new HttpError(400, 'Type something to search for.');
      return json(res, 200, await search(look, year, text));
    }
    throw new HttpError(404, 'Not found');
  }

  return {
    api,
    async start() {
      await loadWatched();
      recorder?.set(watched.map((w) => w.login));
    },
  };
}
