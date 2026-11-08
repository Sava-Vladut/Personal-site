import { goBack, navigate } from '../lib/router';
import { connectGithub, useGithubOwner } from '../lib/github';
import { PageHead } from '../components/PageHead';
import { Sky } from '../components/Sky';
import { t } from '../lib/i18n';
import '../styles/games.css';
import { Glops } from './Glops';
import { CardWars } from './CardWars';

const GAMES: [id: 'glops' | 'cardwars', name: string][] = [['glops', t('Global Ops')], ['cardwars', t('Card Wars')]];
const KEY = 'mm-game-stats';

/** Game statistics: Global Ops and Card Wars on one page, a toggle between them (the last one picked opens next time). */
export function Games({ query }: { id: string; query: URLSearchParams }) {
  // only with the site's owner's GitHub connected
  const owner = useGithubOwner();
  if (!owner) return <Locked checking={owner === undefined} />;
  return <Opened query={query} />;
}

function Locked({ checking }: { checking: boolean }) {
  return (
    <div class="page stats-page gl-page">
      <div class="journal-top stats-top" style={{ '--sky': 'var(--emo-hope-interest)' }}>
        <Sky world="hope-interest" />
        <PageHead title={t('Game statistics')} back={() => goBack()} />
      </div>
      {checking ? (
        <p class="empty-note center loading-note">{t('Loading…')}</p>
      ) : (
        <div class="empty fade-arrive-soft">
          <h2 class="title-s">{t('Game statistics are locked')}</h2>
          <p>{t('They open only with the site owner’s GitHub connected.')}</p>
          <button class="btn btn-primary" onClick={() => connectGithub('#/games')}>{t('Connect GitHub')}</button>
        </div>
      )}
    </div>
  );
}

function Opened({ query }: { query: URLSearchParams }) {
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  const game = GAMES.find(([id]) => id === (query.get('game') ?? saved))?.[0] ?? 'glops';
  try { localStorage.setItem(KEY, game); } catch {}

  const switcher = (
    <div class="gs-banners" role="tablist" aria-label={t('Game')}>
      {GAMES.map(([id, name]) => (
        <button role="tab" class="gs-banner" aria-selected={game === id} onClick={() => id !== game && navigate('games?game=' + id, true)}>
          <img src={`/games/${id}.webp`} alt="" height={40} decoding="async" />
          <span>{name}</span>
        </button>
      ))}
    </div>
  );
  return game === 'cardwars' ? <CardWars query={query} switcher={switcher} /> : <Glops switcher={switcher} />;
}
