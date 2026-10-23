// Streamer stats: what a Twitch channel streams, when, for how long and to how many. Three sources:
//  • Twitch's public GraphQL API, with the twitch.tv web player's public client id (no key needed): the channel,
//    its past broadcasts (Twitch keeps them 7–60 days; the newest 100 can be read without signing in) and their
//    chapters, which say when the game changed.
//  • A recorder that checks the miner's channels, and any looked up on the page in the last 30 days, every few
//    minutes: viewers and follower counts, and streams that outlive their VODs, kept in `directory` as one JSON
//    file per channel. Chapters are kept there too, so the history grows past Twitch's 60 days.
//  • TwitchTracker's public summary of the last 30 days (average and peak viewers, hours watched), when it answers.
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError } from './http-error.js';
import { json } from './http-response.js';

const GQL = 'https://gql.twitch.tv/gql';
const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const UA = 'Mozilla/5.0 (compatible; MyMind/1.0)';
const MIN = 60_000;
const DAY = 86_400_000;
const POLL_MS = 5 * MIN;
const KEEP = 400 * DAY;        // how long recorded streams, chapters and follower counts are kept
const LOOKED = 30 * DAY;       // a channel looked up on the page is recorded for this long after
const MAX_TRACKED = 60;        // channels the recorder checks at most, the miner's first
const MAX_FILES = 100;         // channels kept on disk besides the miner's; the least recently looked up go first
const REPORT_MS = 3 * MIN;     // a channel's report is worked out again after this
const TRACKER_MS = 60 * MIN;
const LOOKUPS_PER_MIN = 30;    // fresh reports (each a few calls to Twitch) the whole server makes in a minute
const SAME_STREAM = 20 * MIN;  // a VOD and a recorded stream that start this close are the same broadcast
const CURVE = 48;              // points in a stream's viewer line

/** Twitch logins are 4–25 letters, digits and underscores; a few old ones are shorter. */
const LOGIN = /^[a-z0-9_]{2,25}$/;
const dayOf = (ms) => Math.floor(ms / DAY) * DAY;

const BOX = 'boxArtURL(width: 52, height: 72)';
const GAME = `game { id displayName ${BOX} }`;
const CHANNEL = `query($login: String!) { user(login: $login) {
  id login displayName description createdAt profileImageURL(width: 150)
  followers { totalCount } roles { isPartner isAffiliate } broadcastSettings { language }
  stream { id type createdAt title viewersCount ${GAME} }
  videos(first: 100, type: ARCHIVE, sort: TIME) { edges { node { id status title createdAt lengthSeconds ${GAME} } } }
} }`;
const USERS = `query($logins: [String!]) { users(logins: $logins) {
  id login displayName followers { totalCount } stream { id type createdAt title viewersCount ${GAME} }
} }`;
const chaptersQuery = (ids) => `query { ${ids.map((id, i) => `v${i}: video(id: ${JSON.stringify(id)}) { id moments(momentRequestType: VIDEO_CHAPTER_MARKERS, types: [GAME_CHANGE], first: 50) { edges { node { positionMilliseconds durationMilliseconds details { ... on GameChangeMomentDetails { ${GAME} } } } } } }`).join(' ')} }`;

/* ---------- what's kept per channel ---------- */

const blank = (login) => ({ v: 1, login, id: null, name: login, seen: 0, since: 0, followers: [], streams: [], games: {}, vods: {} });

/** Remember a game's name and cover; returns its id ('' when there's no category). */
function gameOf(store, g) {
  if (!g?.id) return '';
  store.games[g.id] = [String(g.displayName ?? g.id), typeof g.boxArtURL === 'string' ? g.boxArtURL : null];
  return g.id;
}

/**
 * One look at a channel, from the recorder or a page load: its follower count for the day and, while it's live,
 * a viewer sample for the stream. Returns whether anything worth writing down changed.
 */
