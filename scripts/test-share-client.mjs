import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// The real src/lib/share.ts, with the browser's storage, toasts and fetch supplied in memory.
const mocks = {
  './photos': { photoBlob: async (id) => (id === 'pmissing01' ? undefined : new Blob([id], { type: 'image/webp' })) },
  './store': { toast: (text) => toasts.push(text), getPeople: () => [{ id: 'p1', name: 'Ana', icon: 't:heart', relation: 'Friend', text: 'secret about Ana' }, { id: 'p2', name: '  ', icon: null }] },
  './i18n': { t: (s) => s },
};
const bundle = await rolldown({
  input: 'src/lib/share.ts',
  plugins: [{
    name: 'boundaries',
    resolveId(id) { if (id in mocks) return '\0' + id; },
    load(id) {
      if (id.startsWith('\0')) return Object.keys(mocks[id.slice(1)]).map((n) => `export const ${n} = globalThis.mocks[${JSON.stringify(id.slice(1))}][${JSON.stringify(n)}];`).join('\n');
    },
  }],
});
const code = (await bundle.generate({ format: 'cjs' })).output[0].code;
await bundle.close();

const calls = [];
let reply = () => ({ status: 200, body: {} });
const toasts = [];
const context = {
  mocks, toasts, Blob, JSON, Promise, Error, Object, Math, String, Number, AbortSignal,
  location: { origin: 'https://example.test' },
  fetch: async (url, init = {}) => {
    calls.push({ url, method: init.method, body: init.body, type: init.headers?.['Content-Type'], signal: init.signal });
    const r = reply(url, init.method, calls.length);
    return { ok: r.status < 400, status: r.status, json: async () => r.body };
  },
};
context.globalThis = context;
const module = { exports: {} };
vm.runInNewContext(code, { ...context, module, exports: module.exports });
const { plainTags, publicNote, partsOf, fingerprint, changedSince, publish, takeDown, shareUrl } = module.exports;

const TOKEN = 'T'.repeat(32);
const entry = (extra = {}) => ({
  id: 'e1', kind: 'note', title: ' A walk ', icon: 't:sun', text: 'Walked with @[Ana]', emotions: ['joy'], intensity: 4, date: '2026-10-12', dateEnd: null, time: 1,
  images: [], photos: [], music: [{ id: 'm' }], people: ['p1'], cover: null, pinned: false, share: null, place: { lat: 1, lon: 2, name: 'Home' }, weather: { day: '2026-10-12', code: 1, temp: 20, daylight: 11 }, created: 1, updated: 1, ...extra,
});

test('tags in the text become the plain words they stand for, pictures stay', () => {
  assert.equal(plainTags('Hi @[person:p1|Ana] and @[Bo]'), 'Hi Ana and Bo');
  assert.equal(plainTags('a\n[[photo:p1 50 left|caption=Our %5B%5Btrip%5D%5D|alt=A boat]]\n[[album:photo:p1 photo:p2|caption=C]]'), 'a\n[[photo:p1 50 left|caption=Our %5B%5Btrip%5D%5D|alt=A boat]]\n[[album:photo:p1 photo:p2|caption=C]]', 'a picture\'s line, caption and all, stays');
  assert.equal(plainTags('Read [[book:b1|Dune]] and [[Dune]], see [[note:n1|My day]]'), 'Read Dune and Dune, see My day');
  assert.equal(plainTags('Played ♪[song:s1|Blue] and ♪[Red]'), 'Played ♪ Blue and ♪ Red');
  assert.equal(plainTags('[[photo:pabc123456 50 left]]\n[[image:https://x.example/a.jpg]]\n[[album:photo:pabc123456 image:https://x.example/b.jpg]]'), '[[photo:pabc123456 50 left]]\n[[image:https://x.example/a.jpg]]\n[[album:photo:pabc123456 image:https://x.example/b.jpg]]');
});

