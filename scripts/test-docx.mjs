import assert from 'node:assert/strict';
import test from 'node:test';
import { inflateRawSync } from 'node:zlib';
import { JSDOM } from 'jsdom';
import { loadNoteDoc, root } from './notedoc-bundle.mjs';

// Download as Word (src/lib/docx): the .docx a note makes, read back here without Word. The ZIP is taken apart by
// hand (each file's CRC checked, deflated ones inflated with zlib), every XML part parsed for well-formedness, and
// the WordprocessingML checked for what each construct of a note should give. Node only, no browser.
const nd = await loadNoteDoc({
  entries: [
    `export { buildDocx, docxName, xmlText } from '${root}src/lib/docx/document.ts';`,
    `export { zip, crc32 } from '${root}src/lib/docx/zip.ts';`,
    `export { RO } from '${root}src/data/ro.ts';`,
  ],
  stubs: { '/src/lib/i18n.ts': "export const t = (s) => s; export const lang = 'en';" },
});
const { DOMParser } = new JSDOM('').window;

/* ---------- a ZIP, read back ---------- */

// CRC-32 written again here (not the one under test)
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** The files of a ZIP by name, in order, read from its central directory; checks each file's local header and CRC. */
function unzip(bytes) {
  const buf = Buffer.from(bytes);
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, 'end of central directory');
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  assert.equal(at + buf.readUInt32LE(end + 12), end, 'the central directory runs up to its end record');
  const files = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(at), 0x02014b50, 'central directory entry');
    const method = buf.readUInt16LE(at + 10);
    const sum = buf.readUInt32LE(at + 16);
    const packed = buf.readUInt32LE(at + 20);
    const size = buf.readUInt32LE(at + 24);
    const nameLen = buf.readUInt16LE(at + 28);
    const extra = buf.readUInt16LE(at + 30), note = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nameLen).toString('utf8');
    at += 46 + nameLen + extra + note;

    assert.equal(buf.readUInt32LE(local), 0x04034b50, `${name}: local header`);
    assert.equal(buf.readUInt16LE(local + 8), method, `${name}: same method in both headers`);
    assert.equal(buf.readUInt32LE(local + 14), sum, `${name}: same CRC in both headers`);
    assert.equal(buf.subarray(local + 30, local + 30 + nameLen).toString('utf8'), name);
    const start = local + 30 + nameLen + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + packed);
    assert.ok(method === 0 || method === 8, `${name}: stored or deflated`);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    assert.equal(data.length, size, `${name}: size`);
    assert.equal(crc(data), sum, `${name}: CRC`);
    files.set(name, { data, method });
  }
  return files;
}

/** An XML part parsed; fails on anything that isn't well-formed (or uses a prefix it doesn't declare). */
function xml(files, name) {
  const f = files.get(name);
  assert.ok(f, `${name} is in the file`);
  const text = f.data.toString('utf8');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  assert.equal(doc.getElementsByTagName('parsererror').length, 0, `${name} is well-formed`);
  return { doc, text };
}
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const all = (doc, local, ns = W) => [...doc.getElementsByTagNameNS(ns, local)];
const attr = (el, name) => el.getAttributeNS(W, name);

/* ---------- a note with everything a note can hold ---------- */