export function record(store, u, t) {
  let changed = false;
  if (u.id && store.id !== u.id) (store.id = u.id), (changed = true);
  if (u.displayName) store.name = u.displayName;
  if (!store.since) (store.since = t), (changed = true);
  const n = u.followers?.totalCount;
  if (Number.isFinite(n)) {
    const last = store.followers.at(-1);
    if (last && last[0] === dayOf(t)) last[1] = n;
    else store.followers.push([dayOf(t), n]), (changed = true);
  }
  const s = u.stream;
  if (s?.id && s.type !== 'rerun') {
    const gid = gameOf(store, s.game);
    let r = store.streams.find((x) => x.id === s.id);
    if (!r) store.streams.push((r = { id: s.id, start: Date.parse(s.createdAt) || t, end: t, title: '', s: [] }));
    // one sample a poll: a page load just after a poll doesn't add another
    const last = r.s.at(-1);
    if (!last || t - last[0] >= MIN) r.s.push([t, Math.max(0, s.viewersCount | 0), gid]), (changed = true);
    r.end = Math.max(r.end, t);
    r.title = String(s.title ?? r.title);
  }
  const old = t - KEEP;
  if (store.streams.length && store.streams[0].end < old) store.streams = store.streams.filter((r) => r.end >= old);
  if (store.followers.length && store.followers[0][0] < old) store.followers = store.followers.filter((f) => f[0] >= old);
  return changed;
}

/** The past broadcasts Twitch lists, kept with what's known of their chapters. */
function keepVods(store, videos, t) {
  for (const { node: v } of videos) {
    if (!v?.id) continue;
    const start = Date.parse(v.createdAt);
    if (!Number.isFinite(start)) continue;
    const had = store.vods[v.id];
    store.vods[v.id] = {
      start,
      ms: Math.max(0, (v.lengthSeconds | 0) * 1000),
      title: String(v.title ?? ''),
      game: gameOf(store, v.game),
      live: v.status === 'RECORDING' || undefined,
      // a finished broadcast's chapters don't change; a live one's grow
      ch: had?.ch && v.status !== 'RECORDING' ? had.ch : undefined,
    };
  }
  const old = t - KEEP;
  for (const [id, v] of Object.entries(store.vods)) if (v.start < old) delete store.vods[id];
}

/** Chapters as [game id, start, length] in ms from the broadcast's start, laid end to end over its length. */
function segmentsOfVod(v) {
  if (!v.ch?.length) return v.ms ? [[v.game, 0, v.ms]] : [];
  const ch = [...v.ch].sort((a, b) => a[0] - b[0]);
  return ch.map(([at, , gid], i) => {
    const end = i + 1 < ch.length ? ch[i + 1][0] : Math.max(v.ms, at);
    return [gid, at, Math.max(0, end - at)];
  }).filter((s) => s[2] > 0);
}

/** Where the game changed, from the samples: each sample's game holds until the next one says otherwise. */
function segmentsOfSamples(r) {
  const out = [];
  for (const [t, , gid] of r.s) {
    const at = Math.max(0, t - r.start);
    const last = out.at(-1);
    if (last && last[0] === gid) continue;
    if (last) last[2] = at - last[1];
    out.push([gid, out.length ? at : 0, 0]);
  }
  const last = out.at(-1);
  if (last) last[2] = Math.max(0, r.end - r.start - last[1]);
  return out.filter((s, i) => s[2] > 0 || i === out.length - 1);
}

function viewersOf(r) {
  const v = r.s.map((x) => x[1]);
  if (!v.length) return {};
  const step = Math.max(1, Math.ceil(r.s.length / CURVE));
  const curve = [];
  for (let i = 0; i < r.s.length; i += step) {
    const part = r.s.slice(i, i + step);
    curve.push([Math.round((part[0][0] - r.start) / MIN), Math.round(part.reduce((s, x) => s + x[1], 0) / part.length)]);
  }
  return { avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), peak: Math.max(...v), curve };
}

/**
 * Every broadcast known for a channel, newest first: Twitch's VODs (with their chapters) and the streams the
 * recorder saw, matched up when they're the same broadcast, so each one has its games and, when recorded, its viewers.
 */
