import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { editable } from '../lib/editable';
import { indentLines, insertBlock, insertLink, replace, toggleLines, toggleWrap, type TextBox } from '../lib/markdown';
import { Icon, type UiName } from './icons';
import { t } from '../lib/i18n';

type Action = (el: TextBox) => void;

/** The inline styles, by their marker: what lights each up (a class of the styled text, lib/liveMarkdown.ts). */
const WRAPS: [UiName, string, string, string][] = [
  ['bold', t('Bold'), '**', 'md-b'],
  ['italic', t('Italic'), '*', 'md-i'],
  ['strikethrough', t('Strikethrough'), '~~', 'md-s'],
  ['highlight', t('Highlight'), '==', 'md-hl'],
];

// The kinds of line, and what lights each up: the kind of line the caret is on.
const LINES: [UiName, string, Action, string][] = [
  ['list-check', t('Checklist'), (el) => toggleLines(el, 'task'), 'task'],
  ['list', t('Bullet list'), (el) => toggleLines(el, 'ul'), 'ul'],
  ['list-numbers', t('Numbered list'), (el) => toggleLines(el, 'ol'), 'ol'],
  ['blockquote', t('Quote'), (el) => toggleLines(el, 'quote'), 'quote'],
];

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}_'’-]/u.test(c);

/** The note's text box the selection is in, if it is in one. */
function boxOf(s: Selection | null) {
  const n = s?.anchorNode;
  const at = n && (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement);
  return at?.closest<HTMLElement>('.body-input') ? { at, box: at.closest<HTMLElement>('.body-input')! } : null;
}

/** How the text around the caret is styled, as the keys in TOOLS. */
function stylesAt(at: Element, box: HTMLElement) {
  const on: string[] = [];
  for (let el: Element | null = at; el && el !== box; el = el.parentElement) on.push(...el.classList);
  if (on.includes('md-pre')) on.push('md-code');
  const h = on.find((c) => /^md-h\d$/.test(c));
  if (h) on.push('h' + h.slice(4));
  const ed = editable(box);
  const v = ed.value, i = ed.selectionStart;
  const line = v.slice(v.lastIndexOf('\n', i - 1) + 1);
  if (/^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]/.test(line)) on.push('task');
  else if (/^[ \t]*[-*+][ \t]/.test(line)) on.push('ul');
  else if (/^[ \t]*\d{1,9}[.)][ \t]/.test(line)) on.push('ol');
  else if (/^[ \t]*>[ \t]?\[!/.test(line)) on.push('callout');
  else if (/^[ \t]*>/.test(line)) on.push('quote');
  return on;
}

const keepFocus = {
  // keep the text box focused (and the phone keyboard up) while tapping
  onPointerDown: (e: PointerEvent) => e.preventDefault(),
  onMouseDown: (e: MouseEvent) => e.preventDefault(),
};

/** A style waiting at the caret for the words typed next, from tapping Bold (or another style) with nothing selected. */
interface Pending { mark: string; box: TextBox; pos: number; len: number }

/**
 * The note's toolbar, a slim pill at the bottom that rides up on top of a phone's keyboard. It holds `children` —
 * the buttons that add photos, images and music — after a checklist button, and an Aa button that swaps them for the
 * text tools: heading, bold, italic, strike and highlight; checklist, bullets, numbers and quote; moving a list item
 * in or out (while in a list); link and divider. Selecting text brings the text tools up by themselves (and puts
 * them away again after); the tools for how the text at the caret is styled are lit. A style tapped with nothing
 * selected waits at the caret and styles what's typed next. Scrolling down through a note, not writing, tucks the
 * bar away until you scroll back up. With `swap` (a selected picture's tools, or what an @ suggests), it shows those.
 */
