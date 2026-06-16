# grim services API

FastAPI backend that powers the live YouTube and TikTok converters in the
`/services` tab. It wraps the existing scripts in `../src/services/` — the
browser POSTs a link and the server streams the finished file back.

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
| POST   | `/api/youtube` | `{ "url" }`                       | `audio/mpeg`     |
| POST   | `/api/tiktok`  | `{ "url", "format": "mp4"\|"mp3" }` | video/mp4 or audio/mpeg |

Errors come back as JSON `{ "detail": "..." }` with a `4xx`/`5xx` status.

## Production note

This is not exposed by the static nginx image. To ship it live, run the API as
its own service and reverse-proxy `/api/*` to it (e.g. add an `nginx`/Caddy
`location /api` block, or a second container in `docker-compose.yml`).
