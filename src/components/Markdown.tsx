import type { ComponentChildren } from 'preact';
import { BookMention, PersonMention, SongMention } from './mentions';

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
      out.push({ t: 'li', kind, depth: depthOf(m[1]), marker: m[4] ? m[4] + '.' : '', done: m[3] === 'x' || m[3] === 'X', text: m[5], line: offset + i });
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

const INLINE = new RegExp(
  [
    /(`+)([^`\n]+?)\1/.source, //                                        1, 2 code
    /\[\[(?:([^\]|\n]+)\|)?([^\]\n]+)\]\]/.source, //                    3, 4 wiki link: a book on the shelf, else text
    /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)/.source, //       5, 6 link
    /\*\*(\S(?:[^\n]*?\S)?)\*\*/.source, //                               7 bold
    /~~(\S(?:[^\n]*?\S)?)~~/.source, //                                   8 strike
    /==(\S(?:[^\n]*?\S)?)==/.source, //                                   9 highlight
    /\*(\S(?:[^*\n]*?\S)?)\*/.source, //                                  10 italic
    /(https?:\/\/[^\s<>]*[^\s<>.,:;"'!?)\]])/.source, //                  11 bare address
    /(^|[\s(])#([\p{L}_][\p{L}\p{N}_/-]*)/u.source, //                     12, 13 tag
    /@\[(?:person:([^\]|\n]+)\|)?([^\]\n]+)\]/.source, //                       14, 15 someone in People
    /♪\[(?:song:([^\]|\n]+)\|)?([^\]\n]+)\]/.source, //                         16, 17 music in your records
  ].join('|'),
  'gu',
);

function inline(text: string): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index!;
    if (i > at) out.push(text.slice(at, i));
    at = i + m[0].length;
    if (m[2] !== undefined) out.push(<code>{m[2]}</code>);
    else if (m[4] !== undefined) out.push(<BookMention target={m[3]} text={m[4]} />);
    else if (m[5] !== undefined) out.push(<a href={m[6]} target="_blank" rel="noopener noreferrer">{inline(m[5])}</a>);
    else if (m[7] !== undefined) out.push(<strong>{inline(m[7])}</strong>);
    else if (m[8] !== undefined) out.push(<s>{inline(m[8])}</s>);
    else if (m[9] !== undefined) out.push(<mark>{inline(m[9])}</mark>);
    else if (m[10] !== undefined) out.push(<em>{inline(m[10])}</em>);
    else if (m[11] !== undefined) out.push(<a href={m[11]} target="_blank" rel="noopener noreferrer">{m[11]}</a>);
    else if (m[13] !== undefined) out.push(m[12], <span class="md-tag">#{m[13]}</span>);
    else if (m[15] !== undefined) out.push(<PersonMention target={m[14]} text={m[15]} />);
    else if (m[17] !== undefined) out.push(<SongMention target={m[16]} text={m[17]} />);
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
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
              <div class={`md-li md-${b.kind}${b.done ? ' is-done' : ''}`} style={b.depth ? { '--depth': b.depth } : undefined}>
                {b.kind === 'task' ? (
                  <input
                    type="checkbox"
                    checked={b.done}
                    disabled={!onTask}
                    onClick={(e) => { e.stopPropagation(); onTask?.(b.line); }}
                    aria-label={b.done ? 'Done' : 'To do'}
                  />
                ) : (
                  <span class="md-marker" aria-hidden="true">{b.kind === 'ol' ? b.marker : '•'}</span>
                )}
                <span class="md-li-text">{inline(b.text)}</span>
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
  return <div class={`md${cls ? ' ' + cls : ''}`}><Blocks blocks={parse(text)} onTask={onTask} /></div>;
}
