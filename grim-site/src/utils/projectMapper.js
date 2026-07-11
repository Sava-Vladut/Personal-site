function formatRepoTitle(name) {
  return name.replaceAll('-', ' ').replaceAll('_', ' ').toUpperCase()
}

export function mapReposToProjects(repos) {
  return repos
    .filter((repo) => !repo.fork)
    .sort((first, second) => new Date(second.pushed_at) - new Date(first.pushed_at))
    .map((repo) => ({
      title: formatRepoTitle(repo.name),
      description: repo.description || `A ${repo.language || 'code'} project on GitHub.`,
      readMore: repo.html_url,
      visitSite: repo.homepage || repo.html_url,
    }))
}
