#!/usr/bin/env python3
"""Download a TikTok URL as MP4 or MP3 using yt-dlp."""

from __future__ import annotations

import argparse
import re
import shutil
import signal
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse
from threading import Event


VALID_OUTPUT_EXTENSIONS = {"mp3", "mp4", "m4a", "mov", "mkv", "webm"}
TIKTOK_HOST_PATTERN = re.compile(r"(^|\.)tiktok(v)?\.com$", re.IGNORECASE)
URL_PATTERN = re.compile(r"https?://[^\s<>'\")\]]+")
DEFAULT_FAVORITES_FILE = "Favorite Videos.txt"
STOP_REQUESTED = Event()


class DownloadCancelled(Exception):
    pass


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Convert TikTok links into MP4 video or MP3 audio files."
    )
    parser.add_argument("url", nargs="?", help="TikTok video URL")
    parser.add_argument(
        "--ui",
        action="store_true",
        help="Launch a simple interactive console menu instead of using direct arguments",
    )
    parser.add_argument(
        "--format",
        default="mp4",
        choices=("mp3", "mp4"),
        help="Output format (default: mp4)",
    )
    parser.add_argument(
        "--output-dir",
        default=".",
        help="Directory where the converted file will be saved (default: current directory)",
    )
    parser.add_argument(
        "--filename",
        help="Optional output filename without extension",
    )
    parser.add_argument(
        "--favorites",
        action="store_true",
        help=f"Batch download TikTok links from {DEFAULT_FAVORITES_FILE} as MP4 files",
    )
    parser.add_argument(
        "--favorites-file",
        default=DEFAULT_FAVORITES_FILE,
        help=f"Text file to read when using --favorites (default: {DEFAULT_FAVORITES_FILE})",
    )
    parser.add_argument(
        "--jobs",
        type=int,
        default=4,
        help="Number of concurrent downloads to use in --favorites mode (default: 4)",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=1,
        help=(
            "Start batch downloads from this 1-based index in --favorites mode "
            "(for example, 110 to continue from 0110)"
        ),
    )
    return parser


def request_stop(signum: int | None = None, frame=None) -> None:
    STOP_REQUESTED.set()


def install_stop_handlers() -> None:
    signal.signal(signal.SIGINT, request_stop)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, request_stop)


def validate_tiktok_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False

    if parsed.scheme not in {"http", "https"}:
        return False

    hostname = parsed.hostname or ""
    if not TIKTOK_HOST_PATTERN.search(hostname):
        return False

    path = (parsed.path or "").strip("/")
    if not path:
        return False

    if "/video/" in f"/{path}/" or "/share/video/" in f"/{path}/" or path.startswith("t/"):
        return True

    # Support TikTok short-link hosts such as vm.tiktok.com and vt.tiktok.com.
    return hostname.lower().startswith(("vm.", "vt."))


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", name).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = cleaned.rstrip(". ")
    return cleaned[:120] or "tiktok_download"


def has_existing_output(directory: Path, stem: str) -> bool:
    for extension in VALID_OUTPUT_EXTENSIONS:
        if (directory / f"{stem}.{extension}").exists():
            return True
    return False


def make_unique_stem(directory: Path, preferred_stem: str) -> str:
    stem = sanitize_filename(preferred_stem)
    candidate = stem
    index = 1
    while has_existing_output(directory, candidate):
        candidate = f"{stem}-{index}"
        index += 1
    return candidate


def missing_ffmpeg_binaries() -> list[str]:
    return [binary for binary in ("ffmpeg", "ffprobe") if shutil.which(binary) is None]


def ensure_ffmpeg_available() -> None:
    missing = missing_ffmpeg_binaries()
    if missing:
        joined = ", ".join(missing)
        raise SystemExit(
            f"MP3 conversion requires FFmpeg. Missing: {joined}. "
            "Install ffmpeg and ffprobe, then rerun the command."
        )


def import_yt_dlp():
    try:
        from yt_dlp import YoutubeDL
        from yt_dlp.utils import DownloadError
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "Missing dependency: yt-dlp. Install it with "
            "`pip install -r requirements.txt` and rerun the command."
        ) from exc
    return YoutubeDL, DownloadError