test('the public copy holds the words, pictures and day, and nothing about how you felt, who with, or where', () => {
  const pub = publicNote(entry({ photos: [{ id: 'pabc123456', w: 4, h: 3, extra: 1 }] }));
  assert.deepEqual(Object.keys(pub).sort(), ['cover', 'date', 'dateEnd', 'images', 'photos', 'text', 'title']);
  assert.equal(pub.title, 'A walk');
  assert.equal(pub.text, 'Walked with Ana');
  assert.equal(JSON.stringify(pub.photos), JSON.stringify([{ id: 'pabc123456', w: 4, h: 3 }]));
  assert.ok(!JSON.stringify(pub).includes('joy') && !JSON.stringify(pub).includes('Home') && !JSON.stringify(pub).includes('p1'));
});

test('details are shared only when chosen, and only in their narrow public shape', () => {
  const e = entry({ people: ['p1', 'p2', 'gone'], music: [{ kind: 'track', id: 'abcdefghij', title: 'Blue', link: 'https://open.spotify.com/track/abcdefghij' }] });
  assert.deepEqual(partsOf(e), ['feelings', 'people', 'place', 'weather', 'music']);
  assert.deepEqual(partsOf(entry({ emotions: [], people: [], place: { lat: 1, lon: 2, name: '' }, weather: { day: '2026-01-01', code: 1 }, music: [] })), []);
  assert.equal(publicNote(e).details, undefined); // nothing chosen
  const pub = publicNote(e, ['feelings', 'people', 'place', 'weather', 'music']);
  assert.equal(JSON.stringify(pub.details), JSON.stringify({
    feelings: { emotions: ['joy'], intensity: 4 },
    people: [{ name: 'Ana', icon: 't:heart' }],
    place: { name: 'Home' },
    weather: { code: 1, temp: 20, daylight: 11 },
    music: [{ kind: 'track', id: 'abcdefghij', title: 'Blue', link: 'https://open.spotify.com/track/abcdefghij' }],
  }));
  const json = JSON.stringify(publicNote(e, ['people', 'place']));
  assert.ok(!json.includes('p1') && !json.includes('Friend') && !json.includes('secret') && !json.includes('"lat"') && !json.includes('joy'));
  // a chosen detail the note no longer has is simply left out
  assert.equal(publicNote(entry({ place: null, emotions: [] }), ['place', 'feelings']).details, undefined);
});

test('a note knows when it has changed since it was made public', () => {
  const e = entry();
  const shared = { ...e, share: { token: TOKEN, hash: fingerprint(publicNote(e)) } };
  assert.equal(changedSince(shared), false);
  assert.equal(changedSince({ ...shared, emotions: ['sad'], place: null, people: [], pinned: true, updated: 99 }), false); // private details don't count
  assert.equal(changedSince({ ...shared, text: shared.text + '!' }), true);
  assert.equal(changedSince({ ...shared, title: 'Another' }), true);
  assert.equal(changedSince(entry()), false); // never shared
  assert.equal(shareUrl(TOKEN), `https://example.test/s/${TOKEN}`);
  const withFeelings = { ...e, share: { token: TOKEN, hash: fingerprint(publicNote(e, ['feelings'])), parts: ['feelings'] } };
  assert.equal(changedSince(withFeelings), false);
  assert.equal(changedSince({ ...withFeelings, emotions: ['sad'] }), true); // a shown detail counts
  assert.equal(changedSince({ ...withFeelings, place: null }), false); // a hidden one doesn't
});

test('publishing sends only the public copy, then the photos the server is missing', async () => {
  calls.length = 0;
  reply = (url, method) => (method === 'POST' ? { status: 200, body: { token: TOKEN, missing: ['pabc123456', 'pmissing01'] } } : { status: 204 });
  const e = entry({ photos: [{ id: 'pabc123456', w: 4, h: 3 }, { id: 'pmissing01', w: 1, h: 1 }] });
  const share = await publish(e);
  assert.equal(share.token, TOKEN);
  assert.equal(share.hash, fingerprint(publicNote(e)));
  assert.deepEqual(calls.map((c) => [c.method, c.url]), [['POST', '/api/share'], ['PUT', `/api/share/${TOKEN}/pabc123456`]]); // the photo this device doesn't have is skipped
  const sent = JSON.parse(calls[0].body);
  assert.deepEqual(Object.keys(sent).sort(), ['cover', 'date', 'dateEnd', 'images', 'photos', 'text', 'title']);
  assert.equal(calls[1].type, 'image/webp');
  assert.ok(calls[0].signal instanceof AbortSignal, 'the note itself has a deadline');
  assert.equal(calls[1].signal, undefined, 'a picture upload takes as long as it needs');
});

