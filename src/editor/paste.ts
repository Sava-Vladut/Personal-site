// Pasting from other apps. Their HTML is tidied into what the note's schema reads (lib/noteDoc/schema.ts parse rules)
// before ProseMirror parses it: Word's list paragraphs and the web's nested lists become flat list items (a note's
// lists are one line each, their depth in the indent), tables stay tables (a grid of one-line cells, the first row its
// header), line breaks become new lines, and pictures are left out (pictures are added as files). Underline, superscript, subscript and colours come in as the schema reads
// them, colours as the palette's nearest (lib/palette.ts). Plain text is read as the note's own Markdown (lib/noteDoc/edit/clipboard.ts).
import { Fragment, Slice, type Node as PMNode } from '@tiptap/pm/model';
import { isCellsSlice, oneLine } from '../lib/noteDoc/edit';

/** A line break inside a paragraph, carried through the parse (the parser collapses \n to a space) to be split later. */
const BREAK = ' ';

const CHECKED = /☒|☑|✓|✔/;
const BOX = /^[\s ]*[☐☒☑]/;

function depthOf(el: Element): number {
  let d = 0;
  for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'UL' || p.tagName === 'OL') d++;
  return Math.max(0, d - 1);
}

/** A list item's paragraph: kind, depth and whether it's ticked. */
function itemPara(doc: Document, kind: string, depth: number, checked: boolean, from: Node[]): HTMLElement {
  const p = doc.createElement('p');
  p.setAttribute('data-li', kind);
  p.setAttribute('data-depth', String(Math.min(6, depth)));
  if (checked) p.setAttribute('data-checked', 'true');
  p.append(...from);
  return p;
}

/** Word's list paragraphs (`mso-list: l0 level2`) as list items; the bullet or number Word writes before each goes. */
function wordLists(doc: Document) {
  for (const p of doc.querySelectorAll<HTMLElement>('p[style*="mso-list"]')) {
    const style = p.getAttribute('style') ?? '';
    const level = Number(/level(\d+)/.exec(style)?.[1] ?? 1);
    let marker = '';
    for (const ignore of p.querySelectorAll('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]')) {
      marker += ignore.textContent ?? '';
      ignore.remove();
    }
    const kind = BOX.test(marker) ? 'task' : /\d|^[a-z]+[.)]/i.test(marker.trim()) ? 'ol' : 'ul';
    const item = itemPara(doc, kind, level - 1, CHECKED.test(marker), [...p.childNodes]);
    p.replaceWith(item);
  }
}

/** Nested ul/ol/li as flat list items, in order, each with its depth. Checkboxes make them tasks. */
function webLists(doc: Document) {
  // innermost first, so each item's own text is taken apart from the lists inside it
  const lists = [...doc.querySelectorAll('ul, ol')].reverse();
  for (const list of lists) {
    const out: Node[] = [];
    const ol = list.tagName === 'OL';
    for (const li of [...list.children]) {
      if (li.tagName !== 'LI') {
        out.push(li);
        continue;
      }
      const depth = depthOf(li);
      const box = li.querySelector('input[type=checkbox], [role=checkbox]');
      const task = !!box || li.hasAttribute('aria-checked') || /\b(checked|checkbox|task-list-item)\b/.test(li.className);
      const checked = (box instanceof HTMLInputElement && box.checked) || box?.getAttribute('aria-checked') === 'true'
        || li.getAttribute('aria-checked') === 'true' || /\b(checked|checkbox-on)\b/.test(li.className);
      box?.remove();
      const own: Node[] = [], after: Node[] = [];
      for (const n of [...li.childNodes]) {
        // the flattened items of a list inside, or a block of its own, come after the item's line
        if (n instanceof HTMLElement && (n.hasAttribute('data-li') || /^(P|DIV|H\d|BLOCKQUOTE|PRE)$/.test(n.tagName))) {
          if (n.hasAttribute('data-li') || own.length) after.push(n);
          else own.push(...n.childNodes);
        } else own.push(n);
      }
      out.push(itemPara(doc, task ? 'task' : ol ? 'ol' : 'ul', depth, checked, own), ...after);
    }
    list.replaceWith(...out);
  }
}

