import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// lib/playlistSync.ts run against an in-memory record collection and a fake Spotify playlist.
async function loadSync(state) {
  const mocks = {
    './spotify': {
      playlistInfo: async (id) => ({ id, name: 'Mine', snapshot: state.snapshot }),
      listPlaylistItems: async () => { state.reads++; return { items: state.items }; },
    },
    './store': {
      observable: (v) => ({ get: () => v, set: (n) => { v = n; }, use: () => v }),
      blankSong: (music, patch) => ({ id: 'x', music, repeat: false, rating: 0, text: '', emotions: [], from: null, days: [], added: null, lists: [], created: 0, updated: 0, ...patch }),
      getSongs: () => state.songs,
      getPeriods: () => state.periods,
      getDeleted: () => state.deleted,
      saveSongs: async (list) => { const byId = new Map(state.songs.map((s) => [s.id, s])); list.forEach((s) => byId.set(s.id, s)); state.songs = [...byId.values()]; },
      deleteSong: async (id) => { state.songs = state.songs.filter((s) => s.id !== id); },
    },
  };
  const bundle = await rolldown({
    input: 'src/lib/playlistSync.ts',
    external: ['preact/hooks'],
    plugins: [{
      name: 'mocks',
      resolveId(id) { if (id in mocks) return '\0' + id; },
      load(id) {
        if (!id.startsWith('\0')) return;
        const key = id.slice(1);
        return Object.keys(mocks[key]).map((name) => `export const ${name} = globalThis.mocks[${JSON.stringify(key)}][${JSON.stringify(name)}];`).join('\n');
      },
    }],
  });
  const { output } = await bundle.generate({ format: 'esm', codeSplitting: false });
  await bundle.close();
  const code = output[0].code
    .replace(/^import .* from "preact\/hooks";$/m, 'const useEffect = () => {};')
    .replace(/^export \{([^}]*)\};?\s*$/m, (_, list) => `return { ${list.split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => { const [local, name = local] = s.split(/\s+as\s+/); return `${name}: ${local}`; }).join(', ')} };`);
  const store = new Map();
  return vm.runInNewContext(`(() => {\n${code}\n})()`, {
    mocks, console, Date, JSON,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) },
  });
}

const track = (id, added, extra = {}) => ({ kind: 'track', id, title: 'Song ' + id, link: `https://open.spotify.com/track/${id}`, added, ...extra });
const song = (id, music, patch = {}) => ({ id, music, repeat: false, rating: 0, text: '', emotions: [], from: null, days: [], added: null, lists: [], created: 1, updated: 1, ...patch });
const LIST = 'playlist0000000001';

test('linking a playlist brings in its songs with the date added, and fills in records already kept', async () => {
  const kept = song('old', { kind: 'track', id: 'aaaaaaaaaaaaaaaaaaaaaa', title: 'A', link: 'x' });
  const state = { songs: [kept], periods: [], deleted: {}, snapshot: 's1', reads: 0, items: [
    track('aaaaaaaaaaaaaaaaaaaaaa', '2026-01-02T00:00:00Z', { album: 'First', ms: 180000 }),
    track('bbbbbbbbbbbbbbbbbbbbbb', '2026-03-04T00:00:00Z'),
  ] };
  const sync = await loadSync(state);
  await sync.linkPlaylist({ id: LIST, name: 'Mine' });
  assert.equal(state.songs.length, 2);
  const a = state.songs.find((s) => s.id === 'old');
  assert.equal(a.added, Date.parse('2026-01-02T00:00:00Z'));
  assert.equal(a.music.album, 'First');
  assert.deepEqual([...a.lists], [LIST]);
  const b = state.songs.find((s) => s.music.id === 'bbbbbbbbbbbbbbbbbbbbbb');
  assert.equal(b.id, 'sptbbbbbbbbbbbbbbbbbbbbbb', 'a synced song gets the same id on every device');
  assert.equal(b.created, Date.parse('2026-03-04T00:00:00Z'));
});

test('an unchanged snapshot reads nothing; a changed one adds and removes songs, keeping the ones that are yours', async () => {
  const on = [LIST];
  const state = { periods: [{ id: 'p', songs: ['inPeriod'] }], deleted: {}, snapshot: 's1', reads: 0, items: [], songs: [
    song('plain', { kind: 'track', id: 'cccccccccccccccccccccc', title: 'C', link: 'x' }, { lists: on }),
    song('rated', { kind: 'track', id: 'dddddddddddddddddddddd', title: 'D', link: 'x' }, { lists: on, rating: 4 }),
    song('inPeriod', { kind: 'track', id: 'eeeeeeeeeeeeeeeeeeeeee', title: 'E', link: 'x' }, { lists: on }),
    song('stays', { kind: 'track', id: 'ffffffffffffffffffffff', title: 'F', link: 'x' }, { lists: on }),
  ] };
  state.items = [track('ffffffffffffffffffffff', '2026-01-01T00:00:00Z')];
  const sync = await loadSync(state);
  await sync.syncPlaylists();
  assert.equal(state.reads, 1);
  assert.deepEqual(state.songs.map((s) => s.id).sort(), ['inPeriod', 'rated', 'stays'], 'only the untouched song left');
  assert.deepEqual([...state.songs.find((s) => s.id === 'rated').lists], [], 'a rated song stays, off the playlist');

  await sync.syncPlaylists();
  assert.equal(state.reads, 1, 'the same snapshot is not read again');

  state.snapshot = 's2';
  state.items = [...state.items, track('gggggggggggggggggggggg', '2026-05-05T00:00:00Z')];
  await sync.syncPlaylists();
  assert.equal(state.reads, 2);
  assert.ok(state.songs.some((s) => s.music.id === 'gggggggggggggggggggggg'), 'a song added in Spotify comes in');
});

test('an empty answer from Spotify removes nothing, and a song taken out here is not brought back', async () => {
  const state = { periods: [], snapshot: 's1', reads: 0, items: [], deleted: { sptgggggggggggggggggggggg: Date.parse('2026-06-01T00:00:00Z') }, songs: [
    song('plain', { kind: 'track', id: 'cccccccccccccccccccccc', title: 'C', link: 'x' }, { lists: [LIST] }),
  ] };
  const sync = await loadSync(state);
  await sync.syncPlaylists();
  assert.equal(state.songs.length, 1);
  state.snapshot = 's2';
  state.items = [track('cccccccccccccccccccccc', '2026-01-01T00:00:00Z'), track('gggggggggggggggggggggg', '2026-05-05T00:00:00Z')];
  await sync.syncPlaylists();
  assert.deepEqual(state.songs.map((s) => s.id), ['plain']);
});

test('unlinking keeps every song but takes the playlist off them', async () => {
  const state = { periods: [], deleted: {}, snapshot: 's1', reads: 0, items: [], songs: [
    song('plain', { kind: 'track', id: 'cccccccccccccccccccccc', title: 'C', link: 'x' }, { lists: [LIST] }),
  ] };
  const sync = await loadSync(state);
  await sync.unlinkPlaylist(LIST);
  assert.equal(state.songs.length, 1);
  assert.deepEqual([...state.songs[0].lists], []);
  assert.equal(sync.syncedPlaylists(state.songs).length, 0);
});