const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const TEXT = [
  '# Heading one <!-- align:center -->',
  '## Two',
  '### Three',
  '#### Four',
  '##### Five',
  '###### Six',
  'Plain **bold** *italic* <u>under</u> ~~strike~~ x<sup>2</sup> H<sub>2</sub>O `code` & <less> "quotes"',
  '<span style="color:red">red</span> ==yellow== <mark style="background:lightgreen">green</mark> [a link](https://example.com/?a=1&b=2) https://bare.example.org',
  'Right side <!-- align:right -->',
  'Justified words <!-- align:justify -->',
  '- a bullet',
  '  - a level in',
  '1. one',
  '2. two',
  '  1. letter',
  '    1. roman',
  '- [ ] to do',
  '- [x] done',
  '',
  '5. starts at five',
  '6. six',
  '> a quote',
  '',
  '> [!warning] Mind this',
  '> inside the callout',
  '',
  '> [!tip]',
  '```js',
  'const a = 1;',
  '\tindented <tag>',
  '```',
  '---',
  '<div style="page-break-after: always"></div>',
  'A footnote here[^1] and again[^1], another[^n].',
  '| Name | Count | Note |',
  '| :--- | :---: | ---: |',
  '| **Ann** | 3 | [x](https://x.y) |',
  '| Bob | 4 | |',
  '[[photo:pabcdef1 50 left|caption=Our trip|alt=A boat at dusk]]',
  '[[image:https://img.example/x.jpg|caption=Gone]]',
  '[[album:photo:pabcdef1 photo:pabcdef2]]',
  'With @[person:p1|Ann], ♪[song:s1|Our Song] and [[note:n1|Other note]].',
  'I said <span class="comment">yes</span><!-- comment: did I mean it? --> and <span class="comment">left</span><!-- comment: a & b %3C c --> then.',
  '[^1]: The first <u>footnote</u> with [a link](https://fn.example).',
  '[^n]: The second.',
  '[^z]: Nobody refers to this one.',
].join('\n');

const pictures = new Map([
  ['photo:pabcdef1', { data: PNG, type: 'png', width: 400, height: 200 }],
  ['photo:pabcdef2', { data: PNG, type: 'png', width: 100, height: 100 }],
  ['image:https://img.example/x.jpg', null],
]);
const NOTE = { title: 'A day <out> & about', date: 'Tuesday 27 October 2026', text: TEXT, created: Date.UTC(2026, 9, 1, 8), updated: Date.UTC(2026, 9, 27, 20), pictures };

const make = async (extra = {}) => unzip(await nd.buildDocx({ ...NOTE, ...extra }));

test('the ZIP holds the parts Word needs, each CRC right, deflated where it helps and pictures stored', async () => {
  const files = await make();
  const names = [...files.keys()];
  assert.equal(names[0], '[Content_Types].xml', 'content types first');
  for (const n of ['_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', 'word/document.xml', 'word/_rels/document.xml.rels',
    'word/styles.xml', 'word/numbering.xml', 'word/footnotes.xml', 'word/settings.xml', 'word/media/image1.png', 'word/media/image2.png']) {
    assert.ok(files.has(n), n);
  }
  assert.ok(!files.has('word/comments.xml'), 'no comments by default');
  assert.equal(files.get('word/document.xml').method, 8, 'XML deflated (CompressionStream deflate-raw)');
  assert.equal(files.get('word/media/image1.png').method, 0, 'pictures stored');
  for (const n of names.filter((n) => /\.(xml|rels)$/.test(n))) xml(files, n);

  const stored = unzip(await nd.buildDocx({ ...NOTE, compress: false }));
  assert.ok([...stored.values()].every((f) => f.method === 0), 'compress: false stores everything');
  assert.deepEqual([...stored.keys()], names);
});

test('zip and crc32 agree with zlib', async () => {
  const enc = new TextEncoder();
  assert.equal(nd.crc32(enc.encode('123456789')), 0xcbf43926);
  const files = unzip(await nd.zip([{ name: 'a.txt', data: enc.encode('hello '.repeat(100)) }, { name: 'b.bin', data: new Uint8Array([1, 2, 3]), deflate: false }]));
  assert.equal(files.get('a.txt').data.toString(), 'hello '.repeat(100));
  assert.equal(files.get('a.txt').method, 8);
  assert.deepEqual([...files.get('b.bin').data], [1, 2, 3]);
});

