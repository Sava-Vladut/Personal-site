import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons';
import { keepFocus } from './ribbon/keepFocus';
import { Ribbon } from './ribbon/Ribbon';
import type { NoteBodyHandle } from '../editor/NoteBody';
import { t } from '../lib/i18n';
// the bar's own styles, wherever it's used (an @ in a person's or a book's page too, before any note has been opened)
import '../styles/ribbon.css';

/** What the note editor gives its ribbon: the note's own commands, around the text ones the editor has. */
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
  /** the song playing on Spotify right now, in one tap */
  addNowPlaying: () => void;
  /** how the note feels: the feelings picker */
  addMood: () => void;
  /** tags someone, a book or music (@) */
  mention: () => void;
  /** links another note ([[) */
  linkNote: () => void;
  mentionBook: () => void;
  /** a mind trap, a law of power or a Carnegie principle, picked from the whole list */
  insertRef: (kind: 'trap' | 'law' | 'principle') => void;
  /** the Link sheet: a web link on the words at the caret */
  link: () => void;
}

/** Where the words are written: the note's text, its title, or a person's or a book's text box. */
const WRITING = '.note-editor, .body-input, .title-input';

/**
 * The bar at the bottom while an @ is being typed in a person's or a book's text (`swap`: what it suggests), riding up
 * on top of a phone's keyboard.
 *
 * Given `ribbon`, the note's commands, it's the note editor's ribbon instead, the way Word has it (components/ribbon/
 * Ribbon.tsx): Home, Insert and View tabs, and a tab for the selected picture (`context`) while there is one. On a
 * computer it sits across the top of the page; on a phone it's a bar docked above the keyboard, tucked away while
 * reading down the note. What an @ suggests (`swap`) still shows as a strip of its own near the bottom. `note` is the
 * note's editor: its commands, and what's lit at the caret.
 */
export function FormatBar({ swap, swapLabel = t('Picture'), ribbon, context, note }: {
  swap?: ComponentChildren;
  swapLabel?: string;
  ribbon?: RibbonActions;
  /** a tab of its own for what's selected, as Word's Picture tab: its name and its tools */
  context?: { label: string; content: ComponentChildren };
  note?: NoteBodyHandle | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tucked, setTucked] = useState(false);
  const [writing, setWriting] = useState(false);
  const [onBar, setOnBar] = useState(false); // a button of the bar has the focus: tapping one mustn't put the bar away
  const [lit, setLit] = useState(() => note?.lit() ?? null);
  // the phone's keyboard on its way up: the bar waits for it, then comes up once, where it'll stay (rather than rising
  // from the bottom of the screen and snapping up when the keyboard's height is known)
  const [kbWait, setKbWait] = useState(false);
  const kbUp = useRef(false);
  const noteNow = useRef(note);
  noteNow.current = note;

  useEffect(() => (note ? note.watch(setLit) : undefined), [note]);

  useLayoutEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    let frame = 0, reveal = 0, lastKb = 0;
    const place = () => {
      if (!vv.width || !vv.height) return;
      const layoutHeight = Math.max(innerHeight, document.documentElement.clientHeight);
      const kb = Math.max(0, Math.round(layoutHeight - vv.height - vv.offsetTop));
      el.style.setProperty('--kb', kb + 'px');
      kbUp.current = kb > 80;
      if (kb !== lastKb) setKbWait(false);
      // the keyboard came up over the caret's line: once the bar is above it, the caret is brought back into view
      if (kb > lastKb + 80 && noteNow.current?.focused()) {
        cancelAnimationFrame(reveal);
        reveal = requestAnimationFrame(() => (reveal = requestAnimationFrame(() => noteNow.current?.reveal())));
      }
      lastKb = kb;
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
      cancelAnimationFrame(reveal);
      vv.removeEventListener('resize', place);
      vv.removeEventListener('scroll', place);
      removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
    };
  }, []);

  // The strip's scroller starts at its first suggestion.
  useLayoutEffect(() => {
    const scroll = ref.current?.querySelector('.format-scroll');
    if (scroll) scroll.scrollLeft = 0;
  }, [!!swap, swapLabel]);

  // Whether a note's words are being written: the bar then offers to put the keyboard away, and it shows at all.
  useEffect(() => {
    const text = (n: EventTarget | null) => !!(n as Element | null)?.closest?.(WRITING);
    const bar = (n: EventTarget | null) => !!(n as Element | null)?.closest?.('.format-bar');
    // A tap on the bar under way: if the focus still leaves for nowhere (a browser that doesn't focus buttons and
    // didn't keep it in the text), the bar stays until the tap's click has landed.
    let pressing = false, was = false, wait = 0;
    const coarse = matchMedia('(pointer: coarse)');
    const into = (e: FocusEvent) => {
      const now = text(e.target);
      // writing starts on a touch screen with no keyboard up yet: it's coming (or, if it never says so, a moment)
      if (now && !was && coarse.matches && !kbUp.current) {
        setKbWait(true);
        clearTimeout(wait);
        wait = setTimeout(() => setKbWait(false), 450);
      }
      was = now;
      setWriting(now);
      setOnBar(bar(e.target));
    };
    const out = (e: FocusEvent) => {
      was = text(e.relatedTarget);
      setWriting(was);
      setOnBar(bar(e.relatedTarget) || (pressing && !e.relatedTarget));
    };
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
      clearTimeout(wait);
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
      const writing = !!(document.activeElement as Element | null)?.closest?.(WRITING);
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

  const done = writing && (
    <button
      class="format-btn format-done"
      aria-label={t('Hide keyboard')}
      title={t('Hide keyboard')}
      onClick={() => (document.activeElement as HTMLElement | null)?.blur?.()}
    >
      <Icon name="keyboard-hide" size={18} />
    </button>
  );

  // Page entrance transforms temporarily turn fixed descendants into page-relative
  // elements. Keep this keyboard accessory at the document level throughout editing.
  const away = tucked || kbWait || !(writing || onBar);
  if (ribbon) {
    // a wrapper of no box of its own, carrying the keyboard's height to the ribbon and the strip
    return createPortal(
      <div ref={ref} class="ribbon-root">
        <Ribbon actions={ribbon} context={context} swapped={!!swap} cmds={note?.cmds ?? null} lit={lit} away={away} done={done} />
        {/* on a phone it docks above the keyboard as the ribbon's bar does; on a computer it floats near the bottom */}
        {swap && (
          <div class="format-bar is-swapped is-strip in-ribbon" role="toolbar" aria-label={swapLabel} {...keepFocus}>
            <div class="format-scroll">{swap}</div>
          </div>
        )}
      </div>,
      document.body,
    );
  }
  if (!swap) return null;
  return createPortal(
    <div ref={ref} class="format-bar is-swapped is-strip" role="toolbar" aria-label={swapLabel} {...keepFocus}>
      <div class="format-scroll">{swap}</div>
    </div>,
    document.body,
  );
}
