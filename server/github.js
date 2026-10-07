// GitHub projects: a user's public repositories, their languages and every commit on their default branch,
// fetched from the GitHub API and kept in memory and on disk (data/github.json), so a restart doesn't spend the
// rate limit again (60 requests an hour without a token, 5,000 with GITHUB_TOKEN). The repository list is looked
// at again every few minutes; a repository's commits and languages only when it has been pushed to since, and then
// only the commits that are new. Visitors get what's kept straight away while a refresh runs behind them.
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { HttpError } from './http-error.js';
import { json } from './http-response.js';

const API = 'https://api.github.com';
const FRESH = 5 * 60_000;      // how long the repository list counts as current
const RETRY = 60_000;          // after a failed refresh, wait at least this long before trying again
const MAX_REPOS = 60;
const MAX_COMMITS = 3000;      // per repository, newest kept
const PAGE = 100;              // GitHub's largest page
const RECENT = 40;             // commits across every repository, for the page's first list
const COMMITS_PAGE = 40;       // commits per page of /commits
const USER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const time = (iso) => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
};

/** One commit, kept small: short and full hash, the first line of the message, when it was written, and who wrote it. */
function commitOut(c) {
  const at = time(c?.commit?.author?.date) || time(c?.commit?.committer?.date);
  if (typeof c?.sha !== 'string' || !at) return null;
  return {
    sha: c.sha,
    m: str(String(c.commit?.message || '').split('\n')[0].trim(), 200),
    at,
    by: str(c.author?.login || c.commit?.author?.name || '', 60),
  };
}

function repoOut(r) {
  return {
    name: r.name,
    description: str(r.description || '', 300),
    url: str(r.html_url, 300),
    homepage: /^https?:\/\//.test(r.homepage || '') ? str(r.homepage, 300) : '',
    language: str(r.language || '', 40),
    topics: Array.isArray(r.topics) ? r.topics.filter((x) => typeof x === 'string').slice(0, 10) : [],
    stars: Number(r.stargazers_count) || 0,
    forks: Number(r.forks_count) || 0,
    issues: Number(r.open_issues_count) || 0,
    watchers: Number(r.subscribers_count ?? r.watchers_count) || 0,
    size: Number(r.size) || 0,
    fork: r.fork === true,
    archived: r.archived === true,
    branch: str(r.default_branch || '', 100),
    createdAt: time(r.created_at),
    pushedAt: time(r.pushed_at),
  };
}

/**
 * `user`: whose public repositories to show. `token`: optional, only to raise the rate limit (private repositories are
 * never listed). `cacheFile`: where to keep what was fetched. `request` stands in for fetch in tests.
 */