def abort_if_stop_requested(_: dict) -> None:
    if STOP_REQUESTED.is_set():
        raise DownloadCancelled("Download stopped by user.")


def default_stem_from_info(info: dict) -> str:
    title = sanitize_filename(info.get("title") or "tiktok_download")
    video_id = sanitize_filename(info.get("id") or "video")
    return f"{title} [{video_id}]"


def render_download_error(error: Exception) -> str:
    message = str(error).strip() or "Unknown yt-dlp error."
    lowered = message.lower()

    if "private" in lowered:
        return "The TikTok video appears to be private or unavailable."
    if "login" in lowered or "sign in" in lowered:
        return "TikTok is requesting authentication for this video."
    if "not available" in lowered or "not found" in lowered or "404" in lowered:
        return "The TikTok video could not be found or is no longer available."
    if "unable to extract" in lowered:
        return (
            "yt-dlp could not extract this TikTok video. Update yt-dlp with "
            "`pip install -U yt-dlp` and try again."
        )
    return f"Download failed: {message}"


def extract_urls_from_text(text: str) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for match in URL_PATTERN.findall(text):
        url = match.rstrip(").,;]}")
        if url in seen:
            continue
        if validate_tiktok_url(url):
            seen.add(url)
            urls.append(url)
    return urls


def load_favorites_file(path: Path) -> list[str]:
    if not path.exists():
        raise SystemExit(f"Favorites file not found: {path}")
    if not path.is_file():
        raise SystemExit(f"Favorites path is not a file: {path}")
    return extract_urls_from_text(path.read_text(encoding="utf-8", errors="ignore"))


