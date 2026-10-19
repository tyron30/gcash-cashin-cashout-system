import { useState } from 'react'
import { Download, Printer } from 'lucide-react'
import Button from '../components/common/Button'
import ErrorState from '../components/common/ErrorState'
import PrintHeader from '../components/common/PrintHeader'
import Skeleton from '../components/common/Skeleton'
import SummaryCards from '../components/dashboard/SummaryCards'
import { inputClass } from '../components/forms/inputStyles'
import RangeBreakdown from '../components/reports/RangeBreakdown'
import VolumeChart from '../components/reports/VolumeChart'
import { useAsyncData } from '../hooks/useAsyncData'
import { useAuth } from '../hooks/useAuth'
import { useStore } from '../hooks/useStore'
import { useToast } from '../hooks/useToast'
import { getRangeReport } from '../services/reportService'
import { buildTransactionsCsv } from '../utils/csv'
import { addDays, formatDateTime, getMonthStart, getTodayInManila } from '../utils/date'
import { downloadTextFile } from '../utils/download'

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'cash_in', label: 'Cash In only' },
  { value: 'cash_out', label: 'Cash Out only' },
]

export default function ReportsPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { storeName } = useStore()
  const today = getTodayInManila()

  const [dateFrom, setDateFrom] = useState(addDays(today, -6))
  const [dateTo, setDateTo] = useState(today)
  const [type, setType] = useState('all')

  const { data, loading, error, reload } = useAsyncData(
    () => getRangeReport({ dateFrom, dateTo, type }, profile),
    [dateFrom, dateTo, type, profile.id],
  )

  const presets = [
    { label: 'Today', from: today, to: today },
    { label: 'Yesterday', from: addDays(today, -1), to: addDays(today, -1) },
    { label: 'Last 7 days', from: addDays(today, -6), to: today },
    { label: 'This month', from: getMonthStart(today), to: today },
    { label: 'Last 30 days', from: addDays(today, -29), to: today },
  ]

  const typeLabel = TYPE_OPTIONS.find((option) => option.value === type).label

  function exportCsv() {
    if (!data) return
    const csv = buildTransactionsCsv({
      storeName,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      typeLabel,
      generatedLabel: `${formatDateTime(new Date().toISOString())} (Asia/Manila)`,
      transactions: data.transactions,
      totals: data.totals,
    })
    const range = data.dateFrom === data.dateTo ? data.dateFrom : `${data.dateFrom}_to_${data.dateTo}`
    downloadTextFile(`gcash-transactions_${range}.csv`, csv)
    toast.success('CSV file downloaded. Open it with Excel.')
  }

  return (
    <div className="space-y-5">
      <PrintHeader
        title="Transaction Report"
        subtitle={`${dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`} · ${typeLabel}`}
      />

      <div className="no-print">
        <h1 className="text-xl font-bold sm:text-2xl">Reports &amp; export</h1>
        <p className="mt-0.5 text-sm text-slate-600">Review totals for any period and download them.</p>
      </div>

      <section aria-label="Report options" className="no-print space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const selected = dateFrom === preset.from && dateTo === preset.to
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setDateFrom(preset.from)
                  setDateTo(preset.to)
                }}
                className={`min-h-10 rounded-full border px-3.5 text-sm font-semibold ${
                  selected
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="rp-from" className="mb-1 block text-xs font-semibold text-slate-600">
              From
            </label>
            <input
              id="rp-from"
              type="date"
              max={today}
              value={dateFrom}
              onChange={(event) => event.target.value && setDateFrom(event.target.value)}
              className={`${inputClass(false)} min-h-11 text-sm`}
            />
          </div>
          <div>
            <label htmlFor="rp-to" className="mb-1 block text-xs font-semibold text-slate-600">
              To
            </label>
            <input
              id="rp-to"
              type="date"
              max={today}
              value={dateTo}
              onChange={(event) => event.target.value && setDateTo(event.target.value)}
              className={`${inputClass(false)} min-h-11 text-sm`}
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="rp-type" className="mb-1 block text-xs font-semibold text-slate-600">
              Transaction type
            </label>
            <select
              id="rp-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className={`${inputClass(false)} min-h-11 text-sm`}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={exportCsv} disabled={!data || loading || data.transactions.length === 0} className="min-h-12">
            <Download className="size-4" aria-hidden="true" />
            Download CSV (Excel)
          </Button>
          <Button variant="secondary" onClick={() => window.print()} disabled={!data || loading} className="min-h-12">
            <Printer className="size-4" aria-hidden="true" />
            Print report
          </Button>
        </div>
      </section>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only" role="status">
            Loading report…
          </span>
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <SummaryCards totals={data.totals} isToday={false} />
          {data.rows.length > 1 && <VolumeChart rows={data.rows} />}
          <RangeBreakdown rows={data.rows} />
          {data.transactions.length === 0 && (
            <p className="text-sm text-slate-600">No transactions match these options.</p>
          )}
        </div>
      )}
    </div>
  )
}
