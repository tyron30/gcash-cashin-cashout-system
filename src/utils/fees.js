// Fee table logic. The same rule is used by the database (which is the one that
// really decides the fee). This copy only lets the screen SHOW the fee before saving.
//
// A tier is { maxAmount, feeAmount } and means "amounts up to maxAmount pay this fee".
// A tier starts just above the previous tier's limit, so there are no gaps or overlaps:
//   up to 100 -> 10, up to 500 -> 15   means   1-100 = 10, 101-500 = 15.

import { parseMoney } from './validation'

export const MAX_TIERS = 50
export const MAX_FEE_VALUE = 999999.99

const toCentavos = (value) => Math.round(Number(value) * 100)
const round2 = (value) => Math.round(value * 100) / 100

export function sortTiers(tiers) {
  return [...tiers].sort((a, b) => toCentavos(a.maxAmount) - toCentavos(b.maxAmount))
}

// What does this amount cost? hasTiers=false means the owner has not set up any fees.
export function calculateFee(tiers, amount) {
  if (!tiers || tiers.length === 0) return { fee: 0, hasTiers: false, matched: false }

  const sorted = sortTiers(tiers)
  const cents = toCentavos(amount)
  const tier = sorted.find((item) => toCentavos(item.maxAmount) >= cents)

  if (!tier) {
    // Above the highest tier: no fee is defined for this amount.
    return { fee: 0, hasTiers: true, matched: false, highest: sorted[sorted.length - 1].maxAmount }
  }
  return { fee: Number(tier.feeAmount), hasTiers: true, matched: true, tier }
}

// amount + fee, with no floating-point drift (500 + 15 = 515).
export function totalWithFee(amount, fee) {
  return (toCentavos(amount) + toCentavos(fee)) / 100
}

// Turns "up to" limits into readable ranges: [{ from: 1, to: 100, fee: 10 }, { from: 101, to: 500, fee: 15 }]
export function describeTiers(tiers) {
  let previous = null
  return sortTiers(tiers).map((tier) => {
    const max = Number(tier.maxAmount)
    const from =
      previous === null
        ? max < 1
          ? 0.01
          : 1
        : round2(previous + (Number.isInteger(previous) ? 1 : 0.01))
    previous = max
    return { from, to: max, fee: Number(tier.feeAmount) }
  })
}

// Checks the rows typed on the Fees page. Rows are { maxAmount: '100', feeAmount: '10' } (text).
export function validateTierRows(rows) {
  const errors = rows.map(() => ({}))
  let formError = ''
  if (rows.length > MAX_TIERS) formError = `You can have at most ${MAX_TIERS} tiers.`

  const seen = new Set()
  rows.forEach((row, index) => {
    const maxText = String(row.maxAmount ?? '').trim()
    const feeText = String(row.feeAmount ?? '').trim()
    const max = parseMoney(maxText)
    const fee = parseMoney(feeText)

    if (!maxText) errors[index].maxAmount = 'Enter the highest amount for this tier.'
    else if (Number.isNaN(max)) errors[index].maxAmount = 'Enter a valid peso amount (up to 2 decimals).'
    else if (max <= 0) errors[index].maxAmount = 'Must be more than zero.'
    else if (max > MAX_FEE_VALUE) errors[index].maxAmount = 'That amount is too large.'
    else if (seen.has(toCentavos(max))) errors[index].maxAmount = 'Another tier already ends at this amount.'
    else seen.add(toCentavos(max))

    if (!feeText) errors[index].feeAmount = 'Enter the fee (0 for no fee).'
    else if (Number.isNaN(fee)) errors[index].feeAmount = 'Enter a valid peso amount.'
    else if (fee > MAX_FEE_VALUE) errors[index].feeAmount = 'That fee is too large.'
  })

  const ok = !formError && errors.every((e) => !e.maxAmount && !e.feeAmount)
  const parsed = ok
    ? sortTiers(rows.map((row) => ({ maxAmount: parseMoney(row.maxAmount), feeAmount: parseMoney(row.feeAmount) })))
    : []
  return { ok, errors, formError, parsed }
}
