import { supabase } from './supabaseClient'
import { AppError, call, toAppError } from './errors'

// Loads the person's role and status. Never trust the browser for the role:
// this reads it from the database, where Row Level Security protects it.
export async function fetchProfile(user) {
  const { data } = await call(
    supabase.from('profiles').select('id, full_name, role, is_active').eq('id', user.id).maybeSingle(),
  )
  if (!data) {
    throw new AppError('Your account is not set up yet. Ask the owner for help.', 'NO_PROFILE')
  }
  return {
    id: data.id,
    email: user.email ?? '',
    fullName: data.full_name,
    role: data.role,
    isActive: data.is_active,
  }
}

// Wrong email and wrong password give the SAME message (so nobody can probe which emails exist).
export async function signInWithPassword(email, password) {
  let result
  try {
    result = await supabase.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password })
  } catch (error) {
    throw toAppError(error)
  }

  const { data, error } = result
  if (error) {
    if (error.status === 429 || /rate_limit/i.test(error.code ?? '')) {
      throw new AppError('Too many attempts. Wait a minute and try again.', 'RATE_LIMIT')
    }
    if (/failed to fetch|network|load failed/i.test(error.message ?? '')) throw toAppError(error)
    throw new AppError('Incorrect email or password.', 'INVALID_CREDENTIALS')
  }
  return data.user
}

export async function signOutLocal() {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // Even if the server cannot be reached, the local session is cleared.
  }
}
