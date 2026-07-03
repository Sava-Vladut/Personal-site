import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Plug, PlugZap } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import {
  EMPTY_BADGES,
  EMPTY_EMOTES,
  EMPTY_USER_BADGES,
  badgesOf,
  fetchChannelBadges,
  fetchSevenTvUserBadge,
  loadThirdPartyEmotes,
  renderMessage,
} from '../../lib/twitchRender.jsx'

// Live Twitch chat over the public IRC websocket gateway. Reading chat needs no
// auth — an anonymous `justinfan` nick can join any channel — so the connection
// is made entirely from the browser; nothing proxies through the backend.
const IRC_WS = 'wss://irc-ws.chat.twitch.tv:443'

// Keep at most this many lines mounted; older ones fall off the top.
const MAX_LINES = 300
// Messages are buffered and appended in batches so a busy chat doesn't force a
// React render per line.
const FLUSH_MS = 120

// Twitch's default name palette, used when a chatter never picked a color (the
// `color` tag comes back empty). Hashing the login keeps the pick stable.
const NAME_COLORS = [
  '#ff0000', '#0000ff', '#008000', '#b22222', '#ff7f50', '#9acd32', '#ff4500',
  '#2e8b57', '#daa520', '#d2691e', '#5f9ea0', '#1e90ff', '#ff69b4', '#8a2be2', '#00ff7f',
]
const fallbackColor = (name) => {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return NAME_COLORS[h % NAME_COLORS.length]
}

// Minimal IRCv3 line parser: @tags :prefix COMMAND params :trailing
function parseIrcLine(line) {
  let rest = line
  const tags = {}
  if (rest.startsWith('@')) {
    const sp = rest.indexOf(' ')
    for (const kv of rest.slice(1, sp).split(';')) {
      const eq = kv.indexOf('=')
      const key = eq === -1 ? kv : kv.slice(0, eq)
      const val = eq === -1 ? '' : kv.slice(eq + 1)
      // IRCv3 tag escaping: \: -> ; \s -> space \\ -> \ \r \n
      tags[key] = val.replace(/\\(.?)/g, (_, c) =>
        c === ':' ? ';' : c === 's' ? ' ' : c === 'n' ? '\n' : c === 'r' ? '\r' : c,
      )
    }
    rest = rest.slice(sp + 1)
  }
  let prefix = ''
  if (rest.startsWith(':')) {
    const sp = rest.indexOf(' ')
    prefix = rest.slice(1, sp)
    rest = rest.slice(sp + 1)
  }
  const sp = rest.indexOf(' ')
  const command = sp === -1 ? rest : rest.slice(0, sp)
  rest = sp === -1 ? '' : rest.slice(sp + 1)
  const params = []
  while (rest) {
    if (rest.startsWith(':')) {
      params.push(rest.slice(1))
      break
    }
    const s = rest.indexOf(' ')
    if (s === -1) {
      params.push(rest)
      break
    }
    params.push(rest.slice(0, s))
    rest = rest.slice(s + 1)
  }
  return { tags, prefix, command, params }
}

