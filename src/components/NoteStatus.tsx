import { useEffect, useMemo, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { plainText } from '../lib/body';
import { stripMarkdown } from '../lib/markdown';
import { setDocView, stepZoom, useDocView, ZOOMS } from '../lib/docView';
import { count, t } from '../lib/i18n';
import { Icon } from './icons';

/** Where the note's last change is: not kept yet (a new, blank note), on its way, kept, or not kept after an error. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Words: runs of letters and digits, with the apostrophes and hyphens inside them ("don't", "well-known"). */
const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** How much a note holds, as Word's status bar counts it: words, characters (spaces too) and minutes to read. */
function measure(text: string) {
  const words = stripMarkdown(plainText(text))
    // a link's id isn't a word of the note: only its title shows
    .replace(/\[\[(?:note|trap|law):[^|\]\n]*\|/g, '[[')
    .replace(/^\s*[•☐☑] /gm, '');
  const n = words.match(WORD)?.length ?? 0;
  return { words: n, chars: [...words.replace(/\n/g, '')].length, minutes: n ? Math.max(1, Math.round(n / 220)) : 0 };
}

/**
 * The strip along the bottom of a note on a computer, like Word's status bar: on the left how long the note is and
 * whether it's saved; on the right the views (Focus, Read mode, Edit) and the zoom slider. Hidden on phones.
 */
export function NoteStatus({ text, save, reading, onRead, onWrite }: {
  text: string;
  save: SaveState;
  reading: boolean;
  onRead: () => void;
  onWrite: () => void;
}) {
  const view = useDocView();
  const { words, chars, minutes } = useMemo(() => measure(text), [text]);
  // "Saving…" only when saving takes a moment: a quick save between two words stays "Saved", not a flicker
  const [shown, setShown] = useState<SaveState>(save === 'saving' ? 'idle' : save);
  useEffect(() => {
    if (save !== 'saving') return void setShown(save);
    const wait = setTimeout(() => setShown('saving'), 700);
    return () => clearTimeout(wait);
  }, [save]);
  const step = Math.max(0, ZOOMS.indexOf(view.zoom));
  const percent = Math.round(view.zoom * 100) + '%';
  if (typeof document === 'undefined') return null;
  return createPortal(
    <footer class="note-status" aria-label={t('Status bar')}>
      <span class="note-status-item">{count(words, 'word', 'words')}</span>
      <span class="note-status-item">{count(chars, 'character', 'characters')}</span>
      {minutes > 0 && <span class="note-status-item">{t('{n} min read', { n: minutes })}</span>}
      {shown !== 'idle' && (
        <span class={`note-status-item note-save is-${shown}`}>
          {/* the tick's place is kept while saving, so the words beside it don't move */}
          <Icon name="check" size={13} class={shown === 'saved' ? undefined : 'is-hidden'} />
          {shown === 'saving' ? t('Saving…') : shown === 'saved' ? t('Saved') : t('Not saved')}
        </span>
      )}
      <span class="grow" />
      <div class="note-views" role="group" aria-label={t('Views')}>
        <button class="note-status-btn" aria-pressed={view.focus} onClick={() => setDocView({ focus: !view.focus })} aria-label={t('Focus')} title={t('Focus')}>
          <Icon name="focus-centered" size={16} />
        </button>
        <button class="note-status-btn" aria-pressed={reading} onClick={() => !reading && onRead()} aria-label={t('Read mode')} title={t('Read mode')}>
          <Icon name="book" size={16} />
        </button>
        <button class="note-status-btn" aria-pressed={!reading} onClick={() => reading && onWrite()} aria-label={t('Edit')} title={t('Edit')}>
          <Icon name="pencil" size={16} />
        </button>
      </div>
      <div class="note-zoom" role="group" aria-label={t('Zoom')}>
        <button class="note-status-btn" onClick={() => stepZoom(-1)} disabled={step === 0} aria-label={t('Zoom out')} title={t('Zoom out')}>
          <Icon name="minus" size={14} />
        </button>
        <span class="note-zoom-track" style={{ '--tick': ZOOMS.indexOf(1) / (ZOOMS.length - 1) }}>
          <input
            type="range"
            min={0}
            max={ZOOMS.length - 1}
            step={1}
            value={step}
            onInput={(e) => setDocView({ zoom: ZOOMS[+e.currentTarget.value] ?? 1 })}
            aria-label={t('Zoom')}
            aria-valuetext={percent}
          />
        </span>
        <button class="note-status-btn" onClick={() => stepZoom(1)} disabled={step === ZOOMS.length - 1} aria-label={t('Zoom in')} title={t('Zoom in')}>
          <Icon name="plus" size={14} />
        </button>
        <button class="note-zoom-value" onClick={() => setDocView({ zoom: 1 })} aria-label={t('Zoom to 100%')} title={t('Zoom to 100%')}>{percent}</button>
      </div>
    </footer>,
    document.body,
  );
}
