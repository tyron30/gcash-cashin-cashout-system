import { useCallback, useEffect, useRef, useState } from 'react'
import { getDashboardData } from '../services/dashboardService'
import { useAuth } from './useAuth'

const AUTO_REFRESH_MS = 60000

export function useDashboardData(businessDate) {
  const { profile } = useAuth()
  const profileRef = useRef(profile)
  profileRef.current = profile
  const userId = profile?.id
  const role = profile?.role

  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  // Normal load (shows the skeleton).
  useEffect(() => {
    let cancelled = false
    setState((previous) => ({ ...previous, loading: true, error: null }))

    getDashboardData(businessDate, profileRef.current)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: error.message || 'Something went wrong while loading data.' })
        }
      })

    // Ignore results from an older request if the date changed meanwhile.
    return () => {
      cancelled = true
    }
  }, [businessDate, userId, role, reloadKey])

  // Quiet refresh: new records from other staff show up without a reload.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      getDashboardData(businessDate, profileRef.current)
        .then((data) => setState((previous) => (previous.error ? previous : { data, loading: false, error: null })))
        .catch(() => {})
    }, AUTO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [businessDate, userId, role])

  const refresh = useCallback(() => setReloadKey((key) => key + 1), [])

  return { ...state, refresh }
}
