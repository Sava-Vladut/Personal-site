import { useEffect, useRef, useState } from 'react'
import { BookOpenText, ChevronDown, Code2, Contact, Home, LayoutDashboard, LogIn, LogOut, Network, Wrench } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { navItems } from '../../data/navigation.js'

const navIcons = {
  home: Home,
  biography: BookOpenText,
  projects: Code2,
  services: Wrench,
  miner: Network,
  admin: LayoutDashboard,
  contact: Contact,
}

export function TerminalNav({
  activeTarget,
  items = navItems,
  onNavigate,
  isLoggedIn = false,
  onLogin,
  onLogout,
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
            key={item.target}
            title={`Open ${item.label}`}
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
            <TerminalIcon icon={navIcons[item.target]} label="" />
            {item.label}
            {item.external && (
              <span className="nav-external-mark" aria-hidden="true">
                ↗
              </span>
            )}
          </button>
        ))}
        {isLoggedIn ? (
          <button
            type="button"
            onClick={() => {
              onLogout?.()
              setMenuOpen(false)
            }}
            title="Sign out"
          >
            <TerminalIcon icon={LogOut} label="" />
            Logout
          </button>
        ) : (
          <button
            type="button"
            aria-current={activeTarget === 'login' ? 'page' : undefined}
            onClick={() => {
              onLogin?.()
              setMenuOpen(false)
            }}
            title="Sign in"
          >
            <TerminalIcon icon={LogIn} label="" />
            Login
          </button>
        )}
      </div>
    </nav>
  )
}
