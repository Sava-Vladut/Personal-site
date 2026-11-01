// SullyGnome (https://sullygnome.com), read with its owner's permission: every stream a channel has had since 2015,
// each with its start, length, average and peak viewers, minutes watched, followers gained and games, from the tables
// its own pages load, a year at a time and 100 streams a page. Gently: one request at a time with a pause between, a
// year that's over is read once and kept with the channel for good, and the year running now is looked at again at
// most every REFRESH_MS, only its newest page.

const DAY = 86_400_000;
const BASE = 'https://sullygnome.com';
const UA = 'Mozilla/5.0 (compatible; savavlad.com streamer stats)';
const GAP_MS = 1_200;            // between two requests to SullyGnome, whoever asks
const REFRESH_MS = 3 * 3_600_000;
const UNKNOWN_MS = 7 * DAY;      // a channel SullyGnome doesn't know is asked about again after this
const PAGE = 100;                // the most streams its table gives at once
const FIRST_YEAR = 2015;         // its data starts in August 2015

/** A game in SullyGnome's 'name|slug|box art' triples: its Twitch id from the box art URL, its name and a small cover. */
export function gamesOf(text) {
  const parts = String(text ?? '').split('|');
  const out = [];
  for (let i = 0; i + 2 < parts.length; i += 3) {
    const [name, , art] = parts.slice(i, i + 3);
    const m = /ttv-boxart\/(\d+)(_IGDB)?-/.exec(art);
    const id = m ? m[1] : `name:${name}`;
    out.push([id, name, m ? `https://static-cdn.jtvnw.net/ttv-boxart/${m[1]}${m[2] ?? ''}-52x72.jpg` : null]);
  }
  return out;
}

/** One of its stream rows, kept small: [start, minutes, average viewers, peak, followers gained, minutes watched, game ids]. */
export function streamOf(row, games) {
  const start = Date.parse(row?.startDateTime);
  if (!Number.isFinite(start)) return null;
  const ids = gamesOf(row.gamesplayed).map(([id, name, box]) => ((games[id] ??= [name, box]), id));
  const n = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
  return [start, n(row.length), n(row.avgviewers), n(row.maxviewers), n(row.followergain), n(row.viewminutes), ids];
}

