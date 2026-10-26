import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Writes every built file into dist/sw.js, so the service worker caches the whole app on install
// and one online visit is enough to work offline (Safari / iOS Home Screen included).
function precache(): Plugin {
  let outDir = 'dist';
  let romanian = '';
  return {
    name: 'precache-sw',
    apply: 'build',
    configResolved: (c) => void (outDir = c.build.outDir),
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) if (file.type === 'chunk' && file.facadeModuleId?.endsWith('/src/data/ro.ts')) romanian = file.fileName;
    },
    closeBundle() {
      // The Romanian dictionary only loads where it's read (lib/i18n.ts). theme.js runs first on every page, so it starts
      // that download on a Romanian device while the app's own files are still coming in, instead of after them.
      if (romanian) {
        const theme = join(outDir, 'theme.js');
        writeFileSync(theme, readFileSync(theme, 'utf8') +
          `\ntry {\n  if (localStorage.getItem('mm-lang') === 'ro') {\n    var ro = document.createElement('link');\n    ro.rel = 'modulepreload'; ro.href = '/${romanian}';\n    document.head.appendChild(ro);\n  }\n} catch (e) {}\n`);
      }
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
      const files = walk(outDir)
        .map((f) => '/' + relative(outDir, f).split(sep).join('/'))
        .filter((f) => f !== '/sw.js' && f !== '/index.html')
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

// The Latin files of the two typefaces nearly all text is set in, fetched alongside the stylesheet instead of after
// it: otherwise the first paint is in the fallback fonts and the text visibly reflows when these swap in.
function preloadFonts(): Plugin {
  return {
    name: 'preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (_html, { bundle }) =>
        Object.keys(bundle ?? {})
          .filter((f) => /(source-serif-4|instrument-sans)-latin-wght-normal-[\w-]+\.woff2$/.test(f))
          .map((f) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: '/' + f, crossorigin: true }, injectTo: 'head' as const })),
    },
  };
}

export default defineConfig({
  plugins: [preact(), precache(), preloadFonts()],
  server: {
    // The Node server (npm start / scripts/dev.mjs) handles /api
    proxy: { '/api': `http://localhost:${process.env.PORT || 8085}` },
  },
  build: { target: 'es2022', cssMinify: true },
});
