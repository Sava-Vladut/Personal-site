import { mapReposToProjects } from '../utils/projectMapper.js'

export const githubUser = 'Sava-Vladut'

const githubReposUrl = `https://api.github.com/users/${githubUser}/repos?sort=pushed&per_page=100`

export async function fetchGithubProjects(signal) {
  const response = await fetch(githubReposUrl, { signal })

  if (!response.ok) {
    throw new Error(`GitHub responded with ${response.status}`)
  }

  const repos = await response.json()
  return mapReposToProjects(repos)
}
