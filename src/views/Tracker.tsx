import { useMemo, useState } from 'preact/hooks';
import { EMOTION, FEELINGS, shortName } from '../data/emotions';
import { keyOf, todayKey } from '../lib/dates';
import { navigate } from '../lib/router';
import { blankEntry, deleteEntry, saveEntry, toast, useEntries, useSettings } from '../lib/store';
import { streaks } from '../lib/stats';
import { IntensityPicker, WorldDetail, WorldGrid, trail } from '../components/emotion';
import { EmotionWheel } from '../components/EmotionWheel';
import { Icon, Sprite } from '../components/icons';
import { CheckInRow } from './Journal';

const localInput = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export function Tracker({ query }: { query: URLSearchParams }) {
  const entries = useEntries();
  const { picker } = useSettings();
  const [core, setCore] = useState<string | null>(query.get('world'));
  const [picked, setPicked] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [note, setNote] = useState('');
  const [when, setWhen] = useState<string | null>(null);

  const named = useMemo(() => new Set(entries.flatMap((e) => e.emotions).filter((id) => EMOTION[id]?.depth === 2)), [entries]);
  const today = todayKey();
  const todays = entries.filter((e) => e.kind === 'checkin' && e.date === today);
  const streak = useMemo(() => streaks(entries).current, [entries]);

  const reset = () => {
    setPicked(null);
    setCore(null);
    setIntensity(3);
    setNote('');
    setWhen(null);
  };

  const log = async () => {
    if (!picked) return;
    const time = when ? new Date(when).getTime() : Date.now();
    const e = { ...blankEntry('checkin'), emotions: [picked], intensity, text: note.trim(), time, date: keyOf(new Date(time)) };
    const fresh = EMOTION[picked].depth === 2 && !named.has(picked);
    await saveEntry(e);
    const name = EMOTION[picked].depth === 0 ? shortName(picked) : EMOTION[picked].name;
    toast(fresh ? `New feeling named: ${name} · ${named.size + 1} of ${FEELINGS.length}` : `Logged: ${name}`, {
      label: 'Undo',
      run: () => deleteEntry(e.id),
    });
    reset();
    scrollTo({ top: 0, behavior: 'smooth' });
  };

  const p = picked ? EMOTION[picked] : null;

  return (
    <div class="page">
      <header class="page-head">
        <div class="eyebrow">Check in</div>
        <h1 class="title">How are you feeling?</h1>
        <p class="subtitle">Name it to tame it. Pick a world, then find the word.</p>
      </header>

      {p ? (
        <div class="card confirm" style={{ '--c': `var(--emo-${p.core})` }}>
          <div class="confirm-head">
            <Sprite core={p.core} size={30} />
            <div>
              <h2 class="confirm-name">{p.depth === 0 ? EMOTION[p.core].name : p.name}</h2>
              {p.depth > 0 && <div class="confirm-path">{trail(p.id)}</div>}
            </div>
            {p.depth === 2 && !named.has(p.id) && <span class="badge">New</span>}
          </div>
          <p class="definition">{p.def}</p>
          <div class="meta-row">
            <span class="eyebrow">Intensity</span>
            <IntensityPicker value={intensity} onChange={setIntensity} />
          </div>
          <textarea class="input" rows={2} placeholder="What’s behind it? (optional)" value={note} onInput={(e) => setNote(e.currentTarget.value)} aria-label="Note" />
          <div class="row between">
            <span class="eyebrow">When</span>
            {when === null ? (
              <button class="chip" onClick={() => setWhen(localInput(Date.now()))}><Icon name="clock" size={16} /> Now</button>
            ) : (
              <input class="input input-s" type="datetime-local" value={when} max={localInput(Date.now())} onInput={(e) => setWhen(e.currentTarget.value)} aria-label="When" />
            )}
          </div>
          <div class="row gap-s">
            <button class="btn btn-quiet" onClick={() => setPicked(null)}>Back</button>
            <button class="btn btn-primary grow" onClick={log}>Log feeling</button>
          </div>
        </div>
      ) : picker === 'wheel' ? (
        <EmotionWheel focus={core} onFocus={setCore} onPick={setPicked} />
      ) : core ? (
        <div class="card pad-s">
          <WorldDetail core={core} onBack={() => setCore(null)} onPick={setPicked} />
        </div>
      ) : (
        <WorldGrid onSelect={setCore} />
      )}

      <section class="section">
        <div class="row between">
          <h2 class="section-title">Today</h2>
          {streak > 1 && <span class="muted small">{streak}-day streak</span>}
        </div>
        {todays.length ? (
          <div class="entries">{todays.map((e) => <CheckInRow e={e} />)}</div>
        ) : (
          <p class="empty-note">No check-ins yet today.</p>
        )}
      </section>

      <button class="card dex-link" onClick={() => navigate('stats?tab=dex')}>
        <div>
          <div class="section-title">Feelings named</div>
          <div class="muted small">{named.size} of {FEELINGS.length} found</div>
        </div>
        <div class="meter" aria-hidden="true"><i style={{ width: `${(named.size / FEELINGS.length) * 100}%` }} /></div>
        <Icon name="chevron-right" />
      </button>
    </div>
  );
}
