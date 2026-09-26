# Agent instructions

## Git

- Work directly on `main`. Don't create feature branches.
- Commit every finished change to `main` and push it: `git push origin main`.
- Don't open pull requests.
- Never force-push or rewrite history on `main`. If the push is rejected, run `git pull --rebase origin main`, then push again.

## Before pushing

- Run `npm run build` (type check + production build) and make sure it passes.
