import { useState } from 'preact/hooks';
import { CORE, EMOTION, PICKER_ORDER } from '../../data/emotions';
import { shortDate } from '../../lib/dates';
import { navigate } from '../../lib/router';
import type { dex } from '../../lib/stats';
import { RevealStack } from '../../components/charts';
import { AsciiMeter, Scramble, texture } from '../../components/ascii';
import { RAMPS } from '../../components/ramps';
import { trail } from '../../components/emotion';
import { Sprite } from '../../components/icons';
import { Sheet } from '../../components/Sheet';
import { Section } from './parts';
import { count, t } from '../../lib/i18n';

const feelingsOf = (core: string) => CORE[core].families.flatMap((f) => f.feelings);
/** An empty slot is a faint scatter of its world's lightest letters, waiting to be filled. */
const faint = (core: string, seed: number) => texture(core, 5, seed, (RAMPS[core] ?? RAMPS.default).slice(1, 4).join(''));

/** Every feeling you've named, all time. */
export function Dex({ found }: { found: ReturnType<typeof dex> }) {
  const [open, setOpen] = useState<string | null>(null);
  const e = open ? EMOTION[open] : null;
  const info = open ? found.get(open) : null;

  return (
    <RevealStack>
      <Section title={t('By world')} sub={t('Each specific feeling you log fills a slot. Tap one to read it again.')}>
        <div class="dex-worlds">
          {PICKER_ORDER.map((c, i) => {
            const all = feelingsOf(c), n = all.filter((x) => found.has(x.id)).length;
            return (
              <button
                class="dex-mini" data-core={c} style={{ '--c': `var(--emo-${c})`, '--k': i }} aria-label={t('{world}: {n} of {total} found', { world: CORE[c].name, n, total: all.length })}
                onClick={() => document.getElementById('dex-' + c)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <Sprite core={c} size={18} idle={n > 0} delay={i * 370} />
                <span class="dex-mini-n">{n}<small>/{all.length}</small></span>
                <AsciiMeter value={n / all.length} cells={5} world={c} />
              </button>
            );
          })}
        </div>
      </Section>
      {PICKER_ORDER.map((c) => {
        const all = feelingsOf(c), n = all.filter((x) => found.has(x.id)).length;
        return (
          <Section id={'dex-' + c} title={`${CORE[c].name} · ${n}/${all.length}`} world={c} bare>
            <div class="dex-slots" data-core={c} style={{ '--c': `var(--emo-${c})` }}>
              {all.map((x, i) =>
                found.has(x.id) ? (
                  <button class="dex-slot found" style={{ '--k': i }} onClick={() => setOpen(x.id)}>
                    <span><Scramble value={x.name} /></span>
                    <span class="dex-count">{found.get(x.id)!.count}×</span>
                  </button>
                ) : (
                  <button class="dex-slot" aria-label={t('Not found yet — check in with {world}', { world: CORE[c].name })} onClick={() => navigate('tracker?world=' + c)}>
                    <span class="dex-faint" aria-hidden="true">{faint(c, i)}</span>
                  </button>
                ),
              )}
            </div>
          </Section>
        );
      })}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={e?.name ?? ''}>
        {e && info && (
          <div class="stack">
            <div class="row gap-s"><Sprite core={e.core} size={18} /><span class="muted">{trail(e.id)}</span></div>
            <p class="definition big">{e.def}</p>
            <p class="muted small">{t('Named {count} · first on {date}', { count: count(info.count, 'time', 'times'), date: shortDate(info.first) })}</p>
          </div>
        )}
      </Sheet>
    </RevealStack>
  );
}
