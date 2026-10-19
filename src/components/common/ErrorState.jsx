import { TriangleAlert, RefreshCw } from 'lucide-react'

export default function ErrorState({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center"
    >
      <TriangleAlert className="size-8 text-red-600" aria-hidden="true" />
      <p className="mt-3 font-semibold text-red-900">Unable to load data</p>
      <p className="mt-1 max-w-sm text-sm text-red-800">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  )
}
