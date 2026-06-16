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
    slug: 'yt→mp3',
    title: 'YouTube → MP3',
    mode: 'api',
    blurb:
      'Paste a YouTube video link. The server pulls the best audio stream and transcodes it to a 320 kbps MP3, then your browser downloads it.',
    endpoint: '/api/youtube',
    placeholder: 'https://www.youtube.com/watch?v=…',
    formats: ['mp3'],
    note: 'single video · 320 kbps mp3',
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
