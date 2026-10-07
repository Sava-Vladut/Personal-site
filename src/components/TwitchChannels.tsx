import { useEffect, useState } from 'preact/hooks';
import { Sheet } from './Sheet';
import { Icon } from './icons';
import { getChannels, loadPoints, saveChannels, signIn, signOut } from '../lib/twitch';
import { toast } from '../lib/store';
import { t } from '../lib/i18n';

/** The channels the miner watches, in order (the first ones get its attention first). Changing them needs the admin password. */
export function ChannelsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [saved, setSaved] = useState<string[] | null>(null);
  const [list, setList] = useState<string[]>([]);
  const [admin, setAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setName('');
    setPassword('');
    getChannels()
      .then((c) => (setSaved(c.channels), setList(c.channels), setAdmin(c.admin)))
      .catch((e: Error) => setError(t(e.message)));
  }, [open]);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(t((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const login = (e?: Event) => {
    e?.preventDefault();
    if (password) run(async () => (await signIn(password), setAdmin(true), setPassword('')));
  };

  const add = (e?: Event) => {
    e?.preventDefault();
    const n = name.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/\/.*$/, '');
    if (!n) return;
    if (!/^[A-Za-z0-9_]{2,25}$/.test(n)) return setError(t('“{name}” isn’t a Twitch channel name.', { name: n }));
    setError('');
    setName('');
    if (!list.some((c) => c.toLowerCase() === n.toLowerCase())) setList([...list, n]);
  };

  const move = (i: number, by: number) => {
    const next = [...list];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setList(next);
  };

  const changed = !!saved && list.join('\n') !== saved.join('\n');
  const save = () =>
    run(async () => {
      const c = await saveChannels(list);
      setSaved(c.channels);
      setList(c.channels);
      toast(t('Saved · the miner restarts with {n} channels', { n: c.channels.length }));
      loadPoints(true);
      onClose();
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<span class="row gap-s"><Icon name="brand-twitch" /> {t('Mined channels')}</span>}
      label={t('Mined channels')}
      footer={admin ? (
        <button class="btn btn-primary" onClick={save} disabled={busy || !changed || !list.length}>{busy ? t('Saving…') : t('Save')}</button>
      ) : (
        <button class="btn btn-primary" onClick={() => login()} disabled={busy || !password}>{busy ? t('Signing in…') : t('Sign in')}</button>
      )}
    >
      {admin ? (
        <>
          <p class="hint">{t('The miner watches these in order: the first ones come first when several are live. Saving restarts it, so it stops for a few seconds.')}</p>
          <ol class="tw-edit">
            {list.map((c, i) => (
              <li key={c}>
                <span class="tw-edit-n">{i + 1}</span>
                <b>{c}</b>
                <button class="icon-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('Move {name} up', { name: c })}><Icon name="arrow-up" size={17} /></button>
                <button class="icon-btn small" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={t('Move {name} down', { name: c })}><Icon name="arrow-down" size={17} /></button>
                <button class="icon-btn small" onClick={() => setList(list.filter((x) => x !== c))} disabled={list.length === 1} aria-label={t('Stop mining {name}', { name: c })}><Icon name="trash" size={17} /></button>
              </li>
            ))}
          </ol>
          <form class="tw-edit-add" onSubmit={add}>
            <input
              class="input"
              value={name}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder={t('Channel name or link')}
              aria-label={t('Channel to add')}
              autocomplete="off"
              autocapitalize="none"
              spellcheck={false}
              enterkeyhint="done"
            />
            <button class="btn btn-quiet" type="submit" disabled={!name.trim()}><Icon name="plus" size={18} /> {t('Add')}</button>
          </form>
          {error && <p class="hint danger" role="alert">{error}</p>}
          <button class="link small muted tw-signout" onClick={() => run(async () => (await signOut(), setAdmin(false)))}>{t('Sign out on this device')}</button>
        </>
      ) : (
        <>
          {saved && <p class="hint">{t('Mining {names}.', { names: saved.join(', ') })}</p>}
          <p class="hint">{t('Enter the admin password to change them. This device stays signed in.')}</p>
          <form onSubmit={login}>
            <input
              class="input"
              type="password"
              value={password}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder={t('Admin password')}
              aria-label={t('Admin password')}
              autocomplete="current-password"
              enterkeyhint="go"
            />
          </form>
          {error && <p class="hint danger" role="alert">{error}</p>}
        </>
      )}
    </Sheet>
  );
}
