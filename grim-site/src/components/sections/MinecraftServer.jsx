import { useEffect, useMemo, useState } from 'react'
import { Box, CircleAlert, ExternalLink, Map, Server, Users } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'

const ENDPOINT = '/api/minecraft/status'
const FALLBACK_ENDPOINT = 'https://api.mcstatus.io/v2/status/java/grimnetwork.srvp.ro'
const MAP_EMBED_URL = '/minecraft-map/'
const MAP_URL = 'http://grimnetwork.srvp.ro:8100/'
const POLL_MS = 30_000
const CAPACITY_CELLS = 20

function capacityBar(online, max) {
  if (!max) return '░'.repeat(CAPACITY_CELLS)
  const filled = Math.min(CAPACITY_CELLS, Math.round((online / max) * CAPACITY_CELLS))
  return `${'█'.repeat(filled)}${'░'.repeat(CAPACITY_CELLS - filled)}`
}

function normalizeFallback(raw) {
  return {
    online: Boolean(raw.online),
    playersOnline: raw.players?.online ?? 0,
    playersMax: raw.players?.max ?? 0,
    players: Array.isArray(raw.players?.list)
      ? raw.players.list.map((player) => player.name_clean || player.name_raw).filter(Boolean)
      : [],
    version: raw.version?.name_clean || raw.version?.name_raw || 'Unknown',
    stale: false,
  }
}

export function MinecraftServer() {
  const [server, setServer] = useState(null)
  const [status, setStatus] = useState('loading')
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        let response
        try {
          response = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
        } catch {
          response = null
        }
        let data
        if (response?.ok) {
          data = await response.json()
        } else {
          response = await fetch(FALLBACK_ENDPOINT, { headers: { Accept: 'application/json' } })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          data = normalizeFallback(await response.json())
        }
        if (!alive) return
        setServer(data)
        setStatus('ready')
      } catch {
        if (!alive) return
        setStatus((current) => (current === 'ready' ? current : 'error'))
      }
    }

    load()
    const interval = window.setInterval(load, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(interval)
    }
  }, [])

  const online = server?.playersOnline ?? 0
  const max = server?.playersMax ?? 0
  const capacity = useMemo(() => capacityBar(online, max), [online, max])
  const live = server?.online === true && !server?.stale

  return (
    <div className="minecraft-tool">
      <div className="minecraft-hud">
        <div className="minecraft-hero-stat" aria-live="polite">
          <span className={`minecraft-signal minecraft-signal--${live ? 'online' : 'offline'}`}>
            <span aria-hidden="true">●</span>
            {server?.stale ? 'last known' : live ? 'server online' : 'server offline'}
          </span>
          <strong>{status === 'loading' ? '—' : online}</strong>
          <span className="minecraft-hero-label">
            player{online === 1 ? '' : 's'} online <em>/ {max || '—'}</em>
          </span>
          <span className="minecraft-capacity" aria-label={`${online} of ${max} player slots filled`}>
            {capacity}
          </span>
        </div>

        <div className="minecraft-facts">
          <span><TerminalIcon icon={Server} label="" />grimnetwork.srvp.ro</span>
          <span><TerminalIcon icon={Box} label="" />{server?.version || 'checking version'}</span>
          <span><TerminalIcon icon={Users} label="" />{server?.players?.length ? server.players.join(', ') : 'no players in world'}</span>
          {status === 'error' && (
            <span className="minecraft-error" role="alert">
              <TerminalIcon icon={CircleAlert} label="" />stats temporarily unavailable
            </span>
          )}
        </div>
      </div>

      <div className={`minecraft-map ${mapLoaded ? 'is-loaded' : ''}`}>
        <div className="minecraft-map-head">
          <span><TerminalIcon icon={Map} label="" />live world map</span>
          <a href={MAP_URL} target="_blank" rel="noopener noreferrer">
            open full map <TerminalIcon icon={ExternalLink} label="" />
          </a>
        </div>
        {!mapLoaded && <span className="minecraft-map-loading">rendering world…</span>}
        <iframe
          src={MAP_EMBED_URL}
          title="Grim Network Minecraft live world map"
          loading="eager"
          onLoad={() => setMapLoaded(true)}
          referrerPolicy="no-referrer"
        />
        <span className="minecraft-corner minecraft-corner--tl" aria-hidden="true">+</span>
        <span className="minecraft-corner minecraft-corner--br" aria-hidden="true">+</span>
      </div>
    </div>
  )
}
