// Saved TikToks (github.com/Sava-Vladut/tiktok-favorites-viewer): the viewer, its download page and yt-dlp run in their
// own container (the `tiktok` service in /root/deploy/compose.yml), only on the Docker network. Everything under
// /api/tiktok/ is passed on to it as it is, streamed both ways (videos seek with Range requests), and only for the
// signed-in admin: the videos are someone's favorites, never public. The page under #/tiktok opens it full screen.
import http from 'node:http';

// what the viewer needs to know about a request, and what the browser needs back
const PASS_UP = ['accept', 'content-type', 'content-length', 'range', 'if-range', 'if-none-match', 'if-modified-since', 'origin', 'x-requested-with'];
const PASS_DOWN = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified', 'cache-control'];

export function createTiktokProxy({ target, isAdmin }) {
  const up = new URL(target);

  return function tiktok(req, res, url) {
    if (!isAdmin(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ error: 'Sign in to the site to see your saved TikToks.' }));
    }
    // the viewer's links are relative, so it has to be opened as a folder
    if (url.pathname === '/api/tiktok') {
      res.writeHead(308, { Location: '/api/tiktok/' + url.search });
      return res.end();
    }

    const headers = { host: req.headers.host || up.host }; // the viewer checks Origin against Host on changes
    for (const h of PASS_UP) if (req.headers[h] !== undefined) headers[h] = req.headers[h];

    return new Promise((resolve) => {
      const out = http.request({
        hostname: up.hostname,
        port: up.port,
        method: req.method,
        path: url.pathname.slice('/api/tiktok'.length) + url.search,
        headers,
      }, (back) => {
        const head = { 'X-Robots-Tag': 'noindex, nofollow' };
        for (const h of PASS_DOWN) if (back.headers[h] !== undefined) head[h] = back.headers[h];
        // only this browser keeps a copy
        if (head['cache-control'] && !/no-store/.test(head['cache-control'])) head['cache-control'] = 'private, ' + head['cache-control'];
        res.writeHead(back.statusCode || 502, head);
        back.pipe(res);
        back.on('end', resolve);
        back.on('error', () => { res.destroy(); resolve(); });
      });
      out.setTimeout(30_000, () => out.destroy(new Error('timeout')));
      out.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: 'The TikTok downloader isn’t running on the server.' }));
        } else res.destroy();
        resolve();
      });
      // the browser gave up (seeking a video does that all the time): stop reading from the viewer too
      res.on('close', () => { if (!res.writableFinished) out.destroy(); resolve(); });
      req.pipe(out);
    });
  };
}
