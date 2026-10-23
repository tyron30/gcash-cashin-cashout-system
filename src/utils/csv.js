import { formatPeso } from './currency'
import { formatTime } from './date'

// Spreadsheet programs run text that starts with = + - @ as a formula.
// A leading apostrophe makes them treat it as plain text instead.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r']

export function sanitizeText(value) {
  const text = String(value ?? '')
  return FORMULA_TRIGGERS.some((char) => text.startsWith(char)) ? `'${text}` : text
}

function quote(cell) {
  const text = String(cell ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const toRow = (cells) => cells.map(quote).join(',')

// Excel turns long digit strings into 1.23E+12 and drops leading zeros.
// Wrapping pure digits as ="..." keeps them as exact text.
function referenceCell(reference) {
  const text = String(reference ?? '')
  return /^\d+$/.test(text) ? `="${text}"` : sanitizeText(text)
}

const money = (value) => Number(value).toFixed(2)

export function buildTransactionsCsv({
  storeName,
  dateFrom,
  dateTo,
  typeLabel,
  generatedLabel,
  transactions,
  totals,
}) {
  const lines = []
  const meta = (key, value) => lines.push(toRow([sanitizeText(key), sanitizeText(value)]))

  meta('Store', storeName)
  meta('Report', 'GCash Cash-In / Cash-Out Transactions')
  meta('Date range', dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`)
  meta('Type', typeLabel)
  meta('Generated', generatedLabel)
  meta('Currency', 'PHP (Philippine peso)')
  meta('Note', 'Voided transactions are listed but NOT counted in totals.')
  lines.push('')

  lines.push(
    toRow([
      'Business Date',
      'Time',
      'Reference Number',
      'Type',
      'Amount (PHP)',
      'Fee (PHP)',
      'Total Paid (PHP)',
      'Sender / Receiver',
      'Staff',
      'Status',
      'Counted in Totals',
      'Notes',
      'Void Reason',
    ]),
  )

  for (const t of transactions) {
    const voided = t.status === 'voided'
    lines.push(
      toRow([
        t.businessDate,
        formatTime(t.transactionTimestamp),
        referenceCell(t.referenceNumber),
        t.type === 'cash_in' ? 'Cash In' : 'Cash Out',
        money(t.amount),
        money(t.feeAmount ?? 0),
        money(t.totalAmount ?? Number(t.amount) + Number(t.feeAmount ?? 0)),
        sanitizeText(t.name),
        sanitizeText(t.staffName),
        voided ? 'Voided' : 'Completed',
        voided ? 'No' : 'Yes',
        sanitizeText(t.notes),
        sanitizeText(t.voidReason),
      ]),
    )
  }

  lines.push('')
  lines.push(toRow(['Summary (valid transactions only)']))
  lines.push(toRow(['Total Cash In (PHP)', money(totals.cashInTotal)]))
  lines.push(toRow(['Total Cash Out (PHP)', money(totals.cashOutTotal)]))
  lines.push(toRow(['Combined Transaction Volume (PHP)', money(totals.volume)]))
  lines.push(toRow(['Net Cash Movement (PHP)', money(totals.netMovement)]))
  lines.push(toRow(['Total Fees Collected (PHP)', money(totals.feeTotal ?? 0)]))
  lines.push(toRow(['Cash-In Count', totals.cashInCount]))
  lines.push(toRow(['Cash-Out Count', totals.cashOutCount]))
  lines.push(toRow(['Valid Transactions', totals.validCount]))
  lines.push(toRow(['Voided Transactions', totals.voidedCount]))
  lines.push(
    toRow([
      'Reminder',
      `Net cash movement (${formatPeso(totals.netMovement)}) is not your cash on hand or profit.`,
    ]),
  )

  // BOM (\uFEFF) makes Excel read the file as UTF-8, so the peso sign shows correctly.
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