/** What can't be inside a table's cell, which is one line of words: its blocks' words run on, a space between. */
const BLOCKS = 'p, div, h1, h2, h3, h4, h5, h6, li, ul, ol, dl, dt, dd, blockquote, pre, table, caption, thead, tbody, tfoot, tr, td, th, section, article, header, footer, figure, figcaption, hr';

/** A cell's alignment: its own, or (Word, Google Docs) its first paragraph's. */
function cellAlign(cell: HTMLElement): string | null {
  const own = (el: Element | null) => {
    if (!(el instanceof HTMLElement)) return '';
    return (el.style.textAlign || el.getAttribute('align') || '').toLowerCase().replace('centre', 'center');
  };
  const a = own(cell) || own(cell.querySelector('p, div, h1, h2, h3, h4, h5, h6'));
  return a === 'left' || a === 'center' || a === 'right' ? a : null;
}

/** A cell's content as one line of words: line breaks and blocks become spaces, styles and links stay. */
function cellWords(cell: Element): Node[] {
  for (const br of cell.querySelectorAll('br')) br.replaceWith(' ');
  for (const b of [...cell.querySelectorAll(BLOCKS)].reverse()) b.replaceWith(' ', ...b.childNodes, ' ');
  return [...cell.childNodes];
}

/**
 * Tables as tables the note can write (a GFM pipe table): a grid of one-line cells, the first row its header; a cell
 * merged across columns or rows keeps its words in its first place, the others it covered left empty. A table of one
 * cell (a page laid out in a table) is just its content. A caption goes on a line before the table.
 */
function tables(doc: Document) {
  // copied from a note: its tables are such already (and ProseMirror reads the copy by its structure, data-pm-slice)
  if (doc.querySelector('[data-pm-slice]')) return;
  for (const table of doc.querySelectorAll('table')) {
    if (!table.isConnected) continue; // inside a cell of a table flattened already
    const rows = [...table.rows];
    if (rows.length === 1 && rows[0].cells.length === 1) {
      table.replaceWith(...rows[0].cells[0].childNodes);
      continue;
    }
    const grid: { words: Node[]; align: string | null; head: boolean }[][] = rows.map(() => []);
    rows.forEach((tr, r) => {
      let c = 0;
      for (const cell of [...tr.cells]) {
        while (grid[r][c]) c++;
        const across = Math.max(1, Math.min(64, Number(cell.getAttribute('colspan')) || 1));
        const down = Math.max(1, Math.min(rows.length - r, Number(cell.getAttribute('rowspan')) || 1));
        const align = cellAlign(cell);
        grid[r][c] = { words: cellWords(cell), align, head: cell.tagName === 'TH' };
        for (let y = 0; y < down; y++) for (let x = 0; x < across; x++) if (x || y) grid[r + y][c + x] = { words: [], align, head: false };
        c += across;
      }
    });
    const width = Math.max(0, ...grid.map((r) => r.length));
    const out = doc.createElement('table');
    grid.forEach((cells, r) => {
      if (!width) return;
      const tr = doc.createElement('tr');
      for (let k = 0; k < width; k++) {
        const cell = doc.createElement(r ? 'td' : 'th');
        const at = cells[k];
        if (at?.align) cell.style.textAlign = at.align;
        if (at) cell.append(...at.words);
        tr.append(cell);
      }
      out.append(tr);
    });
    const caption = table.querySelector(':scope > caption');
    const before: Node[] = [];
    if (caption?.textContent?.trim()) {
      const p = doc.createElement('p');
      p.append(...cellWords(caption));
      before.push(p);
    }
    if (width) table.replaceWith(...before, out);
    else table.replaceWith(...before);
  }
}

/** Tags that sit inside a line of words (a <br> in one can still be followed by words after it). */
const INLINE = /^(A|ABBR|B|BDI|BDO|CITE|CODE|DEL|DFN|EM|FONT|I|INS|KBD|LABEL|MARK|Q|S|SAMP|SMALL|SPAN|STRIKE|STRONG|SUB|SUP|TIME|TT|U|VAR)$/;
/** Blocks that are a line themselves: with only a <br> in them, they're an empty line already. */
const LINE = /^(P|H[1-6]|LI|DT|DD|PRE)$/;

