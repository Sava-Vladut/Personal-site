import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ContactSection } from './components/sections/ContactSection.jsx'
import { BiographySection } from './components/sections/BiographySection.jsx'
import { HeroSection } from './components/sections/HeroSection.jsx'
import { ProjectsSection } from './components/sections/ProjectsSection.jsx'
import { ServicesSection } from './components/sections/ServicesSection.jsx'
import { GlyphField } from './components/common/GlyphField.jsx'
import { TerminalNav } from './components/navigation/TerminalNav.jsx'
import { StatusBar } from './components/navigation/StatusBar.jsx'
import { navItems } from './data/navigation.js'
import { profile } from './data/profile.js'
import { useGithubProjects } from './hooks/useGithubProjects.js'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation.js'
import './App.css'

const SERVICES_UNLOCK_KEY = 'grim:servicesUnlocked'
const CONTACT_TAPS_TO_UNLOCK = 3

const getViewFromHash = () => {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return navItems.some((item) => item.target === hash) ? hash : 'home'
}

const readUnlocked = () => {
  try {
    return localStorage.getItem(SERVICES_UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

function App() {
  const [activeView, setActiveView] = useState(getViewFromHash)
  const [servicesUnlocked, setServicesUnlocked] = useState(readUnlocked)
  const contactTapsRef = useRef(0)
  const { projects, status: projectStatus } = useGithubProjects()

  // Services is a hidden tab: it only appears once Contact is tapped 3x in a row.
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => item.target !== 'services' || servicesUnlocked),
    [servicesUnlocked],
  )

  const showView = useCallback(
    (target) => {
      let destination = target

      if (target === 'contact') {
        contactTapsRef.current += 1
        if (!servicesUnlocked && contactTapsRef.current >= CONTACT_TAPS_TO_UNLOCK) {
          setServicesUnlocked(true)
          try {
            localStorage.setItem(SERVICES_UNLOCK_KEY, '1')
          } catch {
            /* storage unavailable — unlock for this session only */
          }
          destination = 'services'
        }
      } else {
        contactTapsRef.current = 0
      }

      window.location.hash = `/${destination}`
      setActiveView(destination)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [servicesUnlocked],
  )

  // Keep the locked tab unreachable via direct URL / back button.
  const effectiveView = activeView === 'services' && !servicesUnlocked ? 'home' : activeView

  useEffect(() => {
    const onHashChange = () => setActiveView(getViewFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Normalise the URL when it points at a locked view (no state set here — the
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
      />
      <div className="view-panel" aria-live="polite">
        <div className="view-frame" data-view={effectiveView} key={effectiveView}>
          {effectiveView === 'home' && <HeroSection />}
          {effectiveView === 'biography' && <BiographySection />}
          {effectiveView === 'projects' && <ProjectsSection projects={projects} status={projectStatus} />}
          {effectiveView === 'services' && <ServicesSection />}
          {effectiveView === 'contact' && <ContactSection />}
        </div>
      </div>
      <StatusBar activeView={effectiveView} />
      <div className="crt-overlay" aria-hidden="true" />
    </main>
  )
}

export default App
