import { useMemo } from 'preact/hooks';
import { shortName } from '../../data/emotions';
import { WEEKDAYS } from '../../lib/dates';
import type { Stats as S } from '../../lib/stats';
import { CloudChart, type Puff } from '../../components/CloudChart';
import { TipRow, tipProps } from '../../components/charts';
import { noun, t } from '../../lib/i18n';

const H = 7 * 30 + 26;
const INSET: [number, number, number, number] = [22, 4, 4, 28]; // top, right, bottom, left
const BLOCKS = ['0–3', '3–6', '6–9', '9–12', '12–15', '15–18', '18–21', '21–24'];

/**
 * When you check in, as weather: a cloud for each weekday and three hours you wrote in, bigger the more often, in the
 * colour and letters of what you felt then. Where the clouds bank up is your rhythm.
 */
export function RhythmSky({ s, lead }: { s: S; lead: string | null }) {
  const puffs = useMemo<Puff[]>(
    () => s.heat.flatMap((row, d) => row.flatMap((v, b) => (v ? [{
      x: (b + 0.5) / 8, y: (d + 0.5) / 7, r: 0.045 + 0.085 * Math.sqrt(v / s.heatMax),
      world: s.heatWorlds[d * 8 + b] ?? lead ?? 'calm-safety',
    }] : []))),
    [s, lead],
  );

  return (
    <CloudChart puffs={puffs} height={H} inset={INSET}>
      {(W) => {
        const [T, R, B, L] = INSET;
        const cw = (W - L - R) / 8, rh = (H - T - B) / 7;
        return (
          <g role="group" aria-label={t('Entries by weekday and time of day.')}>
            {['0', '6', '12', '18', '24'].map((h, i) => (
              <text x={L + i * 2 * cw} y={12} class="tick" text-anchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{h}</text>
            ))}
            {WEEKDAYS.map((d, i) => <text x={0} y={T + (i + 0.5) * rh + 4} class="tick">{d.slice(0, 2)}</text>)}
            {s.heat.map((row, d) => row.map((v, b) => {
              const world = s.heatWorlds[d * 8 + b];
              return (
                <rect
                  x={L + b * cw} y={T + d * rh} width={cw} height={rh} fill="transparent" class="cc-cell"
                  {...tipProps(() => (
                    <>
                      <div class="tip-title">{WEEKDAYS[d]} · {BLOCKS[b]}h</div>
                      <TipRow value={v} label={noun(v, 'entry', 'entries')} />
                      {world && <TipRow value={shortName(world)} label={t('most felt')} color={`var(--emo-${world})`} />}
                    </>
                  ), `${WEEKDAYS[d]} ${BLOCKS[b]}: ${v}`)}
                />
              );
            }))}
          </g>
        );
      }}
    </CloudChart>
  );
}
