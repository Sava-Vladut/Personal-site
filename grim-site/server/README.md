# grim services API

FastAPI backend that powers the live TikTok converter in the
`/services` tab. It wraps the existing scripts in `../src/services/` — the
browser POSTs a link and the server streams the finished file back.

It also hosts the account store (see `auth.py`): a server-side SQLite database
of users + sessions, replacing the old in-browser sql.js blob. Accounts are now
shared across every browser/device, and the session is an httpOnly cookie the
server owns. The first account ever registered becomes the admin; everyone else
is a plain operator until an admin promotes them.

And it proxies Twitch Helix for channel-specific chat badges (see `twitch.py`):
the Twitch Logs viewer renders global badges from a baked-in map, but a channel's
custom subscriber tiers + bit badges are fetched here using an app access token.
Optional — see [Twitch badges](#twitch-badges-optional) below.

The HEIC → PNG converter runs entirely in the browser and needs no backend.

## Requirements

- Python 3.10+
- [`ffmpeg`](https://ffmpeg.org/) on `PATH` (needed for MP3, and for merging TikTok MP4)

## Run (dev)

```bash
cd grim-site/server
pip install -r requirements.txt
python -m uvicorn app:app --reload --port 8000
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`, so once both
are running the converters work at `http://localhost:5174/#/services`.

## Endpoints

| Method | Path           | Body                              | Returns          |
| ------ | -------------- | --------------------------------- | ---------------- |
| GET    | `/api/health`  | —                                 | `{ ok, ffmpeg, twitch }` |
| POST   | `/api/tiktok`  | `{ "url", "format": "mp4"\|"mp3" }` | video/mp4 or audio/mpeg |
| GET    | `/api/twitch/channel-badges` | `?broadcaster_id=<id>` | `{ badges: { "set/ver": {url1x,url2x,title} } }` |
| POST   | `/api/auth/register` | `{ "username", "password" }` | account + sets cookie |
| POST   | `/api/auth/login`    | `{ "username", "password" }` | account + sets cookie |
| POST   | `/api/auth/logout`   | —                            | `{ ok }`, clears cookie |
| GET    | `/api/auth/me`       | —                            | current account or 401 |
| GET    | `/api/users`         | — (admin)                    | account list |
| POST   | `/api/users`         | `{ "username", "password", "isAdmin" }` (admin) | new account |
| DELETE | `/api/users/{id}`    | — (admin)                    | `{ ok }` |
| PATCH  | `/api/users/{id}/admin` | `{ "isAdmin" }` (admin)    | `{ ok }` |
| POST   | `/api/users/{id}/password` | `{ "password" }` (admin) | `{ ok }` |

Errors come back as JSON `{ "detail": "..." }` with a `4xx`/`5xx` status.

### Config

| Env var         | Default          | Purpose                                           |
| --------------- | ---------------- | ------------------------------------------------- |
| `AUTH_DB_PATH`  | `/data/users.db` | SQLite file (mounted on the `auth_data` volume).  |
| `COOKIE_SECURE` | `false`          | Set `true` in production (HTTPS) for a Secure cookie. |
| `TWITCH_CLIENT_ID` | _(blank)_     | Twitch app client id for channel badges (see below). |
| `TWITCH_CLIENT_SECRET` | _(blank)_ | Twitch app client secret.                         |

## Twitch badges (optional)

The Twitch Logs viewer always renders **global** badges (broadcaster, mod, vip,
prime, turbo, bits tiers, sub-gifter, …) from a baked-in map in
`src/data/twitchBadges.js` — no setup needed.

To also render a channel's **custom** subscriber-tier and bit badges, give the
API Twitch app credentials so it can call Helix:

1. Create an app at <https://dev.twitch.tv/console/apps> (any redirect URL — the
   client-credentials flow doesn't use it).
2. Put the id/secret in `.env` (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`); the
   compose files pass them through to the `api` container.

The server caches an app access token (refreshed on expiry/401) and each
channel's badge map for an hour. With no credentials, `/api/twitch/channel-badges`
returns an empty map and the viewer falls back to global badges + text labels —
nothing breaks.

## Production note

This is not exposed by the static nginx image. To ship it live, run the API as
its own service and reverse-proxy `/api/*` to it (e.g. add an `nginx`/Caddy
`location /api` block, or a second container in `docker-compose.yml`).
