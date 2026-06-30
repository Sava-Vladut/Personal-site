import { useState } from 'react'
import { Clapperboard, ImageDown, MessageSquare, Network, SquareTerminal } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { HeicConverter } from './HeicConverter.jsx'
import { MediaConverter } from './MediaConverter.jsx'
import { MinerStats } from './MinerStats.jsx'
import { TwitchLogs } from './TwitchLogs.jsx'
import { services } from '../../data/services.js'

const serviceIcons = {
  heic: ImageDown,
  tiktok: Clapperboard,
  twitchlogs: MessageSquare,
  miner: Network,
}

// Live (in-browser) services render their own component, keyed by id.
const liveComponents = {
  heic: HeicConverter,
  twitchlogs: TwitchLogs,
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

  return (
    <section className="section services" id="services">
      <p className="service-intro">
        <TerminalIcon icon={SquareTerminal} label="" />
        converters, a twitch log reader + a live miner — <span className="live-dot" aria-hidden="true">●</span>{' '}
        01 / 03 run in your browser · 02 streams from the local api · 04 reads live miner telemetry.
      </p>

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
        <header className="service-pane-head">
          <p>{active.blurb}</p>
        </header>

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
            return Live ? <Live /> : null
          })()
        ) : (
          <MediaConverter service={active} />
        )}
      </div>
    </section>
  )
}
