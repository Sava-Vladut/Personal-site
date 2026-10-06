import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EMOTION, coreOf, shortName } from '../data/emotions';
import { dayLabel } from '../lib/dates';
import { goBack, navigate } from '../lib/router';
import { MAX_PERSON_EMOTIONS, deleteSong, getSongs, saveSong, toast, useEntries, usePeople, useSongs, type Entry, type Song } from '../lib/store';
import { songsIn } from '../lib/mentions';
import { Stars } from '../components/books';
import { EmotionChip, EmotionPicker } from '../components/emotion';
import { MentionText } from '../components/MentionText';
import { Icon } from '../components/icons';
import { MusicEmbed, MusicThing, isTape, musicSub } from '../components/music';
import { PeopleSheet, PersonChip, usePeopleById } from '../components/people';
import { Sheet } from '../components/Sheet';
import { CheckInRow, NoteCard } from './Journal';
import { rich, t } from '../lib/i18n';

type Open = null | 'emotion' | 'from';

/** A piece of music you keep: put it on, rate it, say how it makes you feel and who it brings to mind. */
export function SongView({ id }: { id: string }) {
  const [draft, setDraft] = useState<Song | null>(() => getSongs().find((s) => s.id === id) ?? null);
  const [open, setOpen] = useState<Open>(null);
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState('');
  const dirty = useRef(false);
  const alive = useRef(true);
  const removing = useRef(false);
  const saveRequest = useRef(0);
  const pendingSave = useRef<Promise<boolean> | null>(null);
  const leaving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(draft);
  latest.current = draft;
  const entries = useEntries();
  const byId = usePeopleById();
  // the people it's the theme song of
  const themeOf = usePeople().filter((p) => p.theme && draft && p.theme.kind === draft.music.kind && p.theme.id === draft.music.id);
  const kind = draft?.music.kind, mid = draft?.music.id;
  const songs = useSongs();
  // notes it's added to, and notes that tag it in their words
  const notes = useMemo(() => entries.filter((e) => e.music.some((m) => m.kind === kind && m.id === mid) || songsIn(e.text, songs).includes(id)), [entries, songs, kind, mid]);

  const flush = () => {
    clearTimeout(timer.current);
    const d = latest.current;
    if (removing.current || !d) return Promise.resolve(false);
    if (!dirty.current) return pendingSave.current ?? Promise.resolve(true);
    dirty.current = false;
    const request = ++saveRequest.current;
    const saving = saveSong(d).then(() => {
      if (alive.current && !removing.current && request === saveRequest.current && !dirty.current) setStatus(t('Saved'));
      return true;
    }).catch(() => {
      if (!removing.current && request === saveRequest.current) {
        dirty.current = true;
        setStatus(t('Couldn’t save'));
        toast(t('Couldn’t save this music. Try again.'));
      }
      return false;
    }).finally(() => {
      if (pendingSave.current === saving) pendingSave.current = null;
    });
    pendingSave.current = saving;
    return saving;
  };
  const update = (patch: Partial<Song>) => {
    if (removing.current || !latest.current) return;
    latest.current = { ...latest.current, ...patch };
    setDraft(latest.current);
    dirty.current = true;
    setStatus('');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };

  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hide);
    return () => {
      alive.current = false;
      document.removeEventListener('visibilitychange', hide);
      flush();
    };
  }, []);

  // How the notes it's in felt: the worlds of every feeling in them.
  const felt = useMemo(() => {
    const worlds = new Map<string, number>();
    for (const e of notes) for (const eid of e.emotions) worlds.set(coreOf(eid).id, (worlds.get(coreOf(eid).id) ?? 0) + 1);
    return { total: [...worlds.values()].reduce((a, b) => a + b, 0), worlds: [...worlds].sort((a, b) => b[1] - a[1]) };
  }, [notes]);
  const groups = useMemo(() => {
    const out: [string, Entry[]][] = [];
    for (const e of notes) {
      const last = out[out.length - 1];
      if (last && last[0] === e.date) last[1].push(e);
      else out.push([e.date, [e]]);
    }
    return out;
  }, [notes]);

  if (!draft)
    return (
      <div class="page">
        <div class="empty">
          <h2 class="title-s">{t('This isn’t in your records')}</h2>
          <p>{t('It may have been removed.')}</p>
          <button class="btn btn-primary" onClick={() => goBack('media')}>{t('Back to media')}</button>
        </div>
      </div>
    );

  const m = draft.music;
  const tape = isTape(m);
  const remove = async () => {
    if (removing.current) return;
    if (!confirm(t('Remove “{title}” from your records? Notes it’s in keep it.', { title: m.title }))) return;
    clearTimeout(timer.current);
    removing.current = true;
    dirty.current = false;
    await pendingSave.current;
    try {
      const removed = await deleteSong(draft.id);
      if (alive.current) goBack('media');
      if (removed) toast(t('Removed from your records'), { label: t('Undo'), run: () => saveSong(removed) });
    } catch {
      removing.current = false;
      dirty.current = true;
      toast(t('Couldn’t remove this music. Try again.'));
    }
  };
  const done = async () => {
    if (leaving.current) return;
    leaving.current = true;
    await flush();
    if (!dirty.current && alive.current && !removing.current) goBack('media');
    else leaving.current = false;
  };
  const addEmotion = (eid: string) => {
    const list = draft.emotions.filter((x) => x !== eid && !eid.startsWith(x + '/') && !x.startsWith(eid + '/'));
    update({ emotions: [...list, eid].slice(-MAX_PERSON_EMOTIONS) });
    setOpen(null);
  };
  const write = async () => {
    if (leaving.current) return;
    leaving.current = true;
    await flush();
    if (!dirty.current && alive.current && !removing.current) navigate(`note/new?song=${draft.id}`);
    else leaving.current = false;
  };
  const from = draft.from ? byId.get(draft.from) : undefined;
  const main = draft.emotions[0] ? coreOf(draft.emotions[0]).id : null;

  return (
    <div class="page editor song-page">
      <div class="editor-bar">
        <button class="glass glass-btn round" onClick={done} aria-label={t('Back')}><Icon name="arrow-left" /></button>
        <span class="editor-status" aria-live="polite">{status && <span class="glass">{status}</span>}</span>
        <button class="glass glass-btn round" onClick={remove} aria-label={t('Remove from your records')}><Icon name="trash" /></button>
        <button class="glass glass-btn tinted" onClick={done}>{t('Done')}</button>
      </div>

      <div class={`song-head${on ? ' is-on' : ''}${draft.repeat && !on ? ' is-repeat' : ''}`} style={{ '--c': main ? `var(--emo-${main})` : undefined }}>
        <button class="song-thing" onClick={() => setOn(!on)} aria-pressed={on} aria-label={on ? t('Close the player') : tape ? t('Play the tape') : t('Put the record on')}>
          <MusicThing m={m} />
        </button>
        <h1 class="song-title">{m.title}</h1>
        <p class="song-sub">{musicSub(m)}</p>
        <Stars value={draft.rating} onChange={(rating) => update({ rating })} size={24} />
        <div class="row gap-s song-actions">
          <button class="btn btn-primary btn-s" onClick={() => setOn(!on)}><Icon name={on ? 'player-pause' : 'player-play'} size={16} /> {on ? t('Stop') : t('Play')}</button>
          <button class="btn btn-quiet btn-s" aria-pressed={draft.repeat} onClick={() => update({ repeat: !draft.repeat })}><Icon name="repeat" size={16} /> {t('On repeat')}</button>
          <a class="btn btn-quiet btn-s" href={m.link} target="_blank" rel="noopener noreferrer" aria-label={t('Open in Spotify')}><Icon name="brand-spotify" size={16} /></a>
        </div>
      </div>
      {on && <div class="song-player"><MusicEmbed m={m} /></div>}

      <div class="eyebrow person-label">{t('How it makes you feel')}</div>
      <div class="meta person-meta">
        {draft.emotions.map((eid) => <EmotionChip id={eid} onRemove={() => update({ emotions: draft.emotions.filter((x) => x !== eid) })} />)}
        {draft.emotions.length < MAX_PERSON_EMOTIONS && (
          <button class="chip" onClick={() => setOpen('emotion')}>
            <Icon name="mood-plus" size={16} /> {draft.emotions.length ? t('Add') : t('Add a feeling')}
          </button>
        )}
      </div>
      {draft.emotions.length === 1 && EMOTION[draft.emotions[0]]?.depth === 2 && <p class="definition">{EMOTION[draft.emotions[0]].def}</p>}

      {themeOf.length > 0 && (
        <p class="theme-of">
          <Icon name="vinyl" size={15} /> {themeOf.map((p, i) => <>{i > 0 && (i === themeOf.length - 1 ? ' and ' : ', ')}<a href={'#/person/' + p.id} onClick={(e) => { e.preventDefault(); flush(); navigate('person/' + p.id); }}>{p.name.trim().split(/\s+/)[0]}</a></>)}’s theme song
        </p>
      )}

      <div class="eyebrow person-label">{t('Thinking of')}</div>
      <div class="meta person-meta">
        {from ? (
          <PersonChip p={from} onRemove={() => update({ from: null })} />
        ) : (
          <button class="chip" onClick={() => setOpen('from')}><Icon name="user-plus" size={16} /> {t('Add someone')}</button>
        )}
      </div>

      <MentionText
        class="body-input person-text"
        placeholder={t('What it means to you: where you first heard it, the line that gets you, when you play it…')}
        value={draft.text}
        onChange={(text) => update({ text })}
        label={t('What it means to you')}
      />

      <section class="section">
        <div class="row between">
          <h2 class="section-title">{t('In your journal')}</h2>
          {notes.length > 0 && <span class="muted small">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>}
        </div>
        <div class="row gap-s person-actions">
          <button class="btn btn-quiet grow" onClick={write}><Icon name="pencil" size={18} /> {t('Write about it')}</button>
        </div>
        {felt.total > 0 && (
          <div class="card person-felt">
            <div class="chart-title">{t('How your notes with it felt')}</div>
            <div class="split-bar" role="img" aria-label={felt.worlds.map(([c, n]) => `${shortName(c)} ${Math.round((n / felt.total) * 100)}%`).join(', ')}>
              {felt.worlds.map(([c, n]) => <i style={{ flex: n, background: `var(--emo-${c})` }} title={`${shortName(c)} · ${n}`} />)}
            </div>
          </div>
        )}
        {groups.length ? (
          groups.map(([date, list]) => (
            <section class="day">
              <h3 class="day-label">{dayLabel(date)}</h3>
              <div class="entries">{list.map((e) => (e.kind === 'checkin' ? <CheckInRow e={e} /> : <NoteCard e={e} />))}</div>
            </section>
          ))
        ) : (
          <p class="empty-note">{rich('Add it to a note (the {icon} button while writing) and the note shows up here.', { icon: <Icon name="brand-spotify" size={14} /> })}</p>
        )}
      </section>

      <Sheet open={open === 'emotion'} onClose={() => setOpen(null)} title={t('How does it make you feel?')}>
        <EmotionPicker onPick={addEmotion} selected={draft.emotions} />
      </Sheet>
      <PeopleSheet
        open={open === 'from'}
        onClose={() => setOpen(null)}
        selected={draft.from ? [draft.from] : []}
        onChange={(ids) => { update({ from: ids.find((x) => x !== draft.from) ?? null }); setOpen(null); }}
      />
    </div>
  );
}
