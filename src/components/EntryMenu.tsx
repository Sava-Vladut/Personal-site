import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { EMOTION, shortName } from '../data/emotions';
import { plainText } from '../lib/body';
import { rangeLabel, timeLabel, dayLabel } from '../lib/dates';
import { stripMarkdown } from '../lib/markdown';
import { navigate } from '../lib/router';
import { deleteEntry, observable, saveEntry, toast, uid, type Entry } from '../lib/store';
import { Icon, type UiName } from './icons';
import { Sheet } from './Sheet';

const HOLD_MS = 450;

/** The held entry, and where the mouse right-clicked it: a mouse gets a small menu there, a finger gets a sheet. */
const menu$ = observable<{ e: Entry; at?: { x: number; y: number } } | null>(null);

/**
 * Tap opens the entry; holding it (or right-clicking) brings up its options instead.
 * Spread the result onto the entry's button.
 */
export function useHold(e: Entry, onTap: () => void) {
  const timer = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const held = useRef(false);
  const touch = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };
  const open = (touch: boolean, at?: { x: number; y: number }) => {
    cancel();
    held.current = true;
    if (touch) swallowLiftClick();
    navigator.vibrate?.(10);
    getSelection()?.removeAllRanges();
    menu$.set({ e, at: touch ? undefined : at });
  };
  return {
    onPointerDown(ev: PointerEvent) {
      held.current = false;
      touch.current = ev.pointerType !== 'mouse';
      if (!touch.current || !ev.isPrimary) return; // a mouse right-clicks instead
      start.current = { x: ev.clientX, y: ev.clientY };
      timer.current = setTimeout(() => open(true), HOLD_MS);
    },
    onPointerMove(ev: PointerEvent) {
      const s = start.current;
      if (s && Math.hypot(ev.clientX - s.x, ev.clientY - s.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel, // the list started scrolling
    onContextMenu(ev: MouseEvent) {
      ev.preventDefault();
      if (held.current) return; // Android fires this for a long press too
      let at = { x: ev.clientX, y: ev.clientY };
      if (!at.x && !at.y) {
        // the keyboard's menu key: open it at the entry's corner
        const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
        at = { x: r.left + 16, y: r.top + 16 };
      }
      open(touch.current, at);
    },
    onClick() {
      if (held.current) held.current = false;
      else onTap();
    },
  };
}

/** The finger lifting after a hold still clicks, and by then the sheet's backdrop is under it: don't let that close the sheet. */
function swallowLiftClick() {
  const stop = (ev: Event) => {
    ev.stopPropagation();
    ev.preventDefault();
  };
  const lifted = () => {
    removeEventListener('pointerup', lifted, true);
    removeEventListener('pointercancel', lifted, true);
    setTimeout(() => removeEventListener('click', stop, true), 350);
  };
  addEventListener('click', stop, { capture: true, once: true });
  addEventListener('pointerup', lifted, true);
  addEventListener('pointercancel', lifted, true);
}

/** Deletes an entry, with a toast to bring it back. */
export async function removeEntry(e: Entry) {
  const removed = await deleteEntry(e.id);
  if (removed) toast(e.kind === 'note' ? 'Note deleted' : 'Check-in deleted', { label: 'Undo', run: () => saveEntry(removed) });
}

/** Pins a note to the top of the journal, or lets it go back to its day. */
export async function togglePin(e: Entry) {
  const pinned = !e.pinned;
  const saved = await saveEntry({ ...e, pinned });
  toast(pinned ? 'Pinned to the top' : 'Unpinned', { label: 'Undo', run: () => saveEntry({ ...saved, pinned: !pinned }) });
}

/** The options for the entry that was held. Rendered once, by the app. */
export function EntryMenu() {
  const m = menu$.use();
  // keep showing the last entry while the sheet slides away
  const last = useRef(m);
  if (m) last.current = m;
  const shown = m ?? last.current;
  const close = () => {
    getSelection()?.removeAllRanges();
    menu$.set(null);
  };
  if (!shown) return null;

  const { e: entry, at } = shown;
  const isNote = entry.kind === 'note';
  const text = stripMarkdown(plainText(entry.text)).trim();
  const em = entry.emotions[0] ? EMOTION[entry.emotions[0]] : null;
  const name = isNote
    ? entry.title.trim() || text.split('\n')[0].slice(0, 60) || 'Untitled'
    : em ? (em.depth === 0 ? shortName(em.id) : em.name) : 'Check-in';
  const when = entry.dateEnd ? rangeLabel(entry.date, entry.dateEnd) : `${dayLabel(entry.date)} · ${timeLabel(entry.time)}`;
  const shareText = [entry.title.trim(), plainText(entry.text).trim()].filter(Boolean).join('\n\n');

  const duplicate = async () => {
    const now = Date.now();
    const copy = await saveEntry({ ...entry, id: uid(), title: entry.title.trim() ? `${entry.title.trim()} (copy)` : '', time: entry.time + 1, created: now, updated: now });
    toast('Note duplicated', { label: 'Open', run: () => navigate('note/' + copy.id) });
  };
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast('Copied');
    } catch {
      toast('Couldn’t copy');
    }
  };
  const share = () => navigator.share({ title: entry.title.trim() || undefined, text: shareText }).catch(() => {});

  const actions: { icon: UiName; label: string; run: () => unknown; danger?: boolean }[] = [];
  if (isNote) actions.push({ icon: entry.pinned ? 'pinned-off' : 'pin', label: entry.pinned ? 'Unpin' : 'Pin to the top', run: () => togglePin(entry) });
  if (isNote) actions.push({ icon: 'copy-plus', label: 'Duplicate', run: duplicate });
  if (shareText) actions.push({ icon: 'copy', label: 'Copy text', run: copyText });
  if (shareText && 'share' in navigator) actions.push({ icon: 'share', label: 'Share', run: share });
  actions.push({ icon: 'trash', label: isNote ? 'Delete note' : 'Delete check-in', run: () => removeEntry(entry), danger: true });
  const run = (f: () => unknown) => () => {
    close();
    f();
  };

  if (at) return <ContextMenu key={entry.id + at.x + at.y} at={at} open={!!m} onClose={close} label={`Options for ${name}`} actions={actions.map((a) => ({ ...a, run: run(a.run) }))} />;

  return (
    <Sheet
      open={!!m}
      onClose={close}
      label={`Options for ${name}`}
      title={
        <span class="menu-head">
          <span class="menu-name">{name}</span>
          <span class="menu-when">{when}</span>
        </span>
      }
    >
      <div class="card list menu-list">
        {actions.map((a) => (
          <button class={`list-row action${a.danger ? ' danger' : ''}`} onClick={run(a.run)}>
            <span class="row gap-s"><Icon name={a.icon} size={18} /> {a.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** A mouse's right-click menu: opens at the pointer, kept inside the window, and leaves the page where it is. */
function ContextMenu({ at, open, onClose, label, actions }: {
  at: { x: number; y: number };
  open: boolean;
  onClose: () => void;
  label: string;
  actions: { icon: UiName; label: string; run: () => void; danger?: boolean }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const el = ref.current!;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    const left = at.x + width + pad > innerWidth ? Math.max(pad, at.x - width) : at.x;
    const top = at.y + height + pad > innerHeight ? Math.max(pad, at.y - height) : at.y;
    setPos({ left, top });
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    const away = (ev: Event) => {
      if (!ref.current?.contains(ev.target as Node)) closeRef.current();
    };
    const shut = () => closeRef.current();
    addEventListener('pointerdown', away, true);
    addEventListener('contextmenu', away, true);
    addEventListener('scroll', shut, true);
    addEventListener('resize', shut);
    addEventListener('blur', shut);
    return () => {
      removeEventListener('pointerdown', away, true);
      removeEventListener('contextmenu', away, true);
      removeEventListener('scroll', shut, true);
      removeEventListener('resize', shut);
      removeEventListener('blur', shut);
      if (document.activeElement === document.body || ref.current?.contains(document.activeElement)) prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (ev: KeyboardEvent) => {
    const items = [...ref.current!.querySelectorAll<HTMLElement>('button')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => (ev.preventDefault(), items[(n + items.length) % items.length]?.focus());
    if (ev.key === 'Escape' || ev.key === 'Tab') (ev.preventDefault(), onClose());
    else if (ev.key === 'ArrowDown') go(i + 1);
    else if (ev.key === 'ArrowUp') go(i - 1);
    else if (ev.key === 'Home') go(0);
    else if (ev.key === 'End') go(-1);
  };

  return (
    <div
      ref={ref}
      class="ctx-menu glass"
      role="menu"
      aria-label={label}
      style={pos ? { left: pos.left, top: pos.top } : { left: at.x, top: at.y, visibility: 'hidden' }}
      onKeyDown={onKeyDown}
      onContextMenu={(ev) => ev.preventDefault()}
    >
      {actions.map((a) => (
        <button role="menuitem" class={`ctx-item${a.danger ? ' danger' : ''}`} onClick={a.run}>
          <Icon name={a.icon} size={16} /> {a.label}
        </button>
      ))}
    </div>
  );
}