export function streamsOf(store, liveId = null) {
  const vods = Object.entries(store.vods).map(([id, v]) => ({
    start: v.start, end: v.start + v.ms, title: v.title, vod: id, segs: segmentsOfVod(v), ...(v.live ? { live: true } : {}),
  }));
  const out = [...vods];
  for (const r of store.streams) {
    const seen = viewersOf(r);
    const twin = vods.find((v) => Math.abs(v.start - r.start) < SAME_STREAM);
    if (twin) {
      Object.assign(twin, seen);
      if (r.id === liveId) twin.live = true;
      // a live broadcast's VOD can trail the recorder by a few minutes
      if (twin.live) twin.end = Math.max(twin.end, r.end);
      continue;
    }
    out.push({ start: r.start, end: Math.max(r.end, r.start), title: r.title, segs: segmentsOfSamples(r), ...seen, ...(r.id === liveId ? { live: true } : {}) });
  }
  // a VOD still marked as recording after its stream ended is just finished
  for (const s of out) if (s.live && liveId === null) delete s.live;
  return out.sort((a, b) => b.start - a.start);
}

/* ---------- the handler ---------- */

/**
 * `directory`: where each channel's recordings are kept (created when needed). `channelsFile`: the miner's
 * settings/channels.json, the channels recorded for good. `fetch` and `now` can be swapped in tests.
 */
