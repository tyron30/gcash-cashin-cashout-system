import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addDays,
  eachDate,
  formatBusinessDate,
  formatShortDate,
  formatTime,
  getBusinessDateFromTimestamp,
  getMonthStart,
  getTimestampParts,
  toManilaTimestamp,
} from '../../src/utils/date.js'

describe('business date (Asia/Manila, UTC+8, midnight boundaries)', () => {
  it('11:30 pm Manila is still that Manila day', () => {
    assert.equal(getBusinessDateFromTimestamp('2026-01-01T15:30:00Z'), '2026-01-01')
  })
  it('12:30 am Manila is the NEXT day, even though UTC is still the previous day', () => {
    assert.equal(getBusinessDateFromTimestamp('2026-01-01T16:30:00Z'), '2026-01-02')
  })
  it('exact midnight boundary', () => {
    assert.equal(getBusinessDateFromTimestamp('2025-12-31T16:00:00Z'), '2026-01-01')
    assert.equal(getBusinessDateFromTimestamp('2025-12-31T15:59:59Z'), '2025-12-31')
  })
  it('works across leap day and year end', () => {
    assert.equal(getBusinessDateFromTimestamp('2028-02-29T15:59:59Z'), '2028-02-29')
    assert.equal(getBusinessDateFromTimestamp('2028-02-29T16:00:00Z'), '2028-03-01')
  })
  it('the browser time zone does not matter (explicit +08:00 offsets)', () => {
    assert.equal(getBusinessDateFromTimestamp('2026-06-15T23:59:00+08:00'), '2026-06-15')
    assert.equal(getBusinessDateFromTimestamp('2026-06-16T00:00:00+08:00'), '2026-06-16')
  })
  it('Manila has no daylight saving: same offset in January and July', () => {
    assert.equal(getBusinessDateFromTimestamp('2026-07-01T16:00:00Z'), '2026-07-02')
    assert.equal(getBusinessDateFromTimestamp('2026-01-01T16:00:00Z'), '2026-01-02')
  })
})

describe('date helpers', () => {
  it('addDays handles month, year and leap years', () => {
    assert.equal(addDays('2026-02-28', 1), '2026-03-01')
    assert.equal(addDays('2028-02-28', 1), '2028-02-29')
    assert.equal(addDays('2026-12-31', 1), '2027-01-01')
    assert.equal(addDays('2026-03-01', -1), '2026-02-28')
    assert.equal(addDays('2026-10-13', 0), '2026-10-13')
  })
  it('eachDate is inclusive and empty when the range is backwards', () => {
    assert.deepEqual(eachDate('2026-10-01', '2026-10-03'), ['2026-10-01', '2026-10-02', '2026-10-03'])
    assert.deepEqual(eachDate('2026-10-03', '2026-10-01'), [])
    assert.equal(eachDate('2026-10-13', '2026-10-13').length, 1)
  })
  it('toManilaTimestamp is the right instant', () => {
    assert.equal(new Date(toManilaTimestamp('2026-10-13', '09:12')).toISOString(), '2026-10-13T01:12:00.000Z')
    assert.equal(new Date(toManilaTimestamp('2026-10-13', '00:00')).toISOString(), '2026-10-12T16:00:00.000Z')
  })
  it('getTimestampParts splits an instant into Manila date and time', () => {
    assert.deepEqual(getTimestampParts('2026-01-01T16:30:00Z'), { date: '2026-01-02', time: '00:30' })
    assert.deepEqual(getTimestampParts('2026-10-13T01:12:34Z'), { date: '2026-10-13', time: '09:12' })
  })
  it('formats for display in Manila time', () => {
    assert.match(formatTime('2026-01-01T16:30:00Z'), /12:30\s?am/i)
    assert.match(formatBusinessDate('2026-10-13'), /October/)
    assert.match(formatBusinessDate('2026-10-13'), /13/)
    assert.match(formatShortDate('2026-10-13'), /Oct/)
  })
  it('getMonthStart', () => {
    assert.equal(getMonthStart('2026-10-13'), '2026-10-01')
  })
})
