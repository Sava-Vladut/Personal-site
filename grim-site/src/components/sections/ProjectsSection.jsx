import { useCallback, useMemo, useState } from 'react'
import { ui } from '../../data/ui.js'

const projectsPerPage = 5

export function ProjectsSection({ projects }) {
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

  return (
    <section className="section projects" id="projects">
      <div className="project-pagination" aria-label="Project pagination">
        <button
          type="button"
          onClick={goToPreviousPage}
          disabled={currentPage === 1}
        >
          {ui.prevButton}
        </button>
        <p>
          Page {currentPage} of {totalPages}
        </p>
        <button
          type="button"
          onClick={goToNextPage}
          disabled={currentPage === totalPages}
        >
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
      <div className="project-index">{String(index + 1).padStart(2, '0')}</div>
      <div className="project-main">
        <h3>{project.title}</h3>
        <p>{project.description}</p>
        <a href={project.readMore} target="_blank" rel="noreferrer">
          {ui.readMoreLink}
        </a>
      </div>
      <a className="visit-link" href={project.visitSite} target="_blank" rel="noreferrer">
        {ui.visitSiteLink}
      </a>
    </article>
  )
}
