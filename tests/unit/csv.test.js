import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildTransactionsCsv, sanitizeText } from '../../src/utils/csv.js'
import { buildTotals } from '../../src/utils/calculations.js'

const totals = buildTotals({ cashInTotal: 1500.5, cashOutTotal: 0, cashInCount: 1, cashOutCount: 0, voidedCount: 1 })

function make(overrides = {}) {
  return {
    businessDate: '2026-10-13',
    transactionTimestamp: '2026-10-13T01:12:00Z',
    referenceNumber: '0143872590316',
    type: 'cash_in',
    amount: 1500.5,
    name: 'JU**** DE**',
    staffName: 'Ana Reyes',
    status: 'completed',
    notes: null,
    voidReason: null,
    ...overrides,
  }
}

const build = (transactions) =>
  buildTransactionsCsv({
    storeName: 'Demo Store',
    dateFrom: '2026-10-13',
    dateTo: '2026-10-13',
    typeLabel: 'All types',
    generatedLabel: 'now',
    transactions,
    totals,
  })

describe('CSV formula injection protection', () => {
  it('neutralizes values that start with = + - @ tab or CR', () => {
    for (const evil of ['=1+1', '+1', '-1', '@SUM(A1)', '\t=1', '\r=1']) {
      assert.ok(sanitizeText(evil).startsWith("'"), JSON.stringify(evil))
    }
  })
  it('leaves normal text alone', () => {
    assert.equal(sanitizeText('JU**** DE**'), 'JU**** DE**')
    assert.equal(sanitizeText('Ana Reyes'), 'Ana Reyes')
    assert.equal(sanitizeText(null), '')
  })
  it('protects names, notes, staff and void reasons inside the file', () => {
    const csv = build([
      make({
        name: '=HYPERLINK("http://evil","click")',
        notes: '@cmd',
        staffName: '+Evil',
        status: 'voided',
        voidReason: '-2+3',
      }),
    ])
    assert.ok(!/(^|,)=HYPERLINK/m.test(csv), 'name must not start with =')
    assert.ok(csv.includes(`"'=HYPERLINK(""http://evil"",""click"")"`))
    assert.ok(csv.includes("'@cmd"))
    assert.ok(csv.includes("'+Evil"))
    assert.ok(csv.includes("'-2+3"))
  })
})

describe('CSV format for Excel', () => {
  it('starts with a UTF-8 BOM and uses Windows line endings', () => {
    const csv = build([make()])
    assert.ok(csv.startsWith('\uFEFF'))
    assert.ok(csv.includes('\r\n'))
    assert.ok(!/[^\r]\n/.test(csv.slice(1)), 'every line break must be CRLF')
  })
  it('keeps leading zeros and long reference numbers as exact text', () => {
    const csv = build([make({ referenceNumber: '0143872590316' })])
    assert.ok(csv.includes('"=""0143872590316"""'))
  })
  it('a cash-in has no reference: the cell is simply empty', () => {
    const csv = build([make({ type: 'cash_in', referenceNumber: null })])
    assert.ok(csv.includes('2026-10-13,'))
    assert.ok(/,,Cash In,1500\.50,/.test(csv), 'empty reference column before the type')
    assert.ok(!csv.includes('null') && !csv.includes('undefined'))
  })
  it('spaced references are already text and are not wrapped', () => {
    const csv = build([make({ referenceNumber: '0143 872 590316' })])
    assert.ok(csv.includes('0143 872 590316'))
    assert.ok(!csv.includes('="0143 872'))
  })
  it('amounts have exactly 2 decimals', () => {
    assert.ok(build([make({ amount: 1500.5 })]).includes(',1500.50,'))
  })
  it('quotes commas, quotes and line breaks', () => {
    const csv = build([make({ notes: 'a,b "c"\nline2' })])
    assert.ok(csv.includes('"a,b ""c""\nline2"'))
  })
  it('lists voided records but marks them as NOT counted', () => {
    const csv = build([make({ status: 'voided', voidReason: 'Wrong amount' })])
    assert.ok(csv.includes(',Voided,No,'))
    assert.ok(csv.includes('Wrong amount'))
  })
  it('includes the store, period, generation time and summary totals', () => {
    const csv = build([make()])
    for (const text of ['Store,Demo Store', 'Date range,2026-10-13', 'Generated,now', 'Total Cash In (PHP),1500.50', 'Voided Transactions,1']) {
      assert.ok(csv.includes(text), text)
    }
  })
})
