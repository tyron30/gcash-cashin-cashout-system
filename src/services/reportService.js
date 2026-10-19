import { sumTotals } from '../utils/calculations'
import { eachDate } from '../utils/date'
import { parseMoney } from '../utils/validation'
import { totalsFromDailyRow } from './dashboardService'
import { call } from './errors'
import { emptyClosing, mapClosing } from './mappers'
import { supabase } from './supabaseClient'
import { fetchAllTransactions, MAX_RANGE_DAYS } from './transactionService'

async function fetchClosing(businessDate) {
  const { data } = await call(
    supabase
      .from('daily_closings')
      .select(
        '*, closer:profiles!daily_closings_closed_by_fkey(full_name), reopener:profiles!daily_closings_reopened_by_fkey(full_name)',
      )
      .eq('business_date', businessDate)
      .maybeSingle(),
  )
  if (!data) return emptyClosing(businessDate)

  const audit = await call(
    supabase
      .from('audit_logs')
      .select('id, created_at, actor_name, action, reason')
      .eq('entity_type', 'daily_closing')
      .eq('entity_id', data.id)
      .order('created_at', { ascending: true }),
  )
  return mapClosing(data, audit.data)
}

export async function getDailyReport(businessDate) {
  const [totals, staff, closing, transactions] = await Promise.all([
    call(supabase.rpc('daily_totals', { p_from: businessDate, p_to: businessDate, p_type: null })),
    call(supabase.rpc('staff_totals', { p_business_date: businessDate })),
    fetchClosing(businessDate),
    fetchAllTransactions({ dateFrom: businessDate, dateTo: businessDate, sort: 'newest' }),
  ])

  return {
    businessDate,
    transactions,
    totals: totalsFromDailyRow(totals.data?.[0]),
    byStaff: staff.data.map((row) => {
      const t = totalsFromDailyRow(row)
      return { staffId: row.staff_id, staffName: row.staff_name, ...t }
    }),
    closing,
  }
}

function moneyOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const amount = parseMoney(value)
  if (Number.isNaN(amount)) throw new Error('Enter valid peso amounts.')
  return amount
}

// close = false saves a draft. close = true marks the day as closed.
export async function saveClosing(businessDate, values, viewer, { close = false } = {}) {
  await call(
    supabase.rpc('save_daily_closing', {
      p_business_date: businessDate,
      p_cash_counted: moneyOrNull(values.cashCounted),
      p_recorded_cash_balance: moneyOrNull(values.recordedCashBalance),
      p_closing_notes: String(values.closingNotes ?? '').trim() || null,
      p_close: close,
    }),
  )
}

export async function reopenDay(businessDate, reason) {
  await call(supabase.rpc('reopen_business_day', { p_business_date: businessDate, p_reason: reason }))
}

export async function getRangeReport({ dateFrom, dateTo, type = 'all' }) {
  if (!dateFrom || !dateTo) throw new Error('Choose a start date and an end date.')
  if (dateFrom > dateTo) throw new Error('The start date must be on or before the end date.')
  if (eachDate(dateFrom, dateTo).length > MAX_RANGE_DAYS) {
    throw new Error(`Choose a date range of ${MAX_RANGE_DAYS} days or less.`)
  }

  const [daily, closings, transactions] = await Promise.all([
    call(supabase.rpc('daily_totals', { p_from: dateFrom, p_to: dateTo, p_type: type === 'all' ? null : type })),
    call(
      supabase.from('daily_closings').select('business_date, status').gte('business_date', dateFrom).lte('business_date', dateTo),
    ),
    fetchAllTransactions({ dateFrom, dateTo, type, sort: 'oldest' }),
  ])

  const closedDates = new Set(closings.data.filter((row) => row.status === 'closed').map((row) => row.business_date))
  const rows = daily.data.map((row) => ({
    date: row.business_date,
    closed: closedDates.has(row.business_date),
    ...totalsFromDailyRow(row),
  }))

  return { dateFrom, dateTo, type, rows, transactions, totals: sumTotals(rows) }
}
