import { useState } from 'react'
import {
  Check,
  CircleAlert,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import {
  createUser,
  deleteUser,
  resetPassword,
  setUserAdmin,
} from '../../lib/authApi.js'

const formatDate = (value) => (value ? String(value).slice(0, 10) : '—')

// Admin-only user management: list every account and add / reset / delete /
// promote them. All mutations hit the server auth API, then call onChange() so
// the parent reloads the canonical list.
export function UserManager({ users, currentUsername, onChange }) {
  // New-user form.
  const [name, setName] = useState('')
  const [pass, setPass] = useState('')
  const [makeAdmin, setMakeAdmin] = useState(false)
  const [addError, setAddError] = useState('')

  // Per-row interaction: at most one open at a time.
  const [resetId, setResetId] = useState(null)
  const [resetValue, setResetValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [rowError, setRowError] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    await onChange?.()
  }

  const handleAdd = async (event) => {
    event.preventDefault()
    if (busy) return
    setAddError('')
    const trimmed = name.trim()
    if (trimmed.length < 3) {
      setAddError('Username must be at least 3 characters.')
      return
    }
    if (pass.length < 6) {
      setAddError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      await createUser({ username: trimmed, password: pass, isAdmin: makeAdmin })
      setName('')
      setPass('')
      setMakeAdmin(false)
      await reload()
    } catch (error) {
      setAddError(error.message || 'Could not create user.')
    } finally {
      setBusy(false)
    }
  }

  const openReset = (id) => {
    setConfirmDeleteId(null)
    setRowError('')
    setResetValue('')
    setResetId((current) => (current === id ? null : id))
  }

  const handleReset = async (id) => {
    if (busy) return
    setRowError('')
    if (resetValue.length < 6) {
      setRowError('New password must be at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      await resetPassword(id, resetValue)
      setResetId(null)
      setResetValue('')
      await reload()
    } catch (error) {
      setRowError(error.message || 'Could not reset password.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id) => {
    if (busy) return
    setRowError('')
    setBusy(true)
    try {
      await deleteUser(id)
      setConfirmDeleteId(null)
      await reload()
    } catch (error) {
      setRowError(error.message || 'Could not delete user.')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleAdmin = async (user) => {
    if (busy) return
    setRowError('')
    setBusy(true)
    try {
      await setUserAdmin(user.id, !user.isAdmin)
      await reload()
    } catch (error) {
      setRowError(error.message || 'Could not update role.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-modules user-manager">
      <header className="admin-panel-head">
        <span>
          <TerminalIcon icon={User} label="" />
          users
        </span>
        <em>{users === null ? 'loading…' : `${users.length} total`}</em>
      </header>

      {/* Add user */}
      <form className="user-add" onSubmit={handleAdd}>
        <div className="user-add-fields">
          <label className="login-row user-add-input">
            <span className="login-prompt" aria-hidden="true">
              <TerminalIcon icon={User} label="" />
            </span>
            <input
              className="login-input"
              type="text"
              autoComplete="off"
              placeholder="username"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="login-row user-add-input">
            <span className="login-prompt" aria-hidden="true">
              <TerminalIcon icon={KeyRound} label="" />
            </span>
            <input
              className="login-input"
              type="text"
              autoComplete="off"
              placeholder="password"
              value={pass}
              onChange={(event) => setPass(event.target.value)}
            />
          </label>
          <label className="auth-checkbox user-add-admin">
            <input
              type="checkbox"
              checked={makeAdmin}
              onChange={(event) => setMakeAdmin(event.target.checked)}
            />
            <span className="auth-checkbox-box" aria-hidden="true">
              {makeAdmin ? '×' : ' '}
            </span>
            <span className="auth-checkbox-label">admin</span>
          </label>
          <button type="submit" className="user-add-submit" disabled={busy}>
            <span>
              <TerminalIcon icon={UserPlus} label="" />
            </span>
            add
          </button>
        </div>
        {addError && (
          <p className="user-msg" role="alert">
            <TerminalIcon icon={CircleAlert} label="" />
            {addError}
          </p>
        )}
      </form>

      {/* User list */}
      <ul className="user-list">
        {users === null && <li className="user-empty">loading…</li>}
        {users?.length === 0 && <li className="user-empty">no users yet.</li>}
        {users?.map((user) => {
          const isSelf = user.username === currentUsername
          const isResetting = resetId === user.id
          const isConfirming = confirmDeleteId === user.id
          return (
            <li className="user-row" key={user.id}>
              <div className="user-main">
                <span className="user-id" aria-hidden="true">
                  {String(user.id).padStart(2, '0')}
                </span>
                <span className="user-name">
                  {user.username}
                  {isSelf && <em className="user-you">you</em>}
                </span>
                <span className={`user-role user-role--${user.isAdmin ? 'admin' : 'op'}`}>
                  {user.isAdmin ? '● admin' : '· user'}
                </span>
                <span className="user-date">{formatDate(user.createdAt)}</span>
                <span className="user-actions">
                  <button
                    type="button"
                    className="user-act"
                    title={user.isAdmin ? 'Revoke admin' : 'Grant admin'}
                    disabled={busy || isSelf}
                    onClick={() => handleToggleAdmin(user)}
                  >
                    <TerminalIcon icon={user.isAdmin ? ShieldOff : ShieldCheck} label="" />
                    {user.isAdmin ? 'demote' : 'promote'}
                  </button>
                  <button
                    type="button"
                    className="user-act"
                    title="Reset password"
                    disabled={busy}
                    onClick={() => openReset(user.id)}
                  >
                    <TerminalIcon icon={KeyRound} label="" />
                    reset
                  </button>
                  <button
                    type="button"
                    className="user-act user-act--danger"
                    title={isSelf ? 'You cannot delete your own account' : 'Delete user'}
                    disabled={busy || isSelf}
                    onClick={() => {
                      setResetId(null)
                      setRowError('')
                      setConfirmDeleteId((current) => (current === user.id ? null : user.id))
                    }}
                  >
                    <TerminalIcon icon={Trash2} label="" />
                    delete
                  </button>
                </span>
              </div>

              {isResetting && (
                <div className="user-inline">
                  <label className="login-row user-inline-input">
                    <span className="login-prompt" aria-hidden="true">
                      <TerminalIcon icon={KeyRound} label="" />
                    </span>
                    <input
                      className="login-input"
                      type="text"
                      autoComplete="off"
                      placeholder={`new password for ${user.username}`}
                      value={resetValue}
                      autoFocus
                      onChange={(event) => setResetValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          handleReset(user.id)
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="user-act"
                    disabled={busy}
                    onClick={() => handleReset(user.id)}
                  >
                    <TerminalIcon icon={Check} label="" />
                    save
                  </button>
                  <button
                    type="button"
                    className="user-act"
                    onClick={() => {
                      setResetId(null)
                      setResetValue('')
                    }}
                  >
                    <TerminalIcon icon={X} label="" />
                    cancel
                  </button>
                </div>
              )}

              {isConfirming && (
                <div className="user-inline user-inline--danger">
                  <span className="user-confirm-text">
                    delete <strong>{user.username}</strong> permanently?
                  </span>
                  <button
                    type="button"
                    className="user-act user-act--danger"
                    disabled={busy}
                    onClick={() => handleDelete(user.id)}
                  >
                    <TerminalIcon icon={Trash2} label="" />
                    confirm
                  </button>
                  <button
                    type="button"
                    className="user-act"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    <TerminalIcon icon={X} label="" />
                    cancel
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {rowError && (
        <p className="user-msg" role="alert">
          <TerminalIcon icon={CircleAlert} label="" />
          {rowError}
        </p>
      )}
    </div>
  )
}
