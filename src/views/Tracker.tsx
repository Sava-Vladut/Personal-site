import { useMemo, useRef, useState } from 'preact/hooks';
import { EMOTION, FEELINGS, shortName } from '../data/emotions';
import { keyOf, todayKey } from '../lib/dates';
import { navigate } from '../lib/router';
import { blankEntry, deleteEntry, getPeople, saveEntry, toast, useEntries, useSettings } from '../lib/store';
import { streaks } from '../lib/stats';
import { addContext } from '../lib/weather';
import { IntensityPicker, WorldDetail, WorldGrid, trail } from '../components/emotion';
import { EmotionWheel } from '../components/EmotionWheel';
import { Sky } from '../components/Sky';
import { MentionText } from '../components/MentionText';
import { Icon, Sprite } from '../components/icons';
import { PeopleChips, PeopleSheet } from '../components/people';
import { CheckInRow } from './Journal';

const localInput = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export function Tracker({ query }: { query: URLSearchParams }) {
  const entries = useEntries();
  const { picker } = useSettings();
  const [core, setCore] = useState<string | null>(() => {
    const world = query.get('world');
    return world && EMOTION[world]?.depth === 0 ? world : null;
  });
  const [picked, setPicked] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [note, setNote] = useState('');
  const [when, setWhen] = useState<string | null>(null);
  // Checking in from a person's page tags them from the start.
  const tagged = () => { const pid = query.get('person'); return pid && getPeople().some((p) => p.id === pid) ? [pid] : []; };
  const [people, setPeople] = useState<string[]>(tagged);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  const named = useMemo(() => new Set(entries.flatMap((e) => e.emotions).filter((id) => EMOTION[id]?.depth === 2)), [entries]);
  const today = todayKey();
  const todays = entries.filter((e) => e.kind === 'checkin' && e.date === today);
  // how many entries touch each emotion, counting a feeling toward its zone and world too
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const e of entries) {
      const ids = new Set<string>();
      for (const id of e.emotions) {
        const parts = id.split('/');
        for (let i = 1; i <= parts.length; i++) ids.add(parts.slice(0, i).join('/'));
      }
      for (const id of ids) out[id] = (out[id] ?? 0) + 1;
    }
    return out;
  }, [entries]);
  const streak = useMemo(() => streaks(entries).current, [entries]);

  const reset = () => {
    setPicked(null);
    setCore(null);
    setIntensity(3);
    setNote('');
    setWhen(null);
    setPeople([]);
  };

  const log = async () => {
    if (!picked || !EMOTION[picked] || submitting.current) return;
    const time = when ? new Date(when).getTime() : Date.now();
    if (!Number.isFinite(time) || time > Date.now()) return toast('Choose a valid time that isn’t in the future.');
    const e = { ...blankEntry('checkin'), emotions: [picked], intensity, text: note.trim(), people, time, date: keyOf(new Date(time)) };
    const fresh = EMOTION[picked].depth === 2 && !named.has(picked);
    submitting.current = true;
    setSaving(true);
    try {
      await saveEntry(e);
    } catch {
      toast('Couldn’t save this check-in. Try again.');
      return;
    } finally {
      submitting.current = false;
      setSaving(false);
    }
    addContext(e);
    const name = EMOTION[picked].depth === 0 ? shortName(picked) : EMOTION[picked].name;
    toast(fresh ? `New feeling named: ${name} · ${named.size + 1} of ${FEELINGS.length}` : `Logged: ${name}`, {
      label: 'Undo',
      run: () => deleteEntry(e.id),
    });
    reset();
    scrollTo({ top: 0, behavior: 'smooth' });
  };

  const p = picked ? EMOTION[picked] : null;
  // the sky takes the colour of the world you're in, else the one you last checked in with today
  const mood = todays.find((e) => e.emotions.length);
  const world = p?.core ?? core ?? (mood ? EMOTION[mood.emotions[0]]?.core : null) ?? null;

  return (
    <div class="page">
      <div class="journal-top track-top" style={world ? { '--sky': `var(--emo-${world})` } : undefined}>
      <Sky world={world} />
      <header class="page-head">
        <div class="eyebrow">Check in</div>
        <h1 class="title">How are you feeling?</h1>
        <p class="subtitle">Name it to tame it. Pick a world, then find the word.</p>
      </header>

      {p ? (
        <div class="card confirm" style={{ '--c': `var(--emo-${p.core})` }}>
          <div class="confirm-head">
            <span class="confirm-sprite"><Sprite core={p.core} size={26} /></span>
            <div class="grow">
              <div class="row gap-s">
                <h2 class="confirm-name">{p.depth === 0 ? EMOTION[p.core].name : p.name}</h2>
                {p.depth === 2 && !named.has(p.id) && <span class="badge">New</span>}
              </div>
              {p.depth > 0 && <div class="confirm-path">{trail(p.id)}</div>}
            </div>
            <button class="btn btn-quiet btn-s" onClick={() => setPicked(null)}>Change</button>
          </div>
          <p class="definition">{p.def}</p>

          <IntensityPicker value={intensity} onChange={setIntensity} cores={[p.core]} />

          <div class="confirm-extra">
            <span class="field-label">Add context <span class="muted">· optional</span></span>
            <MentionText
              class="input confirm-note"
              rows={2}
              autosize={false}
              placeholder="What’s behind it? Type @ to tag someone, a book or a song"
              value={note}
              onChange={setNote}
              onPerson={(p) => setPeople((ids) => (ids.includes(p.id) ? ids : [...ids, p.id]))}
              label="Note"
            />
            <div class="meta confirm-people">
              <PeopleChips ids={people} onChange={setPeople} onAdd={() => setPicking(true)} />
              {when === null ? (
                <button class="chip" onClick={() => setWhen(localInput(Date.now()))} aria-label="When: now. Change time">
                  <Icon name="clock" size={16} /> Now <Icon name="chevron-down" size={14} />
                </button>
              ) : (
                <input class="input input-s confirm-when" type="datetime-local" value={when} max={localInput(Date.now())} onInput={(e) => setWhen(e.currentTarget.value)} aria-label="When" />
              )}
            </div>
          </div>

          <button class="btn btn-primary block confirm-log" onClick={log} disabled={saving}>{saving ? 'Saving…' : 'Log feeling'}</button>
        </div>
      ) : picker === 'wheel' ? (
        <EmotionWheel focus={core} onFocus={setCore} onPick={setPicked} counts={counts} />
      ) : core ? (
        <div class="card pad-s">
          <WorldDetail core={core} onBack={() => setCore(null)} onPick={setPicked} />
        </div>
      ) : (
        <WorldGrid onSelect={setCore} />
      )}
      </div>

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

      <PeopleSheet open={picking} onClose={() => setPicking(false)} selected={people} onChange={setPeople} />

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
