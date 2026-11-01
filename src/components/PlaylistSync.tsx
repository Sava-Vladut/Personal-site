// Which Spotify playlists your records keep in step with, and the line under the list that says when they last did.
import { useEffect, useState } from 'preact/hooks';
import { connectSpotify, listPlaylists, type Playlist } from '../lib/spotify';
import { linkPlaylist, syncedPlaylists, syncPlaylists, unlinkPlaylist, useSyncedMeta, type SyncStatus } from '../lib/playlistSync';
import { toast, useSongs } from '../lib/store';
import { addedLabel } from './periods';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { count, t } from '../lib/i18n';

/** Synced with …, checked when; a refresh, and the sheet to pick playlists. Not connected: a way to connect. */
export function SyncLine({ status, onOpen }: { status: SyncStatus; onOpen: () => void }) {
  const songs = useSongs();
  const lists = syncedPlaylists(songs, useSyncedMeta());
  if (!lists.length)
    return (
      <button class="mx-sync is-off" onClick={onOpen}>
        <Icon name="brand-spotify" size={16} /> {t('Sync a Spotify playlist')}
      </button>
    );
  const names = lists.map((l) => l.name || t('a playlist')).join(', ');
  return (
    <div class="mx-sync">
      <Icon name="brand-spotify" size={16} />
      <button class="mx-sync-name" onClick={onOpen} title={t('Synced playlists')}>{t('Synced with {name}', { name: names })}</button>
      <span class="mx-sync-when">
        {status.busy ? t('Syncing…') : status.error ? status.error : status.at ? t('checked {when}', { when: addedLabel(status.at) }) : ''}
      </span>
      {status.code === 401 ? (
        <button class="btn btn-quiet btn-s" onClick={() => connectSpotify('#/media?tab=music')}>{t('Connect')}</button>
      ) : (
        <button class={`icon-btn mx-sync-now${status.busy ? ' is-busy' : ''}`} onClick={() => syncPlaylists(true)} disabled={status.busy} aria-label={t('Sync now')} title={t('Sync now')}>
          <Icon name="refresh" size={16} />
        </button>
      )}
    </div>
  );
}

/** Your playlists, each synced or not with a tap. */
export function SyncSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const songs = useSongs();
  const synced = new Set(syncedPlaylists(songs, useSyncedMeta()).map((l) => l.id));
  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    (async () => {
      const out: Playlist[] = [];
      for (let offset: number | undefined = 0; offset !== undefined && out.length < 500; ) {
        const page = await listPlaylists(offset || undefined);
        out.push(...page.items);
        offset = page.items.length ? page.next : undefined;
      }
      setLists(out);
    })().catch((e) => setError(e));
  }, [open]);

  const toggle = async (p: Playlist) => {
    if (busy) return;
    setBusy(p.id);
    try {
      if (synced.has(p.id)) {
        await unlinkPlaylist(p.id);
        toast(t('Stopped syncing {name}. Its songs stay in your records.', { name: p.name }));
      } else {
        await linkPlaylist(p);
        toast(t('{name} is synced', { name: p.name }));
      }
    } catch {
      toast(t('Couldn’t change that. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} tall label={t('Synced playlists')} title={<span class="row gap-s"><Icon name="brand-spotify" /> {t('Synced playlists')}</span>}>
      <p class="hint">{t('Songs you add to a synced playlist in Spotify come into your records with the date you added them, and songs you take off leave (unless you rated, wrote about or put them in a period).')}</p>
      {error ? (
        error.status === 401 ? (
          <div class="stack center">
            <p>{t('Log in with Spotify to sync your playlists.')}</p>
            <button class="btn btn-primary" onClick={() => connectSpotify('#/media?tab=music')}><Icon name="brand-spotify" size={18} /> {t('Connect Spotify')}</button>
          </div>
        ) : <p class="error">{error.message}</p>
      ) : !lists ? (
        <p class="hint center">{t('Loading…')}</p>
      ) : !lists.length ? (
        <p class="hint center">{t('No playlists of your own yet. Spotify only lets apps open playlists you made or collaborate on.')}</p>
      ) : (
        <div class="tracks fade-rows">
          {lists.map((p) => {
            const on = synced.has(p.id);
            return (
              <button key={p.id} class="track sync-row" aria-pressed={on} onClick={() => toggle(p)} disabled={!!busy}>
                <span class="sync-cover">{p.cover ? <img src={p.cover} alt="" loading="lazy" referrerpolicy="no-referrer" /> : <Icon name="playlist" size={20} />}</span>
                <span class="track-main">
                  <span class="track-title">{p.name}</span>
                  <span class="track-sub">{count(p.count, 'song', 'songs')}</span>
                </span>
                <span class={`sync-state${on ? ' is-on' : ''}`}>
                  {busy === p.id ? <Icon name="loader-2" size={16} class="spin" /> : on ? <><Icon name="check" size={16} stroke={2.25} /> {t('Synced')}</> : t('Sync')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
