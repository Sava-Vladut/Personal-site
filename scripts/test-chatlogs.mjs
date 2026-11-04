// Chat logs (server/chatlogs.js): reading IRC and archive lines, merging sources, and a lookup against fake archives.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';
import { cleanLogin, createChatLogs, merge, parseIrc, slimArchive, slimIrc, twitchEmotes } from '../server/chatlogs.js';

test('IRC lines become kept lines', () => {
  const msg = slimIrc(parseIrc('@color=#FF0000;display-name=Forsen;tmi-sent-ts=1700000000000;user-id=22 :forsen!forsen@forsen.tmi.twitch.tv PRIVMSG #xqc :hello there'));
  assert.deepEqual(msg, { t: 1700000000000, i: '22', u: 'forsen', n: 'Forsen', c: '#FF0000', m: 'hello there', k: 'msg' });
  const me = slimIrc(parseIrc('@user-id=22;tmi-sent-ts=1 :a!a@a PRIVMSG #b :\u0001ACTION waves\u0001'));
  assert.equal(me.k, 'me');
  assert.equal(me.m, 'waves');
  const ban = slimIrc(parseIrc('@ban-duration=60;target-user-id=22;tmi-sent-ts=2 :tmi.twitch.tv CLEARCHAT #xqc :forsen'));
  assert.equal(ban.k, 'ban');
  assert.equal(ban.i, '22');
  assert.match(ban.m, /60s/);
  assert.equal(slimIrc(parseIrc(':tmi.twitch.tv CLEARCHAT #xqc')), null); // a whole-chat clear is nobody's line
  const sub = slimIrc(parseIrc('@login=a;user-id=5;system-msg=a\\ssubscribed;tmi-sent-ts=3 :tmi.twitch.tv USERNOTICE #b :yay'));
  assert.equal(sub.m, 'a subscribed · yay');
});

test('archive lines become kept lines, and two archives make one list', () => {
  const a = slimArchive({ type: 1, text: 'hi', username: 'u', displayName: 'U', tags: { 'tmi-sent-ts': '1000', 'user-id': '9' } });
  const b = slimArchive({ type: 1, text: 'hi', username: 'u', displayName: 'U', tags: { 'tmi-sent-ts': '1400', 'user-id': '9' } });
  const c = slimArchive({ type: 2, text: ':u has been timed out', username: ':u', tags: { 'tmi-sent-ts': '500', 'target-user-id': '9', 'ban-duration': '1' } });
  assert.equal(slimArchive({ type: 0 }), null);
  const out = merge([[a, c], [b]]);
  assert.equal(out.length, 2);
  assert.equal(out[0].k, 'ban');
});

test('logins from names, @names and links', () => {
  assert.equal(cleanLogin('@Forsen'), 'forsen');
  assert.equal(cleanLogin('https://www.twitch.tv/xQc/videos'), 'xqc');
  assert.equal(cleanLogin('no spaces'), null);
});

