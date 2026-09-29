# Performance and stability review — 2026-09-29

Release: **1.11.1**. Baseline: `db379f1` (1.11.0).

## Scope and method

Three subagents independently reviewed the server; browser persistence, sync, rendering and offline behavior;
and build, deployment and tests. The primary agent integrated changes and reviewed the combined implementation.
Review covered the repository's server, `src/lib`, views/components, service worker, build configuration,
scripts, dependencies and the current external Docker Compose configuration. This is a code review and targeted
regression/load exercise, not proof of correctness for every browser/device or a production capacity certification.

No views, components, styles, browser libraries or service-worker source were changed. The only `src/` edit is
the required version/changelog entry. API routes, ciphertext format, revision hash format, immutable photos,
Spotify features and offline precache contents retain their existing contracts.

## Implemented improvements

| Area | Before | After / practical effect |
| --- | --- | --- |
| Asset compression | First request performs synchronous Brotli quality 10 and gzip level 9 on the main thread. | Build generates both representations after service-worker precache generation. Live requests use precompressed files, with a bounded cache for small fingerprinted assets and streamed fallback; no runtime compression. |
| Static I/O | Synchronous existence checks, stats and reads on requests. | Asynchronous metadata/open calls and streamed fallback; a 16 MiB / 256-entry LRU caches representations up to 1 MiB each, only for fingerprinted assets. Up to 128 active static handler operations, then retryable 503. |
| HTTP caching | `q=0` ignored; exact-only validators; immutable assets skip 304; fallback HTML under `/assets/` can inherit immutable caching. | Encoding quality negotiation, weak cross-representation validators, validator lists/wildcards, conditional responses for hashed assets, and caching based on resolved file. |
| Sync upload | Buffers entire ciphertext, synchronously writes it, then reads it again to calculate revision. | Streams to a private temporary file while calculating the same SHA-256 revision; atomically renames completed uploads. Preserves the 16 MiB document/photo limits. |
| Sync concurrency | Synchronous file operations block unrelated requests. | Per-journal asynchronous serialization preserves compare-and-swap and deletion ordering. Concurrent writes based on one revision admit exactly one winner. |
| Sync download | Reads the whole document/photo into memory. | Streams from an open descriptor; revision and response bytes refer to the same file snapshot during replacement. |
| Resource bounds | Unbounded revision map and upload buffering. | 1,024 revision metadata entries, four uploads, 128 total sync requests; overload returns 503 with `Retry-After: 1`. Limits are configurable through handler construction. |
| Revision freshness | Cache uses modification time alone. | File identity, size, modification time and change time validate cached revisions. |
| Interrupted transfers | Large buffered transfers and incomplete cleanup paths. | Normal abort/error paths release admission slots and remove partial temporary files. Oversized chunked uploads get 413. |
| Spotify reliability | Calls can remain pending indefinitely; simultaneous requests duplicate refreshes; malformed cookies trigger 500. | 15-second deadlines include response-body consumption; concurrent refreshes share one request, bounded to 128 pending refreshes; malformed cookie values are skipped. |
| Spotify failure handling | Temporary refresh errors appear as lost login. | Upstream outages remain retryable errors; invalid grants still require reconnecting; refreshed cookies survive downstream errors; unused redirect bodies are cancelled. |
| Deployment shutdown | Default process termination interrupts requests. | SIGTERM/SIGINT drain requests for up to eight seconds, within Docker's default stop grace period. |
| Build hygiene | Docker context includes host dependencies, built files, Git history, local data and environment files. | `.dockerignore` excludes those inputs. Node engine declaration matches installed build-tool requirements. No new dependencies. |

## Validation

Baseline: 26 existing tests passed and production build passed.
The expanded suite covers the existing features plus real HTTP sync/static integration and process shutdown.
Fixtures and benchmark servers use temporary directories, mocked Spotify responses and loopback ports; no user
journals are read or modified. Live verification uses read-only health and static requests.

- `npm test`: 53 passing tests (26 before this change), including 12 server, 8 sync and 12 static tests.
- `npm run build`: type check, production bundle and Brotli/gzip sidecar generation.
- `git diff --check`: whitespace validation.
- `npm audit --omit=dev --json` and `npm audit --json`: zero reported vulnerabilities on this date, including build dependencies. This is registry evidence, not a general security guarantee.
- Regression coverage: sync revisions/304s/conflicts, concurrent writes, immutable photos, deletion, abort cleanup, declared/chunked size limits, overload recovery, download snapshots, compression parity, encoding exclusions, stale sidecars, HEAD, cache validators, malformed/traversal paths, Spotify pagination, refresh coalescing/failure recovery/deadlines, and graceful shutdown.

## Measurements

Three-trial medians on Node 22.22.1, measured on the same host:

| Measurement | Baseline | Final | Observed reduction |
| --- | ---: | ---: | ---: |
| Cold Brotli main JavaScript response | 363.94 ms | 10.88 ms | 97.0% |
| Health request issued during cold response | 356.00 ms | 2.14 ms | 99.4% |
| 100 warm asset requests, concurrency 8 | 126.30 ms | 105.65 ms | 16.4% |

