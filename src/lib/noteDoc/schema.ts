// The note as a ProseMirror document: one block per line of its text, the same blocks the reading view shows.
// This is the schema only (no views, input rules or keys), so it loads in Node too: nothing here touches the DOM
// until a node is drawn. The editor (src/editor) adds its behaviour as plugins and node views.
//
// Every attribute keeps what was written (the number `01`, the spaces after a `#`, a fence's info string), so a
// note reads back to exactly its text. Each node also round-trips through HTML with data-* attributes (copy and
// paste between notes), and the usual tags read from other apps' HTML (Word, Google Docs, web pages).
import { Schema, type DOMOutputSpec, type MarkSpec, type Node as PMNode, type NodeSpec, type ParseRule, type TagParseRule } from '@tiptap/pm/model';
import { parseBody, mediaMarker, type Media } from '../body';
import { SAFE, calloutIcon, calloutTone, depthOf, type ListKind } from './syntax';

/* ---------- attribute types, by node and mark ---------- */

export interface HeadingAttrs {
  /** 1–6, the number of #s */
  level: number;
  /** spaces and tabs after the #s, as written */
  sep: string;
}
export interface ListItemAttrs {
  kind: ListKind;
  indent: string;
  bullet: string;
  num: string;
  delim: string;
  /** whether a task is done; `check` is how its box is written, and follows this when they disagree */
  checked: boolean;
  check: string;
  gap: string;
  sep: string;
}
export interface CodeBlockAttrs {
  /** the opening line as written, ``` or ~~~ with what follows it */
  open: string;
  /** the closing line as written; null when the block runs to the end without one */
  close: string | null;
}
export interface CalloutAttrs {
  /** as written (any case), `note` in > [!note] */
  kind: string;
  /** `+` or `-` (Obsidian's folding), or '' */
  fold: string;
  /** spaces and tabs between [!kind] and the title */
  sep: string;
}
export interface HorizontalRuleAttrs { raw: string }
export interface MediaAttrs { media: Media }
/** person, song and wiki chips: what they point at (null when only a name is written) and what they show */
export interface AtomAttrs { target: string | null; label: string }
export interface CodeMarkAttrs { tick: string }
export interface LinkAttrs {
  href: string;
  /** written as the address alone (https://…), not as [text](address) */
  bare: boolean;
}

/** The styling marks, from outermost to innermost as the serializer writes them. */
export const STYLE_MARKS = ['link', 'strike', 'highlight', 'bold', 'italic', 'code'] as const;
/** The marks a chip can carry. */
export const ATOM_MARKS = 'bold italic strike highlight';

/* ---------- attributes kept in data-* ---------- */

/** An attribute: its default, how it's read from HTML (null: not there) and how it's written to HTML. */
interface Attr {
  default: unknown;
  parse: (el: HTMLElement) => unknown;
  render: (attrs: Record<string, any>) => Record<string, string> | null;
}
type Attrs = Record<string, Attr>;

/**
 * An attribute kept as `data-<name>` in HTML. Missing in the HTML, it's left to the parse rule's own attributes
 * (only values that aren't null override them), so rules can read other apps' HTML.
 */
function data(name: string, def: unknown, read: (v: string) => unknown = (v) => v): Attr {
  return {
    default: def,
    parse: (el) => {
      const v = el.getAttribute('data-' + name);
      return v === null ? null : read(v);
    },
    render: (a) => (a[name] === null || a[name] === undefined ? null : { ['data-' + name]: String(a[name]) }),
  };
}

/** HTML attributes put together: classes and styles add up, the rest the last one wins. */
function merge(...all: (Record<string, string> | null | undefined | false)[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of all) {
    if (!a) continue;
    for (const [k, v] of Object.entries(a)) {
      if (v === undefined || v === null) continue;
      if (k === 'class' && out.class) out.class = `${out.class} ${v}`;
      else if (k === 'style' && out.style) out.style = `${out.style}; ${v}`;
      else out[k] = v;
    }
  }
  return out;
}

/** The HTML attributes of a node's or mark's own attributes. */
const rendered = (defs: Attrs, attrs: Record<string, any>) => merge(...Object.values(defs).map((d) => d.render(attrs)));

/** The schema's attribute specs: their defaults. */
const specs = (defs: Attrs) => Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, { default: d.default }]));

/**
 * Parse rules that read the attributes too: what the rule gives (false: no match), then each attribute that's in
 * the HTML over it. Style rules are as they are.
 */
