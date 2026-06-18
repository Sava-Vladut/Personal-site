#!/usr/bin/env python3
"""Download YouTube audio as MP3 using yt-dlp.

Used both as a CLI (`python main.py`) and imported by the FastAPI server,
which calls `download_audio_to_mp3(url, output_dir)`.

yt-dlp is used instead of pytubefix because it handles YouTube's bot-detection
(PO token) and signature-cipher changes far more reliably.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path


MP3_QUALITY = "320"

# Allowed quality choices, mirrored on the frontend (src/data/services.js).
MP3_BITRATES = {"320", "256", "192", "128"}
MP4_HEIGHTS = {"1080", "720", "480", "360"}


def import_yt_dlp():
    try:
        from yt_dlp import YoutubeDL
        from yt_dlp.utils import DownloadError
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Missing dependency: yt-dlp. Install it with "
            "`pip install -r requirements.txt` and rerun the command."
        ) from exc
    return YoutubeDL, DownloadError


def ensure_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is not installed or not available in PATH.")


def render_download_error(error: Exception) -> str:
    message = str(error).strip() or "Unknown yt-dlp error."
    lowered = message.lower()

    if "sign in to confirm" in lowered or "not a bot" in lowered or "bot" in lowered:
        return (
            "YouTube flagged this request as automated. Make sure yt-dlp is current "
            "(`pip install -U yt-dlp`), or set YTDLP_COOKIES_FROM_BROWSER (e.g. 'chrome') "
            "to download with your browser session."
        )
    if "private" in lowered:
        return "This video is private or unavailable."
    if "members-only" in lowered or "premieres in" in lowered:
        return "This video is members-only or hasn't premiered yet."
    if "not available" in lowered or "not found" in lowered or "404" in lowered:
        return "The video could not be found or is no longer available."
    if "unable to extract" in lowered:
        return (
            "yt-dlp could not extract this video. Update yt-dlp with "
            "`pip install -U yt-dlp` and try again."
        )
    return f"Download failed: {message}"


def _normalise_bitrate(quality: str | None) -> str:
    """Coerce a quality choice like '320k' to a bare, validated mp3 bitrate."""
    digits = "".join(ch for ch in str(quality or "") if ch.isdigit())
    return digits if digits in MP3_BITRATES else MP3_QUALITY


def _normalise_height(quality: str | None) -> str:
    """Coerce a quality choice like '720p' to a bare, validated mp4 height."""
    digits = "".join(ch for ch in str(quality or "") if ch.isdigit())
    return digits if digits in MP4_HEIGHTS else "1080"


def cookie_options() -> dict:
    """Optional auth so YouTube treats requests as a real session.

    Bot-detection ("sign in to confirm you're not a bot") can hit a server IP
    even on the latest yt-dlp. Set one of these env vars to bypass it:

      YTDLP_COOKIES_FROM_BROWSER  browser name, e.g. "chrome", "firefox", "edge"
                                  (the browser must be closed so its cookie DB
                                  isn't locked).
      YTDLP_COOKIE_FILE           path to an exported cookies.txt (Netscape).
    """
    browser = os.environ.get("YTDLP_COOKIES_FROM_BROWSER", "").strip()
    if browser:
        # yt-dlp wants a tuple: (browser, profile, keyring, container).
        return {"cookiesfrombrowser": (browser,)}

    cookie_file = os.environ.get("YTDLP_COOKIE_FILE", "").strip()
    if cookie_file:
        return {"cookiefile": cookie_file}

    return {}


def build_audio_options(output_template: str, allow_playlist: bool, quality: str) -> dict:
    return {
        "outtmpl": output_template,
        "format": "bestaudio/best",
        "noplaylist": not allow_playlist,
        "quiet": True,
        "no_warnings": True,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": quality,
            }
        ],
        **cookie_options(),
    }


def build_video_options(output_template: str, allow_playlist: bool, height: str) -> dict:
    # Prefer h264/m4a streams so they merge cleanly into an MP4 container, then
    # fall back to whatever best fits under the height cap.
    selector = (
        f"bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]/"
        f"bestvideo[height<={height}]+bestaudio/"
        f"best[height<={height}]/best"
    )
    return {
        "outtmpl": output_template,
        "format": selector,
        "noplaylist": not allow_playlist,
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        **cookie_options(),
    }


def _new_files(output_dir: Path, before: set[Path], suffix: str) -> list[Path]:
    """Return files with the given suffix that weren't there before, newest first."""
    suffix = suffix.lower()
    return sorted(
        (
            path
            for path in output_dir.iterdir()
            if path.is_file() and path not in before and path.suffix.lower() == suffix
        ),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )


def _new_mp3_files(output_dir: Path, before: set[Path]) -> list[Path]:
    """Return new .mp3 files, newest first (kept for the playlist helper)."""
    return _new_files(output_dir, before, ".mp3")


def download_audio_to_mp3(url: str, output_dir: Path, quality: str = MP3_QUALITY) -> Path:
    """Download a single video's audio as MP3 and return the saved path.

    `quality` is the target bitrate in kbps (e.g. '320', '192', or '256k').
    Raises RuntimeError with a clean, user-facing message on failure so the
    server can surface it as a 422 detail.
    """
    ensure_ffmpeg()
    YoutubeDL, DownloadError = import_yt_dlp()

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    before = {path for path in output_dir.iterdir() if path.is_file()}
    output_template = str(output_dir / "%(title)s [%(id)s].%(ext)s")

    options = build_audio_options(output_template, False, _normalise_bitrate(quality))
    try:
        with YoutubeDL(options) as ydl:
            ydl.download([url])
    except DownloadError as exc:
        raise RuntimeError(render_download_error(exc)) from exc

    new_files = _new_files(output_dir, before, ".mp3")
    if not new_files:
        raise RuntimeError("The download completed, but the MP3 file could not be located.")
    return new_files[0]


def download_video_to_mp4(url: str, output_dir: Path, quality: str = "1080") -> Path:
    """Download a single video as MP4 capped at the chosen height and return its path.

    `quality` is the max resolution height (e.g. '1080', '720', or '720p').
    """
    ensure_ffmpeg()
    YoutubeDL, DownloadError = import_yt_dlp()

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    before = {path for path in output_dir.iterdir() if path.is_file()}
    output_template = str(output_dir / "%(title)s [%(id)s].%(ext)s")

    options = build_video_options(output_template, False, _normalise_height(quality))
    try:
        with YoutubeDL(options) as ydl:
            ydl.download([url])
    except DownloadError as exc:
        raise RuntimeError(render_download_error(exc)) from exc

    new_files = _new_files(output_dir, before, ".mp4")
    if not new_files:
        raise RuntimeError("The download completed, but the MP4 file could not be located.")
    return new_files[0]


def download_playlist_to_mp3(url: str, output_dir: Path) -> int:
    """Download every video in a playlist as MP3. Returns the count saved."""
    ensure_ffmpeg()
    YoutubeDL, DownloadError = import_yt_dlp()

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    before = {path for path in output_dir.iterdir() if path.is_file()}
    output_template = str(output_dir / "%(playlist_index)s - %(title)s [%(id)s].%(ext)s")

    options = build_audio_options(output_template, True, MP3_QUALITY)
    try:
        with YoutubeDL(options) as ydl:
            ydl.download([url])
    except DownloadError as exc:
        raise RuntimeError(render_download_error(exc)) from exc

    return len(_new_mp3_files(output_dir, before))


def main() -> None:
    url = input("Paste a YouTube video or playlist URL: ").strip()
    if not url:
        print("No URL provided.")
        return

    output_dir = Path.cwd()

    try:
        if "list=" in url:
            count = download_playlist_to_mp3(url, output_dir)
            print(f"Done. Downloaded {count} track(s) to {output_dir}.")
        else:
            mp3_path = download_audio_to_mp3(url, output_dir)
            print(f"Downloaded: {mp3_path.name}")
    except RuntimeError as exc:
        print(f"Failed: {exc}")


if __name__ == "__main__":
    main()
