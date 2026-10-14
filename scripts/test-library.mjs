import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { HttpError } from '../server/http-error.js';
import { decodeHtml, htmlText, parseToc } from '../server/help.js';
import { createLibraryHandler, snippet, terms } from '../server/library.js';

test('search words fold accents and case, and keep quoted phrases', () => {
  assert.deepEqual(terms('Frecvență  "Unde   RADIO" frecventa'), ['frecventa', 'unde radio']);
  assert.deepEqual(terms('   '), []);
});

test('snippets mark matches in the original text, accents and all', () => {
  const runs = snippet('Noțiuni despre unde radio și propagare', ['notiuni', 'si']);
  assert.deepEqual(runs.filter(([, hit]) => hit).map(([s]) => s), ['Noțiuni', 'și']);
  assert.equal(runs.map(([s]) => s).join(''), 'Noțiuni despre unde radio și propagare');
});

test('reads a help file’s contents: headings, nested topics, encoded names, merged files left out', () => {
  const hhc = `<ul>
    <li><object type="text/sitemap"><param name="Name" value="Help &amp; Support"></object>
    <ul>
      <li><object type="text/sitemap"><param name="Name" value="Welcome"><param name="Local" value="cpa%20welcome.htm#top"></object>
      <li><object type="text/sitemap"><param name="Name" value="Keys"><param name="Local" value="other.chm::/Keys/Load.htm"></object>
    </ul>
  </ul>
  <object type="text/sitemap"><param name="Name" value="x.chm::/x.hhc"><param name="Merge" value="x.chm::/x.hhc"></object>`;
  assert.deepEqual(parseToc(hhc), [['Help & Support', 0, ''], ['Welcome', 1, 'cpa welcome.htm'], ['Keys', 1, 'Keys/Load.htm']]);
});

test('reads a help topic’s title and text in its own encoding, without scripts or styles', () => {
  const page = Buffer.concat([
    Buffer.from('<html><head><meta http-equiv="Content-Type" content="text/html; charset=windows-1252"><title>Radio&#39;s keys</title><style>p{}</style></head><body><script>x()</script><h1>Load</h1><p>The radio'),
    Buffer.from([0x92]),
    Buffer.from('s key &amp; fill</p><!-- hidden --></body></html>'),
  ]);
  assert.deepEqual(htmlText(decodeHtml(page)), { title: 'Radio\'s keys', text: 'Load The radio’s key & fill' });
});

let tools = true;
try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); } catch { tools = false; }

/** A tiny PDF with one line of text per page. */
function pdf(pages) {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
  const kids = [];
  for (const line of pages) {
    const stream = `BT /F1 18 Tf 72 720 Td (${line}) Tj ET`;
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 FONT 0 R >> >> /Contents ${objs.length} 0 R >>`);
    kids.push(`${objs.length} 0 R`);
  }
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o.replace('FONT', String(objs.length))}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  return out + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

test('lists, searches and draws the PDFs, for the admin only', { skip: !tools && 'poppler-utils is not installed' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'mm-library-'));
  after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'docs', 'Course'), { recursive: true });
  await writeFile(join(root, 'docs', 'Course', 'Radio guide.pdf'), pdf(['Antenna setup', 'Set the frequency', 'Frequency hopping and antenna']));
  await writeFile(join(root, 'docs', 'notes.md'), 'not a PDF');

  let admin = true;
  const handler = createLibraryHandler({ directory: join(root, 'docs'), cacheDir: join(root, 'cache'), isAdmin: () => admin });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      await handler(req, res, url.pathname, url);
    } catch (e) {
      res.writeHead(e instanceof HttpError ? e.status : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
  await new Promise((r) => server.listen(0, r));
  after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/library`;

  const list = await (await fetch(base)).json();
  assert.equal(list.docs.length, 1);
  const doc = list.docs[0];
  assert.deepEqual([doc.title, doc.folder, doc.pages, doc.ratio], ['Radio guide', 'Course', 3, 792 / 612]);

  const found = await (await fetch(`${base}/search?q=FREQUENCY`)).json();
  assert.equal(found.pages, 2);
  assert.deepEqual(found.results[0].pages.map((p) => p.page), [2, 3]);
  assert.deepEqual(found.results[0].pages[1].snippet, [['Frequency', true], [' hopping and antenna', false]]);
  const both = await (await fetch(`${base}/search?q=antenna+frequency&doc=${doc.id}`)).json();
  assert.deepEqual(both.results[0].pages.map((p) => p.page), [3]);

  const page = await (await fetch(`${base}/${doc.id}/page/3?q=antenna`)).json();
  assert.equal(page.boxes.length, 1);
  assert.ok(page.boxes[0].every((v) => v >= 0 && v <= 1));
  const image = await fetch(`${base}/${doc.id}/page/1/image`);
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  assert.ok((await image.arrayBuffer()).byteLength > 500);
  const part = await fetch(`${base}/${doc.id}/file`, { headers: { Range: 'bytes=0-7' } });
  assert.equal(part.status, 206);
  assert.equal(await part.text(), '%PDF-1.4');

  assert.equal((await fetch(`${base}/${doc.id}/page/9`)).status, 404);
  assert.equal((await fetch(`${base}/nope/file`)).status, 404);
  admin = false;
  assert.equal((await fetch(base)).status, 403);
  assert.equal((await fetch(`${base}/${doc.id}/file`)).status, 403);
});
