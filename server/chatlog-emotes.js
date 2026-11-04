// Third-party Twitch emotes for the chat logs: 7TV, BetterTTV and FrankerFaceZ, their global sets and one channel's, as
// { name: code }. A code is a provider letter and the emote's id: s 7TV, b BetterTTV, f FrankerFaceZ (g when animated),
// with a leading z on the zero-width ones that sit on top of the emote before them. Twitch's own emotes aren't here:
// they come with every line (its `e`, from the emotes tag). lib/emotes.ts turns a code into an image address.
const HOUR = 3_600_000;
const GLOBAL_FRESH = 6 * HOUR;
const CHANNEL_FRESH = HOUR;
const FAILED_FRESH = 60_000; // a provider that didn't answer is asked again soon
const MAX_CHANNELS = 100;

// BetterTTV doesn't flag these in its lists; they're drawn over the emote before them
const BTTV_ZERO_WIDTH = new Set(['SoSnowy', 'IceCold', 'SantaHat', 'TopHat', 'ReinDeer', 'CandyCane', 'cvMask', 'cvHazmat']);

/** 7TV: an emote set → [name, code]. A set's emotes carry the set's own flags; each emote carries its own. */
function sevenTv(set) {
  const out = [];
  for (const e of Array.isArray(set?.emotes) ? set.emotes : []) {
    const id = e?.data?.id ?? e?.id;
    if (!id || !e.name) continue;
    const zero = (e.flags & 1) || (e.data?.flags & 256);
    out.push([e.name, `${zero ? 'z' : ''}s${id}`]);
  }
  return out;
}

/** BetterTTV: a list of emotes, or a channel's own and shared ones. Its "modifiers" are effects, not pictures. */
function betterTtv(body) {
  const list = Array.isArray(body) ? body : [...(body?.channelEmotes ?? []), ...(body?.sharedEmotes ?? [])];
  const out = [];
  for (const e of list) {
    if (!e?.id || !e.code || e.modifier) continue;
    out.push([e.code, `${BTTV_ZERO_WIDTH.has(e.code) ? 'z' : ''}b${e.id}`]);
  }
  return out;
}

/** FrankerFaceZ: the emoticons of some of the response's sets. Its "modifiers" are effects, too. */
function frankerFaceZ(body, setIds) {
  const out = [];
  for (const id of setIds) {
    for (const e of body?.sets?.[id]?.emoticons ?? []) {
      if (!e?.id || !e.name || e.modifier) continue;
      out.push([e.name, `${e.animated ? 'g' : 'f'}${e.id}`]);
    }
  }
  return out;
}

export function createEmotes(getJson) {
  const cache = new Map(); // key → { at, ttl, list }
  const inflight = new Map();

  /** One provider's list, remembered for `ttl`; [] (and a short memory) when it can't be reached. */
  function fetched(key, ttl, url, parse) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.list);
    if (inflight.has(key)) return inflight.get(key);
    const p = (async () => {
      let list = [], keep = ttl;
      try {
        const { status, body } = await getJson(url, 15_000);
        if (status === 200 && body) list = parse(body);
        else if (status !== 404) keep = FAILED_FRESH; // 404: the channel just isn't on that service
      } catch {
        keep = FAILED_FRESH;
      }
      cache.set(key, { at: Date.now(), ttl: keep, list });
      if (cache.size > MAX_CHANNELS * 3 + 10) cache.delete(cache.keys().next().value);
      return list;
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  const global = () => Promise.all([
    fetched('7tv', GLOBAL_FRESH, 'https://7tv.io/v3/emote-sets/global', sevenTv),
    fetched('bttv', GLOBAL_FRESH, 'https://api.betterttv.net/3/cached/emotes/global', betterTtv),
    fetched('ffz', GLOBAL_FRESH, 'https://api.frankerfacez.com/v1/set/global', (b) => frankerFaceZ(b, b.default_sets ?? [])),
  ]);

  const channel = (id) => Promise.all([
    fetched(`7tv:${id}`, CHANNEL_FRESH, `https://7tv.io/v3/users/twitch/${id}`, (b) => sevenTv(b.emote_set)),
    fetched(`bttv:${id}`, CHANNEL_FRESH, `https://api.betterttv.net/3/cached/users/twitch/${id}`, betterTtv),
    fetched(`ffz:${id}`, CHANNEL_FRESH, `https://api.frankerfacez.com/v1/room/id/${id}`, (b) => frankerFaceZ(b, b.room?.set ? [b.room.set] : [])),
  ]);

  return {
    /** Fetch the global sets ahead of the first request. */
    warm: () => global().then(() => {}),
    /** Every name a channel's chat can use, as { name: code }: its own sets first, then the global ones. */
    async forChannel(id) {
      const [mine, shared] = await Promise.all([channel(id), global()]);
      const out = new Map();
      for (const list of [...mine, ...shared]) for (const [name, code] of list) if (!out.has(name) && !/\s/.test(name)) out.set(name, code);
      return Object.fromEntries(out);
    },
  };
}
