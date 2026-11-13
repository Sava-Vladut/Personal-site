// The site's one dropdown: a button (each place dresses it its own way: a chip, an icon, a field) that opens a short
// glass list of choices under it, styled like the right-click menu (.ctx-menu in app.css), the same on every device.
// It replaces the platform's own <select>, whose list each browser and OS drew differently.
import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons';

/** A choice; `group` starts a small heading above it (when it differs from the one before). */
export type Choice<V extends string = string> = { value: V; label: string; group?: string };

export function Select<V extends string>({ value, options, onChange, label, class: cls = '', title, children }: {
  value: V;
  options: Choice<V>[];
  onChange: (v: V) => void;
  /** what it chooses, for screen readers (and the list's name) */
  label: string;
  class?: string;
  title?: string;
  /** the button's face; the chosen label by default */
  children?: ComponentChildren;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxH: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const at = options.findIndex((o) => o.value === value);

  const close = (refocus = true) => {
    setOpen(false);
    setPos(null);
    if (refocus) btn.current?.focus({ preventScroll: true });
  };
  const pick = (v: V) => {
    close();
    if (v !== value) onChange(v);
  };

  // under the button, or above it when there's more room there; never off the screen's sides
  useLayoutEffect(() => {
    if (!open || !btn.current || !list.current) return;
    const r = btn.current.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight, gap = 6, edge = 8;
    const below = vh - r.bottom - gap - edge, above = r.top - gap - edge;
    const h = list.current.scrollHeight;
    const up = h > below && above > below;
    const maxH = Math.min(h, up ? above : below, 360);
    const width = Math.max(r.width, list.current.offsetWidth);
    const left = Math.max(edge, Math.min(r.left, vw - width - edge));
    setPos({ left, top: up ? r.top - gap - maxH : r.bottom + gap, width: r.width, maxH, up });
  }, [open]);

  // the chosen one in view and focused; a tap elsewhere, a scroll of the page or a resize closes it
  useEffect(() => {
    if (!open || !pos) return;
    const items = list.current!.querySelectorAll<HTMLElement>('[role="option"]');
    const cur = items[Math.max(0, at)];
    cur?.scrollIntoView({ block: 'nearest' });
    cur?.focus({ preventScroll: true });
    const away = (e: Event) => {
      const n = e.target as Node;
      if (!list.current?.contains(n) && !btn.current?.contains(n)) close(false);
    };
    const shut = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) close(false);
    };
    const resize = () => close(false);
    addEventListener('pointerdown', away, true);
    addEventListener('scroll', shut, true);
    addEventListener('resize', resize);
    return () => {
      removeEventListener('pointerdown', away, true);
      removeEventListener('scroll', shut, true);
      removeEventListener('resize', resize);
    };
  }, [open, !!pos]);

  const onListKey = (e: KeyboardEvent) => {
    const items = [...list.current!.querySelectorAll<HTMLElement>('[role="option"]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => (e.preventDefault(), items[Math.max(0, Math.min(items.length - 1, n))]?.focus());
    if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), close());
    else if (e.key === 'Tab') close();
    else if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home' || e.key === 'PageUp') go(0);
    else if (e.key === 'End' || e.key === 'PageDown') go(items.length - 1);
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      // a letter jumps to the next choice starting with it
      const k = e.key.toLowerCase();
      const n = items.findIndex((el, j) => j > i && el.textContent!.trim().toLowerCase().startsWith(k));
      const m = n >= 0 ? n : items.findIndex((el) => el.textContent!.trim().toLowerCase().startsWith(k));
      if (m >= 0) go(m);
    }
  };

  const onBtnKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') (e.preventDefault(), setOpen(true));
  };

  let lastGroup: string | undefined;
  return (
    <>
      <button
        ref={btn}
        type="button"
        class={cls}
        title={title}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => (e.preventDefault(), open ? close() : setOpen(true))}
        onKeyDown={onBtnKey}
      >
        {children ?? (
          <>
            <span class="select-text">{options[at]?.label ?? ''}</span>
            <Icon name="chevron-down" size={14} />
          </>
        )}
      </button>
      {open && createPortal(
        <div
          ref={list}
          id={id}
          class={`ctx-menu glass select-menu${pos?.up ? ' is-up' : ''}`}
          role="listbox"
          aria-label={label}
          style={pos ? { left: pos.left, top: pos.top, minWidth: pos.width, maxHeight: pos.maxH } : { left: 0, top: 0, visibility: 'hidden' }}
          onKeyDown={onListKey}
          onContextMenu={(e) => e.preventDefault()}
        >
          {options.map((o) => {
            const head = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            return (
              <>
                {head && <div class="select-group" role="presentation">{head}</div>}
                <button
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={o.value === value}
                  class="ctx-item select-item"
                  onClick={() => pick(o.value)}
                >
                  <span class="grow">{o.label}</span>
                  {o.value === value && <Icon name="check" size={16} />}
                </button>
              </>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
