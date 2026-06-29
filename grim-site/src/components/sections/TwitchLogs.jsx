import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Maximize2, Minimize2 } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { GLOBAL_BADGES, badgeImageUrl } from '../../data/twitchBadges.js'

// Reads the open rustlog API hosted at logs.zonian.dev. CORS is wide-open so the
// retrieval happens entirely client-side — nothing proxies through the backend.
const API = 'https://logs.zonian.dev'
const emoteUrl = (id) => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0`

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
async function loadThirdPartyEmotes(channelTwitchId) {
  const [bttvGlobal, sevenGlobal, channel] = await Promise.all([
    fetchBttvGlobal(),
    fetchSevenGlobal(),
    fetchChannelEmotes(channelTwitchId),
  ])
  return new Map([...bttvGlobal, ...sevenGlobal, ...channel])
}

const EMPTY_EMOTES = new Map()
const EMPTY_BADGES = {}

// Channel-specific Twitch badges (custom sub tiers + bits) come from our backend's
// Helix proxy (/api/twitch/channel-badges). Cached per room id; a missing/empty
// response just means no channel overrides, so the global map + labels stand in.
const channelBadgesCache = new Map() // room id -> Promise<{ set/ver: {url1x,url2x,title} }>
const fetchChannelBadges = (roomId) => {
  if (!roomId) return Promise.resolve(EMPTY_BADGES)
  if (!channelBadgesCache.has(roomId)) {
    const promise = fetchJson(`/api/twitch/channel-badges?broadcaster_id=${encodeURIComponent(roomId)}`)
      .then((j) => (j && j.badges) || EMPTY_BADGES)
    channelBadgesCache.set(roomId, promise)
  }
  return channelBadgesCache.get(roomId)
}

const MODES = [
  { id: 'latest', label: 'latest', note: 'newest stored month for this subject' },
  { id: 'channel', label: 'channel', note: "entire channel's chat — blank day = latest stored" },
  { id: 'random', label: 'random', note: 'one random line — re-run for another' },
  { id: 'month', label: 'by month', note: 'pick an exact archived YYYY / MM' },
  { id: 'id', label: 'by id', note: 'bypass name lookup with raw numeric ids' },
]

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

const MONTHS = ['', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// Parse the `badges` tag ("moderator/1,subscriber/12,bits/100") into render-ready
// descriptors. A channel's own badge art (custom sub tiers / bits, fetched from
// Helix via /api/twitch/channel-badges) wins; otherwise the baked-in global badge
// map; otherwise a short text label by set (or skip it if even that is unknown).
// `key` is unique per line, so it doubles as React key.
const badgesOf = (tagStr, channelBadges = EMPTY_BADGES) =>
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
function renderMessage(message, grep, emoteMap) {
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

const fmtDay = (d) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const fmtStamp = (d) =>
  d.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

// How many rows to reveal per "page" as the user scrolls to the bottom.
const PAGE_SIZE = 50

// One log row. Memoized so appending more rows never re-renders existing ones —
// the heavy work (date formatting + emote parsing) runs once per message and is
// skipped on every subsequent scroll-load. Only changes to grep/emoteMap/badgeMap
// (which affect every visible line) trigger a re-render.
const LogLine = memo(function LogLine({ message, grep, emoteMap, badgeMap }) {
  const date = new Date(message.timestamp)
  const name = message.displayName || message.username || 'unknown'
  const tags = badgesOf(message.tags && message.tags.badges, badgeMap)
  const { nodes, action } = renderMessage(message, grep, emoteMap)
  return (
    <div className="tlog-line">
      <span className="tlog-ts" title={date.toString()}>
        {fmtStamp(date)}
      </span>
      <span className="tlog-who">
        {tags.map((b) =>
          b.src ? (
            <img
              key={b.key}
              className="tlog-badge-img"
              src={b.src}
              srcSet={`${b.src} 1x, ${b.src2} 2x`}
              alt={b.title}
              title={b.title}
              loading="lazy"
            />
          ) : (
            <span className="tlog-badge" key={b.key} title={b.title}>
              {b.label}
            </span>
          ),
        )}
        <span className="tlog-name">{name}</span>
      </span>
      <span className={`tlog-msg${action ? ' is-action' : ''}`}>{nodes}</span>
    </div>
  )
})

export function TwitchLogs() {
  const [mode, setMode] = useState('latest')
  const [channel, setChannel] = useState('')
  const [user, setUser] = useState('')
  const [channelId, setChannelId] = useState('')
  const [userId, setUserId] = useState('')
  const [reverse, setReverse] = useState(true)
  const [limit, setLimit] = useState('500')
  const [grep, setGrep] = useState('')

  const [months, setMonths] = useState([])
  const [month, setMonth] = useState('')
  const [monthState, setMonthState] = useState('idle') // idle | loading | empty | ready
  const [day, setDay] = useState('') // 'YYYY-MM-DD' for whole-channel mode; blank = latest

  const [status, setStatus] = useState('idle') // idle | loading | error | done
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [emoteMap, setEmoteMap] = useState(EMPTY_EMOTES)
  const [badgeMap, setBadgeMap] = useState(EMPTY_BADGES)
  const [label, setLabel] = useState('')
  const feedRef = useRef(null)
  const outputRef = useRef(null)

  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[0]

  // Fullscreen the output panel via the native Fullscreen API so logs can be read
  // edge-to-edge. Tracking `fullscreenchange` keeps the button label in sync even
  // when the user exits with Esc or the browser chrome.
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === outputRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else if (outputRef.current) {
      outputRef.current.requestFullscreen().catch(() => {})
    }
  }, [])

  const loadMonths = useCallback(async () => {
    const ch = channel.trim().toLowerCase()
    const us = user.trim().toLowerCase()
    if (!ch || !us) {
      setMonthState('idle')
      setMonths([])
      return
    }
    setMonthState('loading')
    try {
      const r = await fetch(`${API}/list?channel=${encodeURIComponent(ch)}&user=${encodeURIComponent(us)}`)
      if (!r.ok) throw new Error('not found')
      const j = await r.json()
      const logs = j.availableLogs || []
      setMonths(logs)
      setMonth(logs.length ? `${logs[0].year}/${logs[0].month}` : '')
      setMonthState(logs.length ? 'ready' : 'empty')
    } catch {
      setMonths([])
      setMonthState('empty')
    }
  }, [channel, user])

  const buildTarget = useCallback(() => {
    const lim = Math.max(1, Math.min(100000, Number(limit) || 500))
    const params = new URLSearchParams({ json: '1' })
    if (mode !== 'random') {
      params.set('limit', String(lim))
      if (reverse) params.set('reverse', 'true')
    }

    if (mode === 'id') {
      const cid = channelId.trim()
      const uid = userId.trim()
      if (!cid || !uid) throw new Error('Enter both a channel ID and a user ID.')
      return {
        url: `${API}/channelid/${encodeURIComponent(cid)}/userid/${encodeURIComponent(uid)}?${params}`,
        label: `channel-id ${cid} · user-id ${uid}`,
      }
    }

    if (mode === 'channel') {
      const ch = channel.trim().toLowerCase()
      if (!ch) throw new Error('Enter a channel.')
      const base = `${API}/channel/${encodeURIComponent(ch)}`
      if (day) {
        const [y, m, d] = day.split('-')
        return { url: `${base}/${y}/${Number(m)}/${Number(d)}?${params}`, label: `#${ch} · ${day}` }
      }
      return { url: `${base}?${params}`, label: `#${ch} · latest day` }
    }

    const ch = channel.trim().toLowerCase()
    const us = user.trim().toLowerCase()
    if (!ch || !us) throw new Error('Enter both a channel and a subject username.')
    const base = `${API}/channel/${encodeURIComponent(ch)}/user/${encodeURIComponent(us)}`
    const niceLabel = `#${ch} · ${us}`

    if (mode === 'random') return { url: `${base}/random?json=1`, label: niceLabel }
    if (mode === 'month') {
      if (!month) throw new Error('Pick an archived month — use “load index”.')
      return { url: `${base}/${month}?${params}`, label: `${niceLabel} · ${month}` }
    }
    return { url: `${base}?${params}`, label: niceLabel }
  }, [mode, limit, reverse, channelId, userId, channel, user, month, day])

  const retrieve = useCallback(
    async (event) => {
      if (event) event.preventDefault()
      let target
      try {
        target = buildTarget()
      } catch (err) {
        setStatus('error')
        setError(err.message)
        return
      }

      setStatus('loading')
      setError('')
      setLabel(target.label)
      setGrep('')
      setEmoteMap(EMPTY_EMOTES)
      setBadgeMap(EMPTY_BADGES)
      try {
        const r = await fetch(target.url)
        if (r.status === 404) {
          setMessages([])
          setStatus('error')
          setError('No logs on record for this subject in this channel / range.')
          return
        }
        if (!r.ok) throw new Error(`request failed (${r.status})`)
        const j = await r.json()
        const msgs = j.messages || []
        setMessages(msgs)
        setStatus('done')
        if (feedRef.current) feedRef.current.scrollTop = 0

        // Resolve 7TV + BTTV emotes for this channel and re-render once they arrive.
        // room-id is on every message; fall back to the entered channel id.
        const roomId =
          (mode === 'id' && channelId.trim()) || (msgs[0] && msgs[0].tags && msgs[0].tags['room-id'])
        if (roomId) {
          loadThirdPartyEmotes(roomId)
            .then((map) => setEmoteMap(map))
            .catch(() => {})
          // Channel-specific badges (custom sub tiers / bits) via the Helix proxy.
          fetchChannelBadges(roomId)
            .then((map) => setBadgeMap(map))
            .catch(() => {})
        }
      } catch (err) {
        setMessages([])
        setStatus('error')
        setError(`${err.message} — the log node may be down or rate-limited.`)
      }
    },
    [buildTarget, mode, channelId],
  )

  const filtered = useMemo(() => {
    const needle = grep.trim().toLowerCase()
    if (!needle) return messages
    return messages.filter((m) => (m.text || '').toLowerCase().includes(needle))
  }, [messages, grep])

  const span = useMemo(() => {
    if (!messages.length) return null
    const times = messages.map((m) => new Date(m.timestamp)).sort((a, b) => a - b)
    return { first: times[0], last: times[times.length - 1] }
  }, [messages])

  // Progressive rendering: only `visibleCount` rows are in the DOM at once. Each
  // time the bottom sentinel scrolls into view we reveal another PAGE_SIZE.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef(null)

  // A new result set (or a grep change) produces a new `filtered` array — reset
  // back to the first page. Done during render (React's recommended pattern for
  // resetting state on a changed input) rather than in an effect.
  const [pageAnchor, setPageAnchor] = useState(filtered)
  if (pageAnchor !== filtered) {
    setPageAnchor(filtered)
    setVisibleCount(PAGE_SIZE)
  }

  // Scroll the feed back to the top when the result set changes (DOM-only).
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [filtered])

  const total = filtered.length
  const hasMore = visibleCount < total
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const grepTrimmed = grep.trim()

  // Observe the sentinel within the scrollable feed. IntersectionObserver avoids
  // a per-frame scroll handler; rootMargin pre-loads the next page slightly early
  // so scrolling stays smooth. Re-created only when the page can grow again.
  useEffect(() => {
    if (!hasMore) return undefined
    const root = feedRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, total))
        }
      },
      { root, rootMargin: '400px 0px' },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [hasMore, total])

  return (
    <div className="tlog-tool">
      <div className="tlog-modes" role="tablist" aria-label="Retrieval mode">
        {MODES.map((m) => (
          <button
            type="button"
            role="tab"
            key={m.id}
            className="tlog-mode"
            aria-selected={m.id === mode}
            onClick={() => {
              setMode(m.id)
              if (m.id === 'month') loadMonths()
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form className="tlog-form" onSubmit={retrieve}>
        {mode === 'id' ? (
          <div className="tlog-fields">
            <label className="tlog-field">
              <span className="tlog-label">channel id</span>
              <input
                className="tlog-input"
                inputMode="numeric"
                placeholder="44578737"
                value={channelId}
                spellCheck="false"
                onChange={(e) => setChannelId(e.target.value)}
              />
            </label>
            <label className="tlog-field">
              <span className="tlog-label">subject user id</span>
              <input
                className="tlog-input"
                inputMode="numeric"
                placeholder="44578737"
                value={userId}
                spellCheck="false"
                onChange={(e) => setUserId(e.target.value)}
              />
            </label>
          </div>
        ) : mode === 'channel' ? (
          <div className="tlog-fields">
            <label className="tlog-field">
              <span className="tlog-label">channel</span>
              <input
                className="tlog-input"
                placeholder="jacksepticeye"
                value={channel}
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
                onChange={(e) => setChannel(e.target.value)}
              />
            </label>
            <label className="tlog-field">
              <span className="tlog-label">
                day <em>blank = latest stored</em>
              </span>
              <input
                className="tlog-input"
                type="date"
                value={day}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
          </div>
        ) : (
          <div className="tlog-fields">
            <label className="tlog-field">
              <span className="tlog-label">channel</span>
              <input
                className="tlog-input"
                placeholder="jacksepticeye"
                value={channel}
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
                onChange={(e) => {
                  setChannel(e.target.value)
                  setMonthState('idle')
                }}
              />
            </label>
            <label className="tlog-field">
              <span className="tlog-label">subject username</span>
              <input
                className="tlog-input"
                placeholder="jacksepticeye"
                value={user}
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
                onChange={(e) => {
                  setUser(e.target.value)
                  setMonthState('idle')
                }}
              />
            </label>
          </div>
        )}

        {mode === 'month' && (
          <div className="tlog-month">
            <select
              className="tlog-select"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={monthState !== 'ready'}
              aria-label="Archived month"
            >
              {monthState === 'loading' && <option>loading…</option>}
              {monthState === 'idle' && <option>enter channel + user, then load</option>}
              {monthState === 'empty' && <option>no archived months found</option>}
              {monthState === 'ready' &&
                months.map((l) => (
                  <option key={`${l.year}/${l.month}`} value={`${l.year}/${l.month}`}>
                    {l.year} · {MONTHS[Number(l.month)] || l.month}
                  </option>
                ))}
            </select>
            <button type="button" className="tlog-ghost" onClick={loadMonths}>
              load index
            </button>
          </div>
        )}

        <div className="tlog-controls">
          {mode !== 'random' && (
            <>
              <button
                type="button"
                className="tlog-toggle"
                aria-pressed={reverse}
                onClick={() => setReverse((v) => !v)}
              >
                {reverse ? '[x]' : '[ ]'} newest first
              </button>
              <label className="tlog-limit">
                limit
                <input
                  className="tlog-limit-input"
                  type="number"
                  min="1"
                  max="100000"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </label>
            </>
          )}
          <span className="tlog-note">// {activeMode.note}</span>

          <button type="submit" className="tlog-run" disabled={status === 'loading'}>
            <TerminalIcon icon={Search} label="" />
            {status === 'loading' ? 'accessing…' : 'retrieve'}
          </button>
        </div>
      </form>

      {status !== 'idle' && (
        <div className={`tlog-output${isFullscreen ? ' is-fullscreen' : ''}`} ref={outputRef}>
          <div className="tlog-status">
            <span className="tlog-subject">{label || '—'}</span>
            <span className="tlog-pill">{mode}</span>
            <span className="tlog-count">
              {status === 'loading' ? '…' : filtered.length.toLocaleString()} msgs
            </span>
            {span && status === 'done' && (
              <span className="tlog-span">
                {span.first.getTime() === span.last.getTime()
                  ? fmtDay(span.first)
                  : `${fmtDay(span.first)} → ${fmtDay(span.last)}`}
              </span>
            )}
            {status === 'done' && messages.length > 0 && (
              <span className="tlog-grep">
                <span aria-hidden="true">grep ›</span>
                <input
                  className="tlog-grep-input"
                  placeholder="filter…"
                  value={grep}
                  spellCheck="false"
                  onChange={(e) => setGrep(e.target.value)}
                />
              </span>
            )}
            <button
              type="button"
              className="tlog-fs"
              onClick={toggleFullscreen}
              aria-pressed={isFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'View logs fullscreen'}
            >
              <TerminalIcon icon={isFullscreen ? Minimize2 : Maximize2} label="" />
              {isFullscreen ? 'exit' : 'fullscreen'}
            </button>
          </div>

          <div className="tlog-feed" ref={feedRef} role="status" aria-live="polite">
            {status === 'loading' && <div className="tlog-empty">accessing archive…</div>}
            {status === 'error' && <div className="tlog-empty tlog-empty--err">{error}</div>}
            {status === 'done' && filtered.length === 0 && (
              <div className="tlog-empty">
                {messages.length === 0 ? 'the archive returned no messages.' : `nothing matched “${grep}”.`}
              </div>
            )}
            {status === 'done' &&
              visible.map((m, i) => (
                <LogLine
                  key={m.id || i}
                  message={m}
                  grep={grepTrimmed}
                  emoteMap={emoteMap}
                  badgeMap={badgeMap}
                />
              ))}
            {status === 'done' && hasMore && (
              <div className="tlog-more" ref={sentinelRef}>
                loading next {Math.min(PAGE_SIZE, total - visibleCount)} · {visibleCount.toLocaleString()}{' '}
                / {total.toLocaleString()}
              </div>
            )}
            {status === 'done' && total > 0 && !hasMore && total > PAGE_SIZE && (
              <div className="tlog-end">— end of {total.toLocaleString()} messages —</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
