import { useEffect, useRef, useState } from 'preact/hooks';
import { useLens } from '../lib/glass';
import { navigateAfterSheet, pushBack } from '../lib/router';
import { Icon, type UiName } from './icons';

const ADD: [to: string, label: string, sub: string, icon: UiName][] = [
  ['note/new', 'Note', 'Write about your day', 'pencil'],
  ['tracker', 'Check-in', 'How you feel right now', 'mood-plus'],
  ['person/new', 'Person', 'Someone who matters', 'user-plus'],
  ['books?add', 'Book', 'Read, reading or wanted', 'books'],
];

const CLOSE_MS = 340;

/**
 * The "+" button and the little menu it opens: a stack of glass tiles that unfolds from
 * the button in the corner. Lives inside the tab bar's `.nav`, which it is positioned against.
 */
export function AddMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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
    const t = setTimeout(() => setClosing(false), CLOSE_MS);
    return () => clearTimeout(t);
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
        aria-label="Add"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span class="nav-plus"><Icon name="plus" size={26} stroke={2} /></span>
      </button>
      {(open || closing) && (
        <>
          <div ref={scrim} class={`add-scrim${open ? '' : ' closing'}`} onClick={() => onOpenChange(false)} />
          <div ref={menu} class={`add-menu${open ? '' : ' closing'}`} role="menu" aria-label="Add" onKeyDown={arrows} style={{ '--n': ADD.length }}>
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
