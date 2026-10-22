import { useEffect, useMemo, useState } from 'preact/hooks';
import { EXPORT_DEFAULT, EXPORT_DETAILS, EXPORT_PARTS, exportScope, exportText, type ExportDetail, type ExportOptions, type ExportPart } from '../lib/exportText';
import { addDays, isDateKey, shortDate, todayKey } from '../lib/dates';
import { toast, useBooks, useEntries, usePeople, useRepos, useSongs } from '../lib/store';
import { count, t } from '../lib/i18n';
import { Sheet } from './Sheet';
import { Icon, type UiName } from './icons';
import '../styles/shared.css';
import '../styles/export.css';

type Range = 'all' | '7' | '30' | '90' | '365' | 'custom';
const RANGES: Range[] = ['all', '7', '30', '90', '365', 'custom'];
const rangeName = (r: Range) => (r === 'all' ? t('All time') : r === 'custom' ? t('Pick days') : r === '365' ? t('A year') : count(Number(r), 'day', 'days'));

const PART: Record<ExportPart, [UiName, string]> = {
  overview: ['chart-pie', t('Overview')],
  notes: ['notebook', t('Notes')],
  checkins: ['mood-smile', t('Check-ins')],
  people: ['users', t('People')],
  books: ['books', t('Books')],
  music: ['music', t('Music')],
  repos: ['brand-github', t('Repos')],
};
const DETAIL: Record<ExportDetail, string> = {
  feelings: t('Feelings'), people: t('People'), place: t('Place'), weather: t('Weather'), music: t('Music'), pictures: t('Picture captions'),
};

interface Saved { range: Range; from: string; to: string; parts: ExportPart[]; details: ExportDetail[]; linked: boolean; ask: boolean; newest: boolean }
const KEY = 'mm-export';

/** The last choices, so the next export starts from them; anything unknown or damaged falls back to everything. */
function load(): Saved {
  const today = todayKey();
  const base: Saved = { range: 'all', from: addDays(today, -29), to: today, parts: EXPORT_PARTS, details: EXPORT_DETAILS, linked: true, ask: true, newest: false };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!s || typeof s !== 'object') return base;
    return {
      range: RANGES.includes(s.range) ? s.range : base.range,
      from: isDateKey(s.from) ? s.from : base.from,
      to: isDateKey(s.to) ? s.to : base.to,
      parts: Array.isArray(s.parts) ? EXPORT_PARTS.filter((p) => s.parts.includes(p)) : base.parts,
      details: Array.isArray(s.details) ? EXPORT_DETAILS.filter((d) => s.details.includes(d)) : base.details,
      linked: typeof s.linked === 'boolean' ? s.linked : base.linked,
      ask: typeof s.ask === 'boolean' ? s.ask : base.ask,
      newest: typeof s.newest === 'boolean' ? s.newest : base.newest,
    };
  } catch {
    return base;
  }
}

function optionsOf(s: Saved): ExportOptions {
  const today = todayKey();
  const [from, to] = s.range === 'all' ? [null, null]
    : s.range === 'custom' ? (s.from <= s.to ? [s.from, s.to] : [s.to, s.from])
      : [addDays(today, -(Number(s.range) - 1)), today];
  return { ...EXPORT_DEFAULT, from, to, parts: s.parts, details: s.details, linked: s.linked, ask: s.ask, newest: s.newest };
}

const short = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