function rules(defs: Attrs, list: ParseRule[]): ParseRule[] {
  return list.map((rule) => {
    if (!('tag' in rule) || !rule.tag) return rule;
    const r = rule as TagParseRule;
    return {
      ...r,
      getAttrs: (el: HTMLElement) => {
        const base = r.getAttrs ? r.getAttrs(el) : r.attrs;
        if (base === false) return false;
        const own: Record<string, unknown> = {};
        for (const [k, d] of Object.entries(defs)) {
          const v = d.parse(el);
          if (v !== null && v !== undefined) own[k] = v;
        }
        return { ...(base ?? {}), ...own };
      },
    };
  });
}

/** A node: its spec, with attributes read from and written to HTML. `render` gets the HTML attributes. */
function node(spec: Omit<NodeSpec, 'attrs' | 'parseDOM' | 'toDOM'> & {
  attrs?: Attrs;
  parse?: ParseRule[];
  render?: (n: PMNode, html: Record<string, string>) => DOMOutputSpec;
}): NodeSpec {
  const { attrs = {}, parse = [], render, ...rest } = spec;
  return {
    ...rest,
    attrs: specs(attrs),
    parseDOM: rules(attrs, parse) as TagParseRule[],
    ...(render && { toDOM: (n: PMNode) => render(n, rendered(attrs, n.attrs)) }),
  };
}

/** The element's tag level (h1 → 1), or the one in data-level. */
const levelOf = (el: HTMLElement) => {
  const d = Number(el.getAttribute('data-level'));
  return d >= 1 && d <= 6 ? d : Number(el.tagName.slice(1)) || 1;
};

/* ---------- nodes ---------- */

/** A list item's class, and the bullet or number its margin shows (CSS draws data-marker; a task shows its box). */
export function listItemLook(a: ListItemAttrs): { class: string; 'data-marker'?: string } {
  const look = { class: `md-li md-${a.kind}${a.kind === 'task' && a.checked ? ' is-done' : ''}` };
  return a.kind === 'task' ? look : { ...look, 'data-marker': a.kind === 'ol' ? a.num + '.' : '•' };
}

/** The text a chip is written as: @[person:id|Name], ♪[song:id|Title], [[note:id|Title]]. */
export function atomToken(type: string, a: AtomAttrs): string {
  const t = a.target || null;
  if (type === 'person') return `@[${t ? 'person:' + t + '|' : ''}${a.label}]`;
  if (type === 'song') return `♪[${t ? 'song:' + t + '|' : ''}${a.label}]`;
  return `[[${t ? t + '|' : ''}${a.label}]]`;
}

/** A tag in the text: a person, a song, or a [[link]] to a note or a book. One character to the caret. */
const chip = (name: 'person' | 'song' | 'wiki') =>
  node({
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,
    marks: ATOM_MARKS,
    attrs: { target: data('target', null), label: data('label', '') },
    parse: [{ tag: `span[data-chip="${name}"]` }],
    render: (n, html) => ['span', merge(html, { 'data-chip': name, class: 'chip' }), n.attrs.label],
    leafText: (n: PMNode) => atomToken(name, n.attrs as AtomAttrs),
  });

