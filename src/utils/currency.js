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
