import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import TransactionForm from '../components/transactions/TransactionForm'

export default function TransactionFormPage({ type }) {
  return (
    <div className="mx-auto max-w-xl">
      <Link
        to="/"
        className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Dashboard
      </Link>
      <h1 className="sr-only">{type === 'cash_in' ? 'New Cash In' : 'New Cash Out'}</h1>
      <TransactionForm type={type} />
    </div>
  )
}
