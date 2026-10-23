import { Link } from 'react-router-dom'
import { formatPeso, formatSignedPeso } from '../../utils/currency'
import { formatShortDate } from '../../utils/date'

function ClosedBadge({ closed }) {
  return closed ? (
    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white">Closed</span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Open</span>
  )
}

export default function RangeBreakdown({ rows }) {
  return (
    <section aria-labelledby="breakdown-heading">
      <h2 id="breakdown-heading" className="mb-3 text-base font-bold">
        Day by day
      </h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100 md:hidden">
          {rows.map((row) => (
            <li key={row.date} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <Link to={`/closing?date=${row.date}`} className="font-semibold text-emerald-700">
                  {formatShortDate(row.date)}
                </Link>
                <ClosedBadge closed={row.closed} />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-slate-600">Cash In ({row.cashInCount})</dt>
                <dd className="text-right font-semibold tabular-nums">{formatPeso(row.cashInTotal)}</dd>
                <dt className="text-slate-600">Cash Out ({row.cashOutCount})</dt>
                <dd className="text-right font-semibold tabular-nums">{formatPeso(row.cashOutTotal)}</dd>
                <dt className="text-slate-600">Volume</dt>
                <dd className="text-right font-semibold tabular-nums">{formatPeso(row.volume)}</dd>
                <dt className="text-slate-600">Fees</dt>
                <dd className="text-right font-semibold tabular-nums">{formatPeso(row.feeTotal)}</dd>
                {row.voidedCount > 0 && (
                  <>
                    <dt className="text-slate-600">Voided</dt>
                    <dd className="text-right tabular-nums">{row.voidedCount}</dd>
                  </>
                )}
              </dl>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Cash In</th>
                <th className="px-4 py-3 text-right">Cash Out</th>
                <th className="px-4 py-3 text-right">Volume</th>
                <th className="px-4 py-3 text-right">Fees</th>
                <th className="px-4 py-3 text-right">Net movement</th>
                <th className="px-4 py-3 text-right">Valid</th>
                <th className="px-4 py-3 text-right">Voided</th>
                <th className="px-4 py-3">Day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.date} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium">
                    <Link to={`/closing?date=${row.date}`} className="text-emerald-700 hover:underline">
                      {formatShortDate(row.date)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatPeso(row.cashInTotal)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatPeso(row.cashOutTotal)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{formatPeso(row.volume)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatPeso(row.feeTotal)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatSignedPeso(row.netMovement)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.validCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.voidedCount}</td>
                  <td className="px-4 py-3">
                    <ClosedBadge closed={row.closed} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
