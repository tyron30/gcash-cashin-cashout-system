export default function StatusBadge({ status }) {
  const isVoided = status === 'voided'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        isVoided ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
      }`}
    >
      {isVoided ? 'Voided' : 'Completed'}
    </span>
  )
}