export function createSullyGnome({ fetch: get = globalThis.fetch, now = Date.now, gap = GAP_MS } = {}) {
  let queue = Promise.resolve();
  let last = 0;
  const syncs = new Map(); // login → the sync running for it

  /** One request, in turn: never two at once, and never closer together than `gap`. */
  function ask(path, json = true) {
    const run = async () => {
      const wait = last + gap - Date.now();
      if (wait > 0) await new Promise((ok) => setTimeout(ok, wait));
      try {
        const r = await get(BASE + path, {
          headers: { 'User-Agent': UA, Accept: json ? 'application/json' : 'text/html', 'X-Requested-With': 'XMLHttpRequest' },
          redirect: 'manual',
          signal: AbortSignal.timeout(20_000),
        });
        if (!r.ok) return { status: r.status };
        return { status: r.status, body: json ? await r.json() : await r.text() };
      } finally {
        last = Date.now();
      }
    };
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
  }

  /** SullyGnome's number for the channel, from its page; null when it doesn't know the channel. */
  async function idOf(login) {
    const { status, body } = await ask(`/channel/${encodeURIComponent(login)}`, false);
    if (status !== 200 || !body) return null;
    const m = /PageInfo\s*=\s*\{[^;]*?"id":(\d+)/.exec(body);
    return m ? Number(m[1]) : null;
  }

  /** A year's streams, newest first: every page of it, or only the newest when `newest`. */
  async function streamsOfYear(id, year, games, newest) {
    const out = [];
    for (let start = 0; ; start += PAGE) {
      const { status, body } = await ask(`/api/tables/channeltables/streams/${year}/${id}/%20/1/1/desc/${start}/${PAGE}`);
      if (status !== 200 || !Array.isArray(body?.data)) throw new Error(`SullyGnome answered ${status} for ${year}`);
      for (const row of body.data) {
        const s = streamOf(row, games);
        if (s) out.push(s);
      }
      if (newest || body.data.length < PAGE || start + PAGE >= (body.recordsTotal ?? 0)) return out;
    }
  }

  /** How long each game was streamed in a year, in minutes, for sharing a stream's length among its games. */
  async function gameMinutes(id, year, games) {
    const { status, body } = await ask(`/api/tables/channeltables/games/${year}/${id}/%20/1/2/desc/0/${PAGE}`);
    if (status !== 200 || !Array.isArray(body?.data)) return {};
    const out = {};
    for (const row of body.data) {
      const [g] = gamesOf(row.gamesplayed);
      if (!g) continue;
      games[g[0]] ??= [g[1], g[2]];
      out[g[0]] = Math.round(Number(row.streamtime) || 0);
    }
    return out;
  }

  /**
   * Bring what's kept of a channel up to date, newest year first, saving after each: `save` is called whenever
   * something was added, so the page can show the years as they come.
   */
  async function sync(store, login, save) {
    const t = now();
    const sg = (store.sg ??= { id: null, at: 0, years: {}, games: {} });
    if (!sg.id) {
      if (sg.none && t - sg.none < UNKNOWN_MS) return;
      sg.id = await idOf(login);
      if (!sg.id) return void ((sg.none = t), await save());
      delete sg.none;
    }
    const thisYear = new Date(t).getUTCFullYear();
    const first = Math.max(FIRST_YEAR, store.created ? new Date(store.created).getUTCFullYear() : FIRST_YEAR);
    for (let year = thisYear; year >= first; year--) {
      const kept = sg.years[year];
      if (kept?.done) continue;
      if (year === thisYear && kept && t - kept.at < REFRESH_MS) continue;
      // the year running now: its newest page joins what's kept; a year once read but since over is read whole again
      const newest = year === thisYear && !!kept;
      const fresh = await streamsOfYear(sg.id, year, sg.games, newest);
      const byStart = new Map((newest ? kept.streams : []).map((s) => [s[0], s]));
      for (const s of fresh) byStart.set(s[0], s);
      sg.years[year] = {
        at: t,
        done: year < thisYear ? 1 : 0,
        streams: [...byStart.values()].sort((a, b) => b[0] - a[0]),
        mins: year >= thisYear - 1 || !kept?.mins ? await gameMinutes(sg.id, year, sg.games) : kept.mins,
      };
      sg.at = t;
      await save();
    }
  }

  /** Start bringing a channel up to date unless that's already going; returns whether it's going. */
  function start(store, login, save) {
    if (syncs.has(login)) return true;
    const p = sync(store, login, save)
      .catch((e) => console.error(`sullygnome: ${login}:`, e.message))
      .finally(() => syncs.delete(login));
    syncs.set(login, p);
    return true;
  }

  /** Everything kept of a channel: its streams oldest first, the games they name, and whether more is on the way. */
  function history(store, login) {
    const sg = store.sg;
    const syncing = syncs.has(login);
    if (!sg?.id) return { known: !sg?.none, syncing, streams: [], games: {}, mins: {} };
    const years = Object.keys(sg.years).sort();
    return {
      known: true,
      syncing,
      streams: years.flatMap((y) => sg.years[y].streams.slice().reverse()),
      games: sg.games,
      mins: Object.fromEntries(years.map((y) => [y, sg.years[y].mins ?? {}])),
    };
  }

  /** Whether a channel's kept years are due a look (none yet, or the running year stale). */
  function due(store) {
    const sg = store.sg;
    if (!sg?.id) return !(sg?.none && now() - sg.none < UNKNOWN_MS);
    const year = new Date(now()).getUTCFullYear();
    return !sg.years[year] || now() - sg.years[year].at >= REFRESH_MS || !sg.years[year - 1]?.done;
  }

  return { start, history, due, syncing: (login) => syncs.has(login) };
}
