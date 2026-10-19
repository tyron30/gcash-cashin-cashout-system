import { CircleAlert } from 'lucide-react'

// Props to spread on the <input> so screen readers connect label, hint, and error.
export function fieldProps(id, error, hint) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  }
}

export default function FormField({ id, label, optional = false, hint, error, children }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold text-slate-800"
      >
        <span>{label}</span>
        {optional && <span className="text-xs font-medium text-slate-500">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
