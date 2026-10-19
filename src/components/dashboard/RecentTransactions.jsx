import { Link } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import EmptyState from '../common/EmptyState'
import TransactionList from '../transactions/TransactionList'

export default function RecentTransactions({ transactions }) {
  return (
    <section aria-labelledby="recent-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="recent-heading" className="text-base font-bold">
          Recent transactions
        </h2>
        <Link
          to="/transactions"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          View all
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {transactions.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No transactions for this date"
            description="Records you save on this business date will appear here."
          />
        ) : (
          <TransactionList transactions={transactions} />
        )}
      </div>

      {transactions.length > 0 && (
        <p className="mt-2 text-xs text-slate-600">
          Voided transactions are shown here for reference but are excluded from all totals.
        </p>
      )}
    </section>
  )
}
