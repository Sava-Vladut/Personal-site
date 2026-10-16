---
description: One small, safe improvement pass (consistency, speed or stability), verified, shipped and deployed. Built to run under /loop.
argument-hint: "[focus: consistency | speed | stability | <area>]"
---

You're doing **one** improvement iteration on this app (My Mind, live at https://savavlad.com). Keep it
small: a single focused change you can verify fully, not a sweep. Many small safe iterations beat one big
risky one. Follow AGENTS.md exactly (main only, changelog bump, build, push, redeploy).

Focus for this run: $ARGUMENTS (if empty, rotate: pick the area least touched by recent `Loop:` commits).

## 0. Preflight — stop early if it isn't safe

1. `uptime` and `free -m`. If the one-minute load is above 4 or available memory is under 300 MB, do
   nothing this iteration: say so and end.
2. `git status --porcelain`. If the tree is dirty (someone else is working), don't touch it: say so and end.
3. `git pull --ff-only origin main`.
4. `curl -fsS -o /dev/null -w '%{http_code} %{time_total}s\n' https://savavlad.com/` and
   `curl -fsS https://savavlad.com/api/health`. If the live site is down, this iteration is about fixing
   that (check `docker logs --tail 100 personal-site-app-1`) and nothing else.
5. `git log --oneline -30 --grep='^Loop:'` to see what earlier iterations already did. Don't repeat them
   and don't undo them.

## 1. Pick one thing

Look for a concrete, provable issue in the chosen area. Read the code before deciding; don't guess.

**Consistency** (the rules live in `design.md`):
- Raw values where a token exists: hex colours, px font sizes, font weights, radii, shadows, durations
  in `src/styles/*.css` and inline styles in `src/**/*.tsx`.
- Near-duplicates design.md calls bugs (550 vs 600, 0.26s vs 0.25s), one-off components that duplicate an
  existing pattern, inconsistent wording or i18n keys missing in one language.

**Speed**:
- Unneeded re-renders (missing memo/keys, state lifted too high), work in render that belongs in an effect
  or a cache, large imports that could be lazy, oversized assets, slow server paths
  (`scripts/benchmark-server.mjs` measures the server), animations that loop at rest.
- Compare bundle sizes in `dist/` before and after a change and report them.

**Stability**:
- Unhandled promise rejections, missing try/catch around network/storage/JSON parsing, missing timeouts,
  race conditions in sync, input the server doesn't validate, error paths that leave UI stuck,
  `docker logs --tail 200 personal-site-app-1` errors or warnings.
- A test in `scripts/test-*.mjs` that covers a path that currently has none.

Pick the highest-value item that fits in one small diff. If nothing worthwhile is left in the area, say so
and end — don't invent churn. Never change behaviour or design the user would notice beyond the fix itself.

## 2. Make the change

- Match the surrounding code: naming, comment density, idiom, tokens from design.md.
- Add or extend a lightweight test in `scripts/test-*.mjs` when fixing a bug or a stability gap.
- No Playwright, WebKit or headless browsers on this host. No dev servers left running.

## 3. Verify (sequentially, never in parallel)

1. `npm test` — must pass.
2. `npm run build` — must pass.
If either fails and you can't fix it within this iteration, `git checkout -- . && git clean -fd src scripts server`
for your own changes only, report what you found, and end.

## 4. Ship

1. Add a new top entry in `src/data/changelog.ts`: patch bump (1.93.0 → 1.93.1), today's date, one short
   user-facing line per change. Run `npm run build` again if you edited it after the build.
2. Commit with a message starting `Loop: <area>: <what changed>`, then `git push origin main`
   (on rejection: `git pull --rebase origin main`, then push; never force-push).
3. Deploy: `cd /root/Personal-site && git pull --ff-only && cd /root/deploy && docker compose up -d --build`.
4. Confirm: `docker logs --tail 50 personal-site-app-1`, the public URL and `/api/health` both answer.
   If the site is broken after deploy, `git revert --no-edit HEAD`, push, redeploy, confirm recovery,
   and report it.

## 5. Report

Three to five lines: the area, what you changed and why, the evidence (test/bundle size/timing before and
after), and the live check result. If you stopped early, say why.
