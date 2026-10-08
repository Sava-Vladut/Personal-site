import { useMemo } from 'preact/hooks';
import { goBack } from '../lib/router';
import { readBrain } from '../lib/brain';
import { useEntries } from '../lib/store';
import { Brain } from '../components/Brain';
import { Icon } from '../components/icons';
import { Sky } from '../components/Sky';
import { t } from '../lib/i18n';
import '../styles/stats.css';

/** The brain in letters, on a page of its own (it's on the wheel under Insights). */
export function BrainView() {
  const entries = useEntries();
  const lead = useMemo(() => readBrain(entries).lead, [entries]);

  return (
    <div class="page stats-page">
      <div class="journal-top stats-top" style={{ '--sky': `var(--emo-${lead ?? 'hope-interest'})` }}>
        <Sky world={lead} />
        <header class="page-head">
          <button class="back-link stats-back" onClick={() => goBack()}><Icon name="chevron-left" size={18} /> {t('Back')}</button>
          <h1 class="title">{t('Your brain')}</h1>
          <p class="subtitle">{t('Your journal, as a brain.')}</p>
        </header>
      </div>
      <Brain />
    </div>
  );
}
