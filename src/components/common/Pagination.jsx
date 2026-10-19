import { ChevronLeft, ChevronRight } from 'lucide-react'

const buttonClass =
  'flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

export default function Pagination({ page, totalPages, total, pageSize, onChange }) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <nav aria-label="Pagination" className="no-print flex items-center justify-between gap-3">
      <p className="text-sm text-slate-600">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className={buttonClass}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <span className="min-w-20 text-center text-sm font-medium text-slate-700">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className={buttonClass}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