test('a lookup asks every archive by id and merges the months', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chatlogs-'));
  const real = globalThis.fetch;
  const asked = [];
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  globalThis.fetch = async (url) => {
    url = String(url);
    asked.push(url);
    if (url.startsWith('https://ivr.test')) return reply([{ login: 'chan', id: '1', displayName: 'Chan' }, { login: 'who', id: '2', displayName: 'Who' }]);
    if (url.startsWith('https://finder.test')) return reply({ userLogs: { instances: ['https://c.test'] } });
    if (url.startsWith('https://recent.test')) return reply({ messages: ['@user-id=2;tmi-sent-ts=' + Date.now() + ' :who!who@who PRIVMSG #chan :just now'] });
    if (url === 'https://a.test/list?channelid=1&userid=2') return reply({ availableLogs: [{ year: '2025', month: '3' }] });
    if (url === 'https://c.test/list?channelid=1&userid=2') return reply({ availableLogs: [{ year: '2025', month: '3' }, { year: '2025', month: '4' }] });
    if (url === 'https://b.test/list?channelid=1&userid=2') return reply({}, 403);
    if (url.includes('/channelid/1/userid/2/2025/3')) return reply({ messages: [{ type: 1, text: 'march', username: 'who', tags: { 'tmi-sent-ts': String(Date.UTC(2025, 2, 5, 12)), 'user-id': '2' } }] });
    return new Response('Not found', { status: 404 });
  };
  try {
    const h = createChatLogs({ directory: dir, isAdmin: () => false, archives: ['a.test', 'b.test'], finder: 'https://finder.test', recent: 'https://recent.test', ivr: 'https://ivr.test', record: false });
    const call = async (path, qs, method = 'GET') => {
      let out;
      const res = { writeHead(s) { this.s = s; }, setHeader() {}, end(b) { out = { status: this.s, body: JSON.parse(b) }; } };
      await h.api({ method, headers: {} }, res, path, new URL(`http://x${path}?${qs}`));
      return out;
    };
    const look = (await call('/api/chatlogs/lookup', 'channel=chan&user=who')).body;
    assert.deepEqual(look.sources.map((s) => s.host), ['a.test', 'c.test']);
    assert.ok(look.months.includes('2025-03') && look.months.includes('2025-04'));
    assert.equal(look.lately, 1);
    const march = (await call('/api/chatlogs/month', 'channel=chan&user=who&month=2025-03')).body;
    assert.equal(march.total, 1); // both archives had it: kept once
    assert.equal(march.messages[0].m, 'march');
    const year = (await call('/api/chatlogs/activity', 'channel=chan&user=who&year=2025&tz=UTC')).body;
    assert.deepEqual(year.days, { '2025-03-05': 1 });
    await assert.rejects(call('/api/chatlogs/watch', 'channel=chan', 'POST'), { status: 403 });
  } finally {
    globalThis.fetch = real;
    await rm(dir, { recursive: true, force: true });
  }
});

/* ---------- emotes ---------- */