export function createGithubHandler({ user, token = '', cacheFile = '', request = globalThis.fetch, now = Date.now }) {
  // repos: name → { repo, commits (newest first), languages, pushedAt (what they were fetched for) }
  let store = { user: '', profile: null, checkedAt: 0, repos: {} };
  let loaded = null;
  let refreshing = null;
  let failedAt = 0;
  let lastError = '';
  let resetAt = 0; // when GitHub said the rate limit fills up again

  async function load() {
    if (!cacheFile) return;
    try {
      const saved = JSON.parse(await readFile(cacheFile, 'utf8'));
      if (saved?.user?.toLowerCase() === user.toLowerCase() && saved.repos && typeof saved.repos === 'object') store = saved;
    } catch {}
  }

  async function persist() {
    if (!cacheFile) return;
    const tmp = join(dirname(cacheFile), `.github-${randomBytes(6).toString('hex')}.tmp`);
    try {
      await mkdir(dirname(cacheFile), { recursive: true });
      await writeFile(tmp, JSON.stringify(store), 'utf8');
      await rename(tmp, cacheFile);
    } catch (e) {
      await unlink(tmp).catch(() => {});
      console.error('GitHub cache couldn’t be saved:', e.message);
    }
  }

  async function api(path) {
    let res;
    try {
      res = await request(API + path, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'MyMind',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new HttpError(502, 'Couldn’t reach GitHub. Try again.');
    }
    const body = await res.json().catch(() => null);
    if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
      resetAt = Number(res.headers.get('x-ratelimit-reset')) * 1000 || now() + 15 * 60_000;
      throw new HttpError(429, 'GitHub’s hourly limit is used up. It fills up again soon.');
    }
    if (res.status === 404) throw new HttpError(404, 'GitHub doesn’t know that.');
    if (res.status === 409) return null; // an empty repository has no commits yet
    if (!res.ok) throw new HttpError(502, body?.message ? `GitHub: ${str(body.message, 200)}` : `GitHub returned an error (${res.status}).`);
    return { body, link: res.headers.get('link') || '' };
  }

  /** New commits on a repository's default branch, newest first, down to the first one already kept. */
  async function newCommits(name, known, fork) {
    const out = [];
    // a fork's history is mostly someone else's; only count what you wrote in it
    const author = fork ? `&author=${encodeURIComponent(user)}` : '';
    for (let page = 1; page <= MAX_COMMITS / PAGE; page++) {
      const got = await api(`/repos/${encodeURIComponent(user)}/${encodeURIComponent(name)}/commits?per_page=${PAGE}&page=${page}${author}`);
      const list = Array.isArray(got?.body) ? got.body : [];
      for (const c of list) {
        if (known.has(c?.sha)) return { commits: out, reached: true };
        const one = commitOut(c);
        if (one) out.push(one);
      }
      if (list.length < PAGE || !/rel="next"/.test(got.link)) break;
    }
    return { commits: out, reached: false };
  }

  async function refreshRepo(r) {
    const kept = store.repos[r.name];
    const known = new Set((kept?.commits ?? []).map((c) => c.sha));
    const { commits: fresh, reached } = await newCommits(r.name, known, r.fork);
    // a history that was rewritten (nothing kept is in it any more) starts over
    const commits = (reached ? [...fresh, ...kept.commits] : fresh).slice(0, MAX_COMMITS);
    const langs = await api(`/repos/${encodeURIComponent(user)}/${encodeURIComponent(r.name)}/languages`);
    const languages = {};
    for (const [k, v] of Object.entries(langs?.body ?? {})) if (Number.isFinite(v) && v > 0) languages[str(k, 40)] = v;
    store.repos[r.name] = { repo: r, commits, languages, pushedAt: r.pushedAt };
  }

  async function refresh() {
    if (resetAt > now()) throw new HttpError(429, 'GitHub’s hourly limit is used up. It fills up again soon.');
    const [profile, list] = await Promise.all([api(`/users/${encodeURIComponent(user)}`), api(`/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed&type=owner`)]);
    const p = profile?.body ?? {};
    store.user = user;
    store.profile = {
      login: str(p.login || user, 60),
      name: str(p.name || '', 100),
      avatar: /^https:\/\//.test(p.avatar_url || '') ? str(p.avatar_url, 300) : '',
      url: str(p.html_url || `https://github.com/${user}`, 300),
      bio: str(p.bio || '', 300),
      followers: Number(p.followers) || 0,
      following: Number(p.following) || 0,
      createdAt: time(p.created_at),
    };
    const repos = (Array.isArray(list?.body) ? list.body : []).filter((r) => r && REPO.test(r.name || '') && !r.private).slice(0, MAX_REPOS).map(repoOut);
    const names = new Set(repos.map((r) => r.name));
    for (const name of Object.keys(store.repos)) if (!names.has(name)) delete store.repos[name];
    let failed = null;
    for (const r of repos) {
      const kept = store.repos[r.name];
      if (kept && kept.pushedAt === r.pushedAt) {
        kept.repo = r; // stars and descriptions change without a push
        continue;
      }
      try {
        await refreshRepo(r);
      } catch (e) {
        // keep what there was and carry on with the rest; the next refresh tries this one again
        if (kept) kept.repo = r;
        failed = e;
        if (e.status === 429) break;
      }
    }
    store.checkedAt = now();
    await persist();
    if (failed) throw failed;
  }

  /** Brings the store up to date when it's old, at most one refresh at a time; waits only when there's nothing yet. */
  async function current() {
    if (!loaded) loaded = load();
    await loaded;
    const stale = now() - store.checkedAt > FRESH && now() - failedAt > RETRY;
    if (stale && !refreshing) {
      refreshing = refresh()
        .then(() => (lastError = ''))
        .catch((e) => {
          failedAt = now();
          lastError = e instanceof HttpError ? e.message : 'Couldn’t reach GitHub. Try again.';
          if (!(e instanceof HttpError)) console.error('GitHub refresh failed:', e);
        })
        .finally(() => (refreshing = null));
    }
    if (!store.checkedAt && refreshing) await refreshing;
    if (!store.checkedAt) throw new HttpError(resetAt > now() ? 429 : 502, lastError || 'Couldn’t reach GitHub. Try again.');
    return store;
  }

  const ordered = (s) => Object.values(s.repos).sort((a, b) => b.repo.pushedAt - a.repo.pushedAt);

  function overview(s) {
    const repos = ordered(s);
    const recent = repos
      .flatMap((x) => x.commits.slice(0, RECENT).map((c) => ({ ...c, repo: x.repo.name })))
      .sort((a, b) => b.at - a.at)
      .slice(0, RECENT);
    return {
      user: s.user,
      profile: s.profile,
      now: now(),
      checkedAt: s.checkedAt,
      stale: !!lastError,
      repos: repos.map((x) => ({
        ...x.repo,
        commits: x.commits.length,
        languages: x.languages,
        // every commit's time in seconds, newest first: enough for the charts without the messages
        times: x.commits.map((c) => Math.round(c.at / 1000)),
        last: x.commits[0] ? { m: x.commits[0].m, at: x.commits[0].at } : null,
      })),
      recent,
    };
  }

  /** One page of commits, newest first: a repository's, or every repository's together. */
  function commitsPage(s, name, page) {
    let list;
    if (name) {
      const x = s.repos[name] ?? Object.values(s.repos).find((r) => r.repo.name.toLowerCase() === name.toLowerCase());
      if (!x) throw new HttpError(404, 'There’s no such project.');
      list = x.commits.map((c) => ({ ...c, repo: x.repo.name }));
    } else {
      list = ordered(s).flatMap((x) => x.commits.map((c) => ({ ...c, repo: x.repo.name }))).sort((a, b) => b.at - a.at);
    }
    const from = page * COMMITS_PAGE;
    return { commits: list.slice(from, from + COMMITS_PAGE), next: from + COMMITS_PAGE < list.length ? page + 1 : null, total: list.length };
  }

  return async function github(req, res, path, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    if (!user || !USER.test(user)) return json(res, 404, { error: 'GitHub projects aren’t set up on this server.' });
    const page = Math.max(0, Math.min(1000, Number.parseInt(url?.searchParams.get('page') || '0', 10) || 0));
    if (path === '/api/github') return json(res, 200, overview(await current()));
    if (path === '/api/github/commits') return json(res, 200, commitsPage(await current(), null, page));
    const m = path.match(/^\/api\/github\/repos\/([^/]+)\/commits$/);
    if (m) {
      let name;
      try { name = decodeURIComponent(m[1]); } catch { name = ''; }
      if (!REPO.test(name)) throw new HttpError(400, 'That isn’t a project name.');
      return json(res, 200, commitsPage(await current(), name, page));
    }
    throw new HttpError(404, 'Not found');
  };
}
