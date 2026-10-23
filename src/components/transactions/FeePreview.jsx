import { TriangleAlert } from 'lucide-react'
import { formatPeso } from '../../utils/currency'
import { totalWithFee } from '../../utils/fees'

// Shows the staff what to collect: amount + fee = total. Hidden if the owner has no fees set up.
export default function FeePreview({ amount, info }) {
  if (!info || !info.hasTiers) return null
  const total = totalWithFee(amount, info.fee)

  return (
    <div aria-live="polite" className="space-y-2">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-700">Amount</dt>
            <dd className="font-semibold tabular-nums">{formatPeso(amount)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-700">Fee</dt>
            <dd className="font-semibold tabular-nums">{formatPeso(info.fee)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-emerald-200 pt-1.5">
            <dt className="font-semibold text-emerald-900">Customer pays</dt>
            <dd className="text-xl font-bold tabular-nums text-emerald-900">{formatPeso(total)}</dd>
          </div>
        </dl>
      </div>
      {!info.matched && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-100 px-3 py-2.5 text-sm font-medium text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          No fee is set for amounts above {formatPeso(info.highest)}, so no fee is added. Ask the owner to add a tier.
        </p>
      )}
    </div>
  )
}
