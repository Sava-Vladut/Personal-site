// Insert › Mind trap or Law of power: every trap (or law) in a list to search, one tap puts it in the note as a link.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { searchKey } from '../lib/mentions';
import { useRefs, type Ref, type RefKind } from '../lib/refs';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { t } from '../lib/i18n';

export function RefSheet({ kind, onClose, onPick }: { kind: RefKind | null; onClose: () => void; onPick: (r: Ref) => void }) {
  const list = useRefs(!!kind);
  const [q, setQ] = useState('');
  // the last kind, while the sheet slides away
  const [shown, setShown] = useState<RefKind>('trap');
  useEffect(() => {
    if (kind) setShown(kind), setQ('');
  }, [kind]);
  const trap = shown === 'trap';
  const rows = useMemo(() => {
    const needle = searchKey(q);
    return (list ?? []).filter((r) => r.kind === shown && (!needle || searchKey(`${r.id} ${r.name} ${r.line}`).includes(needle)));
  }, [list, shown, q]);

  return (
    <Sheet open={!!kind} onClose={onClose} title={trap ? t('Insert a mind trap') : t('Insert a law of power')} tall>
      <label class="search">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder={trap ? t('Search mind traps') : t('Search laws, or a number')}
          value={q}
          onInput={(e) => setQ(e.currentTarget.value)}
          aria-label={trap ? t('Search mind traps') : t('Search laws, or a number')}
        />
      </label>
      {!list && <p class="hint center">{t('Loading…')}</p>}
      {list && !rows.length && <p class="hint center">{t('Nothing with that name')}</p>}
      <div class="book-rows ref-rows">
        {rows.map((r) => (
          <button key={r.id} class="book-row" style={{ '--c': `var(--emo-${r.hue})` }} onClick={() => onPick(r)}>
            <span class="ref-row-icon">{trap ? <Icon name="spiral" size={18} /> : <b>{r.id}</b>}</span>
            <span class="book-row-main">
              <span class="book-row-title">{r.name}</span>
              <span class="book-row-sub">{r.line}</span>
            </span>
            <span class="track-end"><Icon name="plus" size={18} /></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
