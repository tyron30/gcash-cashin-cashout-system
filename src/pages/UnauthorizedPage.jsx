import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonClass } from '../components/common/Button'

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto max-w-md pt-10 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <ShieldAlert className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-xl font-bold">You do not have access to this page</h1>
      <p className="mt-2 text-sm text-slate-600">
        This page is for the store owner. Ask the owner if you need something from it.
      </p>
      <Link to="/" className={buttonClass('primary', 'mt-6 px-5')}>
        Back to Dashboard
      </Link>
    </div>
  )
}
