import { useCallback, useState } from 'react'
import { ContactSection } from './components/sections/ContactSection.jsx'
import { BiographySection } from './components/sections/BiographySection.jsx'
import { HeroSection } from './components/sections/HeroSection.jsx'
import { ProjectsSection } from './components/sections/ProjectsSection.jsx'
import { ServicesSection } from './components/sections/ServicesSection.jsx'
import { TerminalNav } from './components/navigation/TerminalNav.jsx'
import { navItems } from './data/navigation.js'
import { useGithubProjects } from './hooks/useGithubProjects.js'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation.js'
import './App.css'

function App() {
  const [inverted, setInverted] = useState(false)
  const [activeView, setActiveView] = useState('home')
  const { projects, status: projectStatus } = useGithubProjects()
  const toggleInvert = useCallback(() => {
    setInverted((value) => !value)
  }, [])
  const showView = useCallback((target) => {
    setActiveView(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useKeyboardNavigation({
    navItems,
    onNavigate: showView,
    onInvert: toggleInvert,
  })

  return (
    <main className={`terminal-site${inverted ? ' is-inverted' : ''}`}>
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
          {activeView === 'services' && <ServicesSection />}
          {activeView === 'contact' && <ContactSection />}
        </div>
      </div>
    </main>
  )
}

export default App
