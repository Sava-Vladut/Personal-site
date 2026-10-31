// A note as a Word file (.docx), made here in the browser: its text read into the editor's document
// (lib/noteDoc parseNote) and written as WordprocessingML, zipped (./zip.ts). Nothing leaves the device.
//
//   the title and date   → Title, and Subtitle under it
//   # … ###### headings  → Heading 1–6 (alignment as w:jc, as a paragraph's)
//   lists                → Word's numbering: bullets • ◦ ▪, numbers 1. a. i. by level as the app shows them (each list
//                          numbered from its first item's number); a task is ☐ or ☑ before its words
//   quotes, callouts     → Quote (a rule at the left); a callout shaded in its colour, its title bold
//   code blocks          → Code (a monospace font on grey), `code` → Code Char
//   dividers             → a paragraph ruled underneath; page breaks → w:br w:type="page"
//   footnotes            → Word's own footnotes (footnotes.xml), numbered as the app numbers them
//   tables               → w:tbl, ruled, the header row repeated on each page, each column aligned as written
//   pictures, albums     → embedded (word/media), as wide as on the page, alt text as their description, the caption
//                          under them; a picture that can't be read leaves its words (alt text, caption) instead
//   person, song, wiki   → their name, as plain words
//   bold, italic, underline, strike, super/subscript, colours, highlights, links → their Word run properties
//   comments             → only when asked for: Word's comments (comments.xml) on their words. Otherwise left out,
//                          as everywhere a note leaves the app (they're private); the words stay.
import type { Mark, Node as PMNode } from '@tiptap/pm/model';
import { itemKey, itemsOf, type Media } from '../body';
import { t } from '../i18n';
import { parseNote } from '../noteDoc/parse';
import { SAFE, calloutDefaultTitle, calloutTone, depthOf } from '../noteDoc/syntax';
import { commentsOf } from '../noteDoc/edit/comments';
import { zip, type ZipFile } from './zip';

/** A picture ready to go in: its bytes in a format Word reads, and its size in pixels. */
export interface DocxPicture {
  data: Uint8Array;
  type: 'png' | 'jpeg' | 'gif';
  width: number;
  height: number;
}

export interface DocxNote {
  title: string;
  /** the date line under the title, as the app shows it */
  date: string;
  /** the note's text (lib/body.ts: pictures as their lines) */
  text: string;
  /** ms */
  created: number;
  updated: number;
  /** the language the document is marked as written in */
  lang?: 'en' | 'ro';
  /** the comments as Word's comments (by default left out) */
  comments?: boolean;
  /** whose the comments are */
  author?: string;
  /** each picture by lib/body.ts itemKey; missing or null: it couldn't be read */
  pictures?: Map<string, DocxPicture | null>;
  /** false: every file stored, not deflated (tests) */
  compress?: boolean;
}

/* ---------- XML ---------- */

