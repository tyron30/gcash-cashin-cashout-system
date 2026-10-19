import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatPeso, formatSignedPeso } from '../../src/utils/currency.js'

describe('peso formatting', () => {
  it('formats with the peso sign, commas and two decimals', () => {
    assert.equal(formatPeso(1500), '₱1,500.00')
    assert.equal(formatPeso(1234567.8), '₱1,234,567.80')
    assert.equal(formatPeso(0), '₱0.00')
  })
  it('never shows NaN', () => {
    assert.equal(formatPeso(NaN), '₱0.00')
    assert.equal(formatPeso(undefined), '₱0.00')
    assert.equal(formatPeso('abc'), '₱0.00')
  })
  it('signed values for net movement', () => {
    assert.equal(formatSignedPeso(1500), '+₱1,500.00')
    assert.equal(formatSignedPeso(-1500), '−₱1,500.00')
    assert.equal(formatSignedPeso(0), '₱0.00')
  })
})
