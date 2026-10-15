# Improvement log

One line per improvement pass, newest last. Read before picking the next fix so passes don't repeat or undo each other.

- 2026-10-15 · 1.90.1 · Stability: sync requests (`src/lib/sync.ts` `call`) now have a deadline (30 s + 64 KB/s of body, reset once headers arrive to cover the body read). Before, one stalled fetch left `running` pending forever, so the 60 s retry, `online` and visibility syncs all waited on it until reload. Test: "a stalled sync request times out…" in `scripts/test-storage.mjs`. Closes the "Browser sync requests have no deadline" finding from `performance-review-2026-09-29.md`.
