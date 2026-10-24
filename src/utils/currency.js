const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// 1500 -> "₱1,500.00"
export function formatPeso(value) {
  const number = Number(value)
  return pesoFormatter.format(Number.isFinite(number) ? number : 0)
}

// 1500 -> "+₱1,500.00", -1500 -> "−₱1,500.00"
export function formatSignedPeso(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return formatPeso(0)
  const sign = number > 0 ? '+' : '−'
  return `${sign}${formatPeso(Math.abs(number))}`
}

// Compact style used in lists: 3000 -> "₱3,000", 60 -> "₱60", 1500.5 -> "₱1,500.50"
const pesoWholeFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatPesoCompact(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return pesoWholeFormatter.format(0)
  return Number.isInteger(number) ? pesoWholeFormatter.format(number) : formatPeso(number)
}
