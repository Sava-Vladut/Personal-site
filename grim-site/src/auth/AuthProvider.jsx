import { useEffect, useMemo, useState } from 'react'
import * as authApi from '../lib/authApi.js'
import { AuthContext } from './context.js'

// The session lives in an httpOnly cookie the server owns, so on mount we ask
// the backend who we are (GET /api/auth/me) rather than reading any local copy.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    authApi.fetchSession().then((account) => {
      if (active) {
        setUser(account)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isLoggedIn: Boolean(user),
      isAdmin: Boolean(user?.isAdmin),
      loading,
      signIn: async (username, password) => {
        const account = await authApi.login(username, password)
        setUser(account)
        return account
      },
      signUp: async (username, password) => {
        const account = await authApi.register(username, password)
        setUser(account)
        return account
      },
      signOut: async () => {
        await authApi.logout()
        setUser(null)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
