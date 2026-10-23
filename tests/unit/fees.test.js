import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calculateFee, describeTiers, sortTiers, totalWithFee, validateTierRows } from '../../src/utils/fees.js'
import { validateFee } from '../../src/utils/validation.js'

// The owner's example: up to 100 -> 10, up to 500 -> 15
const tiers = [
  { maxAmount: 100, feeAmount: 10 },
  { maxAmount: 500, feeAmount: 15 },
]

describe('fee lookup', () => {
  it('the owner example: 500 costs 15, so the customer pays 515', () => {
    const info = calculateFee(tiers, 500)
    assert.equal(info.fee, 15)
    assert.equal(info.matched, true)
    assert.equal(totalWithFee(500, info.fee), 515)
  })
  it('tier boundaries: 100 -> 10, 101 -> 15, 500 -> 15', () => {
    assert.equal(calculateFee(tiers, 1).fee, 10)
    assert.equal(calculateFee(tiers, 100).fee, 10)
    assert.equal(calculateFee(tiers, 101).fee, 15)
    assert.equal(calculateFee(tiers, 500).fee, 15)
  })
  it('centavos fall into the higher tier (no gap between 100 and 101)', () => {
    assert.equal(calculateFee(tiers, 100.01).fee, 15)
    assert.equal(calculateFee(tiers, 100.5).fee, 15)
    assert.equal(calculateFee(tiers, 0.01).fee, 10)
  })
  it('above the highest tier: no fee, and it says so', () => {
    const info = calculateFee(tiers, 500.01)
    assert.equal(info.fee, 0)
    assert.equal(info.matched, false)
    assert.equal(info.hasTiers, true)
    assert.equal(info.highest, 500)
  })
  it('no tiers at all means the fee feature is simply off', () => {
    for (const none of [[], undefined, null]) {
      const info = calculateFee(none, 500)
      assert.equal(info.fee, 0)
      assert.equal(info.hasTiers, false)
    }
  })
  it('does not depend on the order the tiers were entered', () => {
    const shuffled = [tiers[1], tiers[0]]
    assert.equal(calculateFee(shuffled, 50).fee, 10)
    assert.equal(calculateFee(shuffled, 300).fee, 15)
    assert.deepEqual(sortTiers(shuffled), tiers)
  })
  it('floating point noise cannot push an amount into the wrong tier', () => {
    const edge = [{ maxAmount: 0.3, feeAmount: 1 }, { maxAmount: 5, feeAmount: 2 }]
    assert.equal(calculateFee(edge, 0.1 + 0.2).fee, 1) // 0.30000000000000004
  })
  it('a free tier (fee 0) is allowed', () => {
    assert.equal(calculateFee([{ maxAmount: 50, feeAmount: 0 }, { maxAmount: 500, feeAmount: 15 }], 40).fee, 0)
  })
  it('totals are exact', () => {
    assert.equal(totalWithFee(500, 15), 515)
    assert.equal(totalWithFee(0.1, 0.2), 0.3)
    assert.equal(totalWithFee(1234.56, 25), 1259.56)
  })
})

describe('readable ranges', () => {
  it('1-100 and 101-500', () => {
    assert.deepEqual(describeTiers(tiers), [
      { from: 1, to: 100, fee: 10 },
      { from: 101, to: 500, fee: 15 },
    ])
  })
  it('a tier that ends on centavos starts a centavo later', () => {
    const ranges = describeTiers([{ maxAmount: 100.5, feeAmount: 10 }, { maxAmount: 500, feeAmount: 15 }])
    assert.equal(ranges[1].from, 100.51)
  })
  it('a tiny first tier starts at one centavo', () => {
    assert.equal(describeTiers([{ maxAmount: 0.5, feeAmount: 1 }])[0].from, 0.01)
  })
})

describe('checking the table the owner types', () => {
  const row = (maxAmount, feeAmount) => ({ key: Math.random(), maxAmount, feeAmount })

  it('accepts a good table and sorts it', () => {
    const result = validateTierRows([row('500', '15'), row('100', '10')])
    assert.equal(result.ok, true)
    assert.deepEqual(result.parsed, tiers)
  })
  it('accepts commas, peso signs and an empty table (no fees)', () => {
    assert.equal(validateTierRows([row('1,000', '₱20')]).ok, true)
    assert.equal(validateTierRows([]).ok, true)
  })
  it('rejects blanks', () => {
    const result = validateTierRows([row('', ''), row('100', '')])
    assert.equal(result.ok, false)
    assert.ok(result.errors[0].maxAmount && result.errors[0].feeAmount && result.errors[1].feeAmount)
  })
  it('rejects zero, negative, text and too many decimals', () => {
    for (const bad of ['0', '-5', 'abc', '10.123']) {
      assert.equal(validateTierRows([row(bad, '10')]).ok, false, `limit ${bad}`)
    }
    assert.equal(validateTierRows([row('100', '-1')]).ok, false)
    assert.equal(validateTierRows([row('100', 'x')]).ok, false)
  })
  it('rejects two tiers with the same limit (including 100 vs 100.00)', () => {
    const result = validateTierRows([row('100', '10'), row('100.00', '20')])
    assert.equal(result.ok, false)
    assert.match(result.errors[1].maxAmount, /already/i)
  })
  it('rejects more than 50 tiers and amounts that are too large', () => {
    const many = Array.from({ length: 51 }, (_, i) => row(String(i + 1), '1'))
    assert.equal(validateTierRows(many).ok, false)
    assert.ok(validateTierRows(many).formError)
    assert.equal(validateTierRows([row('1000000', '1')]).ok, false)
    assert.equal(validateTierRows([row('100', '1000000')]).ok, false)
  })
  it('a fee of zero is a valid fee', () => {
    assert.equal(validateTierRows([row('100', '0')]).ok, true)
  })
})

describe('owner correcting a fee on a record', () => {
  it('accepts zero and normal fees, rejects blank, negative and nonsense', () => {
    assert.equal(validateFee('0'), '')
    assert.equal(validateFee('15'), '')
    assert.equal(validateFee('7.50'), '')
    for (const bad of ['', '  ', '-1', 'abc', '1.234', '1000000']) assert.notEqual(validateFee(bad), '', bad)
  })
})
