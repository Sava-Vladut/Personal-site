// Writes the document back as the note's text. A document read from text gives that text back exactly (the few
// exceptions are listed in scripts/test-notedoc.mjs: `>x` → `> x` and the like). For edited content, each line is
// read back as it's written: when it wouldn't come back the same, plain characters get a backslash (\*), and failing
// that a style that can't be written there is left off. Characters themselves are never dropped.
import type { Fragment, Mark, MarkType, Node as PMNode, Slice } from '@tiptap/pm/model';
import { parseBody, mediaMarker } from '../body';
import { parseInline } from './parse';
import { STYLE_MARKS, atomToken, type AtomAttrs } from './schema';
import { BARE, calloutOf, classifyLine, closesFence, fenceOf } from './syntax';

/* ---------- inline: a textblock's content as units ---------- */

/** One character (or chip) of a line, with its marks. */
interface Unit {
  s: string;
  atom: PMNode | null;
  marks: readonly Mark[];
}

const unitsOf = (nodes: Iterable<PMNode>): Unit[] => {
  const out: Unit[] = [];
  for (const n of nodes) {
    if (n.isText) for (const s of n.text!) out.push({ s, atom: null, marks: n.marks });
    else out.push({ s: atomToken(n.type.name, n.attrs as AtomAttrs), atom: n, marks: n.marks });
  }
  return out;
};
const childrenOf = (n: PMNode | Fragment): PMNode[] => {
  const out: PMNode[] = [];
  n.forEach((c) => void out.push(c));
  return out;
};

/** A mark, for comparing: a link by its address (bare or as [text](address), `)` or `%29`, it reads the same). */
const markKey = (m: Mark): string => (m.type.name === 'link' ? 'link' + JSON.stringify(encodeHref(m.attrs.href)) : m.type.name === 'code' ? 'code' + JSON.stringify(m.attrs) : m.type.name);
/** What a unit is, for comparing: escapes don't count (they only say how a character is written), nor a link's form. */
const unitKey = (u: Unit) =>
  (u.atom ? u.atom.type.name + JSON.stringify(u.atom.attrs) : 'T' + u.s) + '\0' + u.marks.filter((m) => m.type.name !== 'escaped').map(markKey).sort().join(',');

/** A space a style can't start with (a code span's starts with its backtick, so it can). */
const isSpace = (u: Unit) => !u.atom && /^\s$/.test(u.s) && !u.marks.some((m) => m.type.name === 'code');
const styled = (name: string) => name === 'bold' || name === 'italic' || name === 'strike' || name === 'highlight';
const ESCAPABLE = /^[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]$/;

/** The units from `i` on (up to `to`) that carry mark `m`. */
const spanOf = (u: Unit[], i: number, to: number, m: Mark, also: (x: Unit) => boolean = () => true) => {
  let j = i;
  while (j < to && m.isInSet(u[j].marks) && also(u[j])) j++;
  return j;
};
const without = (u: Unit, type: MarkType) => (u.marks = type.removeFromSet(u.marks));

/** An address as [text](address) writes it: spaces and `)` encoded (they'd end it). */
const encodeHref = (href: unknown) => String(href ?? '').replace(/[\s)]/g, (c) => encodeURIComponent(c).replace(')', '%29'));

/**
 * Units `i`–`j` (a link's text) as [text](address): the address encoded, and `]` left out of the link (its text
 * can't hold one).
 */
function fullLink(u: Unit[], i: number, j: number, link: Mark) {
  const full = link.type.create({ ...link.attrs, href: encodeHref(link.attrs.href), bare: false });
  for (let k = i; k < j; k++) u[k].marks = u[k].s === ']' ? link.type.removeFromSet(u[k].marks) : full.addToSet(link.type.removeFromSet(u[k].marks));
}

/**
 * Takes off what can't be written at all: code can't hold a backtick, a link's text can't hold `]`. An address
 * written as it is stays so only when it reads as the very same address on its own; else it's written as
 * [text](address), with its spaces and `)` encoded.
 */
