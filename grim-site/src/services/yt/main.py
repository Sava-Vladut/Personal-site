from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

from pytubefix import Playlist, YouTube


def parse_abr(value: str | None) -> int:
    if not value:
        return 0
    match = re.search(r"(\d+)", value)
    return int(match.group(1)) if match else 0


def get_best_audio_stream(yt: YouTube):
    audio_streams = yt.streams.filter(only_audio=True)
    best_stream = max(
        audio_streams,
        key=lambda stream: (
            parse_abr(stream.abr),
            stream.filesize or stream.filesize_approx or 0,
        ),
        default=None,
    )
    return best_stream or yt.streams.get_audio_only()


def convert_to_mp3(source_path: Path) -> Path:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is not installed or not available in PATH.")

    target_path = source_path.with_suffix(".mp3")
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(source_path),
        "-vn",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "320k",
        str(target_path),
    ]

    try:
        
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        if target_path.exists():
            target_path.unlink()
        raise RuntimeError(exc.stderr.strip() or "ffmpeg failed to convert the file.") from exc

    source_path.unlink()
    return target_path


def download_audio(url: str) -> None:
    yt = YouTube(url)
    stream = get_best_audio_stream(yt)
    if stream is None:
        print(f"Skipping: no audio stream found for {url}")
        return

    downloaded_path = Path(stream.download())

    try:
        mp3_path = convert_to_mp3(downloaded_path)
    except RuntimeError as exc:
        print(f"Failed to convert '{yt.title}': {exc}")
        return

    print(f"Downloaded: {yt.title} -> {mp3_path.name}")


def main() -> None:
    url = input("Paste a YouTube video or playlist URL: ").strip()

    if "list=" in url:
        playlist = Playlist(url)
        print(f"Found playlist: {playlist.title}")
        for video_url in playlist.video_urls:
            download_audio(video_url)
        return

    download_audio(url)


if __name__ == "__main__":
    main()
