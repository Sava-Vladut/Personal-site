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

## After pushing

- Always redeploy the live site (https://grimnetwork.srvp.ro) after every pushed change:
  `cd /root/Personal-site && git pull --ff-only && cd /root/deploy && docker compose up -d --build`
- Then check `docker logs personal-site-app-1` and curl the public URL to confirm it's up.