function tidy(u: Unit[]): Unit[] {
  for (const x of u) {
    const m = x.marks.find((m) => m.type.name === 'code');
    if (m && (x.s === '`' || !/^`+$/.test(m.attrs.tick))) {
      without(x, m.type);
      if (x.s !== '`') x.marks = m.type.create({ tick: '`' }).addToSet(x.marks);
    }
  }
  for (let i = 0; i < u.length; ) {
    const link = u[i].marks.find((m) => m.type.name === 'link');
    if (!link) { i++; continue; }
    const j = spanOf(u, i, u.length, link);
    const text = u.slice(i, j).map((x) => x.s).join('');
    if (!link.attrs.bare || text !== link.attrs.href || !BARE.test(text) || u.slice(i, j).some((x) => x.atom)) fullLink(u, i, j, link);
    i = j;
  }
  return u;
}

/* ---------- inline: writing ---------- */

const OUTER = ['link', 'strike', 'highlight', 'bold'];
const MARKER: Record<string, string> = { strike: '~~', highlight: '==', bold: '**', italic: '*' };

interface Ctx {
  open: MarkType[];
  /** inside a bare address or code: characters go as they are */
  raw: boolean;
  /** escape every character that could be read as Markdown */
  all: boolean;
}

/** One unit as written: a chip's token, an escaped character with its backslash. */
function plain(u: Unit[], i: number, ctx: Ctx): string {
  const { s, atom, marks } = u[i];
  if (atom) return s;
  if (ctx.raw || marks.some((m) => m.type.name === 'code')) return s;
  if (marks.some((m) => m.type.name === 'escaped') && ESCAPABLE.test(s)) return '\\' + s;
  if (!ctx.all) return s;
  // ~ and = always: one next to a style's ~~ or == would read as part of it. The : of an address, in a link's text
  // too: read as an address there it's still plain text, but it would take the backslashes after it as letters
  const esc =
    s === '\\' || s === '*' || s === '`' || s === '[' || s === '@' || s === '=' || s === '~' ||
    (s === ':' && u[i + 1]?.s === '/' && u[i + 2]?.s === '/');
  return esc ? '\\' + s : s;
}

/**
 * Writes units `from`–`to`, opening the marks they carry that aren't open yet. The one running longest opens first
 * (ties in the order link, strike, highlight, bold, italic), so the markers never cross. Where the syntax needs it
 * the nesting is fixed: code is always innermost, and italic never holds bold (it can't hold a `*`).
 */
function emit(u: Unit[], from: number, to: number, ctx: Ctx): string {
  let out = '';
  for (let i = from; i < to; ) {
    const fresh = u[i].marks.filter((m) => (STYLE_MARKS as readonly string[]).includes(m.type.name) && !ctx.open.includes(m.type));
    if (!fresh.length) {
      out += plain(u, i++, ctx);
      continue;
    }
    const isFresh = (x: Unit, names: string[]) => x.marks.some((m) => names.includes(m.type.name) && !ctx.open.includes(m.type));
    let pick: Mark | null = null;
    let end = i;
    for (const name of [...OUTER, 'italic']) {
      const m = fresh.find((x) => x.type.name === name);
      if (!m) continue;
      // italic ends before bold: *a **b** c* can't be written, so there bold goes outside and italic is split
      const j = name === 'italic' ? spanOf(u, i, to, m, (x) => !isFresh(x, ['bold'])) : spanOf(u, i, to, m);
      if (j > end) (pick = m), (end = j);
    }
    if (!pick) {
      pick = fresh[0]; // code, with nothing else to open here: it ends where another style starts
      end = spanOf(u, i, to, pick, (x) => !isFresh(x, [...OUTER, 'italic']));
    } else if (isSpace(u[end] ?? u[i])) {
      // a style starting inside this one and running on past it is split at its end, and can't go on with a space
      // (*a ==b* c==): split this one where that one starts instead (*a*==*b* c==)
      const type = pick.type;
      const cross = (j: number) => u[j].marks.some((m) => styled(m.type.name) && m.type !== type && !ctx.open.includes(m.type) && !m.isInSet(u[j - 1].marks) && spanOf(u, j, to, m) > end);
      for (let j = i + 1; j < end; j++) {
        if (cross(j)) {
          if (!isSpace(u[j])) end = j;
          break;
        }
      }
    }
    const name = pick.type.name;
    if (styled(name) && isSpace(u[i])) {
      // a style starts at a letter: its leading spaces go outside it
      for (let k = i; k < end && isSpace(u[k]); k++) without(u[k], pick.type);
      continue;
    }
    const inner: Ctx = { ...ctx, open: [...ctx.open, pick.type] };
    if (name === 'link') {
      if (pick.attrs.bare) out += emit(u, i, end, { ...inner, raw: true });
      else out += '[' + emit(u, i, end, inner) + '](' + pick.attrs.href + ')';
    } else if (name === 'code') out += pick.attrs.tick + emit(u, i, end, { ...inner, raw: true }) + pick.attrs.tick;
    else out += MARKER[name] + emit(u, i, end, inner) + MARKER[name];
    i = end;
  }
  return out;
}

const DROP_ORDER = ['code', 'italic', 'bold', 'highlight', 'strike', 'link'];

/** Where `got` first differs from `want`. */
const firstDiff = (want: Unit[], got: Unit[]) => {
  let k = 0;
  while (k < want.length && k < got.length && unitKey(want[k]) === unitKey(got[k])) k++;
  return k;
};

/**
 * Leaves off one style near where `got` first differs from `want`; false when there's none left to leave off.
 * Code is left off only where the other styles stay the same (code next to it in another style is written apart).
 * Code and links stay on the spaces a line starts with: plain there, they'd be read as part of its marker.
 */
function dropOne(want: Unit[], got: Unit[]): boolean {
  const k = firstDiff(want, got);
  let lead = 0;
  while (lead < want.length && !want[lead].atom && /^\s$/.test(want[lead].s)) lead++;
  for (let d = 0; d <= want.length; d++) {
    for (const at of d ? [k - d, k + d] : [k]) {
      const x = want[at];
      if (!x) continue;
      for (const name of DROP_ORDER) {
        const m = x.marks.find((y) => y.type.name === name);
        // code and a link's brackets keep the spaces a line starts with
        const keeps = name === 'code' || name === 'link';
        if (!m || (keeps && at < lead)) continue;
        const along = (u: Unit) => m.isInSet(u.marks) && (name !== 'code' || u.marks.length === x.marks.length && u.marks.every((y) => y.isInSet(x.marks)));
        let a = at;
        while (a > (keeps ? lead : 0) && along(want[a - 1])) a--;
        for (let b = a; b < want.length && along(want[b]); b++) without(want[b], m.type);
        return true;
      }
    }
  }
  return false;
}

/**
 * Writes as [text](address) each address written as it is that didn't read back as itself (text typed right after
 * it would run into it: https://a.bcd, https://a.b**c**). False when there's none.
 */
function unbare(want: Unit[], got: Unit[]): boolean {
  const k = firstDiff(want, got);
  let changed = false;
  for (let i = 0; i < want.length; ) {
    const link = want[i].marks.find((m) => m.type.name === 'link');
    if (!link) { i++; continue; }
    const j = spanOf(want, i, want.length, link);
    const same = (k: number) => !!got[k] && link.isInSet(got[k].marks);
    // read differently from just before it to just after it, or (when all the characters came back) as a link of
    // another length
    const off = (k >= i - 1 && k <= j) || (got.length === want.length && (!want.slice(i, j).every((_, k) => same(i + k)) || same(i - 1) || same(j)));
    if (link.attrs.bare && off) {
      fullLink(want, i, j, link);
      changed = true;
    }
    i = j;
  }
  return changed;
}

/** Puts a backslash before a line's first character so it doesn't read as a block's marker (`\#`, `\-`, `1\.`). */
function escapeFirst(s: string): string {
  const i = s.search(/[^ \t]/);
  if (i < 0) return s;
  if (ESCAPABLE.test(s[i])) return s.slice(0, i) + '\\' + s.slice(i);
  const d = s.slice(i).match(/^\d+[.)]/);
  return d ? s.slice(0, i + d[0].length - 1) + '\\' + s.slice(i + d[0].length - 1) : s;
}

/**
 * Writes a textblock's content after `prefix`, so it reads back the same. `check` reads the whole line back and
 * gives its inline part, or null when the line reads as another kind of block.
 */
function writeLine(node: PMNode, prefix: string, check: (line: string) => string | null): string {
  const units = tidy(unitsOf(childrenOf(node)));
  const schema = node.type.schema;
  for (let all = false; ; ) {
    const inl = emit(units, 0, units.length, { open: [], raw: false, all });
    let line = prefix + inl;
    let body = check(line);
    if (body === null) body = check((line = prefix + escapeFirst(inl)));
    if (body === null) {
      // still read as another kind of line: leave off a style near the start (a line's marker is there)
      if (all && !dropOne(units, [])) return line;
      all = true;
      continue;
    }
    const got = unitsOf(parseInline(body, [], schema));
    if (got.length === units.length && got.every((g, k) => unitKey(g) === unitKey(units[k]))) return line;
    // an address written as [text](address) instead reads back the same without escapes: try again from the start
    if (all && unbare(units, got)) all = false;
    else if (!all) all = true;
    else if (!dropOne(units, got)) return line;
  }
}

/** A textblock's inline content as Markdown (a code block's text as it is). */
export function serializeInline(node: PMNode): string {
  if (node.type.spec.code) return node.textContent;
  return writeLine(node, '', (l) => l);
}

/* ---------- blocks ---------- */

/** Where blocks are written: at the top of the note (where a line can be a picture), or as a quote's lines. */
interface Where {
  top: boolean;
  quote: boolean;
}

const isMarker = (line: string) => parseBody(line).media.length > 0;
const ws = (s: unknown, empty: boolean) => (typeof s === 'string' && (empty ? /^[ \t]*$/ : /^[ \t]+$/).test(s) ? s : null);

/** A list item's marker, as it's written before the text (with the spaces after it). */
function itemPrefix(a: Record<string, any>) {
  const indent = ws(a.indent, true) ?? '';
  const bullet = /^[-*+]$/.test(a.bullet) ? a.bullet : '-';
  const sep = ws(a.sep, false) ?? ' ';
  if (a.kind === 'ol') return { indent, sep, parts: { num: /^\d{1,9}$/.test(a.num) ? a.num : '1', delim: a.delim === ')' ? ')' : '.' } };
  if (a.kind === 'task') {
    const check = a.checked ? (a.check === 'X' ? 'X' : 'x') : ' ';
    return { indent, sep, parts: { bullet, gap: ws(a.gap, false) ?? ' ', check } };
  }
  return { indent, sep, parts: { bullet } };
}

/** The attributes as they'll be written: odd values (a level of 9, a tab as a bullet) give way to defaults. */
export function writtenAttrs(node: PMNode): Record<string, unknown> {
  const a = node.attrs;
  switch (node.type.name) {
    case 'heading':
      return { level: Math.min(6, Math.max(1, Math.round(Number(a.level)) || 1)), sep: ws(a.sep, false) ?? ' ' };
    case 'listItem': {
      const p = itemPrefix(a);
      return { kind: a.kind === 'ol' || a.kind === 'task' ? a.kind : 'ul', indent: p.indent, sep: p.sep, ...p.parts };
    }
    case 'callout':
      return { kind: /^[\w-]+$/.test(a.kind) ? a.kind : 'note', fold: a.fold === '+' || a.fold === '-' ? a.fold : '', sep: ws(a.sep, true) ?? ' ' };
    case 'horizontalRule':
      return { raw: typeof a.raw === 'string' && !a.raw.includes('\n') && classifyLine(a.raw).t === 'hr' ? a.raw : '---' };
    case 'codeBlock':
      return codeFences(node, a.close === null);
    case 'media':
      return { marker: a.media ? mediaMarker(a.media) : null };
    default:
      return a;
  }
}

/**
 * A code block's opening and closing lines. The block is closed unless it's the last of its stretch; a block
 * holding a line that starts with its own fence switches to the other one (``` ↔ ~~~).
 */
function codeFences(node: PMNode, last: boolean): { open: string; close: string | null } {
  let open = typeof node.attrs.open === 'string' && !node.attrs.open.includes('\n') && fenceOf(node.attrs.open) ? node.attrs.open : '```';
  let close: string | null = node.attrs.close;
  let fence = fenceOf(open)!;
  const lines = node.textContent.split('\n');
  if (lines.some((l) => closesFence(l, fence))) {
    const other = fence === '```' ? '~~~' : '```';
    if (!lines.some((l) => closesFence(l, other))) {
      open = open.replace(fence, other);
      if (close !== null) close = close.replace(fence, other);
      fence = other;
    }
  }
  if (close === null && !last) close = fence;
  if (close !== null && (typeof close !== 'string' || close.includes('\n') || !closesFence(close, fence))) close = fence;
  return { open, close };
}

function blockLines(node: PMNode, where: Where, first: boolean, last: boolean): string[] {
  const a = writtenAttrs(node) as Record<string, any>;
  switch (node.type.name) {
    case 'paragraph':
      return [
        writeLine(node, '', (l) => {
          const c = classifyLine(l).t;
          if (c !== 'text' && c !== 'blank') return null;
          if (where.top && isMarker(l)) return null;
          if (where.quote && first && calloutOf(l)) return null;
          return l;
        }),
      ];
    case 'heading':
      return [
        writeLine(node, '#'.repeat(a.level) + a.sep, (l) => {
          const c = classifyLine(l);
          return c.t === 'heading' && c.level === a.level && c.sep === a.sep ? l.slice(c.at) : null;
        }),
      ];
    case 'listItem': {
      const p = itemPrefix(node.attrs);
      const marker = a.kind === 'ol' ? a.num + a.delim : a.kind === 'task' ? `${a.bullet}${a.gap}[${a.check}]` : a.bullet;
      return [
        writeLine(node, a.indent + marker + a.sep, (l) => {
          const c = classifyLine(l);
          if (c.t !== 'item' || c.kind !== a.kind || c.indent !== p.indent || c.sep !== p.sep) return null;
          return Object.entries(p.parts).every(([k, v]) => c[k as keyof typeof p.parts] === v) ? l.slice(c.at) : null;
        }),
      ];
    }
    case 'codeBlock': {
      const { open, close } = codeFences(node, last);
      const text = node.textContent;
      return [open, ...(close === null && !text ? [] : text.split('\n')), ...(close === null ? [] : [close])];
    }
    case 'horizontalRule':
      return [a.raw];
    case 'blockquote':
      return serializeBlocks(childrenOf(node), { top: false, quote: true }).split('\n').map((l) => '> ' + l);
    case 'callout': {
      const [title, ...body] = childrenOf(node);
      const head = writeLine(title, `[!${a.kind}]${a.fold}${a.sep}`, (l) => {
        const c = calloutOf(l);
        return c && c.kind === a.kind && c.fold === a.fold && c.sep === a.sep ? l.slice(c.at) : null;
      });
      return [head, ...(body.length ? serializeBlocks(body, { top: false, quote: false }).split('\n') : [])].map((l) => '> ' + l);
    }
    case 'media':
      return a.marker ? [a.marker] : [];
    default:
      return [serializeInline(node)];
  }
}

/** Blocks as lines of text, one stretch (no pictures in between). */
export function serializeBlocks(nodes: readonly PMNode[] | Fragment, where: Where = { top: false, quote: false }): string {
  const list = Array.isArray(nodes) ? nodes : childrenOf(nodes as Fragment);
  return list.flatMap((n, i) => blockLines(n, where, i === 0, i === list.length - 1)).join('\n');
}

/** Top-level blocks and pictures as a note's text: stretches of text joined by picture lines (as lib/body.ts does). */
function serializeTop(nodes: readonly PMNode[]): string {
  let out = '';
  let cur: PMNode[] = [];
  for (const n of nodes) {
    if (n.type.name !== 'media') {
      cur.push(n);
      continue;
    }
    out += serializeBlocks(cur, { top: true, quote: false }) + '\n' + (n.attrs.media ? mediaMarker(n.attrs.media) : '') + '\n';
    cur = [];
  }
  return out + serializeBlocks(cur, { top: true, quote: false });
}

/** The document as the note's text. */
export const serializeNote = (doc: PMNode): string => serializeTop(childrenOf(doc));

/**
 * A copied slice as text: the words alone when it's part of one line, else its lines in Markdown, pictures and all.
 */
export function serializeSlice(slice: Slice): string {
  const { content, openStart, openEnd } = slice;
  if (!content.childCount) return '';
  const first = content.firstChild!;
  if (first.isInline) return serializeInline(first.type.schema.nodes.paragraph.create(null, content));
  if (content.childCount === 1 && openStart === openEnd && openStart > 0) {
    let n = first;
    let d = 1;
    while (d < openStart && !n.isTextblock && n.childCount === 1) (n = n.firstChild!), d++;
    if (n.isTextblock && d === openStart) return serializeInline(n);
  }
  return serializeTop(childrenOf(content));
}

/* ---------- comparing ---------- */

/**
 * A key that's the same for two documents (or nodes) exactly when they read the same: same blocks with the same
 * written attributes, same characters and chips with the same styles. Escapes don't count.
 */
export function docKey(node: PMNode): string {
  if (node.isTextblock && !node.type.spec.code) {
    const units = unitsOf(childrenOf(node));
    return `${node.type.name}${JSON.stringify(writtenAttrs(node))}[${units.map(unitKey).join('\u0001')}]`;
  }
  if (node.type.name === 'codeBlock') return 'codeBlock' + JSON.stringify([writtenAttrs(node), node.textContent]);
  return `${node.type.name}${JSON.stringify(writtenAttrs(node))}(${childrenOf(node).map(docKey).join('\u0002')})`;
}

/** Whether two documents (or nodes) read the same (escapes aside). */
export const sameDoc = (a: PMNode, b: PMNode) => docKey(a) === docKey(b);
