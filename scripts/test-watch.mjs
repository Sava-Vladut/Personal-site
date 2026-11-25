// Watch live (server/watch.js): only Twitch's playlist servers are fetched, qualities point back here, offline is a 404.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError } from '../server/http-error.js';
import { rolldown } from 'rolldown';
import { badgeMap, createWatchHandler, hasAd, pointQualities, twitchPlaylist, variants, withPrefetch } from '../server/watch.js';

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

const MASTER = (host) => `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=8,RESOLUTION=1920x1080,STABLE-VARIANT-ID="1080p60"\nhttps://${host}.playlist.ttvnw.net/v1/1080.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=3,STABLE-VARIANT-ID="720p60"\nhttps://${host}.playlist.ttvnw.net/v1/720.m3u8\n`;
const LIVE = (seq) => `#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:${seq}\n#EXTINF:2.000,live\nhttps://seg/${seq}.mp4\n`;
const AD = '#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-DATERANGE:ID="stitched-ad-1",CLASS="twitch-stitched-ad",DURATION=30\n#EXT-X-DISCONTINUITY\n#EXTINF:2.000,Amazon|247\nhttps://seg/ad.mp4\n';

test('ads are told apart from the stream, and each quality keeps its id', () => {
  assert.equal(hasAd(LIVE(5)), false);
  assert.equal(hasAd(AD), true);
  assert.equal(hasAd('#EXTINF:2.000,Amazon|1\nhttps://seg/a.mp4'), true, 'an ad segment without the date range');
  assert.deepEqual(variants(MASTER('a')).map((v) => v.id), ['1080p60', '720p60']);
  assert.deepEqual(pointQualities(MASTER('a'), true, 'some').split('\n').filter((l) => l.startsWith('/api')).map((l) => new URLSearchParams(l.split('?')[1]).get('v')), ['1080p60', '720p60']);
  assert.match(pointQualities(MASTER('a'), false, 'some'), /\/api\/watch\/playlist\?u=https%3A%2F%2Fa\.playlist\.ttvnw\.net%2Fv1%2F1080\.m3u8&c=some&v=1080p60\n/);
});

test('a playlist with an ad is swapped for the same quality from another player type, numbered the same', async () => {
  let primary = AD;
  let backupHasAd = false;
  const types = [];
  const watch = createWatchHandler({
    fetch: async (u, init) => {
      const url = String(u);
      if (url.startsWith('https://gql.twitch.tv')) { types.push(JSON.parse(init.body).variables.playerType); return reply(200, TOKEN); }
      if (url.startsWith('https://usher')) return reply(200, MASTER(`b${types.length}`));
      if (url.startsWith('https://main.')) return reply(200, primary);
      if (url.includes('/720.m3u8')) return reply(200, url.startsWith('https://b1.') ? AD : backupHasAd ? AD : LIVE(9));
      return reply(404, '');
    },
  });
  const get = async () => {
    const res = fakeRes();
    const q = new URLSearchParams({ u: 'https://main.playlist.ttvnw.net/v1/720.m3u8', c: 'some', v: '720p60' });
    await watch({ method: 'GET' }, res, '/api/watch/playlist', new URL(`http://x/api/watch/playlist?${q}`));
    return res.body;
  };

  assert.equal(await get(), LIVE(9), 'popout had the ad too, Android didn’t');
  assert.deepEqual(types, ['popout', 'site']);
  assert.equal(await get(), LIVE(9), 'the Android one is asked again first');
  assert.equal(types.length, 2);

  backupHasAd = true;
  assert.equal(await get(), LIVE(9), 'every one has the ad: the last clean copy again');
  const asked = types.length;
  assert.equal(await get(), LIVE(9));
  assert.equal(types.length, asked, 'the backups aren’t asked again straight away');

  primary = LIVE(20);
  assert.equal(await get(), LIVE(20), 'the break is over: the first player type again');

  // Without the channel and quality (an old page), the playlist is passed on as Twitch wrote it.
  const res = fakeRes();
  primary = AD;
  await watch({ method: 'GET' }, res, '/api/watch/playlist', new URL(`http://x/api/watch/playlist?u=${encodeURIComponent('https://main.playlist.ttvnw.net/v1/720.m3u8')}`));
  assert.equal(res.body, AD);
});

