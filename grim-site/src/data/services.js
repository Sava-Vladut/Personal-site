// Metadata for the /services console. The HEIC converter runs live in the
// browser; the TikTok tool posts a link to the FastAPI backend
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
    id: 'tiktok',
    index: '02',
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
  {
    id: 'twitchlogs',
    index: '03',
    slug: 'twitch→logs',
    title: 'Twitch Chat Logs',
    mode: 'live',
    blurb:
      "Retrieve a user's Twitch chat history across indexed channels — latest, a random line, a specific archived month, or raw numeric ID. Reads the open rustlog API; runs entirely in your browser.",
  },
  {
    id: 'miner',
    index: '04',
    slug: 'grim→miner',
    title: 'Grim Miner Network',
    mode: 'external',
    blurb:
      'Live dashboard for the grimnetwork mining node. Opens the realtime hashrate + payout panel in a new tab.',
    href: 'http://grimnetwork.srvp.ro:5000/',
  },
]
