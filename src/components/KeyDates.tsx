// The days in someone's year, on their page: a chip for each, and the sheet that adds or changes one.
import { useEffect, useState } from 'preact/hooks';
import { MAX_KEY_DATES, uid, type KeyDate, type KeyDateKind, type Person } from '../lib/store';
import { dateName, KEY_DATE_LABEL, nextOf, whatsComing, whenLabel } from '../lib/people';
import { Icon, type UiName } from './icons';
import { Sheet } from './Sheet';
import { LOCALE, t } from '../lib/i18n';

const ICON: Record<KeyDateKind, UiName> = { birthday: 'cake', anniversary: 'heart', other: 'calendar-event' };
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(LOCALE, { month: 'long' }));
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const pad = (n: number) => String(n).padStart(2, '0');

export const dayOf = (d: KeyDate) => {
  const [m, day] = d.md.split('-').map(Number);
  return `${day} ${MONTHS[m - 1]}${d.year ? ' ' + d.year : ''}`;
};

export function KeyDates({ p, onChange }: { p: Person; onChange: (dates: KeyDate[]) => void }) {
  const [editing, setEditing] = useState<KeyDate | 'new' | null>(null);
  const save = (d: KeyDate) => {
    const has = p.dates.some((x) => x.id === d.id);
    onChange(has ? p.dates.map((x) => (x.id === d.id ? d : x)) : [...p.dates, d].slice(0, MAX_KEY_DATES));
    setEditing(null);
  };
  const remove = (id: string) => {
    onChange(p.dates.filter((x) => x.id !== id));
    setEditing(null);
  };
  const sorted = [...p.dates].sort((a, b) => nextOf(p, a).days - nextOf(p, b).days);
  return (
    <>
      <div class="meta person-meta">
        {sorted.map((d) => {
          const u = nextOf(p, d);
          const soon = u.days <= 14;
          return (
            <button class={`chip key-date${soon ? ' is-soon' : ''}`} onClick={() => setEditing(d)} aria-label={t('{name}, {day}. Change', { name: dateName(d), day: dayOf(d) })}>
              <Icon name={ICON[d.kind]} size={16} />
              <span>{dateName(d)} · {dayOf(d).replace(/ \d{4}$/, '')}</span>
              {soon ? <span class="key-date-when">{whenLabel(u.days).toLowerCase()}{whatsComing(u).years ? ` · ${whatsComing(u).years}` : ''}</span> : null}
            </button>
          );
        })}
        {p.dates.length < MAX_KEY_DATES && (
          <button class="chip" onClick={() => setEditing('new')}>
            <Icon name="calendar-event" size={16} /> {p.dates.length ? t('Add') : t('Add a birthday or anniversary')}
          </button>
        )}
      </div>
      <KeyDateSheet
        open={editing !== null}
        value={editing === 'new' ? null : editing}
        first={p.name.trim().split(/\s+/)[0] || t('them')}
        hasBirthday={p.dates.some((d) => d.kind === 'birthday' && (editing === 'new' || d.id !== (editing as KeyDate | null)?.id))}
        onClose={() => setEditing(null)}
        onSave={save}
        onRemove={remove}
      />
    </>
  );
}

function KeyDateSheet({ open, value, first, hasBirthday, onClose, onSave, onRemove }: {
  open: boolean;
  value: KeyDate | null;
  first: string;
  hasBirthday: boolean;
  onClose: () => void;
  onSave: (d: KeyDate) => void;
  onRemove: (id: string) => void;
}) {
  const [kind, setKind] = useState<KeyDateKind>('birthday');
  const [label, setLabel] = useState('');
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [year, setYear] = useState('');

  useEffect(() => {
    if (!open) return;
    const [m, d] = value ? value.md.split('-').map(Number) : [new Date().getMonth() + 1, new Date().getDate()];
    setKind(value?.kind ?? (hasBirthday ? 'anniversary' : 'birthday'));
    setLabel(value?.label ?? '');
    setMonth(m);
    setDay(d);
    setYear(value?.year ? String(value.year) : '');
  }, [open, value?.id]);

  const y = year.trim() ? Number(year) : null;
  const yearOk = y === null || (Number.isInteger(y) && y >= 1800 && y <= new Date().getFullYear());
  const days = DAYS_IN[month - 1];
  const save = () => {
    if (!yearOk) return;
    onSave({ id: value?.id ?? uid(), kind, label: kind === 'other' ? label.trim().slice(0, 60) : '', md: `${pad(month)}-${pad(Math.min(day, days))}`, year: y });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={value ? dateName(value) : t('A date in {name}’s year', { name: first })}
      footer={
        <div class="row gap-s">
          {value && <button class="btn btn-quiet" onClick={() => onRemove(value.id)}><Icon name="trash" size={17} /> {t('Remove')}</button>}
          <button class="btn btn-primary grow" onClick={save} disabled={!yearOk}>{value ? t('Save') : t('Add')}</button>
        </div>
      }
    >
      <div class="key-date-form">
        <div class="chips" role="radiogroup" aria-label={t('What it is')}>
          {(['birthday', 'anniversary', 'other'] as KeyDateKind[]).map((k) => (
            <button class="chip" role="radio" aria-checked={kind === k} aria-pressed={kind === k} onClick={() => setKind(k)}>
              <Icon name={ICON[k]} size={16} /> {k === 'other' ? t('Something else') : KEY_DATE_LABEL[k]}
            </button>
          ))}
        </div>
        {kind === 'other' && (
          <input class="input" placeholder={t('What is it? First met, name day…')} value={label} maxLength={60} onInput={(e) => setLabel(e.currentTarget.value)} aria-label={t('What it is')} />
        )}
        <div class="key-date-day">
          <select class="input" value={Math.min(day, days)} onChange={(e) => setDay(Number(e.currentTarget.value))} aria-label={t('Day')}>
            {Array.from({ length: days }, (_, i) => <option value={i + 1}>{i + 1}</option>)}
          </select>
          <select class="input" value={month} onChange={(e) => setMonth(Number(e.currentTarget.value))} aria-label={t('Month')}>
            {MONTHS.map((name, i) => <option value={i + 1}>{name}</option>)}
          </select>
          <input
            class="input"
            type="number"
            inputMode="numeric"
            placeholder={t('Year')}
            min={1800}
            max={new Date().getFullYear()}
            value={year}
            onInput={(e) => setYear(e.currentTarget.value)}
            aria-label={t('Year, optional')}
            aria-invalid={!yearOk}
          />
        </div>
        <p class="muted small">
          {kind === 'birthday' ? t('Add the year they were born to see how old they’re turning.') : kind === 'anniversary' ? t('Add the year to count the years.') : t('The year is optional.')}
          {' '}{t('It shows on your journal in the two weeks before.')}
        </p>
      </div>
    </Sheet>
  );
}