/** Text as XML holds it: escaped, and without the characters XML 1.0 can't hold (controls, lone surrogates). */
export const xmlText = (s: string) =>
  s
    .replace(/[\0-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, '')
    .replace(/[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g, (c) => (c.length === 2 ? c : ''))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS = `xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}"`;

/* ---------- the page ---------- */

// A4, 2.54 cm margins (twentieths of a point); pictures in EMUs (635 to a twentieth of a point)
const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1440;
const TEXT_W = PAGE_W - 2 * MARGIN;
const EMU = 635;
const MAX_PIC_H = Math.round((PAGE_H - 2 * MARGIN) * EMU * 0.8);

/* ---------- colours (lib/palette.ts) as Word's ---------- */

const TEXT_HEX: Record<string, string> = { red: 'C0392B', orange: 'D35400', green: '2E7D32', blue: '1F5FAD', purple: '7B3FA0', gray: '7F7F7F' };
const HIGHLIGHT_HEX: Record<string, string> = {
  lightgreen: 'C8F0C8', lightblue: 'CFE4F7', pink: 'FAD3DE', plum: 'E8D0EC', lightsalmon: 'FCD9C4', lightgray: 'E0E0E0',
};
/** A callout's tone (lib/noteDoc/syntax.ts calloutTone): its rule at the left and its shading. */
const TONE: Record<string, [string, string]> = {
  info: ['4A86C5', 'EAF2FB'], tip: ['8E6BBF', 'F1EAFB'], good: ['3D9A50', 'E8F5E9'], warn: ['E69A28', 'FFF4E0'], bad: ['D9534F', 'FDECEC'],
};

/* ---------- paragraph and run properties, in the order Word's schema asks for ---------- */

interface ParaProps {
  style?: string;
  keepNext?: boolean;
  num?: { id: number; level: number };
  border?: string;
  shade?: string;
  spacing?: string;
  ind?: { left: number; hanging?: number; right?: number };
  jc?: string;
}
function pPr(p: ParaProps): string {
  const out = [
    p.style && `<w:pStyle w:val="${p.style}"/>`,
    p.keepNext && '<w:keepNext/>',
    p.num && `<w:numPr><w:ilvl w:val="${p.num.level}"/><w:numId w:val="${p.num.id}"/></w:numPr>`,
    p.border && `<w:pBdr>${p.border}</w:pBdr>`,
    p.shade && `<w:shd w:val="clear" w:color="auto" w:fill="${p.shade}"/>`,
    p.spacing,
    p.ind && `<w:ind w:left="${p.ind.left}"${p.ind.right ? ` w:right="${p.ind.right}"` : ''}${p.ind.hanging ? ` w:hanging="${p.ind.hanging}"` : ''}/>`,
    p.jc && `<w:jc w:val="${p.jc}"/>`,
  ].filter(Boolean).join('');
  return out ? `<w:pPr>${out}</w:pPr>` : '';
}

interface RunProps {
  style?: string;
  font?: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  color?: string;
  highlight?: string;
  underline?: boolean;
  shade?: string;
  vert?: 'superscript' | 'subscript';
}
function rPr(r: RunProps): string {
  const out = [
    r.style && `<w:rStyle w:val="${r.style}"/>`,
    r.font && `<w:rFonts w:ascii="${r.font}" w:hAnsi="${r.font}" w:cs="${r.font}"/>`,
    r.bold && '<w:b/><w:bCs/>',
    r.italic && '<w:i/><w:iCs/>',
    r.strike && '<w:strike/>',
    r.color && `<w:color w:val="${r.color}"/>`,
    r.highlight && `<w:highlight w:val="${r.highlight}"/>`,
    r.underline && '<w:u w:val="single"/>',
    r.shade && `<w:shd w:val="clear" w:color="auto" w:fill="${r.shade}"/>`,
    r.vert && `<w:vertAlign w:val="${r.vert}"/>`,
  ].filter(Boolean).join('');
  return out ? `<w:rPr>${out}</w:rPr>` : '';
}

/** A run of text: tabs as Word's tabs, line breaks as its breaks, spaces kept. */
function run(text: string, props: RunProps = {}): string {
  if (!text) return '';
  const body = text.split(/(\t|\r?\n)/).map((s) => (s === '\t' ? '<w:tab/>' : s === '\n' || s === '\r\n' ? '<w:br/>' : s ? `<w:t xml:space="preserve">${xmlText(s)}</w:t>` : '')).join('');
  return `<w:r>${rPr(props)}${body}</w:r>`;
}

const para = (props: ParaProps, content: string) => `<w:p>${pPr(props)}${content}</w:p>`;

const JC: Record<string, string> = { center: 'center', right: 'right', justify: 'both', left: 'left' };

/* ---------- the parts: their relationships ---------- */

class Rels {
  list: string[] = [];
  add(type: string, target: string, external = false): string {
    const id = `rId${this.list.length + 1}`;
    this.list.push(`<Relationship Id="${id}" Type="${REL}/${type}" Target="${xmlText(target)}"${external ? ' TargetMode="External"' : ''}/>`);
    return id;
  }
  xml = () => `${HEAD}<Relationships xmlns="${PKG_REL}">${this.list.join('')}</Relationships>`;
}

/** An address a link can go to in Word: spaces and the characters a URI can't hold, %-encoded. */
const uri = (href: string) => href.replace(/[\s"<>\\^`{|}]/g, (c) => encodeURIComponent(c));

/* ---------- the writer ---------- */

interface Block {
  /** how many quotes it's in */
  quote: number;
  /** the callout it's in: its tone */
  tone: string | null;
}
interface Inline {
  rels: Rels;
  /** the footnotes' part: references there are plain numbers, comments aren't marked */
  inNote?: boolean;
  bold?: boolean;
}

class Writer {
  readonly body: string[] = [];
  readonly rels = new Rels();
  readonly noteRels = new Rels();
  readonly commentRels = new Rels();
  readonly media: ZipFile[] = [];
  readonly footnotes: string[] = [];
  readonly comments: string[] = [];
  /** numbering instances past the bullets' (1): each numbered list's, with the number it starts at by level */
  readonly lists: Map<number, number>[] = [];
  private pictureRel = new Map<string, string>();
  private drawings = 0;
  /** footnote texts by label (the first of each), the Word footnote of each label referred to, and its number */
  private notes = new Map<string, PMNode>();
  private noteIds = new Map<string, number>();
  /** comments by where their words start, and which end where */
  private commentAt = new Map<number, { id: number }>();
  private commentEnd = new Map<number, number[]>();
  /** the numbered list going on (its instance), and whether a list item came just before */
  private list: { id: number; starts: Map<number, number> } | null = null;

  constructor(private doc: PMNode, private note: DocxNote) {
    doc.descendants((n) => {
      if (n.type.name === 'footnote' && !this.notes.has(n.attrs.label)) this.notes.set(n.attrs.label, n);
      return !n.isTextblock;
    });
    if (note.comments) this.collectComments();
  }

  /** The note's comments as Word's, each on its words (over several lines, one comment); none in footnotes. */
  private collectComments() {
    const inNotes: [number, number][] = [];
    this.doc.descendants((n, pos) => {
      if (n.type.name === 'footnote') inNotes.push([pos, pos + n.nodeSize]);
      return !n.isTextblock;
    });
    for (const c of commentsOf(this.doc)) {
      if (c.ranges.some((r) => inNotes.some(([a, b]) => r.from >= a && r.to <= b))) continue;
      const id = this.comments.length;
      const author = xmlText(this.note.author || t('Me'));
      const initials = xmlText([...(this.note.author || t('Me'))].slice(0, 2).join(''));
      this.comments.push(
        `<w:comment w:id="${id}" w:author="${author}" w:initials="${initials}">`
        + para({ style: 'CommentText' }, `<w:r>${rPr({ style: 'CommentReference' })}<w:annotationRef/></w:r>${run(c.text)}`)
        + '</w:comment>',
      );
      this.commentAt.set(c.from, { id });
      this.commentEnd.set(c.to, [...(this.commentEnd.get(c.to) ?? []), id]);
    }
  }

  /* ---------- inline ---------- */

  /** A textblock's words as runs, its content starting at `start` (a document position). */
  inline(node: PMNode, start: number, ctx: Inline): string {
    const out: string[] = [];
    let link: Mark | null = null;
    const closeLink = () => {
      if (link) out.push('</w:hyperlink>');
      link = null;
    };
    let pos = start;
    node.forEach((child) => {
      const from = pos;
      pos += child.nodeSize;
      if (!ctx.inNote) {
        const c = this.commentAt.get(from);
        if (c) (closeLink(), out.push(`<w:commentRangeStart w:id="${c.id}"/>`));
      }
      const l = child.marks.find((m) => m.type.name === 'link' && SAFE.test(m.attrs.href)) ?? null;
      if (!(l && link && l.eq(link))) {
        closeLink();
        if (l) {
          link = l;
          out.push(`<w:hyperlink r:id="${ctx.rels.add('hyperlink', uri(l.attrs.href), true)}" w:history="1">`);
        }
      }
      out.push(this.leaf(child, ctx, !!link));
      if (!ctx.inNote) {
        for (const id of this.commentEnd.get(pos) ?? []) {
          closeLink();
          out.push(`<w:commentRangeEnd w:id="${id}"/><w:r>${rPr({ style: 'CommentReference' })}<w:commentReference w:id="${id}"/></w:r>`);
        }
      }
    });
    closeLink();
    return out.join('');
  }

  /** A run's properties from its marks. */
  private props(marks: readonly Mark[], ctx: Inline, linked: boolean): RunProps {
    const p: RunProps = {};
    if (ctx.bold) p.bold = true;
    if (linked) p.style = 'Hyperlink';
    for (const m of marks) {
      switch (m.type.name) {
        case 'bold': p.bold = true; break;
        case 'italic': p.italic = true; break;
        case 'underline': p.underline = true; break;
        case 'strike': p.strike = true; break;
        case 'sup': p.vert = 'superscript'; break;
        case 'sub': p.vert = 'subscript'; break;
        case 'code': p.style = 'CodeChar'; break;
        case 'color': p.color = TEXT_HEX[m.attrs.color] ?? undefined; break;
        case 'highlight':
          if (m.attrs.color && HIGHLIGHT_HEX[m.attrs.color]) p.shade = HIGHLIGHT_HEX[m.attrs.color];
          else p.highlight = 'yellow';
          break;
      }
    }
    return p;
  }

  /** One inline node: text, a chip as its name, a footnote's reference. */
  private leaf(n: PMNode, ctx: Inline, linked: boolean): string {
    const props = this.props(n.marks, ctx, linked);
    if (n.isText) return run(n.text ?? '', props);
    if (n.type.name === 'footnoteRef') {
      const label = n.attrs.label as string;
      const known = this.noteIds.get(label);
      if (ctx.inNote || known !== undefined) {
        // referred to again (or from a footnote): its number, as Word gave it the first time
        const num = known ?? this.noteIds.size + 1;
        return run(String(num), { ...props, style: undefined, vert: 'superscript' });
      }
      const id = this.noteIds.size + 1;
      this.noteIds.set(label, id);
      const text = this.notes.get(label);
      this.footnotes.push(
        `<w:footnote w:id="${id}">`
        + para({ style: 'FootnoteText' }, `<w:r>${rPr({ style: 'FootnoteReference' })}<w:footnoteRef/></w:r>${run(' ')}${text ? this.inline(text, -1, { rels: this.noteRels, inNote: true }) : ''}`)
        + '</w:footnote>',
      );
      return `<w:r>${rPr({ ...props, style: 'FootnoteReference', vert: undefined })}<w:footnoteReference w:id="${id}"/></w:r>`;
    }
    // person, song, wiki: what they show
    return run(String(n.attrs.label ?? ''), props);
  }

  /* ---------- blocks ---------- */

  /** What a quote or callout adds to each paragraph in it: its rule, shading and indent. */
  private around(b: Block, p: ParaProps, indent = 0): ParaProps {
    const left = b.quote * 284 + (b.tone ? 170 : 0) + indent;
    const rules: string[] = [];
    if (b.tone) {
      const [rule, fill] = TONE[b.tone] ?? TONE.info;
      rules.push(`<w:left w:val="single" w:sz="24" w:space="8" w:color="${rule}"/>`);
      p.shade = fill;
    } else if (b.quote) rules.push('<w:left w:val="single" w:sz="18" w:space="8" w:color="BFBFBF"/>');
    if (rules.length) p.border = (p.border ?? '') + rules.join('');
    if (left) p.ind = { ...p.ind, left: (p.ind?.left ?? 0) + left, ...(b.tone && { right: 170 }) };
    return p;
  }

  /** The blocks of a container (the document, a quote, a callout), its content starting at `start`. */
  blocks(parent: PMNode, start: number, b: Block): string[] {
    const out: string[] = [];
    let pos = start;
    parent.forEach((n) => {
      const at = pos;
      pos += n.nodeSize;
      if (n.type.name !== 'listItem') this.list = null;
      out.push(...this.block(n, at, b));
    });
    this.list = null;
    return out;
  }

  private block(n: PMNode, at: number, b: Block): string[] {
    const inner = at + 1;
    const ctx: Inline = { rels: this.rels };
    switch (n.type.name) {
      case 'paragraph':
        return [para(this.around(b, { style: b.quote && !b.tone ? 'Quote' : undefined, jc: n.attrs.align ? JC[n.attrs.align] : undefined }), this.inline(n, inner, ctx))];
      case 'heading':
        return [para(this.around(b, { style: `Heading${n.attrs.level}`, jc: n.attrs.align ? JC[n.attrs.align] : undefined }), this.inline(n, inner, ctx))];
      case 'listItem':
        return [this.listItem(n, inner, b, ctx)];
      case 'codeBlock': {
        const lines = (n.textContent || '').split('\n');
        return lines.map((l) => para(this.around(b, { style: 'Code' }), run(l)));
      }
      case 'blockquote':
        return this.blocks(n, inner, { ...b, quote: b.quote + 1 });
      case 'callout': {
        const tone = calloutTone(n.attrs.kind);
        const inside = { ...b, tone };
        const out: string[] = [];
        let pos = inner;
        n.forEach((c) => {
          const cAt = pos;
          pos += c.nodeSize;
          if (c.type.name === 'calloutTitle') {
            const words = c.content.size ? this.inline(c, cAt + 1, { ...ctx, bold: true }) : run(calloutDefaultTitle(n.attrs.kind), { bold: true });
            out.push(para(this.around(inside, { keepNext: true }), words));
          } else {
            if (c.type.name !== 'listItem') this.list = null;
            out.push(...this.block(c, cAt, inside));
          }
        });
        this.list = null;
        return out;
      }
      case 'horizontalRule':
        return [para(this.around(b, { border: '<w:bottom w:val="single" w:sz="6" w:space="1" w:color="A6A6A6"/>', spacing: '<w:spacing w:after="240"/>' }), '')];
      case 'pageBreak':
        return [para({}, '<w:r><w:br w:type="page"/></w:r>')];
      case 'footnote': {
        // its words go in Word's footnote, where it's referred to; one nothing refers to stays here, as written
        const label = n.attrs.label as string;
        if (this.isReferred(label) && this.notes.get(label) === n) return [];
        return [para(this.around(b, { style: 'FootnoteText' }), run(`[${label}] `) + this.inline(n, inner, ctx))];
      }
      case 'table':
        return [this.table(n, inner)];
      case 'media':
        return this.mediaBlock(n.attrs.media as Media);
      default:
        return n.isTextblock ? [para(this.around(b, {}), this.inline(n, inner, ctx))] : [];
    }
  }

  private referred: Set<string> | null = null;
  private isReferred(label: string) {
    if (!this.referred) {
      this.referred = new Set();
      this.doc.descendants((n) => {
        if (n.type.name === 'footnoteRef') this.referred!.add(n.attrs.label);
        return n.type.name !== 'footnote' && !n.type.spec.code;
      });
    }
    return this.referred.has(label);
  }

  /** A list item: Word's bullets or numbers by its level; a task's box as a character before its words. */
  private listItem(n: PMNode, inner: number, b: Block, ctx: Inline): string {
    const level = depthOf(n.attrs.indent);
    const words = this.inline(n, inner, ctx);
    if (n.attrs.kind === 'task') {
      const box = run(n.attrs.checked ? '☑' : '☐', { font: 'Segoe UI Symbol' }) + '<w:r><w:tab/></w:r>';
      return para(this.around(b, { style: 'ListParagraph', ind: { left: 720 * (level + 1), hanging: 360 } }), box + words);
    }
    let num = 1;
    if (n.attrs.kind === 'ol') {
      if (!this.list) {
        this.list = { id: this.lists.length + 2, starts: new Map() };
        this.lists.push(this.list.starts);
      }
      if (!this.list.starts.has(level)) this.list.starts.set(level, Math.max(0, parseInt(n.attrs.num, 10) || 1));
      num = this.list.id;
    }
    // inside a quote or callout the indent is said outright (the numbering's own would be overridden)
    const indent = b.quote || b.tone ? { ind: { left: 720 * (level + 1), hanging: 360 } } : {};
    return para(this.around(b, { style: 'ListParagraph', num: { id: num, level }, ...indent }), words);
  }

  /** A table: ruled, its first row the header (repeated on each page), each cell aligned as its column. */
  private table(n: PMNode, inner: number): string {
    const cols = Math.max(1, ...Array.from({ length: n.childCount }, (_, i) => n.child(i).childCount));
    const w = Math.floor(TEXT_W / cols);
    const rule = (side: string) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="888888"/>`;
    const rows: string[] = [];
    let pos = inner;
    n.forEach((row, _, r) => {
      const rowAt = pos;
      pos += row.nodeSize;
      const cells: string[] = [];
      let cPos = rowAt + 1;
      row.forEach((cell) => {
        const cellAt = cPos;
        cPos += cell.nodeSize;
        const head = cell.type.name === 'tableHeader';
        const tcPr = `<w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="EEEEEE"/>' : ''}</w:tcPr>`;
        const jc = cell.attrs.align ? JC[cell.attrs.align] : undefined;
        cells.push(`<w:tc>${tcPr}${para({ jc }, this.inline(cell, cellAt + 1, { rels: this.rels, bold: head }))}</w:tc>`);
      });
      // a row that's short of cells (it can't be in a note, but) is made up to the others
      for (let k = row.childCount; k < cols; k++) cells.push(`<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr><w:p/></w:tc>`);
      rows.push(`<w:tr><w:trPr><w:cantSplit/>${r === 0 ? '<w:tblHeader/>' : ''}</w:trPr>${cells.join('')}</w:tr>`);
    });
    const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(rule).join('');
    return '<w:tbl>'
      + `<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${borders}</w:tblBorders>`
      + '<w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>'
      + `<w:tblGrid>${`<w:gridCol w:w="${w}"/>`.repeat(cols)}</w:tblGrid>`
      + rows.join('')
      + '</w:tbl>';
  }

  /**
   * A picture or a row: in its paragraph, as wide as on the page; its caption under it. A row's pictures stand side
   * by side at one height, each as wide as its shape, as the note draws them.
   */
  private mediaBlock(m: Media): string[] {
    const jc = m.size && m.size < 100 && m.align ? m.align : 'center';
    const share = ((m.size ?? 100) / 100) * TEXT_W * EMU;
    const pics = itemsOf(m)
      .map((it) => ({ key: itemKey(it), pic: this.note.pictures?.get(itemKey(it)) }))
      .filter((x): x is { key: string; pic: DocxPicture } => !!x.pic?.width && !!x.pic.height);
    const gap = pics.length > 1 ? 0.02 * TEXT_W * EMU : 0;
    // the height that fills the width across, no taller than a picture may be
    const across = pics.reduce((a, x) => a + x.pic.width / x.pic.height, 0);
    const cy = Math.min(MAX_PIC_H, (share - gap * (pics.length - 1)) / (across || 1));
    const drawn = pics.map(({ key, pic }) => this.drawing(key, pic, Math.round((cy * pic.width) / pic.height), Math.round(cy), m.alt ?? ''));
    const out: string[] = [];
    const sep = gap ? `<w:r><w:t xml:space="preserve"> </w:t></w:r>` : '';
    if (drawn.length) out.push(para({ jc, keepNext: !!m.caption }, drawn.join(sep)));
    else {
      // none could be read: its words instead
      const words = m.alt || (!m.caption ? t('Picture') : '');
      if (words) out.push(para({ jc, keepNext: !!m.caption }, run(`[${words}]`, { italic: true, color: '7F7F7F' })));
    }
    if (m.caption) out.push(para({ style: 'Caption', jc }, run(m.caption)));
    return out;
  }

  private drawing(key: string, pic: DocxPicture, cx: number, cy: number, alt: string): string {
    let rel = this.pictureRel.get(key);
    if (!rel) {
      const name = `image${this.media.length + 1}.${pic.type}`;
      this.media.push({ name: 'word/media/' + name, data: pic.data, deflate: false });
      rel = this.rels.add('image', 'media/' + name);
      this.pictureRel.set(key, rel);
    }
    const id = ++this.drawings;
    const descr = xmlText(alt);
    return '<w:r><w:drawing>'
      + `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>`
      + `<wp:docPr id="${id}" name="Picture ${id}" descr="${descr}"/>`
      + '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
      + `<a:graphic><a:graphicData uri="${PIC}"><pic:pic>`
      + `<pic:nvPicPr><pic:cNvPr id="${id}" name="Picture ${id}" descr="${descr}"/><pic:cNvPicPr/></pic:nvPicPr>`
      + `<pic:blipFill><a:blip r:embed="${rel}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
      + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
      + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }
}

/* ---------- the fixed parts ---------- */

const font = (f: string) => `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:eastAsia="${f}" w:cs="${f}"/>`;
const sz = (half: number) => `<w:sz w:val="${half}"/><w:szCs w:val="${half}"/>`;

function stylesXml(lang: string): string {
  const style = (type: string, id: string, name: string, inner: string, extra = '') =>
    `<w:style w:type="${type}" w:styleId="${id}"${extra}><w:name w:val="${name}"/>${inner}</w:style>`;
  const heading = (n: number) => {
    const size = [32, 28, 26, 24, 22, 22][n - 1];
    return style('paragraph', `Heading${n}`, `heading ${n}`,
      `<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>`
      + `<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${n <= 2 ? 360 : 240}" w:after="80"/><w:outlineLvl w:val="${n - 1}"/></w:pPr>`
      + `<w:rPr><w:b/><w:bCs/>${n >= 5 ? '<w:i/><w:iCs/>' : ''}<w:color w:val="1F3864"/>${sz(size)}</w:rPr>`);
  };
  return HEAD + `<w:styles xmlns:w="${W}">`
    + `<w:docDefaults><w:rPrDefault><w:rPr>${font('Calibri')}${sz(22)}<w:lang w:val="${lang}" w:eastAsia="${lang}" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>`
    + '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    + style('paragraph', 'Normal', 'Normal', '<w:qFormat/>', ' w:default="1"')
    + style('character', 'DefaultParagraphFont', 'Default Paragraph Font', '<w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/>', ' w:default="1"')
    + style('paragraph', 'Title', 'Title', '<w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:uiPriority w:val="10"/><w:qFormat/>'
      + `<w:pPr><w:spacing w:after="60"/><w:contextualSpacing/></w:pPr><w:rPr><w:b/><w:bCs/>${sz(52)}</w:rPr>`)
    + style('paragraph', 'Subtitle', 'Subtitle', '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="11"/><w:qFormat/>'
      + `<w:pPr><w:spacing w:after="360"/></w:pPr><w:rPr><w:color w:val="595959"/>${sz(24)}</w:rPr>`)
    + [1, 2, 3, 4, 5, 6].map(heading).join('')
    + style('paragraph', 'Quote', 'Quote', '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="29"/><w:qFormat/>'
      + '<w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="BFBFBF"/></w:pBdr><w:ind w:left="284"/></w:pPr><w:rPr><w:color w:val="595959"/></w:rPr>')
    + style('paragraph', 'Code', 'Code', '<w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:qFormat/>'
      + `<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr>${font('Consolas')}${sz(19)}</w:rPr>`)
    + style('character', 'CodeChar', 'Code Char', `<w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:rPr>${font('Consolas')}<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:rPr>`)
    + style('paragraph', 'ListParagraph', 'List Paragraph', '<w:basedOn w:val="Normal"/><w:uiPriority w:val="34"/><w:qFormat/><w:pPr><w:ind w:left="720"/></w:pPr>')
    + style('paragraph', 'Caption', 'caption', '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="35"/><w:unhideWhenUsed/><w:qFormat/>'
      + `<w:pPr><w:spacing w:before="60" w:after="200"/></w:pPr><w:rPr><w:i/><w:iCs/><w:color w:val="595959"/>${sz(18)}</w:rPr>`)
    + style('character', 'Hyperlink', 'Hyperlink', '<w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>')
    + style('paragraph', 'FootnoteText', 'footnote text', `<w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:pPr><w:spacing w:line="240" w:lineRule="auto"/></w:pPr><w:rPr>${sz(18)}</w:rPr>`)
    + style('character', 'FootnoteReference', 'footnote reference', '<w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr>')
    + style('paragraph', 'CommentText', 'annotation text', `<w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr>${sz(20)}</w:rPr>`)
    + style('character', 'CommentReference', 'annotation reference', `<w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr>${sz(16)}</w:rPr>`)
    + style('table', 'TableNormal', 'Normal Table', '<w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/>'
      + '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>', ' w:default="1"')
    + style('table', 'TableGrid', 'Table Grid', '<w:basedOn w:val="TableNormal"/><w:uiPriority w:val="39"/>'
      + '<w:tblPr><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>')
    + '</w:styles>';
}

