# grim services API

FastAPI backend that powers the live TikTok converter in the
`/services` tab. It wraps the existing scripts in `../src/services/` — the
browser POSTs a link and the server streams the finished file back.

It also hosts the account store (see `auth.py`): a server-side SQLite database
of users + sessions, replacing the old in-browser sql.js blob. Accounts are now
shared across every browser/device, and the session is an httpOnly cookie the
server owns. The first account ever registered becomes the admin; everyone else
is a plain operator until an admin promotes them.

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
| GET    | `/api/health`  | —                                 | `{ ok, ffmpeg }` |
| POST   | `/api/tiktok`  | `{ "url", "format": "mp4"\|"mp3" }` | video/mp4 or audio/mpeg |
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

## Production note

This is not exposed by the static nginx image. To ship it live, run the API as
its own service and reverse-proxy `/api/*` to it (e.g. add an `nginx`/Caddy
`location /api` block, or a second container in `docker-compose.yml`).
