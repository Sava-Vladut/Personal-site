import { useEffect, useState } from 'preact/hooks';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { t } from '../lib/i18n';
import type { NoteBodyHandle, Outline } from '../editor/NoteBody';

/**
 * Word's Navigation pane (View › Navigation pane): the note's headings, each indented by its level, the one the caret
 * is under lit, kept up to date as the note changes. A click goes there, the caret at the heading's start. On a
 * computer it's a pane at the left of the page; on a phone, a sheet.
 */
export function NavPane({ note, open, wide, onClose }: { note: NoteBodyHandle | null; open: boolean; wide: boolean; onClose: () => void }) {
  const [o, setO] = useState<Outline>({ headings: [], current: -1 });
  useEffect(() => (open && note ? note.outline.watch(setO) : undefined), [note, open]);

  const list = o.headings.length ? (
    <ol class="nav-list">
      {o.headings.map((h, i) => (
        <li key={h.pos + ':' + i}>
          <button
            type="button"
            class={`nav-item is-h${h.level}`}
            style={{ '--lvl': h.level - 1 }}
            aria-current={i === o.current ? 'location' : undefined}
            onClick={() => {
              note?.outline.go(h.pos);
              if (!wide) onClose();
            }}
          >
            {h.text}
          </button>
        </li>
      ))}
    </ol>
  ) : (
    <p class="nav-empty">{t('No headings yet. Give a line a heading style (Home › Styles) and it shows here.')}</p>
  );

  if (!wide) return <Sheet open={open} onClose={onClose} title={t('Navigation')}>{list}</Sheet>;
  if (!open) return null;
  return (
    <aside class="nav-pane" aria-label={t('Navigation')}>
      <header class="nav-head">
        <span>{t('Navigation')}</span>
        <button type="button" class="format-btn" aria-label={t('Close')} title={t('Close')} onClick={onClose}>
          <Icon name="x" size={16} />
        </button>
      </header>
      <div class="nav-scroll">{list}</div>
    </aside>
  );
}