test('content types, relationships and properties', async () => {
  const files = await make();
  const types = xml(files, '[Content_Types].xml').text;
  for (const part of ['/word/document.xml', '/word/styles.xml', '/word/numbering.xml', '/word/footnotes.xml', '/word/settings.xml', '/docProps/core.xml', '/docProps/app.xml']) {
    assert.ok(types.includes(`PartName="${part}"`), part);
  }
  assert.ok(types.includes('Extension="png"') && types.includes('Extension="rels"'));
  assert.ok(xml(files, '_rels/.rels').text.includes('Target="word/document.xml"'));

  const rels = xml(files, 'word/_rels/document.xml.rels').doc;
  const list = [...rels.getElementsByTagName('Relationship')];
  const ids = list.map((r) => r.getAttribute('Id'));
  assert.equal(new Set(ids).size, ids.length, 'relationship ids unique');
  const links = list.filter((r) => r.getAttribute('Type').endsWith('/hyperlink'));
  assert.deepEqual(links.map((r) => r.getAttribute('Target')), ['https://example.com/?a=1&b=2', 'https://bare.example.org', 'https://x.y']);
  assert.ok(links.every((r) => r.getAttribute('TargetMode') === 'External'));
  assert.equal(list.filter((r) => r.getAttribute('Type').endsWith('/image')).length, 2, 'each picture once, though one is in the album too');
  // a link in a footnote goes in the footnotes' own relationships
  const fnRels = xml(files, 'word/_rels/footnotes.xml.rels').doc;
  assert.equal(fnRels.getElementsByTagName('Relationship')[0].getAttribute('Target'), 'https://fn.example');

  const core = xml(files, 'docProps/core.xml').doc;
  assert.equal(core.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title')[0].textContent, 'A day <out> & about');
  assert.equal(core.getElementsByTagNameNS('http://purl.org/dc/terms/', 'created')[0].textContent, '2026-10-01T08:00:00Z');
  assert.equal(core.getElementsByTagNameNS('http://purl.org/dc/terms/', 'modified')[0].textContent, '2026-10-27T20:00:00Z');
});

test('styles: Title, Heading 1–6, Normal, Quote, Code and the rest', async () => {
  const files = await make();
  const { doc } = xml(files, 'word/styles.xml');
  const ids = all(doc, 'style').map((s) => attr(s, 'styleId'));
  for (const id of ['Normal', 'Title', 'Subtitle', 'Heading1', 'Heading2', 'Heading3', 'Heading4', 'Heading5', 'Heading6', 'Quote', 'Code', 'CodeChar',
    'Caption', 'Hyperlink', 'FootnoteText', 'FootnoteReference', 'ListParagraph', 'TableGrid', 'CommentText', 'CommentReference']) {
    assert.ok(ids.includes(id), id);
  }
  assert.equal(new Set(ids).size, ids.length, 'style ids unique');
  const code = all(doc, 'style').find((s) => attr(s, 'styleId') === 'Code');
  assert.equal(attr(code.getElementsByTagNameNS(W, 'rFonts')[0], 'ascii'), 'Consolas');
});

/** The document's paragraphs, each with its style and text. */
function paragraphs(doc) {
  return all(doc, 'p').map((p) => {
    const style = p.getElementsByTagNameNS(W, 'pStyle')[0];
    return { p, style: style ? attr(style, 'val') : null, text: all(p, 't').map((t) => t.textContent).join('') };
  });
}
const find = (ps, text) => {
  const p = ps.find((x) => x.text === text) ?? ps.find((x) => x.text.includes(text));
  assert.ok(p, `a paragraph with "${text}"`);
  return p;
};
/** The run properties of the run holding `text`, as a set of their element names (with a value: name=value). */
function runProps(p, text) {
  const r = all(p.p, 'r').find((r) => [...r.getElementsByTagNameNS(W, 't')].some((t) => t.textContent === text));
  assert.ok(r, `a run "${text}"`);
  const pr = r.getElementsByTagNameNS(W, 'rPr')[0];
  return new Set(pr ? [...pr.children].map((c) => c.localName + (attr(c, 'fill') ? '=' + attr(c, 'fill') : attr(c, 'val') ? '=' + attr(c, 'val') : '')) : []);
}
/** Child element names of each pPr / rPr, to check they come in the order Word's schema says. */
const P_ORDER = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'numPr', 'pBdr', 'shd', 'tabs', 'spacing', 'ind', 'contextualSpacing', 'jc', 'outlineLvl', 'rPr'];
const R_ORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'strike', 'dstrike', 'vanish', 'color', 'spacing', 'sz', 'szCs', 'highlight', 'u', 'shd', 'vertAlign', 'lang'];
function inOrder(doc, local, order) {
  for (const el of all(doc, local)) {
    const names = [...el.children].map((c) => c.localName);
    const at = names.map((n) => order.indexOf(n));
    assert.ok(at.every((i) => i >= 0), `${local}: known children ${names}`);
    assert.deepEqual(at, [...at].sort((a, b) => a - b), `${local} in schema order: ${names}`);
  }
}

