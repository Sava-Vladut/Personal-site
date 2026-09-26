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
- Offline you can write notes, check in and see stats. Pinterest and Spotify need a connection. Pinterest images
  you've already viewed stay cached.
- To get a new version, open the app while online. It picks up the new build and caches it.

## What's in it

| Screen | What it does |
|---|---|
| **Journal** | Notes and check-ins grouped by day. Search, filter by type or by emotion world, or open the calendar to see one day. |
| **Check in** | "Name it to tame it": pick a world → a zone → the exact feeling (48 of them, each with a definition), set intensity 1–5, optionally add a line. |
| **New note** (+) | Title, icon, text, up to three feelings with an intensity, a date (today by default, or any day, or a range), and images from Pinterest. Saves automatically. |
| **Stats** | Range filter (7D / 30D / 90D / 1Y / All) with comparison against the previous period. **Overview**: average mood, pleasant share, entries, active days, streaks, feelings named, intensity, words, plain-language insights, mood over time, pleasant vs unpleasant. **Emotions**: interactive emotion wheel, worlds, top feelings, mix over time, feelings that show up together, what tends to come next. **Patterns**: calendar coloured by the dominant feeling, weekday × time-of-day heatmap, mood by weekday and by time of day, intensity. **Dex**: every feeling you've named so far. Every chart has a table view. |
| **Settings** | Light / dark / system theme, week start, Pinterest connection, backup export/import, delete everything. |

Mood score: each entry scores `intensity × valence` (pleasant +1, unpleasant −1), from −5 to +5.

## Your data

Everything is stored in the browser (IndexedDB) on the device you use. Nothing is uploaded.
Use **Settings → Export backup** to keep a copy or move it to another device (**Import backup** merges; newer copies win).

## Pinterest

- **Paste a pin link** works with no setup — the server looks the pin up through Pinterest's public oEmbed endpoint.
- **Browse your boards** needs a Pinterest app (same flow as [pinterest/api-quickstart](https://github.com/pinterest/api-quickstart)):
  1. Create an app at https://developers.pinterest.com/apps/ (you may need to request trial access first).
  2. In the app's settings, add the redirect URI `<PUBLIC_URL>/api/pinterest/callback`, e.g. `http://localhost:8085/api/pinterest/callback`.
  3. Copy `.env.example` to `.env` and fill in `PINTEREST_APP_ID` and `PINTEREST_APP_SECRET`.
  4. Restart the server, then **Settings → Pinterest → Connect**.

  The access token is kept in an encrypted, http-only cookie for that browser only — never in JavaScript, never on disk.
  Scopes default to `boards:read,pins:read,user_accounts:read`; set `PINTEREST_SCOPES` in `.env` to add
  `boards:read_secret,pins:read_secret` if you want secret boards too.

Spotify settings are described in `.env.example`.

## Deploying

Any host that runs Node 20+: `npm ci && npm run build && npm start`, behind HTTPS. Set `PUBLIC_URL` to the public address
(the OAuth redirects use it) and `SESSION_SECRET` to a long random string. The server has no dependencies, serves
compressed, cache-busted assets, and sends a strict Content-Security-Policy.

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
server/index.js          static hosting + Pinterest (and Spotify) proxy, no dependencies
src/data/emotions.ts     the emotion wheel: 8 worlds → 24 zones → 48 feelings, colours, sprites
src/lib/                 storage (IndexedDB), stats, dates, router, API clients
src/components/          sheets, pickers, charts
src/views/               Journal, Tracker, Editor, Stats, Settings
public/sw.js             offline cache
scripts/                 icon generation, dev runner
```
