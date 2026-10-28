// Global Ops dev: how work on the browser port of Global Operations (GLOPS_DIR on this server, mounted read-only) is
// going, read live from its folder: the port's git state (branch, what's pushed, commits with their files, changes not
// committed yet), deploys (the backups each deploy leaves in backups/, matched to their PORTING_LOG.md entry), build
// times, PORTING_LOG.md itself, the newest logs and screenshots, and activity.jsonl, which a Claude Code hook
// (tools/activity-hook.sh there) appends to while agents work on the port: each tool call, prompt and final reply,
// grouped here into sessions. Admin only: it names paths on the server, and the prompts are the owner's.
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { open, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { HttpError } from './http-error.js';

const run = promisify(execFile);
const FRESH_MS = 3_000;      // a snapshot is shared by the requests within a few seconds of it
const LIVE_MS = 10 * 60_000; // something changed this recently: the port is being worked on
const WORKING_MS = 5 * 60_000; // a session that did something this recently, and hasn't stopped, is working
const SESSION_DAYS = 3;      // sessions active in the last few days are listed
const RECENT_MS = 86_400_000; // files touched in the last day are listed
const COMMITS = 50;
const COMMIT_FILES = 40;
const EVENTS = 400;
const ACTIVITY_BYTES = 768 * 1024;
const DEPLOYS = 40;
const LOGS = 5;
const LOG_BYTES = 16_384;
const LOG_LINES = 120;
const SHOTS = 6;
const SHOT = /^[\w.-]{1,80}\.png$/;
// where the port's logs land: logs/ for anything teed on purpose, and what the builds and the browser driver write
const LOG_DIRS = ['logs', 'port/recomp/build_linux', 'port/recomp/build_web', 'shots'];
// what's live: the game build and the page; the builds are every recomp/build_* folder's (sessions keep their own)
const LIVE = [
  ['deployed', 'dist/build/game.wasm'],
  ['page', 'dist/index.html'],
];
const BUILT = [
  ['native', 'game'],
  ['browser', 'www/game.wasm'],
];
// a backup folder's name says what was deployed: <kind>-<topic>-YYYYMMDD-HHMM (UTC)
const DEPLOY_KINDS = [
  [/^glops-dist-?/, 'page'],
  [/^glops-mp-?/, 'multiplayer'],
  [/^glopsd-?/, 'servers'],
  [/^glops-relay-?/, 'relay'],
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
 * items, each with the date it starts with ("- 2026-10-28 15:06 (map fix): …") and, for a checklist, whether it's done.
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
    const dated = text.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}))?(?:\s*\(([^)]*)\))?:\s*(.*)$/);
    if (!dated) return { text };
    const item = { text: dated[4], date: dated[1], when: dated[3] ?? '' };
    if (dated[2]) item.time = dated[2];
    return item;
  });
}

/** One activity.jsonl line, or null if it isn't one. */
function event(line) {
  try {
    const e = JSON.parse(line);
    if (!Number.isFinite(e?.t) || typeof e.ev !== 'string') return null;
    const max = e.ev === 'tool' ? 300 : 900;
    return { t: e.t, ev: e.ev, s: String(e.s ?? '').slice(0, 12), tool: String(e.tool ?? '').slice(0, 40), text: String(e.text ?? '').slice(0, max) };
  } catch {
    return null;
  }
}

const EDITS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/**
 * The activity grouped by session, the latest first: when it started and last did something, whether it's working
 * (did something lately and hasn't stopped), waiting (stopped: its turn is over) or idle, what it was asked, what it
 * last said, what it last did, and the files it edited most.
 */
export function sessionsOf(events, now) {
  const by = new Map();
  for (const e of events) { // oldest first
    if (!e.s) continue;
    let s = by.get(e.s);
    if (!s) by.set(e.s, (s = { id: e.s, first: e.t, last: e.t, tools: 0, edits: 0, commands: 0, turns: 0, prompts: [], reply: null, replyAt: null, action: null, stopped: false, files: new Map() }));
    s.last = Math.max(s.last, e.t);
    if (e.ev === 'tool') {
      s.tools++, (s.stopped = false), (s.action = { t: e.t, tool: e.tool, text: e.text });
      if (e.tool === 'Bash') s.commands++;
      if (EDITS.has(e.tool) && e.text) s.edits++, s.files.set(e.text, (s.files.get(e.text) ?? 0) + 1);
    } else if (e.ev === 'prompt') {
      s.stopped = false, s.prompts.push({ t: e.t, text: e.text });
    } else if (e.ev === 'stop') {
      s.turns++, (s.stopped = true);
      if (e.text) (s.reply = e.text), (s.replyAt = e.t);
    }
  }
  return [...by.values()]
    .filter((s) => now - s.last < SESSION_DAYS * RECENT_MS)
    .sort((a, b) => b.last - a.last)
    .map(({ files, stopped, prompts, ...s }) => ({
      ...s,
      state: stopped ? 'waiting' : now - s.last < WORKING_MS ? 'working' : 'idle',
      minutes: Math.round((s.last - s.first) / 60_000),
      prompts: prompts.slice(-5).reverse(),
      files: [...files].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([path, n]) => ({ path, n })),
    }));
}

