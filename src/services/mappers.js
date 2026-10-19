// Converts database rows (snake_case) to the shapes the screens use (camelCase).

import { formatPeso } from '../utils/currency'
import { formatDateTime } from '../utils/date'

export function mapTransaction(row, staffNameOverride) {
  return {
    id: row.id,
    referenceNumber: row.reference_number,
    type: row.transaction_type,
    amount: Number(row.amount),
    name: row.sender_receiver_name ?? null,
    notes: row.notes ?? null,
    transactionTimestamp: row.transaction_timestamp,
    businessDate: row.business_date,
    status: row.status,
    voidReason: row.void_reason ?? null,
    staffName: staffNameOverride ?? row.staff_name ?? row.staff?.full_name ?? 'Unknown',
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const FIELD_LABELS = {
  reference_number: 'Reference number',
  amount: 'Amount',
  sender_receiver_name: 'Sender / receiver',
  notes: 'Notes',
  transaction_timestamp: 'Date and time',
}

function showValue(key, value) {
  if (value === null || value === undefined || value === '') return '(blank)'
  if (key === 'amount') return formatPeso(value)
  if (key === 'transaction_timestamp') return formatDateTime(value)
  return String(value)
}

function sameInstant(a, b) {
  return new Date(a).getTime() === new Date(b).getTime()
}

// Audit-log row -> the "change history" entry shown on the details page.
export function mapHistoryEntry(entry) {
  const action = { 'transaction.created': 'created', 'transaction.updated': 'edited', 'transaction.voided': 'voided' }[
    entry.action
  ]
  if (!action) return null

  const result = {
    id: entry.id,
    at: entry.created_at,
    by: entry.actor_name ?? 'Unknown',
    action,
    note: action === 'created' ? 'Transaction recorded.' : entry.reason,
  }

  if (action === 'edited') {
    const before = entry.previous_values ?? {}
    const after = entry.new_values ?? {}
    result.changes = Object.keys(FIELD_LABELS)
      .filter((key) =>
        key === 'transaction_timestamp'
          ? !sameInstant(before[key], after[key])
          : (before[key] ?? null) !== (after[key] ?? null),
      )
      .map((key) => ({ field: FIELD_LABELS[key], from: showValue(key, before[key]), to: showValue(key, after[key]) }))
  }
  return result
}

const CLOSING_ACTIONS = {
  'closing.draft_saved': 'draft_saved',
  'closing.closed': 'closed',
  'closing.reopened': 'reopened',
}

export function mapClosing(row, auditRows = []) {
  return {
    businessDate: row.business_date,
    status: row.status,
    cashCounted: row.cash_counted === null ? null : Number(row.cash_counted),
    recordedCashBalance: row.recorded_cash_balance === null ? null : Number(row.recorded_cash_balance),
    shortageOverage: row.shortage_overage === null ? null : Number(row.shortage_overage),
    closingNotes: row.closing_notes ?? '',
    closedBy: row.closer?.full_name ?? null,
    closedAt: row.closed_at,
    reopenedBy: row.reopener?.full_name ?? null,
    reopenedAt: row.reopened_at,
    reopenReason: row.reopen_reason,
    updatedAt: row.updated_at,
    history: auditRows
      .filter((entry) => CLOSING_ACTIONS[entry.action])
      .map((entry) => ({
        id: entry.id,
        at: entry.created_at,
        by: entry.actor_name ?? 'Unknown',
        action: CLOSING_ACTIONS[entry.action],
        note: entry.reason ?? '',
      })),
  }
}

export function emptyClosing(businessDate) {
  return {
    businessDate,
    status: 'open',
    cashCounted: null,
    recordedCashBalance: null,
    shortageOverage: null,
    closingNotes: '',
    closedBy: null,
    closedAt: null,
    reopenedBy: null,
    reopenedAt: null,
    reopenReason: null,
    updatedAt: null,
    history: [],
  }
}
