import { useState } from 'react'
import ErrorState from '../components/common/ErrorState'
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton'
import DateSelector from '../components/dashboard/DateSelector'
import QuickActions from '../components/dashboard/QuickActions'
import RecentTransactions from '../components/dashboard/RecentTransactions'
import SummaryCards from '../components/dashboard/SummaryCards'
import { useAuth } from '../hooks/useAuth'
import { useDashboardData } from '../hooks/useDashboardData'
import { formatBusinessDate, getTodayInManila } from '../utils/date'

export default function DashboardPage() {
  const { isAdmin } = useAuth()
  const today = getTodayInManila()
  const [businessDate, setBusinessDate] = useState(today)
  const { data, loading, error, refresh } = useDashboardData(businessDate)

  const isToday = businessDate === today

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {formatBusinessDate(businessDate)}
          </p>
        </div>
        {isToday ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Today
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setBusinessDate(today)}
            className="min-h-11 rounded-xl px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            Back to today
          </button>
        )}
      </div>

      {isAdmin ? (
        <DateSelector value={businessDate} onChange={setBusinessDate} maxDate={today} />
      ) : (
        <p className="text-sm text-slate-600">Staff accounts see today&apos;s totals.</p>
      )}

      <QuickActions />

      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : loading || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <SummaryCards totals={data.totals} isToday={isToday} />
          <RecentTransactions transactions={data.recentTransactions} />
        </>
      )}
    </div>
  )
}
