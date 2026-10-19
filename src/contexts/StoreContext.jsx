import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getStoreSettings } from '../services/storeService'

export const StoreContext = createContext(null)

const DEFAULTS = { storeName: 'My Store', timezone: 'Asia/Manila', staffHistoryDays: 0 }

// Holds the store name etc. for headers and reports.
export function StoreProvider({ children }) {
  const { profile } = useAuth()
  const [settings, setSettings] = useState(DEFAULTS)
  const userId = profile?.id
  const active = Boolean(profile?.isActive)

  const refresh = useCallback(async () => {
    try {
      const next = await getStoreSettings()
      if (next) setSettings(next)
    } catch {
      // Keep showing the previous name if the request fails.
    }
  }, [])

  useEffect(() => {
    if (!userId || !active) {
      setSettings(DEFAULTS)
      return
    }
    refresh()
  }, [userId, active, refresh])

  const value = useMemo(() => ({ ...settings, refresh }), [settings, refresh])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
