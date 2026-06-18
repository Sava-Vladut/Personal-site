// Metadata for the /services console. The HEIC converter runs live in the
// browser; the YouTube and TikTok tools post a link to the FastAPI backend
// (server/app.py), which wraps the scripts in src/services/ and streams the
// finished file back for download.

export const services = [
  {
    id: 'heic',
    index: '01',
    slug: 'heic→png',
    title: 'HEIC → PNG',
    mode: 'live',
    blurb:
      'Decode Apple HEIC / HEIF stills into PNG. Runs entirely in your browser — files never leave the device.',
  },
  {
    id: 'youtube',
    index: '02',
    slug: 'yt→mp3/mp4',
    title: 'YouTube → MP3 / MP4',
    mode: 'api',
    blurb:
      'Paste a YouTube video link, then pick a format and quality. The server pulls the stream with yt-dlp — MP3 audio at your chosen bitrate or MP4 video at your chosen resolution — and your browser downloads it.',
    endpoint: '/api/youtube',
    placeholder: 'https://www.youtube.com/watch?v=…',
    formats: ['mp3', 'mp4'],
    // Quality choices depend on the selected format; the first entry is default.
    quality: {
      mp3: ['320k', '256k', '192k', '128k'],
      mp4: ['1080p', '720p', '480p', '360p'],
    },
    note: 'single video',
  },
  {
    id: 'tiktok',
    index: '03',
    slug: 'tiktok→mp4',
    title: 'TikTok → MP4 / MP3',
    mode: 'api',
    blurb:
      'Paste a TikTok link and pick a format. The server fetches it via yt-dlp and streams back MP4 video or MP3 audio.',
    endpoint: '/api/tiktok',
    placeholder: 'https://www.tiktok.com/@user/video/…',
    formats: ['mp4', 'mp3'],
    note: 'single video',
  },
]