test('the embedded player’s token is asked for first', async () => {
  const bodies = [];
  const watch = createWatchHandler({ fetch: async (u, init) => { if (init?.body) bodies.push(JSON.parse(init.body).variables); return String(u).startsWith('https://gql') ? reply(200, TOKEN) : reply(200, MASTER('a')); } });
  await watch({ method: 'GET' }, fakeRes(), '/api/watch/some.m3u8', new URL('http://x/api/watch/some.m3u8'));
  assert.deepEqual(bodies, [{ login: 'some', platform: 'web', playerType: 'embed' }]);
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

test('chat badges: Twitch’s global ones, the channel’s own over them; what’s on, or null when offline', async () => {
  assert.deepEqual(badgeMap(
    [{ setID: 'subscriber', version: '0', imageURL: 'https://g/0/1', title: 'Sub' }, { setID: 'vip', version: '1', imageURL: 'https://g/v/1', title: 'VIP' }, { setID: 'x', version: '1', imageURL: 'javascript:1' }],
    [{ setID: 'subscriber', version: '0', imageURL: 'https://c/0/1', title: 'Channel sub' }],
  ), { 'subscriber/0': ['https://c/0/1', 'Channel sub'], 'vip/1': ['https://g/v/1', 'VIP'] });

  let calls = 0;
  let user = { id: '7', displayName: 'Some', broadcastSettings: { title: 'Hi' }, stream: { viewersCount: 12, createdAt: '2026-11-23T10:00:00Z', game: { displayName: 'Chess' } }, broadcastBadges: [] };
  const watch = createWatchHandler({ fetch: async () => { calls++; return reply(200, { data: { badges: [], user } }); } });
  const res = fakeRes();
  await watch({ method: 'GET' }, res, '/api/watch/chat/some', new URL('http://x/'));
  assert.deepEqual(JSON.parse(res.body), { id: '7', name: 'Some', stream: { title: 'Hi', game: 'Chess', viewers: 12, since: Date.parse('2026-11-23T10:00:00Z') }, badges: {} });
  await watch({ method: 'GET' }, fakeRes(), '/api/watch/chat/some', new URL('http://x/'));
  assert.equal(calls, 1, 'kept for a minute');
  user = { ...user, stream: null };
  const off = fakeRes();
  await watch({ method: 'GET' }, off, '/api/watch/chat/other', new URL('http://x/'));
  assert.equal(JSON.parse(off.body).stream, null);
  user = null;
  await assert.rejects(watch({ method: 'GET' }, fakeRes(), '/api/watch/chat/nobody', new URL('http://x/')), (e) => e.status === 404);
  await assert.rejects(watch({ method: 'GET' }, fakeRes(), '/api/watch/chat/a.b', new URL('http://x/')), (e) => e.status === 404);
});

const bundle = await rolldown({ input: new URL('../src/lib/twitchChat.ts', import.meta.url).pathname });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const chat = await import(`data:text/javascript,${encodeURIComponent(output[0].code)}`);

test('chat lines: emotes, /me, subs, deletions, timeouts and room modes from Twitch’s IRC', () => {
  const msg = chat.chatEvent('@badges=subscriber/6,vip/1;color=#1E90FF;display-name=Ann;emotes=25:6-10;id=m1;tmi-sent-ts=1000 :ann!ann@ann.tmi.twitch.tv PRIVMSG #x :hello Kappa there');
  assert.deepEqual(msg, { kind: 'line', line: { id: 'm1', t: 1000, u: 'ann', n: 'Ann', c: '#1E90FF', b: ['subscriber/6', 'vip/1'], m: 'hello Kappa there', k: 'msg', e: { Kappa: 't25' } } });
  assert.equal(chat.chatEvent('@id=m2 :bob!bob@bob PRIVMSG #x :\u0001ACTION waves\u0001').line.k, 'me');
  const sub = chat.chatEvent('@login=cat;display-name=Cat;id=m3;system-msg=Cat\\ssubscribed\\sfor\\s3\\smonths. :tmi.twitch.tv USERNOTICE #x :yay');
  assert.equal(sub.line.k, 'sub');
  assert.equal(sub.line.u, 'cat');
  assert.equal(sub.line.note, 'Cat subscribed for 3 months.');
  assert.deepEqual(chat.chatEvent('@target-msg-id=m1 :tmi.twitch.tv CLEARMSG #x :hello'), { kind: 'delete', id: 'm1' });
  assert.deepEqual(chat.chatEvent('@ban-duration=600 :tmi.twitch.tv CLEARCHAT #x :Bob'), { kind: 'clear', login: 'bob' });
  assert.deepEqual(chat.chatEvent(':tmi.twitch.tv CLEARCHAT #x'), { kind: 'clear', login: null });
  assert.deepEqual(chat.chatEvent('@emote-only=1;followers-only=-1;slow=30;subs-only=0 :tmi.twitch.tv ROOMSTATE #x').room, { emoteOnly: true, subsOnly: false, slow: 30, followers: -1 });
  assert.equal(chat.chatEvent(':tmi.twitch.tv 001 justinfan1 :Welcome'), null);
  assert.equal(chat.nameColor({ c: '', u: 'ann' }), chat.nameColor({ c: '', u: 'ann' }));
  assert.equal(chat.bigEmote('https://cdn.7tv.app/emote/abc/1x.webp').src, 'https://cdn.7tv.app/emote/abc/4x.webp');
});
