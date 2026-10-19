export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      )}
      <p className="font-semibold text-slate-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-slate-600">{description}</p>
      )}
    </div>
  )
}
