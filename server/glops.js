// Global Ops port: how the browser port of Global Operations (worked on in GLOPS_DIR on this server, mounted
// read-only) is coming along, read live from its folder: the port's PORTING_LOG.md, its git history and the changes
// not committed yet, what was touched lately (sources, builds, the deployed wasm), the newest logs and screenshots,
// and activity.jsonl, which a Claude Code hook appends to while someone works on the port. Admin only: the log names
// paths on the server, and the screenshots are the game's.
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { open, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { HttpError } from './http-error.js';

const run = promisify(execFile);
const FRESH_MS = 3_000;     // a snapshot is shared by the requests within a few seconds of it
const LIVE_MS = 10 * 60_000; // something changed this recently: the port is being worked on
const RECENT_MS = 86_400_000; // files touched in the last day are listed
const COMMITS = 40;
const EVENTS = 200;
const LOGS = 5;
const LOG_BYTES = 16_384;
const LOG_LINES = 120;
const SHOTS = 6;
const SHOT = /^[\w.-]{1,80}\.png$/;
// where the port's logs land: logs/ for anything teed on purpose, and what the builds and the browser driver write
const LOG_DIRS = ['logs', 'port/recomp/build_linux', 'port/recomp/build_web', 'shots'];
const BUILDS = [
  ['native', 'port/recomp/build_linux/game'],
  ['browser', 'port/recomp/build_web/www/game.wasm'],
  ['deployed', 'dist/build/game.wasm'],
];

const mtime = (path) => stat(path).then((s) => Math.round(s.mtimeMs), () => null);

/** The end of a file: its last `bytes`, cut to whole lines. */
async function tail(path, bytes) {
  const f = await open(path, 'r');
  try {
    const { size } = await f.stat();
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    await f.read(buf, 0, buf.length, start);
    const text = buf.toString('utf8');
    return start ? text.slice(text.indexOf('\n') + 1) : text;
  } finally {
    await f.close();
  }
}

/**
 * PORTING_LOG.md as its sections. A section that is a bullet list (after a line or two introducing it) also comes as
 * items, each with the date it starts with ("- 2026-10-25 (morning): …") and, for a checklist, whether it's done.
 */
export function parseLog(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  const title = lines[0]?.match(/^#\s+(.*)/)?.[1].trim() ?? '';
  const sections = [];
  let cur = { title: '', lines: [] };
  for (const line of title ? lines.slice(1) : lines) {
    const m = line.match(/^##\s+(.*)/);
    if (m) sections.push(cur), (cur = { title: m[1].trim(), lines: [] });
    else cur.lines.push(line);
  }
  sections.push(cur);
  return {
    title,
    sections: sections
      .map((s) => ({ title: s.title, body: s.lines.join('\n').trim() }))
      .filter((s) => s.title || s.body)
      .map((s) => ({ ...s, items: items(s.body) })),
  };
}

function items(body) {
  const lines = body.split('\n');
  const first = lines.findIndex((l) => l.startsWith('- '));
  if (first < 0) return null;
  const out = [];
  for (const line of lines.slice(first)) { // a line or two before the list introduces it
    if (line.startsWith('- ')) out.push(line.slice(2));
    else if (!line.trim()) continue;
    else if (/^\s/.test(line) && out.length) out[out.length - 1] += ' ' + line.trim();
    else return null; // prose between the bullets: show the section as it's written
  }
  return out.map((text) => {
    const task = text.match(/^\[([ xX])\]\s+(.*)$/);
    if (task) return { text: task[2], done: task[1] !== ' ' };
    const dated = text.match(/^(\d{4}-\d{2}-\d{2})(?:\s*\(([^)]*)\))?:\s*(.*)$/);
    return dated ? { text: dated[3], date: dated[1], when: dated[2] ?? '' } : { text };
  });
}

/** One activity.jsonl line, or null if it isn't one. */
function event(line) {
  try {
    const e = JSON.parse(line);
    if (!Number.isFinite(e?.t) || typeof e.ev !== 'string') return null;
    return { t: e.t, ev: e.ev, s: String(e.s ?? '').slice(0, 12), tool: String(e.tool ?? '').slice(0, 40), text: String(e.text ?? '').slice(0, 300) };
  } catch {
    return null;
  }
}

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

export function createGlopsHandler({ directory, isAdmin }) {
  const port = directory && join(directory, 'port');
  const git = (...args) => run('git', ['-C', port, ...args], { timeout: 8_000, maxBuffer: 4 << 20, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).then((r) => r.stdout);

  async function commits() {
    const out = await git('log', `-n${COMMITS}`, '--format=%x1e%H%x1f%at%x1f%an%x1f%s%x1f%b%x1f', '--numstat');
    return out.split('\x1e').filter(Boolean).map((rec) => {
      const [hash, at, author, subject, body, numstat = ''] = rec.split('\x1f');
      let added = 0, removed = 0, files = 0;
      for (const l of numstat.trim().split('\n').filter(Boolean)) {
        const [a, r] = l.split('\t');
        files++, (added += Number(a) || 0), (removed += Number(r) || 0);
      }
      return { hash: hash.slice(0, 7), at: Number(at) * 1000, author, subject, body: body.trim(), files, added, removed };
    });
  }

  /** What's changed since the last commit, with what each file gained and lost, newest edit first. */
  async function changes() {
    const [status, numstat] = await Promise.all([git('status', '--porcelain=v1', '--untracked-files=all'), git('diff', 'HEAD', '--numstat')]);
    const counts = new Map(numstat.split('\n').filter(Boolean).map((l) => {
      const [a, r, path] = l.split('\t');
      return [path, [Number(a) || 0, Number(r) || 0]];
    }));
    const out = [];
    for (const l of status.split('\n').filter(Boolean)) {
      const code = l.slice(0, 2), path = l.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, '');
      const at = await mtime(join(port, path));
      let [added, removed] = counts.get(path) ?? [0, 0];
      if (code === '??') {
        const s = await stat(join(port, path)).catch(() => null);
        if (s?.isFile() && s.size < 1 << 20) added = (await readFile(join(port, path), 'utf8')).split('\n').length;
      }
      out.push({ path, state: code === '??' ? 'new' : code.includes('D') ? 'deleted' : code.includes('A') ? 'added' : 'changed', added, removed, at });
    }
    return out.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  }

  /** The port's own files (not the game's: they're ignored) touched in the last day, newest first. */
  async function touched(now) {
    const files = (await git('ls-files', '-z', '--cached', '--others', '--exclude-standard')).split('\0').filter(Boolean);
    const out = [];
    for (const path of files) {
      const at = await mtime(join(port, path));
      if (at && now - at < RECENT_MS) out.push({ path, at });
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 20);
  }

  async function newest(dir, test, n) {
    const names = await readdir(join(directory, dir)).catch(() => []);
    const found = await Promise.all(names.filter(test).map(async (name) => {
      const s = await stat(join(directory, dir, name)).catch(() => null);
      return s?.isFile() ? { dir, name, at: Math.round(s.mtimeMs), size: s.size } : null;
    }));
    return found.filter(Boolean).sort((a, b) => b.at - a.at).slice(0, n);
  }

  async function logs() {
    const all = (await Promise.all(LOG_DIRS.map((d) => newest(d, (n) => n.endsWith('.log'), LOGS)))).flat();
    const picked = all.sort((a, b) => b.at - a.at).slice(0, LOGS);
    return Promise.all(picked.map(async (f) => {
      const lines = (await tail(join(directory, f.dir, f.name), LOG_BYTES).catch(() => '')).replace(ANSI, '').replace(/\r/g, '').trimEnd().split('\n');
      return { path: `${f.dir}/${f.name}`, at: f.at, size: f.size, lines: lines.slice(-LOG_LINES) };
    }));
  }

  async function activity() {
    const text = await tail(join(directory, 'activity.jsonl'), 96 * 1024).catch(() => '');
    return text.split('\n').map(event).filter(Boolean).slice(-EVENTS).reverse();
  }

  async function snapshot() {
    const now = Date.now();
    const logPath = join(port, 'PORTING_LOG.md');
    const settle = (p, fallback) => p.catch((e) => (console.error('glops:', e.message), fallback));
    const [md, logAt, commitList, changeList, touchedList, logList, shots, events, builds] = await Promise.all([
      readFile(logPath, 'utf8').catch(() => ''),
      mtime(logPath),
      settle(commits(), []),
      settle(changes(), []),
      settle(touched(now), []),
      settle(logs(), []),
      newest('shots', (n) => SHOT.test(n), SHOTS),
      activity(),
      Promise.all(BUILDS.map(async ([name, path]) => ({ name, at: await mtime(join(directory, path)) }))),
    ]);
    const lastWork = Math.max(0, logAt ?? 0, commitList[0]?.at ?? 0, events[0]?.t ?? 0, ...[...changeList, ...touchedList, ...logList, ...builds].map((x) => x.at ?? 0));
    // the session that stopped last, if nothing happened after it
    const paused = events[0]?.ev === 'stop';
    return {
      now,
      lastWork: lastWork || null,
      live: !!lastWork && now - lastWork < LIVE_MS && !(paused && events[0].t >= lastWork - 1_000),
      log: { ...parseLog(md), at: logAt },
      commits: commitList,
      changes: changeList,
      touched: touchedList,
      builds,
      logs: logList,
      shots: shots.map(({ name, at }) => ({ name, at })),
      activity: events,
    };
  }

  let cached = null, cachedAt = 0, pending = null;
  async function current() {
    if (cached && Date.now() - cachedAt < FRESH_MS) return cached;
    pending ??= snapshot().then((s) => {
      const body = JSON.stringify(s);
      cached = { body, etag: `"${createHash('sha1').update(body.replace(/^\{"now":\d+,/, '{')).digest('base64url').slice(0, 20)}"` };
      cachedAt = Date.now();
      return cached;
    }).finally(() => (pending = null));
    return pending;
  }

  return async function glops(req, res, p) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    if (!directory) throw new HttpError(404, 'The Global Ops port isn’t on this server.');
    if (!isAdmin(req)) throw new HttpError(403, 'Sign in to the site to follow the port.');
    if (p === '/api/glops') {
      const { body, etag } = await current();
      const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-cache', ETag: etag };
      if (req.headers['if-none-match'] === etag) return res.writeHead(304, headers).end();
      return res.writeHead(200, headers).end(body);
    }
    const shot = p.match(/^\/api\/glops\/shots\/([^/]+)$/)?.[1];
    if (shot && SHOT.test(shot)) {
      const path = join(directory, 'shots', shot);
      const s = await stat(path).catch(() => null);
      if (!s?.isFile()) throw new HttpError(404, 'That screenshot is gone.');
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': s.size, 'Cache-Control': 'private, max-age=60' });
      return void createReadStream(path).pipe(res);
    }
    throw new HttpError(404, 'Not found');
  };
}
