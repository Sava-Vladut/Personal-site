# My Mind

A private, mobile-first journal: notes, an emotion tracker, and stats about the patterns between them.
White and graphite, a serif for the writing, and the eight pixel "worlds" from
[Mindful · Emotion Quest](https://savavlad.com/).

## Run it

```bash
npm install
npm run build
npm start            # → http://localhost:8085
```

While developing, `npm run dev` runs the API server and Vite (hot reload) together; open http://localhost:5173.

Run `npm test` for storage, sync, server and editor regression checks, including the note editor's document (every
note's text reads back exactly), its keys and commands, tag suggestions, pasting, and keyboard viewport positioning. The
editor itself is mounted in jsdom, never a browser. Check typing and the software keyboard on a physical iPhone as well.

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
- Offline you can write notes, check in and see stats. Image search, Spotify, the weather and the map need a connection
  (the weather is filled in once you're back online). Images
  you've already viewed stay cached.
- To get a new version, open the app while online. It picks up the new build and caches it.

## What's in it

| Screen | What it does |
|---|---|
| **Intro** | What a device that isn't signed in sees instead of the journal: a 3D brain drawn in letters turning in a sky of letter clouds, its regions lighting up in turn, sparks between them and a ring of feelings around it. Drag to spin it, tap a region to light it. Sign in with the admin password (`ADMIN_PASSWORD` in `.env`) and it bursts into the journal; the device stays signed in for 90 days. It's a front door, not a lock: each browser's journal is its own either way. With no `ADMIN_PASSWORD` set there's no intro. Settings → Sign-in signs out or shows it again. |
| **Journal** | Notes and check-ins grouped by day. Search, filter by type or by emotion world, or open the calendar to see one day. |
| **Check in** | "Name it to tame it": pick a world → a zone → the exact feeling (48 of them, each with a definition), set intensity 1–5, optionally add a line. |
| **New note** (+) | Title, icon, text, up to three feelings with an intensity, a date (today by default, or any day, or a range), photos from your gallery (or, on desktop, a file browser, drag and drop, or paste), images from a web search (Openverse), and music from Spotify (songs and albums as records in their sleeves, playlists and podcasts as cassettes; tap one to put it on and open Spotify's player). Tag people, books and music in the text with **@**: it suggests from People and Media, writes `@[Ana]`, `[[Dune]]` or `♪[Song]`, and shows them as chips (while writing and reading) that open a card about each. Link another note with **[[** (or the link button): it writes `[[note:<id>|Title]]`, shows as a chip with the note's current title, and the linked note lists it under **Linked from** at the bottom. Saves automatically. |
| **Media** | Books and music. **Books**: your shelf as a bookcase, each book a spine in its cover's colour, as thick as it is long, with a call-number sticker, rating dots and, while you're reading it, a bookmark. A book's page has a library card in its pocket with the days you added, started and finished it and wrote about it, stamped in ink (tap a stamp to change it). **Music**: songs, albums, playlists and podcasts from Spotify, kept as records in a wooden shelf and tapes in a rack, with what's on repeat spinning on top. Each has a page to play it, rate it, note how it makes you feel and who it brings to mind, and see the notes it's in. Music added to notes can be kept from there. |
| **Public notes** | The globe at the top of a note makes just that note public: its title, text, pictures and day are copied to the server and anyone with the link (`/s/<secret>`) can read it, no sign-in. Off by default and chosen note by note. Feelings, people, place, weather and music stay private unless switched on for that note under **Also show**; people go by name only and a place by its name only (never coordinates). Needs `ADMIN_PASSWORD` (only the signed-in admin can share, update or stop). The link is 192 random bits, the page is `noindex`, and **Stop sharing** (or deleting the note) deletes the public copy. A note edited after sharing offers **Update public copy**; Settings → Public notes lists everything that's public. Stored in `data/shared/`. |
| **Map** | Every entry saved with a place, as pins in the colour of what you felt. Pinch, drag or scroll to zoom; tap a spot for what you wrote there. From Settings, the Weather tab in Stats, or a note's Feelings page. |
| **Stats** | A sky header and colour theme taken from the feeling you had most, with charts that animate in as you scroll to them. Range filter (7D / 30D / 90D / 1Y / All) with comparison against the previous period. **Overview**: average mood, pleasant share, entries, active days, streaks, feelings named, intensity, words, plain-language insights, mood over time, pleasant vs unpleasant. **Emotions**: interactive emotion wheel, worlds, top feelings, mix over time, feelings that show up together, what tends to come next. **Patterns**: calendar coloured by the dominant feeling, weekday × time-of-day heatmap, mood by weekday and by time of day, intensity. **Weather**: mood by sky, temperature, hours of daylight and daylight vs dark, and by place, with a map. **Dex**: every feeling you've named so far. Every chart has a table view. |
| **Settings** | Language (English or Română), light / dark / system theme, week start, emotion picker style, weather and places, Spotify connection, GitHub login with public and private repo counts, backup export/import, delete everything. |

Mood score: each entry scores `intensity × valence` (pleasant +1, unpleasant −1), from −5 to +5.

## Your data

Everything is stored in the browser (IndexedDB) on the device you use. Nothing is uploaded unless you turn on sync or make a particular note public (see Public notes above). (Weather and places, when on, send only coordinates to look things up: see below.)
Photos are resized on the device (longest side 2048px) and stored there too; backups include them.
Use **Settings → Export backup** to keep a copy or move it to another device (**Import backup** merges; newer copies win).

**Settings → Save on server** syncs across devices. Turning it on shows a 12-character code; enter it on another device
under **Load with a code**. The browser encrypts everything (AES-GCM, key derived from the code) before uploading, and
the server stores only ciphertext in `data/sync/`, filed under an id also derived from the code, so it can't read the
journal. Anyone with the code can, so keep it private. Devices merge on every sync: the newest edit of an entry wins and
deletions carry over. Photos upload once each.

## Weather and places

Both are off until you turn them on in **Settings → Weather & places**.

- **Weather** adds the weather code, temperature and hours of daylight (and whether it was dark out) to each entry, from
  [Open-Meteo](https://open-meteo.com) (free, no key). An entry written now gets the weather as it is; older entries,
  entries moved to another day and ones written offline get that day's weather, filled in the background for the place
  saved with them, else your **home** (a town you pick, or where you are when you pick it). Filled-in weather doesn't
  count as an edit, so it never wins over a change made on another device; each device fills in its own copy.
- **Places** saves where you are (rounded to about 100 m) with each new entry, named after the neighbourhood by
  OpenStreetMap's [Nominatim](https://nominatim.org), at most one lookup a second. A note's place can be removed or added
  on its Feelings page.
- Only coordinates are sent to Open-Meteo and Nominatim, never anything you write. The map shows
  [OpenStreetMap](https://www.openstreetmap.org/copyright)'s tiles, greyed by CSS to fit the app.

## Image search

The image button in a note searches [Openverse](https://openverse.org): openly licensed images from Flickr, Wikimedia
Commons and other collections. It needs no key or setup. The browser calls the Openverse API directly, so each device
gets its own anonymous limit of 20 searches a minute and 200 a day. Each saved image keeps its title, creator, license
and a link to its source page, shown when you open it.

Spotify settings are described in `.env.example`.
GitHub login needs a GitHub OAuth App (Settings → Developer settings → OAuth Apps) with callback URL `<PUBLIC_URL>/api/github/callback`; put its keys in `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

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

The Channel points page reads the Twitch Channel Points Miner's analytics from `TWITCH_ANALYTICS_DIR`. To edit which
channels it mines from the page, point `TWITCH_CHANNELS_FILE` at a writable `channels.json` (`{"channels": [...]}`)
that the miner reads on start, restart the miner when that file changes (for example with a systemd `.path` unit), and
set `ADMIN_PASSWORD`: only browsers signed in with it can save the list.

The Global Ops page (Insights) shows who plays the browser port of Global Operations at `/glops/`: players online now,
all-time highs, servers, play time and busy hours. The page fetches `/glops/net/analytics` straight from the game's
multiplayer relay (public, no sign-in, nothing to configure here) every 30 seconds while it's open.

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
- **Language.** English or Romanian, chosen per device in Settings. The code is written in English and wraps what it
  shows in `t('…')` (`rich()` when the sentence holds markup, `count()` for numbers with a noun); the Romanian is in
  `src/data/ro.ts`, keyed by the English. Text without a translation stays in English, and `npm test` lists any missing.

## Layout

```
server/index.js          HTTP routing + Spotify proxy, no dependencies
server/static.js         compressed static hosting and bounded asset cache
server/sync.js           encrypted sync storage and transfer limits
src/data/emotions.ts     the emotion wheel: 8 worlds → 24 zones → 48 feelings, colours, sprites
src/data/ro.ts           the Romanian translation, keyed by the English text (see src/lib/i18n.ts)
src/lib/                 storage (IndexedDB), stats, dates, router, API clients
src/lib/noteDoc/         a note's text as a ProseMirror document: schema, Markdown in and out, editing commands
src/editor/              the note editor: the ProseMirror view, its plugins, node views and paste handling
src/components/          sheets, pickers, charts
src/views/               Journal, Tracker, Editor, Stats, Settings
src/styles/              shared styling and feature styles, including books, notes and stats
public/sw.js             offline cache
scripts/                 regression checks, asset generation, compression and dev runner
```
