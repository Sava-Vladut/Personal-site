import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { docView, setDocView, stepZoom, useDocView, ZOOMS } from '../../lib/docView';
import { t } from '../../lib/i18n';
import { Icon, type UiName } from '../icons';
import type { RibbonActions } from '../FormatBar';
import type { Lit, NoteCommands } from '../../editor/NoteBody';
import { keepFocus } from './keepFocus';
import { HIGHLIGHTS, TEXT_COLORS } from '../../lib/palette';

type Tab = 'home' | 'insert' | 'view' | 'context';

/** Apple keyboards say ⌘, ⌥ and ⇧ where the others say Ctrl, Alt and Shift. */
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
const keys = (k: string) => (MAC ? k.replace(/Ctrl\+/g, '⌘').replace(/Alt\+/g, '⌥').replace(/Shift\+/g, '⇧') : k);
/** A tooltip as Word words it: what the button does, then its shortcut. */
const tip = (label: string, k?: string) => (k ? `${label} (${keys(k)})` : label);

const WIDE = '(min-width: 1024px)';
/** Whether the screen is wide enough for the ribbon across the top (a computer, a big tablet on its side). */
export function useWide() {
  const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia(WIDE).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

type Style = 'normal' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'quote';
type PopId = 'styles' | 'numbering' | 'color' | 'highlight';

/** The palette's names, as the colour menus say them (lib/palette.ts). */
const colorName = (c: string): string =>
  ({
    red: t('Red'), orange: t('Orange'), green: t('Green'), blue: t('Blue'), purple: t('Purple'), gray: t('Gray'), yellow: t('Yellow'),
    lightgreen: t('Green'), lightblue: t('Blue'), pink: t('Pink'), plum: t('Purple'), lightsalmon: t('Orange'), lightgray: t('Gray'),
  })[c] ?? c;

/** The colours Font colour and Highlight put on with one click: the ones picked last, for as long as the page is open. */
const last = { color: 'red' as string, highlight: 'yellow' as string };

/** What a toolbar's arrow keys go between: its buttons (and sliders) that can be used, not those of a menu in it. */
const stops = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')].filter((b) => !b.closest('[role="menu"]'));

/**
 * One Tab stop for a toolbar, as WAI-ARIA's roving tabindex: the arrow keys (and Home, End) go from command to
 * command, Tab goes past them all, and coming back lands on the one used last.
 */
function useRoving() {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<HTMLElement | null>(null);
  const settle = (current?: HTMLElement | null) => {
    const el = ref.current;
    if (!el) return;
    const all = stops(el);
    const at = current && all.includes(current) ? current : last.current && all.includes(last.current) ? last.current : all[0];
    for (const b of all) b.tabIndex = b === at ? 0 : -1;
  };
  // after every render: the commands change with the tab, the caret and the selection
  useLayoutEffect(() => settle());
  return {
    ref,
    onFocusIn(e: FocusEvent) {
      const b = e.target as HTMLElement;
      if (!ref.current || !stops(ref.current).includes(b)) return;
      last.current = b;
      settle(b);
    },
    onKeyDown(e: KeyboardEvent) {
      const el = ref.current;
      const k = e.key;
      // a slider's arrows are its own
      if (!el || !/^(ArrowLeft|ArrowRight|Home|End)$/.test(k) || (e.target as Element).closest('input, [role="menu"], [role="tablist"]')) return;
      const all = stops(el);
      const i = all.indexOf(e.target as HTMLElement);
      if (i < 0) return;
      e.preventDefault();
      const n = k === 'Home' ? 0 : k === 'End' ? all.length - 1 : (i + (k === 'ArrowRight' ? 1 : -1) + all.length) % all.length;
      all[n].focus();
      all[n].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    },
  };
}

/**
 * A small menu dropped from a ribbon button (more styles, numbering): on the page's body, as the ribbon's row scrolls
 * and would clip it, above the button when it's low on the screen (the phone's bar). Opened from the keyboard, its
 * first item takes the focus; the arrows go up and down it, Esc closes it.
 */
function Pop({ at, label, onClose, children }: { at: HTMLElement; label: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  const r = at.getBoundingClientRect();
  const up = r.top > innerHeight / 2;
  const style = {
    left: Math.round(Math.max(8, Math.min(r.left, innerWidth - 236))) + 'px',
    ...(up ? { bottom: Math.round(innerHeight - r.top + 6) + 'px' } : { top: Math.round(r.bottom + 6) + 'px' }),
  };
  useEffect(() => {
    if (document.activeElement === at) ref.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
  }, []);
  const keys = (e: KeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (i >= 0) at.focus();
      onClose();
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    }
  };
  return createPortal(
    <div ref={ref} class={`rb-menu rb-pop${up ? ' is-up' : ''}`} role="menu" aria-label={label} style={style} onKeyDown={keys} {...keepFocus}>
      {children}
    </div>,
    document.body,
  );
}

/** What the bar knows about the text, and its commands for it (components/FormatBar.tsx). */
export interface RibbonProps {
  actions: RibbonActions;
  context?: { label: string; content: ComponentChildren };
  /** what an @ suggests is showing, in a strip of its own (on a phone, in the bar's place) */
  swapped: boolean;
  /** the find bar is open (on a phone, in the bar's place) */
  finding?: boolean;
  /** the note editor's commands (null until it's there) */
  cmds: NoteCommands | null;
  /** how the text at the caret is styled, and what can be undone (null until the editor's there) */
  lit: Lit | null;
  /** not writing, or tucked away while reading down the note: the phone's bar is put away */
  away: boolean;
  /** Hide keyboard, while writing on a touch screen */
  done: ComponentChildren;
  /** the focus back in the note's text, the caret where it was (Esc in the ribbon, F6) */
  toText: () => void;
}

/**
 * The note editor's ribbon, as Word has it. Home holds Undo, the font styles, the paragraph's (lists, indents, quote)
 * and a gallery of styles, the one at the caret lit; Insert adds pictures, music, a book, a tag, links, a mind trap,
 * a law of power or a Win friends principle, and blocks;
 * View switches between writing and reading, Focus, the zoom, the note's icon and details. While a picture is
 * selected a Picture tab comes up, in the accent colour, and opens by itself; it goes again with the picture.
 *
 * On a computer it's one block across the top of the page — the note's title bar, the tabs, then the ribbon with
 * its commands in captioned groups — always there while the note is open, folding down to its tabs if you like
 * (Ctrl+F1, as in Word; a tab then drops the ribbon down over the page until you're done with it). On a phone it's a
 * bar docked above the keyboard while writing: the tab's name to pick another, then its commands in a row to scroll.
 * Focus puts all of it away, but for a small button to come back (or Esc). The usual Word shortcuts work in the text.
 */
export function Ribbon(p: RibbonProps) {
  const { actions: a, context, cmds } = p;
  const lit = p.lit;
  const ranged = !!lit?.ranged;
  const view = useDocView();
  const wide = useWide();
  const [tab, setTab] = useState<Tab>('home');
  const [peek, setPeek] = useState(false); // the folded ribbon dropped down over the page
  const [menu, setMenu] = useState(false); // the phone's list of tabs
  const [pop, setPop] = useState<{ id: PopId; at: HTMLElement } | null>(null); // a button's menu
  const [, setPicked] = useState(0); // a colour picked: the split buttons show it
  const roving = useRoving();
  const before = useRef<Tab>('home'); // the tab to go back to when the picture's goes
  const auto = useRef<Tab | null>(null); // the tab a selection switched away from, on a phone
  const scroller = useRef<HTMLDivElement>(null);

  const collapsed = wide && view.ribbon === 'collapsed';
  // the picture's tab, for the moment between the picture going and the tab following it
  const shown: Tab = tab === 'context' && !context ? before.current : tab;
  const reading = a.reading;

  const now = useRef(tab); // the tab, for the effects below
  now.current = tab;

  // (layout effects, these: the right tab is there in the first frame, never the old one for a frame)
  // the picture's tab opens when a picture is selected, and the tab before comes back after
  useLayoutEffect(() => {
    if (context) {
      if (now.current !== 'context') before.current = now.current;
      setTab('context');
    } else if (now.current === 'context') setTab(before.current);
  }, [!!context]);

  // reading: only View has anything to do; writing again starts at Home
  useLayoutEffect(() => {
    // (a picture's tab only stays while its picture does: reading lets the picture go, and View comes up all the same)
    if (now.current === 'context' && context) return;
    if (reading) setTab('view');
    else if (now.current === 'view') setTab('home');
  }, [reading]);

  // On a phone, selecting text brings Home up (the styles are what you'd want), and the tab before back after.
  useLayoutEffect(() => {
    if (wide) return;
    const was = now.current;
    if (ranged) {
      if (was === 'home' || was === 'context') return;
      auto.current = was;
      setTab('home');
    } else if (auto.current) {
      if (was === 'home') setTab(auto.current);
      auto.current = null;
    }
  }, [ranged]);

  // a new tab's row starts at its first command
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = 0;
  }, [shown]);

  // The dropped-down ribbon goes up again on a click outside it, or Esc; so do the phone's list of tabs and a menu.
  useEffect(() => {
    if (!peek && !menu && !pop) return;
    const down = (e: PointerEvent) => {
      const at = e.target as Element | null;
      if (peek && !at?.closest?.('.ribbon.is-wide, .rb-pop')) setPeek(false);
      if (menu && !at?.closest?.('.rb-pick')) setMenu(false);
      if (pop && !at?.closest?.('.rb-pop') && !pop.at.contains(at)) setPop(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPeek(false);
      setMenu(false);
      setPop(null);
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', esc);
    };
  }, [peek, menu, pop]);
  // a menu goes with the tab, or with the commands going (reading)
  useEffect(() => setPop(null), [shown, reading]);
  useEffect(() => {
    if (!collapsed) setPeek(false);
  }, [collapsed]);

  /* ---------- the commands ---------- */

  const inList = !!lit?.inList;
  const style = (lit ? lit.style : 'normal') as Style | null;
  /** A style from the gallery: applying the one the line has already leaves it be, as Word does. */
  const apply = (s: Style) => {
    if (s === style && s !== 'normal') return;
    cmds?.style(s);
  };
  const toggleRibbon = () => {
    setPeek(false);
    setDocView({ ribbon: docView().ribbon === 'collapsed' ? 'open' : 'collapsed' });
  };

  // Esc leaves Focus, and Ctrl+F1 folds the ribbon (Word's shortcuts in the text are the editor's, src/editor/plugins.ts).
  const live = useRef({ toggleRibbon, wide, toText: p.toText });
  live.current = { toggleRibbon, wide, toText: p.toText };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const c = live.current;
      // F6 (Shift+F6 back) goes round the ribbon's tabs, the text and the status bar, as in Word
      if (e.key === 'F6' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const a = document.activeElement;
        const here = a?.closest('.ribbon') ? 0 : a?.closest('.note-status') ? 2 : 1;
        const shown = (el: HTMLElement | null) => (el && el.getClientRects().length ? el : null);
        for (let k = 1; k < 3; k++) {
          const to = (here + (e.shiftKey ? -k : k) + 3) % 3;
          if (to === 1) return void c.toText();
          const el = shown(to === 0
            ? document.querySelector<HTMLElement>('.ribbon .rb-tab[aria-selected="true"], .ribbon .rb-pick-btn')
            : document.querySelector<HTMLElement>('.note-status button:not(:disabled)'));
          if (el) return void el.focus();
        }
        return;
      }
      const sheet = document.documentElement.classList.contains('sheet-open');
      if (e.key === 'Escape' && docView().focus && !e.defaultPrevented && !sheet) return void setDocView({ focus: false });
      if (e.key === 'F1' && (e.ctrlKey || e.metaKey) && c.wide) {
        e.preventDefault();
        c.toggleRibbon();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  /** Esc in the ribbon puts the focus back in the text (when nothing of the ribbon's is open for it to close). */
  const escape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented || peek || menu || pop) return;
    e.preventDefault();
    p.toText();
  };
  /** Opens (or closes) a button's menu. */
  const togglePop = (id: PopId, at: HTMLElement) => setPop(pop?.id === id ? null : { id, at });

  /* ---------- the pieces ---------- */

  const tool = (icon: UiName, label: string, onClick: () => void, o: { on?: boolean; off?: boolean; k?: string; menu?: (e: MouseEvent) => void } = {}) => (
    <button type="button" class="format-btn" aria-label={label} title={tip(label, o.k)} aria-pressed={o.on} disabled={o.off} onClick={onClick} onContextMenu={o.menu}>
      <Icon name={icon} size={18} />
    </button>
  );
  /** A big button, its icon over its name: Insert's and View's commands. */
  const big = (icon: UiName, label: string, onClick: () => void, o: { on?: boolean; off?: boolean; k?: string; title?: string } = {}) => (
    <button type="button" class="rb-big" title={tip(o.title ?? label, o.k)} aria-pressed={o.on} disabled={o.off} onClick={onClick}>
      <Icon name={icon} size={24} />
      <span>{label}</span>
    </button>
  );
  /** A group of commands with its caption under it (on a computer), between thin rules. */
  const group = (id: string, caption: string, children: ComponentChildren, cls = '', cols?: number) => (
    <div key={id} class={`format-group rb-group${cls ? ' ' + cls : ''}`} role="group" aria-label={caption} data-caption={caption} style={cols ? { '--cols': cols } : undefined}>
      {children}
    </div>
  );

  const off = reading || !cmds;
  const markTool = (icon: UiName, label: string, mark: 'bold' | 'italic' | 'underline' | 'strike' | 'sup' | 'sub' | 'code', k?: string) =>
    tool(icon, label, () => cmds?.mark(mark), { on: !!lit?.[mark], off, k });
  /** A split button, as Word's: the command, and an arrow beside it for its menu (a right-click on it opens that too). */
  const split = (id: PopId, main: ComponentChildren, label: string, ref: { current: HTMLButtonElement | null }) => (
    <span key={id} class="rb-split">
      {main}
      <button
        ref={ref}
        type="button"
        class="format-btn rb-split-more"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={pop?.id === id}
        disabled={off}
        onClick={(e) => togglePop(id, e.currentTarget)}
      >
        <Icon name="chevron-down" size={12} />
      </button>
    </span>
  );
  const menuFrom = (id: PopId, ref: { current: HTMLButtonElement | null }) => (e: MouseEvent) => {
    e.preventDefault();
    if (!off && ref.current) setPop({ id, at: ref.current });
  };
  // Text highlight colour: the last colour picked (yellow at first), off again on words that have it already
  const highlightAt = useRef<HTMLButtonElement>(null);
  const hl = last.highlight;
  const highlight = split('highlight', (
    <button
      type="button"
      class="format-btn rb-swatched"
      data-hl={hl}
      aria-label={`${t('Text highlight colour')}: ${colorName(hl)}`}
      title={tip(`${t('Text highlight colour')}: ${colorName(hl)}`, hl === 'yellow' ? 'Ctrl+Shift+H' : undefined)}
      aria-pressed={!!lit?.highlight && lit.highlightColor === hl}
      disabled={off}
      onClick={() => cmds?.mark('highlight', hl === 'yellow' ? null : hl)}
      onContextMenu={menuFrom('highlight', highlightAt)}
    >
      <Icon name="highlight" size={18} />
    </button>
  ), t('Highlight colours'), highlightAt);
  // Font colour: the last colour picked (red at first)
  const colorAt = useRef<HTMLButtonElement>(null);
  const fc = last.color;
  const fontColor = split('color', (
    <button
      type="button"
      class="format-btn rb-swatched"
      data-color={fc}
      aria-label={`${t('Font colour')}: ${colorName(fc)}`}
      title={`${t('Font colour')}: ${colorName(fc)}`}
      disabled={off}
      onClick={() => cmds?.color(fc)}
      onContextMenu={menuFrom('color', colorAt)}
    >
      <Icon name="text-color" size={18} />
    </button>
  ), t('Font colours'), colorAt);
  // Format Painter: a click paints the next words selected once, a double click until Esc (or a click on it again)
  const painter = (
    <button
      key="painter"
      type="button"
      class="format-btn"
      aria-label={t('Format Painter')}
      title={t('Format Painter: copy the style here onto the next words you select. Double-click to keep it on, Esc to stop')}
      aria-pressed={!!lit?.painter}
      disabled={off}
      onClick={(e) => (e.detail < 2 ? cmds?.painter(false) : undefined)}
      onDblClick={() => cmds?.painter(true)}
    >
      <Icon name="brush" size={18} />
    </button>
  );
  /** A colour picked from a menu: put on, and the one its button puts on from now on. */
  const pickColor = (id: 'color' | 'highlight', c: string | null) => {
    setPop(null);
    if (id === 'color') {
      if (c) last.color = c;
      cmds?.color(c);
    } else {
      if (c) last.highlight = c;
      cmds?.highlight(c === null ? false : c === 'yellow' ? null : c);
    }
    setPicked((n) => n + 1);
  };
  const undo = group('undo', t('Undo'), [
    tool('arrow-back-up', t('Undo'), () => cmds?.undo(), { off: off || !lit?.canUndo, k: 'Ctrl+Z' }),
    tool('arrow-forward-up', t('Redo'), () => cmds?.redo(), { off: off || !lit?.canRedo, k: MAC ? 'Ctrl+Shift+Z' : 'Ctrl+Y' }),
  ], 'rb-rows', 1);
  const font = group('font', t('Font'), [
    markTool('bold', t('Bold'), 'bold', 'Ctrl+B'),
    markTool('italic', t('Italic'), 'italic', 'Ctrl+I'),
    markTool('underline', t('Underline'), 'underline', 'Ctrl+U'),
    markTool('strikethrough', t('Strikethrough'), 'strike', 'Ctrl+Shift+X'),
    markTool('superscript', t('Superscript'), 'sup', 'Ctrl+Shift+='),
    markTool('subscript', t('Subscript'), 'sub', 'Ctrl+='),
    markTool('code', t('Code'), 'code', 'Ctrl+Shift+E'),
    highlight,
    fontColor,
    tool('clear-formatting', t('Clear formatting'), () => cmds?.clearFormatting(), { off }),
    painter,
  ], 'rb-rows rb-font', 7);
  const block = lit?.block;
  // Numbered list with its menu beside it (Restart numbering, Continue numbering); a right-click on it opens it too
  const numberingAt = useRef<HTMLButtonElement>(null);
  const numbered = (
    <span key="ol" class="rb-split">
      {tool('list-numbers', t('Numbered list'), () => cmds?.list('ol'), {
        on: block === 'ol', off, k: 'Ctrl+Shift+7',
        menu: (e) => {
          e.preventDefault();
          if (!off && numberingAt.current) setPop({ id: 'numbering', at: numberingAt.current });
        },
      })}
      <button
        ref={numberingAt}
        type="button"
        class="format-btn rb-split-more"
        aria-label={t('Numbering options')}
        title={t('Numbering options')}
        aria-haspopup="menu"
        aria-expanded={pop?.id === 'numbering'}
        disabled={off}
        onClick={(e) => togglePop('numbering', e.currentTarget)}
      >
        <Icon name="chevron-down" size={12} />
      </button>
    </span>
  );
  // the alignments, lit as the selected lines are (none when they differ); off on lines that can't be aligned (lists)
  const align = (icon: UiName, label: string, to: 'left' | 'center' | 'right' | 'justify', k: string) =>
    tool(icon, label, () => cmds?.align(to), { on: lit?.align === to, off: off || !lit?.canAlign, k });
  const paragraph = group('paragraph', t('Paragraph'), [
    tool('list', t('Bullet list'), () => cmds?.list('ul'), { on: block === 'ul', off, k: 'Ctrl+Shift+L' }),
    numbered,
    tool('list-check', t('Checklist'), () => cmds?.list('task'), { on: block === 'task', off, k: 'Ctrl+Shift+9' }),
    tool('indent-decrease', t('Decrease indent'), () => cmds?.indent(true), { off: off || !inList, k: 'Ctrl+[' }),
    tool('indent-increase', t('Increase indent'), () => cmds?.indent(false), { off: off || !inList, k: 'Ctrl+]' }),
    align('align-left', t('Align left'), 'left', 'Ctrl+L'),
    align('align-center', t('Center'), 'center', 'Ctrl+E'),
    align('align-right', t('Align right'), 'right', 'Ctrl+R'),
    align('align-justified', t('Justify'), 'justify', 'Ctrl+J'),
    tool('blockquote', t('Quote'), () => cmds?.quote(), { on: !!lit?.quote && !lit.callout, off, k: 'Ctrl+Shift+.' }),
  ], 'rb-rows rb-para', 5);
  const STYLES: [Style, string, string?][] = [
    ['normal', t('Normal'), 'Ctrl+Alt+0'],
    ['h1', t('Heading 1'), 'Ctrl+Alt+1'],
    ['h2', t('Heading 2'), 'Ctrl+Alt+2'],
    ['h3', t('Heading 3'), 'Ctrl+Alt+3'],
    ['quote', t('Quote'), 'Ctrl+Shift+.'],
  ];
  // the smaller headings: in the phone's row of chips, and in a menu at the end of the computer's gallery
  const MORE: [Style, string, string][] = [
    ['h4', t('Heading 4'), 'Ctrl+Alt+4'],
    ['h5', t('Heading 5'), 'Ctrl+Alt+5'],
    ['h6', t('Heading 6'), 'Ctrl+Alt+6'],
  ];
  const moreOn = MORE.some(([s]) => s === style);
  const styles = group('styles', t('Styles'), (
    <div class="rb-gallery">
      {(wide ? STYLES : [...STYLES, ...MORE]).map(([s, name, k]) => (
        <button key={s} type="button" class={`rb-style is-${s}`} aria-pressed={style === s} disabled={off} title={tip(name, k)} onClick={() => apply(s)}>
          <span class="rb-style-sample" aria-hidden="true">AaBbCc</span>
          <span class="rb-style-name">{name}</span>
        </button>
      ))}
      {wide && (
        <button
          type="button"
          class="rb-style-more"
          aria-label={t('More styles')}
          title={t('More styles')}
          aria-haspopup="menu"
          aria-expanded={pop?.id === 'styles'}
          aria-pressed={moreOn}
          disabled={off}
          onClick={(e) => togglePop('styles', e.currentTarget)}
        >
          <Icon name="chevron-down" size={14} />
        </button>
      )}
    </div>
  ));
  const swatches = (id: 'color' | 'highlight') => {
    const now = id === 'color' ? lit?.color ?? null : lit?.highlightColor ?? null;
    const colors: string[] = id === 'color' ? [...TEXT_COLORS] : ['yellow', ...HIGHLIGHTS];
    return [
      <button key="none" type="button" role="menuitemradio" aria-checked={!now} onClick={() => pickColor(id, null)}>
        <span class="rb-swatch-name">
          <span class="rb-swatch is-none" aria-hidden="true" />
          {id === 'color' ? t('Automatic') : t('No colour')}
        </span>
        {!now && <Icon name="check" size={16} />}
      </button>,
      ...colors.map((c) => (
        <button key={c} type="button" role="menuitemradio" aria-checked={now === c} onClick={() => pickColor(id, c)}>
          <span class="rb-swatch-name">
            <span class="rb-swatch" {...(id === 'color' ? { 'data-color': c } : { 'data-hl': c })} aria-hidden="true" />
            {colorName(c)}
          </span>
          {now === c && <Icon name="check" size={16} />}
        </button>
      )),
    ];
  };
  const popLabel = { styles: t('More styles'), numbering: t('Numbering options'), color: t('Font colours'), highlight: t('Highlight colours') };
  const popMenu = pop && !off && (
    <Pop at={pop.at} label={popLabel[pop.id]} onClose={() => setPop(null)}>
      {pop.id === 'color' || pop.id === 'highlight' ? swatches(pop.id) : pop.id === 'styles'
        ? MORE.map(([s, name, k]) => (
          <button key={s} type="button" role="menuitemradio" aria-checked={style === s} class={`rb-pop-style is-${s}`} title={tip(name, k)} onClick={() => (setPop(null), apply(s))}>
            {name}
            {style === s && <Icon name="check" size={16} />}
          </button>
        ))
        : [
          <button key="restart" type="button" role="menuitem" disabled={!lit?.canRestart} onClick={() => (setPop(null), cmds?.numbering(true))}>
            {t('Restart numbering')}
          </button>,
          <button key="continue" type="button" role="menuitem" disabled={!lit?.canContinue} onClick={() => (setPop(null), cmds?.numbering(false))}>
            {t('Continue numbering')}
          </button>,
        ]}
    </Pop>
  );
  // Editing, at Home's end as in Word: Find, and Replace while writing (reading has nothing to replace in)
  const editing = group('editing', t('Editing'), [
    tool('search', t('Find'), () => a.find('find'), { k: 'Ctrl+F' }),
    !reading && tool('replace', t('Replace'), () => a.find('replace'), { k: 'Ctrl+H' }),
  ], 'rb-rows', 1);
  const home = wide ? [undo, font, paragraph, styles, editing] : [font, paragraph, styles, editing, undo];

  const insert = [
    group('pictures', t('Illustrations'), [
      big('photo-plus', t('Pictures'), a.addPhotos, { off: !a.canAddPhotos, title: t('Add photos') }),
      big('photo-search', t('Online pictures'), a.findImage, { title: t('Find an image') }),
    ]),
    group('media', t('Media'), [
      big('brand-spotify', t('Music'), a.addMusic, { title: t('Add music from Spotify') }),
      big('books', t('Book'), a.mentionBook, { title: t('Mention a book') }),
    ]),
    group('links', t('Links'), [
      big('at', t('Mention'), a.mention, { off, title: t('Tag someone, a book or music') }),
      big('file-text', t('Note link'), a.linkNote, { off, title: t('Link another note') }),
      big('link', t('Link'), a.link, { off, on: !!lit?.link, k: 'Ctrl+K' }),
    ]),
    group('learn', t('Learn'), [
      big('spiral', t('Mind trap'), () => a.insertRef('trap'), { off, title: t('Insert a mind trap') }),
      big('crown', t('Law of power'), () => a.insertRef('law'), { off, title: t('Insert a law of power') }),
      big('heart-handshake', t('Win friends'), () => a.insertRef('principle'), { off, title: t('Insert a Win friends principle') }),
    ]),
    group('pages', t('Pages'), big('page-break', t('Page break'), () => cmds?.insert('pagebreak'), { off, k: 'Ctrl+Enter', title: t('Start the next page here') })),
    group('blocks', t('Blocks'), [
      big('separator-horizontal', t('Divider'), () => cmds?.insert('hr'), { off }),
      big('info-circle', t('Callout'), () => cmds?.insert('callout'), { off }),
      big('code', t('Code block'), () => cmds?.insert('code'), { off }),
    ]),
    group('footnotes', t('Footnotes'), big('superscript', t('Footnote'), () => cmds?.footnote(), { off, k: 'Ctrl+Alt+F', title: t('Insert a footnote') })),
  ];

  const zoom = Math.round(view.zoom * 100);
  const viewTab = [
    group('views', t('Views'), [
      big('pencil', t('Edit'), () => a.setReading(false), { on: !reading }),
      big('book', t('Read mode'), () => a.setReading(true), { on: reading }),
    ]),
    group('show', t('Show'), big('layout-sidebar', t('Navigation pane'), () => (wide ? setDocView({ nav: !view.nav }) : a.navigation()), {
      on: wide && view.nav, title: t('The note’s headings, to go to one'),
    })),
    group('focus', t('Immersive'), big('focus-centered', t('Focus'), () => setDocView({ focus: !view.focus }), { on: view.focus, title: view.focus ? t('Exit Focus') : t('Focus') })),
    group('zoom', t('Zoom'), [
      tool('zoom-out', t('Zoom out'), () => stepZoom(-1), { off: view.zoom <= ZOOMS[0] }),
      <button key="zoom" type="button" class="rb-zoom" title={t('Back to 100%')} aria-label={t('Back to 100%')} onClick={() => setDocView({ zoom: 1 })}>
        {zoom}%
      </button>,
      tool('zoom-in', t('Zoom in'), () => stepZoom(1), { off: view.zoom >= ZOOMS[ZOOMS.length - 1] }),
    ], 'rb-zooms'),
    group('print', t('Print'), big('printer', t('Print'), a.print, { k: 'Ctrl+P', title: t('Print or save as PDF') })),
    group('note', t('Note'), [
      big('mood-plus', t('Icon'), a.icon, { title: t('Add or change the icon') }),
      big('info-circle', t('Details'), a.details, { title: t('Date, feelings, place and more') }),
    ]),
    wide && group('ribbon', t('Ribbon'), (
      collapsed
        ? big('pin', t('Pin the ribbon'), toggleRibbon, { k: 'Ctrl+F1' })
        : big('layout-navbar-collapse', t('Collapse the ribbon'), toggleRibbon, { k: 'Ctrl+F1' })
    )),
  ];

  const TABS: [Tab, string][] = [['home', t('Home')], ['insert', t('Insert')], ['view', t('View')]];
  if (context) TABS.push(['context', context.label]);
  const name = TABS.find(([id]) => id === shown)?.[1] ?? t('Home');
  const panel = shown === 'context' ? context?.content : shown === 'insert' ? insert : shown === 'view' ? viewTab : home;
  // the picture's tools take the pointer as they are: the size slider must be draggable
  const hold = shown === 'context' ? {} : keepFocus;

  const exit = view.focus && (
    <button type="button" class="focus-exit" title={tip(t('Exit Focus'), 'Esc')} onClick={() => setDocView({ focus: false })}>
      <Icon name="minimize" size={16} />
      {t('Exit Focus')}
    </button>
  );

  if (!wide) {
    // what an @ suggests, or the find bar, takes the bar's place
    if (p.swapped || p.finding) return exit || null;
    const picture = shown === 'context';
    const away = p.away && !picture;
    return (
      <>
        <div
          ref={roving.ref}
          class={`format-bar ribbon is-phone${away ? ' is-tucked' : ''}${picture ? ' is-context' : ''}`}
          inert={away}
          role="toolbar"
          aria-label={name}
          {...hold}
          onFocusIn={roving.onFocusIn}
          onKeyDown={(e) => (roving.onKeyDown(e), escape(e))}
        >
          <div class="rb-pick">
            <button type="button" class="rb-pick-btn" aria-haspopup="menu" aria-expanded={menu} title={t('Tabs')} onClick={() => setMenu(!menu)}>
              <span>{name}</span>
              <Icon name="chevron-down" size={14} />
            </button>
            {menu && (
              <div class="rb-menu" role="menu" aria-label={t('Tabs')} {...keepFocus}>
                {TABS.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={shown === id}
                    class={id === 'context' ? 'is-context' : undefined}
                    onClick={() => {
                      setTab(id);
                      if (id !== 'context') auto.current = null;
                      setMenu(false);
                    }}
                  >
                    {label}
                    {shown === id && <Icon name="check" size={16} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div key={shown} ref={scroller} class="format-scroll" role="group" aria-label={name}>
            {panel}
          </div>
          {p.done}
        </div>
        {popMenu}
        {exit}
      </>
    );
  }

  const pick = (id: Tab) => {
    if (id === 'context') before.current = shown === 'context' ? before.current : shown;
    if (collapsed) setPeek(!(peek && id === shown));
    setTab(id);
  };
  const arrows = (e: KeyboardEvent) => {
    const i = TABS.findIndex(([id]) => id === shown);
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const id = TABS[(n + TABS.length) % TABS.length][0];
    setTab(id);
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>('#rb-tab-' + id)?.focus();
  };
  const body = (!collapsed || peek) && (
    <div
      class={`rb-body${peek ? ' is-peek' : ''}`}
      {...hold}
      // a command from the dropped-down ribbon puts it up again, as in Word
      onClick={peek ? (e) => (e.target as Element).closest('button:not(.rb-fold)') && setPeek(false) : undefined}
    >
      <div class="rb-tabpanel" role="tabpanel" id="rb-panel" aria-labelledby={'rb-tab-' + shown}>
        <div
          key={shown}
          class="rb-panel"
          role="toolbar"
          aria-label={name}
          ref={(el) => void (scroller.current = roving.ref.current = el)}
          onFocusIn={roving.onFocusIn}
          onKeyDown={roving.onKeyDown}
        >
          {panel}
        </div>
      </div>
      <button
        type="button"
        class="format-btn rb-fold"
        aria-label={collapsed ? t('Pin the ribbon') : t('Collapse the ribbon')}
        title={tip(collapsed ? t('Pin the ribbon') : t('Collapse the ribbon'), 'Ctrl+F1')}
        onClick={toggleRibbon}
      >
        <Icon name={collapsed ? 'pin' : 'chevron-up'} size={16} />
      </button>
    </div>
  );
  return (
    <>
      <div
        class={`format-bar ribbon is-wide${collapsed ? ' is-collapsed' : ''}${peek ? ' is-peeking' : ''}${view.focus ? ' is-focus' : ''}`}
        role="region"
        aria-label={t('Ribbon')}
        onKeyDown={escape}
      >
        <div class="rb-titlebar">
          <button type="button" class="format-btn" onClick={a.back} disabled={a.busy} aria-label={t('Back')} title={t('Back')}>
            <Icon name="arrow-left" size={18} />
          </button>
          <span class="rb-doc">
            <Icon name="file-description" size={16} />
            <span class={`rb-title${a.title ? '' : ' is-untitled'}`}>{a.title || t('Untitled note')}</span>
          </span>
          {a.share && (
            <button type="button" class={`rb-share${a.shared ? ' is-shared' : ''}`} onClick={a.share} title={a.shared ? t('Public link') : t('Make public')}>
              <Icon name="world" size={16} />
              {a.shared ? t('Public link') : t('Share')}
            </button>
          )}
          <button type="button" class="format-btn" onClick={a.more} aria-label={t('More')} title={t('More')}>
            <Icon name="dots" size={18} />
          </button>
          <button type="button" class="rb-done" onClick={a.done} disabled={a.busy}>
            {t('Done')}
          </button>
        </div>
        <div class="rb-tabs">
          <div class="rb-tablist" role="tablist" aria-label={t('Ribbon')} onKeyDown={arrows} {...keepFocus}>
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={'rb-tab-' + id}
                class={`rb-tab${id === 'context' ? ' is-context' : ''}`}
                aria-selected={shown === id}
                aria-controls="rb-panel"
                aria-expanded={collapsed ? peek && shown === id : undefined}
                tabIndex={shown === id ? 0 : -1}
                onClick={() => pick(id)}
                // a double click folds the ribbon away, or brings it back, as in Word
                onDblClick={toggleRibbon}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            class="rb-mode"
            title={reading ? t('Edit') : t('Read mode')}
            aria-label={reading ? t('Reading: switch to editing') : t('Editing: switch to reading')}
            onClick={() => a.setReading(!reading)}
          >
            <Icon name={reading ? 'book' : 'pencil'} size={15} />
            {reading ? t('Reading') : t('Editing')}
          </button>
        </div>
        {body}
      </div>
      {popMenu}
      {exit}
    </>
  );
}
