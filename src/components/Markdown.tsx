import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { PersonMention, SongMention, WikiLink } from './mentions';
import { inline as pieces } from '../lib/inline';
import { t } from '../lib/i18n';
import { olMarker } from '../lib/noteDoc/syntax';

// Shows a note's Markdown formatted (see lib/markdown.ts for the syntax). Built from elements, never from HTML
// strings, so nothing written in a note can run as code.

type Align = 'center' | 'right' | 'justify' | null;
type Block =
  | { t: 'p'; lines: string[]; align: Align }
  | { t: 'h'; level: number; text: string; align: Align }
  | { t: 'li'; kind: 'ul' | 'ol' | 'task'; depth: number; marker: string; done: boolean; text: string; line: number }
  | { t: 'quote'; callout: string | null; title: string; body: string; line: number }
  | { t: 'code'; text: string }
  | { t: 'hr' }
  | { t: 'pagebreak' }
  | { t: 'fn'; label: string; text: string }
  | { t: 'gap' };

const HR = /^\s*([-*_])([ \t]*\1){2,}\s*$/;
const FENCE = /^\s*(```|~~~)/;
const HEAD = /^(#{1,6})[ \t]+(.*)$/;
const ITEM = /^([ \t]*)([-*+][ \t]+\[([ xX])\]|[-*+]|(\d{1,9})[.)])[ \t]+(.*)$/;
const QUOTE = /^[ \t]*>[ \t]?(.*)$/;
const PAGEBREAK = /^<div style="page-break-after: ?always;?"><\/div>$/;
const FOOTNOTE = /^\[\^([\w-]+)\]:[ \t]+(.*)$/;
const ALIGN = /(?:^| )<!-- align:(center|right|justify) -->$/;

/** A line's text without the alignment written at its end, and that alignment. */
const aligned = (s: string): [string, Align] => {
  const m = s.match(ALIGN);
  return m ? [s.slice(0, m.index), m[1] as Align] : [s, null];
};

const depthOf = (indent: string) => Math.min(6, [...indent].reduce((n, c) => n + (c === '\t' ? 2 : 1), 0) >> 1);

function parse(text: string, offset = 0): Block[] {
  const lines = text.split('\n');
  const out: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m: RegExpMatchArray | null;
    if (!l.trim()) {
      if (out.length && out[out.length - 1].t !== 'gap') out.push({ t: 'gap' });
    } else if (FENCE.test(l)) {
      const fence = l.trim().slice(0, 3);
      const body: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith(fence)) body.push(lines[i]);
      out.push({ t: 'code', text: body.join('\n') });
    } else if (HR.test(l)) out.push({ t: 'hr' });
    else if ((m = l.match(HEAD))) {
      const [text, align] = aligned(m[2]);
      out.push({ t: 'h', level: m[1].length, text, align });
    }
    else if ((m = l.match(ITEM))) {
      const kind = m[3] !== undefined ? 'task' : m[4] ? 'ol' : 'ul';
      out.push({ t: 'li', kind, depth: depthOf(m[1]), marker: m[4] ? olMarker(m[4], depthOf(m[1])) : '', done: m[3] === 'x' || m[3] === 'X', text: m[5], line: offset + i });
    } else if ((m = l.match(QUOTE))) {
      const start = i;
      const body = [m[1]];
      while (i + 1 < lines.length && (m = lines[i + 1].match(QUOTE))) (body.push(m[1]), i++);
      const c = body[0].match(/^\[!([\w-]+)\][+-]?[ \t]*(.*)$/);
      out.push({
        t: 'quote',
        callout: c ? c[1].toLowerCase() : null,
        title: c ? c[2] || c[1][0].toUpperCase() + c[1].slice(1).toLowerCase() : '',
        body: (c ? body.slice(1) : body).join('\n'),
        line: offset + start + (c ? 1 : 0),
      });
    } else if (PAGEBREAK.test(l)) out.push({ t: 'pagebreak' });
    else if ((m = l.match(FOOTNOTE))) out.push({ t: 'fn', label: m[1], text: m[2] });
    else {
      // lines run together into a paragraph, while they're aligned alike
      const [text, align] = aligned(l);
      const last = out[out.length - 1];
      if (last?.t === 'p' && last.align === align) last.lines.push(text);
      else out.push({ t: 'p', lines: [text], align });
    }
  }
  if (out[out.length - 1]?.t === 'gap') out.pop();
  return out;
}

/* ---------- inline ---------- */

/** A link's address that opens: the web or e-mail, never script. */
const SAFE = /^(https?:\/\/|mailto:)\S/;

/** A note's footnotes: their numbers by label (by where each is first referred to), and the labels that have a text. */
export interface Footnotes {
  num: Map<string, number>;
  defined: Set<string>;
}

/** The footnotes in a note's text, numbered by where each is first referred to (as the editor numbers them). */
export function footnotesOf(text: string): Footnotes {
  const num = new Map<string, number>();
  const defined = new Set<string>();
  const walk = (s: string) => {
    for (const p of pieces(s)) {
      if (p.t === 'fn') {
        if (!num.has(p.s)) num.set(p.s, num.size + 1);
      } else if (/^(b|i|s|hl|u|sup|sub|color|link)$/.test(p.t)) walk((p as { s: string }).s);
    }
  };
  const blocks = (bs: Block[]) => {
    for (const b of bs) {
      if (b.t === 'p') b.lines.forEach(walk);
      else if (b.t === 'h' || b.t === 'li') walk(b.text);
      else if (b.t === 'fn') (defined.add(b.label), walk(b.text));
      else if (b.t === 'quote') {
        if (b.callout) walk(b.title);
        blocks(parse(b.body));
      }
    }
  };
  blocks(parse(text));
  return { num, defined };
}

/** Goes to the footnote (or back to where it's referred to) in the note around `from`. */
function goTo(e: MouseEvent, sel: string) {
  e.preventDefault();
  const from = e.currentTarget as Element;
  const el = (from.closest('.note-body') ?? from.closest('.md'))?.querySelector<HTMLElement>(sel);
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
}

// The same inline syntax the editor styles as it's written (lib/inline.ts).
function inline(text: string, fn?: Footnotes): ComponentChildren[] {
  return pieces(text).map((p) => {
    switch (p.t) {
      case 'text': case 'esc': return p.s;
      case 'code': return <code>{p.s}</code>;
      case 'wiki': return <WikiLink target={p.target} text={p.s} />;
      case 'person': return <PersonMention target={p.target} text={p.s} />;
      case 'song': return <SongMention target={p.target} text={p.s} />;
      case 'link': return SAFE.test(p.url) ? <a href={p.url} target="_blank" rel="noopener noreferrer">{inline(p.s, fn)}</a> : <span>{inline(p.s, fn)}</span>;
      case 'b': return <strong>{inline(p.s, fn)}</strong>;
      case 's': return <s>{inline(p.s, fn)}</s>;
      case 'hl': return <mark data-hl={p.color ?? undefined}>{inline(p.s, fn)}</mark>;
      case 'u': return <u>{inline(p.s, fn)}</u>;
      case 'sup': return <sup>{inline(p.s, fn)}</sup>;
      case 'sub': return <sub>{inline(p.s, fn)}</sub>;
      case 'color': return <span data-color={p.color}>{inline(p.s, fn)}</span>;
      case 'i': return <em>{inline(p.s, fn)}</em>;
      case 'empty': return p.s;
      case 'bare': return <a href={p.s} target="_blank" rel="noopener noreferrer">{p.s}</a>;
      case 'tag': return <span class="md-tag">{p.s}</span>;
      case 'fn': {
        const n = fn?.num.get(p.s);
        return (
          <sup class={`md-fn-ref${fn?.defined.has(p.s) ? '' : ' is-missing'}`} data-fn={p.s}>
            <a href={`#fn-${p.s}`} onClick={(e) => goTo(e, `.md-fn[data-fn="${p.s}"]`)}>{n ?? p.s}</a>
          </sup>
        );
      }
    }
  });
}

