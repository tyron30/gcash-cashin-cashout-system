import Skeleton from '../common/Skeleton'

export default function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only" role="status">
        Loading dashboard…
      </span>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28 min-[420px]:col-span-2 lg:col-span-1" />
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}
