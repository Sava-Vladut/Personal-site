# Agent instructions

## Git

- Work directly on `main`. Don't create feature branches.
- Commit every finished change to `main` and push it: `git push origin main`.
- Don't open pull requests.
- Never force-push or rewrite history on `main`. If the push is rejected, run `git pull --rebase origin main`, then push again.

## Version and changelog

- Every prompt that changes the app bumps its version: add a new entry at the top of `CHANGELOG` in `src/data/changelog.ts` (the version shown in Settings is the first entry's).
- Bump the minor version (1.2.0 → 1.3.0) for new features or redesigns, the patch version (1.2.0 → 1.2.1) for fixes and small tweaks.
- Use today's date and list what changed in short, user-facing lines, one per change.

## Before pushing

- Run `npm run build` (type check + production build) and make sure it passes.

## Server load and test cleanup

- This workspace is on the production host, which has limited RAM. Do not run Playwright, WebKit, or other headless browser tests here, or install their browser runtimes. Run browser checks on a separate development machine or CI runner. Use lightweight regression tests and builds here.
- Run test suites and builds sequentially. Coordinate subagents so they do not run resource-intensive checks at the same time or start overlapping development servers.
- Stop temporary development servers and test processes you started when finished or when they stall. Use cleanup handlers for browser contexts and child processes; do not leave them running after failed tests.
- If server load spikes, stop your own browser tests and Vite servers first. Check `uptime`, `free -m`, `vmstat 1 3`, and `docker stats --no-stream`. Identify processes before stopping them; do not terminate unrelated user processes or live application containers.
- Confirm recovery with current CPU usage, memory pressure, container usage, and the public site and `/api/health`. The five- and fifteen-minute load averages take time to fall after the active load ends.
- On 2026-10-01, stopping the WebKit checks and temporary Vite server relieved the overload: one-minute load fell from 19.5 to 0.66, CPU settled at 5–7% used, and the live app container was effectively idle. Keep browser verification off this host to avoid repeating that resource pressure.

## After pushing

- Always redeploy the live site (https://grimnetwork.srvp.ro) after every pushed change:
  `cd /root/Personal-site && git pull --ff-only && cd /root/deploy && docker compose up -d --build`
- Then check `docker logs personal-site-app-1` and curl the public URL to confirm it's up.
