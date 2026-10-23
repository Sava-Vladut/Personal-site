import { CHART_ORDER, shortName } from '../../data/emotions';
import { shortDate } from '../../lib/dates';
import { fmtMood, type Stats as S } from '../../lib/stats';
import { TipRow, tipProps, useWidth } from '../../components/charts';
import { dense } from '../../components/ascii';
import { count, noun, t } from '../../lib/i18n';

const COL = 11; // px per column, about one letter and a gap

function dominant(cores: Record<string, number>) {
  let best: string | null = null, top = 0;
  for (const id of CHART_ORDER) if ((cores[id] ?? 0) > top) [best, top] = [id, cores[id]];
  return best;
}

/**
 * The range as a forecast: one column of letters per day (or week, or a few of them on a narrow screen). A cloud in
 * the letters of the world felt most, thicker the more you wrote, rain falling under it on low days, and the world's
 * colour as a ribbon underneath, like the journal's days.
 */
export function Forecast({ s }: { s: S }) {
  const [ref, W] = useWidth();
  const fit = Math.max(1, Math.floor(W / COL));
  const g = Math.max(1, Math.ceil(s.buckets.length / fit));
  const cols: { key: string; end: string; n: number; mood: number | null; world: string | null }[] = [];
  for (let i = 0; i < s.buckets.length; i += g) {
    const part = s.buckets.slice(i, i + g);
    const cores: Record<string, number> = {};
    let n = 0, sum = 0, rated = 0;
    for (const b of part) {
      n += b.entries.length;
      Object.entries(b.cores).forEach(([k, v]) => (cores[k] = (cores[k] ?? 0) + v));
      if (b.mood !== null) { sum += b.mood * b.entries.length; rated += b.entries.length; }
    }
    cols.push({ key: part[0].key, end: part[part.length - 1].end, n, mood: rated ? sum / rated : null, world: dominant(cores) });
  }
  const max = Math.max(1, ...cols.map((c) => c.n));
  const one = g === 1 && s.step === 1;
  const when = (c: (typeof cols)[number]) => (one ? shortDate(c.key) : `${shortDate(c.key)} – ${shortDate(c.end)}`);

  return (
    <div class="forecast">
      <div ref={ref} class="fc-cols" role="group" aria-label={t('Each day as a cloud of what you felt')}>
        {W > 0 && cols.map((c, i) => {
          const level = c.n ? Math.max(1, Math.ceil((c.n / max) * 3)) : 0;
          const ramp = dense(c.world, 4);
          const m = c.mood ?? 0;
          const fall = c.mood === null || m > -1 ? [' ', ' '] : c.world === 'anger' ? ['/', m <= -2.5 ? '/' : ' '] : ["'", m <= -2.5 ? '|' : ','];
          return (
            <span
              class={c.n ? 'fc-col' : 'fc-col empty'}
              style={{ '--t': (cols.length > 1 ? i / (cols.length - 1) : 0).toFixed(3), ...(c.world ? { '--c': `var(--emo-${c.world})` } : {}) }}
              {...tipProps(() => (
                <>
                  <div class="tip-title">{when(c)}</div>
                  {c.world && <TipRow value={shortName(c.world)} label={t('most felt')} color={`var(--emo-${c.world})`} />}
                  <TipRow value={c.n} label={noun(c.n, 'entry', 'entries')} />
                  {c.mood !== null && <TipRow value={fmtMood(c.mood)} label={t('mood')} />}
                </>
              ), `${when(c)}: ${c.world ? shortName(c.world) + ', ' : ''}${count(c.n, 'entry', 'entries')}`)}
            >
              <b aria-hidden="true">{level >= 3 ? ramp[1] : level >= 2 ? ramp[0] : ' '}</b>
              <b aria-hidden="true">{level ? ramp[Math.min(3, level)] : '·'}</b>
              <i aria-hidden="true">{fall[0]}</i>
              <i aria-hidden="true">{fall[1]}</i>
              <u aria-hidden="true" />
            </span>
          );
        })}
      </div>
      <div class="fc-axis"><span>{shortDate(s.start)}</span><span>{t('today')}</span></div>
    </div>
  );
}
