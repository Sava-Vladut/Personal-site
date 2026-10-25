// Sharing a Learn page (or one entry on it) with anyone. Learn is the app's own reading, not the journal, so nothing
// is published: the link (/learn/<page>?open=<entry>&lang=<language>) opens just that page for anyone, without
// signing in (main.tsx, views/LearnPublic.tsx), in the language picked here (lib/i18n.ts reads ?lang=).
import { useEffect, useRef, useState } from 'preact/hooks';
import { LANGS, lang as appLang, t, type Lang } from '../lib/i18n';
import { toast } from '../lib/store';
import type { ComponentChildren } from 'preact';
import { Icon } from './icons';
import { PageHead } from './PageHead';
import { Sheet } from './Sheet';
import { Sky } from './Sky';
import '../styles/shared.css';

/**
 * On a shared link (/learn/<page>, main.tsx) only what was shared shows: the page with no way back or on to the other
 * Learn pages, or one entry as a page of its own (SharedEntry).
 */
export const onSharedLink = typeof location !== 'undefined' && /^\/learn\//.test(location.pathname);

/** What to share: `path` is the page and its query as the app routes it ('traps', 'laws?open=3'). */
export interface ShareTarget { path: string; title: string }

export function learnUrl(path: string, lang: Lang) {
  const [page, qs = ''] = path.split('?');
  const query = new URLSearchParams(qs);
  query.set('lang', lang);
  return `${location.origin}/learn/${page}?${query}`;
}

/** The sheet, at page level (not inside an entry's sheet, whose transform would trap it): open while `target` is set. */
export function LearnShare({ target, onClose }: { target: ShareTarget | null; onClose: () => void }) {
  const [lang, setLang] = useState<Lang>(appLang);
  // keep showing what was shared while the sheet slides away
  const last = useRef(target);
  if (target) last.current = target;
  useEffect(() => { if (target) setLang(appLang); }, [target]);
  const shown = last.current;
  if (!shown) return null;
  const url = learnUrl(shown.path, lang);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t('Link copied'));
    } catch {
      toast(t('Couldn’t copy — select it and copy by hand'));
    }
  };
  const send = () => navigator.share({ title: shown.title, url }).catch(() => {});

  return (
    <Sheet open={!!target} onClose={onClose} title={t('Share publicly')}>
      <div class="share-sheet">
        <p class="share-lead">{t('Anyone with the link can read {title} without signing in. Nothing from your journal is shared.', { title: shown.title })}</p>
        <div class="share-lang">
          <span>{t('Opens in')}</span>
          <div class="seg compact" role="radiogroup" aria-label={t('Language')}>
            {LANGS.map(([v, l]) => (
              <button role="radio" lang={v} aria-checked={lang === v} aria-selected={lang === v} onClick={() => setLang(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div class="share-link">
          <input class="input" readOnly value={url} aria-label={t('Public link')} onFocus={(e) => e.currentTarget.select()} />
          <button class="btn btn-quiet" onClick={copy}><Icon name="copy" size={18} /> {t('Copy')}</button>
          {'share' in navigator && <button class="btn btn-quiet" onClick={send} aria-label={t('Share publicly')}><Icon name="share" size={18} /></button>}
        </div>
      </div>
    </Sheet>
  );
}

/** The round glass button in a Learn page's header that shares the whole page. */
export function ShareButton({ onClick }: { onClick: () => void }) {
  return (
    <button class="glass glass-btn round" onClick={onClick} aria-label={t('Share publicly')} title={t('Share publicly')}>
      <Icon name="share" />
    </button>
  );
}

/** A shared entry, on its own full page: the page it's from and where it ranks over the sky, then the entry. */
export function SharedEntry({ world, page, title, rank, onShare, children }: {
  world: string;
  /** the page's class, for its own styles ('traps-page') */
  page: string;
  /** the page it's from ("Mind traps") */
  title: string;
  /** where it sits on that page ("#3 of 40") */
  rank: string;
  onShare: () => void;
  children: ComponentChildren;
}) {
  return (
    <div class={`page lrn-page lrn-solo ${page}`} style={{ '--accent': `var(--emo-${world})` }}>
      <div class="journal-top lrn-top" style={{ '--sky': `var(--emo-${world})` }}>
        <Sky world={world} />
        <PageHead title={title} subtitle={rank} actions={<ShareButton onClick={onShare} />} />
      </div>
      {children}
    </div>
  );
}
