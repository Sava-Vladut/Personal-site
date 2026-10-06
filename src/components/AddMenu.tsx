import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useLens } from '../lib/glass';
import { navigateAfterSheet, pushBack } from '../lib/router';
import { Icon, type UiName } from './icons';
import { haptic } from '../lib/haptics';
import { LOCALE, t } from '../lib/i18n';

// the first is the big one across the top; the rest share a grid. Each wears a world's colour.
const ADD: [to: string, label: string, sub: string, icon: UiName, hue: string][] = [
  ['note/new', t('Note'), t('Write about your day'), 'pencil', 'hope-interest'],
  ['tracker', t('Check-in'), t('How you feel right now'), 'mood-plus', 'calm-safety'],
  ['person/new', t('Person'), t('Someone who matters'), 'user-plus', 'love-connection'],
  ['media?tab=books&add', t('Book'), t('Read, reading or wanted'), 'books', 'sadness'],
  ['media?tab=music&add', t('Music'), t('A song, album or playlist'), 'vinyl', 'fear'],
];

const CLOSE_MS = 260;
const PICK_MS = 320; // the chosen tile's moment before the page changes
const SLIDE = 12;    // a finger that moves further than this while pressing is choosing by sliding

/**
 * The + button and the panel it opens: a sheet of glass that grows out of the button, with a note
 * across the top and the other things to add in a grid below. On phones the + sits alone in the
 * bottom bar and the panel rises above it; on desktop it's the sidebar's "New" and the panel drops
 * below it. Tap a tile, or press the + and slide onto one and let go; arrows move from the keyboard.
 */
export function AddMenu({ open, onOpenChange, label }: { open: boolean; onOpenChange: (open: boolean) => void; label?: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const [hot, setHot] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const wasOpen = useRef(false);
  const press = useRef<{ x: number; y: number; slid: boolean; opened: boolean } | null>(null);
  useLens(button, { strength: 14 });

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      setClosing(false);
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    setClosing(true);
    const timer = setTimeout(() => {
      setClosing(false);
      setHot(null);
      setPicked(null);
    }, CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // the panel grows from (and shrinks back into) the button, wherever the two sit
  useLayoutEffect(() => {
    if (!open || !panel.current || !button.current) return;
    const b = button.current.getBoundingClientRect();
    const p = panel.current.getBoundingClientRect();
    panel.current.style.setProperty('--ox', `${b.left + b.width / 2 - p.left}px`);
    panel.current.style.setProperty('--oy', `${b.top + b.height / 2 - p.top}px`);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const release = pushBack(() => onOpenChange(false));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    addEventListener('keydown', onKey);
    return () => {
      release();
      removeEventListener('keydown', onKey);
      if (panel.current?.contains(document.activeElement)) button.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const pick = (k: number) => {
    if (picked !== null) return;
    haptic(12);
    setPicked(k);
    setHot(k);
    // the tile fills with its colour while the rest fade, then the page changes
    setTimeout(() => {
      navigateAfterSheet(ADD[k][0]);
      onOpenChange(false);
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : PICK_MS);
  };

  // pressing the +: opens the panel at once, and a finger slid onto a tile picks it when lifted
  const under = (x: number, y: number) => {
    const k = document.elementFromPoint(x, y)?.closest('[data-add]')?.getAttribute('data-add');
    return k == null ? null : Number(k);
  };
  const down = (e: PointerEvent) => {
    if (e.button > 0) return;
    const opened = !open;
    press.current = { x: e.clientX, y: e.clientY, slid: false, opened };
    button.current?.setPointerCapture(e.pointerId);
    if (opened) {
      haptic(6);
      onOpenChange(true);
    }
  };
  const move = (e: PointerEvent) => {
    const p = press.current;
    if (!p) return;
    if (!p.slid && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLIDE) p.slid = true;
    if (!p.slid) return;
    const k = under(e.clientX, e.clientY);
    if (k !== hot) {
      if (k !== null) haptic(4);
      setHot(k);
    }
  };
  const up = (e: PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (p.slid) {
      const k = under(e.clientX, e.clientY);
      if (k !== null) pick(k);
      else setHot(null);
    } else if (!p.opened) onOpenChange(false); // a tap on the × closes
  };

  const arrows = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const items = [...panel.current!.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + step + items.length) % items.length].focus();
  };

  const tile = (k: number) => {
    const [, name, sub, icon, hue] = ADD[k];
    return (
      <button
        class={`add-tile${k === 0 ? ' add-hero' : ''}${hot === k ? ' hot' : ''}${picked === k ? ' chosen' : ''}`}
        role="menuitem"
        data-add={k}
        style={{ '--k': k, '--c': `var(--emo-${hue})` }}
        onClick={() => pick(k)}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHot(k)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHot((h) => (h === k ? null : h))}
        onFocus={() => setHot(k)}
        onBlur={() => setHot((h) => (h === k ? null : h))}
      >
        <span class="add-icon"><Icon name={icon} size={k === 0 ? 24 : 21} stroke={1.8} /></span>
        <span class="add-text"><b>{name}</b><small>{sub}</small></span>
        {k === 0 && <Icon name="arrow-up-right" size={18} class="add-go" />}
      </button>
    );
  };

  const shown = open || closing;
  const today = new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <>
      {shown && <div class={`add-scrim${open ? '' : ' closing'}`} onClick={() => onOpenChange(false)} />}
      <button
        ref={button}
        class="nav-new add-btn glass glass-btn tinted"
        aria-label={open ? t('Close') : t('Add')}
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerDown={(e) => down(e as PointerEvent)}
        onPointerMove={(e) => move(e as PointerEvent)}
        onPointerUp={(e) => up(e as PointerEvent)}
        onPointerCancel={() => (press.current = null)}
        // keyboards (and screen readers) click without a pointer
        onClick={(e) => {
          if (e.detail !== 0) return;
          onOpenChange(!open);
          if (!open) requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus({ preventScroll: true }));
        }}
      >
        <span class="nav-plus"><Icon name="plus" size={label ? 20 : 28} stroke={2} /></span>
        {label && <span class="nav-new-label">{label}</span>}
      </button>
      {shown && (
        <div
          ref={panel}
          class={`add-panel glass${open ? '' : ' closing'}${picked !== null ? ' picked' : ''}`}
          role="menu"
          aria-label={t('Add')}
          onKeyDown={arrows}
        >
          <div class="add-head" aria-hidden="true">
            <small>{today}</small>
            <b>{t('What would you like to keep?')}</b>
          </div>
          {tile(0)}
          <div class="add-grid" role="none">{ADD.slice(1).map((_, i) => tile(i + 1))}</div>
          <p class="add-hint" aria-hidden="true">{t('Tap one, or slide from the +')}</p>
        </div>
      )}
    </>
  );
}
