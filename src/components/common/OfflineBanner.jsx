import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export default function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div
      role="alert"
      className="no-print flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      No internet connection. Records cannot be saved until you are back online.
    </div>
  )
}
