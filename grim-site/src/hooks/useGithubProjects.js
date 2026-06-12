import { useEffect, useState } from 'react'
import { fallbackProjects } from '../data/projects.js'
import { fetchGithubProjects, githubUser } from '../services/github.js'
import { ui } from '../data/ui.js'

const withUser = (text) => text.replace('{user}', githubUser)

export function useGithubProjects() {
  const [projects, setProjects] = useState(fallbackProjects)
  const [status, setStatus] = useState(ui.statusSyncing)

  useEffect(() => {
    const controller = new AbortController()

    async function loadProjects() {
      try {
        const githubProjects = await fetchGithubProjects(controller.signal)

        if (githubProjects.length > 0) {
          setProjects(githubProjects)
          setStatus(withUser(ui.statusSource))
        } else {
          setStatus(ui.statusEmpty)
        }
      } catch (error) {
        if (error.name === 'AbortError') return
        setStatus(ui.statusError)
      }
    }

    loadProjects()
    return () => controller.abort()
  }, [])

  return { projects, status }
}
