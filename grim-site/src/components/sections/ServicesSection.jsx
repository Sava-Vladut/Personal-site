import { useState } from 'react'
import { Clapperboard, ImageDown, SquareTerminal } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { HeicConverter } from './HeicConverter.jsx'
import { MediaConverter } from './MediaConverter.jsx'
import { services } from '../../data/services.js'

const serviceIcons = {
  heic: ImageDown,
  tiktok: Clapperboard,
}

export function ServicesSection() {
  const [activeId, setActiveId] = useState(services[0].id)
  const active = services.find((service) => service.id === activeId) ?? services[0]

  return (
    <section className="section services" id="services">
      <p className="service-intro">
        <TerminalIcon icon={SquareTerminal} label="" />
        two converters — <span className="live-dot" aria-hidden="true">●</span> 01 runs in your
        browser · 02 streams from the local api.
      </p>

      <div className="service-tabs" role="tablist" aria-label="Converters">
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
              {service.mode === 'live' ? '● live' : '↯ api'}
            </em>
          </button>
        ))}
      </div>

      <div className="service-pane" data-mode={active.mode} key={active.id}>
        <header className="service-pane-head">
          <p>{active.blurb}</p>
        </header>

        {active.mode === 'live' ? <HeicConverter /> : <MediaConverter service={active} />}
      </div>
    </section>
  )
}
