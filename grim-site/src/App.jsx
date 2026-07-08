import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ContactSection } from './components/sections/ContactSection.jsx'
import { BiographySection } from './components/sections/BiographySection.jsx'
import { HeroSection } from './components/sections/HeroSection.jsx'
import { LoginSection } from './components/sections/LoginSection.jsx'
import { RegisterSection } from './components/sections/RegisterSection.jsx'
import { ProjectsSection } from './components/sections/ProjectsSection.jsx'
import { ServicesSection } from './components/sections/ServicesSection.jsx'
import { TwitchChatPopout } from './components/sections/TwitchChatPopout.jsx'
import { AdminSection } from './components/sections/AdminSection.jsx'
import { GlyphField } from './components/common/GlyphField.jsx'
import { TerminalNav } from './components/navigation/TerminalNav.jsx'
import { navItems } from './data/navigation.js'
import { profile } from './data/profile.js'
import { useGithubProjects } from './hooks/useGithubProjects.js'
import { useAuth } from './auth/context.js'
import './App.css'

// 'login' and 'register' are reachable but live outside the main nav (hidden tabs).
const knownViews = new Set([...navItems.map((item) => item.target), 'login', 'register'])

// Tabs reserved for admin accounts — hidden from the nav and unreachable by URL
// for everyone else.
const adminTargets = new Set(['admin', 'chatpop'])

