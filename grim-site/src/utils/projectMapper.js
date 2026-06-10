const asciiMarks = ['::::', '####', '[][]', '....', '////', '++++']

function formatRepoTitle(name) {
  return name.replaceAll('-', ' ').replaceAll('_', ' ').toUpperCase()
}

export function mapReposToProjects(repos) {
  return repos
    .filter((repo) => !repo.fork)
    .sort((first, second) => new Date(second.pushed_at) - new Date(first.pushed_at))
    .map((repo, index) => ({
      title: formatRepoTitle(repo.name),
      mark: asciiMarks[index % asciiMarks.length],
      description: repo.description || `${repo.language || 'Code'} repository / public signal from GitHub.`,
      readMore: repo.html_url,
      visitSite: repo.homepage || repo.html_url,
    }))
}
