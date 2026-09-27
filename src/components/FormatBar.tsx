import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
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
export function FormatBar({ target, format = true, swap, children }: { target: () => TextBox | null; format?: boolean; swap?: ComponentChildren; children?: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    const place = () => el.style.setProperty('--kb', Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)) + 'px');
    vv.addEventListener('resize', place);
    vv.addEventListener('scroll', place);
    place();
    return () => {
      vv.removeEventListener('resize', place);
      vv.removeEventListener('scroll', place);
    };
  }, []);

  const run = (f: Action) => {
    const el = target();
    if (el) f(el);
  };

  if (swap)
    return (
      <div ref={ref} class="format-bar glass is-swapped" role="toolbar" aria-label="Picture">
        <div class="format-scroll">{swap}</div>
      </div>
    );
  return (
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
}