/** What's next to `n` on one side in its line (out of the spans and the like it's in), blank text skipped. */
function beside(n: Node, after: boolean): Node | null {
  for (let at: Node = n; ; at = at.parentNode!) {
    let s = after ? at.nextSibling : at.previousSibling;
    while (s && s.nodeType === Node.TEXT_NODE && !/\S/.test(s.textContent ?? '')) s = after ? s.nextSibling : s.previousSibling;
    if (s) return s;
    if (!(at.parentNode instanceof Element) || !INLINE.test(at.parentNode.tagName)) return null;
  }
}

/** Whether a node is words (or a line break among them), not a block. */
const inLine = (n: Node | null) => !!n && (!(n instanceof Element) || INLINE.test(n.tagName) || n.tagName === 'BR');

/**
 * Line breaks as the page showed them. A <br> with words after it breaks the line. One that only ends a line of words
 * is how editors keep a line's end, and one on its own (between blocks, or alone in one: <div><br></div>) is an empty
 * line: neither is a second line break, else each empty line copied from Notes, Mail or Google Docs would come in
 * twice. The <br class="Apple-interchange-newline"> Safari and Chrome put where a copy starts or ends at a line's end
 * isn't a line at all.
 */
function lineBreaks(doc: Document) {
  for (const br of doc.querySelectorAll('br')) {
    if (br.classList.contains('Apple-interchange-newline')) br.remove();
    else if (inLine(beside(br, true))) br.replaceWith(BREAK);
    else if (inLine(beside(br, false)) || LINE.test(br.parentElement?.tagName ?? '')) br.remove();
    else br.replaceWith(doc.createElement('p'));
  }
}

/**
 * A link's own look isn't the words' style: pages and Google Docs colour and underline their links, which would come in
 * as a blue, underlined word on top of the link.
 */
function linkLooks(doc: Document) {
  for (const el of doc.querySelectorAll<HTMLElement>('a[href][style], a[href] [style]')) {
    el.style.removeProperty('color');
    el.style.removeProperty('text-decoration');
    el.style.removeProperty('text-decoration-line');
  }
  for (const u of doc.querySelectorAll('a[href] u')) u.replaceWith(...u.childNodes);
}

/** Other apps' HTML, tidied for the note's schema (ProseMirror's transformPastedHTML). */
export function tidyPastedHTML(html: string): string {
  const clean = html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<\/?o:p>/gi, '');
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  for (const el of doc.querySelectorAll('img, picture, video, audio, svg, style, script, meta, link, title')) el.remove();
  linkLooks(doc);
  wordLists(doc);
  webLists(doc);
  tables(doc);
  lineBreaks(doc);
  return doc.body.innerHTML;
}

/** Text with carried line breaks back to \n: the editor then splits those lines apart (lib/noteDoc/normalize.ts). */
function breaks(f: Fragment): Fragment {
  const out: PMNode[] = [];
  f.forEach((n) => {
    if (n.isText) out.push(n.text!.includes(BREAK) ? n.type.schema.text(n.text!.replaceAll(BREAK, '\n'), n.marks) : n);
    else out.push(n.copy(breaks(n.content)));
  });
  return Fragment.from(out);
}

/**
 * The pasted slice, ready to go in (ProseMirror's transformPasted): line breaks back, and pictures the note doesn't
 * hold (or already shows elsewhere) left out. Into a table's cell (`inCell`), what isn't cells of a table comes in as
 * one line of words (a cell is one line); cells go in cell by cell (prosemirror-tables).
 */
export function tidyPasted(slice: Slice, keepMedia: (node: PMNode) => boolean, inCell = false): Slice {
  if (inCell && slice.size && !isCellsSlice(slice)) {
    const first = slice.content.firstChild;
    return first ? oneLine(new Slice(breaks(slice.content), slice.openStart, slice.openEnd), first.type.schema) : slice;
  }
  const content = breaks(slice.content);
  const kept: PMNode[] = [];
  content.forEach((n) => (n.type.name !== 'media' || keepMedia(n)) && kept.push(n));
  if (kept.length === content.childCount) return new Slice(content, slice.openStart, slice.openEnd);
  if (!kept.length) return Slice.empty;
  // an end that went keeps no depth open
  const first = kept[0] === content.firstChild, last = kept[kept.length - 1] === content.lastChild;
  return new Slice(Fragment.from(kept), first ? slice.openStart : 0, last ? slice.openEnd : 0);
}
