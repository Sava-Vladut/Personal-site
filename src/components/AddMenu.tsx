import { useEffect, useRef, useState } from 'preact/hooks';
import { useLens } from '../lib/glass';
import { navigateAfterSheet, pushBack } from '../lib/router';
import { Icon, type UiName } from './icons';
import { haptic } from '../lib/haptics';
import { t } from '../lib/i18n';

const ADD: [to: string, label: string, sub: string, icon: UiName][] = [
  ['note/new', t('Note'), t('Write about your day'), 'pencil'],
  ['tracker', t('Check-in'), t('How you feel right now'), 'mood-plus'],
  ['person/new', t('Person'), t('Someone who matters'), 'user-plus'],
  ['media?tab=books&add', t('Book'), t('Read, reading or wanted'), 'books'],
  ['media?tab=music&add', t('Music'), t('A song, album or playlist'), 'vinyl'],
];

const CLOSE_MS = 340;

/**
 * The "+ New" button and the little menu it opens: a stack of glass tiles that unfolds under
 * the button at the top of the desktop sidebar. (On phones it's AddFan, below.)
 */
export function AddMenu({ open, onOpenChange, label }: { open: boolean; onOpenChange: (open: boolean) => void; label?: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const wasOpen = useRef(false);
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
    const timer = setTimeout(() => setClosing(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const release = pushBack(() => onOpenChange(false));
    const b = button.current!.getBoundingClientRect();
    scrim.current?.style.setProperty('--ox', `${b.left + b.width / 2}px`);
    scrim.current?.style.setProperty('--oy', `${b.top + b.height / 2}px`);
    const raf = requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus({ preventScroll: true }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    addEventListener('keydown', onKey);
    return () => {
      release();
      cancelAnimationFrame(raf);
      removeEventListener('keydown', onKey);
      if (menu.current?.contains(document.activeElement)) button.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const pick = (to: string) => {
    navigateAfterSheet(to);
    onOpenChange(false);
  };
  const arrows = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const items = [...menu.current!.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + step + items.length) % items.length].focus();
  };

  return (
    <>
      <button
        ref={button}
        class="nav-new glass glass-btn tinted"
        onClick={() => onOpenChange(!open)}
        aria-label={t('Add')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span class="nav-plus"><Icon name="plus" size={26} stroke={2} /></span>
        {label && <span class="nav-new-label">{label}</span>}
      </button>
      {(open || closing) && (
        <>
          <div ref={scrim} class={`add-scrim${open ? '' : ' closing'}`} onClick={() => onOpenChange(false)} />
          <div ref={menu} class={`add-menu${open ? '' : ' closing'}`} role="menu" aria-label={t('Add')} onKeyDown={arrows} style={{ '--n': ADD.length }}>
            {ADD.map(([to, label, sub, icon], k) => (
              <div class="add-item" role="none" style={{ '--k': k }}>
                <button class="add-tile glass" role="menuitem" onClick={() => pick(to)}>
                  <span class="add-icon"><Icon name={icon} size={20} stroke={1.8} /></span>
                  <span class="add-text"><b>{label}</b><small>{sub}</small></span>
                  <Icon name="arrow-up-right" size={16} class="add-go" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ---------- the fan: the phone's + button, alone in the middle of the bottom ---------- */

// left to right along the arc, the most used in the middle; each wears a world's colour
const FAN: [to: string, label: string, sub: string, icon: UiName, hue: string][] = [
  ['person/new', t('Person'), t('Someone who matters'), 'user-plus', 'love-connection'],
  ['tracker', t('Check-in'), t('How you feel right now'), 'mood-plus', 'calm-safety'],
  ['note/new', t('Note'), t('Write about your day'), 'pencil', 'hope-interest'],
  ['media?tab=books&add', t('Book'), t('Read, reading or wanted'), 'books', 'sadness'],
  ['media?tab=music&add', t('Music'), t('A song, album or playlist'), 'vinyl', 'fear'],
];
const SPREAD = 140;   // degrees the arc covers, centred straight up
const PICK_MS = 300;  // the chosen bubble's moment before the page changes
const SLIDE = 12;     // a finger that moves further than this while pressing is choosing by sliding

/**
 * The + button and the fan of bubbles it opens above itself. Tap a bubble, or press the + and slide
 * onto one and let go; arrows move between them from the keyboard.
 */
export function AddFan({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const fan = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!open) return;
    const release = pushBack(() => onOpenChange(false));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    addEventListener('keydown', onKey);
    return () => {
      release();
      removeEventListener('keydown', onKey);
      if (fan.current?.contains(document.activeElement)) button.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const pick = (k: number) => {
    if (picked !== null) return;
    haptic(12);
    setPicked(k);
    setHot(k);
    // the bubble swells and the rest fall away, then the page changes
    setTimeout(() => {
      navigateAfterSheet(FAN[k][0]);
      onOpenChange(false);
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : PICK_MS);
  };

  // pressing the +: opens the fan at once, and a finger slid onto a bubble picks it when lifted
  const under = (x: number, y: number) => {
    const k = document.elementFromPoint(x, y)?.closest('[data-fan]')?.getAttribute('data-fan');
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
    const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const items = [...fan.current!.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + step + items.length) % items.length].focus();
  };

  const shown = open || closing;
  const info = hot !== null ? FAN[hot] : null;
  return (
    <>
      {shown && <div class={`fan-scrim${open ? '' : ' closing'}`} onClick={() => onOpenChange(false)} />}
      <button
        ref={button}
        class="nav-new fan-btn glass glass-btn tinted"
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
          if (!open) requestAnimationFrame(() => fan.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus({ preventScroll: true }));
        }}
      >
        <span class="nav-plus"><Icon name="plus" size={28} stroke={2} /></span>
      </button>
      {shown && (
        <div
          ref={fan}
          class={`fan${open ? '' : ' closing'}${picked !== null ? ' picked' : ''}`}
          role="menu"
          aria-label={t('Add')}
          onKeyDown={arrows}
          style={{ '--n': FAN.length }}
        >
          <div class={`fan-caption glass${info ? ' on' : ''}`} aria-hidden="true">
            {info ? <><b>{info[1]}</b><small>{info[2]}</small></> : <small>{t('Tap one, or slide from the +')}</small>}
          </div>
          {FAN.map(([, label, , icon, hue], k) => {
            const a = ((k / (FAN.length - 1) - 0.5) * SPREAD * Math.PI) / 180;
            return (
              <div
                class={`fan-item${hot === k ? ' hot' : ''}${picked === k ? ' chosen' : ''}`}
                role="none"
                style={{ '--x': `calc(${Math.sin(a).toFixed(3)} * var(--r))`, '--y': `calc(${(-Math.cos(a)).toFixed(3)} * var(--r))`, '--k': k, '--d': Math.abs(k - (FAN.length - 1) / 2), '--c': `var(--emo-${hue})` }}
              >
                <button
                  class="fan-bubble glass"
                  role="menuitem"
                  data-fan={k}
                  onClick={() => pick(k)}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setHot(k)}
                  onPointerLeave={(e) => e.pointerType === 'mouse' && setHot((h) => (h === k ? null : h))}
                  onFocus={() => setHot(k)}
                >
                  <Icon name={icon} size={24} stroke={1.8} />
                </button>
                <span class="fan-label">{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
