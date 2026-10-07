// Signing in with GitHub, so the Projects page shows the account's private repositories too (server/github.js).
import { useState } from 'preact/hooks';
import { connectGithub, disconnectGithub, type Github } from '../lib/github';
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

/** What a page coming back from GitHub's sign-in says about it (?github=…). */
export const signInResult = (r: string) =>
  r === 'connected' ? t('Signed in with GitHub: private repos are shown')
  : r === 'cancelled' ? t('GitHub sign-in cancelled')
  : r === 'wrong-account' ? t('That isn’t the GitHub account these projects are from')
  : t('Couldn’t sign in with GitHub. Try again.');

export async function signOutGithub() {
  try {
    await disconnectGithub();
    toast(t('Signed out of GitHub'));
  } catch (e) {
    toast(t((e as Error).message));
  }
}

/** On the Projects page: a way to sign in for the private repositories, or, signed in, who you are and a way out. */
export function GithubAccount({ data }: { data: Pick<Github, 'viewer' | 'signIn'> }) {
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  if (data.viewer)
    return (
      <div class="pj-auth">
        <span class="pj-auth-who">
          <Icon name="lock-open" size={15} stroke={2} />
          {t('Private repos shown')}
        </span>
        <button class="btn btn-quiet btn-s" disabled={busy} onClick={async () => { setBusy(true); await signOutGithub(); setBusy(false); }}>
          <Icon name="logout" size={15} /> {t('Sign out')}
        </button>
      </div>
    );
  return (
    <>
      <button class="btn btn-quiet btn-s pj-auth-btn" onClick={data.signIn ? () => connectGithub('#/projects') : () => setSetup(true)}>
        <Icon name="lock" size={15} /> {t('Sign in to see private repos')}
      </button>
      <GithubSetup open={setup} onClose={() => setSetup(false)} />
    </>
  );
}

/** Shown instead of a sign-in when the server has no GitHub app yet: how to make one, step by step. */
export function GithubSetup({ open, onClose, redirect }: { open: boolean; onClose: () => void; redirect?: string | null }) {
  const uri = redirect || `${location.origin}/api/github/callback`;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<span class="row gap-s"><Icon name="brand-github" /> {t('Set up GitHub sign-in')}</span>}
      label={t('Set up GitHub sign-in')}
    >
      <p class="hint">
        {t('GitHub only lets registered apps sign people in, so My Mind needs its own. It’s free and takes a couple of minutes, once.')}
      </p>
      <ol class="steps">
        <li>
          {rich('Open {page} on GitHub. Give it any name, and use this site’s address as the {home}.', {
            page: <a href="https://github.com/settings/applications/new" target="_blank" rel="noopener noreferrer">{t('New OAuth App')}</a>,
            home: <b>Homepage URL</b>,
          })}
        </li>
        <li>
          <div>{rich('Set the {uri} to:', { uri: <b>Authorization callback URL</b> })}</div>
          <div class="copy-row">
            <code>{uri}</code>
            <button class="btn btn-quiet btn-s" onClick={() => copy(uri)}>{t('Copy')}</button>
          </div>
        </li>
        <li>{rich('Register it, then choose {secret}.', { secret: <b>Generate a new client secret</b> })}</li>
        <li>
          {rich('Put the app’s Client ID and the secret into the server’s {env} as {id} and {key}, then restart the server.', {
            env: <code>.env</code>, id: <code>GITHUB_CLIENT_ID</code>, key: <code>GITHUB_CLIENT_SECRET</code>,
          })}
        </li>
        <li>{t('Come back here and sign in. Only the account whose projects this page shows can sign in, and private repos are only shown in browsers signed in with it.')}</li>
      </ol>
    </Sheet>
  );
}
