const toCentavos = (amount) => Math.round(Number(amount) * 100)

export function calculateDailyTotals(transactions) {
  let cashInCentavos = 0
  let cashOutCentavos = 0
  let cashInCount = 0
  let cashOutCount = 0
  let voidedCount = 0

  for (const transaction of transactions) {
    if (transaction.status === 'voided') {
      voidedCount += 1
      continue
    }
    if (transaction.status !== 'completed') continue

    if (transaction.type === 'cash_in') {
      cashInCentavos += toCentavos(transaction.amount)
      cashInCount += 1
    } else if (transaction.type === 'cash_out') {
      cashOutCentavos += toCentavos(transaction.amount)
      cashOutCount += 1
    }
  }

  return {
    cashInTotal: cashInCentavos / 100,
    cashOutTotal: cashOutCentavos / 100,
    volume: (cashInCentavos + cashOutCentavos) / 100,
    netMovement: (cashInCentavos - cashOutCentavos) / 100,
    cashInCount,
    cashOutCount,
    validCount: cashInCount + cashOutCount,
    voidedCount,
  }
}

// ---------- Added in Phase 2 ----------

// counted - recorded. Positive = overage, negative = shortage.
export function calculateShortageOverage(counted, recorded) {
  if (counted === null || counted === undefined) return null
  if (recorded === null || recorded === undefined) return null
  return (toCentavos(counted) - toCentavos(recorded)) / 100
}

// Totals per staff member (voided records excluded from the money totals).
export function groupTotalsByStaff(transactions) {
  const groups = new Map()
  for (const transaction of transactions) {
    if (!groups.has(transaction.staffName)) groups.set(transaction.staffName, [])
    groups.get(transaction.staffName).push(transaction)
  }
  return [...groups.entries()]
    .map(([staffName, list]) => ({ staffName, ...calculateDailyTotals(list) }))
    .sort((a, b) => b.volume - a.volume)
}

// ---------- Added in Phase 4 ----------

// Builds the totals object from database numbers. Money is added in centavos.
export function buildTotals({ cashInTotal, cashOutTotal, cashInCount, cashOutCount, voidedCount }) {
  const inCentavos = toCentavos(cashInTotal ?? 0)
  const outCentavos = toCentavos(cashOutTotal ?? 0)
  const inCount = Number(cashInCount ?? 0)
  const outCount = Number(cashOutCount ?? 0)
  return {
    cashInTotal: inCentavos / 100,
    cashOutTotal: outCentavos / 100,
    volume: (inCentavos + outCentavos) / 100,
    netMovement: (inCentavos - outCentavos) / 100,
    cashInCount: inCount,
    cashOutCount: outCount,
    validCount: inCount + outCount,
    voidedCount: Number(voidedCount ?? 0),
  }
}

// Adds up several day rows (already in the totals shape) into one total.
export function sumTotals(rows) {
  let inCentavos = 0
  let outCentavos = 0
  let inCount = 0
  let outCount = 0
  let voided = 0
  for (const row of rows) {
    inCentavos += toCentavos(row.cashInTotal)
    outCentavos += toCentavos(row.cashOutTotal)
    inCount += row.cashInCount
    outCount += row.cashOutCount
    voided += row.voidedCount
  }
  return buildTotals({
    cashInTotal: inCentavos / 100,
    cashOutTotal: outCentavos / 100,
    cashInCount: inCount,
    cashOutCount: outCount,
    voidedCount: voided,
  })
}
