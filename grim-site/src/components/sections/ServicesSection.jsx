import { SectionTitle } from '../common/SectionTitle.jsx'
import { services } from '../../data/services.js'

export function ServicesSection() {
  return (
    <section className="section services" id="services">
      <SectionTitle>Services</SectionTitle>
      <p className="prompt">[/&gt;:]</p>
      <ul>
        {services.map((service) => (
          <li key={service}>
            <span>-</span>
            <a href="#contact">
              {service} <span aria-hidden="true">&lt;-</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
