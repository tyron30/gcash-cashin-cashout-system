// Phase 4: real Supabase calls. Function names and return shapes are the same
// as the demo version, so the screens did not need to change.

import { buildTotals } from '../utils/calculations'
import { eachDate, getTodayInManila } from '../utils/date'
import { cleanText } from '../utils/validation'
import { call } from './errors'
import { mapHistoryEntry, mapTransaction } from './mappers'
import { supabase } from './supabaseClient'

export const PAGE_SIZE = 10
export const MAX_RANGE_DAYS = 92
const WITH_STAFF = '*, staff:profiles!transactions_created_by_fkey(full_name)'

function toParams(filters, viewer) {
  const isAdmin = viewer?.role === 'admin'
  const today = getTodayInManila()

  // Staff only ever ask for today (the database enforces this too).
  const from = isAdmin ? filters.dateFrom : today
  const to = isAdmin ? filters.dateTo : today

  if (!from || !to) throw new Error('Choose a start date and an end date.')
  if (from > to) throw new Error('The start date must be on or before the end date.')
  if (eachDate(from, to).length > MAX_RANGE_DAYS) {
    throw new Error(`Choose a date range of ${MAX_RANGE_DAYS} days or less.`)
  }

  const search = String(filters.search ?? '').trim()
  return {
    p_from: from,
    p_to: to,
    p_type: filters.type && filters.type !== 'all' ? filters.type : null,
    p_status: filters.status && filters.status !== 'all' ? filters.status : null,
    p_staff: isAdmin && filters.staff && filters.staff !== 'all' ? filters.staff : null,
    p_search: search ? search.slice(0, 60) : null,
  }
}

export async function listTransactions(filters, viewer) {
  const params = toParams(filters, viewer)
  const pageSize = filters.pageSize ?? PAGE_SIZE

  const { data: summaryRows } = await call(supabase.rpc('transaction_summary', params))
  const summary = summaryRows?.[0] ?? {}
  const total = Number(summary.total_count ?? 0)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages)

  let items = []
  if (total > 0) {
    const { data } = await call(
      supabase.rpc('search_transactions', {
        ...params,
        p_sort: filters.sort === 'oldest' ? 'oldest' : 'newest',
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      }),
    )
    items = data.map((row) => mapTransaction(row))
  }

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    summary: buildTotals({
      cashInTotal: summary.cash_in_total,
      cashOutTotal: summary.cash_out_total,
      cashInCount: summary.cash_in_count,
      cashOutCount: summary.cash_out_count,
      voidedCount: summary.voided_count,
    }),
  }
}

// Every matching record (for reports and CSV). The server returns at most
// 1000 rows per request, so this reads page after page.
export async function fetchAllTransactions({ dateFrom, dateTo, type = 'all', sort = 'oldest' }) {
  const params = toParams({ dateFrom, dateTo, type }, { role: 'admin' })
  const all = []
  for (let offset = 0; offset < 20000; offset += 1000) {
    const { data } = await call(
      supabase.rpc('search_transactions', { ...params, p_sort: sort, p_limit: 1000, p_offset: offset }),
    )
    all.push(...data.map((row) => mapTransaction(row)))
    if (data.length < 1000) break
  }
  return all
}

export async function getTransaction(id, viewer) {
  const { data: row } = await call(supabase.from('transactions').select(WITH_STAFF).eq('id', id).maybeSingle())

  // Same message for "missing" and "not allowed" so nothing leaks.
  if (!row) throw new Error('Transaction not found, or you do not have access to it.')

  const transaction = mapTransaction(row)
  const isAdmin = viewer?.role === 'admin'
  if (!isAdmin) return { ...transaction, history: [], dayClosed: false }

  const [audit, closing] = await Promise.all([
    call(
      supabase
        .from('audit_logs')
        .select('id, created_at, actor_name, action, reason, previous_values, new_values')
        .eq('entity_type', 'transaction')
        .eq('entity_id', id)
        .order('created_at', { ascending: true }),
    ),
    call(supabase.from('daily_closings').select('status').eq('business_date', transaction.businessDate).maybeSingle()),
  ])

  let history = audit.data.map(mapHistoryEntry).filter(Boolean)
  if (!history.some((entry) => entry.action === 'created')) {
    // Records added outside the app (like sample data) have no "created" entry.
    history = [
      { id: `created-${id}`, at: transaction.createdAt, by: transaction.staffName, action: 'created', note: 'Transaction recorded.' },
      ...history,
    ]
  }

  return { ...transaction, history, dayClosed: closing.data?.status === 'closed' }
}

export async function listStaffMembers() {
  const { data } = await call(supabase.from('profiles').select('id, full_name').order('full_name'))
  return data.map((row) => ({ id: row.id, name: row.full_name }))
}

// Only a WARNING. The person may still save, because the same reference can legitimately repeat.
export async function findDuplicateReference(referenceNumber, excludeId = null) {
  const { data } = await call(
    supabase.rpc('find_duplicate_references', {
      p_reference_number: referenceNumber,
      p_exclude_id: excludeId,
    }),
  )
  return data.map((row) => ({
    id: row.id, // null when this person is not allowed to open that record
    businessDate: row.business_date,
    type: row.transaction_type,
    amount: Number(row.amount),
    transactionTimestamp: row.transaction_timestamp,
    staffName: row.staff_name,
  }))
}

export async function createTransaction(input, viewer) {
  const { data } = await call(
    supabase.rpc('create_transaction', {
      p_transaction_type: input.type,
      p_reference_number: input.type === 'cash_out' ? input.referenceNumber : null,
      p_amount: input.amount,
      p_sender_receiver_name: cleanText(input.name) || null,
      p_notes: cleanText(input.notes) || null,
      p_transaction_timestamp: input.transactionTimestamp || null,
      p_client_request_id: input.submissionKey || null,
    }),
  )
  return { transaction: mapTransaction(data, viewer?.fullName), alreadySaved: false }
}

export async function updateTransaction(id, changes, reason, viewer) {
  const { data } = await call(
    supabase.rpc('update_transaction', {
      p_id: id,
      p_reference_number: changes.referenceNumber ?? null,
      p_amount: changes.amount,
      p_sender_receiver_name: cleanText(changes.name) || null,
      p_notes: cleanText(changes.notes) || null,
      p_transaction_timestamp: changes.transactionTimestamp,
      p_reason: reason,
    }),
  )
  return mapTransaction(data, viewer?.fullName)
}

// Voiding never deletes. The record stays and leaves the totals.
export async function voidTransaction(id, reason, viewer) {
  const { data } = await call(supabase.rpc('void_transaction', { p_id: id, p_reason: reason }))
  return mapTransaction(data, viewer?.fullName)
}
