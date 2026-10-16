import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { docView, setDocView, stepZoom, useDocView, ZOOMS } from '../../lib/docView';
import { t } from '../../lib/i18n';
import { Icon, type UiName } from '../icons';
import type { RibbonActions } from '../FormatBar';
import type { Lit, NoteCommands } from '../../editor/NoteBody';
import { keepFocus } from './keepFocus';

type Tab = 'home' | 'insert' | 'view' | 'context';

/** Apple keyboards say ⌘, ⌥ and ⇧ where the others say Ctrl, Alt and Shift. */
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
const keys = (k: string) => (MAC ? k.replace(/Ctrl\+/g, '⌘').replace(/Alt\+/g, '⌥').replace(/Shift\+/g, '⇧') : k);
/** A tooltip as Word words it: what the button does, then its shortcut. */
const tip = (label: string, k?: string) => (k ? `${label} (${keys(k)})` : label);

const WIDE = '(min-width: 1024px)';
/** Whether the screen is wide enough for the ribbon across the top (a computer, a big tablet on its side). */
function useWide() {
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

type Style = 'normal' | 'h1' | 'h2' | 'h3' | 'quote';

/** What the bar knows about the text, and its commands for it (components/FormatBar.tsx). */
export interface RibbonProps {
  actions: RibbonActions;
  context?: { label: string; content: ComponentChildren };
  /** what an @ suggests is showing, in a strip of its own (on a phone, in the bar's place) */
  swapped: boolean;
  /** the note editor's commands (null until it's there) */
  cmds: NoteCommands | null;
  /** how the text at the caret is styled, and what can be undone (null until the editor's there) */
  lit: Lit | null;
  /** not writing, or tucked away while reading down the note: the phone's bar is put away */
  away: boolean;
  /** Hide keyboard, while writing on a touch screen */
  done: ComponentChildren;
}

/**
 * The note editor's ribbon, as Word has it. Home holds Undo, the font styles, the paragraph's (lists, indents, quote)
 * and a gallery of styles, the one at the caret lit; Insert adds pictures, music, a book, a tag, links and blocks;
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
  const before = useRef<Tab>('home'); // the tab to go back to when the picture's goes
  const auto = useRef<Tab | null>(null); // the tab a selection switched away from, on a phone
  const scroller = useRef<HTMLDivElement>(null);

  const collapsed = wide && view.ribbon === 'collapsed';
  // the picture's tab, for the moment between the picture going and the tab following it
  const shown: Tab = tab === 'context' && !context ? before.current : tab;
  const reading = a.reading;

  const now = useRef(tab); // the tab, for the effects below
  now.current = tab;

  // the picture's tab opens when a picture is selected, and the tab before comes back after
  useEffect(() => {
    if (context) {
      if (now.current !== 'context') before.current = now.current;
      setTab('context');
    } else if (now.current === 'context') setTab(before.current);
  }, [!!context]);

  // reading: only View has anything to do; writing again starts at Home
  useEffect(() => {
    // (a picture's tab only stays while its picture does: reading lets the picture go, and View comes up all the same)
    if (now.current === 'context' && context) return;
    if (reading) setTab('view');
    else if (now.current === 'view') setTab('home');
  }, [reading]);

  // On a phone, selecting text brings Home up (the styles are what you'd want), and the tab before back after.
  useEffect(() => {
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
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = 0;
  }, [shown]);

  // The dropped-down ribbon goes up again on a click outside it, or Esc; so does the phone's list of tabs.
  useEffect(() => {
    if (!peek && !menu) return;
    const down = (e: PointerEvent) => {
      const at = e.target as Element | null;
      if (peek && !at?.closest?.('.ribbon.is-wide')) setPeek(false);
      if (menu && !at?.closest?.('.rb-pick')) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPeek(false);
      setMenu(false);
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', esc);
    };
  }, [peek, menu]);
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
  const live = useRef({ toggleRibbon, wide });
  live.current = { toggleRibbon, wide };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const c = live.current;
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

  /* ---------- the pieces ---------- */

  const tool = (icon: UiName, label: string, onClick: () => void, o: { on?: boolean; off?: boolean; k?: string } = {}) => (
    <button type="button" class="format-btn" aria-label={label} title={tip(label, o.k)} aria-pressed={o.on} disabled={o.off} onClick={onClick}>
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
  const markTool = (icon: UiName, label: string, mark: 'bold' | 'italic' | 'strike' | 'highlight' | 'code', k?: string) =>
    tool(icon, label, () => cmds?.mark(mark), { on: !!lit?.[mark], off, k });
  const undo = group('undo', t('Undo'), [
    tool('arrow-back-up', t('Undo'), () => cmds?.undo(), { off: off || !lit?.canUndo, k: 'Ctrl+Z' }),
    tool('arrow-forward-up', t('Redo'), () => cmds?.redo(), { off: off || !lit?.canRedo, k: MAC ? 'Ctrl+Shift+Z' : 'Ctrl+Y' }),
  ], 'rb-rows', 1);
  const font = group('font', t('Font'), [
    markTool('bold', t('Bold'), 'bold', 'Ctrl+B'),
    markTool('italic', t('Italic'), 'italic', 'Ctrl+I'),
    markTool('strikethrough', t('Strikethrough'), 'strike', 'Ctrl+Shift+X'),
    markTool('highlight', t('Highlight'), 'highlight', 'Ctrl+Shift+H'),
    markTool('code', t('Code'), 'code', 'Ctrl+E'),
    tool('clear-formatting', t('Clear formatting'), () => cmds?.clearFormatting(), { off }),
  ], 'rb-rows', 3);
  const block = lit?.block;
  const paragraph = group('paragraph', t('Paragraph'), [
    tool('list', t('Bullet list'), () => cmds?.list('ul'), { on: block === 'ul', off, k: 'Ctrl+Shift+L' }),
    tool('list-numbers', t('Numbered list'), () => cmds?.list('ol'), { on: block === 'ol', off, k: 'Ctrl+Shift+7' }),
    tool('list-check', t('Checklist'), () => cmds?.list('task'), { on: block === 'task', off, k: 'Ctrl+Shift+9' }),
    tool('indent-decrease', t('Decrease indent'), () => cmds?.indent(true), { off: off || !inList, k: 'Ctrl+[' }),
    tool('indent-increase', t('Increase indent'), () => cmds?.indent(false), { off: off || !inList, k: 'Ctrl+]' }),
    tool('blockquote', t('Quote'), () => cmds?.quote(), { on: !!lit?.quote && !lit.callout, off, k: 'Ctrl+Shift+.' }),
  ], 'rb-rows', 3);
  const STYLES: [Style, string, string?][] = [
    ['normal', t('Normal'), 'Ctrl+Alt+0'],
    ['h1', t('Heading 1'), 'Ctrl+Alt+1'],
    ['h2', t('Heading 2'), 'Ctrl+Alt+2'],
    ['h3', t('Heading 3'), 'Ctrl+Alt+3'],
    ['quote', t('Quote'), 'Ctrl+Shift+.'],
  ];
  const styles = group('styles', t('Styles'), (
    <div class="rb-gallery">
      {STYLES.map(([s, name, k]) => (
        <button key={s} type="button" class={`rb-style is-${s}`} aria-pressed={style === s} disabled={off} title={tip(name, k)} onClick={() => apply(s)}>
          <span class="rb-style-sample" aria-hidden="true">AaBbCc</span>
          <span class="rb-style-name">{name}</span>
        </button>
      ))}
    </div>
  ));
  const home = wide ? [undo, font, paragraph, styles] : [font, paragraph, styles, undo];

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
    group('blocks', t('Blocks'), [
      big('separator-horizontal', t('Divider'), () => cmds?.insert('hr'), { off }),
      big('info-circle', t('Callout'), () => cmds?.insert('callout'), { off }),
      big('code', t('Code block'), () => cmds?.insert('code'), { off }),
    ]),
  ];

  const zoom = Math.round(view.zoom * 100);
  const viewTab = [
    group('views', t('Views'), [
      big('pencil', t('Edit'), () => a.setReading(false), { on: !reading }),
      big('book', t('Read mode'), () => a.setReading(true), { on: reading }),
    ]),
    group('focus', t('Immersive'), big('focus-centered', t('Focus'), () => setDocView({ focus: !view.focus }), { on: view.focus, title: view.focus ? t('Exit Focus') : t('Focus') })),
    group('zoom', t('Zoom'), [
      tool('zoom-out', t('Zoom out'), () => stepZoom(-1), { off: view.zoom <= ZOOMS[0] }),
      <button key="zoom" type="button" class="rb-zoom" title={t('Back to 100%')} aria-label={t('Back to 100%')} onClick={() => setDocView({ zoom: 1 })}>
        {zoom}%
      </button>,
      tool('zoom-in', t('Zoom in'), () => stepZoom(1), { off: view.zoom >= ZOOMS[ZOOMS.length - 1] }),
    ], 'rb-zooms'),
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
    // what an @ suggests takes the bar's place
    if (p.swapped) return exit || null;
    const picture = shown === 'context';
    const away = p.away && !picture;
    return (
      <>
        <div
          class={`format-bar ribbon is-phone${away ? ' is-tucked' : ''}${picture ? ' is-context' : ''}`}
          inert={away}
          role="toolbar"
          aria-label={name}
          {...hold}
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
      <div key={shown} class="rb-panel" role="tabpanel" id="rb-panel" aria-labelledby={'rb-tab-' + shown} ref={scroller}>
        {panel}
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
      <div class={`format-bar ribbon is-wide${collapsed ? ' is-collapsed' : ''}${peek ? ' is-peeking' : ''}${view.focus ? ' is-focus' : ''}`} role="region" aria-label={t('Ribbon')}>
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
      {exit}
    </>
  );
}
