import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

export default function TransactionTypeBadge({ type }) {
  const isCashIn = type === 'cash_in'
  const Icon = isCashIn ? ArrowDownLeft : ArrowUpRight

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isCashIn ? 'bg-emerald-50 text-emerald-800' : 'bg-sky-50 text-sky-800'
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {isCashIn ? 'Cash In' : 'Cash Out'}
    </span>
  )
}
