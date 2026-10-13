import { t } from '../lib/i18n';
import { Icon } from './icons';

/** '' before the first edit, 'saving' from the first keystroke until the save lands. */
export type SaveState = '' | 'saving' | 'saved' | 'error';

/** The pill in an editor's top bar. It stays mounted while you type, so it changes in place instead of blinking. */
export function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span class="editor-status" aria-live="polite">
      <span class={`glass save-pill${state ? ' is-shown' : ''}`} data-state={state || undefined}>
        <span class="save-mark" aria-hidden="true">
          {state === 'saved' ? <Icon name="check" size={13} stroke={2.25} /> : state === 'error' ? <Icon name="alert-circle" size={13} stroke={2} /> : <span class="save-spin" />}
        </span>
        <span>{state === 'saved' ? t('Saved') : state === 'error' ? t('Couldn’t save') : t('Saving…')}</span>
      </span>
    </span>
  );
}
