import { SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md pt-10 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <SearchX className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        The page you are looking for does not exist or you do not have access
        to it.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
