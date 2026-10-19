import { LoaderCircle } from 'lucide-react'

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'

const variants = {
  primary: 'bg-emerald-700 text-white hover:bg-emerald-800',
  sky: 'bg-sky-700 text-white hover:bg-sky-800',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  ghost: 'text-slate-700 hover:bg-slate-100',
}

// Use on <Link> too: <Link className={buttonClass('secondary')}>
export function buttonClass(variant = 'primary', className = '') {
  return `${base} ${variants[variant]} ${className}`
}

export default function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, className)}
      {...props}
    >
      {loading && (
        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      )}
      {children}
    </button>
  )
}
