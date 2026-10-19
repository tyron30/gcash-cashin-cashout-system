import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link
        to="/cash-in"
        className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98]"
      >
        <ArrowDownLeft className="size-5" aria-hidden="true" />
        Cash In
      </Link>
      <Link
        to="/cash-out"
        className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-sky-700 px-3 text-base font-semibold text-white shadow-sm transition hover:bg-sky-800 active:scale-[0.98]"
      >
        <ArrowUpRight className="size-5" aria-hidden="true" />
        Cash Out
      </Link>
    </div>
  )
}
