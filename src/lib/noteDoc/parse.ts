// Reads a note's text into the document: pictures first (lib/body.ts), then each stretch of text between them line
// by line, the way the reading view does (components/Markdown.tsx), then each line's inline Markdown with lib/inline.ts.
// Nothing is tidied on the way in: what's written is kept in the nodes' attributes, so serializeNote gives the text back.
import type { Mark, Node as PMNode, Schema } from '@tiptap/pm/model';
import { parseBody } from '../body';
import { inline } from '../inline';
import { noteSchema } from './schema';
import { QUOTE, alignOf, calloutOf, classifyLine, closesFence, tableAt, type TableLines } from './syntax';

/** A note's whole text as a document: blocks, with a media node for each picture line. */
export function parseNote(text: string, schema: Schema = noteSchema()): PMNode {
  const { texts, media } = parseBody(text);
  const content: PMNode[] = [];
  texts.forEach((t, i) => {
    if (i) content.push(schema.nodes.media.create({ media: media[i - 1] }));
    content.push(...parseBlocks(t, schema));
  });
  return schema.nodes.doc.create(null, content);
}

/** A stretch of text without pictures as blocks, one per line (a code block or quote takes its lines). Never empty. */
export function parseBlocks(text: string, schema: Schema = noteSchema()): PMNode[] {
  const n = schema.nodes;
  const lines = text.split('\n');
  const out: PMNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const c = classifyLine(l);
    switch (c.t) {
      case 'fence': {
        const body: string[] = [];
        while (i + 1 < lines.length && !closesFence(lines[i + 1], c.fence)) body.push(lines[++i]);
        const close = i + 1 < lines.length ? lines[++i] : null;
        const code = body.join('\n');
        out.push(n.codeBlock.create({ open: l, close }, code ? schema.text(code) : null));
        break;
      }
      case 'hr':
        out.push(n.horizontalRule.create({ raw: l }));
        break;
      case 'heading': {
        const { text, align } = alignOf(l.slice(c.at));
        out.push(n.heading.create({ level: c.level, sep: c.sep, align }, parseInline(text, [], schema)));
        break;
      }
      case 'pagebreak':
        out.push(n.pageBreak.create({ raw: l }));
        break;
      case 'footnote':
        out.push(n.footnote.create({ label: c.label, sep: c.sep }, parseInline(l.slice(c.at), [], schema)));
        break;
      case 'item': {
        const { t: _, at, ...attrs } = c;
        out.push(n.listItem.create({ ...attrs, checked: c.check !== ' ' }, parseInline(l.slice(at), [], schema)));
        break;
      }
      case 'quote': {
        const body = [l.slice(c.at)];
        let m: RegExpMatchArray | null;
        while (i + 1 < lines.length && (m = lines[i + 1].match(QUOTE))) (body.push(m[1]), i++);
        const co = calloutOf(body[0]);
        if (co) {
          const title = n.calloutTitle.create(null, parseInline(body[0].slice(co.at), [], schema));
          const rest = body.length > 1 ? parseBlocks(body.slice(1).join('\n'), schema) : [];
          out.push(n.callout.create({ kind: co.kind, fold: co.fold, sep: co.sep }, [title, ...rest]));
        } else out.push(n.blockquote.create(null, parseBlocks(body.join('\n'), schema)));
        break;
      }
      case 'blank': // kept with whatever spaces it holds
        out.push(n.paragraph.create(null, parseInline(l, [], schema)));
        break;
      default: {
        // a table's header row, with its delimiter row under it: the table, to its last row
        const table = tableAt(lines, i);
        if (table) {
          out.push(tableNode(table, schema));
          i = table.end - 1;
          break;
        }
        // a line of text, aligned when its end says so
        const { text, align } = alignOf(l);
        out.push(n.paragraph.create({ align }, parseInline(text, [], schema)));
      }
    }
  }
  return out;
}

/** A table's node from its lines: each cell's inline Markdown, each with its column's alignment. */
function tableNode({ rows, aligns }: TableLines, schema: Schema): PMNode {
  const n = schema.nodes;
  return n.table.create(null, rows.map((cells, r) =>
    n.tableRow.create(null, cells.map((c, k) => (r ? n.tableCell : n.tableHeader).create({ align: aligns[k] }, parseInline(c, [], schema))))));
}

/** A line's inline Markdown as text and chips, each carrying `marks` and the styles it's written in. */
export function parseInline(text: string, marks: readonly Mark[] = [], schema: Schema = noteSchema()): PMNode[] {
  const m = schema.marks;
  const out: PMNode[] = [];
  const add = (s: string, set: readonly Mark[]) => s && out.push(schema.text(s, set));
  const inLink = marks.some((x) => x.type === m.link);
  for (const p of inline(text)) {
    switch (p.t) {
      case 'text': case 'tag': case 'empty':
        add(p.s, marks);
        break;
      case 'esc':
        add(p.s, m.escaped.create().addToSet(marks));
        break;
      case 'code':
        add(p.s, m.code.create({ tick: p.tick }).addToSet(marks));
        break;
      case 'fn': {
        const type = schema.nodes.footnoteRef;
        out.push(type.create({ label: p.s }, null, marks.filter((x) => type.allowsMarkType(x.type))));
        break;
      }
      case 'wiki': case 'person': case 'song': {
        const type = schema.nodes[p.t];
        out.push(type.create({ target: p.target ?? null, label: p.s }, null, marks.filter((x) => type.allowsMarkType(x.type))));
        break;
      }
      case 'link':
        out.push(...parseInline(p.s, m.link.create({ href: p.url, bare: false }).addToSet(marks), schema));
        break;
      case 'bare':
        // an address inside [text](…) is that link's text, not a link of its own
        add(p.s, inLink ? marks : m.link.create({ href: p.s, bare: true }).addToSet(marks));
        break;
      case 'hl':
        out.push(...parseInline(p.s, m.highlight.create({ color: p.color }).addToSet(marks), schema));
        break;
      case 'color':
        out.push(...parseInline(p.s, m.color.create({ color: p.color }).addToSet(marks), schema));
        break;
      default: {
        const type = p.t === 'b' ? m.bold : p.t === 'i' ? m.italic : p.t === 's' ? m.strike : p.t === 'u' ? m.underline : p.t === 'sup' ? m.sup : m.sub;
        out.push(...parseInline(p.s, type.create().addToSet(marks), schema));
      }
    }
  }
  return out;
}
