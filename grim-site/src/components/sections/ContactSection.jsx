import { AtSign, CalendarDays, Mail, UserRound } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { profile } from '../../data/profile.js'
import { ui } from '../../data/ui.js'

export function ContactSection() {
  const year = new Date().getFullYear()

  return (
    <section className="section contact" id="contact">
      <div className="contact-grid">
        <p>
          <span><TerminalIcon icon={UserRound} label="" />{ui.contactNameLabel}</span>
          {profile.name.toUpperCase()}
        </p>
        <p>
          <span><TerminalIcon icon={Mail} label="" />{ui.contactEmailLabel}</span>
          {profile.email}
        </p>
        <p>
          <span><TerminalIcon icon={AtSign} label="" />{ui.contactSocialLabel}</span>
          {profile.social}
        </p>
        <p>
          <span><TerminalIcon icon={CalendarDays} label="" />{ui.contactCopyrightLabel}</span>
          (C) {year}
        </p>
      </div>
    </section>
  )
}
