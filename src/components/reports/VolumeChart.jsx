import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPeso } from '../../utils/currency'
import { formatShortDate } from '../../utils/date'

const compact = (value) => (value >= 1000 ? `₱${Math.round(value / 100) / 10}k` : `₱${value}`)

export default function VolumeChart({ rows }) {
  const data = rows.map((row) => ({
    label: formatShortDate(row.date),
    'Cash In': row.cashInTotal,
    'Cash Out': row.cashOutTotal,
  }))

  return (
    <section
      aria-label="Chart of daily cash-in and cash-out totals"
      className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="mb-3 text-base font-bold">Daily totals</h2>
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={compact} width={52} />
            <Tooltip formatter={(value) => formatPeso(value)} />
            <Legend />
            <Bar dataKey="Cash In" fill="#047857" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Cash Out" fill="#0369a1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-600">Voided transactions are not included.</p>
    </section>
  )
}
