import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { AppError, call, onSessionExpired, toAppError } from '../../src/services/errors.js'
import { emptyClosing, mapClosing, mapHistoryEntry, mapTransaction } from '../../src/services/mappers.js'
import { createUuid } from '../../src/utils/uuid.js'

describe('mapTransaction', () => {
  const row = {
    id: 'a',
    reference_number: '0143 872 590316',
    transaction_type: 'cash_in',
    amount: '1500.50',
    sender_receiver_name: null,
    notes: null,
    transaction_timestamp: '2026-10-13T01:12:00+00:00',
    business_date: '2026-10-13',
    status: 'completed',
    void_reason: null,
    created_by: 'u1',
    created_at: 'x',
    updated_at: 'y',
  }
  it('converts names and turns the amount into a real number', () => {
    const t = mapTransaction({ ...row, staff_name: 'Ana' })
    assert.equal(t.referenceNumber, '0143 872 590316') // still text, zero kept
    assert.equal(t.type, 'cash_in')
    assert.equal(t.amount, 1500.5)
    assert.equal(t.name, null)
    assert.equal(t.staffName, 'Ana')
  })
  it('finds the staff name from an embedded profile, or an override, or falls back', () => {
    assert.equal(mapTransaction({ ...row, staff: { full_name: 'Ben' } }).staffName, 'Ben')
    assert.equal(mapTransaction(row, 'Override').staffName, 'Override')
    assert.equal(mapTransaction(row).staffName, 'Unknown')
  })
})

describe('change history', () => {
  it('created, voided, and unknown actions', () => {
    assert.equal(mapHistoryEntry({ id: '1', action: 'transaction.created', created_at: 't', actor_name: 'Ana' }).action, 'created')
    const voided = mapHistoryEntry({ id: '2', action: 'transaction.voided', created_at: 't', actor_name: 'Maria', reason: 'Wrong amount' })
    assert.equal(voided.action, 'voided')
    assert.equal(voided.note, 'Wrong amount')
    assert.equal(mapHistoryEntry({ id: '3', action: 'closing.closed' }), null)
  })
  it('edited lists only the fields that really changed', () => {
    const entry = mapHistoryEntry({
      id: '4',
      action: 'transaction.updated',
      created_at: 't',
      actor_name: 'Maria',
      reason: 'Typo',
      previous_values: { reference_number: 'A', amount: 100, notes: null, transaction_timestamp: '2026-10-13T01:00:00+00:00' },
      new_values: { reference_number: 'A', amount: 200, notes: null, transaction_timestamp: '2026-10-13T09:00:00+08:00' },
    })
    assert.equal(entry.changes.length, 1) // same instant in two formats is NOT a change
    assert.equal(entry.changes[0].field, 'Amount')
    assert.match(entry.changes[0].from, /100/)
    assert.match(entry.changes[0].to, /200/)
  })
  it('a real time change is detected', () => {
    const entry = mapHistoryEntry({
      id: '5',
      action: 'transaction.updated',
      created_at: 't',
      previous_values: { transaction_timestamp: '2026-10-13T01:00:00+00:00' },
      new_values: { transaction_timestamp: '2026-10-13T02:00:00+00:00' },
    })
    assert.equal(entry.changes.map((c) => c.field).join(), 'Date and time')
  })
})

describe('daily closing mapping', () => {
  it('maps numbers, names and history', () => {
    const closing = mapClosing(
      {
        business_date: '2026-10-13',
        status: 'closed',
        cash_counted: '5000.00',
        recorded_cash_balance: '4900.00',
        shortage_overage: '100.00',
        closing_notes: null,
        closer: { full_name: 'Maria' },
        closed_at: 't',
        reopener: null,
        updated_at: 'u',
      },
      [
        { id: '1', action: 'closing.closed', created_at: 't', actor_name: 'Maria', reason: null },
        { id: '2', action: 'transaction.created', created_at: 't' },
      ],
    )
    assert.equal(closing.cashCounted, 5000)
    assert.equal(closing.shortageOverage, 100)
    assert.equal(closing.closedBy, 'Maria')
    assert.equal(closing.history.length, 1)
  })
  it('empty closing is open with no values', () => {
    const empty = emptyClosing('2026-10-13')
    assert.equal(empty.status, 'open')
    assert.equal(empty.cashCounted, null)
  })
})

describe('friendly errors', () => {
  afterEach(() => onSessionExpired(null))

  it('network failures', () => {
    const e = toAppError(new TypeError('Failed to fetch'))
    assert.equal(e.code, 'NETWORK')
    assert.match(e.message, /internet/i)
  })
  it('expired session logs the user out through the registered handler', () => {
    let called = 0
    onSessionExpired(() => {
      called += 1
    })
    const e = toAppError({ code: 'PGRST301', message: 'JWT expired' })
    assert.equal(e.code, 'SESSION_EXPIRED')
    assert.equal(called, 1)
  })
  it('raw permission errors become a plain sentence; our own messages pass through', () => {
    assert.equal(toAppError({ message: 'permission denied for table transactions', code: '42501' }).code, 'FORBIDDEN')
    assert.equal(toAppError({ message: 'Only the owner can do this.', code: '42501' }).message, 'Only the owner can do this.')
    assert.equal(toAppError({ message: 'Business date 2026-10-13 is closed. Reopen the day.' }).message.startsWith('Business date'), true)
  })
  it('AppError passes through unchanged; empty errors get a default', () => {
    const own = new AppError('x', 'Y')
    assert.equal(toAppError(own), own)
    assert.ok(toAppError({}).message.length > 0)
  })
  it('call() returns results, and throws friendly errors', async () => {
    assert.deepEqual((await call(Promise.resolve({ data: [1], error: null }))).data, [1])
    await assert.rejects(call(Promise.resolve({ data: null, error: { message: 'Amount must be greater than zero.' } })), /greater than zero/)
    await assert.rejects(call(Promise.reject(new TypeError('Failed to fetch'))), (e) => e.code === 'NETWORK')
  })
})

describe('uuid for duplicate-save protection', () => {
  const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it('creates valid, unique version-4 ids', () => {
    const ids = new Set(Array.from({ length: 500 }, createUuid))
    assert.equal(ids.size, 500)
    for (const id of ids) assert.match(id, V4)
  })
  it('still works on insecure pages (no crypto.randomUUID), e.g. a phone on http://192.168...', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
    try {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: { getRandomValues: (bytes) => globalThis.__realCrypto?.getRandomValues?.(bytes) ?? bytes.fill(7) },
      })
      assert.match(createUuid(), V4)
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined })
      assert.match(createUuid(), V4) // even with Math.random only
    } finally {
      Object.defineProperty(globalThis, 'crypto', original)
    }
  })
})
