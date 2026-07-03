import { GLOBAL_BADGES, badgeImageUrl } from '../data/twitchBadges.js'

// Shared Twitch chat rendering helpers used by both the Logs service (rustlog
// archive) and the live Chat service (IRC websocket): third-party emote
// resolution (7TV + BetterTTV), Twitch + 7TV badge lookup, and turning a raw
// message into React nodes.

export const emoteUrl = (id) => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0`

// Third-party emotes (7TV + BetterTTV) are plain words in the message text — not in
// Twitch's emote tag — so they're resolved per-channel from each provider's API and
// matched by exact word. Each map entry carries its own CDN url + label, so providers
// with different url schemes merge cleanly into one name -> emote map.
const SEVENTV = 'https://7tv.io/v3'
const seventvUrl = (id) => `https://cdn.7tv.app/emote/${id}/1x.webp`
const BTTV = 'https://api.betterttv.net/3'
const bttvUrl = (id) => `https://cdn.betterttv.net/emote/${id}/1x.webp`

const sevenToPairs = (emotes) =>
  (emotes || []).map((e) => [e.name, { src: seventvUrl(e.id), title: `${e.name} · 7TV` }])
const bttvToPairs = (emotes) =>
  (emotes || []).map((e) => [e.code, { src: bttvUrl(e.id), title: `${e.code} · BTTV` }])

// Fetch JSON, swallowing any network/parse error into null so a provider being down
// just contributes no emotes rather than breaking the whole render.
const fetchJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null)

// Globals are fetched once and cached; a failed fetch resets the cache so it retries.
let sevenGlobalPromise = null
const fetchSevenGlobal = () => {
  if (!sevenGlobalPromise) {
    sevenGlobalPromise = fetchJson(`${SEVENTV}/emote-sets/global`).then((j) => {
      const pairs = sevenToPairs(j && j.emotes)
      if (pairs.length === 0) sevenGlobalPromise = null
      return pairs
    })
  }
  return sevenGlobalPromise
}

let bttvGlobalPromise = null
const fetchBttvGlobal = () => {
  if (!bttvGlobalPromise) {
    bttvGlobalPromise = fetchJson(`${BTTV}/cached/emotes/global`).then((j) => {
      const pairs = bttvToPairs(j)
      if (pairs.length === 0) bttvGlobalPromise = null
      return pairs
    })
  }
  return bttvGlobalPromise
}

const channelEmotesCache = new Map() // twitch channel id -> Promise<[name, entry][]>
const fetchChannelEmotes = (channelTwitchId) => {
  if (!channelTwitchId) return Promise.resolve([])
  if (!channelEmotesCache.has(channelTwitchId)) {
    const promise = Promise.all([
      fetchJson(`${SEVENTV}/users/twitch/${channelTwitchId}`).then((j) =>
        sevenToPairs(j && j.emote_set && j.emote_set.emotes),
      ),
      fetchJson(`${BTTV}/cached/users/twitch/${channelTwitchId}`).then((j) =>
        bttvToPairs(j && [...(j.channelEmotes || []), ...(j.sharedEmotes || [])]),
      ),
    ]).then(([seven, bttv]) => [...bttv, ...seven]) // 7TV wins on a name clash
    channelEmotesCache.set(channelTwitchId, promise)
  }
  return channelEmotesCache.get(channelTwitchId)
}

// Build a name -> emote map for a channel; channel emotes override globals, and
// within a tier 7TV overrides BTTV when both define the same word.
export async function loadThirdPartyEmotes(channelTwitchId) {
  const [bttvGlobal, sevenGlobal, channel] = await Promise.all([
    fetchBttvGlobal(),
    fetchSevenGlobal(),
    fetchChannelEmotes(channelTwitchId),
  ])
  return new Map([...bttvGlobal, ...sevenGlobal, ...channel])
}

export const EMPTY_EMOTES = new Map()
export const EMPTY_BADGES = {}
export const EMPTY_USER_BADGES = new Map()

// Channel-specific Twitch badges (custom sub tiers + bits) come from our backend's
// Helix proxy (/api/twitch/channel-badges). Cached per room id; a missing/empty
// response just means no channel overrides, so the global map + labels stand in.
const channelBadgesCache = new Map() // room id -> Promise<{ set/ver: {url1x,url2x,title} }>
export const fetchChannelBadges = (roomId) => {
  if (!roomId) return Promise.resolve(EMPTY_BADGES)
  if (!channelBadgesCache.has(roomId)) {
    const promise = fetchJson(`/api/twitch/channel-badges?broadcaster_id=${encodeURIComponent(roomId)}`)
      .then((j) => (j && j.badges) || EMPTY_BADGES)
    channelBadgesCache.set(roomId, promise)
  }
  return channelBadgesCache.get(roomId)
}

// A user's 7TV badge (sub / staff / event cosmetic) comes from their v3 profile:
// style.badge_id -> cdn.7tv.app/badge/{id}. Resolved lazily per chatter and
// cached forever; users without 7TV accounts or badges resolve to null.
const sevenUserBadgeCache = new Map() // twitch user id -> Promise<badge|null>
export const fetchSevenTvUserBadge = (twitchUserId) => {
  if (!twitchUserId) return Promise.resolve(null)
  if (!sevenUserBadgeCache.has(twitchUserId)) {
    const promise = fetchJson(`${SEVENTV}/users/twitch/${twitchUserId}`).then((j) => {
      const badgeId = j && j.user && j.user.style && j.user.style.badge_id
      if (!badgeId) return null
      return {
        src: `https://cdn.7tv.app/badge/${badgeId}/1x.webp`,
        src2: `https://cdn.7tv.app/badge/${badgeId}/2x.webp`,
        title: '7TV badge',
      }
    })
    sevenUserBadgeCache.set(twitchUserId, promise)
  }
  return sevenUserBadgeCache.get(twitchUserId)
}

