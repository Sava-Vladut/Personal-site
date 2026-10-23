import { CHANGELOG } from '../data/changelog';
import { shortDate } from '../lib/dates';
import { t } from '../lib/i18n';
import { Icon } from './icons';
import { Sheet } from './Sheet';

/** Every release, newest first: opened from the version in Settings, and from the bar under the date after an update. */
export function ChangelogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={<span class="row gap-s"><Icon name="sparkles" /> {t('What’s new')}</span>} label={t('What’s new')} tall>
      {CHANGELOG.map((r) => (
        <section class="release" key={r.version}>
          <h3 class="release-head">{r.version} <span class="muted small">{shortDate(r.date)}</span></h3>
          <ul>{r.changes.map((c) => <li>{c}</li>)}</ul>
        </section>
      ))}
    </Sheet>
  );
}
