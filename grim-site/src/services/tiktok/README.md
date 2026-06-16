# TikTok Converter

Small Python CLI script for downloading a TikTok link as `mp4` or `mp3`.

## Requirements

- Python 3.12+
- `yt-dlp`
- `ffmpeg` and `ffprobe` installed on your system if you want `mp3` output

## Install

```bash
python -m pip install -r requirements.txt
```

If TikTok extraction stops working, update the downloader first:

```bash
python -m pip install -U yt-dlp
```

## Usage

Download as MP4:

```bash
python tiktok_convert.py "https://www.tiktok.com/@user/video/1234567890" --format mp4
```

Download as MP3:

```bash
python tiktok_convert.py "https://www.tiktok.com/@user/video/1234567890" --format mp3
```

Launch the simple console menu:

```bash
python tiktok_convert.py --ui
```

Resume a favorites batch from the 110th item, which matches output numbering like `0110`:

```bash
python tiktok_convert.py --favorites --start-index 110
```

Choose an output directory:

```bash
python tiktok_convert.py "https://www.tiktok.com/@user/video/1234567890" --format mp4 --output-dir downloads
```

Set a custom filename:

```bash
python tiktok_convert.py "https://www.tiktok.com/@user/video/1234567890" --format mp3 --filename my-track
```

## Notes

- The script accepts one TikTok URL per run.
- In `--favorites` mode, `--start-index` lets you continue from a later item instead of downloading from the beginning.
- Default output names use the TikTok title and video ID.
- Custom filenames are sanitized and made unique automatically if the target name already exists.
- No watermark-removal behavior is added here; the script relies on what `yt-dlp` can extract from the URL.