const nodes: Record<string, NodeSpec> = {
  doc: { content: '(flow | media)+' },

  /** One line of text. A blank line is an empty paragraph (or one holding only the spaces written there). */
  paragraph: node({
    group: 'flow',
    content: 'inline*',
    parse: [{ tag: 'p' }],
    render: (_, html) => ['p', html, 0],
  }),

  /** `# Title`. Level 1 shows as h2 (the page's h1 is the note's title), as in the reading view. */
  heading: node({
    group: 'flow',
    content: 'inline*',
    defining: true,
    attrs: {
      level: { default: 1, parse: () => null, render: (a) => ({ 'data-level': String(a.level) }) },
      sep: data('sep', ' '),
    },
    parse: [1, 2, 3, 4, 5, 6].map((n) => ({ tag: 'h' + n, getAttrs: (el: HTMLElement) => ({ level: levelOf(el) }) })),
    render: (n, html) => ['h' + Math.min(n.attrs.level + 1, 6), merge(html, { class: `md-h md-h${n.attrs.level}` }), 0],
  }),

  /**
   * A list item: a bullet, a number or a task, one line each (lists are flat, as in the text). How deep it sits
   * comes from its indent. `p[data-li]` is what pasted lists are flattened to (src/editor/paste.ts).
   *
   * It's drawn as one plain block of words, like a paragraph: the bullet or number is CSS in its left margin (from
   * data-marker), never an element beside the words. A phone's editing can't type around, delete or squeeze a marker
   * that isn't there, and the words always get the line's whole width. Only a task has an element of its own, its
   * box, set apart from its words (.md-li-text).
   */
  listItem: node({
    group: 'flow',
    content: 'inline*',
    defining: true,
    attrs: {
      kind: data('kind', 'ul'),
      indent: data('indent', ''),
      bullet: data('bullet', '-'),
      num: data('num', '1'),
      delim: data('delim', '.'),
      checked: data('checked', false, (v) => v === 'true'),
      check: data('check', ' '),
      gap: data('gap', ' '),
      sep: data('sep', ' '),
    },
    parse: [
      // A task's words (and, in older copies, every item's) sit in .md-li-text beside the box or marker. Copied from
      // the reading view (components/Markdown.tsx), a line has no data-*: what it is comes from how it's drawn.
      {
        tag: 'div.md-li',
        contentElement: (el: HTMLElement) => el.querySelector<HTMLElement>(':scope > .md-li-text') ?? el,
        getAttrs: (el: HTMLElement) => {
          const kind = el.classList.contains('md-ol') ? 'ol' : el.classList.contains('md-task') ? 'task' : 'ul';
          const depth = Number(/--depth:\s*(\d+)/.exec(el.getAttribute('style') ?? '')?.[1]) || 0;
          const num = /^(\d+)/.exec(el.getAttribute('data-marker') ?? '')?.[1];
          return {
            kind,
            indent: '\t'.repeat(Math.min(6, depth)),
            ...(kind === 'ol' && num && { num }),
            ...(kind === 'task' && el.classList.contains('is-done') && { checked: true, check: 'x' }),
          };
        },
      },
      {
        tag: 'p[data-li]',
        priority: 60, // before a plain paragraph's rule
        getAttrs: (el: HTMLElement) => {
          const kind = el.getAttribute('data-li');
          const depth = Number(el.getAttribute('data-depth')) || 0;
          return {
            kind: kind === 'ol' || kind === 'task' ? kind : 'ul',
            indent: '\t'.repeat(Math.min(6, Math.max(0, depth))),
            ...(el.getAttribute('data-checked') === 'true' && { checked: true, check: 'x' }),
          };
        },
      },
    ],
    render: (n, html) => {
      const a = n.attrs as ListItemAttrs;
      const depth = depthOf(a.indent);
      const attrs = merge(html, listItemLook(a), depth > 0 && { style: `--depth: ${depth}` });
      if (a.kind !== 'task') return ['div', attrs, 0];
      return ['div', attrs, ['input', { type: 'checkbox', contenteditable: 'false', ...(a.checked && { checked: '' }) }], ['div', { class: 'md-li-text' }, 0]];
    },
  }),

  /** A fenced code block: its lines as they are, never styled. */
  codeBlock: node({
    group: 'flow',
    content: 'text*',
    marks: '',
    code: true,
    defining: true,
    attrs: {
      open: data('open', '```'),
      close: {
        default: '```',
        parse: (el) => (el.hasAttribute('data-unclosed') ? null : el.getAttribute('data-close')),
        render: (a): Record<string, string> => (a.close === null ? { 'data-unclosed': '' } : { 'data-close': String(a.close) }),
      },
    },
    parse: [{ tag: 'pre', preserveWhitespace: 'full', getAttrs: (el: HTMLElement) => (el.hasAttribute('data-unclosed') ? { close: null } : {}) }],
    render: (_, html) => ['pre', html, ['code', 0]],
  }),

  /** Lines that start with `>`. */
  blockquote: node({
    group: 'flow',
    content: 'flow+',
    defining: true,
    parse: [{ tag: 'blockquote' }],
    render: (_, html) => ['blockquote', html, 0],
  }),

  /** A quote whose first line is `> [!kind] Title`: a coloured box with an icon. */
  callout: node({
    group: 'flow',
    content: 'calloutTitle flow*',
    defining: true,
    attrs: { kind: data('kind', 'note'), fold: data('fold', ''), sep: data('sep', ' ') },
    parse: [{ tag: 'div.md-callout', priority: 60 }],
    render: (n, html) => {
      const icon = calloutIcon(n.attrs.kind);
      // the icon goes in the title's ::before, from the inherited --icon
      return ['div', merge(html, { class: `md-callout tone-${calloutTone(n.attrs.kind)}`, 'data-icon': icon, style: `--icon: "${icon}"` }), 0];
    },
  }),

  /** A callout's first line: its title. */
  calloutTitle: node({
    content: 'inline*',
    defining: true,
    parse: [{ tag: 'div.md-callout-title' }],
    render: (_, html) => ['div', merge(html, { class: 'md-callout-title' }), 0],
  }),

  horizontalRule: node({
    group: 'flow',
    atom: true,
    attrs: { raw: data('raw', '---') },
    parse: [{ tag: 'hr' }],
    render: (_, html) => ['hr', html],
  }),

  /** A picture or album (lib/body.ts): its own line at the top level, never inside a quote. */
  media: node({
    atom: true,
    selectable: false,
    draggable: false,
    attrs: {
      media: {
        default: null,
        parse: (el) => parseBody(el.getAttribute('data-media') ?? '').media[0] ?? null,
        render: (a) => (a.media ? { 'data-media': mediaMarker(a.media) } : null),
      },
    },
    parse: [{ tag: 'div[data-media]' }],
    render: (_, html) => ['div', merge(html, { class: 'media-node' })],
  }),

  person: chip('person'),
  song: chip('song'),
  wiki: chip('wiki'),

  text: { group: 'inline' },
};