def prompt_text(prompt: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default else ""
    while True:
        try:
            value = input(f"{prompt}{suffix}: ").strip()
        except (EOFError, KeyboardInterrupt):
            raise DownloadCancelled("Download stopped by user.")
        if value:
            return value
        if default is not None:
            return default
        print("Please enter a value.")


def prompt_choice(prompt: str, choices: list[str], default_index: int | None = 0) -> str:
    if default_index is None:
        options = "/".join(choices)
    else:
        options = "/".join(
            f"{choice}" if i != default_index else f"{choice.upper()}"
            for i, choice in enumerate(choices)
        )
    while True:
        try:
            value = input(f"{prompt} ({options}): ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            raise DownloadCancelled("Download stopped by user.")
        if not value and default_index is not None and 0 <= default_index < len(choices):
            return choices[default_index]
        if value in choices:
            return value
        print(f"Choose one of: {', '.join(choices)}")


def prompt_int(prompt: str, default: int, minimum: int = 1) -> int:
    while True:
        try:
            value = input(f"{prompt} [{default}]: ").strip()
        except (EOFError, KeyboardInterrupt):
            raise DownloadCancelled("Download stopped by user.")
        if not value:
            return default
        try:
            parsed = int(value)
        except ValueError:
            print("Please enter a whole number.")
            continue
        if parsed < minimum:
            print(f"Please enter a number of at least {minimum}.")
            continue
        return parsed


def run_single_download_ui() -> int:
    url = prompt_text("TikTok URL")
    requested_format = prompt_choice("Format", ["mp4", "mp3"], default_index=0)
    output_dir = Path(prompt_text("Output directory", ".")).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = prompt_text("Custom filename (optional)", "").strip() or None

    if requested_format == "mp3":
        ensure_ffmpeg_available()

    saved_path = run_download(url, requested_format, output_dir, sanitize_filename(filename) if filename else None)
    print(f"Saved file to: {saved_path}")
    return 0


def run_batch_download_ui() -> int:
    favorites_file = Path(prompt_text("Favorites file", DEFAULT_FAVORITES_FILE)).expanduser()
    requested_format = prompt_choice("Format", ["mp4", "mp3"], default_index=0)
    output_dir = Path(prompt_text("Output directory", ".")).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    jobs = prompt_int("Concurrent jobs", 4, minimum=1)
    start_index = prompt_int("Start index (110 continues from 0110)", 1, minimum=1)

    if requested_format == "mp3":
        ensure_ffmpeg_available()

    urls = load_favorites_file(favorites_file)
    if not urls:
        print(f"No TikTok URLs were found in {favorites_file}.", file=sys.stderr)
        return 2

    failures, cancelled = run_batch_download(
        urls,
        requested_format,
        output_dir,
        jobs,
        start_index,
    )
    if cancelled or STOP_REQUESTED.is_set():
        print("Stopped by user.", file=sys.stderr)
        return 130
    if failures:
        print(f"Completed with {failures} failure(s).", file=sys.stderr)
        return 1
    return 0


def run_console_ui() -> int:
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise SystemExit("--ui requires an interactive terminal.")

    print("TikTok Downloader")
    print("1) Download a single video")
    print("2) Download a favorites batch")
    print("3) Exit")

    while True:
        try:
            choice = prompt_choice("Choose an option", ["1", "2", "3"], default_index=None)
        except DownloadCancelled:
            return 130

        try:
            if choice == "1":
                return run_single_download_ui()
            if choice == "2":
                return run_batch_download_ui()
            return 0
        except DownloadCancelled:
            return 130
        except SystemExit as exc:
            print(str(exc), file=sys.stderr)
        print()
        print("TikTok Downloader")
        print("1) Download a single video")
        print("2) Download a favorites batch")
        print("3) Exit")


def find_downloaded_file(
    output_dir: Path,
    known_candidates: Iterable[Path],
    before_snapshot: set[Path],
    requested_format: str,
) -> Path | None:
    for candidate in known_candidates:
        if candidate.exists():
            return candidate

    current_files = {path for path in output_dir.iterdir() if path.is_file()}
    new_files = sorted(current_files - before_snapshot, key=lambda path: path.stat().st_mtime, reverse=True)
    for path in new_files:
        if path.suffix.lower() == f".{requested_format}":
            return path

    if requested_format == "mp4":
        for path in new_files:
            if path.suffix.lower() in {".mp4", ".mov", ".mkv", ".webm"}:
                return path

    return None


def build_ydl_options(output_template: str, requested_format: str) -> dict:
    options = {
        "outtmpl": output_template,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "restrictfilenames": False,
        "progress_hooks": [abort_if_stop_requested],
    }

    if requested_format == "mp4":
        if not missing_ffmpeg_binaries():
            options["format"] = "bv*+ba/b"
            options["merge_output_format"] = "mp4"
        else:
            options["format"] = "best[ext=mp4]/best"
    else:
        options["format"] = "bestaudio/best"
        options["postprocessors"] = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ]

    return options


def run_download(
    url: str,
    requested_format: str,
    output_dir: Path,
    filename: str | None,
    stem_prefix: str | None = None,
) -> Path:
    if STOP_REQUESTED.is_set():
        raise DownloadCancelled("Download stopped by user.")

    YoutubeDL, DownloadError = import_yt_dlp()
    metadata_options = {
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }

    try:
        with YoutubeDL(metadata_options) as ydl:
            info = ydl.extract_info(url, download=False)
        if STOP_REQUESTED.is_set():
            raise DownloadCancelled("Download stopped by user.")
    except DownloadError as exc:
        raise SystemExit(render_download_error(exc)) from exc

    if filename:
        stem = make_unique_stem(output_dir, filename)
    else:
        preferred_stem = default_stem_from_info(info)
        if stem_prefix:
            preferred_stem = f"{stem_prefix} {preferred_stem}"
        stem = make_unique_stem(output_dir, preferred_stem)

    output_template = str(output_dir / f"{stem}.%(ext)s")
    known_candidates = [output_dir / f"{stem}.{requested_format}"]
    before_snapshot = {path for path in output_dir.iterdir() if path.is_file()}
    ydl_options = build_ydl_options(output_template, requested_format)

    try:
        with YoutubeDL(ydl_options) as ydl:
            ydl.download([url])
    except DownloadCancelled:
        raise
    except DownloadError as exc:
        raise SystemExit(render_download_error(exc)) from exc

    saved_path = find_downloaded_file(output_dir, known_candidates, before_snapshot, requested_format)
    if saved_path is None:
        raise SystemExit("The download completed, but the output file could not be located.")
    return saved_path


def run_batch_download(
    urls: list[str],
    requested_format: str,
    output_dir: Path,
    jobs: int,
    start_index: int,
) -> tuple[int, bool]:
    if start_index < 1:
        raise SystemExit("--start-index must be at least 1.")
    if start_index > len(urls):
        raise SystemExit(
            f"--start-index {start_index} is past the end of the favorites list "
            f"({len(urls)} URL(s) total)."
        )

    batch_urls = urls[start_index - 1 :]

    def worker(index: int, url: str) -> tuple[int, str, bool, Path | None, str | None]:
        if STOP_REQUESTED.is_set():
            return index, url, False, None, "Download stopped by user."
        try:
            saved_path = run_download(
                url,
                requested_format,
                output_dir,
                None,
                stem_prefix=f"{index:04d}",
            )
        except DownloadCancelled as exc:
            return index, url, False, None, str(exc)
        except SystemExit as exc:
            return index, url, False, None, str(exc)
        return index, url, True, saved_path, None

    failures = 0
    cancelled = False
    total = len(batch_urls)
    completed = 0

    executor = ThreadPoolExecutor(max_workers=jobs)
    try:
        future_map = {}
        for index, url in enumerate(batch_urls, start=start_index):
            if STOP_REQUESTED.is_set():
                cancelled = True
                break
            future = executor.submit(worker, index, url)
            future_map[future] = (index, url)

        for future in as_completed(future_map):
            if STOP_REQUESTED.is_set():
                cancelled = True
            completed += 1
            index, url, ok, saved_path, error = future.result()
            prefix = f"[{completed}/{total}]"
            if ok:
                print(f"{prefix} Saved file to: {saved_path}")
            else:
                if error == "Download stopped by user.":
                    cancelled = True
                    print(f"{prefix} Stopped ({url}).", file=sys.stderr)
                else:
                    failures += 1
                    print(f"{prefix} Failed ({url}): {error}", file=sys.stderr)
            if cancelled:
                for pending_future in future_map:
                    if not pending_future.done():
                        pending_future.cancel()
                break
    finally:
        executor.shutdown(wait=True, cancel_futures=True)

    return failures, cancelled


def main() -> int:
    install_stop_handlers()
    parser = build_parser()
    args = parser.parse_args()

    if args.ui or (len(sys.argv) == 1 and sys.stdin.isatty() and sys.stdout.isatty()):
        return run_console_ui()

    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    custom_filename = sanitize_filename(args.filename) if args.filename else None

    if args.favorites:
        favorites_file = Path(args.favorites_file).expanduser()
        if custom_filename is not None:
            print(
                "--filename is only supported for single-URL downloads.",
                file=sys.stderr,
            )
            return 2
        if args.jobs < 1:
            print("--jobs must be at least 1.", file=sys.stderr)
            return 2
        if args.start_index < 1:
            print("--start-index must be at least 1.", file=sys.stderr)
            return 2

        urls = load_favorites_file(favorites_file)
        if not urls:
            print(f"No TikTok URLs were found in {favorites_file}.", file=sys.stderr)
            return 2

        if args.format == "mp3":
            ensure_ffmpeg_available()

        failures, cancelled = run_batch_download(
            urls,
            args.format,
            output_dir,
            args.jobs,
            args.start_index,
        )
        if cancelled or STOP_REQUESTED.is_set():
            print("Stopped by user.", file=sys.stderr)
            return 130
        if failures:
            print(f"Completed with {failures} failure(s).", file=sys.stderr)
            return 1
        return 0

    if not args.url:
        print(
            "Provide a TikTok URL or use --favorites to process "
            f"{DEFAULT_FAVORITES_FILE}.",
            file=sys.stderr,
        )
        return 2

    if not validate_tiktok_url(args.url):
        print(
            "Invalid TikTok URL. Provide a full TikTok video link such as "
            "`https://www.tiktok.com/@user/video/1234567890`.",
            file=sys.stderr,
        )
        return 2

    if args.format == "mp3":
        ensure_ffmpeg_available()

    try:
        saved_path = run_download(args.url, args.format, output_dir, custom_filename)
    except DownloadCancelled:
        print("Stopped by user.", file=sys.stderr)
        return 130
    print(f"Saved file to: {saved_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
