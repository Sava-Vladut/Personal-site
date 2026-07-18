import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import {
  EMPTY_BADGES,
  EMPTY_EMOTES,
  badgesOf,
  fetchChannelBadges,
  loadThirdPartyEmotes,
  renderMessage,
} from '../../lib/twitchRender.jsx'

// Reads the open rustlog API hosted at logs.zonian.dev. CORS is wide-open so the
// retrieval happens entirely client-side — nothing proxies through the backend.
const API = 'https://logs.zonian.dev'

const MODES = [
  { id: 'latest', label: 'latest' },
  { id: 'channel', label: 'channel' },
  { id: 'random', label: 'random' },
  { id: 'month', label: 'by month' },
  { id: 'id', label: 'by id' },
]

const MONTHS = ['', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

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

// Keep the archive query compact and reveal older rows as the user scrolls up.
const LOG_LIMIT = 500
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

// `preset` (optional) = { channel, user, nonce } — pushed by the live Chat
// service when a chatter is clicked. It prefills the form in `latest` mode and
// auto-runs the retrieval; the nonce makes repeat clicks on the same user fire.
export function TwitchLogs({ preset = null, popout = false, accent = '' }) {
  const [mode, setMode] = useState('latest')
  const [channel, setChannel] = useState('')
  const [user, setUser] = useState('')
  const [channelId, setChannelId] = useState('')
  const [userId, setUserId] = useState('')
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
    const params = new URLSearchParams({ json: '1' })
    if (mode !== 'random') {
      params.set('limit', String(LOG_LIMIT))
      params.set('reverse', 'true')
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
  }, [mode, channelId, userId, channel, user, month, day])

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

  // Apply an incoming preset: adopt it during render (React's pattern for
  // resetting state on a changed input), then fire the retrieval from an effect
  // once the adopted values have committed — retrieve reads state via
  // buildTarget, so it must run on the render *after* the fields are set.
  const [seenPreset, setSeenPreset] = useState(null)
  if (preset !== seenPreset) {
    setSeenPreset(preset)
    if (preset && preset.channel && preset.user) {
      setMode('latest')
      setChannel(preset.channel)
      setUser(preset.user)
      setMonthState('idle')
    }
  }
  const firedPresetRef = useRef(null)
  useEffect(() => {
    const p = seenPreset
    if (!p || !p.channel || !p.user || firedPresetRef.current === p) return
    if (mode !== 'latest' || channel !== p.channel || user !== p.user) return
    firedPresetRef.current = p
    // One-shot kick-off of the same path a manual "retrieve" click takes; the
    // ref guard above means it can never cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    retrieve()
  }, [seenPreset, mode, channel, user, retrieve])

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

  // Progressive rendering: the API returns newest-first, but the viewport reads
  // chronologically from top to bottom. Reaching the top reveals older history.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef(null)
  const preservedBottomOffsetRef = useRef(null)

  // A new result set (or a grep change) produces a new `filtered` array — reset
  // back to the first page. Done during render (React's recommended pattern for
  // resetting state on a changed input) rather than in an effect.
  const [pageAnchor, setPageAnchor] = useState(filtered)
  if (pageAnchor !== filtered) {
    setPageAnchor(filtered)
    setVisibleCount(PAGE_SIZE)
  }

  // A fresh query opens at the newest message. This runs after the rows have
  // been laid out so scrollHeight reflects the new result set.
  useLayoutEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [filtered])

  const total = filtered.length
  const hasMore = visibleCount < total
  const visible = useMemo(() => filtered.slice(0, visibleCount).reverse(), [filtered, visibleCount])
  const grepTrimmed = grep.trim()

  // Prepending an older page must not move the line the reader was looking at.
  useLayoutEffect(() => {
    const root = feedRef.current
    const bottomOffset = preservedBottomOffsetRef.current
    if (!root || bottomOffset === null) return
    root.scrollTop = root.scrollHeight - bottomOffset
    preservedBottomOffsetRef.current = null
  }, [visibleCount])

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
          preservedBottomOffsetRef.current = root.scrollHeight - root.scrollTop
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, total))
        }
      },
      { root, rootMargin: '400px 0px' },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [hasMore, total])

  return (
    <div
      className={popout ? 'tlog-tool tlog-tool--popout' : 'tlog-tool'}
      style={accent ? { '--tlog-accent': accent } : undefined}
    >
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
        <div className="tlog-query">
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

          <button type="submit" className="tlog-run" disabled={status === 'loading'}>
            <TerminalIcon icon={Search} label="" />
            {status === 'loading' ? 'accessing…' : 'retrieve'}
          </button>
        </div>

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
            {status === 'done' && hasMore && (
              <div className="tlog-more" ref={sentinelRef}>
                scroll up for {Math.min(PAGE_SIZE, total - visibleCount)} older ·{' '}
                {visibleCount.toLocaleString()} / {total.toLocaleString()}
              </div>
            )}
            {status === 'done' && total > 0 && !hasMore && total > PAGE_SIZE && (
              <div className="tlog-end">— start of {total.toLocaleString()} messages —</div>
            )}
            {status === 'done' &&
              visible.map((m, i) => (
                <LogLine
                  key={m.id || `${m.timestamp || 'message'}:${m.username || ''}:${visible.length - 1 - i}`}
                  message={m}
                  grep={grepTrimmed}
                  emoteMap={emoteMap}
                  badgeMap={badgeMap}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
