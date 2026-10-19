import { supabase } from './supabaseClient'
import { call } from './errors'

export async function listStaff() {
  const { data } = await call(supabase.rpc('admin_list_profiles'))
  return data.map((row) => ({
    id: row.id,
    email: row.email ?? '',
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
  }))
}

// Send only what changed. The database checks you are the owner and writes the audit log.
export async function updateStaff(userId, { role, isActive, fullName }) {
  await call(
    supabase.rpc('admin_update_profile', {
      p_user_id: userId,
      p_role: role ?? null,
      p_is_active: isActive ?? null,
      p_full_name: fullName ?? null,
    }),
  )
}
