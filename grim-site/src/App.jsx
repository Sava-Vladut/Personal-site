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
  const { projects, status: projectStatus } = useGithubProjects()
  const toggleInvert = useCallback(() => {
    setInverted((value) => !value)
  }, [])

  useKeyboardNavigation({
    navItems,
    onInvert: toggleInvert,
  })

  return (
    <main className={`terminal-site${inverted ? ' is-inverted' : ''}`}>
      <HeroSection />
      <TerminalNav inverted={inverted} setInverted={setInverted} />
      <BiographySection />
      <ProjectsSection projects={projects} status={projectStatus} />
      <ServicesSection />
      <ContactSection />
      <TerminalNav inverted={inverted} setInverted={setInverted} compact />
    </main>
  )
}

export default App
