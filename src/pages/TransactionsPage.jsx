import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchX, Inbox } from 'lucide-react'
import Button from '../components/common/Button'
import EmptyState from '../components/common/EmptyState'
import ErrorState from '../components/common/ErrorState'
import Pagination from '../components/common/Pagination'
import Skeleton from '../components/common/Skeleton'
import TransactionFilters from '../components/transactions/TransactionFilters'
import TransactionList from '../components/transactions/TransactionList'
import { useAsyncData } from '../hooks/useAsyncData'
import { useAuth } from '../hooks/useAuth'
import { listStaffMembers, listTransactions, PAGE_SIZE } from '../services/transactionService'
import { formatPeso } from '../utils/currency'
import { getTodayInManila } from '../utils/date'

export default function TransactionsPage() {
  const { profile, isAdmin } = useAuth()
  const today = getTodayInManila()
  const [params, setParams] = useSearchParams()

  // Filters live in the web address, so Back from a record keeps your filters.
  const filters = {
    search: params.get('q') ?? '',
    type: params.get('type') ?? 'all',
    status: params.get('status') ?? 'all',
    staff: params.get('staff') ?? 'all',
    sort: params.get('sort') ?? 'newest',
    dateFrom: isAdmin ? (params.get('from') ?? today) : today,
    dateTo: isAdmin ? (params.get('to') ?? today) : today,
    page: Number(params.get('page')) || 1,
  }

  const KEYS = { search: 'q', dateFrom: 'from', dateTo: 'to' }
  const defaults = { type: 'all', status: 'all', staff: 'all', sort: 'newest', dateFrom: today, dateTo: today, search: '' }

  const updateFilters = useCallback(
    (patch) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          Object.entries(patch).forEach(([key, value]) => {
            const paramName = KEYS[key] ?? key
            if (value === undefined || value === null || value === '' || value === defaults[key]) {
              next.delete(paramName)
            } else {
              next.set(paramName, String(value))
            }
          })
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams, today],
  )

  // Wait a moment after typing before searching.
  const [searchText, setSearchText] = useState(filters.search)
  useEffect(() => {
    if (searchText.trim() === filters.search) return undefined
    const timer = setTimeout(() => updateFilters({ search: searchText.trim() }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText])

  const { data: staffOptions } = useAsyncData(
    () => (isAdmin ? listStaffMembers() : Promise.resolve([])),
    [isAdmin],
  )

  const queryKey = JSON.stringify(filters)
  const { data, loading, error, reload } = useAsyncData(
    () => listTransactions({ ...filters, pageSize: PAGE_SIZE }, profile),
    [queryKey, profile.id],
  )

  const activeCount =
    (filters.type !== 'all' ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.staff !== 'all' ? 1 : 0) +
    (isAdmin && (filters.dateFrom !== today || filters.dateTo !== today) ? 1 : 0)

  function clearAll() {
    setSearchText('')
    setParams({}, { replace: true })
  }

  const hasCriteria = activeCount > 0 || filters.search !== ''

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Transaction history</h1>
        <p className="mt-0.5 text-sm text-slate-600">Search, filter, and review records.</p>
      </div>

      <TransactionFilters
        filters={filters}
        searchText={searchText}
        onSearchText={setSearchText}
        onChange={updateFilters}
        onClear={clearAll}
        activeCount={activeCount}
        isAdmin={isAdmin}
        today={today}
        staffOptions={staffOptions ?? []}
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <div className="space-y-2" aria-busy="true">
          <span className="sr-only" role="status">
            Loading transactions…
          </span>
          {[0, 1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-16" />
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-700" aria-live="polite">
            <span className="font-semibold">{data.total}</span> {data.total === 1 ? 'record' : 'records'} · Cash In{' '}
            <span className="font-semibold tabular-nums">{formatPeso(data.summary.cashInTotal)}</span> · Cash Out{' '}
            <span className="font-semibold tabular-nums">{formatPeso(data.summary.cashOutTotal)}</span> · Fees{' '}
            <span className="font-semibold tabular-nums">{formatPeso(data.summary.feeTotal)}</span>{' '}
            <span className="text-slate-500">(voided not counted)</span>
          </p>

          <div
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity ${
              loading ? 'opacity-60' : ''
            }`}
          >
            {data.total === 0 ? (
              hasCriteria ? (
                <div>
                  <EmptyState
                    icon={SearchX}
                    title="No matching transactions"
                    description="Try a different search or change the filters."
                  />
                  <div className="flex justify-center pb-8">
                    <Button variant="secondary" onClick={clearAll}>
                      Clear filters
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Inbox}
                  title="No transactions yet"
                  description="Records saved on this date will appear here."
                />
              )
            ) : (
              <TransactionList transactions={data.items} showDate />
            )}
          </div>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
            onChange={(page) => updateFilters({ page })}
          />
        </>
      )}
    </div>
  )
}
