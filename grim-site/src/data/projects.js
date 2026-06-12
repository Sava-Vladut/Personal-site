import { githubUser } from '../services/github.js'
import projectsText from '../content/projects.txt?raw'
import { parseBlocks } from '../utils/textContent.js'

const githubProfileUrl = `https://github.com/${githubUser}`

export const fallbackProjects = parseBlocks(projectsText).map((block) => ({
  ...block,
  readMore: block.readMore || githubProfileUrl,
  visitSite: block.visitSite || githubProfileUrl,
}))
