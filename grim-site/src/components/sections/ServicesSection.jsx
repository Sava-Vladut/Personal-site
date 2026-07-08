import { Plane } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { services } from '../../data/services.js'

const serviceIcons = {
  flightmanager: Plane,
}

const serviceModeLabels = {
  external: '↗ open',
}

export function ServicesSection() {
  const active = services[0]

  return (
    <section className="section services" id="services">
      <div className="service-tabs" role="tablist" aria-label="Services">
        {services.map((service) => (
          <button
            type="button"
            role="tab"
            key={service.id}
            aria-selected={service.id === active.id}
            aria-current={service.id === active.id ? 'true' : undefined}
            className="service-tab"
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
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  )
}