export function FormatBar({ target, format = true, swap, swapLabel = t('Picture'), children }: {
  target: () => TextBox | null;
  format?: boolean;
  swap?: ComponentChildren;
  swapLabel?: string;
  children?: ComponentChildren;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tools, setTools] = useState(false);
  const [styles, setStyles] = useState('');
  const [tucked, setTucked] = useState(false);
  const [writing, setWriting] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const pend = useRef<Pending | null>(null);
  const toolsShown = useRef(tools);
  toolsShown.current = tools;
  const selecting = useRef(false); // text is selected in the note
  const opened = useRef(false); // the tools came up because text was selected, so they go when it isn't

  useLayoutEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    let frame = 0;
    const place = () => {
      if (!vv.width || !vv.height) return;
      const layoutHeight = Math.max(innerHeight, document.documentElement.clientHeight);
      el.style.setProperty('--kb', Math.max(0, Math.round(layoutHeight - vv.height - vv.offsetTop)) + 'px');
      el.style.setProperty('--toolbar-left', vv.offsetLeft + vv.width / 2 + 'px');
      el.style.setProperty('--toolbar-width', vv.width + 'px');
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    vv.addEventListener('resize', place);
    vv.addEventListener('scroll', place);
    addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    place();
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', place);
      vv.removeEventListener('scroll', place);
      removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
    };
  }, []);

  // Formatting and suggestions share a scroller. An old formatting offset must
  // not hide the first matches when the strip switches to tagging.
  useLayoutEffect(() => {
    const scroll = ref.current?.querySelector('.format-scroll');
    if (scroll) scroll.scrollLeft = 0;
  }, [!!swap, swapLabel]);

  const drop = () => {
    pend.current = null;
    setPending(null);
  };

  // Selecting text brings the formatting tools up; the tools for the caret's styling light up.
  useEffect(() => {
    if (!format) return;
    const on = () => {
      const s = getSelection();
      const at = boxOf(s);
      const ranged = !!at && !!s && !s.isCollapsed;
      if (ranged && !selecting.current && !toolsShown.current) {
        opened.current = true;
        setTools(true);
      } else if (!ranged && selecting.current && opened.current) {
        opened.current = false;
        setTools(false);
      }
      selecting.current = ranged;
      setStyles(at && document.activeElement === at.box ? stylesAt(at.at, at.box).join(' ') : '');
      // a waiting style goes when the caret moves away without typing
      const p = pend.current;
      if (p && p.box.value.length === p.len && (p.box.selectionStart !== p.pos || p.box.selectionEnd !== p.pos)) drop();
    };
    document.addEventListener('selectionchange', on);
    return () => document.removeEventListener('selectionchange', on);
  }, [format]);

  // What's typed after tapping a style with nothing selected takes that style.
  useEffect(() => {
    const typed = (e: Event) => {
      const p = pend.current;
      if (!p || (e as InputEvent).isComposing) return;
      drop();
      const v = p.box.value;
      const c = p.box.selectionStart;
      const text = v.slice(p.pos, c);
      if (c !== p.pos + v.length - p.len || p.box.selectionEnd !== c || !text || text.includes('\n') || /^\s|\s$/.test(text)) return;
      replace(p.box, p.pos, c, p.mark + text + p.mark, c + p.mark.length);
    };
    document.addEventListener('input', typed);
    document.addEventListener('compositionend', typed);
    return () => {
      document.removeEventListener('input', typed);
      document.removeEventListener('compositionend', typed);
    };
  }, []);

  // Whether a note's words are being written: the bar then offers to put the keyboard away.
  useEffect(() => {
    const text = (n: EventTarget | null) => !!(n as Element | null)?.closest?.('.body-input, .title-input');
    const into = (e: FocusEvent) => setWriting(text(e.target));
    const out = (e: FocusEvent) => setWriting(text(e.relatedTarget));
    document.addEventListener('focusin', into);
    document.addEventListener('focusout', out);
    return () => {
      document.removeEventListener('focusin', into);
      document.removeEventListener('focusout', out);
    };
  }, []);

  // Out of the way while reading down a note; back on the way up, at the end, or when writing.
  useEffect(() => {
    let last = scrollY;
    const on = () => {
      const y = scrollY;
      if (Math.abs(y - last) < 8) return;
      const down = y > last;
      last = y;
      const writing = !!(document.activeElement as Element | null)?.closest?.('.body-input, .title-input');
      const end = y + innerHeight >= document.documentElement.scrollHeight - 60;
      setTucked(down && y > 80 && !writing && !end);
    };
    const show = () => setTucked(false);
    addEventListener('scroll', on, { passive: true });
    document.addEventListener('focusin', show);
    return () => {
      removeEventListener('scroll', on);
      document.removeEventListener('focusin', show);
    };
  }, []);

  const run = (f: Action) => {
    const el = target();
    if (el) f(el);
  };
  /** Bold and the like: around the selection or the word at the caret, or waiting for what's typed next. */
  const wrap = (mark: string) => {
    const el = target();
    if (!el) return;
    const v = el.value;
    const s = el.selectionStart;
    if (s === el.selectionEnd && !isWordChar(v[s - 1]) && !isWordChar(v[s])) {
      if (pend.current?.mark === mark) return drop();
      el.focus({ preventScroll: true });
      pend.current = { mark, box: el, pos: s, len: v.length };
      setPending(mark);
      return;
    }
    drop();
    toggleWrap(el, mark);
  };
  const showTools = format && tools;
  const lit = styles.split(' ');
  const level = lit.find((c) => /^h[1-3]$/.test(c));
  const inList = lit.includes('ul') || lit.includes('ol') || lit.includes('task');

  const tool = (icon: UiName, label: string, onClick: () => void, on?: boolean) => (
    <button class="format-btn" aria-label={label} title={label} aria-pressed={on} {...keepFocus} onClick={onClick}>
      <Icon name={icon} size={19} />
    </button>
  );
  const toggle = format && (
    <button
      class="format-btn format-toggle"
      aria-pressed={showTools}
      aria-label={showTools ? t('Hide formatting') : t('Formatting')}
      title={showTools ? t('Hide formatting') : t('Formatting')}
      {...keepFocus}
      onClick={() => {
        opened.current = false;
        setTools(!showTools);
      }}
    >
      <Icon name="letter-case" size={20} />
    </button>
  );
  const done = writing && (
    <button
      class="format-btn format-done"
      aria-label={t('Hide keyboard')}
      title={t('Hide keyboard')}
      {...keepFocus}
      onClick={() => (document.activeElement as HTMLElement | null)?.blur?.()}
    >
      <Icon name="keyboard-hide" size={19} />
    </button>
  );

  // Page entrance transforms temporarily turn fixed descendants into page-relative
  // elements. Keep this keyboard accessory at the document level throughout editing.
  const bar = swap ? (
      <div ref={ref} class="format-bar glass is-swapped" role="toolbar" aria-label={swapLabel}>
        <div class="format-scroll">{swap}</div>
      </div>
    ) : (
    <div ref={ref} class={`format-bar glass${showTools ? ' is-formatting' : ''}${tucked ? ' is-tucked' : ''}`} role="toolbar" aria-label={showTools ? t('Formatting') : t('Add to the note')}>
      {toggle}
      {showTools ? (
        <div class="format-scroll">
          <div class="format-group">
            {tool(level ? (('h-' + level.slice(1)) as UiName) : 'heading', t('Heading'), () => run((el) => toggleLines(el, 'heading')), !!level)}
            {WRAPS.map(([icon, label, mark, key]) => tool(icon, label, () => wrap(mark), lit.includes(key) || pending === mark))}
          </div>
          <div class="format-group">
            {LINES.map(([icon, label, f, key]) => tool(icon, label, () => run(f), lit.includes(key)))}
          </div>
          {inList && (
            <div class="format-group">
              {tool('indent-decrease', t('Move out'), () => run((el) => indentLines(el, true)))}
              {tool('indent-increase', t('Move in'), () => run((el) => indentLines(el, false)))}
            </div>
          )}
          <div class="format-group">
            {tool('link', t('Link'), () => run(insertLink), lit.includes('md-link'))}
            {tool('separator-horizontal', t('Divider'), () => run((el) => insertBlock(el, '---')))}
          </div>
        </div>
      ) : (
        <div class="format-fixed">
          {format && tool('list-check', t('Checklist'), () => run((el) => toggleLines(el, 'task')), lit.includes('task'))}
          {children}
        </div>
      )}
      {done}
    </div>
  );
  return createPortal(bar, document.body);
}
