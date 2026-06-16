"""FastAPI backend for the /services console.

Wraps the existing CLI converters in src/services so the browser can POST a
link and stream back the finished file:

    POST /api/youtube  {"url": "..."}                 -> audio/mpeg (.mp3)
    POST /api/tiktok   {"url": "...", "format": "mp4"} -> video/mp4 or audio/mpeg

The HEIC converter stays client-side and is not handled here.
"""

from __future__ import annotations

import importlib.util
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

BASE_DIR = Path(__file__).resolve().parent
SERVICES_DIR = BASE_DIR.parent / "src" / "services"


def _load_module(name: str, relative_path: str):
    """Import a converter script by file path so we reuse its real logic."""
    path = SERVICES_DIR / relative_path
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load module from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


yt_service = _load_module("yt_service", "yt/main.py")
tiktok_service = _load_module("tiktok_service", "tiktok/tiktok_convert.py")

app = FastAPI(title="grim services api")

# Vite proxies /api during dev so this is same-origin, but keep CORS open for
# direct calls and make the download filename header readable to JS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


class YouTubeRequest(BaseModel):
    url: str


class TikTokRequest(BaseModel):
    url: str
    format: str = "mp4"


def _ensure_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise HTTPException(
            status_code=503,
            detail="ffmpeg is not installed or not on PATH on the server.",
        )


def _file_response(path: Path, media_type: str, workdir: Path) -> FileResponse:
    """Return the file and delete its temp directory once the response is sent."""
    return FileResponse(
        path,
        media_type=media_type,
        filename=path.name,
        background=BackgroundTask(shutil.rmtree, workdir, ignore_errors=True),
    )


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "ffmpeg": shutil.which("ffmpeg") is not None}


@app.post("/api/youtube")
def youtube_to_mp3(request: YouTubeRequest) -> FileResponse:
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=422, detail="A YouTube URL is required.")
    if "list=" in url and "watch?v=" not in url and "/watch" not in url:
        raise HTTPException(
            status_code=422,
            detail="Playlists aren't supported here — paste a single video URL.",
        )

    _ensure_ffmpeg()
    workdir = Path(tempfile.mkdtemp(prefix="yt_"))

    try:
        yt = yt_service.YouTube(url)
        stream = yt_service.get_best_audio_stream(yt)
        if stream is None:
            raise HTTPException(status_code=422, detail="No audio stream was found for this video.")
        downloaded = Path(stream.download(output_path=str(workdir)))
        mp3_path = yt_service.convert_to_mp3(downloaded)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except Exception as exc:  # noqa: BLE001
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=_clean_error(exc)) from exc

    return _file_response(mp3_path, "audio/mpeg", workdir)


@app.post("/api/tiktok")
def tiktok_download(request: TikTokRequest) -> FileResponse:
    url = request.url.strip()
    requested_format = request.format.lower()

    if requested_format not in {"mp3", "mp4"}:
        raise HTTPException(status_code=422, detail="format must be 'mp4' or 'mp3'.")
    if not tiktok_service.validate_tiktok_url(url):
        raise HTTPException(
            status_code=422,
            detail="Invalid TikTok URL. Use a full link like "
            "https://www.tiktok.com/@user/video/1234567890.",
        )

    if requested_format == "mp3":
        _ensure_ffmpeg()

    workdir = Path(tempfile.mkdtemp(prefix="tiktok_"))

    try:
        saved_path = tiktok_service.run_download(url, requested_format, workdir, None)
    except SystemExit as exc:
        # run_download raises SystemExit(message) on extraction/download errors.
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=_clean_error(exc)) from exc

    media_type = "audio/mpeg" if requested_format == "mp3" else "video/mp4"
    return _file_response(Path(saved_path), media_type, workdir)


def _clean_error(exc: Exception) -> str:
    message = str(exc).strip() or exc.__class__.__name__
    return message.split("\n")[0][:300]