test('the document: every construct of a note, as Word has it', async () => {
  const files = await make();
  const { doc, text } = xml(files, 'word/document.xml');
  inOrder(doc, 'pPr', P_ORDER);
  inOrder(doc, 'rPr', R_ORDER);
  const ps = paragraphs(doc);

  // the title and date
  assert.deepEqual([ps[0].style, ps[0].text], ['Title', 'A day <out> & about']);
  assert.deepEqual([ps[1].style, ps[1].text], ['Subtitle', 'Tuesday 27 October 2026']);
  // headings, aligned as written
  for (const [n, words] of [[1, 'Heading one'], [2, 'Two'], [3, 'Three'], [4, 'Four'], [5, 'Five'], [6, 'Six']]) assert.equal(find(ps, words).style, `Heading${n}`);
  assert.equal(attr(find(ps, 'Heading one').p.getElementsByTagNameNS(W, 'jc')[0], 'val'), 'center');
  assert.equal(attr(find(ps, 'Right side').p.getElementsByTagNameNS(W, 'jc')[0], 'val'), 'right');
  assert.equal(attr(find(ps, 'Justified').p.getElementsByTagNameNS(W, 'jc')[0], 'val'), 'both');
  assert.ok(!text.includes('align:'), 'the alignment comments are gone');

  // marks
  const plain = find(ps, 'Plain');
  assert.ok(runProps(plain, 'bold').has('b'));
  assert.ok(runProps(plain, 'italic').has('i'));
  assert.ok(runProps(plain, 'under').has('u=single'));
  assert.ok(runProps(plain, 'strike').has('strike'));
  assert.ok(runProps(plain, '2').has('vertAlign=superscript'));
  assert.ok(all(plain.p, 'vertAlign').some((v) => attr(v, 'val') === 'subscript'));
  assert.ok(runProps(plain, 'code').has('rStyle=CodeChar'));
  assert.ok(plain.text.includes(' & <less> "quotes"'), 'escaped and back');
  const colours = find(ps, 'red');
  assert.ok(runProps(colours, 'red').has('color=C0392B'));
  assert.ok(runProps(colours, 'yellow').has('highlight=yellow'));
  assert.ok(runProps(colours, 'green').has('shd=C8F0C8'));
  const links = all(colours.p, 'hyperlink');
  assert.equal(links.length, 2);
  assert.ok(links.every((h) => h.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')));
  assert.ok(runProps(colours, 'a link').has('rStyle=Hyperlink'));

  // lists: bullets one numbering, numbers another, by level; each numbered list its own, from its first number
  const num = (words) => {
    const p = find(ps, words).p;
    const pr = p.getElementsByTagNameNS(W, 'numPr')[0];
    return pr && [Number(attr(pr.getElementsByTagNameNS(W, 'ilvl')[0], 'val')), Number(attr(pr.getElementsByTagNameNS(W, 'numId')[0], 'val'))];
  };
  assert.deepEqual(num('a bullet'), [0, 1]);
  assert.deepEqual(num('a level in'), [1, 1]);
  const [, list] = num('one');
  assert.ok(list > 1);
  assert.deepEqual(num('two'), [0, list]);
  assert.deepEqual(num('letter'), [1, list]);
  assert.deepEqual(num('roman'), [2, list]);
  const [, five] = num('starts at five');
  assert.ok(five !== list, 'a new list after a blank line');
  assert.equal(find(ps, 'to do').text, '☐to do');
  assert.equal(find(ps, 'done').text, '☑done');
  assert.equal(num('to do'), undefined, 'a task has its box, not a bullet');

  const numbering = xml(files, 'word/numbering.xml').doc;
  const formats = (id) => {
    const abs = all(numbering, 'abstractNum').find((a) => attr(a, 'abstractNumId') === id);
    return all(abs, 'lvl').slice(0, 4).map((l) => attr(l.getElementsByTagNameNS(W, 'numFmt')[0], 'val'));
  };
  assert.deepEqual(formats('0'), ['bullet', 'bullet', 'bullet', 'bullet']);
  assert.deepEqual(formats('1'), ['decimal', 'lowerLetter', 'lowerRoman', 'decimal']);
  const fiveNum = all(numbering, 'num').find((n) => attr(n, 'numId') === String(five));
  assert.equal(attr(fiveNum.getElementsByTagNameNS(W, 'startOverride')[0], 'val'), '5');
  const firstNum = all(numbering, 'num').find((n) => attr(n, 'numId') === String(list));
  assert.equal(firstNum.getElementsByTagNameNS(W, 'startOverride').length, 0, 'a list from 1 needs no override');
  const kinds = [...numbering.documentElement.children].map((c) => c.localName);
  assert.ok(kinds.lastIndexOf('abstractNum') < kinds.indexOf('num'), 'every abstractNum before the nums');

  // quote and callout
  assert.equal(find(ps, 'a quote').style, 'Quote');
  const title = find(ps, 'Mind this');
  assert.ok(runProps(title, 'Mind this').has('b'), 'a callout’s title bold');
  assert.ok(title.p.getElementsByTagNameNS(W, 'shd').length && title.p.getElementsByTagNameNS(W, 'pBdr').length, 'shaded and ruled');
  assert.ok(find(ps, 'inside the callout').p.getElementsByTagNameNS(W, 'shd').length, 'the callout’s lines shaded too');
  assert.ok(runProps(find(ps, 'Tip'), 'Tip').has('b'), 'an untitled callout titled by its kind');

  // code: a line each, tabs as tabs
  assert.equal(find(ps, 'const a = 1;').style, 'Code');
  const indented = find(ps, 'indented <tag>');
  assert.equal(indented.style, 'Code');
  assert.equal(indented.p.getElementsByTagNameNS(W, 'tab').length, 1);
  assert.ok(!text.includes('```'));

  // divider and page break
  assert.ok(all(doc, 'bottom').some((b) => b.parentNode.localName === 'pBdr'), 'a divider: a paragraph ruled underneath');
  assert.equal(all(doc, 'br').filter((b) => attr(b, 'type') === 'page').length, 1);

  // footnotes: real ones, numbered by first reference; a second reference its number; one nobody refers to stays
  const refs = all(doc, 'footnoteReference').map((r) => attr(r, 'id'));
  assert.deepEqual(refs, ['1', '2']);
  const again = find(ps, 'A footnote here');
  assert.ok(runProps(again, '1').has('vertAlign=superscript'), 'the second [^1] as a superscript 1');
  const notes = xml(files, 'word/footnotes.xml').doc;
  const fn = all(notes, 'footnote');
  assert.deepEqual(fn.map((f) => attr(f, 'id')), ['-1', '0', '1', '2']);
  assert.match(fn[2].textContent, /The first footnote with a link\./);
  assert.equal(all(fn[2], 'hyperlink').length, 1);
  assert.match(fn[3].textContent, /The second\./);
  assert.ok(!ps.some((p) => p.text.includes('The first footnote')), 'a footnote’s text isn’t in the body');
  assert.equal(find(ps, 'Nobody refers').text, '[z] Nobody refers to this one.');
  const settings = xml(files, 'word/settings.xml').text;
  assert.ok(settings.includes('<w:footnote w:id="-1"/>') && settings.includes('<w:footnote w:id="0"/>'));

  // table: header row repeated, ruled, columns aligned, header bold
  const tbl = all(doc, 'tbl');
  assert.equal(tbl.length, 1);
  const rows = all(tbl[0], 'tr');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].getElementsByTagNameNS(W, 'tblHeader').length, 1);
  assert.equal(rows[1].getElementsByTagNameNS(W, 'tblHeader').length, 0);
  assert.equal(all(tbl[0], 'tblBorders').length, 1);
  assert.equal(all(tbl[0], 'gridCol').length, 3);
  const aligns = all(rows[1], 'tc').map((c) => attr(c.getElementsByTagNameNS(W, 'jc')[0], 'val'));
  assert.deepEqual(aligns, ['left', 'center', 'right']);
  assert.ok(all(rows[0], 'b').length >= 3, 'the header bold');
  for (const tc of all(tbl[0], 'tc')) assert.ok(tc.getElementsByTagNameNS(W, 'p').length >= 1, 'every cell holds a paragraph');
  assert.equal(all(rows[1], 'hyperlink').length, 1, 'a link in a cell');

  // pictures: inline drawings, sized from the width kept, alt text, caption under; one that couldn't be read leaves its words
  const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
  const drawings = all(doc, 'inline', WP);
  assert.equal(drawings.length, 3, 'one picture, then the row’s two (the web image couldn’t be read)');
  const ext = (d) => d.getElementsByTagNameNS(WP, 'extent')[0];
  const half = 5731510 / 2;
  assert.ok(Math.abs(Number(ext(drawings[0]).getAttribute('cx')) - half) <= 1, '50% of the text’s width');
  assert.equal(Number(ext(drawings[0]).getAttribute('cy')), Math.round(Number(ext(drawings[0]).getAttribute('cx')) / 2), 'its shape kept');
  const docPr = all(doc, 'docPr', WP);
  assert.equal(docPr[0].getAttribute('descr'), 'A boat at dusk');
  const prIds = docPr.map((d) => d.getAttribute('id'));
  assert.equal(new Set(prIds).size, prIds.length, 'drawing ids unique');
  const picP = drawings[0].parentNode.parentNode.parentNode;
  assert.equal(attr(picP.getElementsByTagNameNS(W, 'jc')[0], 'val'), 'left');
  const caption = find(ps, 'Our trip');
  assert.equal(caption.style, 'Caption');
  assert.equal(find(ps, 'Gone').style, 'Caption');
  assert.ok(ps.some((p) => p.text === '[Picture]') === false, 'a caption is enough: no placeholder');
  assert.equal(drawings[1].parentNode.parentNode.parentNode, drawings[2].parentNode.parentNode.parentNode, 'a row in one paragraph');
  assert.equal(ext(drawings[1]).getAttribute('cy'), ext(drawings[2]).getAttribute('cy'), 'a row’s pictures the same height');
  const across = Number(ext(drawings[1]).getAttribute('cx')) + Number(ext(drawings[2]).getAttribute('cx'));
  assert.ok(across <= 5731510 && across > 5731510 * 0.95, 'side by side, the width across');

  // chips as their names
  assert.equal(find(ps, 'With ').text, 'With Ann, Our Song and Other note.');

  // comments left out: the words stay, nothing of what they say
  assert.equal(find(ps, 'I said').text, 'I said yes and left then.');
  assert.ok(!text.includes('did I mean it') && !text.includes('comment'), 'no comment in the document');
});

