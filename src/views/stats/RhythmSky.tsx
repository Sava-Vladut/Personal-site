import { shortName } from '../../data/emotions';
import { WEEKDAYS } from '../../lib/dates';
import type { Stats as S } from '../../lib/stats';
import { CloudChart, rollDelay } from '../../components/CloudChart';
import { TipRow, tipProps } from '../../components/charts';
import { Sprite } from '../../components/icons';
import { noun, t } from '../../lib/i18n';

const H = 7 * 30 + 26, T = 22, R = 4, B = 4, L = 28;
const BLOCKS = ['0–3', '3–6', '6–9', '9–12', '12–15', '15–18', '18–21', '21–24'];

/** The grid: eight three-hour columns a day, a row for each weekday. */
const grid = (W: number) => {
  const cw = (W - L - R) / 8, rh = (H - T - B) / 7;
  return { cw, rh, x: (b: number) => L + (b + 0.5) * cw, y: (d: number) => T + (d + 0.5) * rh };
};

/**
 * When you check in, as weather: a cloud for each weekday and three hours you wrote in, bigger the more often, in the
 * colour and letters of what you felt then, with that world's sprite in it. Where the clouds bank up is your rhythm.
 */
export function RhythmSky({ s, lead }: { s: S; lead: string | null }) {
  const cells = s.heat.flatMap((row, d) => row.flatMap((v, b) => (v ? [{ d, b, v, world: s.heatWorlds[d * 8 + b] ?? lead ?? 'calm-safety' }] : [])));
  const cols = cells.map((c) => c.b);

  return (
    <CloudChart
      height={H}
      puffs={(W) => {
        const { x, y } = grid(W);
        return cells.map((c) => ({ x: x(c.b), y: y(c.d), r: (0.045 + 0.085 * Math.sqrt(c.v / s.heatMax)) * (H - T - B), world: c.world }));
      }}
    >
      {(W) => {
        const { cw, rh, x, y } = grid(W);
        const size = cw >= 30 ? 14 : 12;
        return (
          <g role="group" aria-label={t('Entries by weekday and time of day.')}>
            {['0', '6', '12', '18', '24'].map((h, i) => (
              <text x={L + i * 2 * cw} y={12} class="tick" text-anchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{h}</text>
            ))}
            {WEEKDAYS.map((d, i) => <text x={0} y={y(i) + 4} class="tick">{d.slice(0, 2)}</text>)}
            {cells.map((c) => (
              <g transform={`translate(${(x(c.b) - size / 2).toFixed(1)},${(y(c.d) - size / 2).toFixed(1)})`} class="cc-mark">
                <g class="cc-mark-in" style={{ animationDelay: `${(0.3 + rollDelay(c.b, cols)).toFixed(2)}s` }}>
                  <Sprite core={c.world} size={size} />
                </g>
              </g>
            ))}
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
