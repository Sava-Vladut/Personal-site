import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { editable } from '../lib/editable';
import { indentLines, insertBlock, insertLink, toggleLines, toggleWrap, wrapAtCaret, type TextBox } from '../lib/markdown';
import { Icon, type UiName } from './icons';
import { Ribbon } from './ribbon/Ribbon';
import { keepFocus } from './ribbon/commands';
import { t } from '../lib/i18n';
// the bar's own styles, wherever it's used (an @ in a person's or a book's page too, before any note has been opened)
import '../styles/ribbon.css';

export type Action = (el: TextBox) => void;

/** What the note editor gives its ribbon: the note's own commands, around the text ones the bar has itself. */
export interface RibbonActions {
  /** the note's title, '' when it has none */
  title: string;
  /** leaves the note (as Done does) */
  back: () => void;
  done: () => void;
  /** pictures are still being added: Back and Done wait */
  busy: boolean;
  /** the More sheet */
  more: () => void;
  /** Make public / Public link (check-ins have none) */
  share?: () => void;
  shared?: boolean;
  /** adds or changes the note's icon */
  icon: () => void;
  /** the note's details: date, feelings, place… */
  details: () => void;
  reading: boolean;
  setReading: (on: boolean) => void;
  addPhotos: () => void;
  canAddPhotos: boolean;
  /** online image search */
  findImage: () => void;
  /** music from Spotify */
  addMusic: () => void;
  /** tags someone, a book or music (@) */
  mention: () => void;
  /** links another note ([[) */
  linkNote: () => void;
  mentionBook: () => void;
}

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


/**
 * An empty pair put down at the caret to type into, from tapping Bold (or another style, or Link) with nothing
 * selected: [from, to) of the text it made, with the caret at `at`. Left without typing anything in it, it goes again.
 */
interface Pending { mark: string; box: TextBox; text: string; at: number; from: number; to: number }

/**
 * The note's toolbar, a slim pill at the bottom that rides up on top of a phone's keyboard. It holds `children` —
 * the buttons that add photos, images and music — after a checklist button, and an Aa button that swaps them for the
 * text tools: heading, bold, italic, strike and highlight; checklist, bullets, numbers and quote; moving a list item
 * in or out (while in a list); link and divider. Selecting text brings the text tools up by themselves (and puts
 * them away again after); the tools for how the text at the caret is styled are lit. A style tapped with nothing
 * selected puts down an empty pair to type into (see wrapAtCaret in lib/markdown.ts). Scrolling down through a note, not writing, tucks the
 * bar away until you scroll back up. The bar only shows while writing (the caret in the title or the text, or a button
 * of the bar tapped); otherwise the page is just the note. With `swap` (a selected picture's tools, or what an @ suggests), it shows those.
 *
 * Given `ribbon`, the note's commands, it's the note editor's ribbon instead, the way Word has it (components/ribbon/
 * Ribbon.tsx): Home, Insert and View tabs, and a tab for the selected picture (`context`) while there is one. On a
 * computer it sits across the top of the page; on a phone it's a bar docked above the keyboard. What an @ suggests
 * (`swap`) still shows as a strip of its own near the bottom.
 */
