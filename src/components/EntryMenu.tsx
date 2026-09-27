import { useEffect, useRef } from 'preact/hooks';
import { EMOTION, shortName } from '../data/emotions';
import { plainText } from '../lib/body';
import { rangeLabel, timeLabel, dayLabel } from '../lib/dates';
import { stripMarkdown } from '../lib/markdown';
import { navigate } from '../lib/router';
import { deleteEntry, observable, saveEntry, toast, uid, type Entry } from '../lib/store';
import { Icon } from './icons';
import { Sheet } from './Sheet';

const HOLD_MS = 450;

const menu$ = observable<Entry | null>(null);

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
  const open = (touch: boolean) => {
    cancel();
    held.current = true;
    if (touch) swallowLiftClick();
    navigator.vibrate?.(10);
    menu$.set(e);
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
      if (!held.current) open(touch.current); // Android fires this for a long press too
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

/** The options for the entry that was held. Rendered once, by the app. */
export function EntryMenu() {
  const e = menu$.use();
  // keep showing the last entry while the sheet slides away
  const last = useRef(e);
  if (e) last.current = e;
  const shown = e ?? last.current;
  const close = () => menu$.set(null);
  if (!shown) return null;

  const isNote = shown.kind === 'note';
  const text = stripMarkdown(plainText(shown.text)).trim();
  const em = shown.emotions[0] ? EMOTION[shown.emotions[0]] : null;
  const name = isNote
    ? shown.title.trim() || text.split('\n')[0].slice(0, 60) || 'Untitled'
    : em ? (em.depth === 0 ? shortName(em.id) : em.name) : 'Check-in';
  const when = shown.dateEnd ? rangeLabel(shown.date, shown.dateEnd) : `${dayLabel(shown.date)} · ${timeLabel(shown.time)}`;
  const shareText = [shown.title.trim(), plainText(shown.text).trim()].filter(Boolean).join('\n\n');

  const run = (f: () => unknown) => () => {
    close();
    f();
  };

  const duplicate = async () => {
    const now = Date.now();
    const copy = await saveEntry({ ...shown, id: uid(), title: shown.title.trim() ? `${shown.title.trim()} (copy)` : '', time: shown.time + 1, created: now, updated: now });
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
  const share = () => navigator.share({ title: shown.title.trim() || undefined, text: shareText }).catch(() => {});
  const remove = async () => {
    const removed = await deleteEntry(shown.id);
    if (removed) toast(isNote ? 'Note deleted' : 'Check-in deleted', { label: 'Undo', run: () => saveEntry(removed) });
  };

  return (
    <Sheet
      open={!!e}
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
        {isNote && (
          <button class="list-row action" onClick={run(duplicate)}><span class="row gap-s"><Icon name="copy-plus" size={18} /> Duplicate</span></button>
        )}
        {shareText && (
          <button class="list-row action" onClick={run(copyText)}><span class="row gap-s"><Icon name="copy" size={18} /> Copy text</span></button>
        )}
        {shareText && 'share' in navigator && (
          <button class="list-row action" onClick={run(share)}><span class="row gap-s"><Icon name="share" size={18} /> Share</span></button>
        )}
        <button class="list-row action danger" onClick={run(remove)}>
          <span class="row gap-s"><Icon name="trash" size={18} /> {isNote ? 'Delete note' : 'Delete check-in'}</span>
        </button>
      </div>
    </Sheet>
  );
}