test('publishing with details sends them and remembers the choice', async () => {
  calls.length = 0;
  reply = () => ({ status: 200, body: { token: TOKEN, missing: [] } });
  const e = entry();
  const share = await publish(e, ['place']);
  assert.deepEqual([...share.parts], ['place']);
  assert.equal(share.hash, fingerprint(publicNote(e, ['place'])));
  assert.deepEqual(JSON.parse(calls[0].body).details, { place: { name: 'Home' } });
  // updating keeps the details it was published with
  calls.length = 0;
  await publish({ ...e, share });
  assert.deepEqual(JSON.parse(calls[0].body).details, { place: { name: 'Home' } });
});

test('updating a note that is already public keeps its link; a link the server forgot is replaced', async () => {
  calls.length = 0;
  reply = () => ({ status: 200, body: { token: TOKEN, missing: [] } });
  const e = entry({ share: { token: TOKEN, hash: 'old' } });
  assert.equal((await publish(e)).token, TOKEN);
  assert.deepEqual(calls.map((c) => [c.method, c.url]), [['PUT', `/api/share/${TOKEN}`]]);

  calls.length = 0;
  const NEW = 'N'.repeat(32);
  reply = (url, method) => (method === 'PUT' ? { status: 404, body: { error: 'That note isn’t shared.' } } : { status: 200, body: { token: NEW, missing: [] } });
  assert.equal((await publish(e)).token, NEW);
  assert.deepEqual(calls.map((c) => c.method), ['PUT', 'POST']);
});

test('a failed photo upload does not leave a half-public note behind', async () => {
  calls.length = 0;
  reply = (url, method) => (method === 'POST' ? { status: 200, body: { token: TOKEN, missing: ['pabc123456'] } } : method === 'PUT' ? { status: 500, body: {} } : { status: 204 });
  await assert.rejects(publish(entry({ photos: [{ id: 'pabc123456', w: 1, h: 1 }] })), /Something went wrong/);
  assert.deepEqual(calls.map((c) => c.method), ['POST', 'PUT', 'DELETE']);
});

test('the server saying no (not signed in, sharing off) is passed on as it is', async () => {
  reply = () => ({ status: 401, body: { error: 'Sign in with the admin password to share notes.' } });
  await assert.rejects(publish(entry()), /admin password/);
});

test('deleting a public note takes its public copy down, and says so if it can’t', async () => {
  calls.length = 0;
  reply = () => ({ status: 204 });
  takeDown(entry({ share: { token: TOKEN, hash: 'h' } }));
  takeDown(entry());
  takeDown(undefined);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls.map((c) => [c.method, c.url]), [['DELETE', `/api/share/${TOKEN}`]]);
  assert.deepEqual(toasts, []);
  reply = () => ({ status: 500, body: {} });
  takeDown(entry({ share: { token: TOKEN, hash: 'h' } }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(toasts.length, 1);
  assert.match(toasts[0], /public link is still up/);
});

test('comments are private: the public copy holds their words, never what they say, and editing one alone changes nothing public', async () => {
  const SECRET = '<!-- comment: my SECRET %2D- doubt %7C x -->';
  const e = entry({ text: `Walked with <span class="comment">@[Ana] by the sea</span>${SECRET}\n| <span class="comment">a</span>${SECRET} |\n| --- |\n\`<!-- comment: SECRET in code -->\`` });
  const pub = publicNote(e);
  assert.equal(pub.text, 'Walked with Ana by the sea\n| a |\n| --- |\n``');
  assert.ok(!/SECRET|comment:/.test(JSON.stringify(pub)));
  // what's sent to the server: the same
  calls.length = 0;
  reply = (url, method) => (method === 'POST' ? { status: 200, body: { token: TOKEN, missing: [] } } : { status: 204 });
  const share = await publish(e);
  assert.ok(!/SECRET|comment:/.test(calls.map((c) => String(c.body)).join('\n')), 'never in what goes over the wire');
  // a comment changed (or taken off) leaves the public copy as it was
  assert.equal(changedSince({ ...e, share, text: e.text.replaceAll('SECRET', 'other') }), false);
});
