const tones = {
  green: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-sky-100 text-sky-700',
  slate: 'bg-slate-100 text-slate-700',
  amber: 'bg-amber-100 text-amber-700',
}

export default function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'slate',
  className = '',
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-slate-600">{label}</p>
      </div>
      <p className="mt-3 text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
        {value}
      </p>
      {helper && <p className="mt-1 text-sm text-slate-500">{helper}</p>}
    </div>
  )
}
