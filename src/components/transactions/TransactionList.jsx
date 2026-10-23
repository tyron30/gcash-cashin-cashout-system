import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react'
import { formatPeso } from '../../utils/currency'
import { formatDateTime, formatTime } from '../../utils/date'
import StatusBadge from './StatusBadge'
import TransactionTypeBadge from './TransactionTypeBadge'

function NoName() {
  return <span className="font-normal italic text-slate-500">No name</span>
}

function TransactionCard({ transaction, showDate }) {
  const isCashIn = transaction.type === 'cash_in'
  const isVoided = transaction.status === 'voided'
  const Icon = isCashIn ? ArrowDownLeft : ArrowUpRight

  return (
    <li>
      <Link
        to={`/transactions/${transaction.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100"
      >
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
            isCashIn ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
          }`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{transaction.name || <NoName />}</p>
          {showDate ? (
            <>
              {transaction.referenceNumber && (
                <p className="truncate text-xs text-slate-600">{transaction.referenceNumber}</p>
              )}
              <p className="truncate text-xs text-slate-500">
                {formatDateTime(transaction.transactionTimestamp)} · {transaction.staffName}
              </p>
            </>
          ) : (
            <p className="truncate text-xs text-slate-500">
              {transaction.referenceNumber ? `${transaction.referenceNumber} · ` : ''}
              {formatTime(transaction.transactionTimestamp)}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`text-sm font-bold tabular-nums ${
              isVoided ? 'text-slate-500 line-through' : ''
            }`}
          >
            {formatPeso(transaction.amount)}
          </p>
          {isVoided ? (
            <StatusBadge status="voided" />
          ) : (
            <p className="text-xs text-slate-500">
              {isCashIn ? 'Cash In' : 'Cash Out'}
              {transaction.feeAmount > 0 && ` · +${formatPeso(transaction.feeAmount)} fee`}
            </p>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
      </Link>
    </li>
  )
}

function TransactionTable({ transactions, showDate }) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">{showDate ? 'Date & time' : 'Time'}</th>
            <th className="px-4 py-3">Reference No.</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Sender / Receiver</th>
            <th className="px-4 py-3">Staff</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Fee</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {transactions.map((transaction) => {
            const isVoided = transaction.status === 'voided'
            return (
              <tr key={transaction.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {showDate
                    ? formatDateTime(transaction.transactionTimestamp)
                    : formatTime(transaction.transactionTimestamp)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  {transaction.referenceNumber ?? <span className="font-sans text-slate-500">None (cash-in)</span>}
                </td>
                <td className="px-4 py-3">
                  <TransactionTypeBadge type={transaction.type} />
                </td>
                <td className="px-4 py-3">{transaction.name || <NoName />}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{transaction.staffName}</td>
                <td
                  className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums ${
                    isVoided ? 'text-slate-500 line-through' : ''
                  }`}
                >
                  {formatPeso(transaction.amount)}
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600 ${
                    isVoided ? 'line-through' : ''
                  }`}
                >
                  {formatPeso(transaction.feeAmount)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={transaction.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/transactions/${transaction.id}`}
                    className="no-print inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    View
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Phones: compact cards. Large screens (lg and up): a table.
export default function TransactionList({ transactions, showDate = false }) {
  return (
    <>
      <ul className="divide-y divide-slate-100 lg:hidden">
        {transactions.map((transaction) => (
          <TransactionCard key={transaction.id} transaction={transaction} showDate={showDate} />
        ))}
      </ul>
      <TransactionTable transactions={transactions} showDate={showDate} />
    </>
  )
}
