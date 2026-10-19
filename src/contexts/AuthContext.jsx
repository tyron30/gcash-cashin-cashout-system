import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchProfile, signInWithPassword, signOutLocal } from '../services/authService'
import { onSessionExpired } from '../services/errors'
import { supabase } from '../services/supabaseClient'

export const AuthContext = createContext(null)

const sameProfile = (a, b) =>
  Boolean(a && b) &&
  a.id === b.id &&
  a.role === b.role &&
  a.isActive === b.isActive &&
  a.fullName === b.fullName &&
  a.email === b.email

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const [notice, setNotice] = useState('')
  const manualSignOut = useRef(false)

  const loadProfile = useCallback(async (session) => {
    if (!session?.user) {
      setProfile(null)
      setProfileError('')
      return
    }
    try {
      const next = await fetchProfile(session.user)
      setProfile((previous) => (sameProfile(previous, next) ? previous : next))
      setProfileError('')
    } catch (error) {
      setProfileError(error.message || 'Could not load your account.')
    }
  }, [])

  useEffect(() => {
    let active = true

    // 1) Restore a saved session when the page opens.
    supabase.auth
      .getSession()
      .then(({ data }) => loadProfile(data.session))
      .catch(() => setProfileError('Could not check your session. Check your connection.'))
      .finally(() => {
        if (active) setLoading(false)
      })

    // 2) React to sign-in / sign-out. (Deferred with setTimeout: calling Supabase
    //    directly inside this callback can freeze it.)
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return
      setTimeout(() => {
        if (!active) return
        if (event === 'SIGNED_OUT') {
          setProfile(null)
          setProfileError('')
          if (!manualSignOut.current) setNotice('Your session ended. Please log in again.')
          manualSignOut.current = false
        } else {
          loadProfile(session)
        }
      }, 0)
    })

    // 3) Any request that fails with "JWT expired" logs the person out cleanly.
    const stopListening = onSessionExpired(() => {
      setNotice('Your session expired. Please log in again.')
      signOutLocal()
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
      stopListening()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email, password) => {
    setNotice('')
    const user = await signInWithPassword(email, password)
    const next = await fetchProfile(user)
    setProfile(next)
    setProfileError('')
  }, [])

  const signOut = useCallback(async () => {
    manualSignOut.current = true
    setProfile(null)
    setProfileError('')
    await signOutLocal()
  }, [])

  const retryProfile = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.auth.getSession()
    await loadProfile(data.session)
    setLoading(false)
  }, [loadProfile])

  const value = useMemo(
    () => ({
      profile,
      isAuthenticated: Boolean(profile),
      isAdmin: Boolean(profile?.isActive && profile.role === 'admin'),
      loading,
      profileError,
      notice,
      clearNotice: () => setNotice(''),
      signIn,
      signOut,
      retryProfile,
    }),
    [profile, loading, profileError, notice, signIn, signOut, retryProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
