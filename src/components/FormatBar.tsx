import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { insertBlock, insertLink, toggleLines, toggleWrap, type TextBox } from '../lib/markdown';
import { Icon, type UiName } from './icons';

type Action = (el: TextBox) => void;

const TOOLS: [UiName, string, Action][] = [
  ['bold', 'Bold', (el) => toggleWrap(el, '**')],
  ['italic', 'Italic', (el) => toggleWrap(el, '*')],
  ['strikethrough', 'Strikethrough', (el) => toggleWrap(el, '~~')],
  ['highlight', 'Highlight', (el) => toggleWrap(el, '==')],
  ['heading', 'Heading', (el) => toggleLines(el, 'heading')],
  ['list', 'Bullet list', (el) => toggleLines(el, 'ul')],
  ['list-numbers', 'Numbered list', (el) => toggleLines(el, 'ol')],
  ['list-check', 'Task list', (el) => toggleLines(el, 'task')],
  ['blockquote', 'Quote', (el) => toggleLines(el, 'quote')],
  ['info-circle', 'Callout', (el) => insertBlock(el, '> [!note] ', 10)],
  ['code', 'Code', (el) => (el.value.slice(el.selectionStart, el.selectionEnd).includes('\n') ? insertBlock(el, '```\n' + el.value.slice(el.selectionStart, el.selectionEnd) + '\n```', 4) : toggleWrap(el, '`'))],
  ['link', 'Link', insertLink],
  ['separator-horizontal', 'Divider', (el) => insertBlock(el, '---')],
];

/**
 * The note's toolbar: formatting for the text box being written in (or the last one), then `children` — the
 * buttons that add photos, images and music. It floats at the bottom and rides up on top of a phone's keyboard.
 * With `swap` (a selected picture's tools), it shows those instead.
 */
export function FormatBar({ target, format = true, swap, swapLabel = 'Picture', children }: {
  target: () => TextBox | null;
  format?: boolean;
  swap?: ComponentChildren;
  swapLabel?: string;
  children?: ComponentChildren;
}) {
  const ref = useRef<HTMLDivElement>(null);

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

  const run = (f: Action) => {
    const el = target();
    if (el) f(el);
  };

  // Page entrance transforms temporarily turn fixed descendants into page-relative
  // elements. Keep this keyboard accessory at the document level throughout editing.
  const bar = swap ? (
      <div ref={ref} class="format-bar glass is-swapped" role="toolbar" aria-label={swapLabel}>
        <div class="format-scroll">{swap}</div>
      </div>
    ) : (
    <div ref={ref} class="format-bar glass" role="toolbar" aria-label="Formatting">
      {format && (
      <div class="format-scroll">
        {TOOLS.map(([icon, label, f]) => (
          <button
            class="format-btn"
            aria-label={label}
            title={label}
            // keep the text box focused (and the phone keyboard up) while tapping
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(f)}
          >
            <Icon name={icon} size={19} />
          </button>
        ))}
      </div>
      )}
      {format && children && <span class="format-sep" />}
      {children && <div class="format-fixed">{children}</div>}
    </div>
  );
  return createPortal(bar, document.body);
}
