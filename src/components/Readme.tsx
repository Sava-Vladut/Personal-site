import type { ComponentChildren } from 'preact';

// Shows a repo's README, which is GitHub Markdown (with a little HTML mixed in). Like the note renderer
// (components/Markdown.tsx) it builds elements and never HTML strings, so nothing in a README can run as code.
// Notes' own syntax (@people, [[books]], #tags) doesn't apply here, so this is a separate, smaller reader.

/** Where relative links and pictures point: the repo's files on GitHub. A private repo's pictures can't be fetched without its token, so those are left out. */
export interface ReadmeBase { repo: string; branch: string; private: boolean }

type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; level: number; text: string }
  | { t: 'li'; ordered: boolean; marker: string; depth: number; done: boolean | null; text: string }
  | { t: 'quote'; text: string }
  | { t: 'code'; lang: string; text: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'hr' };

const FENCE = /^\s*(```+|~~~+)\s*([\w+#.-]*)/;
const HEAD = /^\s{0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const HR = /^\s{0,3}([-*_])([ \t]*\1){2,}\s*$/;
const ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(?:\[([ xX])\][ \t]+)?(.*)$/;
const QUOTE = /^\s{0,3}>[ \t]?(.*)$/;
const DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** The HTML READMEs lean on, turned into the Markdown it stands for; any other tag is dropped. */
function tidy(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
      return src ? `![${alt}](${src})` : '';
    })
    .replace(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => `[${inner.trim() || href}](${href})`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|summary|details|li|tr)>/gi, '\n')
    .replace(/<\/?[a-z][^>\n]*>/gi, '');
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

function parse(text: string): Block[] {
  const lines = tidy(text).split('\n');
  const out: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m: RegExpMatchArray | null;
    if (!l.trim()) {
      out.push({ t: 'p', text: '' }); // a gap: the next line starts a new paragraph
    } else if ((m = l.match(FENCE))) {
      const body: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith(m[1].slice(0, 3))) body.push(lines[i]);
      out.push({ t: 'code', lang: m[2], text: body.join('\n') });
    } else if (HR.test(l)) out.push({ t: 'hr' });
    else if ((m = l.match(HEAD))) out.push({ t: 'h', level: m[1].length, text: m[2] });
    else if (l.includes('|') && i + 1 < lines.length && DIVIDER.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = cells(l);
      const rows: string[][] = [];
      i++;
      while (i + 1 < lines.length && lines[i + 1].trim() && lines[i + 1].includes('|')) rows.push(cells(lines[++i]));
      out.push({ t: 'table', head, rows });
    } else if ((m = l.match(ITEM))) {
      const indent = [...m[1]].reduce((n, c) => n + (c === '\t' ? 4 : 1), 0);
      out.push({ t: 'li', ordered: /\d/.test(m[2]), marker: m[2].replace(/\D/g, '') + '.', depth: Math.min(5, indent >> 1), done: m[3] === undefined ? null : m[3] !== ' ', text: m[4] });
    } else if ((m = l.match(QUOTE))) {
      const last = out[out.length - 1];
      if (last?.t === 'quote') last.text += '\n' + m[1];
      else out.push({ t: 'quote', text: m[1] });
    } else {
      const last = out[out.length - 1];
      if (last?.t === 'li' && /^\s/.test(l)) last.text += ' ' + l.trim(); // a list item running onto the next line
      else if (last?.t === 'p' && last.text) last.text += '\n' + l.trim();
      else if (last?.t === 'p') last.text = l.trim();
      else out.push({ t: 'p', text: l.trim() });
    }
  }
  return out.filter((b) => b.t !== 'p' || b.text);
}

/* ---------- inline ---------- */

const INLINE = new RegExp(
  [
    /(`+)([^`\n]+?)\1/.source, //                                                                1, 2 code
    /!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.source, //                                      3, 4 picture
    /\[((?:[^[\]\n]|!\[[^\]\n]*\]\([^)\s]*\))+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.source, //          5, 6 link (its text may hold a picture, like a badge)
    /\*\*(\S(?:[^\n]*?\S)?)\*\*|__(\S(?:[^\n]*?\S)?)__/.source, //                                 7, 8 bold
    /~~(\S(?:[^\n]*?\S)?)~~/.source, //                                                           9 strike
    /(?<![\w*])\*(\S(?:[^*\n]*?\S)?)\*(?![\w*])|(?<![\w_])_(\S(?:[^_\n]*?\S)?)_(?![\w_])/.source, // 10, 11 italic
    /(https?:\/\/[^\s<>]*[^\s<>.,:;"'!?)\]])/.source, //                                          12 bare address
  ].join('|'),
  'gu',
);

/** An address a README link or picture may use, resolved against the repo's files; null when it can't be used. */
function resolve(raw: string, base: ReadmeBase, picture: boolean): string | null {
  const u = raw.trim();
  if (!u || u.startsWith('#')) return null;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) {
      const url = new URL(u);
      if (picture) return url.protocol === 'https:' ? url.href : null;
      return /^(https?:|mailto:)$/.test(url.protocol) ? url.href : null;
    }
    if (picture && base.private) return null;
    const path = u.replace(/^\.?\//, '');
    const root = picture ? `https://raw.githubusercontent.com/${base.repo}/${base.branch}/` : `https://github.com/${base.repo}/blob/${base.branch}/`;
    return new URL(path, root).href;
  } catch {
    return null;
  }
}

