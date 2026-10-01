import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { editable } from '../lib/editable';
import { insertBlock, insertLink, toggleLines, toggleWrap, type TextBox } from '../lib/markdown';
import { Icon, type UiName } from './icons';

type Action = (el: TextBox) => void;

// Each tool, and what it's lit up by when the caret is in text styled that way: a class of the styled text around
// the caret (lib/liveMarkdown.ts), or the kind of line it's on.
const TOOLS: [UiName, string, Action, string?][] = [
  ['bold', 'Bold', (el) => toggleWrap(el, '**'), 'md-b'],
  ['italic', 'Italic', (el) => toggleWrap(el, '*'), 'md-i'],
  ['strikethrough', 'Strikethrough', (el) => toggleWrap(el, '~~'), 'md-s'],
  ['highlight', 'Highlight', (el) => toggleWrap(el, '=='), 'md-hl'],
  ['heading', 'Heading', (el) => toggleLines(el, 'heading'), 'md-h'],
  ['list', 'Bullet list', (el) => toggleLines(el, 'ul'), 'ul'],
  ['list-numbers', 'Numbered list', (el) => toggleLines(el, 'ol'), 'ol'],
  ['list-check', 'Task list', (el) => toggleLines(el, 'task'), 'task'],
  ['blockquote', 'Quote', (el) => toggleLines(el, 'quote'), 'quote'],
  ['info-circle', 'Callout', (el) => insertBlock(el, '> [!note] ', 10), 'callout'],
  ['code', 'Code', (el) => (el.value.slice(el.selectionStart, el.selectionEnd).includes('\n') ? insertBlock(el, '```\n' + el.value.slice(el.selectionStart, el.selectionEnd) + '\n```', 4) : toggleWrap(el, '`')), 'md-code'],
  ['link', 'Link', insertLink, 'md-link'],
  ['separator-horizontal', 'Divider', (el) => insertBlock(el, '---')],
];

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

/**
 * The note's toolbar, a small pill at the bottom that rides up on top of a phone's keyboard. It holds `children` —
 * the buttons that add photos, images and music — and an Aa button that swaps them for the formatting tools. Selecting
 * text brings the formatting tools up by themselves (and puts them away again after); the tools for how the text at
 * the caret is styled are lit. Scrolling down through a note, not writing, tucks it away until you scroll back up.
 * With `swap` (a selected picture's tools, or what an @ suggests), it shows those instead.
 */
export function FormatBar({ target, format = true, swap, swapLabel = 'Picture', children }: {
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
    };
    document.addEventListener('selectionchange', on);
    return () => document.removeEventListener('selectionchange', on);
  }, [format]);

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
  const showTools = format && tools;
  const lit = styles.split(' ');

  // Page entrance transforms temporarily turn fixed descendants into page-relative
  // elements. Keep this keyboard accessory at the document level throughout editing.
  const bar = swap ? (
      <div ref={ref} class="format-bar glass is-swapped" role="toolbar" aria-label={swapLabel}>
        <div class="format-scroll">{swap}</div>
      </div>
    ) : (
    <div ref={ref} class={`format-bar glass${showTools ? ' is-formatting' : ''}${tucked ? ' is-tucked' : ''}`} role="toolbar" aria-label={showTools ? 'Formatting' : 'Add to the note'}>
      {format && (
        <button
          class="format-btn format-toggle"
          aria-pressed={showTools}
          aria-label={showTools ? 'Hide formatting' : 'Formatting'}
          title={showTools ? 'Hide formatting' : 'Formatting'}
          {...keepFocus}
          onClick={() => {
            opened.current = false;
            setTools(!showTools);
          }}
        >
          <Icon name={showTools ? 'x' : 'typography'} size={19} />
        </button>
      )}
      {format && (showTools || children) && <span class="format-sep" />}
      {showTools ? (
        <div class="format-scroll">
          {TOOLS.map(([icon, label, f, key]) => (
            <button class="format-btn" aria-label={label} title={label} aria-pressed={key ? lit.includes(key) : undefined} {...keepFocus} onClick={() => run(f)}>
              <Icon name={icon} size={19} />
            </button>
          ))}
        </div>
      ) : children && <div class="format-fixed">{children}</div>}
    </div>
  );
  return createPortal(bar, document.body);
}
