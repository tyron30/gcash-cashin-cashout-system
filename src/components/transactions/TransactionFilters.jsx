import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { inputClass } from '../forms/inputStyles'
import { addDays, getMonthStart } from '../../utils/date'

const TYPES = [
  { value: 'all', label: 'All' },
  { value: 'cash_in', label: 'Cash In' },
  { value: 'cash_out', label: 'Cash Out' },
]

const selectClass = `${inputClass(false)} min-h-11 text-sm`

export default function TransactionFilters({
  filters,
  searchText,
  onSearchText,
  onChange,
  onClear,
  activeCount,
  isAdmin,
  today,
  staffOptions,
}) {
  const [open, setOpen] = useState(false)

  const presets = [
    { label: 'Today', from: today, to: today },
    { label: 'Yesterday', from: addDays(today, -1), to: addDays(today, -1) },
    { label: 'Last 7 days', from: addDays(today, -6), to: today },
    { label: 'This month', from: getMonthStart(today), to: today },
  ]

  return (
    <section aria-label="Search and filters" className="space-y-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="tx-search" className="sr-only">
            Search by reference number or name
          </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="tx-search"
            type="search"
            autoComplete="off"
            value={searchText}
            onChange={(event) => onSearchText(event.target.value)}
            placeholder="Search reference or name"
            className={`${inputClass(false)} min-h-12 pl-11`}
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="tx-filter-panel"
          className="relative flex min-h-12 shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:hidden"
        >
          <SlidersHorizontal className="size-5" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-emerald-700 text-xs text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <div
        id="tx-filter-panel"
        className={`${open ? 'block' : 'hidden'} space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:block`}
      >
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-slate-800">Type</legend>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filters.type === item.value}
                onClick={() => onChange({ type: item.value })}
                className={`min-h-11 rounded-xl border text-sm font-semibold ${
                  filters.type === item.value
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        {isAdmin ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-slate-800">Date</legend>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => {
                const selected = filters.dateFrom === preset.from && filters.dateTo === preset.to
                return (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange({ dateFrom: preset.from, dateTo: preset.to })}
                    className={`min-h-10 rounded-full border px-3.5 text-sm font-semibold ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tx-from" className="mb-1 block text-xs font-semibold text-slate-600">
                  From
                </label>
                <input
                  id="tx-from"
                  type="date"
                  max={today}
                  value={filters.dateFrom}
                  onChange={(event) => event.target.value && onChange({ dateFrom: event.target.value })}
                  className={selectClass}
                />
              </div>
              <div>
                <label htmlFor="tx-to" className="mb-1 block text-xs font-semibold text-slate-600">
                  To
                </label>
                <input
                  id="tx-to"
                  type="date"
                  max={today}
                  value={filters.dateTo}
                  onChange={(event) => event.target.value && onChange({ dateTo: event.target.value })}
                  className={selectClass}
                />
              </div>
            </div>
          </fieldset>
        ) : (
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
            Staff accounts see today&apos;s transactions only.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
          <div>
            <label htmlFor="tx-status" className="mb-1 block text-xs font-semibold text-slate-600">
              Status
            </label>
            <select
              id="tx-status"
              value={filters.status}
              onChange={(event) => onChange({ status: event.target.value })}
              className={selectClass}
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
            </select>
          </div>

          {isAdmin && (
            <div>
              <label htmlFor="tx-staff" className="mb-1 block text-xs font-semibold text-slate-600">
                Staff member
              </label>
              <select
                id="tx-staff"
                value={filters.staff}
                onChange={(event) => onChange({ staff: event.target.value })}
                className={selectClass}
              >
                <option value="all">All staff</option>
                {staffOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="tx-sort" className="mb-1 block text-xs font-semibold text-slate-600">
              Sort
            </label>
            <select
              id="tx-sort"
              value={filters.sort}
              onChange={(event) => onChange({ sort: event.target.value })}
              className={selectClass}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            <X className="size-4" aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>
    </section>
  )
}
