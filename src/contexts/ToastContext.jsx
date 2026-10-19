import { createContext, useCallback, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'

export const ToastContext = createContext(null)

const STYLES = {
  success: { Icon: CircleCheck, box: 'border-emerald-200', icon: 'text-emerald-600' },
  error: { Icon: CircleAlert, box: 'border-red-200', icon: 'text-red-600' },
  warning: { Icon: TriangleAlert, box: 'border-amber-200', icon: 'text-amber-600' },
  info: { Icon: Info, box: 'border-sky-200', icon: 'text-sky-600' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (type, message) => {
      counter.current += 1
      const id = counter.current
      setToasts((list) => [...list.slice(-2), { id, type, message }])
      setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
      warning: (message) => show('warning', message),
      info: (message) => show('info', message),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
      >
        {toasts.map((toast) => {
          const { Icon, box, icon } = STYLES[toast.type]
          return (
            <div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-3 shadow-lg ${box}`}
            >
              <Icon className={`mt-0.5 size-5 shrink-0 ${icon}`} aria-hidden="true" />
              <p className="min-w-0 flex-1 text-sm font-medium text-slate-900">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss message"
                className="-m-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
