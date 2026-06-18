import { useCallback, useEffect, useMemo, useState } from 'react'
import { ContactSection } from './components/sections/ContactSection.jsx'
import { BiographySection } from './components/sections/BiographySection.jsx'
import { HeroSection } from './components/sections/HeroSection.jsx'
import { LoginSection } from './components/sections/LoginSection.jsx'
import { ProjectsSection } from './components/sections/ProjectsSection.jsx'
import { ServicesSection } from './components/sections/ServicesSection.jsx'
import { GlyphField } from './components/common/GlyphField.jsx'
import { TerminalNav } from './components/navigation/TerminalNav.jsx'
import { StatusBar } from './components/navigation/StatusBar.jsx'
import { navItems } from './data/navigation.js'
import { profile } from './data/profile.js'
import { useGithubProjects } from './hooks/useGithubProjects.js'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation.js'
import { useAuth } from './auth/context.js'
import './App.css'

// 'login' is reachable but lives outside the main nav (no shortcut, hidden tab).
const knownViews = new Set([...navItems.map((item) => item.target), 'login'])

const getViewFromHash = () => {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return knownViews.has(hash) ? hash : 'home'
}

function App() {
  const [activeView, setActiveView] = useState(getViewFromHash)
  const { projects, status: projectStatus } = useGithubProjects()
  const { isLoggedIn, signOut } = useAuth()

  // Services is a gated tab: it only appears in the nav once you're logged in.
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => item.target !== 'services' || isLoggedIn),
    [isLoggedIn],
  )

  const showView = useCallback((target) => {
    // Services is reachable only by authenticated users — route guests to login.
    const destination = target === 'services' && !isLoggedIn ? 'login' : target
    window.location.hash = `/${destination}`
    setActiveView(destination)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [isLoggedIn])

  const handleLogout = useCallback(async () => {
    await signOut()
    showView('home')
  }, [signOut, showView])

  // Keep the gated tab unreachable via direct URL / back button. Once logged in,
  // bounce the login view straight to services.
  let effectiveView = activeView
  if (activeView === 'services' && !isLoggedIn) effectiveView = 'login'
  if (activeView === 'login' && isLoggedIn) effectiveView = 'services'

  useEffect(() => {
    const onHashChange = () => setActiveView(getViewFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Normalise the URL when it points at a gated view (no state set here — the
  // hashchange listener picks up the corrected hash).
  useEffect(() => {
    if (activeView !== effectiveView) {
      window.location.hash = `/${effectiveView}`
    }
  }, [activeView, effectiveView])

  useEffect(() => {
    document.title = `${profile.firstName} ${profile.lastName} — ~/${effectiveView}`
  }, [effectiveView])

  useKeyboardNavigation({
    navItems: visibleNavItems,
    onNavigate: showView,
  })

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
        <div className="view-frame" data-view={effectiveView} key={effectiveView}>
          {effectiveView === 'home' && <HeroSection />}
          {effectiveView === 'biography' && <BiographySection />}
          {effectiveView === 'projects' && <ProjectsSection projects={projects} status={projectStatus} />}
          {effectiveView === 'services' && <ServicesSection />}
          {effectiveView === 'login' && <LoginSection onAuthed={() => showView('services')} />}
          {effectiveView === 'contact' && <ContactSection />}
        </div>
      </div>
      <StatusBar activeView={effectiveView} />
      <div className="crt-overlay" aria-hidden="true" />
    </main>
  )
}

export default App
