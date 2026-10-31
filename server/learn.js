// A shared Learn page (/learn/<page>?lang=…, src/main.tsx): the app's shell, titled for the page in the language it was
// shared in, so a link pasted into a chat previews as "Mind traps", not as the private journal. Nothing here is private.
import { readFile, stat } from 'node:fs/promises';
import { HttpError } from './http-error.js';
import { escapeHtml } from './share.js';

const PAGES = {
  traps: { en: ['Mind traps', '40 ways your brain fools you, ranked by how hard they pull'], ro: ['Capcanele minții', '40 de feluri în care te păcălește creierul, în ordinea puterii lor'] },
  laws: { en: ['Laws of power', 'Robert Greene’s 48 laws: the history, the psychology and how to see them coming'], ro: ['Legile puterii', 'Cele 48 de legi ale lui Robert Greene: istoria, psihologia și cum le vezi venind'] },
  friends: { en: ['Win friends', 'Dale Carnegie’s 30 principles: why they work and how to practise them'], ro: ['Câștigă prieteni', 'Cele 30 de principii ale lui Dale Carnegie: de ce funcționează și cum le exersezi'] },
  seduction: { en: ['Art of seduction', 'Robert Greene’s nine seducers, eighteen victims and 24 moves: the psychology and how to see them coming'], ro: ['Arta seducției', 'Cei nouă seducători, cele optsprezece victime și cele 24 de mișcări ale lui Robert Greene: psihologia și cum le vezi venind'] },
};

export function createLearnHandler({ indexFile }) {
  let shell = null;
  return async function page(req, res, url) {
    const page = url.pathname.match(/^\/learn\/(traps|laws|friends|seduction)\/?$/);
    if (!page) throw new HttpError(404, 'Not found');
    const info = await stat(indexFile).catch(() => null);
    if (!info) throw new HttpError(503, 'App not built yet. Run "npm run build" (or use "npm run dev" while developing).');
    if (!shell || shell.mtime !== info.mtimeMs) shell = { mtime: info.mtimeMs, html: await readFile(indexFile, 'utf8') };
    const lang = url.searchParams.get('lang') === 'ro' ? 'ro' : 'en';
    const [title, blurb] = PAGES[page[1]][lang];
    const meta = [
      '<meta property="og:type" content="article" />',
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(blurb)}" />`,
    ].join('\n    ');
    const body = Buffer.from(shell.html
      .replace(/<html\b[^>]*>/, `<html lang="${lang}">`)
      .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>\n    ${meta}`)
      .replace(/(<meta name="description" content=")[^"]*(")/, (_, a, b) => a + escapeHtml(blurb) + b));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  };
}
