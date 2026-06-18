import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { AuthContext } from './context.js'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // `loading` stays true until the initial session has been resolved, so the UI
  // doesn't flash the locked state before an existing session is restored.
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return undefined

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isLoggedIn: Boolean(session),
      loading,
      configured: isSupabaseConfigured,
      signIn: (email, password) =>
        supabase.auth.signInWithPassword({ email, password }),
      signOut: () => supabase.auth.signOut(),
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
