import { useCallback, useEffect, useMemo, useState } from 'react'
import { Blocks, Clapperboard, ImageDown, MessageSquare, MessagesSquare, Network, Plane } from 'lucide-react'
import { useAuth } from '../../auth/context.js'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { HeicConverter } from './HeicConverter.jsx'
import { MediaConverter } from './MediaConverter.jsx'
import { MinecraftServer } from './MinecraftServer.jsx'
import { MinerStats } from './MinerStats.jsx'
import { TwitchChat } from './TwitchChat.jsx'
import { TwitchLogs } from './TwitchLogs.jsx'
import { services } from '../../data/services.js'

const serviceIcons = {
  heic: ImageDown,
  tiktok: Clapperboard,
  twitchlogs: MessageSquare,
  twitchchat: MessagesSquare,
  miner: Network,
  flightmanager: Plane,
  minecraft: Blocks,
}

// Live (in-browser) services render their own component, keyed by id.
const liveComponents = {
  heic: HeicConverter,
  twitchlogs: TwitchLogs,
  twitchchat: TwitchChat,
  miner: MinerStats,
  minecraft: MinecraftServer,
}

const serviceModeLabels = {
  live: 'live',
  api: 'api',
  external: 'open',
}

function serviceOptionLabel(service) {
  return `${service.index} - ${service.title.replace(/\u2192/g, '-')} - ${serviceModeLabels[service.mode] ?? service.mode}`
}

export function ServicesSection({ activeServiceId, onSelectService }) {
  const { isLoggedIn } = useAuth()
  const visibleServices = useMemo(
    () => services.filter((service) => isLoggedIn || service.public),
    [isLoggedIn],
  )
  const active = visibleServices.find((service) => service.id === activeServiceId) ?? visibleServices[0]

  const selectService = useCallback((serviceId) => {
    onSelectService?.(serviceId)
  }, [onSelectService])

  // Chat -> Logs hand-off: clicking a chatter stores the subject here and flips
  // the active tab; TwitchLogs picks the preset up and auto-runs the retrieval.
  // The nonce lets the same user be requested twice in a row.
  const [logsPreset, setLogsPreset] = useState(null)
  const openLogs = useCallback((subject) => {
    setLogsPreset({ ...subject, nonce: Date.now() })
    selectService('twitchlogs')
  }, [selectService])

  // A popped-out chat window (TwitchChatPopout) broadcasts chatter clicks here
  // so the main tab can jump to the Logs service for them.
  useEffect(() => {
    if (!isLoggedIn) return undefined

    let bc
    try {
      bc = new BroadcastChannel('grim-tchat')
    } catch {
      return undefined
    }
    bc.onmessage = (event) => {
      const data = event.data
      if (data && data.type === 'open-logs' && data.channel && data.user) openLogs(data)
    }
    return () => bc.close()
  }, [isLoggedIn, openLogs])

  const liveProps = {
    twitchlogs: { preset: logsPreset },
    twitchchat: { onOpenLogs: openLogs },
  }

  return (
    <section className="section services" id="services" data-service={active.id}>
      <div className="service-picker">
        <label className="service-picker-label" htmlFor="service-picker">
          Services
        </label>
        <select
          className="service-picker-select"
          id="service-picker"
          value={active.id}
          onChange={(event) => selectService(event.target.value)}
        >
          {visibleServices.map((service) => (
            <option key={service.id} value={service.id}>
              {serviceOptionLabel(service)}
            </option>
          ))}
        </select>
        <span className="service-picker-arrow" aria-hidden="true">↓</span>
      </div>

      <div className="service-pane" data-mode={active.mode} key={active.id}>
        {active.mode === 'external' ? (
          <div className="service-external">
            <p className="service-external-url">{active.href}</p>
            <a
              className="service-launch"
              href={active.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <TerminalIcon icon={serviceIcons[active.id] ?? Plane} label="" />
              Launch {active.title}
            </a>
          </div>
        ) : active.mode === 'live' ? (
          (() => {
            const Live = liveComponents[active.id]
            return Live ? <Live {...(liveProps[active.id] || {})} /> : null
          })()
        ) : (
          <MediaConverter service={active} />
        )}
      </div>
    </section>
  )
}
