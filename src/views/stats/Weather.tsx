import { useMemo } from 'preact/hooks';
import { fmtTemp } from '../../data/weather';
import { navigate } from '../../lib/router';
import { fmtMood, pct, weatherInsights, weatherStats, type Stats as S } from '../../lib/stats';
import { useSettings } from '../../lib/store';
import { ChartCard, MoodRows, RevealStack } from '../../components/charts';
import { Icon, Sprite } from '../../components/icons';
import { Tile } from './parts';
import { count, t } from '../../lib/i18n';

const hours = (h: number | null) => (h === null ? '—' : `${h.toFixed(1)} h`);

export function Weather({ s }: { s: S }) {
  const settings = useSettings();
  const w = useMemo(() => weatherStats(s.list), [s]);
  const notes = useMemo(() => weatherInsights(w), [w]);

  const why = !settings.weather
    ? t('Turn on Weather in Settings to see how the sky, the temperature and the length of the day go with your mood.')
    : !settings.home && !settings.places
      ? t('Set your home in Settings, so the weather can be added to your entries.')
      : t('The weather is being added to your entries. It needs a connection, so check back in a moment.');

  if (!w.covered)
    return (
      <div class="card weather-empty">
        <span class="weather-empty-ico"><Icon name="haze" size={26} /></span>
        <h2 class="title-s">{t('No weather yet')}</h2>
        <p>{why}</p>
        <button class="btn btn-primary" onClick={() => navigate('settings')}>{t('Open Settings')}</button>
      </div>
    );

  const common = [...w.sky].sort((a, b) => b.entries - a.entries)[0];
  const skyRows = w.sky.filter((g) => g.n > 0);

  return (
    <RevealStack>
      <div class="tiles">
        <Tile k={0} icon={common.icon} label={t('Most common sky')} small value={common.name} sub={t('{share} of entries', { share: pct(common.entries / w.covered) })} />
        <Tile k={1} icon="temperature" label={t('Temperature')} value={w.temp === null ? '—' : fmtTemp(w.temp)} sub={t('on average')} />
        <Tile k={2} icon="sunrise" label={t('Daylight')} value={hours(w.daylight)} sub={t('a day, on average')} />
        <Tile k={3} icon="cloud" label={t('With weather')} value={pct(w.covered / w.total)} sub={t('{n} of {count}', { n: w.covered, count: count(w.total, 'entry', 'entries') })} meter={w.covered / w.total} />
      </div>

      {notes.length > 0 && (
        <section class="card insights">
          <h3 class="chart-title"><Icon name="sparkles" size={16} /> {t('What stands out')}</h3>
          <ul>
            {notes.map((n, i) => (
              <li style={{ '--k': i, ...(n.core ? { '--c': `var(--emo-${n.core})` } : {}) }} class={n.core ? 'tinted' : ''}>
                <span class="ins-ico">{n.core ? <Sprite core={n.core} size={13} /> : <Icon name="sparkles" size={13} />}</span>
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {skyRows.length > 0 && (
        <ChartCard
          title={t('Mood by weather')}
          sub={t('Your average mood under each kind of sky.')}
          table={{ head: [t('Sky'), t('Mood'), t('Entries')], rows: skyRows.map((g) => [g.name, fmtMood(g.mood), g.n]) }}
        >
          <MoodRows rows={skyRows.map((g) => ({ label: g.name, icon: g.icon, mood: g.mood, n: g.n }))} />
        </ChartCard>
      )}

      {w.temps.length > 0 && (
        <ChartCard
          title={t('Mood by temperature')}
          sub={t('The temperature when you wrote, or the day’s high.')}
          table={{ head: [t('Temperature'), t('Mood'), t('Entries')], rows: w.temps.map((b) => [b.name, fmtMood(b.mood), b.n]) }}
        >
          <MoodRows rows={w.temps.map((b) => ({ label: b.name, mood: b.mood, n: b.n }))} />
        </ChartCard>
      )}

      {w.light.length > 0 && (
        <ChartCard
          title={t('Mood by daylight')}
          sub={t('Hours between sunrise and sunset on the day.')}
          table={{ head: [t('Daylight'), t('Mood'), t('Entries')], rows: w.light.map((b) => [b.name, fmtMood(b.mood), b.n]) }}
        >
          <MoodRows rows={w.light.map((b) => ({ label: b.name, mood: b.mood, n: b.n }))} />
        </ChartCard>
      )}

      {w.dark.some((d) => d.n > 0) && (
        <ChartCard
          title={t('Daylight or dark')}
          sub={t('Whether the sun was up when you checked in.')}
          table={{ head: [t('When'), t('Mood'), t('Entries')], rows: w.dark.map((d) => [d.name, fmtMood(d.mood), d.n]) }}
        >
          <MoodRows rows={w.dark.map((d, i) => ({ label: d.name, icon: i ? 'moon' : 'sun', mood: d.mood, n: d.n }))} />
        </ChartCard>
      )}

    </RevealStack>
  );
}
