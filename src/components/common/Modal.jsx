import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

// Bottom sheet on phones, centered dialog on larger screens.
export default function Modal({ title, onClose, children, footer, dismissible = true }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)

  // Always call the latest onClose without restarting the effect below.
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Runs once when the dialog opens (focus must not jump while typing).
  useEffect(() => {
    dialogRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && dismissible) onCloseRef.current()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dismissible])

  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50"
        aria-hidden="true"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl focus:outline-none sm:max-w-lg sm:rounded-3xl sm:pb-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 id={titleId} className="text-base font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            aria-label="Close"
            className="-mr-2 flex size-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}