/** Bullets (1) by level • ◦ ▪, and numbers by level 1. a. i. as the app shows them (lib/noteDoc/syntax.ts olMarker). */
function numberingXml(lists: Map<number, number>[]): string {
  const ind = (l: number) => `<w:pPr><w:ind w:left="${720 * (l + 1)}" w:hanging="360"/></w:pPr>`;
  const levels = (lvl: (l: number) => string) => Array.from({ length: 9 }, (_, l) => `<w:lvl w:ilvl="${l}">${lvl(l)}</w:lvl>`).join('');
  const bullets = levels((l) => `<w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${['•', '◦', '▪'][l % 3]}"/><w:lvlJc w:val="left"/>${ind(l)}`);
  const numbers = levels((l) => `<w:start w:val="1"/><w:numFmt w:val="${['decimal', 'lowerLetter', 'lowerRoman'][l % 3]}"/><w:lvlText w:val="%${l + 1}."/><w:lvlJc w:val="left"/>${ind(l)}`);
  const nums = lists.map((starts, i) => {
    const over = [...starts].filter(([, s]) => s !== 1).map(([l, s]) => `<w:lvlOverride w:ilvl="${l}"><w:startOverride w:val="${s}"/></w:lvlOverride>`).join('');
    return `<w:num w:numId="${i + 2}"><w:abstractNumId w:val="1"/>${over}</w:num>`;
  });
  return HEAD + `<w:numbering xmlns:w="${W}">`
    + `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bullets}</w:abstractNum>`
    + `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="multilevel"/>${numbers}</w:abstractNum>`
    + '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>'
    + nums.join('')
    + '</w:numbering>';
}

