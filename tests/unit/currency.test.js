import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatPeso, formatPesoCompact, formatSignedPeso } from '../../src/utils/currency.js'

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

describe('compact peso for lists', () => {
  it('whole pesos have no decimals (like the reference app)', () => {
    assert.equal(formatPesoCompact(3000), '₱3,000')
    assert.equal(formatPesoCompact(60), '₱60')
    assert.equal(formatPesoCompact(0), '₱0')
  })
  it('centavos are never hidden', () => {
    assert.equal(formatPesoCompact(1500.5), '₱1,500.50')
    assert.equal(formatPesoCompact(0.01), '₱0.01')
  })
  it('never shows NaN', () => {
    assert.equal(formatPesoCompact(NaN), '₱0')
    assert.equal(formatPesoCompact(undefined), '₱0')
  })
})
