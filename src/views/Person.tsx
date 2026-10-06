import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EMOTION, coreOf, shortName } from '../data/emotions';
import { dayLabel, monthLabel, monthShort } from '../lib/dates';
import { monthsOf, trendOf } from '../lib/people';
import { goBack, navigate } from '../lib/router';
import { MAX_PERSON_EMOTIONS, blankPerson, deletePerson, getBooks, getEntries, getPeople, getSongs, saveBook, saveEntry, savePerson, saveSong, toast, useBooks, useSongs, type Entry, type Person } from '../lib/store';
import { renamePersonMentions } from '../lib/mentions';
import { EmotionChip, EmotionPicker } from '../components/emotion';
import { BookRow } from '../components/books';
import { SongRow } from '../components/music';
import { MentionText } from '../components/MentionText';
import { IconSheet } from '../components/IconPicker';
import { Icon, NoteIcon } from '../components/icons';
import { Avatar, initials } from '../components/people';
import { KeyDates } from '../components/KeyDates';
import { ThemeSong } from '../components/ThemeSong';
import { connectSpotify } from '../lib/spotify';
import { tipProps } from '../components/charts';
import { Sheet } from '../components/Sheet';
import { CheckInRow, NoteCard } from './Journal';
import { lastSeen, useMoments, usePages } from './People';
import { t } from '../lib/i18n';

type Open = null | 'icon' | 'emotion';

function useAutosize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return ref;
}

