import { supabase } from './supabaseClient'
import { call } from './errors'
import { cleanText } from '../utils/validation'

function mapSettings(row) {
  return {
    storeName: row.store_name,
    timezone: row.timezone,
    staffHistoryDays: row.staff_history_days,
  }
}

export async function getStoreSettings() {
  const { data } = await call(
    supabase.from('store_settings').select('store_name, timezone, staff_history_days').maybeSingle(),
  )
  return data ? mapSettings(data) : null
}

export async function updateStoreSettings({ storeName, staffHistoryDays }) {
  const { data } = await call(
    supabase.rpc('update_store_settings', {
      p_store_name: cleanText(storeName),
      p_staff_history_days: staffHistoryDays,
    }),
  )
  return mapSettings(data)
}
