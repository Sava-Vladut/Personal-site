import { useCallback, useEffect, useMemo, useState } from 'react'
import { ContactSection } from './components/sections/ContactSection.jsx'
import { BiographySection } from './components/sections/BiographySection.jsx'
import { HeroSection } from './components/sections/HeroSection.jsx'
import { LoginSection } from './components/sections/LoginSection.jsx'
import { RegisterSection } from './components/sections/RegisterSection.jsx'
import { ProjectsSection } from './components/sections/ProjectsSection.jsx'
import { ServicesSection } from './components/sections/ServicesSection.jsx'
import { AdminSection } from './components/sections/AdminSection.jsx'
import { GlyphField } from './components/common/GlyphField.jsx'
import { TerminalNav } from './components/navigation/TerminalNav.jsx'
import { StatusBar } from './components/navigation/StatusBar.jsx'
import { navItems } from './data/navigation.js'
import { profile } from './data/profile.js'
import { useGithubProjects } from './hooks/useGithubProjects.js'
import { useAuth } from './auth/context.js'
import './App.css'

// 'login' and 'register' are reachable but live outside the main nav (hidden tabs).
const knownViews = new Set([...navItems.map((item) => item.target), 'login', 'register'])

// Tabs reserved for admin accounts — hidden from the nav and unreachable by URL
// for everyone else (the services console — which now also hosts the miner —
// plus the admin dashboard).
const adminTargets = new Set(['services', 'admin'])

const getViewFromHash = () => {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return knownViews.has(hash) ? hash : 'home'
}

function App() {
  const [activeView, setActiveView] = useState(getViewFromHash)
  const { projects, status: projectStatus } = useGithubProjects()
  const { isLoggedIn, isAdmin, signOut } = useAuth()

  // Services and Admin are admin-only tabs (see adminTargets) — they only
  // appear in the nav once an admin account is signed in.
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
  // hashchange listener picks up the corrected hash).
  useEffect(() => {
    if (activeView !== effectiveView) {
      window.location.hash = `/${effectiveView}`
    }
  }, [activeView, effectiveView])

  useEffect(() => {
    document.title = `${profile.firstName} ${profile.lastName} — ~/${effectiveView}`
  }, [effectiveView])

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
      </div>
      <StatusBar activeView={effectiveView} />
      <div className="crt-overlay" aria-hidden="true" />
    </main>
  )
}

export default App
