import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Braces, ExternalLink, RadioTower } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { SectionTitle } from '../common/SectionTitle.jsx'
import { isKeyboardCommand, isTypingTarget } from '../../utils/keyboard.js'
import { ui } from '../../data/ui.js'

const projectsPerPage = 3

export function ProjectsSection({ projects, status }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [prevProjects, setPrevProjects] = useState(projects)
  const totalPages = Math.max(1, Math.ceil(projects.length / projectsPerPage))

  if (prevProjects !== projects) {
    setPrevProjects(projects)
    setCurrentPage(1)
  }

  const pageStartIndex = (currentPage - 1) * projectsPerPage
  const visibleProjects = useMemo(
    () => projects.slice(pageStartIndex, pageStartIndex + projectsPerPage),
    [pageStartIndex, projects],
  )

  const goToPreviousPage = useCallback(() => {
    setCurrentPage((page) => Math.max(1, page - 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setCurrentPage((page) => Math.min(totalPages, page + 1))
  }, [totalPages])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target) || !isKeyboardCommand(event)) return

      const command = event.key.toLowerCase()

      if (command === 'l') {
        event.preventDefault()
        goToPreviousPage()
      }

      if (command === 'r') {
        event.preventDefault()
        goToNextPage()
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [goToNextPage, goToPreviousPage])

  return (
    <section className="section projects" id="projects">
      <SectionTitle>Projects</SectionTitle>
      <p className="project-status">
        <TerminalIcon icon={RadioTower} label="" />
        {ui.syncLabel} {status}
      </p>
      <div className="project-pagination" aria-label="Project pagination">
        <button
          type="button"
          onClick={goToPreviousPage}
          disabled={currentPage === 1}
          aria-keyshortcuts="Control+L Alt+L L"
          title="Press L for previous page"
        >
          <span>^L</span>
          <TerminalIcon icon={ArrowLeft} label="" />
          {ui.prevButton}
        </button>
        <p>
          page {String(currentPage).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
        </p>
        <button
          type="button"
          onClick={goToNextPage}
          disabled={currentPage === totalPages}
          aria-keyshortcuts="Control+R Alt+R R"
          title="Press R for next page"
        >
          <span>^R</span>
          <TerminalIcon icon={ArrowRight} label="" />
          {ui.nextButton}
        </button>
      </div>
      <div className="project-list">
        {visibleProjects.map((project, index) => (
          <ProjectRow project={project} index={pageStartIndex + index} key={project.title} />
        ))}
      </div>
    </section>
  )
}

function ProjectRow({ project, index }) {
  return (
    <article className="project-row">
      <div className="project-index">[/&gt;] {String(index + 1).padStart(2, '0')}</div>
      <div className="project-main">
        <h3>
          <span aria-hidden="true">{project.mark}</span>
          {project.title}
          <span aria-hidden="true">{project.mark}</span>
        </h3>
        <p>{project.description}</p>
        <a href={project.readMore} target="_blank" rel="noreferrer">
          <TerminalIcon icon={Braces} label="" />
          {ui.readMoreLink} <span aria-hidden="true">-&gt;</span>
        </a>
      </div>
      <a className="visit-link" href={project.visitSite} target="_blank" rel="noreferrer">
        <TerminalIcon icon={ExternalLink} label="" />
        {ui.visitSiteLink} <span aria-hidden="true">-&gt;</span>
      </a>
    </article>
  )
}
