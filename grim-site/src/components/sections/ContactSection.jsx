import { AtSign, CalendarDays, Mail, UserRound } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { SectionTitle } from '../common/SectionTitle.jsx'
import { profile } from '../../data/profile.js'

export function ContactSection() {
  const year = new Date().getFullYear()

  return (
    <section className="section contact" id="contact">
      <SectionTitle>Contact</SectionTitle>
      <div className="contact-grid">
        <p>
          <span><TerminalIcon icon={UserRound} label="" />Name</span>
          {profile.name.toUpperCase()}
        </p>
        <p>
          <span><TerminalIcon icon={Mail} label="" />Email</span>
          {profile.email}
        </p>
        <p>
          <span><TerminalIcon icon={AtSign} label="" />Social</span>
          {profile.social}
        </p>
        <p>
          <span><TerminalIcon icon={CalendarDays} label="" />Copyright</span>
          (C) {year}
        </p>
      </div>
    </section>
  )
}
