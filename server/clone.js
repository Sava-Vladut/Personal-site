// Clones one of your GitHub repos onto the server (CLONE_DIR), started from a repo's page.
// Only the GitHub account CLONE_GITHUB_ID may do it, and only for repos that account owns; index.js checks
// the admin cookie and asks GitHub who the token belongs to before calling start().
// One clone runs at a time. It lands in a hidden folder first and is renamed into place once git finishes,
// so a failed or timed-out clone never leaves a half-made repo behind. The token reaches git through
// environment config, never the URL, the command line or the clone's .git/config.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError } from './http-error.js';

const NAME = /^[A-Za-z0-9._-]{1,100}$/;
const CLONE_URL = /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.git$/;
const KEEP = 20; // finished clones remembered for the page

export function createCloner({
  directory,
  ownerId,
  shownDirectory = directory,
  git = 'git',
  timeoutMs = 10 * 60_000,
  maxKb = 1024 * 1024,           // GitHub reports a repo's size in KB: 1 GB
  minFreeBytes = 2 * 1024 ** 3,  // what must be left on the disk
}) {
  const owner = ownerId ? String(ownerId) : '';
  const jobs = []; // newest first
  let running = null;

  const enabled = () => !!(directory && owner);
  const isOwner = (userId) => enabled() && userId != null && String(userId) === owner;
  const shown = (name) => `${shownDirectory.replace(/\/+$/, '')}/${name}`;
  const remember = (job) => {
    jobs.unshift(job);
    jobs.length = Math.min(jobs.length, KEEP);
  };

  async function start({ user, repo, token }) {
    if (!enabled()) throw new HttpError(404, 'Cloning isn’t set up on this server.');
    if (!isOwner(user?.id)) throw new HttpError(403, 'Only the site’s owner can clone repos onto the server.');
    if (String(repo?.owner?.id) !== owner) throw new HttpError(403, 'You can only clone your own repos.');
    const name = typeof repo.name === 'string' ? repo.name : '';
    if (!NAME.test(name) || name.startsWith('.')) throw new HttpError(400, 'That repo’s name can’t be used as a folder.');
    if (typeof repo.clone_url !== 'string' || !CLONE_URL.test(repo.clone_url)) throw new HttpError(502, 'GitHub didn’t answer. Try again.');
    if (running) throw new HttpError(409, 'A clone is already running. Wait for it to finish.');
    if (Number.isFinite(repo.size) && repo.size > maxKb) throw new HttpError(413, 'That repo is too big to clone here.');

    const job = { id: repo.id, name, path: shown(name), state: 'running', startedAt: Date.now() };
    running = job; // taken before waiting on the disk, so a second request at the same moment is turned away
    try {
      await mkdir(directory, { recursive: true });
      if (existsSync(join(directory, name))) throw new HttpError(409, 'That repo is already on the server.');
      const disk = await statfs(directory);
      if (disk.bavail * disk.bsize < minFreeBytes) throw new HttpError(507, 'The server’s disk is too full to clone it.');
    } catch (e) {
      running = null;
      throw e;
    }
    remember(job);
    run(job, repo.clone_url, join(directory, name), token).finally(() => { running = null; });
    return job;
  }

  async function run(job, url, dest, token) {
    const temp = join(directory, `.clone-${job.name}-${randomBytes(4).toString('hex')}`);
    const finish = (state, error) => Object.assign(job, { state, endedAt: Date.now() }, error ? { error } : {});
    try {
      await clone(url, temp, token);
      // someone may have made the folder while git was busy
      if (existsSync(dest)) throw new Error('That repo is already on the server.');
      await rename(temp, dest);
      finish('done');
    } catch (e) {
      await rm(temp, { recursive: true, force: true }).catch(() => {});
      finish('failed', e.message || 'git couldn’t clone it.');
      console.error(`Clone of ${job.name} failed:`, e.message);
    }
  }

  function clone(url, into, token) {
    const header = 'Authorization: Basic ' + Buffer.from(`x-access-token:${token}`).toString('base64');
    const env = {
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      HOME: directory,
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraHeader',
      GIT_CONFIG_VALUE_0: header,
    };
    return new Promise((resolve, reject) => {
      const child = spawn(git, ['clone', '--quiet', '--', url, into], { env, stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      child.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('The clone took too long and was stopped.')); }, timeoutMs);
      child.on('error', (e) => { clearTimeout(timer); reject(new Error(e.code === 'ENOENT' ? 'git isn’t installed on the server.' : e.message)); });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) return resolve();
        const last = err.trim().split('\n').pop()?.replace(/^fatal:\s*/, '').slice(0, 300);
        reject(new Error(last || 'git couldn’t clone it.'));
      });
    });
  }

  return {
    enabled,
    isOwner,
    start,
    list: () => jobs.map((j) => ({ ...j })),
    /** Resolves once the running clone (if any) has finished: for tests. */
    idle: async () => { while (running) await new Promise((r) => setTimeout(r, 10)); },
  };
}
