import { useEffect, useRef, useState } from 'react'
import { BookOpenText, ChevronDown, Code2, Contact, Home, Network, Wrench } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { navItems } from '../../data/navigation.js'

const navIcons = {
  home: Home,
  biography: BookOpenText,
  projects: Code2,
  services: Wrench,
  miner: Network,
  contact: Contact,
}

export function TerminalNav({
  activeTarget,
  items = navItems,
  onNavigate,
  compact = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navRef = useRef(null)
  const activeItem = items.find((item) => item.target === activeTarget)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onPointerDown = (event) => {
      if (!navRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <nav
      className={`terminal-nav${compact ? ' nav-bottom' : ''}${menuOpen ? ' is-open' : ''}`}
      aria-label={compact ? 'Footer navigation' : 'Primary navigation'}
      ref={navRef}
    >
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={menuOpen}
        aria-controls="nav-menu"
        onClick={() => setMenuOpen((value) => !value)}
      >
        <span>~/</span>
        <TerminalIcon icon={navIcons[activeTarget] ?? Home} label="" />
        {activeItem?.label ?? activeTarget}
        <TerminalIcon icon={ChevronDown} label="" />
      </button>
      <div className="nav-items" id="nav-menu">
        {items.map((item) => (
          <button
            aria-current={activeTarget === item.target ? 'page' : undefined}
            aria-keyshortcuts={`Control+${item.shortcut.toUpperCase()} Alt+${item.shortcut.toUpperCase()} ${item.shortcut.toUpperCase()}`}
            key={item.target}
            title={`Press ${item.shortcut.toUpperCase()} to open ${item.label}`}
            type="button"
            onClick={() => {
              if (item.href) {
                window.open(item.href, '_blank', 'noopener,noreferrer')
              } else {
                onNavigate(item.target)
              }
              setMenuOpen(false)
            }}
          >
            <span>{item.key}</span>
            <TerminalIcon icon={navIcons[item.target]} label="" />
            {item.label}
            {item.external && (
              <span className="nav-external-mark" aria-hidden="true">
                ↗
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}
