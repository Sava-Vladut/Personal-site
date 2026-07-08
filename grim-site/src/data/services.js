// Metadata for the /services console. The HEIC converter runs live in the
// browser; the TikTok tool posts a link to the FastAPI backend
// (server/app.py), which wraps the scripts in src/services/ and streams the
// finished file back for download.

export const services = [
  {
    id: 'flightmanager',
    index: '01',
    slug: 'flight→manager',
    title: 'Flight Manager Site',
    mode: 'external',
    blurb:
      'Open the public Flight Manager console hosted on grimnetwork. No account is required.',
    href: 'http://grimnetwork.srvp.ro:5002/',
  },
]
