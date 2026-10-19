import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildTotals,
  calculateDailyTotals,
  calculateShortageOverage,
  groupTotalsByStaff,
  sumTotals,
} from '../../src/utils/calculations.js'

const tx = (type, amount, status = 'completed', staffName = 'Ana') => ({ type, amount, status, staffName })

describe('daily totals', () => {
  it('adds cash in and cash out separately and counts them', () => {
    const t = calculateDailyTotals([tx('cash_in', 1500), tx('cash_in', 500), tx('cash_out', 2000)])
    assert.equal(t.cashInTotal, 2000)
    assert.equal(t.cashOutTotal, 2000)
    assert.equal(t.volume, 4000)
    assert.equal(t.netMovement, 0)
    assert.equal(t.cashInCount, 2)
    assert.equal(t.cashOutCount, 1)
    assert.equal(t.validCount, 3)
  })
  it('EXCLUDES voided transactions from every total (but counts them as voided)', () => {
    const t = calculateDailyTotals([tx('cash_in', 1000), tx('cash_in', 9999, 'voided'), tx('cash_out', 500, 'voided')])
    assert.equal(t.cashInTotal, 1000)
    assert.equal(t.cashOutTotal, 0)
    assert.equal(t.validCount, 1)
    assert.equal(t.voidedCount, 2)
  })
  it('has no floating-point drift (0.1 + 0.2 = 0.3)', () => {
    const t = calculateDailyTotals([tx('cash_in', 0.1), tx('cash_in', 0.2)])
    assert.equal(t.cashInTotal, 0.3)
  })
  it('stays exact over many centavo amounts', () => {
    const list = Array.from({ length: 1000 }, () => tx('cash_in', 0.01))
    assert.equal(calculateDailyTotals(list).cashInTotal, 10)
  })
  it('net movement can be negative; empty day is all zeros', () => {
    assert.equal(calculateDailyTotals([tx('cash_out', 300), tx('cash_in', 100)]).netMovement, -200)
    const empty = calculateDailyTotals([])
    assert.deepEqual(
      [empty.cashInTotal, empty.cashOutTotal, empty.volume, empty.netMovement, empty.validCount, empty.voidedCount],
      [0, 0, 0, 0, 0, 0],
    )
  })
  it('ignores unknown statuses and types instead of guessing', () => {
    const t = calculateDailyTotals([tx('cash_in', 100, 'pending'), tx('transfer', 100)])
    assert.equal(t.validCount, 0)
  })
  it('editing then voiding is reflected: recompute after each change', () => {
    const list = [tx('cash_in', 1000), tx('cash_out', 400)]
    assert.equal(calculateDailyTotals(list).volume, 1400)
    list[0] = { ...list[0], amount: 1200 } // an edit
    assert.equal(calculateDailyTotals(list).volume, 1600)
    list[1] = { ...list[1], status: 'voided' } // a void
    assert.equal(calculateDailyTotals(list).volume, 1200)
  })
})

describe('shortage / overage', () => {
  it('counted minus recorded', () => {
    assert.equal(calculateShortageOverage(5000, 4900), 100)
    assert.equal(calculateShortageOverage(4900, 5000), -100)
    assert.equal(calculateShortageOverage(1000, 1000), 0)
    assert.equal(calculateShortageOverage(0.1, 0.3), -0.2)
  })
  it('is unknown when either value is missing', () => {
    assert.equal(calculateShortageOverage(null, 100), null)
    assert.equal(calculateShortageOverage(100, undefined), null)
  })
})

describe('grouping and summing', () => {
  it('groups totals per staff member', () => {
    const groups = groupTotalsByStaff([
      tx('cash_in', 100, 'completed', 'Ana'),
      tx('cash_out', 50, 'completed', 'Ben'),
      tx('cash_in', 25, 'completed', 'Ana'),
      tx('cash_in', 999, 'voided', 'Ben'),
    ])
    const ana = groups.find((g) => g.staffName === 'Ana')
    const ben = groups.find((g) => g.staffName === 'Ben')
    assert.equal(ana.cashInTotal, 125)
    assert.equal(ben.cashOutTotal, 50)
    assert.equal(ben.cashInTotal, 0)
    assert.equal(ben.voidedCount, 1)
  })
  it('buildTotals turns database numbers into the totals shape', () => {
    const t = buildTotals({ cashInTotal: '1500.5', cashOutTotal: 500, cashInCount: 2, cashOutCount: 1, voidedCount: 3 })
    assert.equal(t.cashInTotal, 1500.5)
    assert.equal(t.volume, 2000.5)
    assert.equal(t.netMovement, 1000.5)
    assert.equal(t.validCount, 3)
    assert.equal(t.voidedCount, 3)
  })
  it('sumTotals adds day rows exactly', () => {
    const day = (i, o) => buildTotals({ cashInTotal: i, cashOutTotal: o, cashInCount: 1, cashOutCount: 1, voidedCount: 0 })
    const t = sumTotals([day(0.1, 0.2), day(0.2, 0.1)])
    assert.equal(t.cashInTotal, 0.3)
    assert.equal(t.cashOutTotal, 0.3)
    assert.equal(t.validCount, 4)
  })
})
