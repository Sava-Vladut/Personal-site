import { useCallback, useEffect, useState } from 'react'
import { Clapperboard, ImageDown, MessageSquare, MessagesSquare, Network } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { HeicConverter } from './HeicConverter.jsx'
import { MediaConverter } from './MediaConverter.jsx'
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
}

// Live (in-browser) services render their own component, keyed by id.
const liveComponents = {
  heic: HeicConverter,
  twitchlogs: TwitchLogs,
  twitchchat: TwitchChat,
  miner: MinerStats,
}

const serviceModeLabels = {
  live: '● live',
  api: '↯ api',
  external: '↗ open',
}

export function ServicesSection() {
  const [activeId, setActiveId] = useState(services[0].id)
  const active = services.find((service) => service.id === activeId) ?? services[0]

  // Chat -> Logs hand-off: clicking a chatter stores the subject here and flips
  // the active tab; TwitchLogs picks the preset up and auto-runs the retrieval.
  // The nonce lets the same user be requested twice in a row.
  const [logsPreset, setLogsPreset] = useState(null)
  const openLogs = useCallback((subject) => {
    setLogsPreset({ ...subject, nonce: Date.now() })
    setActiveId('twitchlogs')
  }, [])

  // A popped-out chat window (TwitchChatPopout) broadcasts chatter clicks here
  // so the main tab can jump to the Logs service for them.
  useEffect(() => {
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
  }, [openLogs])

  const liveProps = {
    twitchlogs: { preset: logsPreset },
    twitchchat: { onOpenLogs: openLogs },
  }

  return (
    <section className="section services" id="services">
      <div className="service-tabs" role="tablist" aria-label="Services">
        {services.map((service) => (
          <button
            type="button"
            role="tab"
            key={service.id}
            aria-selected={service.id === activeId}
            aria-current={service.id === activeId ? 'true' : undefined}
            className="service-tab"
            onClick={() => setActiveId(service.id)}
            title={`Open ${service.title}`}
          >
            <span>{service.index}</span>
            <TerminalIcon icon={serviceIcons[service.id]} label="" />
            {service.slug}
            <em className={`service-mode service-mode--${service.mode}`}>
              {serviceModeLabels[service.mode] ?? service.mode}
            </em>
          </button>
        ))}
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
              <TerminalIcon icon={Network} label="" />
              Launch {active.title}
              <span aria-hidden="true">↗</span>
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
