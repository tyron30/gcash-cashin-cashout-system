import { LoaderCircle } from 'lucide-react'

export default function Spinner({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-slate-600">
      <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
