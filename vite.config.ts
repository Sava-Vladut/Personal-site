import { defineConfig, type Plugin, type Rollup } from 'vite';
import preact from '@preact/preset-vite';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { CHANGELOG } from './src/data/changelog';

/** A file's name as the build's own files are named (`-` and 8 characters of its content hash). */
const fingerprint = (content: string | Buffer) => createHash('sha256').update(content).digest('base64url').slice(0, 8);
/** Built files whose names change with their content (as public/sw.js and server/static.js tell them apart). */
const FINGERPRINTED = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[^/]+$/;

// Writes every built file into dist/sw.js, so the service worker caches the whole app on install
// and one online visit is enough to work offline (Safari / iOS Home Screen included).
// It also finishes theme.js: the first screen's files go into it (firstScreens below), and it gets a hashed name like
// the app's own files. It runs before the first paint on every start, and with a hashed name the service worker can
// answer it from its cache at once instead of asking the network first.
function precache(): Plugin {
  let outDir = 'dist';
  let root = '.';
  let first: FirstScreens | Error | undefined;
  return {
    name: 'precache-sw',
    apply: 'build',
    configResolved(c) {
      root = c.root;
      outDir = resolve(c.root, c.build.outDir);
    },
    // The bundle as it was written: CSS-only chunks are gone and every chunk's stylesheets are known. (An error thrown
    // here doesn't stop the build, so it's kept and thrown below.)
    writeBundle(_options, bundle) {
      try { first = firstScreens(bundle, root, outDir); }
      catch (e) { first = e as Error; }
    },
    closeBundle() {
      if (!first) return; // the build stopped before writing anything, and says why itself
      if (first instanceof Error) throw first;
      const placeholders: [string, string][] = [
        ['var FILES = [];', `var FILES = ${JSON.stringify(first.files)};`],
        ['var SCREENS = {};', `var SCREENS = ${JSON.stringify(first.screens)};`],
        ['var ROMANIAN = [];', `var ROMANIAN = ${JSON.stringify(first.romanian)};`],
      ];
      let theme = readFileSync(join(outDir, 'theme.js'), 'utf8');
      for (const [from, to] of placeholders) {
        if (!theme.includes(from)) throw new Error(`public/theme.js no longer has \`${from}\``);
        theme = theme.replace(from, () => to);
      }
      const themeName = `assets/theme-${fingerprint(theme)}.js`;
      writeFileSync(join(outDir, themeName), theme);
      rmSync(join(outDir, 'theme.js'));
      const indexFile = join(outDir, 'index.html');
      const html = readFileSync(indexFile, 'utf8');
      const tag = '<script src="/theme.js"></script>';
      if (!html.includes(tag)) throw new Error(`index.html no longer loads theme.js with ${tag}`);
      writeFileSync(indexFile, html.replace(tag, `<script src="/${themeName}"></script>`));

      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
      const files = walk(outDir)
        .map((f) => '/' + relative(outDir, f).split(sep).join('/'))
        .filter((f) => f !== '/sw.js' && f !== '/index.html')
        .sort();
      const urls = ['/', ...files];
      const read = (u: string) => readFileSync(join(outDir, u === '/' ? 'index.html' : u.slice(1)));
      const hash = createHash('sha256');
      for (const u of urls) hash.update(read(u));
      // The files without a hashed name (icons, the manifest, the full icon set) carry their content's hash instead,
      // so an update can tell the unchanged ones apart and keep them, like it keeps unchanged hashed files.
      // The page itself is left out: it's always fetched fresh.
      const revisions = Object.fromEntries(
        files.filter((u) => !FINGERPRINTED.test(u)).map((u) => [u, createHash('sha256').update(read(u)).digest('hex').slice(0, 12)]),
      );
      const sw = join(outDir, 'sw.js');
      writeFileSync(
        sw,
        readFileSync(sw, 'utf8')
          .replace("const VERSION = 'dev';", `const VERSION = '${hash.digest('hex').slice(0, 12)}';`)
          .replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(urls)};`)
          .replace('const REVISIONS = {};', `const REVISIONS = ${JSON.stringify(revisions)};`),
      );
    },
  };
}

interface FirstScreens {
  /** Files under /assets/, each listed once. */
  files: string[];
  /** By screen (as lib/router.ts names them, plus main.tsx's public pages and the opening), the files it needs. */
  screens: Record<string, number[]>;
  /** The Romanian dictionary and the letters only Romanian uses (ă, ș, ț), for a device that reads Romanian. */
  romanian: number[];
}

/**
 * What each screen loads when it opens, beyond what index.html already has: its chunk, the chunks that one imports and
 * their stylesheets (the same list Vite's own preload helper fetches for that import()). theme.js starts these for
 * the screen being opened, alongside the app's own files, instead of after the app has started and asks for them.
 */
function firstScreens(bundle: Rollup.OutputBundle, root: string, outDir: string): FirstScreens {
  const chunks = Object.values(bundle).filter((f): f is Rollup.OutputChunk => f.type === 'chunk');
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const closure = (start: Rollup.OutputChunk) => {
    const seen = new Set<string>();
    const visit = (c: Rollup.OutputChunk | undefined) => {
      if (!c || seen.has(c.fileName)) return;
      seen.add(c.fileName);
      for (const i of c.imports) visit(byName.get(i));
    };
    visit(start);
    return [...seen];
  };
  const withCss = (names: string[]) => [...new Set(names.flatMap((n) => [n, ...(byName.get(n)?.viteMetadata?.importedCss ?? [])]))];
  // index.html's script (src/main.tsx) and everything it imports, already linked from there
  const entry = chunks.find((c) => c.isEntry && c.facadeModuleId?.endsWith('/index.html'));
  if (!entry) throw new Error('first screens: no entry chunk for index.html');
  const inIndex = new Set(withCss(closure(entry)));

  // the screens lib/views.ts loads by route name, and the ones main.tsx opens itself
  const views = readFileSync(join(root, 'src/lib/views.ts'), 'utf8');
  const modules: Record<string, string> = { '/s': 'src/views/Shared.tsx', '/status': 'src/views/Status.tsx', opening: 'src/lib/opening.ts' };
  for (const [, route, view] of views.matchAll(/(\w+): \(\) => import\('\.\.\/views\/(\w+)'\)/g)) modules[route] = `src/views/${view}.tsx`;
  if (!modules.journal) throw new Error('first screens: lib/views.ts has no journal screen');

  const files: string[] = [];
  // only what's on disk, should a chunk have been merged away after the bundle was read
  const written = (fileName: string) => existsSync(join(outDir, fileName));
  const index = (fileName: string) => {
    const name = fileName.replace(/^assets\//, '');
    const i = files.indexOf(name);
    return i >= 0 ? i : files.push(name) - 1;
  };
  const screens: Record<string, number[]> = {};
  for (const [screen, module] of Object.entries(modules)) {
    const chunk = chunks.find((c) => c.facadeModuleId?.endsWith('/' + module));
    if (chunk) screens[screen] = withCss(closure(chunk)).filter((f) => !inIndex.has(f) && written(f)).map(index);
  }
  const ro = chunks.find((c) => c.facadeModuleId?.endsWith('/src/data/ro.ts'));
  const letters = Object.keys(bundle).filter((f) => /(source-serif-4|instrument-sans)-latin-ext-wght-normal-[\w-]+\.woff2$/.test(f));
  const romanian = [...(ro ? withCss(closure(ro)).filter((f) => !inIndex.has(f)) : []), ...letters].filter(written).map(index);
  return { files, screens, romanian };
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
  // data/latest.ts: the newest release without shipping the whole changelog to every start
  define: { __LATEST_RELEASE__: JSON.stringify(CHANGELOG[0]) },
  build: { target: 'es2022', cssMinify: true },
});