export function PersonView({ id }: { id: string }) {
  const [draft, setDraft] = useState<Person | null>(() => (id === 'new' ? blankPerson() : getPeople().find((p) => p.id === id) ?? null));
  const [open, setOpen] = useState<Open>(null);
  const [status, setStatus] = useState('');
  const saved = useRef(id !== 'new');
  const dirty = useRef(false);
  const alive = useRef(true);
  const removing = useRef(false);
  const pendingSave = useRef<Promise<boolean> | null>(null);
  const leaving = useRef(false);
  const saveRequest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(draft);
  latest.current = draft;
  const nameRef = useAutosize(draft?.name ?? '');
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const moments = useMoments().get(draft?.id ?? '') ?? [];
  const pages = usePages().get(draft?.id ?? '') ?? [];
  const books = useBooks().filter((b) => b.from && b.from === draft?.id);
  const songs = useSongs().filter((s) => s.from && s.from === draft?.id);

  const syncUrl = () => {
    const d = latest.current;
    if (saved.current && d && !history.state?.mmSheet && location.hash === '#/person/new') history.replaceState(history.state, '', '#/person/' + d.id);
  };

  const flush = () => {
    clearTimeout(timer.current);
    const d = latest.current;
    if (removing.current || !d) return Promise.resolve(false);
    if (!dirty.current) return pendingSave.current ?? Promise.resolve(saved.current);
    dirty.current = false;
    if (!saved.current && !d.name.trim()) return Promise.resolve(false); // a person needs a name before they're kept
    const request = ++saveRequest.current;
    const saving = savePerson({ ...d, name: d.name.trim() || d.name }).then(() => {
      saved.current = true;
      if (alive.current && !removing.current) {
        syncUrl();
        if (request === saveRequest.current && !dirty.current) setStatus(t('Saved'));
      }
      return true;
    }).catch(() => {
      if (!removing.current && request === saveRequest.current) {
        dirty.current = true;
        setStatus(t('Couldn’t save'));
        toast(t('Couldn’t save this person. Try again.'));
      }
      return false;
    }).finally(() => {
      if (pendingSave.current === saving) pendingSave.current = null;
    });
    pendingSave.current = saving;
    return saving;
  };

  const update = (patch: Partial<Person>) => {
    if (removing.current || !latest.current) return;
    latest.current = { ...latest.current, ...patch };
    setDraft(latest.current);
    dirty.current = true;
    setStatus('');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };

  // Renamed? Once you leave, the notes tagging them by their old name are updated to the new one.
  const peopleBefore = useRef(getPeople());
  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hide);
    addEventListener('popstate', syncUrl);
    if (id === 'new') nameRef.current?.focus();
    return () => {
      alive.current = false;
      document.removeEventListener('visibilitychange', hide);
      removeEventListener('popstate', syncUrl);
      flush().then((kept) => {
        const d = latest.current;
        const was = d && peopleBefore.current.find((p) => p.id === d.id);
        if (kept && !removing.current && d && was && d.name.trim() && was.name.trim() !== d.name.trim())
        {
          const renamed = { ...d, name: d.name.trim() };
          const before = peopleBefore.current;
          return Promise.all([
            ...renamePersonMentions(getEntries(), before, renamed).map((e) => saveEntry(e)),
            ...renamePersonMentions(getBooks(), before, renamed).map((b) => saveBook(b)),
            ...renamePersonMentions(getSongs(), before, renamed).map((x) => saveSong(x)),
            ...renamePersonMentions(getPeople().filter((p) => p.id !== d.id), before, renamed).map((p) => savePerson(p)),
          ]);
        }
      }).catch(() => toast(t('Couldn’t update the notes and pages mentioning this person.')));
    };
  }, []);

  // How thinking of them felt: the worlds of every feeling logged in notes and check-ins they're tagged in.
  const felt = useMemo(() => {
    const worlds = new Map<string, number>();
    const feelings = new Map<string, number>();
    for (const e of moments)
      for (const eid of e.emotions) {
        const c = coreOf(eid).id;
        worlds.set(c, (worlds.get(c) ?? 0) + 1);
        feelings.set(eid, (feelings.get(eid) ?? 0) + 1);
      }
    const total = [...worlds.values()].reduce((a, b) => a + b, 0);
    return {
      total,
      worlds: [...worlds].sort((a, b) => b[1] - a[1]),
      top: [...feelings].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [moments]);

  // How it's changing: the last twelve months of those feelings, and whether lately they lean warmer or heavier.
  const months = useMemo(() => monthsOf(moments), [moments]);
  const trend = trendOf(months);

  const groups = useMemo(() => {
    const out: [string, Entry[]][] = [];
    for (const e of moments) {
      const last = out[out.length - 1];
      if (last && last[0] === e.date) last[1].push(e);
      else out.push([e.date, [e]]);
    }
    return out;
  }, [moments]);

  if (!draft)
    return (
      <div class="page">
        <div class="empty">
          <h2 class="title-s">{t('This person isn’t here')}</h2>
          <p>{t('They may have been deleted.')}</p>
          <button class="btn btn-primary" onClick={() => goBack('people')}>{t('Back to people')}</button>
        </div>
      </div>
    );

  const remove = async () => {
    if (removing.current) return;
    if (saved.current && !confirm(t('Delete {name}? Notes they’re tagged in stay in your journal.', { name: draft.name.trim() || t('this person') }))) return;
    clearTimeout(timer.current);
    removing.current = true;
    dirty.current = false;
    await pendingSave.current;
    try {
      const removed = saved.current ? await deletePerson(draft.id) : null;
      if (alive.current) goBack('people');
      if (removed) toast(t('{name} deleted', { name: removed.name || t('Person') }), { label: t('Undo'), run: () => savePerson(removed) });
    } catch {
      removing.current = false;
      dirty.current = true;
      toast(t('Couldn’t delete this person. Try again.'));
    }
  };
  const done = async () => {
    if (leaving.current) return;
    leaving.current = true;
    await flush();
    if (!dirty.current && alive.current && !removing.current) goBack('people');
    else leaving.current = false;
  };

  const addEmotion = (eid: string) => {
    const list = draft.emotions.filter((x) => x !== eid && !eid.startsWith(x + '/') && !x.startsWith(eid + '/'));
    update({ emotions: [...list, eid].slice(-MAX_PERSON_EMOTIONS) });
    setOpen(null);
  };

  /** Starts a note (or check-in) already tagged with them. They're saved first so the tag has someone to point to. */
  const write = async (to: 'note' | 'tracker') => {
    if (leaving.current) return;
    const d = latest.current;
    if (!d?.name.trim()) return nameRef.current?.focus();
    leaving.current = true;
    if (!saved.current) dirty.current = true;
    if (!await flush() || dirty.current || !alive.current || removing.current) { leaving.current = false; return; }
    navigate(to === 'note' ? `note/new?person=${d.id}` : `tracker?person=${d.id}`);
  };

  const first = draft.name.trim().split(/\s+/)[0] || t('them');
  const main = draft.emotions[0] ? coreOf(draft.emotions[0]).id : null;

  return (
    <div class="page editor person">
      <div class="editor-bar">
        <button class="glass glass-btn round" onClick={done} aria-label={t('Back')}><Icon name="arrow-left" /></button>
        <span class="editor-status" aria-live="polite">{status && <span class="glass">{status}</span>}</span>
        <button class="glass glass-btn round" onClick={remove} aria-label={t('Delete person')}><Icon name="trash" /></button>
        <button class="glass glass-btn tinted" onClick={done}>{t('Done')}</button>
      </div>

      <div class="editor-top">
        <button
          class={`icon-pick avatar-pick${main ? ' tinted' : ''}`}
          style={{ '--c': main ? `var(--emo-${main})` : undefined }}
          onClick={() => setOpen('icon')}
          aria-label={draft.icon ? t('Change icon') : t('Add icon')}
        >
          {draft.icon ? <NoteIcon id={draft.icon} size={28} /> : draft.name.trim() ? <span class="avatar-initials">{initials(draft.name)}</span> : <Icon name="user" size={24} />}
        </button>
        <div class="grow">
          <textarea
            ref={nameRef}
            class="title-input"
            rows={1}
            placeholder={t('Name')}
            value={draft.name}
            maxLength={120}
            onInput={(e) => update({ name: e.currentTarget.value.replace(/\n/g, ' ') })}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), textRef.current?.focus())}
            aria-label={t('Name')}
          />
          <input
            class="relation-input"
            placeholder={t('Who are they to you? Friend, sister, coworker…')}
            value={draft.relation}
            maxLength={60}
            onInput={(e) => update({ relation: e.currentTarget.value })}
            aria-label={t('Relationship')}
          />
        </div>
      </div>

      <ThemeSong
        p={draft}
        onChange={(theme) => update({ theme })}
        onConnect={async () => {
          if (!latest.current?.name.trim()) return toast(t('Give them a name first'));
          if (!saved.current) dirty.current = true;
          if (await flush() && !dirty.current && alive.current && !removing.current) connectSpotify('#/person/' + latest.current.id);
        }}
      />

      <div class="eyebrow person-label">{t('How thinking of {name} makes you feel', { name: first })}</div>
      <div class="meta person-meta">
        {draft.emotions.map((eid) => (
          <EmotionChip id={eid} onRemove={() => update({ emotions: draft.emotions.filter((x) => x !== eid) })} />
        ))}
        {draft.emotions.length < MAX_PERSON_EMOTIONS && (
          <button class="chip" onClick={() => setOpen('emotion')}>
            <Icon name="mood-plus" size={16} /> {draft.emotions.length ? t('Add') : t('Add a feeling')}
          </button>
        )}
      </div>
      {draft.emotions.length === 1 && EMOTION[draft.emotions[0]]?.depth === 2 && (
        <p class="definition">{EMOTION[draft.emotions[0]].def}</p>
      )}

      <div class="eyebrow person-label">{t('Key dates')}</div>
      <KeyDates p={draft} onChange={(dates) => update({ dates })} />

      <MentionText
        inputRef={textRef}
        class="body-input person-text"
        placeholder={t('What’s on your mind about {name}? Memories, things they said, what they’re going through, what you want to remember…', { name: first })}
        value={draft.text}
        onChange={(text) => update({ text })}
        label={t('About {name}', { name: first })}
      />

      <section class="section">
        <div class="row between">
          <h2 class="section-title">{t('Thinking of {name}', { name: first })}</h2>
          {moments.length + pages.length > 0 && <span class="muted small">{moments.length + pages.length}{moments.length ? ' · ' + t('since {date}', { date: lastSeen(moments[moments.length - 1].date) }) : ''}</span>}
        </div>
        <div class="row gap-s person-actions">
          <button class="btn btn-quiet grow" onClick={() => write('note')} disabled={!draft.name.trim()}><Icon name="pencil" size={18} /> {t('Write about {title}', { title: first })}</button>
          <button class="btn btn-quiet" onClick={() => write('tracker')} disabled={!draft.name.trim()}><Icon name="mood-smile" size={18} /> {t('Check in')}</button>
        </div>

        {felt.total > 0 && (
          <div class="card person-felt">
            <div class="chart-title">{t('How thinking of {name} felt', { name: first })}</div>
            <div class="split-bar" role="img" aria-label={felt.worlds.map(([c, n]) => `${shortName(c)} ${Math.round((n / felt.total) * 100)}%`).join(', ')}>
              {felt.worlds.map(([c, n]) => <i style={{ flex: n, background: `var(--emo-${c})` }} title={`${shortName(c)} · ${n}`} />)}
            </div>
            {months.some((m, i) => m.total && i < months.length - 1) && (
              <div class="month-strip-wrap">
                <div class="month-strip" role="img" aria-label={t('Feelings month by month over the last year') + (trend ? ': ' + (trend === 'warmer' ? t('lately warmer') : trend === 'heavier' ? t('lately heavier') : t('lately about the same')) : '')}>
                  {months.map((m) => (
                    <span
                      class={`month-col${m.total ? '' : ' is-empty'}`}
                      {...(m.total ? tipProps(() => <><b>{monthLabel(m.y, m.m)}</b><br />{m.worlds.map(([c, n]) => `${shortName(c)} ${n}`).join(' · ')}</>, monthLabel(m.y, m.m)) : {})}
                    >
                      <span class="month-bar">{m.worlds.map(([c, n]) => <i style={{ flex: n, background: `var(--emo-${c})` }} />)}</span>
                      <span class="month-name">{monthShort(m.y, m.m).slice(0, 1)}</span>
                    </span>
                  ))}
                </div>
                {trend && (
                  <p class="muted small month-trend">
                    {trend === 'warmer' ? t('Lately, thinking of {name} has felt warmer than before.', { name: first }) : trend === 'heavier' ? t('Lately, thinking of {name} has felt heavier than before.', { name: first }) : t('Lately it feels much as it did before.')}
                  </p>
                )}
              </div>
            )}
            <div class="note-emos">
              {felt.top.map(([eid, n]) => (
                <span class="felt-item"><EmotionChip id={eid} size="sm" />{n > 1 && <span class="muted small">×{n}</span>}</span>
              ))}
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
          <p class="empty-note">{t('Add {name} under “Thinking of” in a note or check-in and it shows up here.', { name: first })}</p>
        )}
      </section>

      {pages.length > 0 && (
        <section class="section">
          <h2 class="section-title">{t('Mentioned on')}</h2>
          <div class="book-rows">
            {pages.map((pg) =>
              pg.kind === 'book' ? <BookRow b={pg.item} onClick={() => { flush(); navigate('book/' + pg.item.id); }} />
              : pg.kind === 'song' ? <SongRow s={pg.item} onClick={() => { flush(); navigate('song/' + pg.item.id); }} />
              : (
                <button class="person-card card" onClick={() => { flush(); navigate('person/' + pg.item.id); }}>
                  <Avatar p={pg.item} size={40} />
                  <div class="person-card-main">
                    <div class="person-card-name">{pg.item.name || t('Unnamed')}</div>
                    {pg.item.relation && <div class="person-card-sub">{pg.item.relation}</div>}
                  </div>
                  <Icon name="chevron-right" size={18} />
                </button>
              ),
            )}
          </div>
        </section>
      )}

      {books.length > 0 && (
        <section class="section">
          <h2 class="section-title">{t('Books · thinking of {name}', { name: first })}</h2>
          <div class="book-rows">{books.map((b) => <BookRow b={b} onClick={() => { flush(); navigate('book/' + b.id); }} />)}</div>
        </section>
      )}

      {songs.length > 0 && (
        <section class="section">
          <h2 class="section-title">{t('Music · thinking of {name}', { name: first })}</h2>
          <div class="book-rows">{songs.map((s) => <SongRow s={s} onClick={() => { flush(); navigate('song/' + s.id); }} />)}</div>
        </section>
      )}

      <IconSheet open={open === 'icon'} onClose={() => setOpen(null)} value={draft.icon} onChange={(icon) => update({ icon })} />
      <Sheet open={open === 'emotion'} onClose={() => setOpen(null)} title={t('How does thinking of {name} make you feel?', { name: first })}>
        <EmotionPicker onPick={addEmotion} selected={draft.emotions} />
      </Sheet>
    </div>
  );
}
