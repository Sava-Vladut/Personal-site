import { navigate } from '../lib/router';
import { t } from '../lib/i18n';
import { Glops } from './Glops';
import { CardWars } from './CardWars';

const GAMES: [id: 'glops' | 'cardwars', name: string][] = [['glops', t('Global Ops')], ['cardwars', t('Card Wars')]];
const KEY = 'mm-game-stats';

/** Game statistics: Global Ops and Card Wars on one page, a toggle between them (the last one picked opens next time). */
export function Games({ query }: { id: string; query: URLSearchParams }) {
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  const game = GAMES.find(([id]) => id === (query.get('game') ?? saved))?.[0] ?? 'glops';
  try { localStorage.setItem(KEY, game); } catch {}

  const switcher = (
    <div class="seg tabs gs-switch" role="tablist" aria-label={t('Game')} style={{ '--at': GAMES.findIndex(([id]) => id === game), '--tabs': GAMES.length }}>
      {GAMES.map(([id, name]) => (
        <button role="tab" aria-selected={game === id} onClick={() => id !== game && navigate('games?game=' + id, true)}>{name}</button>
      ))}
    </div>
  );
  return game === 'cardwars' ? <CardWars query={query} switcher={switcher} /> : <Glops switcher={switcher} />;
}
