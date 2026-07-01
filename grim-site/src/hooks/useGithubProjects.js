import { useEffect, useState } from 'react'
import { fallbackProjects } from '../data/projects.js'
import { fetchGithubProjects } from '../services/github.js'

export function useGithubProjects() {
  const [projects, setProjects] = useState(fallbackProjects)

  useEffect(() => {
    const controller = new AbortController()

    async function loadProjects() {
      try {
        const githubProjects = await fetchGithubProjects(controller.signal)
        if (githubProjects.length > 0) {
          setProjects(githubProjects)
        }
      } catch (error) {
        if (error.name === 'AbortError') return
        // Keep the fallback projects on any failure.
      }
    }

    loadProjects()
    return () => controller.abort()
  }, [])

  return { projects }
}