// One chat row. Memoized so a batch append never re-renders lines already on
// screen; only emote/badge maps arriving re-touches everything.
const ChatLine = memo(function ChatLine({ message, emoteMap, badgeMap, userBadgeMap, onUser }) {
  if (message.system) {
    return (
      <div className="tchat-line is-system">
        <span className="tchat-system">{message.text}</span>
      </div>
    )
  }
  const badges = badgesOf(message.tags.badges, badgeMap)
  const sevenBadges = userBadgeMap.get(message.tags['user-id']) || []
  const { nodes, action } = renderMessage(message, '', emoteMap)
  const color = message.tags.color || fallbackColor(message.username)
  return (
    <div className="tchat-line">
      <button
        type="button"
        className="tchat-user"
        onClick={() => onUser(message.username)}
        title={`Pull ${message.username}'s logs`}
      >
        {badges.map((b) =>
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
        {sevenBadges.map((b, i) => (
          <img
            key={`7tv${i}`}
            className="tlog-badge-img"
            src={b.src}
            srcSet={`${b.src} 1x, ${b.src2} 2x`}
            alt={b.title}
            title={b.title}
            loading="lazy"
          />
        ))}
        <span className="tchat-name" style={{ color }}>
          @{message.displayName}
        </span>
      </button>
      <span className={`tchat-msg${action ? ' is-action' : ''}`}>{nodes}</span>
    </div>
  )
})

// `initialChannel` + `popout` back the #/chatpop/<channel> standalone window:
// the channel comes from the URL, the join fires automatically, and the tool
// stretches to fill the whole popup viewport.
export function TwitchChat({ onOpenLogs, initialChannel = '', popout = false }) {
  const [channel, setChannel] = useState(initialChannel)
  const [joined, setJoined] = useState('')
  const [status, setStatus] = useState('idle') // idle | connecting | live | closed | error
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [emoteMap, setEmoteMap] = useState(EMPTY_EMOTES)
  const [badgeMap, setBadgeMap] = useState(EMPTY_BADGES)
  const [userBadgeMap, setUserBadgeMap] = useState(EMPTY_USER_BADGES)
  const [paused, setPaused] = useState(false)

  const wsRef = useRef(null)
  const pendingRef = useRef([])
  const flushTimerRef = useRef(null)
  const seqRef = useRef(0)
  const feedRef = useRef(null)
  const atBottomRef = useRef(true)
  const sevenSeenRef = useRef(new Set())

  // Look up a chatter's 7TV badge the first time they speak. The network layer
  // caches per user id; the Set stops repeat setState churn on cache hits.
  const requestSevenBadge = useCallback((userId) => {
    if (!userId || sevenSeenRef.current.has(userId)) return
    sevenSeenRef.current.add(userId)
    fetchSevenTvUserBadge(userId)
      .then((badge) => {
        if (!badge) return
        setUserBadgeMap((prev) => {
          const next = new Map(prev)
          next.set(userId, [badge])
          return next
        })
      })
      .catch(() => {})
  }, [])

  const flush = useCallback(() => {
    flushTimerRef.current = null
    const batch = pendingRef.current
    if (!batch.length) return
    pendingRef.current = []
    setMessages((prev) => {
      const next = prev.length ? [...prev, ...batch] : batch
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
    })
  }, [])

  const queue = useCallback(
    (msg) => {
      pendingRef.current.push(msg)
      if (!flushTimerRef.current) flushTimerRef.current = setTimeout(flush, FLUSH_MS)
    },
    [flush],
  )

  const disconnect = useCallback(() => {
    const ws = wsRef.current
    wsRef.current = null
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      try {
        ws.close()
      } catch {
        /* already closed */
      }
    }
  }, [])

  const connect = useCallback(
    (event) => {
      if (event) event.preventDefault()
      const ch = channel.trim().toLowerCase().replace(/^[#@]/, '')
      if (!ch) {
        setStatus('error')
        setError('Enter a channel name.')
        return
      }
      disconnect()
      pendingRef.current = []
      setMessages([])
      setEmoteMap(EMPTY_EMOTES)
      setBadgeMap(EMPTY_BADGES)
      setJoined(ch)
      setStatus('connecting')
      setError('')
      setPaused(false)
      atBottomRef.current = true

      const ws = new WebSocket(IRC_WS)
      wsRef.current = ws

      const handleLine = (line) => {
        const { tags, prefix, command, params } = parseIrcLine(line)
        if (command === 'PING') {
          ws.send(`PONG :${params[0] || 'tmi.twitch.tv'}`)
          return
        }
        if (command === 'ROOMSTATE') {
          setStatus('live')
          const roomId = tags['room-id']
          if (roomId) {
            loadThirdPartyEmotes(roomId)
              .then((map) => setEmoteMap(map))
              .catch(() => {})
            fetchChannelBadges(roomId)
              .then((map) => setBadgeMap(map))
              .catch(() => {})
          }
          return
        }
        if (command === 'PRIVMSG') {
          const login = prefix.slice(0, prefix.indexOf('!')) || 'unknown'
          seqRef.current += 1
          requestSevenBadge(tags['user-id'])
          queue({
            id: tags.id || `m${seqRef.current}`,
            username: login,
            displayName: tags['display-name'] || login,
            text: params[1] || '',
            tags,
          })
          return
        }
        if (command === 'USERNOTICE') {
          // Subs / raids / announcements: show the system text, then any
          // attached user message as a normal line.
          const sys = tags['system-msg']
          seqRef.current += 1
          if (sys) queue({ id: `s${seqRef.current}`, system: true, text: sys, tags: {} })
          if (params[1]) {
            const login = tags.login || 'unknown'
            requestSevenBadge(tags['user-id'])
            queue({
              id: tags.id || `u${seqRef.current}`,
              username: login,
              displayName: tags['display-name'] || login,
              text: params[1],
              tags,
            })
          }
          return
        }
        if (command === 'NOTICE') {
          // Join failures (suspended channel etc.) come back as NOTICEs.
          const msgId = tags['msg-id'] || ''
          if (msgId.startsWith('msg_') || /suspended|banned/i.test(params[1] || '')) {
            setStatus('error')
            setError(params[1] || 'The channel rejected the join.')
          }
          return
        }
        if (command === 'RECONNECT') {
          setStatus('closed')
          setError('Twitch asked clients to reconnect — hit connect again.')
          disconnect()
        }
      }

      ws.onopen = () => {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands')
        ws.send(`NICK justinfan${10000 + Math.floor(Math.random() * 80000)}`)
        ws.send(`JOIN #${ch}`)
      }
      ws.onmessage = (ev) => {
        for (const line of String(ev.data).split('\r\n')) if (line) handleLine(line)
      }
      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null
          setStatus('closed')
        }
      }
      ws.onerror = () => {
        if (wsRef.current === ws) {
          setStatus('error')
          setError('Connection to the Twitch chat gateway failed.')
        }
      }
    },
    [channel, disconnect, queue, requestSevenBadge],
  )

  const stop = useCallback(() => {
    disconnect()
    setStatus('closed')
  }, [disconnect])

  // Detach the joined channel into its own small window. The popup loads the
  // same bundle on the #/chatpop/<channel> route and joins on its own socket,
  // so it outlives whatever happens in this tab.
  const popOut = useCallback(() => {
    if (!joined) return
    window.open(
      `#/chatpop/${encodeURIComponent(joined)}`,
      `grim-chat-${joined}`,
      'popup=yes,width=430,height=760',
    )
  }, [joined])

  // Popout window: the URL already names the channel — join it immediately.
  const autoJoinedRef = useRef(false)
  useEffect(() => {
    if (popout && initialChannel && !autoJoinedRef.current) {
      autoJoinedRef.current = true
      connect()
    }
  }, [popout, initialChannel, connect])

  useEffect(() => {
    if (popout && joined) document.title = `#${joined} · chat`
  }, [popout, joined])

  // Kill the socket + any pending flush when the tab unmounts.
  useEffect(
    () => () => {
      disconnect()
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    },
    [disconnect],
  )

  // Stick to the bottom unless the user scrolled up to read back.
  useEffect(() => {
    const feed = feedRef.current
    if (feed && atBottomRef.current) feed.scrollTop = feed.scrollHeight
  }, [messages])

  const onScroll = useCallback(() => {
    const feed = feedRef.current
    if (!feed) return
    const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 48
    atBottomRef.current = atBottom
    setPaused(!atBottom)
  }, [])

  const resume = useCallback(() => {
    atBottomRef.current = true
    setPaused(false)
    const feed = feedRef.current
    if (feed) feed.scrollTop = feed.scrollHeight
  }, [])

  const openLogs = useCallback(
    (username) => {
      if (onOpenLogs && joined) onOpenLogs({ channel: joined, user: username })
    },
    [onOpenLogs, joined],
  )

  const connected = status === 'connecting' || status === 'live'

  return (
    <div className={popout ? 'tchat-tool tchat-tool--popout' : 'tchat-tool'}>
      {!popout && (
        <form className="tchat-form" onSubmit={connect}>
          <label className="tlog-field tchat-channel">
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
          <button type="submit" className="tlog-run tchat-connect" disabled={status === 'connecting'}>
            <TerminalIcon icon={PlugZap} label="" />
            {status === 'connecting' ? 'joining…' : connected ? 'rejoin' : 'connect'}
          </button>
          {connected && (
            <button type="button" className="tlog-ghost" onClick={stop}>
              <TerminalIcon icon={Plug} label="" />
              disconnect
            </button>
          )}
          {status === 'live' && (
            <button type="button" className="tlog-ghost" onClick={popOut} title="Open this chat in its own window">
              <TerminalIcon icon={ExternalLink} label="" />
              pop out
            </button>
          )}
        </form>
      )}

      {status !== 'idle' && (
        <div className="tlog-output tchat-output">
          <div className="tlog-status">
            <span className="tlog-subject">#{joined || '—'}</span>
            <span className={`tlog-pill tchat-pill--${status}`}>
              {status === 'live' ? '● live' : status}
            </span>
            <span className="tlog-count">{messages.length.toLocaleString()} msgs</span>
            <span className="tchat-hint">click a chatter to pull their logs</span>
          </div>

          <div className="tchat-feedwrap">
            <div className="tchat-feed" ref={feedRef} onScroll={onScroll}>
              {status === 'connecting' && messages.length === 0 && (
                <div className="tlog-empty">joining #{joined}…</div>
              )}
              {status === 'error' && <div className="tlog-empty tlog-empty--err">{error}</div>}
              {status === 'closed' && (
                <div className="tlog-empty">{error || 'disconnected.'}</div>
              )}
              {status === 'live' && messages.length === 0 && (
                <div className="tlog-empty">connected — waiting for chat…</div>
              )}
              {messages.map((m) => (
                <ChatLine
                  key={m.id}
                  message={m}
                  emoteMap={emoteMap}
                  badgeMap={badgeMap}
                  userBadgeMap={userBadgeMap}
                  onUser={openLogs}
                />
              ))}
            </div>
            {paused && (
              <button type="button" className="tchat-resume" onClick={resume}>
                chat paused — resume ↓
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
