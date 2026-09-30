# My Mind

A private, mobile-first journal: notes, an emotion tracker, and stats about the patterns between them.
White and graphite, a serif for the writing, and the eight pixel "worlds" from
[Mindful · Emotion Quest](https://grimnetwork.srvp.ro/).

## Run it

```bash
npm install
npm run build
npm start            # → http://localhost:8085
```

While developing, `npm run dev` runs the API server and Vite (hot reload) together; open http://localhost:5173.

Install it on a phone: open the site, then **Share → Add to Home Screen** (iOS) or **Install app** (Android/Chrome).
It works offline after the first visit: the service worker caches the whole build when it installs.

### Offline with Safari

Offline mode needs the site served over **https** (or `localhost`). Safari won't run the service worker on a
plain `http://192.168.x.x:8085` address, so host it behind https first (a reverse proxy with a certificate, or a tunnel).

- **iPhone / iPad:** open the https address in Safari → **Share → Add to Home Screen** → open **My Mind** from the
  Home Screen once while online. After that it opens with no connection.
- **Mac (Safari 17+):** open the address → **File → Add to Dock** → open it once while online.

Things to know:

- The Home Screen / Dock app keeps its **own** data, separate from Safari tabs. Journal in the installed app, not in a
  tab. To move entries across, use **Settings → Export backup** in one, then **Import backup** in the other.
- Safari can clear a website's storage after about 7 days without a visit. Installed Home Screen / Dock apps aren't
  affected, which is another reason to use the installed app. Export a backup now and then anyway.
- Offline you can write notes, check in and see stats. Image search and Spotify need a connection. Images
  you've already viewed stay cached.
- To get a new version, open the app while online. It picks up the new build and caches it.

## What's in it

| Screen | What it does |
|---|---|
| **Journal** | Notes and check-ins grouped by day. Search, filter by type or by emotion world, or open the calendar to see one day. |
| **Check in** | "Name it to tame it": pick a world → a zone → the exact feeling (48 of them, each with a definition), set intensity 1–5, optionally add a line. |
| **New note** (+) | Title, icon, text, up to three feelings with an intensity, a date (today by default, or any day, or a range), photos from your gallery (or, on desktop, a file browser, drag and drop, or paste), images from a web search (Openverse), and music from Spotify. Saves automatically. |
| **Stats** | A sky header and colour theme taken from the feeling you had most, with charts that animate in as you scroll to them. Range filter (7D / 30D / 90D / 1Y / All) with comparison against the previous period. **Overview**: average mood, pleasant share, entries, active days, streaks, feelings named, intensity, words, plain-language insights, mood over time, pleasant vs unpleasant. **Emotions**: interactive emotion wheel, worlds, top feelings, mix over time, feelings that show up together, what tends to come next. **Patterns**: calendar coloured by the dominant feeling, weekday × time-of-day heatmap, mood by weekday and by time of day, intensity. **Dex**: every feeling you've named so far. Every chart has a table view. |
| **Settings** | Light / dark / system theme, week start, emotion picker style, Spotify connection, backup export/import, delete everything. |

Mood score: each entry scores `intensity × valence` (pleasant +1, unpleasant −1), from −5 to +5.

## Your data

Everything is stored in the browser (IndexedDB) on the device you use. Nothing is uploaded unless you turn on sync.
Photos are resized on the device (longest side 2048px) and stored there too; backups include them.
Use **Settings → Export backup** to keep a copy or move it to another device (**Import backup** merges; newer copies win).

**Settings → Save on server** syncs across devices. Turning it on shows a 12-character code; enter it on another device
under **Load with a code**. The browser encrypts everything (AES-GCM, key derived from the code) before uploading, and
the server stores only ciphertext in `data/sync/`, filed under an id also derived from the code, so it can't read the
journal. Anyone with the code can, so keep it private. Devices merge on every sync: the newest edit of an entry wins and
deletions carry over. Photos upload once each.

## Image search

The image button in a note searches [Openverse](https://openverse.org): openly licensed images from Flickr, Wikimedia
Commons and other collections. It needs no key or setup. The browser calls the Openverse API directly, so each device
gets its own anonymous limit of 20 searches a minute and 200 a day. Each saved image keeps its title, creator, license
and a link to its source page, shown when you open it.

Spotify settings are described in `.env.example`.

## Deploying

Any host that runs Node 20 (20.19+) or Node 22.12+: `npm ci && npm run build && npm start`, behind HTTPS. Set `PUBLIC_URL` to the public address
(the OAuth redirects use it) and `SESSION_SECRET` to a long random string. The server has no dependencies, serves
compressed, cache-busted assets, and sends a strict Content-Security-Policy. The build writes Brotli and gzip sidecars
for static hosting after generating the offline cache, so compression never blocks live requests.

Run one server process per sync data directory: document conflict checks are serialized within that process.
Sync uploads and downloads stream to/from disk. Fingerprinted static assets use a bounded 16 MiB cache.
Up to four uploads, 128 total sync requests and 128 static handler operations run concurrently, with a
retryable 503 when capacity is exhausted. Each encrypted document or photo retains its 16 MiB limit. Store
`data/` on persistent storage and back it up separately; atomic file replacement is not a backup.
Spotify upstream calls have a 15-second deadline. SIGTERM/SIGINT drains HTTP requests for up to eight seconds.

See [the performance and stability review](docs/performance-review-2026-09-29.md) for validation, measurements,
and remaining browser-side and infrastructure scaling limits.

## Design notes

- **Type.** Claude's sites use Anthropic Serif and Anthropic Sans, which aren't licensed for other sites. The closest free
  matches are self-hosted instead: Source Serif 4 (headings, note text) and Instrument Sans (everything else). If the
  Anthropic fonts are installed on a device, the CSS uses them first.
- **Colour.** Neutral white/graphite UI; colour is reserved for the eight emotion worlds. That palette is checked for
  colour-blind separation in light and dark mode, and every coloured mark also carries a label or pixel sprite.
- **Icons.** [Tabler Icons](https://tabler.io/icons) (~4,800 line icons) and Microsoft's
  [Fluent Emoji High Contrast](https://github.com/microsoft/fluentui-emoji) faces, both MIT. About 290 hand-picked ones
  load when the picker opens; the full set loads only when you browse or search all of them.
  Regenerate with `npm run icons`.

## Layout

```
server/index.js          static hosting + Spotify proxy + encrypted sync storage, no dependencies
src/data/emotions.ts     the emotion wheel: 8 worlds → 24 zones → 48 feelings, colours, sprites
src/lib/                 storage (IndexedDB), stats, dates, router, API clients
src/components/          sheets, pickers, charts
src/views/               Journal, Tracker, Editor, Stats, Settings
public/sw.js             offline cache
scripts/                 icon generation, dev runner
```
