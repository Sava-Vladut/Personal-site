import { useState } from 'react'
import { KeyRound, ShieldAlert, UserPlus } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { SectionTitle } from '../common/SectionTitle.jsx'
import { useAuth } from '../../auth/context.js'

export function RegisterSection({ onAuthed, onLogin }) {
  const { signUp } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setError('')

    const name = username.trim()
    if (name.length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await signUp(name, password)
      setPassword('')
      setConfirm('')
      onAuthed?.()
    } catch (signUpError) {
      setError(signUpError.message || 'Registration failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section login" id="register">
      <SectionTitle>Register</SectionTitle>
      <p className="login-intro">
        <TerminalIcon icon={UserPlus} label="" />
        provision a new operator account.
      </p>

      <form className="login-form" onSubmit={onSubmit}>
        <label className="login-row">
          <span className="login-prompt" aria-hidden="true">
            <TerminalIcon icon={UserPlus} label="" />
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
            name="new-password"
            autoComplete="new-password"
            placeholder="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
            name="confirm-password"
            autoComplete="new-password"
            placeholder="confirm password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
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
            <TerminalIcon icon={UserPlus} label="" />
          </span>
          {busy ? 'provisioning…' : 'create account'}
        </button>
      </form>

      <p className="auth-switch">
        already registered?{' '}
        <button type="button" className="auth-switch-link" onClick={() => onLogin?.()}>
          sign in
        </button>
      </p>
    </section>
  )
}