test('Twitch emotes are read from the tag, with positions counted in the text they belong to', () => {
  assert.deepEqual(twitchEmotes('Kappa hi Kappa PogChamp', '25:0-4,9-13/305954156:15-22'), { Kappa: 't25', PogChamp: 't305954156' });
  assert.equal(twitchEmotes('no emotes here', ''), undefined);
  assert.equal(twitchEmotes('hello there', '25:0-3,garbage'), undefined); // "hell" is part of a word, not an emote's name
  assert.equal(twitchEmotes('Kapp', '25:0-9'), undefined);             // past the end
  assert.deepEqual(twitchEmotes('😀 Kappa', '25:2-6'), { Kappa: 't25' }); // positions count characters, not UTF-16 units
  const me = slimIrc(parseIrc('@emotes=25:4-8;user-id=1;tmi-sent-ts=1 :a!a@a PRIVMSG #b :\u0001ACTION wow Kappa\u0001'));
  assert.deepEqual(me.e, { Kappa: 't25' }); // an action's positions skip the "ACTION " that Twitch wraps it in
  const plain = slimIrc(parseIrc('@user-id=1;tmi-sent-ts=1 :a!a@a PRIVMSG #b :no emotes'));
  assert.equal('e' in plain, false);
  const archived = slimArchive({ type: 1, text: 'Kappa', username: 'u', tags: { 'tmi-sent-ts': '1', emotes: '25:0-4' } });
  assert.deepEqual(archived.e, { Kappa: 't25' });
});

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const call = (h) => async (path, qs, method = 'GET') => {
  let out;
  const res = { writeHead(s, headers) { this.s = s; this.h = headers; }, setHeader() {}, end(b) { out = { status: this.s, headers: this.h, body: JSON.parse(b) }; } };
  await h.api({ method, headers: {} }, res, path, new URL(`http://x${path}?${qs}`));
  return out;
};
async function withFetch(fake, run) {
  const dir = await mkdtemp(join(tmpdir(), 'chatlogs-'));
  const real = globalThis.fetch;
  globalThis.fetch = fake;
  try { await run(dir); } finally { globalThis.fetch = real; await rm(dir, { recursive: true, force: true }); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('7TV, BetterTTV and FrankerFaceZ emotes come together as names and codes, the channel’s first', async () => {
  const asked = [];
  await withFetch(async (url) => {
    url = String(url);
    asked.push(url);
    if (url === 'https://7tv.io/v3/emote-sets/global') return reply({ emotes: [{ id: 'g1', name: 'GlobalSeven', flags: 0, data: { id: 'g1', flags: 0 } }, { id: 'g2', name: 'Shared', flags: 0, data: { id: 'g2', flags: 0 } }] });
    if (url === 'https://7tv.io/v3/users/twitch/77') return reply({ emote_set: { emotes: [{ id: 'c1', name: 'Shared', flags: 0, data: { id: 'c1', flags: 0 } }, { id: 'c2', name: 'Wide', flags: 1, data: { id: 'c2', flags: 0 } }, { id: 'c3', name: 'Wide2', flags: 0, data: { id: 'c3', flags: 256 } }] } });
    if (url === 'https://api.betterttv.net/3/cached/emotes/global') return reply([{ id: 'b1', code: 'EZ', modifier: false }, { id: 'b2', code: 'w!', modifier: true }, { id: 'b3', code: 'cvMask', modifier: false }]);
    if (url === 'https://api.betterttv.net/3/cached/users/twitch/77') return reply({ channelEmotes: [{ id: 'b4', code: 'OwnBttv' }], sharedEmotes: [{ id: 'b5', code: 'SharedBttv' }] });
    if (url === 'https://api.frankerfacez.com/v1/set/global') return reply({ default_sets: [3], sets: { 3: { emoticons: [{ id: 9, name: 'FfzGlobal' }, { id: 10, name: 'ffzW', modifier: true }] } } });
    if (url === 'https://api.frankerfacez.com/v1/room/id/77') return reply({ room: { set: 5 }, sets: { 5: { emoticons: [{ id: 11, name: 'FfzOwn' }, { id: 12, name: 'FfzMove', animated: { 1: 'x' } }] } } });
    return new Response('Not found', { status: 404 });
  }, async (dir) => {
    const h = createChatLogs({ directory: dir, isAdmin: () => false, record: false });
    const out = await call(h)('/api/chatlogs/emotes', 'channel=77');
    assert.match(out.headers['Cache-Control'], /max-age/);
    assert.deepEqual(out.body.emotes, {
      Shared: 's' + 'c1',       // the channel's 7TV beats the global one
      Wide: 'zsc2',             // zero-width from the set's own flag
      Wide2: 'zsc3',            // and from the emote's
      OwnBttv: 'bb4',
      SharedBttv: 'bb5',
      FfzOwn: 'f11',
      FfzMove: 'g12',           // animated
      GlobalSeven: 'sg1',
      EZ: 'bb1',
      cvMask: 'zbb3',           // BetterTTV's overlay emotes
      FfzGlobal: 'f9',
    });                         // modifiers (w!, ffzW) are effects, not pictures
    await call(h)('/api/chatlogs/emotes', 'channel=77');
    assert.equal(asked.length, 6, 'the sets are kept, not asked for again');
    await assert.rejects(call(h)('/api/chatlogs/emotes', 'channel=nope'), { status: 400 });
  });
});

test('a channel on none of the services still gets the global emotes', async () => {
  await withFetch(async (url) => {
    url = String(url);
    if (url === 'https://api.betterttv.net/3/cached/emotes/global') return reply([{ id: 'b1', code: 'EZ' }]);
    if (url.includes('7tv.io/v3/emote-sets/global')) throw new Error('down'); // one service being down doesn't spoil the rest
    return new Response('{"error":"not found"}', { status: 404, headers: { 'content-type': 'application/json' } });
  }, async (dir) => {
    const h = createChatLogs({ directory: dir, isAdmin: () => false, record: false });
    assert.deepEqual((await call(h)('/api/chatlogs/emotes', 'channel=5')).body.emotes, { EZ: 'bb1' });
  });
});

/* ---------- speed ---------- */

const line = (text, at, id = '2') => ({ type: 1, text, username: 'who', tags: { 'tmi-sent-ts': String(at), 'user-id': id } });

test('a slow archive doesn’t hold a lookup or a month up, and joins what’s cached when it answers', async () => {
  const hung = (init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(init.signal.reason)));
  const march = Date.UTC(2025, 2, 5, 12);
  let slowAnswers = false;
  await withFetch(async (url, init) => {
    url = String(url);
    if (url.startsWith('https://ivr.test')) return reply([{ login: 'chan', id: '1', displayName: 'Chan' }, { login: 'who', id: '2', displayName: 'Who' }]);
    if (url.startsWith('https://finder.test')) return reply({});
    if (url.startsWith('https://recent.test')) return reply({ messages: [] });
    if (url === 'https://fast.test/list?channelid=1&userid=2') return reply({ availableLogs: [{ year: '2025', month: '3' }] });
    if (url === 'https://slow.test/list?channelid=1&userid=2') { await wait(1200); return reply({ availableLogs: [{ year: '2025', month: '3' }, { year: '2024', month: '12' }] }); }
    if (url === 'https://hung.test/list?channelid=1&userid=2') return hung(init);
    if (url === 'https://fast.test/channelid/1/userid/2/2025/3?json=1') return reply({ messages: [line('fast', march)] });
    if (url === 'https://slow.test/channelid/1/userid/2/2025/3?json=1') { await wait(1500); slowAnswers = true; return reply({ messages: [line('slow', march + 60_000)] }); }
    return new Response('Not found', { status: 404 });
  }, async (dir) => {
    const h = createChatLogs({ directory: dir, isAdmin: () => false, archives: ['fast.test', 'slow.test', 'hung.test'], finder: 'https://finder.test', recent: 'https://recent.test', ivr: 'https://ivr.test', record: false });
    const api = call(h);
    let t0 = Date.now();
    const look = (await api('/api/chatlogs/lookup', 'channel=chan&user=who')).body;
    assert.ok(Date.now() - t0 < 1100, `the lookup left the slow ones behind (${Date.now() - t0} ms)`);
    assert.deepEqual(look.sources.map((s) => s.host), ['fast.test']);
    await wait(700); // the slow archive answers and is part of the cached lookup
    const again = (await api('/api/chatlogs/lookup', 'channel=chan&user=who')).body;
    assert.deepEqual(again.sources.map((s) => s.host), ['fast.test', 'slow.test']);
    assert.ok(again.months.includes('2024-12'));

    t0 = Date.now();
    const first = (await api('/api/chatlogs/month', 'channel=chan&user=who&month=2025-03')).body;
    assert.ok(Date.now() - t0 < 1400, `the month left the slow archive behind (${Date.now() - t0} ms)`);
    assert.deepEqual(first.messages.map((x) => x.m), ['fast']);
    while (!slowAnswers) await wait(50);
    await wait(50);
    const later = (await api('/api/chatlogs/month', 'channel=chan&user=who&month=2025-03')).body;
    assert.deepEqual(later.messages.map((x) => x.m), ['fast', 'slow']);
    assert.deepEqual(later.sources, ['fast.test', 'slow.test']);
  });
});

test('a finished month is counted per day in the viewer’s time zone, and kept on disk', async () => {
  const lines = [line('a', Date.UTC(2025, 2, 5, 12)), line('b', Date.UTC(2025, 2, 5, 23, 30)), line('c', Date.UTC(2025, 2, 31, 23, 0))];
  let reads = 0;
  const fake = async (url) => {
    url = String(url);
    if (url.startsWith('https://ivr.test')) return reply([{ login: 'chan', id: '1', displayName: 'Chan' }, { login: 'who', id: '2', displayName: 'Who' }]);
    if (url.startsWith('https://finder.test')) return reply({});
    if (url.startsWith('https://recent.test')) return reply({ messages: [] });
    if (url === 'https://a.test/list?channelid=1&userid=2') return reply({ availableLogs: [{ year: '2025', month: '3' }] });
    if (url === 'https://a.test/channelid/1/userid/2/2025/3?json=1') { reads++; return reply({ messages: lines }); }
    return new Response('Not found', { status: 404 });
  };
  await withFetch(fake, async (dir) => {
    const open = () => createChatLogs({ directory: dir, isAdmin: () => false, archives: ['a.test'], finder: 'https://finder.test', recent: 'https://recent.test', ivr: 'https://ivr.test', record: false });
    const days = async (h, tz) => (await call(h)('/api/chatlogs/days', `channel=chan&user=who&month=2025-03&tz=${tz}`)).body;
    const h = open();
    assert.deepEqual((await days(h, 'UTC')).days, { '2025-03-05': 2, '2025-03-31': 1 });
    // Bucharest is two hours ahead: the late lines are on the next day, and the last one is already April
    const ro = await days(h, 'Europe/Bucharest');
    assert.deepEqual(ro.days, { '2025-03-05': 1, '2025-03-06': 1, '2025-04-01': 1 });
    assert.equal(ro.total, 3);
    assert.equal(reads, 1);
    await assert.rejects(call(h)('/api/chatlogs/days', 'channel=chan&user=who&month=soon'), { status: 400 });

    // the year adds the months up and leaves out what the time zone moved out of it
    const year = (await call(h)('/api/chatlogs/activity', 'channel=chan&user=who&year=2025&tz=Europe/Bucharest')).body;
    assert.equal(year.total, 3);
    await wait(1300); // saved a moment after being read
    // a server that has just started (and finds every archive gone) still has the month
    globalThis.fetch = async (url) => (String(url).startsWith('https://ivr.test') ? fake(url) : new Response('down', { status: 500 }));
    const h2 = open();
    assert.deepEqual((await days(h2, 'UTC')).days, { '2025-03-05': 2, '2025-03-31': 1 });
    assert.equal(reads, 1, 'nothing was read from the archive again');
  });
});

/* ---------- emotes in the page (src/lib/emotes.ts) ---------- */

const bundle = await rolldown({ input: new URL('../src/lib/emotes.ts', import.meta.url).pathname });
const code = (await bundle.generate({ format: 'cjs' })).output[0].code;
await bundle.close();
const loaded = { exports: {} };
vm.runInNewContext(code, { module: loaded, exports: loaded.exports });
const { emote, pieces, stacks } = loaded.exports;
const shape = (list) => list.map((p) => (typeof p === 'string' ? p : p.name)).join('|');

test('a line’s words become emotes when Twitch marked them or the channel has them', () => {
  const channel = new Map([['EZ', 'bb5590b223b344e2c42a9e28e3'], ['Okayeg', 'zs01EZPFKAH8000FNWX000ADZW5H'], ['constructor', 's1']]);
  const words = (list) => JSON.stringify(list); // the page's code runs in its own realm, so arrays are compared as text
  assert.equal(words(pieces('plain words', undefined, null)), '["plain words"]');
  assert.equal(shape(pieces('so EZ  Kappa !', { Kappa: 't25' }, channel)), 'so |EZ|  |Kappa| !');
  assert.equal(shape(pieces('ez EZ.', undefined, channel)), 'ez EZ.', 'names are case-sensitive and stand alone');
  assert.equal(shape(pieces('Kappa', { Kappa: 't25' }, null)), 'Kappa');
  assert.equal(typeof pieces('Kappa', { Kappa: 't25' }, null)[0], 'object');
  assert.equal(words(pieces('toString constructor', {}, new Map())), '["toString constructor"]', 'object keys are not emotes');
  assert.equal(pieces('hasOwnProperty', { Kappa: 't25' }, null)[0], 'hasOwnProperty');
});

test('emote codes become picture addresses, two sizes each', () => {
  assert.equal(emote('Kappa', 't25').src, 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0');
  assert.match(emote('Kappa', 't25').srcset, /2\.0 2x$/);
  assert.equal(emote('Okayeg', 's01EZ').src, 'https://cdn.7tv.app/emote/01EZ/1x.webp');
  assert.equal(emote('EZ', 'b59').srcset, 'https://cdn.betterttv.net/emote/59/1x.webp 1x, https://cdn.betterttv.net/emote/59/2x.webp 2x');
  assert.equal(emote('KEKW', 'f388376').src, 'https://cdn.frankerfacez.com/emote/388376/1');
  const moving = emote('Wave', 'g7');
  assert.equal(moving.src, 'https://cdn.frankerfacez.com/emote/7/animated/1');
  assert.equal(moving.still, 'https://cdn.frankerfacez.com/emote/7/1');
  assert.equal(emote('Wide', 'zs01').zero, true);
  assert.equal(emote('Nope', 'x1'), null);
  assert.equal(emote('Nope', 's'), null);
});

test('zero-width emotes lie over the emote before them', () => {
  const channel = new Map([['Base', 's1'], ['Hat', 'zs2'], ['Other', 's3']]);
  const names = (list) => stacks(list).map((p) => (typeof p === 'string' ? JSON.stringify(p) : p.map((e) => e.name).join('+'))).join(' ');
  assert.equal(names(pieces('Base Hat', undefined, channel)), 'Base+Hat');
  assert.equal(names(pieces('Base   Hat Hat', undefined, channel)), 'Base+Hat+Hat');
  assert.equal(names(pieces('Base word Hat', undefined, channel)), 'Base " word " Hat');
  assert.equal(names(pieces('Hat Other', undefined, channel)), 'Hat " " Other');
});
