import { useEffect, useState } from 'preact/hooks';
import { goBack } from '../lib/router';
import { keyOf, shortDate } from '../lib/dates';
import { RevealStack } from '../components/charts';
import { PageHead } from '../components/PageHead';
import { Icon, type UiName } from '../components/icons';
import { Sky } from '../components/Sky';
import { t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/gops.css';

// The Global Operations browser port's progress, from the status.json its loop writes after every
// iteration (served by server/gops.js). Screenshots and the play build live at /gops-debug/.
const WORLD = 'anger';
const FILES = '/gops-debug/';

interface Status {
  updated: string;
  commit: string;
  phase: string;
  phases: { title: string; items: { done: boolean; text: string }[] }[];
  /** newest first */
  log: string[];
  facts: string[];
  metrics: {
    blocker?: string;
    untranslated?: number;
    imports_implemented?: number;
    imports_needed?: number;
    /** ponytail `shortcut:` markers in the port's code, counted by its dashboard script */
    shortcuts?: number;
    build?: { ok: boolean; when?: string; tail?: string };
    frames?: { name: string; original: string; port: string; diff_pct?: number }[];
  };
  play: boolean;
}

function ago(ms: number) {
  const s = (Date.now() - ms) / 1000;
  if (s < 90) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.round(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.round(s / 3600) });
  return shortDate(keyOf(new Date(ms)));
}

/** The status, fetched now and again every minute while the page is open. */
function useStatus() {
  const [s, setS] = useState<{ data: Status | null; error: string | null }>({ data: null, error: null });
  const load = () =>
    fetch('/api/gops', { signal: AbortSignal.timeout(15_000) })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || t('The port’s progress couldn’t be loaded.'));
        setS({ data: body as Status, error: null });
      }, () => { throw new Error(t('Couldn’t reach the server. Check your connection.')); })
      .catch((e: Error) => setS((prev) => ({ ...prev, error: e.message })));
  useEffect(() => {
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => clearInterval(timer);
  }, []);
  return { ...s, load };
}

export function Gops() {
  const { data, error, load } = useStatus();
  return (
    <div class="page stats-page gops-page">
      <div class="journal-top stats-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead
          title={t('Global Ops port')}
          back={() => goBack()}
          subtitle={data ? t('Phase {n} · updated {when}', { n: data.phase, when: ago(Date.parse(data.updated)) }) : t('The browser port’s progress')}
        />
      </div>
      {data ? (
        <Board data={data} />
      ) : error ? (
        <div class="empty">
          <h2 class="title-s">{t('No progress yet')}</h2>
          <p>{error}</p>
          <button class="btn btn-quiet" onClick={() => void load()}><Icon name="refresh" size={18} /> {t('Try again')}</button>
        </div>
      ) : (
        <p class="empty-note center">{t('Loading…')}</p>
      )}
    </div>
  );
}

function Board({ data }: { data: Status }) {
  const m = data.metrics;
  const items = data.phases.flatMap((p) => p.items);
  const gates = items.filter((i) => i.text.includes('GATE'));
  const current = data.phases.find((p) => p.title.startsWith(`Phase ${data.phase}:`));

  return (
    <RevealStack>
      {m.blocker && (
        <section class="card gops-card gops-blocker">
          <h3 class="chart-title"><Icon name="alert-circle" size={18} stroke={2} /> {t('Needs you')}</h3>
          <p>{m.blocker}</p>
        </section>
      )}
      {data.play && (
        <a class="card gops-card gops-play" href={FILES + 'play/'} target="_blank" rel="noopener">
          <Icon name="player-play" size={22} stroke={2} /> {t('Play the current build')}
        </a>
      )}

      <div class="tiles">
        <Tile k={0} icon="device-gamepad-2" label={t('Phase')} value={data.phase} sub={current?.title.replace(/^Phase \w+:\s*/, '') ?? ''} />
        <Tile k={1} icon="flag" label={t('Checkpoints')} value={`${gates.filter((g) => g.done).length} / ${gates.length}`} sub={t('go/no-go stops passed')} />
        {m.untranslated != null && <Tile k={2} icon="code" label={t('Untranslated')} value={m.untranslated.toLocaleString()} sub={t('instructions left')} />}
        {m.imports_needed != null && (
          <Tile k={3} icon="list-check" label={t('Windows functions')} value={`${m.imports_implemented ?? 0} / ${m.imports_needed}`} sub={t('implemented')} />
        )}
        {m.shortcuts != null && <Tile k={4} icon="list" label={t('Shortcuts')} value={String(m.shortcuts)} sub={t('known limits to revisit')} />}
      </div>

      {m.build && (
        <section class="card gops-card">
          <h3 class="chart-title">{t('Last build')}: <span class={m.build.ok ? 'gops-ok' : 'gops-bad'}>{m.build.ok ? t('Passing') : t('Failing')}</span></h3>
          {m.build.when && <p class="chart-sub">{m.build.when}</p>}
          {m.build.tail && <pre class="gops-pre">{m.build.tail}</pre>}
        </section>
      )}

      {m.frames?.map((f) => (
        <section class="card gops-card" key={f.name}>
          <h3 class="chart-title">{f.name}</h3>
          {f.diff_pct != null && <p class="chart-sub">{t('{n}% different from the original', { n: f.diff_pct })}</p>}
          <div class="gops-pair">
            <figure><img src={FILES + f.original} alt="" loading="lazy" /><figcaption>{t('Original')}</figcaption></figure>
            <figure><img src={FILES + f.port} alt="" loading="lazy" /><figcaption>{t('Port')}</figcaption></figure>
          </div>
        </section>
      ))}

      {data.log.length > 0 && (
        <section class="card gops-card">
          <h3 class="chart-title">{t('Log')}</h3>
          <ul class="gops-log">{data.log.map((l) => <li>{l}</li>)}</ul>
        </section>
      )}

      {data.phases.map((p) => {
        const done = p.items.filter((i) => i.done).length;
        return (
          <details class="card gops-card gops-phase" open={p === current} key={p.title}>
            <summary><b>{p.title}</b> <span class="gops-count">{done} / {p.items.length}</span></summary>
            <ul>
              {p.items.map((i) => (
                <li class={i.done ? 'done' : ''}><Icon name={i.done ? 'check' : 'point'} size={16} stroke={2} /> <span>{i.text}</span></li>
              ))}
            </ul>
          </details>
        );
      })}

      <a class="btn btn-quiet gops-raw" href={FILES} target="_blank" rel="noopener"><Icon name="external-link" size={18} /> {t('Open the plain page')}</a>
    </RevealStack>
  );
}

function Tile({ icon, label, value, sub, k }: { icon: UiName; label: string; value: string; sub: string; k: number }) {
  return (
    <div class="tile" style={{ '--k': k }}>
      <div class="tile-top">
        <span class="tile-ico"><Icon name={icon} size={14} stroke={2} /></span>
        <span class="tile-label">{label}</span>
      </div>
      <div class="tile-value">{value}</div>
      <div class="tile-sub">{sub}</div>
    </div>
  );
}
