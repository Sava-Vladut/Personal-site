import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { PersonMention, SongMention, WikiLink } from './mentions';
import { inline as pieces } from '../lib/inline';
import { t } from '../lib/i18n';
import { olMarker } from '../lib/noteDoc/syntax';

// Shows a note's Markdown formatted (see lib/markdown.ts for the syntax). Built from elements, never from HTML
// strings, so nothing written in a note can run as code.

type Block =
  | { t: 'p'; lines: string[] }
  | { t: 'h'; level: number; text: string }
  | { t: 'li'; kind: 'ul' | 'ol' | 'task'; depth: number; marker: string; done: boolean; text: string; line: number }
  | { t: 'quote'; callout: string | null; title: string; body: string; line: number }
  | { t: 'code'; text: string }
  | { t: 'hr' }
  | { t: 'gap' };

const HR = /^\s*([-*_])([ \t]*\1){2,}\s*$/;
const FENCE = /^\s*(```|~~~)/;
const HEAD = /^(#{1,6})[ \t]+(.*)$/;
const ITEM = /^([ \t]*)([-*+][ \t]+\[([ xX])\]|[-*+]|(\d{1,9})[.)])[ \t]+(.*)$/;
const QUOTE = /^[ \t]*>[ \t]?(.*)$/;

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
    else if ((m = l.match(HEAD))) out.push({ t: 'h', level: m[1].length, text: m[2] });
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
    } else {
      const last = out[out.length - 1];
      if (last?.t === 'p') last.lines.push(l);
      else out.push({ t: 'p', lines: [l] });
    }
  }
  if (out[out.length - 1]?.t === 'gap') out.pop();
  return out;
}

/* ---------- inline ---------- */

/** A link's address that opens: the web or e-mail, never script. */
const SAFE = /^(https?:\/\/|mailto:)\S/;

// The same inline syntax the editor styles as it's written (lib/inline.ts).
function inline(text: string): ComponentChildren[] {
  return pieces(text).map((p) => {
    switch (p.t) {
      case 'text': case 'esc': return p.s;
      case 'code': return <code>{p.s}</code>;
      case 'wiki': return <WikiLink target={p.target} text={p.s} />;
      case 'person': return <PersonMention target={p.target} text={p.s} />;
      case 'song': return <SongMention target={p.target} text={p.s} />;
      case 'link': return SAFE.test(p.url) ? <a href={p.url} target="_blank" rel="noopener noreferrer">{inline(p.s)}</a> : <span>{inline(p.s)}</span>;
      case 'b': return <strong>{inline(p.s)}</strong>;
      case 's': return <s>{inline(p.s)}</s>;
      case 'hl': return <mark>{inline(p.s)}</mark>;
      case 'i': return <em>{inline(p.s)}</em>;
      case 'empty': return p.s;
      case 'bare': return <a href={p.s} target="_blank" rel="noopener noreferrer">{p.s}</a>;
      case 'tag': return <span class="md-tag">{p.s}</span>;
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

function Blocks({ blocks, onTask }: { blocks: Block[]; onTask?: (line: number) => void }) {
  return (
    <>
      {blocks.map((b) => {
        switch (b.t) {
          case 'gap':
            return <div class="md-gap" />;
          case 'hr':
            return <hr />;
          case 'code':
            return <pre><code>{b.text}</code></pre>;
          case 'h': {
            const H = `h${Math.min(b.level + 1, 6)}` as 'h2';
            return <H class={`md-h md-h${b.level}`}>{inline(b.text)}</H>;
          }
          case 'p':
            return <p>{b.lines.map((l, i) => <>{i > 0 && <br />}{inline(l)}</>)}</p>;
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
                    <div class="md-li-text">{inline(b.text)}</div>
                  </>
                ) : inline(b.text)}
              </div>
            );
          case 'quote':
            return b.callout ? (
              <div class={`md-callout tone-${calloutTone(b.callout)}`}>
                <div class="md-callout-title"><span aria-hidden="true">{CALLOUT_ICON[b.callout] ?? '✎'}</span> {inline(b.title)}</div>
                {b.body.trim() && <Blocks blocks={parse(b.body, b.line)} onTask={onTask} />}
              </div>
            ) : (
              <blockquote><Blocks blocks={parse(b.body, b.line)} onTask={onTask} /></blockquote>
            );
        }
      })}
    </>
  );
}

/** A stretch of note text, formatted. Tasks can be ticked when `onTask` is given (with the line's number). */
export function Markdown({ text, onTask, class: cls }: { text: string; onTask?: (line: number) => void; class?: string }) {
  const blocks = useMemo(() => parse(text), [text]); // parsed once per text, not on every render of what holds it
  return <div class={`md${cls ? ' ' + cls : ''}`}><Blocks blocks={blocks} onTask={onTask} /></div>;
}
