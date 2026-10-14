// Windows help files (.chm) for the Docs page: unpacked with 7-Zip into a folder of plain HTML, their table of
// contents read from the .hhc, and each topic's text pulled out so it can be searched like a PDF's pages.
import { readdir, readFile, rm, mkdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', mdash: '—', ndash: '–', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·', deg: '°', times: '×', laquo: '«', raquo: '»' };

export const decodeEntities = (s) =>
  s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      try { return String.fromCodePoint(n); } catch { return m; }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** Old help is mostly windows-1252; a page can say otherwise in its <meta>. */
export function decodeHtml(buf) {
  const head = buf.subarray(0, 2048).toString('latin1');
  const charset = /charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1]?.toLowerCase() || 'windows-1252';
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

/** A page's title and its readable text, one line. */
export function htmlText(html) {
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|head|object)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return { title, text: decodeEntities(body).replace(/\s+/g, ' ').trim() };
}

/** The .hhc's contents: [title, depth, file or ''] in order; headings without a file of their own have ''. */
export function parseToc(hhc) {
  const out = [];
  let depth = -1;
  for (const m of hhc.matchAll(/<(\/?)ul\b[^>]*>|<object\b[^>]*type\s*=\s*"text\/sitemap"[^>]*>([\s\S]*?)<\/object>/gi)) {
    if (m[2] === undefined) {
      depth += m[1] ? -1 : 1;
      continue;
    }
    const param = (name) => decodeEntities(new RegExp(`<param\\s+name\\s*=\\s*"${name}"\\s+value\\s*=\\s*"([^"]*)"`, 'i').exec(m[2])?.[1] ?? '').trim();
    if (param('Merge')) continue; // another .chm's contents, merged in by Windows
    const name = param('Name');
    let local = param('Local').replace(/\\/g, '/');
    if (local.includes('::/')) local = local.slice(local.indexOf('::/') + 3);
    local = local.replace(/[#?].*$/, '').replace(/^\.?\//, '');
    try { local = decodeURIComponent(local); } catch {}
    if (name || local) out.push([name || local, Math.max(0, depth), local]);
  }
  return out;
}

async function walk(dir, root = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('#') || e.name.startsWith('$')) continue; // the archive's own bookkeeping
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, root)));
    else out.push(relative(root, full).split(sep).join('/'));
  }
  return out;
}

/**
 * Unpacks a help file into `outDir` and reads it: `pages` and `files` are its topics in contents order (then any
 * page the contents leave out), `topics` their titles, `toc` the contents with each entry's topic (1-based, 0 for headings).
 */
export async function extractHelp(file, outDir, run) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await run('7z', ['x', '-y', '-bd', '-bso0', '-bsp0', `-o${outDir}`, file]);
  const all = await walk(outDir);
  const byLower = new Map(all.map((f) => [f.toLowerCase(), f]));
  const html = all.filter((f) => /\.html?$/i.test(f));
  const hhc = all.find((f) => /\.hhc$/i.test(f) && !f.includes('/'));
  const contents = hhc ? parseToc(decodeHtml(await readFile(join(outDir, hhc)))) : [];

  const files = [], topics = [], pages = [], toc = [];
  const seen = new Map(); // lowercased path → topic number
  const add = async (path, name) => {
    const { title, text } = htmlText(decodeHtml(await readFile(join(outDir, path))));
    files.push(path);
    topics.push(name || title || path.replace(/\.html?$/i, ''));
    pages.push(text);
    seen.set(path.toLowerCase(), files.length);
    return files.length;
  };
  for (const [name, depth, local] of contents) {
    const path = local && byLower.get(local.toLowerCase());
    const topic = !path ? 0 : seen.get(path.toLowerCase()) ?? (await add(path, name));
    toc.push([name, depth, topic]);
  }
  for (const path of html.sort((a, b) => a.localeCompare(b))) {
    if (!seen.has(path.toLowerCase())) toc.push([topics[(await add(path, '')) - 1], 0, files.length]);
  }
  return { pages, files, topics, toc };
}