/* ---------- marks ---------- */

const notWhite = (v: string) => !/^(white|#fff(fff)?|transparent|none|inherit|initial|rgba?\(\s*255,\s*255,\s*255\s*(,\s*1\s*)?\)|rgba\(\s*0,\s*0,\s*0,\s*0\s*\))$/i.test(v.trim());

/** A mark: its spec, with attributes read from and written to HTML. */
function mark(spec: Omit<MarkSpec, 'attrs' | 'parseDOM' | 'toDOM'> & {
  attrs?: Attrs;
  parse?: ParseRule[];
  render: (m: { attrs: Record<string, any> }, html: Record<string, string>) => DOMOutputSpec;
}): MarkSpec {
  const { attrs = {}, parse = [], render, ...rest } = spec;
  return { ...rest, attrs: specs(attrs), parseDOM: rules(attrs, parse), toDOM: (m) => render(m, rendered(attrs, m.attrs)) };
}

// in this order: the outermost first (a link holds the styles, code is innermost), as the serializer writes them
const marks: Record<string, MarkSpec> = {
  /** [text](address), or an address written as it is (`bare`). Opens only web and e-mail addresses. */
  link: mark({
    inclusive: false,
    attrs: {
      href: { default: '', parse: (el) => el.getAttribute('href') ?? el.getAttribute('data-href'), render: () => null },
      bare: data('bare', false, (v) => v === 'true'),
    },
    parse: [{ tag: 'a[href]' }, { tag: 'span[data-href]' }],
    render: (m, html) =>
      SAFE.test(m.attrs.href)
        ? ['a', merge(html, { href: m.attrs.href, target: '_blank', rel: 'noopener noreferrer' }), 0]
        : ['span', merge(html, { 'data-href': m.attrs.href }), 0],
  }),

  strike: mark({
    parse: [
      { tag: 's' }, { tag: 'del' }, { tag: 'strike' },
      { style: 'text-decoration', getAttrs: (v: string) => v.includes('line-through') && null },
      { style: 'text-decoration-line', getAttrs: (v: string) => v.includes('line-through') && null },
    ],
    render: () => ['s', 0],
  }),

  highlight: mark({
    parse: [
      { tag: 'mark' },
      { style: 'background-color', getAttrs: (v: string) => notWhite(v) && null },
      { style: 'background', getAttrs: (v: string) => notWhite(v) && null },
      { style: 'mso-highlight', getAttrs: (v: string) => notWhite(v) && null },
    ],
    render: () => ['mark', 0],
  }),

  bold: mark({
    parse: [
      { tag: 'strong' },
      // Google Docs wraps everything in <b style="font-weight:normal">
      { tag: 'b', getAttrs: (el: HTMLElement) => el.style.fontWeight !== 'normal' && null },
      { style: 'font-weight', getAttrs: (v: string) => /^(bold(er)?|[6-9]\d{2,})$/.test(v) && null },
    ],
    render: () => ['strong', 0],
  }),

  italic: mark({
    parse: [
      { tag: 'em' },
      { tag: 'i', getAttrs: (el: HTMLElement) => el.style.fontStyle !== 'normal' && null },
      { style: 'font-style=italic' },
    ],
    render: () => ['em', 0],
  }),

  /** `code`, with the backticks it's written with. Keeps out escapes (its text is as written). */
  code: mark({
    code: true,
    excludes: 'escaped',
    attrs: { tick: data('tick', '`') },
    parse: [{ tag: 'code' }],
    render: (_, html) => ['code', html, 0],
  }),

  /** A character written with a backslash before it (\*), so it's kept as written. */
  escaped: mark({
    inclusive: false,
    parse: [{ tag: 'span[data-esc]' }],
    render: () => ['span', { 'data-esc': '' }, 0],
  }),
};

let cached: Schema | null = null;
/** The note schema (made once). Nodes made with it can't go into an editor with another schema instance. */
export const noteSchema = (): Schema => (cached ??= new Schema({ nodes, marks, topNode: 'doc' }));