export function createStreamerHandler({ directory, channelsFile, fetch: get = globalThis.fetch, now = Date.now }) {
  const stores = new Map();   // login → Promise<store>
  const writing = new Map();  // login → the write in progress, so writes to one file never overlap
  const seenAt = new Map();   // login → when it was last looked up, for every channel kept on disk
  const live = new Map();     // login → what the recorder last saw it streaming
  const reports = new Map();  // login → { at, promise }
  const tracker = new Map();  // login → { at, value }
  let lookups = [];           // when fresh reports were started, for the rate limit
  let timer = null;

  async function gql(body, tries = 3) {
    for (let i = 0; ; i++) {
      try {
        const r = await get(GQL, {
          method: 'POST',
          headers: { 'Client-Id': CLIENT_ID, 'Content-Type': 'application/json', 'User-Agent': UA },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(12_000),
        });
        if (r.status >= 500 && i + 1 < tries) throw new Error(`Twitch answered ${r.status}`);
        if (!r.ok) throw new HttpError(502, 'Twitch didn’t answer. Try again in a minute.');
        return await r.json();
      } catch (e) {
        if (i + 1 >= tries) throw e instanceof HttpError ? e : new HttpError(502, 'Couldn’t reach Twitch. Try again in a minute.');
        await new Promise((ok) => setTimeout(ok, 400 * (i + 1)));
      }
    }
  }

  async function mining() {
    if (!channelsFile) return [];
    try {
      const data = JSON.parse(await readFile(channelsFile, 'utf8'));
      return Array.isArray(data?.channels) ? data.channels.map((n) => String(n).trim().toLowerCase()).filter((n) => LOGIN.test(n)) : [];
    } catch {
      return [];
    }
  }

  const fileOf = (login) => join(directory, `${login}.json`);

  function load(login) {
    let p = stores.get(login);
    if (!p) {
      p = (async () => {
        if (!directory) return blank(login);
        try {
          const s = JSON.parse(await readFile(fileOf(login), 'utf8'));
          return s?.v === 1 && s.login === login ? s : blank(login);
        } catch {
          return blank(login);
        }
      })();
      stores.set(login, p);
    }
    return p;
  }

  function save(login, store) {
    if (!directory) return Promise.resolve();
    const run = async () => {
      await mkdir(directory, { recursive: true });
      // write next to it and swap it in, so a crash never leaves half a file
      const tmp = join(directory, `.${login}-${randomBytes(6).toString('hex')}.tmp`);
      try {
        await writeFile(tmp, JSON.stringify(store), 'utf8');
        await rename(tmp, fileOf(login));
      } catch (e) {
        await unlink(tmp).catch(() => {});
        throw e;
      }
    };
    const p = (writing.get(login) ?? Promise.resolve()).then(run, run);
    writing.set(login, p);
    p.catch((e) => console.error(`streamers: couldn’t save ${login}:`, e.message)).finally(() => writing.get(login) === p && writing.delete(login));
    return p;
  }

  /** Read what's on disk once, so the recorder knows which looked-up channels to keep checking. */
  const ready = (async () => {
    if (!directory) return;
    let files = [];
    try {
      files = (await readdir(directory)).filter((f) => f.endsWith('.json'));
    } catch {
      return;
    }
    for (const f of files) {
      const login = f.slice(0, -5);
      if (!LOGIN.test(login)) continue;
      const s = await load(login);
      seenAt.set(login, s.seen || 0);
    }
  })();

  /** Keep the files on disk in check: past MAX_FILES, the channels looked up longest ago (never the miner's) go. */
  async function trim() {
    const mined = new Set(await mining());
    const others = [...seenAt].filter(([l]) => !mined.has(l)).sort((a, b) => a[1] - b[1]);
    for (const [login] of others.slice(0, Math.max(0, others.length - MAX_FILES))) {
      seenAt.delete(login);
      stores.delete(login);
      live.delete(login);
      await unlink(fileOf(login)).catch(() => {});
    }
  }

  /** The channels the recorder checks: the miner's, then the ones looked up lately, newest first. */
  async function tracked() {
    await ready;
    const t = now();
    const list = [...new Set(await mining())];
    const recent = [...seenAt].filter(([l, at]) => t - at < LOOKED && !list.includes(l)).sort((a, b) => b[1] - a[1]).map(([l]) => l);
    return [...list, ...recent].slice(0, MAX_TRACKED);
  }

  const liveOf = (u) => (u.stream?.id && u.stream.type !== 'rerun' ? { game: u.stream.game?.displayName ?? null, viewers: u.stream.viewersCount | 0 } : null);

  /** One round of the recorder: every tracked channel in a request or two, samples written for the live ones. */
  async function poll() {
    const logins = await tracked();
    const t = now();
    for (let i = 0; i < logins.length; i += 50) {
      const chunk = logins.slice(i, i + 50);
      let users;
      try {
        users = (await gql({ query: USERS, variables: { logins: chunk } }, 2))?.data?.users;
      } catch {
        continue; // Twitch is down or slow: try again next round
      }
      if (!Array.isArray(users)) continue;
      for (const u of users) {
        const login = String(u?.login ?? '').toLowerCase();
        if (!LOGIN.test(login)) continue;
        live.set(login, liveOf(u));
        const store = await load(login);
        if (record(store, u, t)) {
          if (!seenAt.has(login)) seenAt.set(login, store.seen || 0);
          await save(login, store);
        }
      }
    }
  }

  function start() {
    if (timer || !directory) return;
    const run = () => poll().catch((e) => console.error('streamers: recording failed:', e.message));
    setTimeout(run, 20_000).unref?.();
    timer = setInterval(run, POLL_MS);
    timer.unref?.();
  }
  const stop = () => {
    clearInterval(timer);
    timer = null;
  };

  /** TwitchTracker's last 30 days for a channel, or null when it doesn't know it or doesn't answer. */
  async function summary(login) {
    const hit = tracker.get(login);
    if (hit && now() - hit.at < TRACKER_MS) return hit.value;
    let value = null;
    try {
      const r = await get(`https://twitchtracker.com/api/channels/summary/${login}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(6_000),
      });
      const j = r.ok ? await r.json() : null;
      if (Number.isFinite(j?.avg_viewers)) {
        const n = (k) => (Number.isFinite(j[k]) ? j[k] : null);
        value = { avg: n('avg_viewers'), peak: n('max_viewers'), hoursWatched: n('hours_watched'), minutes: n('minutes_streamed'), followers: n('followers'), rank: n('rank') };
      }
    } catch {}
    tracker.set(login, { at: now(), value });
    if (tracker.size > 500) tracker.delete(tracker.keys().next().value);
    return value;
  }

  /** The channel and its newest VODs; the VOD list sometimes fails on Twitch's side, so it's asked for again. */
  async function channel(login) {
    let user = null;
    for (let i = 0; i < 3; i++) {
      const j = await gql({ query: CHANNEL, variables: { login } });
      user = j?.data?.user ?? null;
      if (!user) {
        if (j?.data && 'user' in j.data) throw new HttpError(404, `There’s no Twitch channel called ${login}.`);
        throw new HttpError(502, 'Twitch didn’t answer. Try again in a minute.');
      }
      if (Array.isArray(user.videos?.edges)) break;
      await new Promise((ok) => setTimeout(ok, 300 * (i + 1)));
    }
    return user;
  }

  /** Fill in the chapters of the VODs that don't have them yet, ten at a time; ones that fail are asked for once more. */
  async function chapters(store) {
    let todo = Object.entries(store.vods).filter(([, v]) => !v.ch).map(([id]) => id);
    for (let round = 0; round < 2 && todo.length; round++) {
      const failed = [];
      const batches = [];
      for (let i = 0; i < todo.length; i += 10) batches.push(todo.slice(i, i + 10));
      const run = async (ids) => {
        let data = null;
        try {
          data = (await gql({ query: chaptersQuery(ids) }, 1))?.data;
        } catch {}
        ids.forEach((id, i) => {
          const edges = data?.[`v${i}`]?.moments?.edges;
          if (!Array.isArray(edges)) return failed.push(id);
          store.vods[id].ch = edges
            .map(({ node: m }) => [m?.positionMilliseconds | 0, m?.durationMilliseconds | 0, gameOf(store, m?.details?.game)])
            .filter((c) => c[2]);
        });
      };
      // two batches at a time: quick, without a burst Twitch would turn away
      for (let i = 0; i < batches.length; i += 2) await Promise.all(batches.slice(i, i + 2).map(run));
      todo = failed;
    }
  }

  async function build(login) {
    const t = now();
    const [user, tt, mined] = await Promise.all([channel(login), summary(login), mining()]);
    await ready;
    const store = await load(login);
    store.seen = t;
    seenAt.set(login, t);
    record(store, user, t);
    live.set(login, liveOf(user));
    const vodsOk = Array.isArray(user.videos?.edges);
    if (vodsOk) keepVods(store, user.videos.edges, t);
    await chapters(store);
    await save(login, store);
    await trim();

    const liveId = user.stream?.id && user.stream.type !== 'rerun' ? user.stream.id : null;
    const games = {};
    const streams = streamsOf(store, liveId);
    for (const s of streams) for (const [gid] of s.segs) if (gid && store.games[gid]) games[gid] = store.games[gid];
    const s = user.stream;
    return {
      login,
      name: user.displayName || login,
      avatar: user.profileImageURL || null,
      bio: String(user.description ?? '').trim(),
      createdAt: Date.parse(user.createdAt) || null,
      followers: user.followers?.totalCount ?? null,
      partner: !!user.roles?.isPartner,
      affiliate: !!user.roles?.isAffiliate,
      language: user.broadcastSettings?.language || null,
      live: liveId ? { title: String(s.title ?? ''), game: s.game?.displayName ?? null, box: s.game?.boxArtURL ?? null, viewers: s.viewersCount | 0, since: Date.parse(s.createdAt) || t } : null,
      mining: mined.includes(login),
      now: t,
      recordingSince: store.since || null,
      vodsMissing: !vodsOk,
      streams,
      games,
      followerDays: store.followers,
      summary: tt,
    };
  }

  function report(login) {
    const hit = reports.get(login);
    if (hit && now() - hit.at < REPORT_MS) return hit.promise;
    const t = now();
    lookups = lookups.filter((at) => t - at < MIN);
    if (lookups.length >= LOOKUPS_PER_MIN) throw new HttpError(429, 'Too many channels looked up at once. Try again in a minute.');
    lookups.push(t);
    const promise = build(login);
    reports.set(login, { at: t, promise });
    promise.catch(() => reports.get(login)?.promise === promise && reports.delete(login));
    if (reports.size > 200) reports.delete(reports.keys().next().value);
    return promise;
  }

  /** The channels to offer on the page: the miner's, then the ones looked up lately, with who's live. */
  async function list() {
    const mined = await mining();
    const logins = await tracked();
    const channels = [];
    for (const login of logins) {
      const s = stores.has(login) ? await load(login) : null;
      channels.push({ login, name: s?.name || login, live: live.get(login) ?? null, mining: mined.includes(login) });
    }
    return { channels };
  }

  async function api(req, res, path) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    if (path === '/api/streamers') return json(res, 200, await list());
    let raw;
    try {
      raw = decodeURIComponent(path.slice('/api/streamers/'.length)).trim().toLowerCase();
    } catch {
      throw new HttpError(400, 'That isn’t a Twitch channel name.');
    }
    const login = raw.replace(/^@/, '').replace(/^https?:\/\/(www\.)?twitch\.tv\//, '').replace(/\/.*$/, '');
    if (!LOGIN.test(login)) throw new HttpError(400, 'That isn’t a Twitch channel name.');
    return json(res, 200, await report(login));
  }

  return { api, poll, start, stop };
}
