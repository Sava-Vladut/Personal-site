import { goBack } from '../lib/router';
import { PageHead } from '../components/PageHead';
import { Sky } from '../components/Sky';
import { StatusPanel } from '../components/StatusPanel';
import { t } from '../lib/i18n';
import '../styles/stats.css';

const WORLD = 'hope-interest';

/** The public status, on a page of its own under Insights: one link to your latest check-in, and what it shows. */
export function StatusPage() {
  return (
    <div class="page stats-page status-page">
      <div class="journal-top stats-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead title={t('Public status')} back={() => goBack()} subtitle={t('One link that always shows your latest check-in')} />
      </div>
      <section class="card status-panel-card">
        <StatusPanel />
      </section>
    </div>
  );
}
