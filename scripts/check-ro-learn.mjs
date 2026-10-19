// Checks a Romanian Learn file against the English data it mirrors, without building the app.
//   node scripts/check-ro-learn.mjs src/data/ro-learn/laws-1.ts
// The file's name says what it is: traps-1/traps-2 (+ reflect), laws-1…4 (laws 1–12, 13–24, 25–36, 37–48),
// principles-1…3 (principles 1–9, 10–19, 20–30 by part). It must export RO (and RO_REFLECT in traps-2).
import { rolldown } from 'rolldown';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const file = resolve(process.argv[2] ?? '');
const name = basename(file).replace(/\.ts$/, '');
const [kind, num] = name.split('-');
const root = resolve(import.meta.dirname, '..');
const english = {
  // the first 19 traps (belief, memory, social) are traps-1; the other 21 (and the three reflect questions) are traps-2
  traps: [`${root}/src/data/traps.ts`, (m) => Object.fromEntries(m.TRAPS.slice(...(num === '1' ? [0, 19] : [19])).map((x) => [x.id, x]))],
  laws: [`${root}/src/data/laws/part-${num}.ts`, (m) => Object.fromEntries(m.LAWS.map((x) => [x.n, x]))],
  principles: [`${root}/src/data/principles/part-${num}.ts`, (m) => Object.fromEntries(m.PRINCIPLES.map((x) => [x.n, x]))],
}[kind];
if (!english) throw new Error(`unknown file ${name}`);

async function load(path) {
  const bundle = await rolldown({ input: path, logLevel: 'silent' });
  const dir = mkdtempSync(join(tmpdir(), 'ro-learn-'));
  const out = join(dir, 'm.mjs');
  const { output } = await bundle.generate({ format: 'esm' });
  await bundle.close();
  writeFileSync(out, output[0].code);
  return import(pathToFileURL(out).href);
}

const problems = [];
const en = english[1](await load(english[0]));
const ro = (await load(file)).RO;
if (!ro) throw new Error('the file must export RO');

// every non-text leaf is skipped; every text leaf in the English must have a non-empty Romanian one in the same place
function walk(base, tr, path) {
  if (typeof base === 'string') {
    if (typeof tr !== 'string' || !tr.trim()) problems.push(`${path}: missing`);
    else if (tr === base && base.length > 24) problems.push(`${path}: identical to the English`);
    else if (/[şţŞŢ]/.test(tr)) problems.push(`${path}: use comma-below ș/ț, not cedilla ş/ţ`);
    else if (/\b(the|and|which|with|that)\b/.test(tr) && base.length > 60) problems.push(`${path}: looks like it still has English in it`);
    return;
  }
  if (Array.isArray(base)) {
    if (!Array.isArray(tr)) return void problems.push(`${path}: should be an array`);
    if (tr.length !== base.length) problems.push(`${path}: ${tr.length} items, the English has ${base.length}`);
    base.forEach((b, i) => tr[i] !== undefined && walk(b, tr[i], `${path}[${i}]`));
    return;
  }
  if (base && typeof base === 'object') {
    if (!tr || typeof tr !== 'object') return void problems.push(`${path}: should be an object`);
    for (const k of Object.keys(tr)) if (!(k in base)) problems.push(`${path}.${k}: not a field of the English (only translate text; leave ids and numbers out)`);
    for (const k of Object.keys(base)) {
      if (typeof base[k] === 'number' || typeof base[k] === 'boolean') continue;
      if (Array.isArray(base[k]) && base[k].every((x) => typeof x !== 'string' && typeof x !== 'object')) continue;
      if (['id', 'family', 'evidence', 'realm', 'part', 'kin', 'gut', 'answer'].includes(k)) continue;
      if (k === 'traps' || k === 'laws') {
        if (!Array.isArray(tr[k])) problems.push(`${path}.${k}: should be an array of { how }`);
        else tr[k].forEach((t, i) => (t?.id !== undefined || t?.n !== undefined) && problems.push(`${path}.${k}[${i}]: leave id/n out, only how`));
        if (Array.isArray(tr[k]) && tr[k].length !== base[k].length) problems.push(`${path}.${k}: ${tr[k].length} items, the English has ${base[k].length}`);
        base[k].forEach((b, i) => tr[k]?.[i] && walk({ how: b.how }, tr[k][i], `${path}.${k}[${i}]`));
        continue;
      }
      if (base[k] === undefined) continue;
      if (tr[k] === undefined) { if (k === 'aka' && base.aka == null) continue; problems.push(`${path}.${k}: missing`); continue; }
      walk(base[k], tr[k], `${path}.${k}`);
    }
  }
}

for (const [key, base] of Object.entries(en)) {
  if (!ro[key]) { problems.push(`${key}: missing entirely`); continue; }
  walk(base, ro[key], key);
}
for (const key of Object.keys(ro)) if (!(key in en)) problems.push(`${key}: not in this part of the English data`);

if (kind === 'traps' && num === '2') {
  const reflect = (await load(file)).RO_REFLECT;
  const base = (await load(english[0])).REFLECT;
  if (!reflect || reflect.length !== base.length) problems.push('RO_REFLECT: must have the same 3 questions');
  else base.forEach((b, i) => walk({ q: b.q, options: b.options, why: b.why }, reflect[i], `reflect[${i}]`));
}

if (problems.length) {
  console.log(problems.slice(0, 60).join('\n'));
  if (problems.length > 60) console.log(`… and ${problems.length - 60} more`);
  process.exit(1);
}
console.log(`${name}: ${Object.keys(en).length} entries, all translated`);