// Short text fallback, keyed by badge *set* (the part before the slash), used
// only when a badge has no global image — e.g. a channel's custom subscriber
// tiers, which aren't in the global badge map.
const BADGE_LABELS = {
  broadcaster: 'host',
  moderator: 'mod',
  vip: 'vip',
  subscriber: 'sub',
  partner: 'verified',
  premium: 'prime',
  turbo: 'turbo',
  staff: 'staff',
  admin: 'admin',
  founder: 'founder',
}

// Parse the `badges` tag ("moderator/1,subscriber/12,bits/100") into render-ready
// descriptors. A channel's own badge art (custom sub tiers / bits, fetched from
// Helix via /api/twitch/channel-badges) wins; otherwise the baked-in global badge
// map; otherwise a short text label by set (or skip it if even that is unknown).
// `key` is unique per line, so it doubles as React key.
export const badgesOf = (tagStr, channelBadges = EMPTY_BADGES) =>
  (tagStr ? tagStr.split(',') : [])
    .map((entry) => {
      const setId = entry.slice(0, entry.indexOf('/'))
      const channel = channelBadges[entry]
      if (channel) {
        return { key: entry, src: channel.url1x, src2: channel.url2x, title: channel.title }
      }
      const global = GLOBAL_BADGES[entry]
      if (global) {
        return {
          key: entry,
          src: badgeImageUrl(global.id, 1),
          src2: badgeImageUrl(global.id, 2),
          title: global.title,
        }
      }
      const label = BADGE_LABELS[setId]
      return label ? { key: entry, label, title: setId } : null
    })
    .filter(Boolean)

// Rebuild a message into React nodes: Twitch emotes (from the emote tag) and 7TV
// emotes (matched by word against `emoteMap`) become <img>; the rest stays text.
// When `grep` is set, plain-text runs get their matches wrapped in <mark>.
export function renderMessage(message, grep, emoteMap) {
  let text = (message.text || '').split(String.fromCharCode(1)).join('')
  let action = false
  if (text.startsWith('ACTION ')) {
    action = true
    text = text.slice(7)
  }

  const chars = Array.from(text)
  const emoteStarts = new Array(chars.length).fill(null)
  const emoteStr = message.tags && message.tags.emotes
  if (emoteStr) {
    for (const part of emoteStr.split('/')) {
      const [id, ranges] = part.split(':')
      if (!ranges) continue
      for (const range of ranges.split(',')) {
        const [a, b] = range.split('-').map(Number)
        if (Number.isInteger(a)) emoteStarts[a] = { id, end: b }
      }
    }
  }

  const nodes = []
  let buffer = ''
  const flush = (key) => {
    if (!buffer) return
    nodes.push(...renderTextRun(buffer, grep, emoteMap, key))
    buffer = ''
  }
  for (let i = 0; i < chars.length; i += 1) {
    const emote = emoteStarts[i]
    if (emote) {
      flush(`t${i}`)
      const alt = chars.slice(i, emote.end + 1).join('')
      nodes.push(
        <img key={`e${i}`} className="tlog-emote" src={emoteUrl(emote.id)} alt={alt} title={alt} loading="lazy" />,
      )
      i = emote.end
    } else {
      buffer += chars[i]
    }
  }
  flush('tend')

  return { nodes, action }
}

// A run of plain text (no Twitch emotes): swap whole words that are 7TV/BTTV emotes
// for images, and highlight grep matches in whatever text remains.
function renderTextRun(text, grep, emoteMap, keyBase) {
  if (!emoteMap || emoteMap.size === 0) return highlight(text, grep, keyBase)
  // Split on whitespace but keep the separators so spacing is preserved.
  const tokens = text.split(/(\s+)/)
  const out = []
  tokens.forEach((tok, idx) => {
    const emote = tok && emoteMap.get(tok)
    if (emote) {
      out.push(
        <img
          key={`${keyBase}s${idx}`}
          className="tlog-emote tlog-emote--3p"
          src={emote.src}
          alt={tok}
          title={emote.title}
          loading="lazy"
        />,
      )
    } else if (tok) {
      out.push(...highlight(tok, grep, `${keyBase}w${idx}`))
    }
  })
  return out
}

function highlight(text, grep, keyBase) {
  if (!grep) return [text]
  const lower = text.toLowerCase()
  const needle = grep.toLowerCase()
  const out = []
  let from = 0
  let hit = lower.indexOf(needle)
  let n = 0
  while (hit !== -1) {
    if (hit > from) out.push(text.slice(from, hit))
    out.push(
      <mark key={`${keyBase}m${n}`} className="tlog-mark">
        {text.slice(hit, hit + needle.length)}
      </mark>,
    )
    from = hit + needle.length
    hit = lower.indexOf(needle, from)
    n += 1
  }
  if (from < text.length) out.push(text.slice(from))
  return out
}
