import { useEffect, useState } from 'react'
import { Clapperboard, ImageDown, Music2, Network, SquareTerminal } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { SectionTitle } from '../common/SectionTitle.jsx'
import { HeicConverter } from './HeicConverter.jsx'
import { MediaConverter } from './MediaConverter.jsx'
import { services } from '../../data/services.js'
import { isKeyboardCommand, isTypingTarget } from '../../utils/keyboard.js'

const serviceIcons = {
  heic: ImageDown,
  youtube: Music2,
  tiktok: Clapperboard,
}

export function ServicesSection() {
  const [activeId, setActiveId] = useState(services[0].id)
  const active = services.find((service) => service.id === activeId) ?? services[0]

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target) || !isKeyboardCommand(event)) return
      const slot = Number.parseInt(event.key, 10)
      if (slot >= 1 && slot <= services.length) {
        event.preventDefault()
        setActiveId(services[slot - 1].id)
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [])

  return (
    <section className="section services" id="services">
      <SectionTitle>Services</SectionTitle>
      <p className="service-intro">
        <TerminalIcon icon={SquareTerminal} label="" />
        three converters — <span className="live-dot" aria-hidden="true">●</span> 01 runs in your
        browser · 02—03 stream from the local api. press 1—3 to switch.
      </p>

      <div className="service-tabs" role="tablist" aria-label="Converters">
        {services.map((service, index) => (
          <button
            type="button"
            role="tab"
            key={service.id}
            aria-selected={service.id === activeId}
            aria-current={service.id === activeId ? 'true' : undefined}
            className="service-tab"
            onClick={() => setActiveId(service.id)}
            title={`Press ${index + 1} to open ${service.title}`}
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
          <h3>
            <span aria-hidden="true">[/&gt;]</span> {active.title}
          </h3>
          <p>{active.blurb}</p>
        </header>

        {active.mode === 'live' ? <HeicConverter /> : <MediaConverter service={active} />}
      </div>

      <a
        className="service-external"
        href="http://grimnetwork.srvp.ro:5000/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="service-external-mark" aria-hidden="true">↗</span>
        <TerminalIcon icon={Network} label="" />
        <span className="service-external-label">grimnetwork</span>
        <span className="service-external-host">grimnetwork.srvp.ro:5000</span>
        <em className="service-mode service-mode--ext">live host</em>
      </a>
    </section>
  )
}
