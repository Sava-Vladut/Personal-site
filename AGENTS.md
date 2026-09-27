# Agent instructions

## Git

- Work directly on `main`. Don't create feature branches.
- Commit every finished change to `main` and push it: `git push origin main`.
- Don't open pull requests.
- Never force-push or rewrite history on `main`. If the push is rejected, run `git pull --rebase origin main`, then push again.

## Before pushing

- Run `npm run build` (type check + production build) and make sure it passes.

## After pushing

- Always redeploy the live site (https://grimnetwork.srvp.ro) after every pushed change:
  `cd /root/Personal-site && git pull --ff-only && cd /root/deploy && docker compose up -d --build`
- Then check `docker logs personal-site-app-1` and curl the public URL to confirm it's up.
