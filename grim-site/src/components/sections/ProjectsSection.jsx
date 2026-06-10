import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Braces, ExternalLink, RadioTower } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { SectionTitle } from '../common/SectionTitle.jsx'

const projectsPerPage = 3

export function ProjectsSection({ projects, status }) {
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(projects.length / projectsPerPage))
  const pageStartIndex = (currentPage - 1) * projectsPerPage
  const visibleProjects = useMemo(
    () => projects.slice(pageStartIndex, pageStartIndex + projectsPerPage),
    [pageStartIndex, projects],
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [projects])

  function goToPreviousPage() {
    setCurrentPage((page) => Math.max(1, page - 1))
  }

  function goToNextPage() {
    setCurrentPage((page) => Math.min(totalPages, page + 1))
  }

  return (
    <section className="section projects" id="projects">
      <SectionTitle>Projects</SectionTitle>
      <p className="project-status">
        <TerminalIcon icon={RadioTower} label="" />
        [/sync] {status}
      </p>
      <div className="project-pagination" aria-label="Project pagination">
        <button type="button" onClick={goToPreviousPage} disabled={currentPage === 1}>
          <span>^L</span>
          <TerminalIcon icon={ArrowLeft} label="" />
          Prev
        </button>
        <p>
          page {String(currentPage).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
        </p>
        <button type="button" onClick={goToNextPage} disabled={currentPage === totalPages}>
          <span>^R</span>
          <TerminalIcon icon={ArrowRight} label="" />
          Next
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
          Read more <span aria-hidden="true">-&gt;</span>
        </a>
      </div>
      <a className="visit-link" href={project.visitSite} target="_blank" rel="noreferrer">
        <TerminalIcon icon={ExternalLink} label="" />
        Visit site <span aria-hidden="true">-&gt;</span>
      </a>
    </article>
  )
}
