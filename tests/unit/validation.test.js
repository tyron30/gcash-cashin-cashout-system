import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cleanText,
  normalizeReference,
  parseMoney,
  referenceKey,
  validateAmount,
  validateDateTime,
  validateName,
  validateNotes,
  validateOptionalMoney,
  validateReason,
  validateReference,
} from '../../src/utils/validation.js'
import { addDays, getManilaNowParts } from '../../src/utils/date.js'

describe('reference numbers', () => {
  it('keeps leading zeros (stored as text) and formats 13 digits GCash-style', () => {
    assert.equal(normalizeReference('0143872590316'), '0143 872 590316')
    assert.equal(normalizeReference('  0143   872 590316 '), '0143 872 590316')
  })
  it('leaves other lengths alone', () => {
    assert.equal(normalizeReference('12345678'), '12345678')
  })
  it('referenceKey ignores spaces and case', () => {
    assert.equal(referenceKey('0143 872 590316'), '0143872590316')
    assert.equal(referenceKey('ab12 cd34'), 'AB12CD34')
  })
  it('accepts valid references', () => {
    assert.equal(validateReference('0143 872 590316'), '')
    assert.equal(validateReference('ABCDEFGH'), '')
  })
  it('rejects empty, too short, too long', () => {
    assert.notEqual(validateReference(''), '')
    assert.notEqual(validateReference('   '), '')
    assert.notEqual(validateReference('1234567'), '')
    assert.notEqual(validateReference('1'.repeat(21)), '')
  })
  it('rejects formulas and markup', () => {
    for (const bad of ['=1+1+1+1+1', '@SUM(A1:A9)', '<script>alert(1)</script>', "1234'; DROP TABLE"]) {
      assert.notEqual(validateReference(bad), '', bad)
    }
  })
})

describe('amounts', () => {
  it('accepts normal peso amounts', () => {
    for (const ok of ['1', '1500', '1,500.50', '₱1,500', '0.01', '999999.99', ' 250 ']) {
      assert.equal(validateAmount(ok), '', ok)
    }
  })
  it('rejects zero, negative, empty, and non-numbers', () => {
    for (const bad of ['', '0', '0.00', '-5', '-0.01', 'abc', '1e5', '1,5,0.0.0', '12.', '.5']) {
      assert.notEqual(validateAmount(bad), '', `"${bad}" should be rejected`)
    }
  })
  it('rejects more than 2 decimals and amounts above the limit', () => {
    assert.notEqual(validateAmount('10.123'), '')
    assert.notEqual(validateAmount('1000000'), '')
  })
  it('rejects non-ASCII digits', () => {
    assert.notEqual(validateAmount('١٢٣'), '')
  })
  it('parseMoney returns numbers or NaN', () => {
    assert.equal(parseMoney('1,500.50'), 1500.5)
    assert.equal(parseMoney('₱ 20'), 20)
    assert.ok(Number.isNaN(parseMoney('x')))
  })
  it('optional money allows blank and zero, not negatives', () => {
    assert.equal(validateOptionalMoney('', 'Cash'), '')
    assert.equal(validateOptionalMoney('0', 'Cash'), '')
    assert.notEqual(validateOptionalMoney('-1', 'Cash'), '')
    assert.notEqual(validateOptionalMoney('abc', 'Cash'), '')
  })
})

describe('names and notes', () => {
  it('names are optional and may be masked', () => {
    assert.equal(validateName(''), '')
    assert.equal(validateName('   '), '')
    assert.equal(validateName('JU**** DE**'), '')
    assert.equal(validateName('Ñoño Peña-Reyes'), '')
    assert.equal(validateName("O'Brien, Jr."), '')
  })
  it('rejects digits, symbols, formulas, and long names', () => {
    for (const bad of ['Bob123', '=cmd|calc', '<b>x</b>', 'A'.repeat(61)]) {
      assert.notEqual(validateName(bad), '', bad)
    }
  })
  it('notes have a length limit', () => {
    assert.equal(validateNotes(''), '')
    assert.equal(validateNotes('x'.repeat(200)), '')
    assert.notEqual(validateNotes('x'.repeat(201)), '')
  })
  it('cleanText trims and collapses whitespace', () => {
    assert.equal(cleanText('  a \n  b\t c '), 'a b c')
  })
})

describe('date, time, reason', () => {
  it('rejects the future and accepts the past (Manila time)', () => {
    const now = getManilaNowParts()
    assert.notEqual(validateDateTime(addDays(now.date, 1), '09:00'), '')
    assert.equal(validateDateTime(addDays(now.date, -1), '09:00'), '')
  })
  it('rejects blank or malformed values', () => {
    assert.notEqual(validateDateTime('', ''), '')
    assert.notEqual(validateDateTime('2026-1-1', '9:00'), '')
  })
  it('reasons need at least 5 characters', () => {
    assert.notEqual(validateReason('abc'), '')
    assert.notEqual(validateReason('     '), '')
    assert.equal(validateReason('Wrong amount'), '')
  })
})