const footnotesXml = (notes: string[]) => HEAD + `<w:footnotes ${NS}>`
  + '<w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote>'
  + '<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>'
  + notes.join('') + '</w:footnotes>';

const settingsXml = () => HEAD + `<w:settings xmlns:w="${W}">`
  + '<w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/>'
  + '<w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr>'
  + '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>'
  + '</w:settings>';

/** A time as the document's properties write it: W3C, to the second. */
const w3c = (ms: number) => new Date(Number.isFinite(ms) ? ms : Date.now()).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** The note's .docx, as bytes. */
export async function buildDocx(note: DocxNote): Promise<Uint8Array> {
  const doc = parseNote(note.text);
  const w = new Writer(doc, note);
  const head: string[] = [];
  if (note.title.trim()) head.push(para({ style: 'Title' }, run(note.title.trim())));
  if (note.date) head.push(para({ style: 'Subtitle' }, run(note.date)));
  const blocks = w.blocks(doc, 0, { quote: 0, tone: null });
  // Word wants a paragraph between two tables (else they're one) and last, before the section's properties
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].startsWith('<w:tbl>') && (i === blocks.length - 1 || blocks[i + 1].startsWith('<w:tbl>'))) blocks.splice(i + 1, 0, '<w:p/>');
  }
  if (!blocks.length) blocks.push('<w:p/>');

  const comments = w.comments.length > 0;
  const rels = w.rels;
  rels.add('styles', 'styles.xml');
  rels.add('numbering', 'numbering.xml');
  rels.add('footnotes', 'footnotes.xml');
  rels.add('settings', 'settings.xml');
  if (comments) rels.add('comments', 'comments.xml');

  const sect = `<w:sectPr><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}"/>`
    + `<w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="708" w:footer="708" w:gutter="0"/>`
    + '<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>';
  const document = HEAD + `<w:document ${NS}><w:body>${head.join('')}${blocks.join('')}${sect}</w:body></w:document>`;
  const lang = note.lang === 'ro' ? 'ro-RO' : 'en-GB';
  const title = xmlText(note.title.trim());

  const types = HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    + '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
    + '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>'
    + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
    + (comments ? '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>' : '')
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
    + '</Types>';
  const root = HEAD + `<Relationships xmlns="${PKG_REL}">`
    + `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>`
    + `<Relationship Id="rId2" Type="${PKG_REL}/metadata/core-properties" Target="docProps/core.xml"/>`
    + `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/>`
    + '</Relationships>';
  const core = HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"'
    + ' xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    + (title ? `<dc:title>${title}</dc:title>` : '')
    + `<dc:language>${lang}</dc:language>`
    + `<dcterms:created xsi:type="dcterms:W3CDTF">${w3c(note.created)}</dcterms:created>`
    + `<dcterms:modified xsi:type="dcterms:W3CDTF">${w3c(note.updated)}</dcterms:modified>`
    + '</cp:coreProperties>';
  const app = HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>My Mind</Application></Properties>';

  const enc = new TextEncoder();
  const text = (name: string, xml: string): ZipFile => ({ name, data: enc.encode(xml) });
  const files: ZipFile[] = [
    text('[Content_Types].xml', types),
    text('_rels/.rels', root),
    text('docProps/core.xml', core),
    text('docProps/app.xml', app),
    text('word/document.xml', document),
    text('word/_rels/document.xml.rels', rels.xml()),
    text('word/styles.xml', stylesXml(lang)),
    text('word/numbering.xml', numberingXml(w.lists)),
    text('word/footnotes.xml', footnotesXml(w.footnotes)),
    text('word/settings.xml', settingsXml()),
  ];
  if (w.noteRels.list.length) files.push(text('word/_rels/footnotes.xml.rels', w.noteRels.xml()));
  if (comments) files.push(text('word/comments.xml', HEAD + `<w:comments ${NS}>${w.comments.join('')}</w:comments>`));
  files.push(...w.media);
  return zip(files, new Date(), note.compress !== false);
}

/** A file name for the note: its title without what file systems refuse, or its date. */
export function docxName(title: string, fallback: string): string {
  const name = title
    .replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80)
    .trim();
  return `${name || fallback}.docx`;
}
