import { BookOpenText, BriefcaseBusiness, Code2, Contact, Home, SunMoon } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { navItems } from '../../data/navigation.js'
import { scrollToSection } from '../../utils/navigation.js'

const navIcons = {
  home: Home,
  biography: BookOpenText,
  projects: Code2,
  services: BriefcaseBusiness,
  contact: Contact,
}

export function TerminalNav({ inverted, setInverted, compact = false }) {
  return (
    <nav
      className={`terminal-nav${compact ? ' nav-bottom' : ''}`}
      aria-label={compact ? 'Footer navigation' : 'Primary navigation'}
    >
      {navItems.map((item) => (
        <button key={item.target} type="button" onClick={() => scrollToSection(item.target)}>
          <span>{item.key}</span>
          <TerminalIcon icon={navIcons[item.target]} label="" />
          {item.label}
        </button>
      ))}
      <button type="button" onClick={() => setInverted((value) => !value)} aria-pressed={inverted}>
        <span>^I</span>
        <TerminalIcon icon={SunMoon} label="" />
        Invert
      </button>
    </nav>
  )
}
