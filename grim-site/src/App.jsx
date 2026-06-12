import { useCallback, useEffect, useState } from 'react'
import { ContactSection } from './components/sections/ContactSection.jsx'
import { BiographySection } from './components/sections/BiographySection.jsx'
import { HeroSection } from './components/sections/HeroSection.jsx'
import { ProjectsSection } from './components/sections/ProjectsSection.jsx'
import { GlyphField } from './components/common/GlyphField.jsx'
import { TerminalNav } from './components/navigation/TerminalNav.jsx'
import { StatusBar } from './components/navigation/StatusBar.jsx'
import { navItems } from './data/navigation.js'
import { profile } from './data/profile.js'
import { useGithubProjects } from './hooks/useGithubProjects.js'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation.js'
import './App.css'

const getViewFromHash = () => {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return navItems.some((item) => item.target === hash) ? hash : 'home'
}

function App() {
  const [inverted, setInverted] = useState(false)
  const [activeView, setActiveView] = useState(getViewFromHash)
  const { projects, status: projectStatus } = useGithubProjects()
  const toggleInvert = useCallback(() => {
    setInverted((value) => !value)
  }, [])
  const showView = useCallback((target) => {
    window.location.hash = `/${target}`
    setActiveView(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onHashChange = () => setActiveView(getViewFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    document.title = `${profile.firstName} ${profile.lastName} — ~/${activeView}`
  }, [activeView])

  useKeyboardNavigation({
    navItems,
    onNavigate: showView,
    onInvert: toggleInvert,
  })

  return (
    <main className={`terminal-site${inverted ? ' is-inverted' : ''}`}>
      <GlyphField inverted={inverted} />
      <TerminalNav
        activeTarget={activeView}
        inverted={inverted}
        onNavigate={showView}
        setInverted={setInverted}
      />
      <div className="view-panel" aria-live="polite">
        <div className="view-frame" data-view={activeView} key={activeView}>
          {activeView === 'home' && <HeroSection />}
          {activeView === 'biography' && <BiographySection />}
          {activeView === 'projects' && <ProjectsSection projects={projects} status={projectStatus} />}
          {activeView === 'contact' && <ContactSection />}
        </div>
      </div>
      <StatusBar activeView={activeView} inverted={inverted} />
      <div className="crt-overlay" aria-hidden="true" />
    </main>
  )
}

export default App
