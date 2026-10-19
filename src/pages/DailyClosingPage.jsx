import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Inbox, Printer } from 'lucide-react'
import Button from '../components/common/Button'
import EmptyState from '../components/common/EmptyState'
import ErrorState from '../components/common/ErrorState'
import PrintHeader from '../components/common/PrintHeader'
import Skeleton from '../components/common/Skeleton'
import DateSelector from '../components/dashboard/DateSelector'
import SummaryCards from '../components/dashboard/SummaryCards'
import ClosingForm from '../components/reports/ClosingForm'
import StaffBreakdown from '../components/reports/StaffBreakdown'
import TransactionList from '../components/transactions/TransactionList'
import { useAsyncData } from '../hooks/useAsyncData'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { getDailyReport, reopenDay, saveClosing } from '../services/reportService'
import { formatBusinessDate, formatDateTime, getTodayInManila } from '../utils/date'

const ACTION_LABELS = {
  draft_saved: 'Draft saved',
  closed: 'Day closed',
  reopened: 'Day reopened',
}

export default function DailyClosingPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const today = getTodayInManila()
  const [params, setParams] = useSearchParams()
  const requested = params.get('date')
  const businessDate = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today
  const [saving, setSaving] = useState(false)

  const { data, loading, error, reload } = useAsyncData(
    () => getDailyReport(businessDate, profile),
    [businessDate, profile.id],
  )

  function setDate(date) {
    setParams(date === today ? {} : { date }, { replace: true })
  }

  async function run(action, successMessage) {
    setSaving(true)
    try {
      await action()
      toast.success(successMessage)
      reload()
      return true
    } catch (caught) {
      toast.error(caught.message || 'Something went wrong. Nothing was changed.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const closing = data?.closing

  return (
    <div className="space-y-5">
      <PrintHeader title="Daily Closing Report" subtitle={formatBusinessDate(businessDate)} />

      <div className="no-print flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Daily closing</h1>
          <p className="mt-0.5 text-sm text-slate-600">{formatBusinessDate(businessDate)}</p>
        </div>
        <Button variant="secondary" onClick={() => window.print()} disabled={!data} className="shrink-0">
          <Printer className="size-4" aria-hidden="true" />
          Print
        </Button>
      </div>

      <div className="no-print">
        <DateSelector value={businessDate} onChange={setDate} maxDate={today} />
      </div>

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
        <div className={`space-y-5 ${loading ? 'opacity-70' : ''}`}>
          <SummaryCards totals={data.totals} isToday={businessDate === today} />

          <ClosingForm
            key={`${businessDate}-${closing.updatedAt}`}
            closing={closing}
            saving={saving}
            onSaveDraft={(values) => run(() => saveClosing(businessDate, values, profile), 'Draft saved.')}
            onCloseDay={(values) =>
              run(() => saveClosing(businessDate, values, profile, { close: true }), 'Day closed.')
            }
            onReopen={(reason) => run(() => reopenDay(businessDate, reason, profile), 'Day reopened. The change was recorded.')}
          />

          <StaffBreakdown byStaff={data.byStaff} />

          <section aria-labelledby="breakdown-heading">
            <h2 id="breakdown-heading" className="mb-3 text-base font-bold">
              Transactions included ({data.totals.validCount})
            </h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {data.transactions.length === 0 ? (
                <EmptyState icon={Inbox} title="No transactions on this date" />
              ) : (
                <TransactionList transactions={data.transactions} />
              )}
            </div>
            {data.totals.voidedCount > 0 && (
              <p className="mt-2 text-xs text-slate-600">
                {data.totals.voidedCount} voided {data.totals.voidedCount === 1 ? 'record is' : 'records are'} listed for
                reference and not counted in the totals.
              </p>
            )}
          </section>

          {closing.history.length > 0 && (
            <section aria-labelledby="closing-history-heading" className="no-print">
              <h2 id="closing-history-heading" className="mb-3 text-base font-bold">
                Closing history
              </h2>
              <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
                {[...closing.history].reverse().map((entry) => (
                  <li key={entry.id}>
                    <span className="font-semibold">{ACTION_LABELS[entry.action] ?? entry.action}</span> by {entry.by} ·{' '}
                    <span className="text-slate-600">{formatDateTime(entry.at)}</span>
                    {entry.action === 'reopened' && <span className="block text-slate-700">Reason: {entry.note}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="print-only mt-10 grid grid-cols-2 gap-10 text-sm">
            <p className="border-t border-slate-500 pt-1">Prepared by</p>
            <p className="border-t border-slate-500 pt-1">Checked by (owner)</p>
          </div>
        </div>
      )}
    </div>
  )
}
