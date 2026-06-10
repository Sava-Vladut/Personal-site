import { BookOpenText, BriefcaseBusiness, Code2, Contact, Home, SunMoon } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { navItems } from '../../data/navigation.js'

const navIcons = {
  home: Home,
  biography: BookOpenText,
  projects: Code2,
  services: BriefcaseBusiness,
  contact: Contact,
}

export function TerminalNav({ activeTarget, inverted, onNavigate, setInverted, compact = false }) {
  return (
    <nav
      className={`terminal-nav${compact ? ' nav-bottom' : ''}`}
      aria-label={compact ? 'Footer navigation' : 'Primary navigation'}
    >
      {navItems.map((item) => (
        <button
          aria-current={activeTarget === item.target ? 'page' : undefined}
          aria-keyshortcuts={`Control+${item.shortcut.toUpperCase()} Alt+${item.shortcut.toUpperCase()} ${item.shortcut.toUpperCase()}`}
          key={item.target}
          title={`Press ${item.shortcut.toUpperCase()} to open ${item.label}`}
          type="button"
          onClick={() => onNavigate(item.target)}
        >
          <span>{item.key}</span>
          <TerminalIcon icon={navIcons[item.target]} label="" />
          {item.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setInverted((value) => !value)}
        aria-keyshortcuts="Control+I Alt+I I"
        aria-pressed={inverted}
        title="Press I to invert"
      >
        <span>^I</span>
        <TerminalIcon icon={SunMoon} label="" />
        Invert
      </button>
    </nav>
  )
}
