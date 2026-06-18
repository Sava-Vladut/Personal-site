import { useState } from 'react'
import { KeyRound, LogIn, Mail, ShieldAlert } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { SectionTitle } from '../common/SectionTitle.jsx'
import { useAuth } from '../../auth/context.js'

export function LoginSection({ onAuthed }) {
  const { signIn, configured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    const { error: signInError } = await signIn(email.trim(), password)
    setBusy(false)
    if (signInError) {
      setError(signInError.message || 'Login failed.')
      return
    }
    setPassword('')
    onAuthed?.()
  }

  if (!configured) {
    return (
      <section className="section login" id="login">
        <SectionTitle>Login</SectionTitle>
        <p className="login-error" role="alert">
          <TerminalIcon icon={ShieldAlert} label="" />
          Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in
          your .env file.
        </p>
      </section>
    )
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
            <TerminalIcon icon={Mail} label="" />
          </span>
          <input
            className="login-input"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
    </section>
  )
}