/* ---------- blocks ---------- */

const CALLOUT_ICON: Record<string, string> = {
  note: '✎', info: 'ℹ', tip: '✦', hint: '✦', important: '✦', success: '✓', check: '✓', done: '✓', question: '?', help: '?',
  warning: '!', caution: '!', attention: '!', danger: '⚡', error: '⚡', bug: '⚠', example: '≡', quote: '❝', cite: '❝', abstract: '≡', summary: '≡', todo: '☐',
};
const calloutTone = (c: string) =>
  /^(success|check|done)$/.test(c) ? 'good' : /^(warning|caution|attention)$/.test(c) ? 'warn' : /^(danger|error|bug|failure|fail|missing)$/.test(c) ? 'bad' : /^(tip|hint|important)$/.test(c) ? 'tip' : 'info';

/** A footnote's text: its number (a click goes back to where it's referred to), then its words. One not referred to is faded. */
function Footnote({ b, fn }: { b: Extract<Block, { t: 'fn' }>; fn: Footnotes }) {
  const n = fn.num.get(b.label);
  return (
    <div class={`md-fn${n ? '' : ' is-orphan'}`} data-fn={b.label}>
      {n ? (
        <a class="md-fn-num" href={`#fnref-${b.label}`} title={t('Back to the text')} onClick={(e) => goTo(e, `.md-fn-ref[data-fn="${b.label}"]`)}>{n}</a>
      ) : (
        <span class="md-fn-num" title={t('Not referred to in the text')}>{b.label}</span>
      )}
      <div class="md-fn-text">{inline(b.text, fn)}</div>
    </div>
  );
}

