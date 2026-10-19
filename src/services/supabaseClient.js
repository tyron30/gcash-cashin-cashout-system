import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && key)

// Safety net: a secret / service_role key must NEVER be used in the browser.
// If one is pasted by mistake, refuse to start instead of exposing everything.
function looksLikeSecretKey(value) {
  if (!value) return false
  if (value.startsWith('sb_secret_')) return true
  try {
    const payload = JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

export const hasUnsafeKey = looksLikeSecretKey(key)

export const supabase =
  isSupabaseConfigured && !hasUnsafeKey
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null
