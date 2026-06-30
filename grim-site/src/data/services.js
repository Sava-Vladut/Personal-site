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
      "Retrieve Twitch chat history from indexed channels — a single user's logs (latest, a random line, an archived month, or raw numeric ID) or an entire channel's chat for a given day. Reads the open rustlog API; runs entirely in your browser.",
  },
  {
    id: 'miner',
    index: '04',
    slug: 'grim→miner',
    title: 'Grim Miner Network',
    mode: 'live',
    blurb:
      'Live telemetry from the grimnetwork channel-points miner — every watched Twitch channel, its current point balance, and last activity, proxied through the server and refreshed in place. Full ApexCharts dashboard is one tab away.',
    href: 'http://grimnetwork.srvp.ro:5000/',
  },
]
