import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons';
import { t } from '../lib/i18n';
import type { FindInfo, NoteBodyHandle } from '../editor/NoteBody';

/** Apple keyboards say ⌘ and ⇧ where the others say Ctrl and Shift. */
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
const keys = (k: string) => (MAC ? k.replace(/Ctrl\+/g, '⌘').replace(/Shift\+/g, '⇧') : k);

/**
 * Word's Find and Replace, as a small bar: on a computer it floats under the ribbon at the top right, on a phone it
 * takes the ribbon's place above the keyboard. What's typed is looked for at once, every match lit in the note
 * (lib/noteDoc/edit/find.ts) and the current one apart; Enter (or F3) goes to the next, Shift+Enter to the previous.
 * Replace and Replace All (one change to undo) come with Ctrl+H or the arrow at its start, never while reading.
 * Esc closes it and puts the focus back in the text, on the match it was at.
 */
export function FindBar({ note, replace, reading, focus, onReplace, onClose }: {
  note: NoteBodyHandle;
  /** the Replace row is open */
  replace: boolean;
  /** reading: Find only */
  reading: boolean;
  /** changes each time Find or Replace is asked for again (Ctrl+F once more): its field takes the focus */
  focus: number;
  onReplace: (on: boolean) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(() => note.find.selected());
  const [rep, setRep] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [whole, setWhole] = useState(false);
  const [info, setInfo] = useState<FindInfo>({ count: 0, current: -1 });
  const [said, setSaid] = useState('');
  const findRef = useRef<HTMLInputElement>(null);
  const repRef = useRef<HTMLInputElement>(null);
  const withReplace = replace && !reading;

  useEffect(() => note.watchFind(setInfo), [note]);
  // looked for again as it's typed, or an option changes
  useEffect(() => {
    setInfo(note.find.set({ text: q, caseSensitive: matchCase, wholeWord: whole }));
    setSaid('');
  }, [q, matchCase, whole]);
  // Ctrl+F (or Ctrl+H) again: the field it's for, its words selected; the selected words in the note looked for
  useLayoutEffect(() => {
    const sel = note.find.selected();
    if (sel && sel !== q) setQ(sel);
    findRef.current?.focus();
    findRef.current?.select();
  }, [focus]);

  const close = () => {
    note.find.close();
    onClose();
  };
  const step = (dir: 1 | -1) => {
    setSaid('');
    setInfo(note.find.step(dir));
  };
  const replaceOne = () => {
    setSaid('');
    setInfo(note.find.replace(rep));
  };
  const replaceAll = () => {
    const n = note.find.replaceAll(rep);
    setSaid(n ? t('Replaced {n}', { n }) : t('No results'));
  };
  /** Esc, F3 and Ctrl+H anywhere in the bar; Enter in each field does its own. */
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'F3') {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    }
  };
  const enter = (fn: (shift: boolean) => void) => (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    fn(e.shiftKey);
  };

  const status = !q ? '' : info.count ? t('{n} of {total}', { n: Math.max(0, info.current) + 1, total: info.count }) : t('No results');
  return (
    <div class={`find-bar${withReplace ? ' is-replacing' : ''}`} role="search" aria-label={withReplace ? t('Find and replace') : t('Find')} onKeyDown={onKey}
      // a press on its buttons leaves the focus in the field it was in (and a phone's keyboard up)
      onMouseDown={(e) => (e.target as Element).closest('button') && e.preventDefault()}>
      <div class="find-row">
        {!reading && (
          <button
            type="button"
            class="format-btn find-more"
            aria-label={t('Replace')}
            title={keys('Ctrl+H')}
            aria-expanded={withReplace}
            onClick={() => onReplace(!replace)}
          >
            <Icon name="chevron-right" size={16} />
          </button>
        )}
        <input
          ref={findRef}
          class="find-input"
          type="search"
          enterKeyHint="search"
          value={q}
          placeholder={t('Find in the note')}
          aria-label={t('Find')}
          spellcheck={false}
          autoComplete="off"
          onInput={(e) => setQ(e.currentTarget.value)}
          onKeyDown={enter((shift) => step(shift ? -1 : 1))}
        />
        <span class={`find-count${q && !info.count ? ' is-none' : ''}`} aria-live="polite">{said || status}</span>
        <button type="button" class="format-btn" aria-label={t('Previous')} title={`${t('Previous')} (${keys('Shift+Enter')})`} disabled={!info.count} onClick={() => step(-1)}>
          <Icon name="chevron-up" size={18} />
        </button>
        <button type="button" class="format-btn" aria-label={t('Next')} title={`${t('Next')} (Enter)`} disabled={!info.count} onClick={() => step(1)}>
          <Icon name="chevron-down" size={18} />
        </button>
        <button type="button" class="format-btn" aria-label={t('Match case')} title={t('Match case')} aria-pressed={matchCase} onClick={() => setMatchCase(!matchCase)}>
          <Icon name="letter-case" size={18} />
        </button>
        <button type="button" class="format-btn" aria-label={t('Whole words only')} title={t('Whole words only')} aria-pressed={whole} onClick={() => setWhole(!whole)}>
          <Icon name="abc" size={18} />
        </button>
        <button type="button" class="format-btn" aria-label={t('Close')} title={`${t('Close')} (Esc)`} onClick={close}>
          <Icon name="x" size={18} />
        </button>
      </div>
      {withReplace && (
        <div class="find-row">
          <input
            ref={repRef}
            class="find-input"
            value={rep}
            placeholder={t('Replace with')}
            aria-label={t('Replace with')}
            spellcheck={false}
            autoComplete="off"
            enterKeyHint="done"
            onInput={(e) => setRep(e.currentTarget.value)}
            onKeyDown={enter(replaceOne)}
          />
          <button type="button" class="find-btn" disabled={!info.count} onClick={replaceOne}>{t('Replace')}</button>
          <button type="button" class="find-btn" disabled={!info.count} onClick={replaceAll}>{t('Replace All')}</button>
        </div>
      )}
    </div>
  );
}
