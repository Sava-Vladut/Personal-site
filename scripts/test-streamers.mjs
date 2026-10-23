// Streamer stats: the server's report and recorder against a fake Twitch, and what the page works out from a report.
process.env.TZ = 'UTC';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { rolldown } from 'rolldown';
import { createStreamerHandler, streamsOf } from '../server/streamers.js';

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const now = Date.UTC(2026, 9, 22, 20, 0);
const iso = (ms) => new Date(ms).toISOString();
const root = await mkdtemp(join(tmpdir(), 'mm-streamers-'));
after(() => rm(root, { recursive: true, force: true }));
const channelsFile = join(root, 'channels.json');
await writeFile(channelsFile, JSON.stringify({ channels: ['Alpha'] }));

const game = (id, name) => ({ id, displayName: name, boxArtURL: `https://example.test/${id}.jpg` });
const CHAT = game('1', 'Just Chatting'), RPG = game('2', 'Some RPG'), GTA = game('3', 'GTA V');
// alpha streamed yesterday (chatting, then the RPG) and is live now on GTA, which it's been for an hour
const yesterday = now - DAY - 6 * HOUR;
const liveSince = now - HOUR;
const twitch = {
  user: {
    id: '42', login: 'alpha', displayName: 'Alpha', description: ' Hi ', createdAt: '2015-01-01T00:00:00Z', profileImageURL: 'https://example.test/a.png',
    followers: { totalCount: 1234 }, roles: { isPartner: true, isAffiliate: false }, broadcastSettings: { language: 'EN' },
    stream: { id: 's2', type: 'live', createdAt: iso(liveSince), title: 'Live!', viewersCount: 500, game: GTA },
    videos: { edges: [
      { node: { id: 'v2', status: 'RECORDING', title: 'Live!', createdAt: iso(liveSince + 5_000), lengthSeconds: 3500, game: GTA } },
      { node: { id: 'v1', status: 'RECORDED', title: 'Yesterday', createdAt: iso(yesterday), lengthSeconds: 4 * 3600, game: RPG } },
    ] },
  },
  moments: {
    v1: [[0, HOUR, CHAT], [HOUR, 3 * HOUR, RPG]],
    v2: [],
  },
  failVideos: 0,
  failMoments: 0,
  calls: [],
};
const fake = async (url, init) => {
  const ok = (body) => ({ ok: true, status: 200, json: async () => body });
  if (url.startsWith('https://twitchtracker.com/')) {
    twitch.calls.push('tracker');
    return ok(url.endsWith('/alpha') ? { rank: 9, minutes_streamed: 600, avg_viewers: 450, max_viewers: 900, hours_watched: 4500, followers: 20, followers_total: 1234 } : {});
  }
  const { query, variables } = JSON.parse(init.body);
  if (query.includes('users(logins')) {
    twitch.calls.push('users');
    return ok({ data: { users: variables.logins.map((l) => (l === 'alpha' ? { ...twitch.user, followers: { totalCount: 1240 }, stream: { ...twitch.user.stream, viewersCount: 700 } } : null)) } });
  }
  if (query.includes('user(login')) {
    twitch.calls.push('channel');
    if (variables.login !== 'alpha') return ok({ data: { user: null } });
    if (twitch.failVideos-- > 0) return ok({ errors: [{ message: 'service error', path: ['user', 'videos'] }], data: { user: { ...twitch.user, videos: null } } });
    return ok({ data: { user: twitch.user } });
  }
  if (query.includes('moments')) {
    twitch.calls.push('moments');
    if (twitch.failMoments-- > 0) return ok({ errors: [{ message: 'service error' }], data: null });
    const ids = [...query.matchAll(/video\(id: "([^"]+)"\)/g)].map((m) => m[1]);
    const data = {};
    ids.forEach((id, i) => {
      data[`v${i}`] = { id, moments: { edges: (twitch.moments[id] ?? []).map(([at, ms, g]) => ({ node: { positionMilliseconds: at, durationMilliseconds: ms, details: { game: g } } })) } };
    });
    return ok({ data });
  }
  throw new Error('unexpected request');
};

let clock = now;
const make = (dir = join(root, 'data')) => createStreamerHandler({ directory: dir, channelsFile, fetch: fake, now: () => clock });
const call = async (h, path, method = 'GET') => {
  let out = {};
  try {
    await h.api({ method }, { writeHead: (status) => (out.status = status), end: (b) => (out.body = JSON.parse(b)) }, path);
  } catch (e) {
    out = { status: e.status ?? 500, body: { error: e.message } };
  }
  return out;
};

test('a report has the channel, its streams with their games, and TwitchTracker’s month', async () => {
  const h = make();
  const { status, body } = await call(h, '/api/streamers/Alpha');
  assert.equal(status, 200);
  assert.equal(body.name, 'Alpha');
  assert.equal(body.bio, 'Hi');
  assert.equal(body.partner, true);
  assert.equal(body.mining, true);
  assert.deepEqual(body.live, { title: 'Live!', game: 'GTA V', box: GTA.boxArtURL, viewers: 500, since: liveSince });
  assert.equal(body.streams.length, 2);
  const [live, past] = body.streams;
  assert.equal(live.live, true);
  assert.equal(live.vod, 'v2');
  assert.deepEqual(live.segs, [['3', 0, 3_500_000]], 'no chapters: the whole VOD is its game');
  assert.equal(live.avg, 500, 'the page load counts as a sample');
  assert.equal(live.end, now, 'a live stream runs to now');
  assert.deepEqual(past.segs, [['1', 0, HOUR], ['2', HOUR, 3 * HOUR]]);
  assert.equal(past.avg, undefined);
  assert.deepEqual(body.games['2'], ['Some RPG', RPG.boxArtURL]);
  assert.equal(body.summary.avg, 450);
  assert.equal(body.summary.rank, 9);
  assert.deepEqual(body.followerDays, [[Date.UTC(2026, 9, 22), 1234]]);
});

test('the recorder samples the tracked channels, keeps them on disk and matches them to the VODs', async () => {
  clock = now + 5 * MIN;
  const h = make();
  await h.poll();
  const saved = JSON.parse(await readFile(join(root, 'data', 'alpha.json'), 'utf8'));
  assert.equal(saved.streams.length, 1);
  assert.deepEqual(saved.streams[0].s.map((x) => x[1]), [500, 700]);
  assert.equal(saved.followers.at(-1)[1], 1240);
  assert.ok(saved.vods.v1.ch.length === 2, 'chapters are kept, so they outlive the VOD');

  // the same broadcast seen both ways is one stream, with the VOD's games and the recorded viewers
  const merged = streamsOf(saved, 's2');
  assert.equal(merged.length, 2);
  assert.equal(merged[0].avg, 600);
  assert.equal(merged[0].peak, 700);
  assert.equal(merged[0].end, now + 5 * MIN);

  // once its VOD is gone, a recorded stream still has its game from the samples
  delete saved.vods.v2;
  const alone = streamsOf(saved, null);
  assert.deepEqual(alone[0].segs, [['3', 0, HOUR + 5 * MIN]]);
  assert.equal(alone[0].live, undefined);

  const list = await call(h, '/api/streamers');
  assert.deepEqual(list.body.channels, [{ login: 'alpha', name: 'Alpha', live: { game: 'GTA V', viewers: 700 }, mining: true }]);
});

test('Twitch’s hiccups are asked again, and chapters that won’t come fall back to the VOD’s game', async () => {
  clock = now + 30 * MIN;
  twitch.failVideos = 1;
  twitch.failMoments = 2;
  const h = make(join(root, 'other'));
  const { status, body } = await call(h, '/api/streamers/alpha');
  assert.equal(status, 200);
  assert.equal(body.vodsMissing, false);
  assert.deepEqual(body.streams[1].segs, [['2', 0, 4 * HOUR]]);
  // the next report (after the cached one goes stale) fetches only what's still missing
  clock += 10 * MIN;
  twitch.calls.length = 0;
  const again = await call(h, '/api/streamers/alpha');
  assert.deepEqual(again.body.streams[1].segs, [['1', 0, HOUR], ['2', HOUR, 3 * HOUR]]);
  assert.equal(twitch.calls.filter((c) => c === 'moments').length, 1);
});

test('names are checked, unknown channels are said to be unknown, and only GET is answered', async () => {
  const h = make();
  assert.equal((await call(h, '/api/streamers/no%20way')).status, 400);
  assert.equal((await call(h, '/api/streamers/%E0%A4%A')).status, 400);
  assert.equal((await call(h, '/api/streamers/nobody_here')).status, 404);
  assert.equal((await call(h, '/api/streamers/alpha', 'POST')).status, 405);
});

/* ---------- the page's arithmetic ---------- */

const bundle = await rolldown({
  input: new URL('../src/lib/streamer.ts', import.meta.url).pathname,
  plugins: [{
    name: 'streamer-test-environment',
    resolveId: (id) => (id === 'preact/hooks' ? '\0hooks' : null),
    load: (id) => (id === '\0hooks' ? 'export const useEffect = () => {}; export const useState = (v) => [v, () => {}];' : null),
  }],
});
const { output } = await bundle.generate({ format: 'esm' });
const lib = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
await bundle.close();

test('a range adds up to hours per game, per day and per weekday-hour', () => {
  // Thursday 22 Oct 2026, 20:00 UTC; streams on the 20th (Tue) 14:00–18:00 and the 21st (Wed) 22:00–02:00
  const data = {
    now,
    games: { 1: ['Chat', null], 2: ['RPG', null] },
    streams: [
      { start: Date.UTC(2026, 9, 21, 22), end: Date.UTC(2026, 9, 22, 2), title: '', segs: [['2', 0, 4 * HOUR]], avg: 100, peak: 150 },
      { start: Date.UTC(2026, 9, 20, 14), end: Date.UTC(2026, 9, 20, 18), title: '', segs: [['1', 0, HOUR], ['2', HOUR, 3 * HOUR]] },
      { start: Date.UTC(2026, 8, 1, 14), end: Date.UTC(2026, 8, 1, 16), title: '', segs: [['1', 0, 2 * HOUR]] },
    ],
  };
  const a = lib.analyse(data, 7);
  assert.equal(a.count, 2);
  assert.equal(a.total, 8 * HOUR);
  assert.deepEqual(a.games.map((g) => [g.name, g.ms / HOUR, g.streams]), [['RPG', 7, 2], ['Chat', 1, 1]]);
  assert.equal(a.daysLive, 3, 'the late stream runs into the next day');
  const byKey = Object.fromEntries(a.buckets.map((b) => [b.key, b.ms / HOUR]));
  assert.deepEqual([byKey['2026-10-20'], byKey['2026-10-21'], byKey['2026-10-22']], [4, 2, 2]);
  assert.equal(a.often[1][15], 1, 'live every Tuesday of the week at 15:00');
  assert.equal(a.often[1][19], 0);
  assert.deepEqual(a.viewers, { streams: 1, avg: 100, peak: 150, hoursWatched: 400 });
  assert.equal(lib.analyse(data, null).count, 3);
  assert.equal(lib.analyse(data, null).weekly, false);
  // colours go to the games streamed most over everything, so they don't move with the range
  assert.deepEqual([...lib.gameColors(data.streams)], [['2', 'sadness'], ['1', 'hope-interest']]);
});

test('usual start times wrap around midnight, and durations read naturally', () => {
  const at = (h, m = 0) => ({ start: Date.UTC(2026, 9, 15, h, m), end: Date.UTC(2026, 9, 15, h, m) + HOUR, title: '', segs: [['1', 0, HOUR]] });
  const a = lib.analyse({ now, games: {}, streams: [at(23), at(1), at(0)] }, 30);
  assert.equal(a.starts, 0);
  assert.equal(lib.hours(45 * MIN), '45 min');
  assert.equal(lib.hours(5 * HOUR + 28 * MIN), '5 h 28 min');
  assert.equal(lib.hours(142 * HOUR), '142 h');
});
