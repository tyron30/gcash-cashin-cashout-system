import { useStore } from '../../hooks/useStore'
import { formatDateTime } from '../../utils/date'

// Visible only when printing.
export default function PrintHeader({ title, subtitle }) {
  const { storeName } = useStore()
  return (
    <div className="print-only mb-4 border-b border-slate-300 pb-3">
      <p className="text-lg font-bold">{storeName}</p>
      <p className="text-base font-semibold">{title}</p>
      {subtitle && <p className="text-sm">{subtitle}</p>}
      <p className="text-xs text-slate-600">
        Generated {formatDateTime(new Date().toISOString())} (Asia/Manila)
      </p>
    </div>
  )
}
