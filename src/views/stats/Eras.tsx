import { useMemo } from 'preact/hooks';
import { coreOf, shortName } from '../../data/emotions';
import { navigate } from '../../lib/router';
import { addedAt, usePeriods, useSongs, type Song } from '../../lib/store';
import { EmotionChip } from '../../components/emotion';
import { Icon } from '../../components/icons';
import { Covers, MusicWave, periodName, periodPaint, spanLabel, spanOf } from '../../components/periods';
import { count, t } from '../../lib/i18n';

/**
 * The eras of your music: the wave of songs joining your records with your periods on it, how those periods felt
 * (each weighed by its songs), and each period in turn, newest first, with its feelings and what was going on.
 */
export function Eras() {
  const songs = useSongs();
  const periods = usePeriods();
  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  const eras = useMemo(() => periods
    .map((p) => ({ p, span: spanOf(p, byId), list: p.songs.map((id) => byId.get(id)).filter((s): s is Song => !!s).sort((a, b) => addedAt(b) - addedAt(a)) }))
    .filter((x) => x.span)
    .sort((a, b) => b.span!.end - a.span!.end), [periods, byId]);

  // each era's feelings, weighed by how many songs it holds
  const felt = useMemo(() => {
    const worlds = new Map<string, number>();
    for (const { p, span } of eras) for (const e of p.emotions) worlds.set(coreOf(e).id, (worlds.get(coreOf(e).id) ?? 0) + span!.n / p.emotions.length);
    const list = [...worlds].sort((a, b) => b[1] - a[1]);
    return { list, total: list.reduce((n, [, v]) => n + v, 0) };
  }, [eras]);

  if (!eras.length)
    return (
      <div class="empty">
        <h2 class="title-s">{t('No eras yet')}</h2>
        <p>{t('In your records, drag across the wave or select songs, then make a period: name the era and say how it felt.')}</p>
        <button class="btn btn-primary" onClick={() => navigate('media?tab=music')}><Icon name="vinyl" size={18} /> {t('Go to your records')}</button>
      </div>
    );

  return (
    <div class="stack eras">
      <section class="card chart-card">
        <h3 class="chart-title">{t('Your music over time')}</h3>
        <MusicWave songs={songs} periods={periods} />
      </section>

      {felt.total > 0 && (
        <section class="card chart-card">
          <h3 class="chart-title">{t('How your eras felt')}</h3>
          <div class="split-bar" role="img" aria-label={felt.list.map(([c, n]) => `${shortName(c)} ${Math.round((n / felt.total) * 100)}%`).join(', ')}>
            {felt.list.map(([c, n]) => <i style={{ flex: n, background: `var(--emo-${c})` }} title={`${shortName(c)} · ${Math.round((n / felt.total) * 100)}%`} />)}
          </div>
          <div class="eras-legend">
            {felt.list.slice(0, 4).map(([c, n]) => <span><i style={{ background: `var(--emo-${c})` }} /> {shortName(c)} <b>{Math.round((n / felt.total) * 100)}%</b></span>)}
          </div>
        </section>
      )}

      <div class="eras-list">
        {eras.map(({ p, span, list }) => (
          <article class="card era" style={{ '--paint': periodPaint(p) }}>
            <div class="era-head">
              <Covers songs={list} n={4} />
              <div class="era-title">
                <h3>{periodName(p)}</h3>
                <span class="muted small">{spanLabel(span!)} · {count(span!.n, 'song', 'songs')}</span>
              </div>
            </div>
            {p.emotions.length > 0 && <div class="meta">{p.emotions.map((e) => <EmotionChip id={e} size="sm" />)}</div>}
            {p.text.trim() && <p class="era-text">{p.text}</p>}
            <div class="era-songs">
              {list.slice(0, 5).map((s) => (
                <button class="era-song" onClick={() => navigate('song/' + s.id)}>
                  <b>{s.music.title}</b> <span>{s.music.sub}</span>
                </button>
              ))}
              {list.length > 5 && <span class="muted small">{t('and {n} more', { n: list.length - 5 })}</span>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
