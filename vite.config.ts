import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Writes every built file into dist/sw.js, so the service worker caches the whole app on install
// and one online visit is enough to work offline (Safari / iOS Home Screen included).
function precache(): Plugin {
  let outDir = 'dist';
  return {
    name: 'precache-sw',
    apply: 'build',
    configResolved: (c) => void (outDir = c.build.outDir),
    closeBundle() {
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
      const files = walk(outDir)
        .map((f) => '/' + relative(outDir, f).split(sep).join('/'))
        // voice typing's runtime is only fetched by people who turn it on (public/sw.js caches it then)
        .filter((f) => f !== '/sw.js' && f !== '/index.html' && !f.startsWith('/voice/'))
        .sort();
      const urls = ['/', ...files];
      const hash = createHash('sha256');
      for (const u of urls) hash.update(u === '/' ? readFileSync(join(outDir, 'index.html')) : readFileSync(join(outDir, u.slice(1))));
      const sw = join(outDir, 'sw.js');
      writeFileSync(
        sw,
        readFileSync(sw, 'utf8')
          .replace("const VERSION = 'dev';", `const VERSION = '${hash.digest('hex').slice(0, 12)}';`)
          .replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(urls)};`),
      );
    },
  };
}

export default defineConfig({
  plugins: [preact(), precache()],
  server: {
    // The Node server (npm start / scripts/dev.mjs) handles /api and fetches the speech model files
    proxy: Object.fromEntries(['/api', '/voice/models', '/voice/ort-'].map((p) => [p, `http://localhost:${process.env.PORT || 8085}`])),
  },
  // the speech worker imports a bundled runtime, which needs modules in workers
  worker: { format: 'es' },
  build: { target: 'es2022', cssMinify: true },
});
