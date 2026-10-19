import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ScrollText } from 'lucide-react'
import EmptyState from '../components/common/EmptyState'
import ErrorState from '../components/common/ErrorState'
import PageHeader from '../components/common/PageHeader'
import Pagination from '../components/common/Pagination'
import Skeleton from '../components/common/Skeleton'
import { inputClass } from '../components/forms/inputStyles'
import { useAsyncData } from '../hooks/useAsyncData'
import { listAuditLogs } from '../services/auditService'
import { formatDateTime } from '../utils/date'

const ACTION_LABELS = {
  'transaction.created': 'Transaction recorded',
  'transaction.updated': 'Transaction edited',
  'transaction.voided': 'Transaction voided',
  'closing.draft_saved': 'Closing draft saved',
  'closing.closed': 'Day closed',
  'closing.reopened': 'Day reopened',
  'profile.updated': 'Staff access changed',
  'settings.updated': 'Store settings changed',
}

const ENTITY_OPTIONS = [
  { value: 'all', label: 'Everything' },
  { value: 'transaction', label: 'Transactions' },
  { value: 'daily_closing', label: 'Daily closings' },
  { value: 'profile', label: 'Staff access' },
  { value: 'store_settings', label: 'Store settings' },
]

const label = (key) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

function show(value) {
  if (value === null || value === undefined || value === '') return '(blank)'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value)
  return String(value)
}

function Values({ title, values }) {
  if (!values || Object.keys(values).length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <dl className="mt-1 space-y-0.5 text-sm">
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className="flex flex-wrap gap-x-2">
            <dt className="text-slate-600">{label(key)}:</dt>
            <dd className="min-w-0 break-words font-medium">{show(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default function AuditLogsPage() {
  const [entityType, setEntityType] = useState('all')
  const [page, setPage] = useState(1)

  const { data, loading, error, reload } = useAsyncData(() => listAuditLogs({ entityType, page }), [entityType, page])

  return (
    <div className="space-y-4">
      <PageHeader title="Audit logs" description="A permanent record of important actions. It cannot be edited or deleted." />

      <div className="max-w-xs">
        <label htmlFor="audit-type" className="mb-1 block text-xs font-semibold text-slate-600">
          Show
        </label>
        <select
          id="audit-type"
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value)
            setPage(1)
          }}
          className={`${inputClass(false)} min-h-11 text-sm`}
        >
          {ENTITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <div className="space-y-2" aria-busy="true">
          <span className="sr-only" role="status">
            Loading audit logs…
          </span>
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-16" />
          ))}
        </div>
      ) : (
        <>
          <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${loading ? 'opacity-60' : ''}`}>
            {data.items.length === 0 ? (
              <EmptyState icon={ScrollText} title="Nothing here yet" description="Actions will be listed as they happen." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.items.map((entry) => (
                  <li key={entry.id} className="px-4 py-3">
                    <details>
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                          <span className="block text-xs text-slate-600">
                            {entry.actorName} · {formatDateTime(entry.at)}
                          </span>
                          {entry.reason && <span className="mt-0.5 block text-sm text-slate-700">Reason: {entry.reason}</span>}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-emerald-700">Details</span>
                      </summary>
                      <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                        <Values title="Before" values={entry.previous} />
                        <Values title="After" values={entry.next} />
                        {entry.entityType === 'transaction' && entry.entityId && (
                          <Link to={`/transactions/${entry.entityId}`} className="inline-block text-sm font-semibold text-emerald-700 underline">
                            Open this transaction
                          </Link>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onChange={setPage} />
        </>
      )}
    </div>
  )
}
