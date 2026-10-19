import { getTodayInManila } from '../utils/date'
import { buildTotals } from '../utils/calculations'
import { call } from './errors'
import { mapTransaction } from './mappers'
import { supabase } from './supabaseClient'

export function totalsFromDailyRow(row) {
  return buildTotals({
    cashInTotal: row?.cash_in_total,
    cashOutTotal: row?.cash_out_total,
    cashInCount: row?.cash_in_count,
    cashOutCount: row?.cash_out_count,
    voidedCount: row?.voided_count,
  })
}

// Totals are calculated by the database from real records (voided excluded).
export async function getDashboardData(businessDate, viewer) {
  // Staff only see today. (Row Level Security enforces this in the database.)
  const date = viewer?.role === 'admin' ? businessDate : getTodayInManila()

  const [totals, recent] = await Promise.all([
    call(supabase.rpc('daily_totals', { p_from: date, p_to: date, p_type: null })),
    call(
      supabase.rpc('search_transactions', {
        p_from: date,
        p_to: date,
        p_type: null,
        p_status: null,
        p_staff: null,
        p_search: null,
        p_sort: 'newest',
        p_limit: 8,
        p_offset: 0,
      }),
    ),
  ])

  return {
    businessDate: date,
    isDemo: false,
    totals: totalsFromDailyRow(totals.data?.[0]),
    recentTransactions: recent.data.map((row) => mapTransaction(row)),
  }
}
