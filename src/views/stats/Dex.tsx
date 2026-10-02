import { useMemo, useState } from 'preact/hooks';
import { CORE, EMOTION, FEELINGS, PICKER_ORDER } from '../../data/emotions';
import { shortDate } from '../../lib/dates';
import { navigate } from '../../lib/router';
import { dex } from '../../lib/stats';
import { useEntries } from '../../lib/store';
import { CountUp, RevealStack } from '../../components/charts';
import { trail } from '../../components/emotion';
import { Sprite } from '../../components/icons';
import { Sheet } from '../../components/Sheet';

const feelingsOf = (core: string) => CORE[core].families.flatMap((f) => f.feelings);

/** Every feeling you've named, all time. */
export function Dex() {
  const entries = useEntries();
  const found = useMemo(() => dex(entries), [entries]);
  const [open, setOpen] = useState<string | null>(null);
  const e = open ? EMOTION[open] : null;
  const info = open ? found.get(open) : null;

  return (
    <RevealStack>
      <section class="card hero">
        <div class="tile-label">Feelings named · all time</div>
        <div class="hero-row">
          <span class="hero-num"><CountUp value={found.size} /></span>
          <span class="hero-scale">of {FEELINGS.length}</span>
        </div>
        <div class="dex-worlds">
          {PICKER_ORDER.map((c, i) => {
            const all = feelingsOf(c), n = all.filter((x) => found.has(x.id)).length;
            return (
              <button
                class="dex-mini" data-core={c} style={{ '--c': `var(--emo-${c})`, '--k': i }} aria-label={`${CORE[c].name}: ${n} of ${all.length} found`}
                onClick={() => document.getElementById('dex-' + c)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <Sprite core={c} size={18} idle={n > 0} delay={i * 370} />
                <span class="dex-mini-n">{n}<small>/{all.length}</small></span>
                <span class="dex-mini-bar"><i style={{ width: `${(n / all.length) * 100}%` }} /></span>
              </button>
            );
          })}
        </div>
        <p class="muted small">Each specific feeling you log fills a slot. Tap one to read it again.</p>
      </section>
      {PICKER_ORDER.map((c, i) => {
        const all = feelingsOf(c), n = all.filter((x) => found.has(x.id)).length;
        return (
          <section class="dex-world" id={'dex-' + c} data-core={c} style={{ '--c': `var(--emo-${c})` }}>
            <h3 class="dex-title">
              <Sprite core={c} size={14} idle delay={i * 370} /> {CORE[c].name}
              <span class="dex-tally">{n}/{all.length}</span>
            </h3>
            <div class="dex-slots">
              {all.map((x, i) =>
                found.has(x.id) ? (
                  <button class="dex-slot found" style={{ '--k': i }} onClick={() => setOpen(x.id)}>
                    <span>{x.name}</span>
                    <span class="dex-count">{found.get(x.id)!.count}×</span>
                  </button>
                ) : (
                  <button class="dex-slot" aria-label={`Not found yet — check in with ${CORE[c].name}`} onClick={() => navigate('tracker?world=' + c)}>???</button>
                ),
              )}
            </div>
          </section>
        );
      })}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={e?.name ?? ''}>
        {e && info && (
          <div class="stack">
            <div class="row gap-s"><Sprite core={e.core} size={18} /><span class="muted">{trail(e.id)}</span></div>
            <p class="definition big">{e.def}</p>
            <p class="muted small">Named {info.count} {info.count === 1 ? 'time' : 'times'} · first on {shortDate(info.first)}</p>
          </div>
        )}
      </Sheet>
    </RevealStack>
  );
}
