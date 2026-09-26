import { toast } from '../lib/store';
import { Icon } from './icons';
import { Sheet } from './Sheet';

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } catch {
    toast('Couldn’t copy — select it and copy by hand');
  }
};

/** Shown instead of a login when the server has no Spotify app key yet: how to get one, step by step. */
export function ConnectSetup({ redirect, open, onClose }: { redirect?: string; open: boolean; onClose: () => void }) {
  const uri = redirect || 'http://127.0.0.1:8085/api/spotify/callback';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<span class="row gap-s"><Icon name="brand-spotify" /> Set up Spotify login</span>}
      label="Set up Spotify login"
    >
      <p class="hint">
        Spotify only lets registered apps log people in, so My Mind needs its own app key. It’s free and takes a few minutes, once.
      </p>
      <ol class="steps">
        <li>
          Open the <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">Spotify developer dashboard</a>, log in and choose <b>Create app</b>. Give it any name and tick <b>Web API</b>.
        </li>
        <li>
          <div>Add this <b>redirect URI</b> to the app:</div>
          <div class="copy-row">
            <code>{uri}</code>
            <button class="btn btn-quiet btn-s" onClick={() => copy(uri)}>Copy</button>
          </div>
        </li>
        <li>Under <b>User Management</b>, add the email of your Spotify account. New apps only let listed accounts log in.</li>
        <li>
          In the My Mind folder, copy <code>.env.example</code> to <code>.env</code> and paste the app’s keys into <code>SPOTIFY_CLIENT_ID</code> and <code>SPOTIFY_CLIENT_SECRET</code>.
        </li>
        <li>Restart the server (<code>npm start</code>) and come back here — this button will log you in.</li>
      </ol>
    </Sheet>
  );
}
