import { toast } from '../lib/store';
import { Icon } from './icons';
import { Sheet } from './Sheet';

export type Service = 'spotify' | 'pinterest';

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } catch {
    toast('Couldn’t copy — select it and copy by hand');
  }
};

/** Shown instead of a login when the server has no app key yet: how to get one, step by step. */
export function ConnectSetup({ service, redirect, open, onClose }: { service: Service; redirect?: string; open: boolean; onClose: () => void }) {
  const spotify = service === 'spotify';
  const uri = redirect || (spotify ? 'http://127.0.0.1:8085/api/spotify/callback' : 'http://localhost:8085/api/pinterest/callback');
  const [id, secret] = spotify ? ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'] : ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET'];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<span class="row gap-s"><Icon name={spotify ? 'brand-spotify' : 'brand-pinterest'} /> Set up {spotify ? 'Spotify' : 'Pinterest'} login</span>}
      label={`Set up ${spotify ? 'Spotify' : 'Pinterest'} login`}
    >
      <p class="hint">
        {spotify ? 'Spotify' : 'Pinterest'} only lets registered apps log people in, so My Mind needs its own app key. It’s free and takes a few minutes, once.
      </p>
      <ol class="steps">
        {spotify ? (
          <li>
            Open the <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">Spotify developer dashboard</a>, log in and choose <b>Create app</b>. Give it any name and tick <b>Web API</b>.
          </li>
        ) : (
          <li>
            Open <a href="https://developers.pinterest.com/apps/" target="_blank" rel="noopener noreferrer">Pinterest developer apps</a> and create an app. Pinterest asks for a free business account and reviews new apps before they get full access.
          </li>
        )}
        <li>
          <div>Add this <b>redirect URI</b> to the app:</div>
          <div class="copy-row">
            <code>{uri}</code>
            <button class="btn btn-quiet btn-s" onClick={() => copy(uri)}>Copy</button>
          </div>
        </li>
        {spotify && (
          <li>Under <b>User Management</b>, add the email of your Spotify account. New apps only let listed accounts log in.</li>
        )}
        <li>
          In the My Mind folder, copy <code>.env.example</code> to <code>.env</code> and paste the app’s keys into <code>{id}</code> and <code>{secret}</code>.
        </li>
        <li>Restart the server (<code>npm start</code>) and come back here — this button will log you in.</li>
      </ol>
    </Sheet>
  );
}
