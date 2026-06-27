import { useState } from 'react'
import { KeyRound, LogIn, ShieldAlert, User } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { SectionTitle } from '../common/SectionTitle.jsx'
import { useAuth } from '../../auth/context.js'

export function LoginSection({ onAuthed, onRegister }) {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await signIn(username.trim(), password)
      setPassword('')
      onAuthed?.()
    } catch (signInError) {
      setError(signInError.message || 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section login" id="login">
      <SectionTitle>Login</SectionTitle>
      <p className="login-intro">
        <TerminalIcon icon={KeyRound} label="" />
        restricted area — authenticate to unlock the converters.
      </p>

      <form className="login-form" onSubmit={onSubmit}>
        <label className="login-row">
          <span className="login-prompt" aria-hidden="true">
            <TerminalIcon icon={User} label="" />
          </span>
          <input
            className="login-input"
            type="text"
            name="username"
            autoComplete="username"
            placeholder="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>

        <label className="login-row">
          <span className="login-prompt" aria-hidden="true">
            <TerminalIcon icon={KeyRound} label="" />
          </span>
          <input
            className="login-input"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error && (
          <p className="login-error" role="alert">
            <TerminalIcon icon={ShieldAlert} label="" />
            {error}
          </p>
        )}

        <button type="submit" className="login-submit" disabled={busy}>
          <span>
            <TerminalIcon icon={LogIn} label="" />
          </span>
          {busy ? 'authenticating…' : 'sign in'}
        </button>
      </form>

      <p className="auth-switch">
        no account yet?{' '}
        <button type="button" className="auth-switch-link" onClick={() => onRegister?.()}>
          register
        </button>
      </p>
    </section>
  )
}
