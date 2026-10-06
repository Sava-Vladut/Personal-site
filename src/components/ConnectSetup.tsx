import { toast } from '../lib/store';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { rich, t } from '../lib/i18n';

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('Copied'));
  } catch {
    toast(t('Couldn’t copy — select it and copy by hand'));
  }
};

/** Shown instead of a login when the server has no Spotify app key yet: how to get one, step by step. */
export function ConnectSetup({ redirect, open, onClose }: { redirect?: string; open: boolean; onClose: () => void }) {
  const uri = redirect || 'http://127.0.0.1:8085/api/spotify/callback';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<span class="row gap-s"><Icon name="brand-spotify" /> {t('Set up Spotify login')}</span>}
      label={t('Set up Spotify login')}
    >
      <p class="hint">
        {t('Spotify only lets registered apps log people in, so My Mind needs its own app key. It’s free and takes a few minutes, once.')}
      </p>
      <ol class="steps">
        <li>
          {rich('Open the {dashboard}, log in and choose {create}. Give it any name and tick {api}.', {
            dashboard: <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">{t('Spotify developer dashboard')}</a>,
            create: <b>Create app</b>,
            api: <b>Web API</b>,
          })}
        </li>
        <li>
          <div>{rich('Add this {uri} to the app:', { uri: <b>redirect URI</b> })}</div>
          <div class="copy-row">
            <code>{uri}</code>
            <button class="btn btn-quiet btn-s" onClick={() => copy(uri)}>{t('Copy')}</button>
          </div>
        </li>
        <li>{rich('Under {users}, add the email of your Spotify account. New apps only let listed accounts log in.', { users: <b>User Management</b> })}</li>
        <li>
          {rich('In the My Mind folder, copy {example} to {env} and paste the app’s keys into {id} and {secret}.', {
            example: <code>.env.example</code>, env: <code>.env</code>, id: <code>SPOTIFY_CLIENT_ID</code>, secret: <code>SPOTIFY_CLIENT_SECRET</code>,
          })}
        </li>
        <li>{rich('Restart the server ({start}) and come back here — this button will log you in.', { start: <code>npm start</code> })}</li>
      </ol>
    </Sheet>
  );
}