test('a picture that can’t be read: its alt text, or that a picture was there', async () => {
  const files = await make({ text: '[[photo:pmissing1|alt=Two cats]]\n[[photo:pmissing2]]', pictures: new Map() });
  const ps = paragraphs(xml(files, 'word/document.xml').doc);
  assert.ok(ps.some((p) => p.text === '[Two cats]'));
  assert.ok(ps.some((p) => p.text === '[Picture]'));
  assert.ok(![...files.keys()].some((n) => n.startsWith('word/media/')));
});

test('comments go in as Word’s comments only when asked for', async () => {
  const files = await make({ comments: true, author: 'Vlad' });
  const { doc, text } = xml(files, 'word/document.xml');
  const comments = xml(files, 'word/comments.xml').doc;
  const list = all(comments, 'comment');
  assert.deepEqual(list.map((c) => attr(c, 'id')), ['0', '1']);
  assert.deepEqual(list.map((c) => c.textContent), ['did I mean it?', 'a & b < c']);
  assert.equal(attr(list[0], 'author'), 'Vlad');
  assert.deepEqual(all(doc, 'commentRangeStart').map((c) => attr(c, 'id')), ['0', '1']);
  assert.deepEqual(all(doc, 'commentRangeEnd').map((c) => attr(c, 'id')), ['0', '1']);
  assert.deepEqual(all(doc, 'commentReference').map((c) => attr(c, 'id')), ['0', '1']);
  // the range holds exactly its words
  const start = all(doc, 'commentRangeStart')[0];
  assert.equal(start.nextSibling.textContent, 'yes');
  assert.equal(start.nextSibling.nextSibling.localName, 'commentRangeEnd');
  assert.ok(text.indexOf('did I mean it') < 0, 'what a comment says is in comments.xml only');
  assert.ok(xml(files, '[Content_Types].xml').text.includes('/word/comments.xml'));
  assert.ok(xml(files, 'word/_rels/document.xml.rels').text.includes('Target="comments.xml"'));
});

