import { useEffect, useState } from 'react'
import { Check, CircleAlert, KeyRound, Tv } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { getTwitchSettings, saveTwitchSettings } from '../../lib/authApi.js'

// Admin panel for the Twitch app credentials that power channel-specific sub +
// bit badges in the Twitch Logs viewer. Creds are stored server-side (DB) and
// never sent back to the browser — the form only ever knows whether a secret is
// set, not its value.
export function TwitchSettings() {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [hasSecret, setHasSecret] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const apply = (s) => {
    setClientId(s.clientId || '')
    setHasSecret(Boolean(s.hasSecret))
    setConfigured(Boolean(s.configured))
  }

  useEffect(() => {
    getTwitchSettings()
      .then(apply)
      .catch(() => setError('Could not load Twitch settings.'))
      .finally(() => setLoaded(true))
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMsg('')
    setError('')
    try {
      // Blank secret leaves the stored one untouched (the server handles that).
      const s = await saveTwitchSettings({ clientId: clientId.trim(), clientSecret })
      apply(s)
      setClientSecret('')
      setMsg(s.configured ? 'Saved — channel badges enabled.' : 'Saved.')
    } catch (err) {
      setError(err.message || 'Could not save settings.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-modules twitch-settings">
      <header className="admin-panel-head">
        <span>
          <TerminalIcon icon={Tv} label="" />
          twitch integration
        </span>
        <em className={`twitch-state twitch-state--${configured ? 'on' : 'off'}`}>
          {configured ? '● connected' : '○ not configured'}
        </em>
      </header>

      <p className="twitch-hint">
        // powers channel-specific sub &amp; bit badges in the logs. create an app at{' '}
        <span className="twitch-hint-url">dev.twitch.tv/console/apps</span> and paste its
        credentials.
      </p>

      <form className="user-add" onSubmit={onSubmit}>
        <div className="user-add-fields">
          <label className="login-row user-add-input">
            <span className="login-prompt" aria-hidden="true">
              <TerminalIcon icon={Tv} label="" />
            </span>
            <input
              className="login-input"
              type="text"
              autoComplete="off"
              spellCheck="false"
              placeholder="client id"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            />
          </label>
          <label className="login-row user-add-input">
            <span className="login-prompt" aria-hidden="true">
              <TerminalIcon icon={KeyRound} label="" />
            </span>
            <input
              className="login-input"
              type="password"
              autoComplete="off"
              placeholder={hasSecret ? '•••••• stored — blank keeps it' : 'client secret'}
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
            />
          </label>
          <button type="submit" className="user-add-submit" disabled={busy || !loaded}>
            <span>
              <TerminalIcon icon={Check} label="" />
            </span>
            {busy ? 'saving…' : 'save'}
          </button>
        </div>
        {(error || msg) && (
          <p className="user-msg" role="status">
            <TerminalIcon icon={CircleAlert} label="" />
            {error || msg}
          </p>
        )}
      </form>
    </div>
  )
}