function inline(text: string, base: ReadmeBase): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index!;
    if (i > at) out.push(text.slice(at, i));
    at = i + m[0].length;
    if (m[2] !== undefined) out.push(<code>{m[2]}</code>);
    else if (m[4] !== undefined) {
      const src = resolve(m[4], base, true);
      out.push(src ? <img class="rd-img" src={src} alt={m[3]} loading="lazy" referrerpolicy="no-referrer" /> : m[3] ? <span class="rd-alt">{m[3]}</span> : null);
    } else if (m[6] !== undefined) {
      const href = resolve(m[6], base, false);
      const inner = inline(m[5], base);
      out.push(href ? <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a> : <>{inner}</>);
    } else if (m[7] !== undefined || m[8] !== undefined) out.push(<strong>{inline(m[7] ?? m[8], base)}</strong>);
    else if (m[9] !== undefined) out.push(<s>{inline(m[9], base)}</s>);
    else if (m[10] !== undefined || m[11] !== undefined) out.push(<em>{inline(m[10] ?? m[11], base)}</em>);
    else if (m[12] !== undefined) out.push(<a href={m[12]} target="_blank" rel="noopener noreferrer">{m[12]}</a>);
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

const lines = (text: string, base: ReadmeBase) => text.split('\n').map((l, i) => <>{i > 0 && <br />}{inline(l, base)}</>);

/** A README, formatted. */
export function Readme({ text, base }: { text: string; base: ReadmeBase }) {
  return (
    <div class="rd">
      {parse(text.slice(0, 80_000)).map((b) => {
        switch (b.t) {
          case 'hr': return <hr />;
          case 'p': return <p>{lines(b.text, base)}</p>;
          case 'h': {
            const H = `h${Math.min(b.level + 1, 6)}` as 'h2';
            return <H class={`rd-h rd-h${b.level}`}>{inline(b.text, base)}</H>;
          }
          case 'code': return <pre class="rd-code" data-lang={b.lang || undefined}><code>{b.text}</code></pre>;
          case 'quote': return <blockquote>{lines(b.text, base)}</blockquote>;
          case 'li':
            return (
              <div class={`rd-li${b.done ? ' is-done' : ''}`} style={b.depth ? { '--depth': b.depth } : undefined}>
                <span class="rd-marker" aria-hidden="true">{b.done !== null ? (b.done ? '☑' : '☐') : b.ordered ? b.marker : '•'}</span>
                <span>{inline(b.text, base)}</span>
              </div>
            );
          case 'table':
            return (
              <div class="rd-table">
                <table>
                  <thead><tr>{b.head.map((c) => <th>{inline(c, base)}</th>)}</tr></thead>
                  <tbody>{b.rows.map((r) => <tr>{b.head.map((_, i) => <td>{inline(r[i] ?? '', base)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