export function FormatBar({ target, format = true, swap, swapLabel = t('Picture'), children, ribbon, context }: {
  target: () => TextBox | null;
  format?: boolean;
  swap?: ComponentChildren;
  swapLabel?: string;
  children?: ComponentChildren;
  ribbon?: RibbonActions;
  /** a tab of its own for what's selected, as Word's Picture tab: its name and its tools */
  context?: { label: string; content: ComponentChildren };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tools, setTools] = useState(false);
  const [styles, setStyles] = useState('');
  const [tucked, setTucked] = useState(false);
  const [writing, setWriting] = useState(false);
  const [onBar, setOnBar] = useState(false); // a button of the bar has the focus: tapping one mustn't put the bar away
  const [pending, setPending] = useState<string | null>(null);
  const [ranged, setRanged] = useState(false); // text is selected in the note
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
      setRanged(ranged);
      setStyles(at && document.activeElement === at.box ? stylesAt(at.at, at.box).join(' ') : '');
      // an empty pair goes again when the caret moves away without typing in it
      const p = pend.current;
      if (!p) return;
      const box = p.box as TextBox & { el?: HTMLElement };
      if (box.value !== p.text) return drop();
      const here = !!box.el && document.activeElement === box.el;
      if (here && box.selectionStart === p.at && box.selectionEnd === p.at) return;
      drop();
      const n = p.to - p.from;
      const moved = (i: number) => (i >= p.to ? i - n : i > p.from ? p.from : i);
      const [s0, s1] = here ? [moved(box.selectionStart), moved(box.selectionEnd)] : [0, 0];
      box.setRangeText('', p.from, p.to);
      if (here) box.setSelectionRange(s0, s1);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    };
    document.addEventListener('selectionchange', on);
    return () => document.removeEventListener('selectionchange', on);
  }, [format]);

  // Whether a note's words are being written: the bar then offers to put the keyboard away, and it shows at all.
  useEffect(() => {
    const text = (n: EventTarget | null) => !!(n as Element | null)?.closest?.('.body-input, .title-input');
    const bar = (n: EventTarget | null) => !!(n as Element | null)?.closest?.('.format-bar');
    // A tap on the bar under way: if the focus still leaves for nowhere (a browser that doesn't focus buttons and
    // didn't keep it in the text box), the bar stays until the tap's click has landed.
    let pressing = false;
    const into = (e: FocusEvent) => { setWriting(text(e.target)); setOnBar(bar(e.target)); };
    const out = (e: FocusEvent) => { setWriting(text(e.relatedTarget)); setOnBar(bar(e.relatedTarget) || (pressing && !e.relatedTarget)); };
    const down = (e: PointerEvent) => {
      pressing = bar(e.target);
      // a tap elsewhere puts a bar kept up that way away, unless the focus is still in it
      if (!pressing && !bar(document.activeElement)) setOnBar(false);
    };
    const up = () => { pressing = false; };
    document.addEventListener('focusin', into);
    document.addEventListener('focusout', out);
    document.addEventListener('pointerdown', down, true);
    // captured, so it's done before the button's own click: Hide keyboard's blur still puts the bar away
    document.addEventListener('click', up, true);
    document.addEventListener('pointercancel', up, true);
    return () => {
      document.removeEventListener('focusin', into);
      document.removeEventListener('focusout', out);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('click', up, true);
      document.removeEventListener('pointercancel', up, true);
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
  /** Remembers an empty pair put down at the caret, to tidy it away if nothing is typed in it. */
  const hold = (el: TextBox, mark: string, at: [number, number] | null) => {
    if (!at) return;
    pend.current = { mark, box: el, text: el.value, at: el.selectionStart, from: at[0], to: at[1] };
    setPending(mark);
  };
  /** Bold and the like: around the selection, or at the caret as Word does it (wrapAtCaret). */
  const wrap = (mark: string) => {
    const el = target();
    if (!el) return;
    if (el.selectionStart !== el.selectionEnd) return void (drop(), toggleWrap(el, mark));
    // the pair just put down, tapped again: wrapAtCaret takes it out
    if (pend.current && pend.current.mark !== mark) drop();
    const at = wrapAtCaret(el, mark);
    drop();
    hold(el, mark, at);
  };
  const link = () => {
    const el = target();
    if (!el) return;
    drop();
    hold(el, ']', insertLink(el));
  };
  const showTools = format && tools;
  const lit = styles.split(' ');
  const level = lit.find((c) => /^h[1-3]$/.test(c));
  const inList = lit.includes('ul') || lit.includes('ol') || lit.includes('task');

  const tool = (icon: UiName, label: string, onClick: () => void, on?: boolean) => (
    <button class="format-btn" aria-label={label} title={label} aria-pressed={on} onClick={onClick}>
      <Icon name={icon} size={19} />
    </button>
  );
  const toggle = format && (
    <button
      class="format-btn format-toggle"
      aria-pressed={showTools}
      aria-label={showTools ? t('Hide formatting') : t('Formatting')}
      title={showTools ? t('Hide formatting') : t('Formatting')}
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
      onClick={() => (document.activeElement as HTMLElement | null)?.blur?.()}
    >
      <Icon name="keyboard-hide" size={19} />
    </button>
  );

  // Page entrance transforms temporarily turn fixed descendants into page-relative
  // elements. Keep this keyboard accessory at the document level throughout editing.
  const away = tucked || !(writing || onBar);
  if (ribbon) {
    // a wrapper of no box of its own, carrying the keyboard's height to the ribbon and the strip
    return createPortal(
      <div ref={ref} class="ribbon-root">
        <Ribbon
          actions={ribbon}
          context={context}
          swapped={!!swap}
          lit={lit}
          pending={pending}
          ranged={format && ranged}
          away={away}
          done={done}
          target={target}
          wrap={wrap}
          link={link}
          run={run}
        />
        {/* on a phone it docks above the keyboard as the ribbon's bar does; on a computer it floats near the bottom */}
        {swap && (
          <div class="format-bar is-swapped is-strip in-ribbon" role="toolbar" aria-label={swapLabel}>
            <div class="format-scroll">{swap}</div>
          </div>
        )}
      </div>,
      document.body,
    );
  }
  const bar = swap ? (
      <div ref={ref} class="format-bar is-swapped is-strip" role="toolbar" aria-label={swapLabel}>
        <div class="format-scroll">{swap}</div>
      </div>
    ) : (
    <div ref={ref} class={`format-bar is-strip${showTools ? ' is-formatting' : ''}${away ? ' is-tucked' : ''}`} inert={away} role="toolbar" aria-label={showTools ? t('Formatting') : t('Add to the note')} {...keepFocus}>
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
            {tool('link', t('Link'), link, lit.includes('md-link'))}
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
