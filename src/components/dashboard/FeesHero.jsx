import { formatPeso } from '../../utils/currency'
import { formatMediumDate } from '../../utils/date'

// The big "Fees today" card at the top of the dashboard.
export default function FeesHero({ feeTotal, count, date, isToday }) {
  return (
    <section
      aria-label={isToday ? 'Fees today' : 'Fees collected'}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600">{isToday ? 'Fees today' : 'Fees collected'}</p>
        <p className="text-sm font-medium text-slate-600">{formatMediumDate(date)}</p>
      </div>
      <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-emerald-700">{formatPeso(feeTotal)}</p>
      <p className="mt-0.5 text-sm text-slate-600">
        Service charges from {count} {count === 1 ? 'transaction' : 'transactions'}. Not your net profit.
      </p>
    </section>
  )
}
