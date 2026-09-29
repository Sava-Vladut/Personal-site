import { readdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, gzip, constants } from 'node:zlib';

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);
const types = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt']);
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : join(dir, entry.name)))).flat();
}
const files = (await walk('dist')).filter((file) => types.has(extname(file)));
let count = 0;
// Two workers bound build memory/CPU. Run AFTER precache generation so sidecars
// neither change service-worker versions nor become redundant offline downloads.
await Promise.all(Array.from({ length: 2 }, async () => {
  while (files.length) {
    const file = files.pop();
    const raw = await readFile(file);
    if (raw.length <= 1024) continue;
    for (const [suffix, data] of [
      ['br', await brotli(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 10 } })],
      ['gz', await gz(raw, { level: 9 })],
    ]) {
      const temp = `${file}.${suffix}.tmp`;
      try { await writeFile(temp, data); await rename(temp, `${file}.${suffix}`); }
      finally { await rm(temp, { force: true }); }
    }
    count++;
  }
}));
console.log(`Precompressed ${count} assets (Brotli + gzip).`);
