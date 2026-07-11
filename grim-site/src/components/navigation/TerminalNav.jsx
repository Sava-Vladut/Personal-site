import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Code2, Home, LayoutDashboard, LogIn, LogOut, Wrench } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { navItems } from '../../data/navigation.js'

const navIcons = {
  home: Home,
  projects: Code2,
  services: Wrench,
  admin: LayoutDashboard,
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

  // The numbered keycaps in the rail are live shortcuts: pressing 1–9 jumps
  // straight to that entry, terminal-menu style. Ignored while typing.
  useEffect(() => {
    if (compact) return undefined
    const onKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const el = event.target
      if (
        el instanceof HTMLElement &&
        (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
      ) {
        return
      }
      const index = Number.parseInt(event.key, 10) - 1
      if (Number.isNaN(index) || index < 0 || index >= items.length) return
      const item = items[index]
      if (item.href) {
        window.open(item.href, '_blank', 'noopener,noreferrer')
      } else {
        onNavigate(item.target)
      }
      setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [compact, items, onNavigate])

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
      <p className="nav-rail-head" aria-hidden="true">
        ~/{activeTarget}
        <span className="cursor">_</span>
      </p>
      <div className="nav-items" id="nav-menu">
        {items.map((item, index) => (
          <button
            aria-current={activeTarget === item.target ? 'page' : undefined}
            aria-keyshortcuts={index < 9 ? String(index + 1) : undefined}
            key={item.target}
            title={`Open ${item.label}${index < 9 ? ` (${index + 1})` : ''}`}
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
            {index < 9 && <span className="nav-key">{index + 1}</span>}
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
            className="nav-session"
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
            className="nav-session"
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
