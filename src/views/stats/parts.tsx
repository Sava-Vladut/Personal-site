import { EMOTION, shortName } from '../../data/emotions';
import type { RangeKey, Stats as S } from '../../lib/stats';
import { CountUp } from '../../components/charts';
import { Icon, Sprite, type UiName } from '../../components/icons';
import { t } from '../../lib/i18n';

/** The period just before the one shown, to compare with. */
export const RANGE_BEFORE: Record<RangeKey, string> = { '7d': t('the 7 days before'), '30d': t('the 30 days before'), '90d': t('the 90 days before'), '1y': t('the year before'), all: t('the period before') };
export const RANGE_PHRASE: Record<RangeKey, string> = { '7d': t('over the last 7 days'), '30d': t('over the last 30 days'), '90d': t('over the last 90 days'), '1y': t('over the last year'), all: t('so far') };
export const label = (id: string) => (EMOTION[id].depth === 0 ? shortName(id) : EMOTION[id].name);

/** The world felt most in the period, if any feelings were named. */
export const leadWorld = (s: S) => s.cores.reduce<{ id: string; count: number } | null>((a, c) => (c.count > (a?.count ?? 0) ? c : a), null)?.id ?? null;

export function Delta({ cur, prev, digits = 0, unit = '' }: { cur: number | null; prev: number | null | undefined; digits?: number; unit?: string }) {
  if (cur === null || prev === null || prev === undefined) return null;
  const d = cur - prev;
  if (Math.abs(d) < (digits ? 0.05 : 0.5)) return <span class="delta">{t('no change')}</span>;
  return (
    <span class="delta">
      {d > 0 ? '↑' : '↓'} {Math.abs(d).toFixed(digits)}{unit}
    </span>
  );
}

export function Tile({ icon, label: l, value, small, sub, delta, meter, pips, k = 0 }: {
  icon: UiName;
  label: string;
  value: string | number;
  /** a word rather than a figure: set smaller so it fits */
  small?: boolean;
  sub?: string;
  delta?: preact.ComponentChildren;
  /** 0–1: a thin bar under the figure */
  meter?: number;
  /** small dots under the figure, lit or not */
  pips?: boolean[];
  /** its place in the row, so the tiles arrive one after another */
  k?: number;
}) {
  return (
    <div class="tile" style={{ '--k': k }}>
      <div class="tile-top">
        <span class="tile-ico"><Icon name={icon} size={14} stroke={2} /></span>
        <span class="tile-label">{l}</span>
      </div>
      <div class={small ? 'tile-value small' : 'tile-value'}><CountUp value={value} /></div>
      <div class="tile-sub">{sub}{delta && sub ? ' · ' : ''}{delta}</div>
      {meter !== undefined && <div class="tile-meter"><i style={{ width: `${Math.max(0, Math.min(1, meter)) * 100}%` }} /></div>}
      {pips && <div class="pips">{pips.map((on, i) => <i class={on ? 'on' : ''} style={{ '--k': i }} />)}</div>}
    </div>
  );
}

/** A feeling or world as a small chip tinted with its own colour. */
export function WorldChip({ core, children }: { core: string; children: preact.ComponentChildren }) {
  return (
    <span class="world-chip" style={{ '--c': `var(--emo-${core})` }}>
      <Sprite core={core} size={12} />{children}
    </span>
  );
}