test('a comment over two lines is one Word comment, across the paragraphs', async () => {
  const files = await make({ text: 'a <span class="comment">b</span><!-- comment: one -->\n<span class="comment">c</span><!-- comment: one --> d', comments: true });
  const { doc } = xml(files, 'word/document.xml');
  assert.equal(all(xml(files, 'word/comments.xml').doc, 'comment').length, 1);
  const ps = paragraphs(doc);
  assert.equal(find(ps, 'a b').p.getElementsByTagNameNS(W, 'commentRangeStart').length, 1);
  assert.equal(find(ps, 'c d').p.getElementsByTagNameNS(W, 'commentRangeEnd').length, 1);
});

test('a note of nothing, or of odd characters, still makes a valid file', async () => {
  for (const text of ['', '\n\n', 'bad \u0001\u0008 control ￾ chars and a lone \uD800 surrogate, an emoji 😀 kept', '| a |\n| --- |\n| b |']) {
    const files = await make({ text, title: '', date: '' });
    const { doc } = xml(files, 'word/document.xml');
    const body = doc.getElementsByTagNameNS(W, 'body')[0];
    const last = [...body.children];
    assert.equal(last[last.length - 1].localName, 'sectPr');
    assert.equal(last[last.length - 2].localName, 'p', 'a paragraph last before the section');
  }
  const { text } = xml(await make({ text: 'an emoji 😀 \u0001' }), 'word/document.xml');
  assert.ok(text.includes('😀') && !text.includes('\u0001'));
});

test('the file name comes from the title, without what file systems refuse', () => {
  assert.equal(nd.docxName('Trip: Cluj / Iași?', '2026-10-27'), 'Trip Cluj Iași.docx');
  assert.equal(nd.docxName('  ', '2026-10-27'), '2026-10-27.docx');
  assert.equal(nd.docxName('...', '2026-10-27'), '2026-10-27.docx');
  assert.equal(nd.docxName('x'.repeat(200), 'd').length, 85);
});

test('the export’s words are in Romanian', () => {
  for (const en of ['Download as Word (.docx)', 'Word', 'Include comments', 'Me', 'Picture', 'Couldn’t make the Word file']) {
    assert.ok(nd.RO[en], `Romanian for "${en}"`);
  }
});
