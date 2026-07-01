import { useEffect, useState } from 'react'
import { CircleAlert, ExternalLink, RadioTower } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { formatPoints, timeAgo } from '../../utils/format.js'

const ENDPOINT = '/api/miner/streamers'
const DASHBOARD_URL = 'http://grimnetwork.srvp.ro:5000/'
const POLL_MS = 30_000
const BAR = 16 // width, in cells, of the points telemetry bar

// Solid/hollow blocks make a points-share bar without any chart dependency.
function bar(points, max) {
  const filled = max > 0 ? Math.max(1, Math.round((points / max) * BAR)) : 0
  return { fill: '█'.repeat(filled), track: '░'.repeat(BAR - filled) }
}

export function MinerStats() {
  const [streamers, setStreamers] = useState([])
  const [online, setOnline] = useState(null) // null = unknown, true/false from node
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [updatedAt, setUpdatedAt] = useState(null)

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!alive) return
        setStreamers(Array.isArray(data.streamers) ? data.streamers : [])
        setOnline(data.online ?? null)
        setUpdatedAt(Date.now())
        setStatus('ready')
      } catch {
        if (!alive) return
        // Keep whatever we last had on screen; only flip to error on a cold start.
        setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'))
        setOnline(false)
      }
    }

    load()
    const id = window.setInterval(load, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const max = streamers.length ? streamers[0].points : 0
  const total = streamers.reduce((sum, s) => sum + (s.points || 0), 0)
  const live = online === true

  return (
    <div className="miner-tool">
      <div className="miner-head">
        <span className={`miner-state miner-state--${live ? 'live' : online === false ? 'cached' : 'wait'}`}>
          <TerminalIcon icon={RadioTower} label="" />
          {live ? 'live' : online === false ? 'last seen' : 'sync'}
          <span className="miner-pulse" aria-hidden="true">
            ●
          </span>
        </span>
        <span className="miner-meta">
          {streamers.length} channel{streamers.length === 1 ? '' : 's'} · {formatPoints(total)} pts
        </span>
      </div>

      {status === 'error' ? (
        <p className="miner-error" role="alert">
          <TerminalIcon icon={CircleAlert} label="" />
          miner unreachable — stats unavailable
        </p>
      ) : status === 'loading' ? (
        <p className="miner-loading">
          loading<span className="miner-cursor" aria-hidden="true">█</span>
        </p>
      ) : (
        <ol className="miner-list" aria-label="Watched channels by channel points">
          {streamers.map((s, i) => {
            const b = bar(s.points, max)
            return (
            <li className="miner-row" key={s.name}>
              <span className="miner-rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="miner-name">{s.name}</span>
              <span className="miner-bar" aria-hidden="true">
                <span className="miner-bar-fill">{b.fill}</span>
                <span className="miner-bar-track">{b.track}</span>
              </span>
              <span className="miner-points">{formatPoints(s.points)}</span>
              <span className="miner-seen" title="last activity">
                {timeAgo(s.lastActivity)}
              </span>
            </li>
            )
          })}
        </ol>
      )}

      <div className="miner-foot">
        <span className="miner-stamp">
          {updatedAt ? `updated ${timeAgo(updatedAt)} ago` : 'channel-points miner'}
        </span>
        <a className="miner-launch" href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
          full dashboard
          <TerminalIcon icon={ExternalLink} label="" />
        </a>
      </div>
    </div>
  )
}