/** Pick the days and what goes in, then download the text or copy it straight into an AI chat. */
export function ExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const entries = useEntries();
  const people = usePeople();
  const books = useBooks();
  const songs = useSongs();
  const repos = useRepos();
  const [s, setS] = useState(load);
  const set = (patch: Partial<Saved>) => setS((prev) => {
    const next = { ...prev, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    return next;
  });
  useEffect(() => { if (open) setS(load()); }, [open]);

  const options = optionsOf(s);
  const key = JSON.stringify(options);
  const scope = useMemo(() => (open ? exportScope(options) : null), [open, key, entries, people, books, songs, repos]);
  const text = useMemo(() => (open && s.parts.length ? exportText(options) : ''), [open, key, entries, people, books, songs, repos]);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tokens = Math.round(text.length / 4);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const notes = scope?.entries.filter((e) => e.kind === 'note').length ?? 0;
  const value: Record<ExportPart, string> = {
    overview: t('Feelings added up, then a line per day, week or month'),
    notes: count(notes, 'note', 'notes'),
    checkins: count((scope?.entries.length ?? 0) - notes, 'check-in', 'check-ins'),
    people: count(scope?.people.length ?? 0, 'person', 'people'),
    books: count(scope?.books.length ?? 0, 'book', 'books'),
    music: count(scope?.songs.length ?? 0, 'record', 'records'),
    repos: count(scope?.repos.length ?? 0, 'repo', 'repos'),
  };
  const journal = s.parts.includes('notes') || s.parts.includes('checkins');
  const others = s.parts.some((p) => p === 'people' || p === 'books' || p === 'music' || p === 'repos');

  const name = options.from ? `my-mind-${options.from}-to-${options.to}.md` : `my-mind-${todayKey()}.md`;
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('Copied — paste it into an AI chat'));
    } catch {
      toast(t('Couldn’t copy — download it instead'));
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<span class="row gap-s"><Icon name="file-text" /> {t('Export as text')}</span>}
      label={t('Export as text')}
      tall
      footer={
        <>
          <span class="foot-note">{text ? `${count(words, 'word', 'words')} · ${t('about {n} tokens', { n: short(tokens) })}` : t('Nothing chosen')}</span>
          <span class="row gap-s">
            <button class="btn btn-quiet" onClick={copy} disabled={!text}><Icon name="copy" size={16} /> {t('Copy')}</button>
            <button class="btn btn-primary" onClick={download} disabled={!text}><Icon name="download" size={16} /> {t('Download')}</button>
          </span>
        </>
      }
    >
      <div class="export-sheet">
        <div class="share-parts-head">{t('Which days')}</div>
        <div class="chips export-ranges" role="radiogroup" aria-label={t('Which days')}>
          {RANGES.map((r) => (
            <button class="chip" role="radio" aria-checked={s.range === r} aria-pressed={s.range === r} onClick={() => set({ range: r })}>{rangeName(r)}</button>
          ))}
        </div>
        {s.range === 'custom' && (
          <div class="export-dates">
            <label>
              <span class="muted small">{t('From')}</span>
              <input class="input input-s" type="date" value={s.from} max={todayKey()} onInput={(e) => isDateKey(e.currentTarget.value) && set({ from: e.currentTarget.value })} />
            </label>
            <label>
              <span class="muted small">{t('To')}</span>
              <input class="input input-s" type="date" value={s.to} max={todayKey()} onInput={(e) => isDateKey(e.currentTarget.value) && set({ to: e.currentTarget.value })} />
            </label>
          </div>
        )}
        {scope && (
          <p class="hint export-span">
            {shortDate(scope.from)} – {shortDate(scope.to)} · {count(scope.entries.length, 'entry', 'entries')}
          </p>
        )}

        <div class="share-parts">
          <div class="share-parts-head">{t('What goes in')}</div>
          {EXPORT_PARTS.map((p) => (
            <label class="share-part" key={p}>
              <Icon name={PART[p][0]} size={18} />
              <span class="share-part-main">
                <span class="share-part-name">{PART[p][1]}</span>
                <span class="share-part-value">{value[p]}</span>
              </span>
              <button class="switch" role="switch" aria-checked={s.parts.includes(p)} aria-label={PART[p][1]} onClick={() => set({ parts: EXPORT_PARTS.filter((x) => toggle(s.parts, p).includes(x)) })} />
            </label>
          ))}
          {s.range !== 'all' && others && (
            <label class="share-part">
              <Icon name="link" size={18} />
              <span class="share-part-main">
                <span class="share-part-name">{t('Only what’s tied to these days')}</span>
                <span class="share-part-value">{t('People tagged, books being read, music played then')}</span>
              </span>
              <button class="switch" role="switch" aria-checked={s.linked} aria-label={t('Only what’s tied to these days')} onClick={() => set({ linked: !s.linked })} />
            </label>
          )}
        </div>

        {journal && (
          <div class="share-parts">
            <div class="share-parts-head">{t('In each note and check-in')}</div>
            <div class="chips export-details" role="group" aria-label={t('In each note and check-in')}>
              {EXPORT_DETAILS.map((d) => (
                <button class="chip" aria-pressed={s.details.includes(d)} onClick={() => set({ details: EXPORT_DETAILS.filter((x) => toggle(s.details, d).includes(x)) })}>
                  {s.details.includes(d) && <Icon name="check" size={14} />} {DETAIL[d]}
                </button>
              ))}
            </div>
            <label class="share-part">
              <Icon name="arrow-down" size={18} />
              <span class="share-part-main">
                <span class="share-part-name">{t('Newest first')}</span>
                <span class="share-part-value">{s.newest ? t('The latest entries come first') : t('From the oldest entry to the latest')}</span>
              </span>
              <button class="switch" role="switch" aria-checked={s.newest} aria-label={t('Newest first')} onClick={() => set({ newest: !s.newest })} />
            </label>
          </div>
        )}

        <div class="share-parts">
          <label class="share-part">
            <Icon name="sparkles" size={18} />
            <span class="share-part-main">
              <span class="share-part-name">{t('Ask for an analysis')}</span>
              <span class="share-part-value">{t('Opens with what to look for: patterns, changes, what lifts you')}</span>
            </span>
            <button class="switch" role="switch" aria-checked={s.ask} aria-label={t('Ask for an analysis')} onClick={() => set({ ask: !s.ask })} />
          </label>
          <p class="share-parts-note">
            <Icon name="lock" size={14} />
            {tokens > 150_000
              ? t('This is long: some AI chats can’t read it all at once. Pick fewer days or fewer parts.')
              : t('Pictures aren’t included, only their captions. It can’t be imported back.')}
          </p>
        </div>
      </div>
    </Sheet>
  );
}