function Blocks({ blocks, onTask, fn }: { blocks: Block[]; onTask?: (line: number) => void; fn: Footnotes }) {
  return (
    <>
      {blocks.map((b) => {
        switch (b.t) {
          case 'gap':
            return <div class="md-gap" />;
          case 'hr':
            return <hr />;
          case 'pagebreak':
            return <div class="md-pagebreak" role="separator" aria-label={t('Page break')} />;
          case 'fn':
            return <Footnote b={b} fn={fn} />;
          case 'code':
            return <pre><code>{b.text}</code></pre>;
          case 'h': {
            const H = `h${Math.min(b.level + 1, 6)}` as 'h2';
            return <H class={`md-h md-h${b.level}`} style={b.align ? { textAlign: b.align } : undefined}>{inline(b.text, fn)}</H>;
          }
          case 'p':
            return <p style={b.align ? { textAlign: b.align } : undefined}>{b.lines.map((l, i) => <>{i > 0 && <br />}{inline(l, fn)}</>)}</p>;
          case 'li':
            return (
              // the bullet or number is drawn in the margin from data-marker, as in the editor (notes.css)
              <div
                class={`md-li md-${b.kind}${b.done ? ' is-done' : ''}`}
                data-marker={b.kind === 'task' ? undefined : b.kind === 'ol' ? b.marker : '•'}
                style={b.depth ? { '--depth': b.depth } : undefined}
              >
                {b.kind === 'task' ? (
                  <>
                    <input
                      type="checkbox"
                      checked={b.done}
                      disabled={!onTask}
                      onClick={(e) => { e.stopPropagation(); onTask?.(b.line); }}
                      aria-label={b.done ? t('Done') : t('To do')}
                    />
                    <div class="md-li-text">{inline(b.text, fn)}</div>
                  </>
                ) : inline(b.text, fn)}
              </div>
            );
          case 'quote':
            return b.callout ? (
              <div class={`md-callout tone-${calloutTone(b.callout)}`}>
                <div class="md-callout-title"><span aria-hidden="true">{CALLOUT_ICON[b.callout] ?? '✎'}</span> {inline(b.title, fn)}</div>
                {b.body.trim() && <Blocks blocks={parse(b.body, b.line)} onTask={onTask} fn={fn} />}
              </div>
            ) : (
              <blockquote><Blocks blocks={parse(b.body, b.line)} onTask={onTask} fn={fn} /></blockquote>
            );
        }
      })}
    </>
  );
}

/**
 * A stretch of note text, formatted. Tasks can be ticked when `onTask` is given (with the line's number). Footnotes'
 * texts go together at the end, in the order of their numbers; `footnotes` numbers them from the whole note when this
 * is only a stretch of it (a public note's page draws the words between its pictures each on their own).
 */
export function Markdown({ text, onTask, class: cls, footnotes }: { text: string; onTask?: (line: number) => void; class?: string; footnotes?: Footnotes }) {
  const blocks = useMemo(() => parse(text), [text]); // parsed once per text, not on every render of what holds it
  const own = useMemo(() => (footnotes ? null : footnotesOf(text)), [text, footnotes]);
  const fn = footnotes ?? own!;
  const notes = blocks.filter((b): b is Extract<Block, { t: 'fn' }> => b.t === 'fn');
  let main = notes.length ? blocks.filter((b) => b.t !== 'fn') : blocks;
  // no blank line left before the footnotes, nor two together where one was taken out from between them
  if (notes.length) main = main.filter((b, i) => b.t !== 'gap' || (i > 0 && i < main.length - 1 && main[i - 1].t !== 'gap'));
  const order = (b: { label: string }) => fn.num.get(b.label) ?? Infinity;
  return (
    <div class={`md${cls ? ' ' + cls : ''}`}>
      <Blocks blocks={main} onTask={onTask} fn={fn} />
      {notes.length > 0 && (
        <section class="md-footnotes" aria-label={t('Footnotes')}>
          {[...notes].sort((a, b) => order(a) - order(b)).map((b) => <Footnote b={b} fn={fn} />)}
        </section>
      )}
    </div>
  );
}
