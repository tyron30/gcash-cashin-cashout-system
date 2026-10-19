import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays } from '../../utils/date'

const buttonClass =
  'flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40'

export default function DateSelector({ value, onChange, maxDate }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onChange(addDays(value, -1))}
        className={buttonClass}
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>

      <label className="min-w-0 flex-1">
        <span className="sr-only">Business date</span>
        <input
          type="date"
          value={value}
          max={maxDate}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value)
          }}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-medium shadow-sm"
        />
      </label>

      <button
        type="button"
        aria-label="Next day"
        onClick={() => onChange(addDays(value, 1))}
        disabled={value >= maxDate}
        className={buttonClass}
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