const getViewFromHash = () => {
  const hash = window.location.hash.replace(/^#\/?/, '')
  // #/chatpop/<channel> — the popped-out chat window; the channel segment is
  // read by TwitchChatPopout itself.
  if (hash.startsWith('chatpop')) return 'chatpop'
  return knownViews.has(hash) ? hash : 'home'
}

// Below this width the nav collapses into a top bar (see App.css) and the
// shell stops height-fitting: shrinking a tall page into a phone viewport
// renders it unreadable, so the panel scrolls vertically instead. Width
// overflow is still scaled away so the page never scrolls sideways.
const mobileFitQuery = '(max-width: 900px)'

function ViewportFitter({ view, children }) {
  const stageRef = useRef(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const stage = stageRef.current
    const panel = stage?.parentElement
    if (!stage || !panel) return undefined

    const mobileFit = window.matchMedia(mobileFitQuery)
    let frameId = 0
    let timeoutId = 0

    const measure = () => {
      // A panel that used to be scrollable can retain a non-zero scroll
      // offset after overflow is locked, which visually crops its top/left.
      // On mobile the panel is the scroller, so only the sideways offset is
      // pinned — content mutations (live chat feeds) must not yank the
      // user back to the top.
      panel.scrollLeft = 0
      if (!mobileFit.matches) panel.scrollTop = 0

      const naturalWidth = Math.max(stage.scrollWidth, stage.offsetWidth)
      const naturalHeight = Math.max(stage.scrollHeight, stage.offsetHeight)
      const widthScale = panel.clientWidth / Math.max(1, naturalWidth)
      const heightScale = panel.clientHeight / Math.max(1, naturalHeight)
      const rawScale = Math.min(1, widthScale, mobileFit.matches ? 1 : heightScale)
      // Snap near-fits to 1 so a view that already fits is never rendered
      // fractionally scaled (blurry text for no gain).
      const nextScale = rawScale >= 0.995 ? 1 : rawScale
      setScale((current) => Math.abs(current - nextScale) < 0.002 ? current : nextScale)
    }

    // Coalesce bursts of mutations into one measurement per frame. The
    // timeout is the safety net: rAF is suspended in background tabs, and
    // without it a resize that happens while hidden leaves a stale scale
    // on return.
    const fit = () => {
      cancelAnimationFrame(frameId)
      clearTimeout(timeoutId)
      frameId = requestAnimationFrame(() => {
        clearTimeout(timeoutId)
        measure()
      })
      timeoutId = setTimeout(measure, 120)
    }

    const resizeObserver = new ResizeObserver(fit)
    const mutationObserver = new MutationObserver(fit)
    resizeObserver.observe(panel)
    resizeObserver.observe(stage)
    mutationObserver.observe(stage, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', fit)
    mobileFit.addEventListener('change', fit)
    panel.scrollTop = 0
    panel.scrollLeft = 0
    fit()

    return () => {
      cancelAnimationFrame(frameId)
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', fit)
      mobileFit.removeEventListener('change', fit)
    }
  }, [view])

  return (
    <div
      className="view-fit-stage"
      ref={stageRef}
      style={{ '--view-fit-scale': scale }}
    >
      {children}
    </div>
  )
}

function App() {
  const [activeView, setActiveView] = useState(getViewFromHash)
  const { projects } = useGithubProjects()
  const { isLoggedIn, isAdmin, loading, signOut } = useAuth()

  // Admin-only tabs (see adminTargets) appear in the nav once an admin account
  // is signed in. Services stay public because some external services do not
  // require an account.
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !adminTargets.has(item.target) || isAdmin),
    [isAdmin],
  )

  const showView = useCallback((target) => {
    window.location.hash = `/${target}`
    setActiveView(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleLogout = useCallback(async () => {
    await signOut()
    showView('home')
  }, [signOut, showView])

  // Enforce the admin gate on whatever view is requested. Non-admins are bounced
  // off admin-only views — to login if they're a guest, otherwise home. Once
  // authenticated, the login/register views resolve to a sensible landing.
  let effectiveView = activeView
  if (adminTargets.has(activeView) && !isAdmin) {
    effectiveView = isLoggedIn ? 'home' : 'login'
  }
  if ((activeView === 'login' || activeView === 'register') && isLoggedIn) {
    effectiveView = isAdmin ? 'admin' : 'home'
  }

  useEffect(() => {
    const onHashChange = () => setActiveView(getViewFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Normalise the URL when it points at a gated view (no state set here — the
  // hashchange listener picks up the corrected hash). Held off until the session
  // has resolved so a refresh on a gated view doesn't bounce a returning admin.
  useEffect(() => {
    if (!loading && activeView !== effectiveView) {
      window.location.hash = `/${effectiveView}`
    }
  }, [loading, activeView, effectiveView])

  useEffect(() => {
    document.title = `${profile.firstName} ${profile.lastName} — ~/${effectiveView}`
  }, [effectiveView])

  // The popped-out chat is a bare utility window: no nav rail, no glyph field —
  // just the chat tool owning the viewport (still admin-gated above, like the
  // services console it was opened from).
  if (effectiveView === 'chatpop') {
    return (
      <main className="terminal-site">
        <div className="view-panel">
          <ViewportFitter view="chatpop">
            <div className="view-frame" data-view="chatpop">
              <TwitchChatPopout />
            </div>
          </ViewportFitter>
        </div>
        <div className="crt-overlay" aria-hidden="true" />
      </main>
    )
  }

  return (
    <main className="terminal-site">
      <GlyphField />
      <TerminalNav
        activeTarget={effectiveView}
        items={visibleNavItems}
        onNavigate={showView}
        isLoggedIn={isLoggedIn}
        onLogin={() => showView('login')}
        onLogout={handleLogout}
      />
      <div className="view-panel" aria-live="polite">
        <ViewportFitter view={loading ? 'booting' : effectiveView}>
        {loading ? (
          <div className="view-frame" data-view="booting">
            <p className="login-intro">restoring session…</p>
          </div>
        ) : (
        <div className="view-frame" data-view={effectiveView} key={effectiveView}>
          {effectiveView === 'home' && <HeroSection />}
          {effectiveView === 'biography' && <BiographySection />}
          {effectiveView === 'projects' && <ProjectsSection projects={projects} />}
          {effectiveView === 'services' && <ServicesSection />}
          {effectiveView === 'admin' && <AdminSection />}
          {effectiveView === 'login' && (
            <LoginSection
              onAuthed={() => showView('admin')}
              onRegister={() => showView('register')}
            />
          )}
          {effectiveView === 'register' && (
            <RegisterSection
              onAuthed={() => showView('admin')}
              onLogin={() => showView('login')}
            />
          )}
          {effectiveView === 'contact' && <ContactSection />}
        </div>
        )}
        </ViewportFitter>
      </div>
      <div className="crt-overlay" aria-hidden="true" />
    </main>
  )
}

export default App
