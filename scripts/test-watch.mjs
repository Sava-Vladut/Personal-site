// Watch live (server/watch.js): only Twitch's playlist servers are fetched, qualities point back here, offline is a 404.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError } from '../server/http-error.js';
import { createWatchHandler, pointQualities, twitchPlaylist, withPrefetch } from '../server/watch.js';

test('only https playlists on *.ttvnw.net are fetched', () => {
  assert.equal(twitchPlaylist('https://euc11.playlist.ttvnw.net/v1/playlist/abc.m3u8'), 'https://euc11.playlist.ttvnw.net/v1/playlist/abc.m3u8');
  for (const bad of ['http://euc11.playlist.ttvnw.net/x', 'https://evil.com/x', 'https://ttvnw.net.evil.com/x', 'https://a@x.ttvnw.net/x', 'https://x.ttvnw.net:8080/x', 'nope']) {
    assert.equal(twitchPlaylist(bad), null, bad);
  }
});

test('each quality is fetched through /api/watch/playlist, the tags stay', () => {
  const out = pointQualities('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nhttps://a.playlist.ttvnw.net/v1/p.m3u8?x=1&y=2\n');
  assert.equal(out, '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\n/api/watch/playlist?u=https%3A%2F%2Fa.playlist.ttvnw.net%2Fv1%2Fp.m3u8%3Fx%3D1%26y%3D2\n');
});

test('low latency: the qualities say so, and prefetch entries become segments', () => {
  assert.match(pointQualities('https://a.playlist.ttvnw.net/q.m3u8', true), /&ll=1$/);
  const pl = '#EXTM3U\n#EXTINF:2.002,live\nhttps://seg/1.mp4\n#EXT-X-TWITCH-PREFETCH:https://seg/2.mp4\n#EXT-X-TWITCH-PREFETCH:https://seg/3.mp4';
  assert.equal(withPrefetch(pl), '#EXTM3U\n#EXTINF:2.002,live\nhttps://seg/1.mp4\n#EXTINF:2.002,live\nhttps://seg/2.mp4\n#EXTINF:2.002,live\nhttps://seg/3.mp4');
});

function fakeRes() {
  return { head: null, body: '', writeHead(status, head) { this.status = status; this.head = head; }, end(b) { this.body = b; } };
}
const reply = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
const TOKEN = { data: { streamPlaybackAccessToken: { value: '{"a":1}', signature: 'sig' } } };

test('a live channel gets its qualities, an offline one a 404', async () => {
  let usher = 200;
  const calls = [];
  const watch = createWatchHandler({
    fetch: async (u) => {
      calls.push(String(u));
      if (String(u).startsWith('https://gql.twitch.tv')) return reply(200, TOKEN);
      return reply(usher, '#EXTM3U\nhttps://b.playlist.ttvnw.net/v1/q.m3u8\n');
    },
  });
  const res = fakeRes();
  await watch({ method: 'GET' }, res, '/api/watch/SomeOne.m3u8', new URL('http://x/api/watch/SomeOne.m3u8'));
  assert.equal(res.status, 200);
  assert.match(res.body, /\/api\/watch\/playlist\?u=https%3A%2F%2Fb\.playlist/);
  assert.match(calls[1], /^https:\/\/usher\.ttvnw\.net\/api\/v2\/channel\/hls\/someone\.m3u8\?sig=sig&token=/);

  usher = 404;
  await assert.rejects(watch({ method: 'GET' }, fakeRes(), '/api/watch/someone.m3u8', new URL('http://x/')), (e) => e instanceof HttpError && e.status === 404);
  await assert.rejects(watch({ method: 'GET' }, fakeRes(), '/api/watch/../x.m3u8', new URL('http://x/')), (e) => e.status === 404);
  await assert.rejects(watch({ method: 'GET' }, fakeRes(), '/api/watch/playlist', new URL('http://x/api/watch/playlist?u=https://evil.com/a')), (e) => e.status === 400);
});
