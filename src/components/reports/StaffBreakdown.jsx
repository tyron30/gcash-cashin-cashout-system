import { formatPeso } from '../../utils/currency'

export default function StaffBreakdown({ byStaff }) {
  if (byStaff.length === 0) return null

  return (
    <section aria-labelledby="staff-heading">
      <h2 id="staff-heading" className="mb-3 text-base font-bold">
        By staff member
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {byStaff.map((staff) => (
          <div key={staff.staffId ?? staff.staffName} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-semibold">{staff.staffName}</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">Cash In ({staff.cashInCount})</dt>
                <dd className="font-semibold tabular-nums">{formatPeso(staff.cashInTotal)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">Cash Out ({staff.cashOutCount})</dt>
                <dd className="font-semibold tabular-nums">{formatPeso(staff.cashOutTotal)}</dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-slate-100 pt-1">
                <dt className="text-slate-600">Volume</dt>
                <dd className="font-bold tabular-nums">{formatPeso(staff.volume)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">Fees collected</dt>
                <dd className="font-semibold tabular-nums">{formatPeso(staff.feeTotal)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}
