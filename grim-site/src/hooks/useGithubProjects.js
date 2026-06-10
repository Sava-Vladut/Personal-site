import { useEffect, useState } from 'react'
import { fallbackProjects } from '../data/projects.js'
import { fetchGithubProjects, githubUser } from '../services/github.js'

export function useGithubProjects() {
  const [projects, setProjects] = useState(fallbackProjects)
  const [status, setStatus] = useState('syncing github repos...')

  useEffect(() => {
    const controller = new AbortController()

    async function loadProjects() {
      try {
        const githubProjects = await fetchGithubProjects(controller.signal)

        if (githubProjects.length > 0) {
          setProjects(githubProjects)
          setStatus(`source: github.com/${githubUser}`)
        } else {
          setStatus('github source empty / showing fallback')
        }
      } catch (error) {
        if (error.name === 'AbortError') return
        setStatus('github unavailable / showing fallback')
      }
    }

    loadProjects()
    return () => controller.abort()
  }, [])

  return { projects, status }
}
