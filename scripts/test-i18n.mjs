import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

async function load(file, globals = {}) {
  const bundle = await rolldown({ input: file });
  const code = (await bundle.generate({ format: 'cjs' })).output[0].code;
  await bundle.close();
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Intl, ...globals });
  return module.exports;
}

async function sources(dir) {
  const out = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, d.name);
    if (d.isDirectory()) out.push(...(await sources(path)));
    else if (/\.tsx?$/.test(d.name)) out.push(path);
  }
  return out;
}

// A JS string literal's value: the sources only use simple escapes.
const unquote = (q, body) => (q === '"' ? JSON.parse(`"${body}"`) : body.replace(/\\n/g, '\n').replace(/\\(.)/g, '$1'));
const STRING = String.raw`(['"])((?:\\.|(?!\1).)*)\1`;
const placeholders = (s) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

const { RO, RO_PLURAL } = await load('src/data/ro.ts');
const files = await sources('src');
const texts = new Map(); // English text → where it's used
const words = new Map();
for (const file of files) {
  if (file.endsWith('data/ro.ts')) continue;
  const code = await readFile(file, 'utf8');
  for (const m of code.matchAll(new RegExp(String.raw`\b(?:t|rich)\(\s*` + STRING, 'g'))) texts.set(unquote(m[1], m[2]), file);
  for (const m of code.matchAll(new RegExp(String.raw`\b(?:count|noun)\([^,()]+(?:\([^()]*\))?[^,()]*,\s*` + STRING, 'g'))) words.set(unquote(m[1], m[2]), file);
}

test('every text shown through t() or rich() has a Romanian translation', () => {
  assert.ok(texts.size > 500, `found only ${texts.size} texts — is the scan still matching?`);
  const missing = [...texts].filter(([en]) => !(en in RO)).map(([en, file]) => `${file}: ${en}`);
  assert.deepEqual(missing, []);
});

test('Romanian texts only use placeholders their English text fills in', () => {
  // these two are given extra values on purpose: Romanian words them differently
  const extra = { 'turning {n}': ['years'], '{name}’s {date}': ['Date'] };
  const wrong = Object.entries(RO)
    .filter(([en, ro]) => [...placeholders(ro)].some((p) => !placeholders(en).has(p) && !extra[en]?.includes(p)))
    .map(([en, ro]) => `${en} → ${ro}`);
  assert.deepEqual(wrong, []);
});

test('every counted word has Romanian singular and plural forms', () => {
  assert.ok(words.size > 10);
  const missing = [...words].filter(([en]) => !(en in RO_PLURAL)).map(([en, file]) => `${file}: ${en}`);
  assert.deepEqual(missing, []);
});

const storage = (value) => ({ localStorage: { getItem: () => value, setItem() {} } });

test('Romanian counts follow its plural rules, English stays as it was', async () => {
  const ro = await load('src/lib/i18n.ts', storage('ro'));
  assert.equal(ro.lang, 'ro');
  assert.equal(ro.count(1, 'entry', 'entries'), '1 intrare');
  assert.equal(ro.count(5, 'entry', 'entries'), '5 intrări');
  assert.equal(ro.count(0, 'entry', 'entries'), '0 intrări');
  assert.equal(ro.count(20, 'entry', 'entries'), '20 de intrări');
  assert.equal(ro.count(101, 'entry', 'entries'), '101 intrări');
  assert.equal(ro.t('Week of {date}', { date: '5 oct.' }), 'Săptămâna din 5 oct.');
  assert.equal(ro.t('A text nobody translated'), 'A text nobody translated');
  assert.deepEqual([...ro.rich('Add this {uri} to the app:', { uri: 1 })], ['Adaugă acest ', 1, ' în aplicație:']);
  assert.equal(ro.listOf(['a', 'b', 'c']), 'a, b și c');

  const en = await load('src/lib/i18n.ts', storage(null));
  assert.equal(en.lang, 'en');
  assert.equal(en.count(1, 'entry', 'entries'), '1 entry');
  assert.equal(en.count(20, 'entry', 'entries'), '20 entries');
  assert.equal(en.t('Week of {date}', { date: '5 Oct' }), 'Week of 5 Oct');
  assert.equal(en.listOf(['a', 'b', 'c']), 'a, b and c');
});