The main Brotli payload increased from 92,350 to 92,485 bytes because of the required changelog entry.
The bounded-cache warm batch samples were 125.66 / 105.65 / 104.29 ms: the small sample and variance mean
the warm result should be treated as directional. Cold latency and event-loop responsiveness are the clearest gains.
No claim is made about measured sync throughput or memory savings; those improvements follow from the streaming
implementation and bounds, and need representative production load measurements for quantification.

Reproduce with:

```sh
npm run build
node scripts/benchmark-server.mjs /path/to/app 3
```

The script copies only `server/` and `dist/` into a temporary app, starts a fresh process for each trial, and
measures a cold Brotli main-JavaScript request, a health request issued 10 ms later, and 100 warm asset requests
at concurrency eight. It does not read `.env` or persistent user data. OS caches can be warm. These localhost
measurements do not predict WAN latency, rendering speed, user capacity or production p95/p99.

## High-priority findings deferred to preserve the frontend

| Priority | Finding and evidence | Recommended follow-up |
| --- | --- | --- |
| High | A stale tab can delete a newer durable note. `src/lib/store.ts:461` decides synced deletion from in-memory state, then deletes unconditionally. Isolated reproduction: tab knows timestamp 1, database contains timestamp 100, incoming tombstone 50 deletes timestamp 100. | Compare durable timestamps and delete within the same IndexedDB transaction; add cross-tab notification and the equivalent existing people-deletion regression for notes. |
| High | Autosave can report success before persistence. `src/lib/store.ts:150` publishes before the write; `src/views/Editor.tsx:158` ignores the save promise and clears dirty state. A forced quota error left one visible in-memory note and zero persisted notes. | Acknowledge only committed writes, retain dirty state after failure, and expose retry. Cover quota exhaustion, aborted transactions and navigation during saves. |
| Medium | Browser sync requests have no deadline/cancellation (`src/lib/sync.ts:100`); one stalled promise blocks later sync attempts. | Add per-session cancellation, request deadlines and session identity checks before merging. |
| Medium | Every sync serializes/encrypts the entire journal (`src/lib/sync.ts:204`); photos transfer serially (`143`). | Introduce bounded photo concurrency first; design a compatible encrypted incremental protocol if measured journal size requires it. |
| Medium | Photo object URLs remain retained and pruning/export reads all photo records (`src/lib/photos.ts:56`, `138`, `174`). | Bound unused URL retention and process blobs in batches while preserving backup fidelity. |
| Medium | Search/rendering process the full journal and autosaves filter/sort the full entry collection (`src/views/Journal.tsx:40`, `144`; `src/lib/store.ts:152`). | Profile representative 1k/10k-entry journals, then consider incremental search indexes and windowed rendering. |
| Medium | Runtime service-worker cache writes are not awaited/caught and image caching is unbounded (`public/sw.js:24`, `31`). | Tie cache writes to event lifetime, handle quota failures and define eviction/fallback behavior. |
| Low | IndexedDB caches a rejected open promise until reload (`src/lib/db.ts:11`). | Reset failed connection state and provide recoverable startup handling. |

The two high-priority defects were reproduced against real bundled store code with in-memory persistence test
doubles. Existing storage tests do not substitute for actual browser transaction/quota/service-worker tests.
None of these browser defects is claimed fixed by the server work.

## Remaining infrastructure limits

- **Single process per sync directory.** Locks are process-local. Do not add replicas sharing the directory without a shared transactional store or distributed compare-and-swap. This change improves concurrency within the current deployment; it does not implement horizontal scaling.
- **Disk capacity and backups.** Persistent encrypted storage has no account quota, retention policy or automatic backup. Opaque sync IDs are the existing access mechanism. Storage exhaustion can still cause writes to fail. Capacity policy and backup/restore verification need a separate operational decision.
- **Crash durability.** Atomic rename protects against partially replacing documents, but there is no file/directory fsync guarantee across power loss. A hard kill can leave `.upload-*.tmp` files at the sync root. Normal errors/aborts clean up; orphan removal must only run while the owning process is stopped.
- **Overload behavior.** Admission limits intentionally return retryable 503 rather than allowing memory/file-descriptor growth. Browser automatic retry behavior is unchanged. Long-running uploads may be interrupted by the eight-second deployment deadline and must retry.
- **Observability.** The external Compose configuration has no container healthcheck or application metrics. The existing health endpoint and deployment smoke checks establish liveness, not sustained load capacity or upstream availability.
- **Browser/device validation.** No visual redesign or browser performance claim. Real Safari/Android offline behavior, large libraries and storage quota recovery remain outside this backend-only change.

## Release verification

Release procedure: commit directly to `main`, push to `origin/main`, pull with `--ff-only`, and rebuild/restart
the external Docker Compose stack. Then inspect `personal-site-app-1` logs and verify public health, HTML,
compressed assets and service-worker responses. The execution outcome is reported in the delivery message;
this checked-in report records the reviewed implementation and predeployment evidence.