/** A backup folder's deploy, or null if the name isn't one: what kind, about what, and when (UTC, to the minute). */
export function deployOf(name) {
  const m = name.match(/^(.+?)-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/);
  if (!m) return null;
  const at = Date.UTC(+m[2], +m[3] - 1, +m[4], +m[5], +m[6]);
  if (!Number.isFinite(at)) return null;
  const [re, kind] = DEPLOY_KINDS.find(([re]) => re.test(m[1])) ?? [null, 'other'];
  const topic = (re ? m[1].replace(re, '') : m[1]).replace(/-/g, ' ');
  return { name, at, kind, topic };
}

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

export function createGlopsDevHandler({ directory, isAdmin }) {
  const port = directory && join(directory, 'port');
  const git = (...args) => run('git', ['-C', port, ...args], { timeout: 8_000, maxBuffer: 4 << 20, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).then((r) => r.stdout);

  async function commits() {
    const out = await git('log', `-n${COMMITS}`, '--format=%x1e%H%x1f%at%x1f%an%x1f%s%x1f%b%x1f', '--numstat');
    return out.split('\x1e').filter(Boolean).map((rec) => {
      const [hash, at, author, subject, body, numstat = ''] = rec.split('\x1f');
      let added = 0, removed = 0;
      const files = [];
      for (const l of numstat.trim().split('\n').filter(Boolean)) {
        const [a, r, path] = l.split('\t');
        files.push({ path, added: Number(a) || 0, removed: Number(r) || 0 });
        (added += Number(a) || 0), (removed += Number(r) || 0);
      }
      // a commit that only touches notes (*.md) doesn't change what a deploy ships
      const code = files.some((f) => !/\.md$/i.test(f.path));
      return { hash: hash.slice(0, 7), at: Number(at) * 1000, author, subject, body: body.trim(), files: files.length, added, removed, paths: files.slice(0, COMMIT_FILES), code };
    });
  }

  /** The branch, how far it is from what's pushed, and the other branches. */
  async function repo() {
    const branch = (await git('rev-parse', '--abbrev-ref', 'HEAD')).trim();
    const upstream = (await git('rev-parse', '--abbrev-ref', '@{upstream}').catch(() => '')).trim() || null;
    let ahead = 0, behind = 0;
    if (upstream) [behind, ahead] = (await git('rev-list', '--left-right', '--count', `${upstream}...HEAD`)).trim().split(/\s+/).map(Number);
    const refs = await git('for-each-ref', '--sort=-committerdate', '--format=%(refname:short)%1f%(objectname:short)%1f%(committerdate:unix)%1f%(subject)', 'refs/heads', 'refs/remotes');
    const branches = refs.split('\n').filter(Boolean).map((l) => {
      const [name, hash, at, subject] = l.split('\x1f');
      return { name, hash, at: Number(at) * 1000, subject };
    }).filter((b) => !b.name.endsWith('/HEAD') && b.name !== 'origin');
    const remote = (await git('remote', 'get-url', 'origin').catch(() => '')).trim();
    const github = remote.match(/github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/)?.[1] ?? null;
    return { branch, upstream, ahead, behind, branches, github };
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

  /** Every deploy that left a backup, newest first. */
  async function deploys() {
    const names = await readdir(join(directory, 'backups')).catch(() => []);
    return names.map(deployOf).filter(Boolean).sort((a, b) => b.at - a.at).slice(0, DEPLOYS);
  }

  /** What's live and every build folder's last build, newest first. */
  async function builds() {
    const live = await Promise.all(LIVE.map(async ([name, path]) => ({ name, dir: null, at: await mtime(join(directory, path)) })));
    const dirs = (await readdir(join(port, 'recomp'), { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory() && d.name.startsWith('build_'));
    const built = (await Promise.all(dirs.flatMap((d) => BUILT.map(async ([name, file]) => ({ name, dir: d.name, at: await mtime(join(port, 'recomp', d.name, file)) })))))
      .filter((b) => b.at).sort((a, b) => b.at - a.at);
    return [...live, ...built];
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
    const text = await tail(join(directory, 'activity.jsonl'), ACTIVITY_BYTES).catch(() => '');
    return text.split('\n').map(event).filter(Boolean);
  }

  async function snapshot() {
    const now = Date.now();
    const logPath = join(port, 'PORTING_LOG.md');
    const settle = (p, fallback) => p.catch((e) => (console.error('glops-dev:', e.message), fallback));
    const [md, logAt, repoInfo, commitList, changeList, touchedList, deployList, logList, shots, all, buildList] = await Promise.all([
      readFile(logPath, 'utf8').catch(() => ''),
      mtime(logPath),
      settle(repo(), null),
      settle(commits(), []),
      settle(changes(), []),
      settle(touched(now), []),
      deploys(),
      settle(logs(), []),
      newest('shots', (n) => SHOT.test(n), SHOTS),
      activity(),
      builds(),
    ]);
    const log = { ...parseLog(md), at: logAt };
    // each deploy with the status log's entry about it, which names its backup folder
    const status = log.sections.find((s) => /^status$/i.test(s.title))?.items ?? [];
    const deployed = deployList.map((d) => {
      const entry = status.find((i) => i.text.includes(d.name));
      return entry ? { ...d, note: entry.text, title: entry.when } : d;
    });
    const lastDeploy = deployed[0]?.at ?? 0;
    const events = all.slice(-EVENTS).reverse();
    const lastWork = Math.max(0, logAt ?? 0, commitList[0]?.at ?? 0, events[0]?.t ?? 0, ...[...changeList, ...touchedList, ...logList, ...buildList].map((x) => x.at ?? 0));
    // the session that stopped last, if nothing happened after it
    const paused = events[0]?.ev === 'stop';
    return {
      now,
      lastWork: lastWork || null,
      live: !!lastWork && now - lastWork < LIVE_MS && !(paused && events[0].t >= lastWork - 1_000),
      repo: repoInfo,
      log,
      commits: commitList.map((c) => ({ ...c, live: c.at <= lastDeploy })),
      // code committed after the last deploy (a minute's grace: the deploy's backup is named to the minute)
      undeployed: commitList.filter((c) => c.code && c.at > lastDeploy + 60_000).length,
      changes: changeList,
      touched: touchedList,
      deploys: deployed,
      builds: buildList,
      logs: logList,
      shots: shots.map(({ name, at }) => ({ name, at })),
      sessions: sessionsOf(all, now),
      activity: events,
    };
  }

  let cached = null, cachedAt = 0, pending = null;
  async function current() {
    if (cached && Date.now() - cachedAt < FRESH_MS) return cached;
    pending ??= snapshot().then((s) => {
      // the ETag leaves out the clock, so an unchanged folder answers 304
      const { now, sessions, ...rest } = s;
      const body = JSON.stringify(s);
      const stable = JSON.stringify({ ...rest, sessions: sessions.map(({ state, ...x }) => x) });
      cached = { body, gz: gzipSync(body), etag: `"${createHash('sha1').update(stable).digest('base64url').slice(0, 20)}"` };
      cachedAt = Date.now();
      return cached;
    }).finally(() => (pending = null));
    return pending;
  }

  return async function glopsDev(req, res, p) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    if (!directory) throw new HttpError(404, 'The Global Ops port isn’t on this server.');
    if (!isAdmin(req)) throw new HttpError(403, 'Sign in as admin (Settings) to follow the game’s development.');
    if (p === '/api/glops-dev') {
      const { body, gz, etag } = await current();
      const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-cache', ETag: etag, Vary: 'Accept-Encoding' };
      if (req.headers['if-none-match'] === etag) return res.writeHead(304, headers).end();
      // a snapshot is a few hundred KB of mostly repeated text: gzip takes it to a tenth
      if (/\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) return res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip' }).end(gz);
      return res.writeHead(200, headers).end(body);
    }
    const shot = p.match(/^\/api\/glops-dev\/shots\/([^/]+)$/)?.[1];
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
