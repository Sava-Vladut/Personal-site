// Channel points, from the Twitch Channel Points Miner's analytics: one JSON file per channel,
// each a series of { x: time in ms, y: balance, z: why it changed }. The files are read-only here
// (the miner keeps writing them); a summary is worked out per file and kept until the file changes.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DAY = 86_400_000;
const DAYS = 90;          // how far back the daily balances go
const LIVE_MS = 12 * 60_000; // a channel that earned in the last few minutes is being watched
const RECENT = 30;
// what isn't the steady trickle of watching and bonus claims: worth listing as it happens
const NOTABLE = new Set(['Watch Streak', 'Raid', 'Spent', 'Refund', 'Weekly Rewards', 'Prediction']);

/** Midnight UTC of a time, as the key for its day. */
const dayOf = (ms) => Math.floor(ms / DAY) * DAY;

/** The balance at a moment: the last point at or before it, or the first one if there is none yet. */
function balanceAt(series, ms) {
  let lo = 0, hi = series.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].x <= ms) (best = mid), (lo = mid + 1);
    else hi = mid - 1;
  }
  return best < 0 ? null : series[best].y;
}

function summarise(name, data, now) {
  const series = (Array.isArray(data?.series) ? data.series : [])
    .filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
    .sort((a, b) => a.x - b.x);
  if (!series.length) return null;
  const last = series[series.length - 1];
  const since = (ms) => {
    const then = balanceAt(series, now - ms);
    return last.y - (then ?? series[0].y);
  };

  // what each reason brought in (or took away) over the last 30 days
  const reasons = {};
  const recent = [];
  const from = now - 30 * DAY;
  for (let i = 1; i < series.length; i++) {
    const p = series[i], d = p.y - series[i - 1].y;
    if (!d) continue;
    // a drop while watching is points spent on something
    const why = d < 0 && p.z === 'Watch' ? 'Spent' : String(p.z || 'Other');
    if (p.x >= from) reasons[why] = (reasons[why] || 0) + d;
    if (NOTABLE.has(why) || d < 0) recent.push({ channel: name, at: p.x, reason: why, delta: d });
  }

  // the balance at the end of each of the last DAYS days
  const daily = [];
  const today = dayOf(now);
  for (let k = DAYS - 1; k >= 0; k--) {
    const end = today - k * DAY + DAY - 1;
    daily.push(balanceAt(series, end));
  }

  return {
    name,
    balance: last.y,
    firstAt: series[0].x,
    lastAt: last.x,
    live: now - last.x < LIVE_MS,
    change: { day: since(DAY), week: since(7 * DAY), month: since(30 * DAY) },
    reasons,
    daily,
    recent: recent.slice(-RECENT),
  };
}

export function createTwitchHandler({ directory }) {
  const cache = new Map(); // file → { key, summary }

  /** The miner keeps one folder per account; the first (or only) one is ours. */
  async function account() {
    const dirs = (await readdir(directory, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    return dirs[0] ?? null;
  }

  async function summary() {
    const now = Date.now();
    const user = await account();
    if (!user) return null;
    const dir = join(directory, user);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    const channels = [];
    for (const f of files) {
      const path = join(dir, f);
      let info;
      try {
        info = await stat(path);
      } catch {
        continue;
      }
      // re-read a file when it changes, and at least once a day so "today" moves on
      const key = `${info.mtimeMs}:${info.size}:${dayOf(now)}`;
      let hit = cache.get(path);
      if (!hit || hit.key !== key) {
        try {
          hit = { key, summary: summarise(f.slice(0, -5), JSON.parse(await readFile(path, 'utf8')), now) };
        } catch {
          // the miner may be halfway through writing it; use what we had
          if (!hit) continue;
        }
        cache.set(path, hit);
      }
      // live-ness and the windows move with the clock, even when the file doesn't
      if (hit.summary) channels.push({ ...hit.summary, live: now - hit.summary.lastAt < LIVE_MS });
    }
    channels.sort((a, b) => b.balance - a.balance);

    const sum = (pick) => channels.reduce((s, c) => s + pick(c), 0);
    const reasons = {};
    for (const c of channels) for (const [k, v] of Object.entries(c.reasons)) reasons[k] = (reasons[k] || 0) + v;
    const daily = Array.from({ length: DAYS }, (_, i) => {
      const known = channels.map((c) => c.daily[i]).filter((v) => v !== null);
      return known.length ? known.reduce((s, v) => s + v, 0) : null;
    });
    const recent = channels.flatMap((c) => c.recent).sort((a, b) => b.at - a.at).slice(0, RECENT);

    return {
      user,
      now,
      start: dayOf(now) - (DAYS - 1) * DAY,
      total: sum((c) => c.balance),
      change: { day: sum((c) => c.change.day), week: sum((c) => c.change.week), month: sum((c) => c.change.month) },
      reasons,
      daily,
      recent,
      channels: channels.map(({ recent: _, ...c }) => c),
    };
  }

  return async function twitch(req, res, json) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
    if (!directory) return json(res, 404, { error: 'Channel points aren’t set up on this server.' });
    let body;
    try {
      body = await summary();
    } catch (e) {
      if (e.code === 'ENOENT') return json(res, 404, { error: 'Channel points aren’t set up on this server.' });
      throw e;
    }
    if (!body) return json(res, 404, { error: 'No channel points yet.' });
    return json(res, 200, body, { 'Cache-Control': 'no-store' });
  };
}
