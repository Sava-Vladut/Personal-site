import { useEffect, useState } from 'preact/hooks';
import { Sheet } from './Sheet';
import { Icon } from './icons';
import { t } from '../lib/i18n';

/**
 * Word's Insert Link: the words to show and the address they open. Given a link already there, it edits it, and can
 * take it off. The words start as the ones selected (or the word at the caret).
 */
export function LinkSheet({ open, onClose, text, href, onDone }: {
  open: boolean;
  onClose: () => void;
  text: string;
  /** the link's address when the words are a link already */
  href: string | null;
  /** the words and the address; null takes the link off */
  onDone: (to: { text: string; href: string } | null) => void;
}) {
  const [words, setWords] = useState(text);
  const [address, setAddress] = useState(href ?? '');
  useEffect(() => {
    if (!open) return;
    setWords(text);
    setAddress(href ?? '');
  }, [open]);
  const save = () => onDone(address.trim() ? { text: words, href: address } : null);
  const enter = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    save();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={href ? t('Edit link') : t('Insert link')}
      footer={
        <div class="row gap-s">
          {href && <button class="btn btn-quiet" onClick={() => onDone(null)}><Icon name="trash" size={18} /> {t('Remove link')}</button>}
          <button class="btn btn-primary grow" onClick={save} disabled={!address.trim() && !href}>{t('Done')}</button>
        </div>
      }
    >
      <div class="link-form">
        <label class="field-label" for="link-text">{t('Text to show')}</label>
        <input id="link-text" class="input" value={words} placeholder={t('The words of the link')} onInput={(e) => setWords(e.currentTarget.value)} onKeyDown={enter} />
        <label class="field-label" for="link-href">{t('Address')}</label>
        <input
          id="link-href"
          class="input"
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellcheck={false}
          value={address}
          placeholder="https://"
          onInput={(e) => setAddress(e.currentTarget.value)}
          onKeyDown={enter}
          autoFocus
        />
      </div>
    </Sheet>
  );
}
