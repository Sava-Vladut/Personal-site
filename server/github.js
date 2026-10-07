// GitHub projects: repositories, their languages and every commit on their default branch, fetched from the GitHub
// API. There are two ways to see them:
//  • everyone sees GITHUB_USER's public repositories, kept in memory and on disk (data/github.json) so a restart
//    doesn't spend the rate limit again (60 requests an hour without a token, 5,000 with GITHUB_TOKEN);
//  • a browser signed in with GitHub (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET, an OAuth or GitHub App) also sees that
//    account's private repositories. Its token lives only in a sealed, http-only cookie in that browser, and what's
//    fetched with it is kept in memory, never on disk, and only ever sent back to a browser signed in as that account.
//    When GITHUB_USER is set, only that account can sign in.
// The repository list is looked at again every few minutes; a repository's commits and languages only when it has
// been pushed to since, and then only the commits that are new. Visitors get what's kept straight away while a
// refresh runs behind them.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { HttpError } from './http-error.js';
import { json } from './http-response.js';

const API = 'https://api.github.com';
const FRESH = 5 * 60_000;      // how long the repository list counts as current
const RETRY = 60_000;          // after a failed refresh, wait at least this long before trying again
const MAX_REPOS = 100;
const MAX_COMMITS = 3000;      // per repository, newest kept
const PAGE = 100;              // GitHub's largest page
const RECENT = 40;             // commits across every repository, for the page's first list
const COMMITS_PAGE = 40;       // commits per page of /commits
const AT_ONCE = 4;             // repositories fetched side by side
const USER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const SESSION = 'mm_gh';
const STATE = 'mm_ghstate';
const PATH = '/api/github';
const YEAR = 365 * 86_400;
const MAX_SIGNED_IN = 5;       // accounts kept in memory at once

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const time = (iso) => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
};
const headers = (token) => ({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'MyMind',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

function sameState(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/** One commit, kept small: its hash, the first line of the message, when it was written, and who wrote it. */
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
    private: r.private === true,
    branch: str(r.default_branch || '', 100),
    createdAt: time(r.created_at),
    pushedAt: time(r.pushed_at),
  };
}

function profileOut(p, user) {
  return {
    login: str(p.login || user, 60),
    name: str(p.name || '', 100),
    avatar: /^https:\/\//.test(p.avatar_url || '') ? str(p.avatar_url, 300) : '',
    url: str(p.html_url || `https://github.com/${user}`, 300),
    bio: str(p.bio || '', 300),
    followers: Number(p.followers) || 0,
    following: Number(p.following) || 0,
    createdAt: time(p.created_at),
  };
}

/**
 * One account's repositories, as they're fetched and kept. `signedIn`: seen with that account's own token, so its
 * private repositories are included; otherwise only public ones, and they may be kept on disk (`cacheFile`).
 */
function createSource({ user, token, signedIn, cacheFile = '', request, now }) {
  // repos: name → { repo, commits (newest first), languages, pushedAt (what they were fetched for) }
  let store = { user: '', profile: null, checkedAt: 0, repos: {} };
  let loaded = null;
  let refreshing = null;
  let failedAt = 0;
  let lastError = '';
  let resetAt = 0; // when GitHub said the rate limit fills up again
  let revoked = false; // the token stopped working: signed out on GitHub, or the app's access was taken back
  const owner = encodeURIComponent(user);

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
      res = await request(API + path, { headers: headers(token()), signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new HttpError(502, 'Couldn’t reach GitHub. Try again.');
    }
    const body = await res.json().catch(() => null);
    if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
      resetAt = Number(res.headers.get('x-ratelimit-reset')) * 1000 || now() + 15 * 60_000;
      throw new HttpError(429, 'GitHub’s hourly limit is used up. It fills up again soon.');
    }
    if (res.status === 401 && signedIn) {
      revoked = true;
      throw new HttpError(401, 'Your GitHub sign-in has expired. Sign in again.');
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
    const author = fork ? `&author=${owner}` : '';
    for (let page = 1; page <= MAX_COMMITS / PAGE; page++) {
      const got = await api(`/repos/${owner}/${encodeURIComponent(name)}/commits?per_page=${PAGE}&page=${page}${author}`);
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
    const langs = await api(`/repos/${owner}/${encodeURIComponent(r.name)}/languages`);
    const languages = {};
    for (const [k, v] of Object.entries(langs?.body ?? {})) if (Number.isFinite(v) && v > 0) languages[str(k, 40)] = v;
    store.repos[r.name] = { repo: r, commits, languages, pushedAt: r.pushedAt };
  }

  async function refresh() {
    if (resetAt > now()) throw new HttpError(429, 'GitHub’s hourly limit is used up. It fills up again soon.');
    // signed in, the account's own list has its private repositories in it too
    const [profile, list] = await Promise.all([
      api(signedIn ? '/user' : `/users/${owner}`),
      api(signedIn ? '/user/repos?per_page=100&sort=pushed&affiliation=owner&visibility=all' : `/users/${owner}/repos?per_page=100&sort=pushed&type=owner`),
    ]);
    store.user = user;
    store.profile = profileOut(profile?.body ?? {}, user);
    const repos = (Array.isArray(list?.body) ? list.body : [])
      .filter((r) => r && REPO.test(r.name || '') && (signedIn || !r.private))
      .slice(0, MAX_REPOS)
      .map(repoOut);
    const names = new Set(repos.map((r) => r.name));
    for (const name of Object.keys(store.repos)) if (!names.has(name)) delete store.repos[name];
    const todo = [];
    for (const r of repos) {
      const kept = store.repos[r.name];
      if (kept && kept.pushedAt === r.pushedAt) kept.repo = r; // stars and descriptions change without a push
      else todo.push(r);
    }
    let failed = null;
    // a token that stopped working or a spent rate limit won't get better for the rest of the list
    for (let i = 0; i < todo.length && !(failed?.status === 401 || failed?.status === 429); i += AT_ONCE) {
      await Promise.all(todo.slice(i, i + AT_ONCE).map((r) => refreshRepo(r).catch((e) => {
        // keep what there was and carry on with the rest; the next refresh tries this one again
        if (store.repos[r.name]) store.repos[r.name].repo = r;
        failed = e;
      })));
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
    if (revoked) throw new HttpError(401, 'Your GitHub sign-in has expired. Sign in again.');
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

  return { current, overview, commitsPage, revoked: () => revoked };
}

/**
 * `user`: whose repositories everyone sees. `token`: optional, only to raise the rate limit. `cacheFile`: where to keep
 * the public ones. Signing in needs `clientId`, `clientSecret` and `redirectUri` (this server's /api/github/callback),
 * plus the server's `seal`/`unseal` (encrypted cookies), `readCookies(req)` and `cookie(name, value, maxAge, path)`.
 * `appUrl` is where to land after signing in. `request` stands in for fetch in tests.
 */
export function createGithubHandler({
  user, token = '', cacheFile = '', request = globalThis.fetch, now = Date.now,
  clientId = '', clientSecret = '', redirectUri = '', appUrl = '', seal, unseal, readCookies, cookie,
}) {
  const owner = user && USER.test(user) ? user : '';
  const pub = owner ? createSource({ user: owner, token: () => token, signedIn: false, cacheFile, request, now }) : null;
  const canSignIn = !!(clientId && clientSecret && redirectUri && seal && unseal && readCookies && cookie);
  const signedIn = new Map(); // login, lowercased → { source, token }
  const renewing = new Map(); // refresh token → the renewal under way (and for a minute after, for requests still holding it)
  const clear = () => cookie(SESSION, '', 0, PATH);
  const allowed = (login) => !owner || login.toLowerCase() === owner.toLowerCase();

  /** GitHub's token endpoint: a code or a refresh token in, a token out. */
  async function tokenFor(params) {
    let res;
    try {
      res = await request('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'MyMind' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new HttpError(502, 'Couldn’t reach GitHub. Try again.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || typeof body?.access_token !== 'string' || !body.access_token)
      throw new HttpError(res.ok || res.status < 500 ? 401 : 502, 'GitHub didn’t sign you in. Try again.');
    return body;
  }

  // GitHub App tokens last eight hours and come with a refresh token; OAuth App tokens last until they're revoked
  const sessionOf = (b, login, avatar) => ({
    a: b.access_token,
    r: typeof b.refresh_token === 'string' ? b.refresh_token : null,
    e: Number(b.expires_in) > 0 ? now() + Number(b.expires_in) * 1000 - 60_000 : 0,
    u: login,
    av: avatar,
  });

  /** Takes a token back from GitHub, so it stops working at once. Best effort: it's gone from here either way. */
  async function revoke(accessToken) {
    if (!accessToken || !clientId || !clientSecret) return;
    try {
      await request(`${API}/applications/${encodeURIComponent(clientId)}/token`, {
        method: 'DELETE',
        headers: { ...headers(''), Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {}
  }

  /** The account this browser is signed in with, renewing its token when it's run out, or null. May queue a Set-Cookie. */
  async function viewerOf(req, setCookies) {
    if (!canSignIn) return null;
    const s = unseal(readCookies(req)[SESSION] || '');
    if (!s?.a || typeof s.u !== 'string' || !USER.test(s.u) || !allowed(s.u)) return null;
    if (!s.e || s.e > now()) return s;
    if (!s.r) {
      setCookies.push(clear());
      return null;
    }
    let renewal = renewing.get(s.r);
    if (!renewal) {
      renewal = tokenFor({ grant_type: 'refresh_token', refresh_token: s.r });
      renewing.set(s.r, renewal);
      const forget = () => setTimeout(() => renewing.delete(s.r), 60_000).unref?.();
      renewal.then(forget, forget);
    }
    try {
      const next = sessionOf(await renewal, s.u, s.av);
      setCookies.push(cookie(SESSION, seal(next), YEAR, PATH));
      return next;
    } catch (e) {
      if (e.status >= 500) throw e;
      setCookies.push(clear());
      return null;
    }
  }

  /** Where this browser's projects come from: its own account's, private ones included, or everyone's. */
  async function sourceFor(req, setCookies) {
    const viewer = await viewerOf(req, setCookies);
    if (!viewer) return { src: pub, viewer: null };
    const key = viewer.u.toLowerCase();
    let kept = signedIn.get(key);
    if (kept?.source.revoked()) {
      signedIn.delete(key);
      setCookies.push(clear());
      return { src: pub, viewer: null };
    }
    if (!kept) {
      kept = { token: viewer.a, source: null };
      const box = kept;
      kept.source = createSource({ user: viewer.u, token: () => box.token, signedIn: true, request, now });
      signedIn.set(key, kept);
      if (signedIn.size > MAX_SIGNED_IN) signedIn.delete(signedIn.keys().next().value);
    }
    kept.token = viewer.a; // the newest one this account has signed in with
    return { src: kept.source, viewer };
  }

  const who = (viewer) => (viewer ? { login: viewer.u, avatar: /^https:\/\//.test(viewer.av || '') ? viewer.av : '' } : null);

  /** Answers from this browser's projects; a sign-in that stopped working falls back to everyone's, signed out. */
  async function serve(req, res, answer) {
    const setCookies = [];
    let { src, viewer } = await sourceFor(req, setCookies);
    const send = (status, body) => json(res, status, body, setCookies.length ? { 'Set-Cookie': setCookies } : {});
    const run = async () => {
      if (!src) return send(404, { error: 'GitHub projects aren’t set up on this server.', signIn: canSignIn });
      return send(200, answer(src, await src.current(), viewer));
    };
    try {
      return await run();
    } catch (e) {
      if (!viewer || e.status !== 401) {
        if (e instanceof HttpError) return send(e.status, { error: e.message });
        throw e;
      }
      signedIn.delete(viewer.u.toLowerCase());
      setCookies.push(clear());
      ({ src, viewer } = { src: pub, viewer: null });
      try {
        return await run();
      } catch (e2) {
        if (e2 instanceof HttpError) return send(e2.status, { error: e2.message });
        throw e2;
      }
    }
  }

  function redirect(res, location, cookies = []) {
    res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', ...(cookies.length ? { 'Set-Cookie': cookies } : {}) });
    res.end();
  }

  async function connect(res, url) {
    if (!canSignIn) throw new HttpError(400, 'GitHub sign-in isn’t set up on this server.');
    const state = randomBytes(16).toString('hex');
    const back = url.searchParams.get('back') || '';
    const auth = new URL('https://github.com/login/oauth/authorize');
    auth.search = new URLSearchParams({
      client_id: clientId, redirect_uri: redirectUri, state, allow_signup: 'false',
      // an OAuth App needs `repo` to read private repositories; a GitHub App goes by its own (read-only) permissions
      scope: 'repo read:user',
      ...(owner ? { login: owner } : {}),
    }).toString();
    return redirect(res, auth.href, [cookie(STATE, seal({ s: state, b: /^#\/[\w/-]*$/.test(back) ? back : '#/projects' }), 600, PATH)]);
  }

  async function callback(req, res, url) {
    const st = canSignIn ? unseal(readCookies(req)[STATE] || '') : null;
    const back = st?.b || '#/projects';
    const done = (result, more = []) => redirect(res, `${appUrl}/${back}?github=${result}`, canSignIn ? [cookie(STATE, '', 0, PATH), ...more] : []);
    if (!st || !sameState(url.searchParams.get('state'), st.s)) return done('error');
    const code = url.searchParams.get('code');
    if (!code) return done(url.searchParams.get('error') === 'access_denied' ? 'cancelled' : 'error');
    try {
      const got = await tokenFor({ code, redirect_uri: redirectUri });
      const me = await request(`${API}/user`, { headers: headers(got.access_token), signal: AbortSignal.timeout(15_000) });
      const p = await me.json().catch(() => null);
      if (!me.ok || typeof p?.login !== 'string' || !USER.test(p.login)) throw new Error(`GitHub /user returned ${me.status}`);
      if (!allowed(p.login)) {
        await revoke(got.access_token);
        return done('wrong-account');
      }
      signedIn.delete(p.login.toLowerCase()); // a fresh sign-in starts from a fresh list
      return done('connected', [cookie(SESSION, seal(sessionOf(got, p.login, p.avatar_url)), YEAR, PATH)]);
    } catch (e) {
      console.error('GitHub sign-in failed:', e.message);
      return done('error');
    }
  }

  async function disconnect(req, res) {
    const s = canSignIn ? unseal(readCookies(req)[SESSION] || '') : null;
    if (s?.u) signedIn.delete(String(s.u).toLowerCase());
    if (s?.a) await revoke(s.a);
    return json(res, 200, { connected: false }, canSignIn ? { 'Set-Cookie': [clear()] } : {});
  }

  async function status(req, res) {
    const setCookies = [];
    const viewer = await viewerOf(req, setCookies);
    return json(res, 200, { configured: canSignIn, connected: !!viewer, viewer: who(viewer), owner: owner || null, redirect: redirectUri || null },
      setCookies.length ? { 'Set-Cookie': setCookies } : {});
  }

  return async function github(req, res, path, url) {
    const page = Math.max(0, Math.min(1000, Number.parseInt(url?.searchParams.get('page') || '0', 10) || 0));
    if (path === '/api/github/disconnect') {
      if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
      return disconnect(req, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    if (path === '/api/github/status') return status(req, res);
    if (path === '/api/github/connect') return connect(res, url);
    if (path === '/api/github/callback') return callback(req, res, url);
    if (path === '/api/github') return serve(req, res, (src, s, viewer) => ({ ...src.overview(s), viewer: who(viewer), signIn: canSignIn }));
    if (path === '/api/github/commits') return serve(req, res, (src, s) => src.commitsPage(s, null, page));
    const m = path.match(/^\/api\/github\/repos\/([^/]+)\/commits$/);
    if (m) {
      let name;
      try { name = decodeURIComponent(m[1]); } catch { name = ''; }
      if (!REPO.test(name)) throw new HttpError(400, 'That isn’t a project name.');
      return serve(req, res, (src, s) => src.commitsPage(s, name, page));
    }
    throw new HttpError(404, 'Not found');
  };
}
