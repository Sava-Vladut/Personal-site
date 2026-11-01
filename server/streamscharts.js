// Streams Charts' API (https://streamscharts.com/api): what a Twitch channel did over any stretch since June 2019 —
// hours streamed and watched, average and peak viewers, followers gained, streams, days live and its top games by
// hours watched. It needs a Client ID and Token (STREAMSCHARTS_CLIENT_ID, STREAMSCHARTS_TOKEN) and is paid for in
// credits, so every answer is kept with the channel: a month that's over never changes and is never asked for again,
// and one that runs to today is asked for again at most every FRESH_MS. A daily cap keeps a bug from spending them all.

const DAY = 86_400_000;
const FRESH_MS = 12 * 3_600_000;
const RETRY_MS = 3_600_000;        // after Streams Charts said no (out of credits, down): wait this long
const SINCE = Date.UTC(2019, 5, 1); // its Twitch data starts in June 2019

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const monthKey = (ms) => iso(ms).slice(0, 7);
const n = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);

/** Streams Charts' answer, kept small: [game, hours watched, % of the hours watched] for the top games. */
export function normalize(data) {
  if (!data || typeof data !== 'object') return null;
  const games = Array.isArray(data.top_5_games_by_hw)
    ? data.top_5_games_by_hw.map((g) => [String(g?.name ?? ''), n(g?.hours_watched) ?? 0, n(g?.['%_of_hours_watched']) ?? 0]).filter((g) => g[0])
    : [];
  return {
    hw: n(data.hours_watched),
    avg: n(data.average_viewers),
    peak: n(data.peak_viewers),
    airMin: n(data.airtime_in_m),
    gained: n(data.followers_gain),
    followers: n(data.total_followers),
    streams: n(data.stream_count),
    days: n(data.stream_days),
    gamesCount: n(data.games_count),
    games,
  };
}

/** Several stretches as one: sums, the highest peak, viewers over the whole airtime, the top games merged by name. */
export function combine(list) {
  const xs = list.filter(Boolean);
  if (!xs.length) return null;
  const sum = (k) => (xs.some((x) => x[k] !== null) ? xs.reduce((a, x) => a + (x[k] ?? 0), 0) : null);
  const hw = sum('hw'), airMin = sum('airMin');
  const games = new Map();
  for (const x of xs) for (const [name, h] of x.games) games.set(name, (games.get(name) ?? 0) + h);
  return {
    hw,
    avg: hw !== null && airMin ? Math.round(hw / (airMin / 60)) : null,
    peak: xs.some((x) => x.peak !== null) ? Math.max(...xs.map((x) => x.peak ?? 0)) : null,
    airMin,
    gained: sum('gained'),
    followers: xs.at(-1).followers,
    streams: sum('streams'),
    days: sum('days'),
    gamesCount: null,
    games: [...games].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, h]) => [name, h, hw ? Math.round((h / hw) * 1000) / 10 : 0]),
  };
}

export function createStreamsCharts({ clientId, token, base = 'https://streamscharts.com/api/jazz', fetch: get = globalThis.fetch, now = Date.now, dailyCalls = 300 } = {}) {
  const enabled = !!(clientId && token);
  let day = '', calls = 0, blockedUntil = 0;

  /** One stretch for a channel, from what's kept when it's still good, else from Streams Charts. */
  async function stats(store, login, time, closed) {
    store.sc ??= {};
    const kept = store.sc[time];
    const t = now();
    if (kept && (kept.v ? closed || t - kept.at < FRESH_MS : t - kept.at < RETRY_MS)) return kept.v;
    if (!enabled || t < blockedUntil) return kept?.v ?? null;
    if (day !== iso(t)) (day = iso(t)), (calls = 0);
    if (calls >= dailyCalls) return kept?.v ?? null;
    calls++;
    let v = null;
    try {
      const r = await get(`${base}/channels/${encodeURIComponent(login)}?platform=twitch&time=${encodeURIComponent(time)}`, {
        headers: { 'Client-ID': clientId, Token: token, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (r.status === 404) v = null;
      else if (!r.ok) {
        // out of credits, a wrong key, or down: no more asking for a while, and what was kept stays
        if (r.status === 401 || r.status === 402 || r.status === 403 || r.status === 429 || r.status >= 500) blockedUntil = t + RETRY_MS;
        console.error(`streamscharts: ${login} ${time} answered ${r.status}`);
        return kept?.v ?? null;
      } else v = normalize((await r.json())?.data);
    } catch (e) {
      console.error(`streamscharts: ${login} ${time} failed:`, e.message);
      return kept?.v ?? null;
    }
    store.sc[time] = closed ? { at: t, v, closed: 1 } : { at: t, v };
    // stretches that ran to a day now past are asked under new dates; their old answers go after a few days
    for (const [k, x] of Object.entries(store.sc)) if (!x.closed && t - x.at > 3 * DAY) delete store.sc[k];
    return v;
  }

  /** The months [first, last] covering [from, to], as [key 'YYYY-MM', its time value, whether it's over]. */
  function months(from, to) {
    const t = now();
    const out = [];
    const at = new Date(Math.max(SINCE, from));
    at.setUTCDate(1);
    at.setUTCHours(0, 0, 0, 0);
    while (at.getTime() <= to) {
      const start = at.getTime();
      at.setUTCMonth(at.getUTCMonth() + 1);
      const last = Math.min(at.getTime() - DAY, t);
      out.push([monthKey(start), `${iso(start)},${iso(last)}`, at.getTime() <= dayStart(t)]);
    }
    return out;
  }
  const dayStart = (ms) => Math.floor(ms / DAY) * DAY;

  /** The last 30 days, for the banner: the shape TwitchTracker's summary had, so the page reads either. */
  async function summary(store, login) {
    if (!enabled) return null;
    const s = await stats(store, login, '30-days', false);
    return s && { avg: s.avg, peak: s.peak, hoursWatched: s.hw, minutes: s.airMin, followers: s.gained, followersTotal: s.followers, rank: null, streams: s.streams, days: s.days };
  }

  /**
   * A range's stats and the range before it, and every month it touches (all of them since June 2019, or since the
   * channel was made, for `days` = null), four requests at a time.
   */
  async function history(store, login, days, created) {
    if (!enabled) return { on: false, months: [], range: null, prev: null };
    const t = now();
    const today = dayStart(t);
    const from = days ? today - (days - 1) * DAY : Math.max(SINCE, created ?? SINCE);
    const wanted = days === null || days > 300 ? months(from, t) : [];
    const out = [];
    for (let i = 0; i < wanted.length; i += 4) {
      const part = await Promise.all(wanted.slice(i, i + 4).map(([key, time, closed]) => stats(store, login, time, closed).then((v) => [key, v])));
      out.push(...part);
    }
    // Streams Charts' own names for the usual ones, else the dates; longer than a year is added up from its months
    const ranged = (a, b) => {
      const named = b >= today && { 7: '7-days', 30: '30-days', 90: '90-days' }[days];
      return named ? stats(store, login, named, false) : stats(store, login, `${iso(a)},${iso(b)}`, b < today);
    };
    const long = !days || days > 365;
    const range = long ? combine(out.map(([, v]) => v)) : await ranged(from, today);
    const prev = !long && from - days * DAY >= SINCE ? await ranged(from - days * DAY, from - DAY) : null;
    return { on: true, months: out.filter(([, v]) => v), range, prev };
  }

  return { enabled, summary, history };
}
