// Talks to our own server (server/index.js), which holds the GitHub client secret and
// keeps the access token in an encrypted, http-only cookie. The browser never sees either.
export interface GithubStatus {
  configured: boolean;       // server has GITHUB_CLIENT_ID / SECRET
  connected: boolean;        // this browser has signed in to GitHub
  user?: { name: string };
  public?: number;           // public repos
  private?: number;          // private repos (only when GitHub lets us see them)
  privateVisible?: boolean;
  error?: string;
  offline?: boolean;
}

export const githubStatus = () =>
  fetch('/api/github/status', { credentials: 'same-origin' })
    .then((r) => (r.ok ? (r.json() as Promise<GithubStatus>) : Promise.reject()))
    .catch(() => ({ configured: false, connected: false, offline: true }) as GithubStatus);

/** Leaves for GitHub's sign-in; comes back to Settings with ?github=connected. */
export const connectGithub = () => {
  location.href = '/api/github/connect';
};
export const disconnectGithub = () => fetch('/api/github/disconnect', { method: 'POST' });
