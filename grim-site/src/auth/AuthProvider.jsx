import { useMemo, useState } from 'react'
import { createUser, verifyUser } from '../lib/db.js'
import { AuthContext } from './context.js'

// The signed-in account is mirrored here so a reload restores the session
// without re-reading the SQLite blob on every paint.
const SESSION_KEY = 'grim.auth.session'

function readSession() {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  // localStorage is synchronous, so the persisted session is restored on the
  // first render — no loading flash before an existing session resolves.
  const [user, setUser] = useState(readSession)
  const loading = false

  const value = useMemo(() => {
    const remember = (account) => {
      localStorage.setItem(SESSION_KEY, JSON.stringify(account))
      setUser(account)
      return account
    }

    return {
      user,
      isLoggedIn: Boolean(user),
      isAdmin: Boolean(user?.isAdmin),
      loading,
      signIn: async (username, password) => remember(await verifyUser({ username, password })),
      signUp: async (username, password, isAdmin) =>
        remember(await createUser({ username, password, isAdmin })),
      signOut: async () => {
        localStorage.removeItem(SESSION_KEY)
        setUser(null)
      },
    }
  }, [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
