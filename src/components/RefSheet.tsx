// Insert › Mind trap, Law of power or Win friends: one sheet with a tab for each, every trap (law, or Win friends
// principle) with the mark its page shows, under its family (or part of the book), the ones put in lately first. Type
// to search, the arrow keys and Enter pick without the mouse; one tap puts it in the note as a link.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { searchKey } from '../lib/mentions';
import { useRefs, type Ref, type RefKind } from '../lib/refs';
import { useLocal } from './learn';
import { Icon, type UiName } from './icons';
import { Mark } from './Mark';
import { Sheet } from './Sheet';
import { t } from '../lib/i18n';

const KINDS: [RefKind, string, UiName][] = [
  ['trap', 'Mind traps', 'spiral'],
  ['law', 'Laws of power', 'crown'],
  ['principle', 'Win friends', 'heart-handshake'],
];
const keyOf = (r: Ref) => `${r.kind}:${r.id}`;

export function RefSheet({ kind, onClose, onPick }: { kind: RefKind | null; onClose: () => void; onPick: (r: Ref) => void }) {
  const list = useRefs(!!kind);
  const [q, setQ] = useState('');
  // the tab on show, kept while the sheet slides away
  const [shown, setShown] = useState<RefKind>('trap');
  const [active, setActive] = useState(0);
  // the arrow keys light a row; so does a search, whose top row Enter puts in
  const [keyed, setKeyed] = useState(false);
  const [recent, setRecent] = useLocal<string[]>('ref-recent', []);
  const input = useRef<HTMLInputElement>(null);
  const rowsEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!kind) return;
    setShown(kind), setQ(''), setActive(0), setKeyed(false);
    // straight to typing where there's a keyboard; a phone's would cover the list
    if (matchMedia('(pointer: fine)').matches) setTimeout(() => input.current?.focus(), 60);
  }, [kind]);

  const needle = searchKey(q);
  const hits = useMemo(
    () => (list ?? []).filter((r) => !needle || searchKey(`${r.id} ${r.name} ${r.sub} ${r.line}`).includes(needle)),
    [list, needle],
  );
  // what's on show, in sections: lately put in, then each family (or part); laws run in their own order, 1 to 48
  const sections = useMemo(() => {
    const mine = hits.filter((r) => r.kind === shown);
    if (needle) return [{ title: '', hue: '', items: mine }];
    const out: { title: string; hue: string; items: Ref[] }[] = [];
    const lately = recent.map((k) => mine.find((r) => keyOf(r) === k)).filter((r): r is Ref => !!r);
    if (lately.length) out.push({ title: t('Recent'), hue: '', items: lately });
    if (shown === 'law') out.push({ title: lately.length ? t('Laws of power') : '', hue: '', items: mine });
    else for (const r of mine) {
      const at = out.find((s) => s.title === t(r.sub));
      at ? at.items.push(r) : out.push({ title: t(r.sub), hue: r.hue, items: [r] });
    }
    return out;
  }, [hits, shown, needle, recent]);
  const flat = sections.flatMap((s) => s.items);

  const pick = (r: Ref) => {
    setRecent((now) => [keyOf(r), ...now.filter((k) => k !== keyOf(r))].slice(0, 5));
    onPick(r);
  };
  const go = (k: RefKind) => {
    setShown(k), setActive(0);
    rowsEl.current?.closest('.sheet-body')?.scrollTo({ top: 0 });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = Math.max(0, Math.min(flat.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
      setActive(n), setKeyed(true);
      rowsEl.current?.querySelector(`[data-i="${n}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault();
      pick(flat[active]);
    }
  };

  const title = shown === 'trap' ? t('Insert a mind trap') : shown === 'law' ? t('Insert a law of power') : t('Insert a Win friends principle');
  const search = shown === 'trap' ? t('Search mind traps') : shown === 'law' ? t('Search laws, or a number') : t('Search principles, or a number');
  let i = 0;

  return (
    <Sheet open={!!kind} onClose={onClose} title={title} tall class="ref-sheet">
      <div class="seg tabs ref-tabs" role="tablist" aria-label={t('Insert')} style={{ '--at': KINDS.findIndex(([k]) => k === shown), '--tabs': KINDS.length }}>
        {KINDS.map(([k, name, icon]) => {
          const n = needle ? hits.filter((r) => r.kind === k).length : 0;
          return (
            <button role="tab" aria-selected={shown === k} onClick={() => go(k)}>
              <Icon name={icon} size={16} />
              <span class="ref-tab-name">{t(name)}</span>
              {needle && <small class="ref-tab-n">{n}</small>}
            </button>
          );
        })}
      </div>
      <label class="search">
        <Icon name="search" size={18} />
        <input
          ref={input}
          type="search"
          placeholder={search}
          value={q}
          onInput={(e) => { setQ(e.currentTarget.value); setActive(0); }}
          onKeyDown={onKey}
          aria-label={search}
        />
      </label>
      {!list && <p class="hint center">{t('Loading…')}</p>}
      {list && !flat.length && <p class="hint center">{t('Nothing with that name')}</p>}
      <div class="ref-rows" ref={rowsEl}>
        {sections.map((s) => (
          <section key={s.title} class="ref-group">
            {s.title && (
              <h3 class="ref-group-head">
                {s.hue ? <i class="lrn-dot" style={{ '--c': `var(--emo-${s.hue})` }} aria-hidden="true" /> : <Icon name={s.title === t('Recent') ? 'clock' : 'crown'} size={14} />}
                <span>{s.title}</span>
                <span class="ref-group-n">{s.items.length}</span>
              </h3>
            )}
            {s.items.map((r) => {
              const at = i++;
              return (
                <button
                  key={keyOf(r)}
                  data-i={at}
                  class={`ref-row${at === active && (needle || keyed) ? ' is-active' : ''}`}
                  style={{ '--c': `var(--emo-${r.hue})` }}
                  onClick={() => pick(r)}
                  onPointerEnter={() => setActive(at)}
                >
                  <Mark id={r.mark} hue={r.hue} size={40} />
                  <span class="ref-row-main">
                    <span class="ref-row-top">
                      {r.kind === 'trap' ? t(r.sub) : r.kind === 'law' ? t('Law {n} · {realm}', { n: r.id, realm: t(r.sub) }) : t('Principle {n}', { n: r.id })}
                    </span>
                    <span class="ref-row-title">{r.name}</span>
                    <span class="ref-row-sub">{r.line}</span>
                  </span>
                  <span class="ref-row-add" aria-hidden="true"><Icon name="plus" size={16} /></span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </Sheet>
  );
}
