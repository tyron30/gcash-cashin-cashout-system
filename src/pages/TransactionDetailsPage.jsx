import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Lock, Pencil } from 'lucide-react'
import Button from '../components/common/Button'
import ErrorState from '../components/common/ErrorState'
import Skeleton from '../components/common/Skeleton'
import EditTransactionModal from '../components/transactions/EditTransactionModal'
import HistoryTimeline from '../components/transactions/HistoryTimeline'
import StatusBadge from '../components/transactions/StatusBadge'
import TransactionTypeBadge from '../components/transactions/TransactionTypeBadge'
import VoidTransactionModal from '../components/transactions/VoidTransactionModal'
import { useAsyncData } from '../hooks/useAsyncData'
import { useAuth } from '../hooks/useAuth'
import { getTransaction } from '../services/transactionService'
import { formatPeso } from '../utils/currency'
import { formatBusinessDate, formatDateTime } from '../utils/date'

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
      <dt className="text-sm text-slate-600 sm:w-44 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium">{children}</dd>
    </div>
  )
}

export default function TransactionDetailsPage() {
  const { id } = useParams()
  const { profile, isAdmin } = useAuth()
  const [modal, setModal] = useState(null) // 'edit' | 'void' | null

  const { data, loading, error, reload } = useAsyncData(() => getTransaction(id, profile), [id, profile.id])

  const back = (
    <Link
      to="/transactions"
      className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      History
    </Link>
  )

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        {back}
        <ErrorState message={error} onRetry={reload} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl space-y-3" aria-busy="true">
        {back}
        <span className="sr-only" role="status">
          Loading transaction…
        </span>
        <Skeleton className="h-28" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  const isVoided = data.status === 'voided'

  function done() {
    setModal(null)
    reload()
  }

  return (
    <div className={`mx-auto max-w-2xl space-y-4 ${loading ? 'opacity-70' : ''}`}>
      {back}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <TransactionTypeBadge type={data.type} />
          <StatusBadge status={data.status} />
        </div>
        <p className={`mt-3 text-3xl font-bold tabular-nums ${isVoided ? 'text-slate-500 line-through' : ''}`}>
          {formatPeso(data.amount)}
        </p>
        {data.referenceNumber && <p className="mt-1 font-mono text-sm text-slate-600">{data.referenceNumber}</p>}
      </div>

      {isVoided && (
        <div role="note" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">This transaction was voided and is not counted in totals.</p>
          <p className="mt-0.5">Reason: {data.voidReason}</p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white px-5 shadow-sm">
        <dl className="divide-y divide-slate-100">
          <Row label="Sender / receiver">
            {data.name || <span className="font-normal italic text-slate-500">No name</span>}
          </Row>
          <Row label="Date and time">{formatDateTime(data.transactionTimestamp)}</Row>
          <Row label="Business date">{formatBusinessDate(data.businessDate)}</Row>
          <Row label="Recorded by">{data.staffName}</Row>
          <Row label="Notes">{data.notes || <span className="font-normal text-slate-500">None</span>}</Row>
          <Row label="Saved at">{formatDateTime(data.createdAt)}</Row>
          <Row label="Last updated">{formatDateTime(data.updatedAt)}</Row>
        </dl>
      </div>

      {isAdmin ? (
        <div className="space-y-3">
          {data.dayClosed && (
            <p className="flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-700">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              This business date is closed. Reopen it in Daily Closing to edit or void this record.
            </p>
          )}
          {!isVoided && (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" disabled={data.dayClosed} onClick={() => setModal('edit')} className="min-h-12">
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
              <Button variant="danger" disabled={data.dayClosed} onClick={() => setModal('void')} className="min-h-12">
                <Ban className="size-4" aria-hidden="true" />
                Void
              </Button>
            </div>
          )}
        </div>
      ) : (
        !isVoided && (
          <p className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-700">
            Made a mistake? Ask the owner to correct or void this record.
          </p>
        )
      )}

      {isAdmin && (
        <section aria-labelledby="history-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="history-heading" className="mb-4 text-base font-bold">
            Change history
          </h2>
          <HistoryTimeline entries={data.history} />
        </section>
      )}

      {modal === 'edit' && <EditTransactionModal transaction={data} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'void' && <VoidTransactionModal transaction={data} onClose={() => setModal(null)} onDone={done} />}
    </div>
  )
}
