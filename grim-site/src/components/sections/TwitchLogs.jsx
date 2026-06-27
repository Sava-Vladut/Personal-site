import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dices, Search } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'

// Reads the open rustlog API hosted at logs.zonian.dev. CORS is wide-open so the
// retrieval happens entirely client-side — nothing proxies through the backend.
const API = 'https://logs.zonian.dev'
const emoteUrl = (id) => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0`

// 7TV emotes are plain words in the message text (not in Twitch's emote tag), so
// they're resolved per-channel from the 7TV API and matched by exact word.
const SEVENTV = 'https://7tv.io/v3'
const seventvUrl = (id) => `https://cdn.7tv.app/emote/${id}/1x.webp`

const sevenSetToPairs = (emotes) => (emotes || []).map((e) => [e.name, e.id])

let globalEmotesPromise = null
const fetchGlobalEmotes = () => {
  if (!globalEmotesPromise) {
    globalEmotesPromise = fetch(`${SEVENTV}/emote-sets/global`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => sevenSetToPairs(j && j.emotes))
      .catch(() => {
        globalEmotesPromise = null
        return []
      })
  }
  return globalEmotesPromise
}

const channelEmotesCache = new Map() // twitch channel id -> Promise<[name, id][]>
const fetchChannelEmotes = (channelTwitchId) => {
  if (!channelTwitchId) return Promise.resolve([])
  if (!channelEmotesCache.has(channelTwitchId)) {
    const promise = fetch(`${SEVENTV}/users/twitch/${channelTwitchId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => sevenSetToPairs(j && j.emote_set && j.emote_set.emotes))
      .catch(() => [])
    channelEmotesCache.set(channelTwitchId, promise)
  }
  return channelEmotesCache.get(channelTwitchId)
}

// Build a name -> emote-id map for a channel; channel emotes override globals.
async function loadSeventvEmotes(channelTwitchId) {
  const [globals, channel] = await Promise.all([
    fetchGlobalEmotes(),
    fetchChannelEmotes(channelTwitchId),
  ])
  return new Map([...globals, ...channel])
}

const EMPTY_EMOTES = new Map()

const MODES = [
  { id: 'latest', label: 'latest', note: 'newest stored month for this subject' },
  { id: 'random', label: 'random', note: 'one random line — re-run for another' },
  { id: 'month', label: 'by month', note: 'pick an exact archived YYYY / MM' },
  { id: 'id', label: 'by id', note: 'bypass name lookup with raw numeric ids' },
]

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

// A handful of known-indexed channels used purely as autocomplete hints and for
// the "random subject" button. The full /channels index is ~265k entries (11 MB),
// so we deliberately do NOT download it — you just type the channel you want.
const EXAMPLE_CHANNELS = [
  'jacksepticeye',
  'martincitopants',
  'alveussanctuary',
  'hbomberguy',
  'darkosto',
  'codingtrainchoochoo',
  'thebacklogs',
  'bringusstudios',
]

const badgesOf = (tagStr) =>
  (tagStr ? tagStr.split(',') : [])
    .map((b) => BADGE_LABELS[b.split('/')[0]])
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

// A run of plain text (no Twitch emotes): swap whole words that are 7TV emotes
// for images, and highlight grep matches in whatever text remains.
function renderTextRun(text, grep, emoteMap, keyBase) {
  if (!emoteMap || emoteMap.size === 0) return highlight(text, grep, keyBase)
  // Split on whitespace but keep the separators so spacing is preserved.
  const tokens = text.split(/(\s+)/)
  const out = []
  tokens.forEach((tok, idx) => {
    const id = tok && emoteMap.get(tok)
    if (id) {
      out.push(
        <img
          key={`${keyBase}s${idx}`}
          className="tlog-emote tlog-emote--7tv"
          src={seventvUrl(id)}
          alt={tok}
          title={`${tok} · 7TV`}
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
// skipped on every subsequent scroll-load. Only changes to grep/emoteMap (which
// affect every visible line) trigger a re-render.
const LogLine = memo(function LogLine({ message, grep, emoteMap }) {
  const date = new Date(message.timestamp)
  const name = message.displayName || message.username || 'unknown'
  const tags = badgesOf(message.tags && message.tags.badges)
  const { nodes, action } = renderMessage(message, grep, emoteMap)
  return (
    <div className="tlog-line">
      <span className="tlog-ts" title={date.toString()}>
        {fmtStamp(date)}
      </span>
      <span className="tlog-who">
        {tags.map((t) => (
          <span className="tlog-badge" key={t}>
            {t}
          </span>
        ))}
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

  const [status, setStatus] = useState('idle') // idle | loading | error | done
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [emoteMap, setEmoteMap] = useState(EMPTY_EMOTES)
  const [label, setLabel] = useState('')
  const feedRef = useRef(null)

  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[0]

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
  }, [mode, limit, reverse, channelId, userId, channel, user, month])

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

        // Resolve 7TV emotes for this channel and re-render once they arrive.
        // room-id is on every message; fall back to the entered channel id.
        const roomId =
          (mode === 'id' && channelId.trim()) || (msgs[0] && msgs[0].tags && msgs[0].tags['room-id'])
        if (roomId) {
          loadSeventvEmotes(roomId)
            .then((map) => setEmoteMap(map))
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

  const randomSubject = useCallback(() => {
    const pick = EXAMPLE_CHANNELS[Math.floor(Math.random() * EXAMPLE_CHANNELS.length)]
    setMode('latest')
    setChannel(pick)
    setUser(pick)
  }, [])

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
        ) : (
          <div className="tlog-fields">
            <label className="tlog-field">
              <span className="tlog-label">
                channel <em>type any indexed channel</em>
              </span>
              <input
                className="tlog-input"
                list="tlog-channels"
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
              <datalist id="tlog-channels">
                {EXAMPLE_CHANNELS.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
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
          <button type="button" className="tlog-ghost tlog-shuffle" onClick={randomSubject}>
            <TerminalIcon icon={Dices} label="" />
            random subject
          </button>
        </div>
      </form>

      {status !== 'idle' && (
        <div className="tlog-output">
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
                <LogLine key={m.id || i} message={m} grep={grepTrimmed} emoteMap={emoteMap} />
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
