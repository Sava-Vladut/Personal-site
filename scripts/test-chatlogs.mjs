// Chat logs (server/chatlogs.js): reading IRC and archive lines, merging sources, and a lookup against fake archives.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { cleanLogin, createChatLogs, merge, parseIrc, slimArchive, slimIrc } from '../server/chatlogs.js';

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
