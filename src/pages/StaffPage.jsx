import { useState } from 'react'
import { UserCheck } from 'lucide-react'
import Button from '../components/common/Button'
import PageHeader from '../components/common/PageHeader'
import ErrorState from '../components/common/ErrorState'
import Skeleton from '../components/common/Skeleton'
import StaffEditModal from '../components/staff/StaffEditModal'
import { useAsyncData } from '../hooks/useAsyncData'
import { useAuth } from '../hooks/useAuth'
import { listStaff } from '../services/staffService'
import { formatDateTime } from '../utils/date'

function Badge({ tone, children }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-100 text-amber-900',
    slate: 'bg-slate-100 text-slate-700',
    dark: 'bg-slate-800 text-white',
  }
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

export default function StaffPage() {
  const { profile } = useAuth()
  const { data, loading, error, reload } = useAsyncData(() => listStaff(), [])
  const [editing, setEditing] = useState(null)

  const waiting = data ? data.filter((person) => !person.isActive).length : 0

  return (
    <div className="space-y-5">
      <PageHeader title="Staff" description="Control who can log in and what they can do." />

      {waiting > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2.5 text-sm font-semibold text-amber-900">
          <UserCheck className="size-4" aria-hidden="true" />
          {waiting} {waiting === 1 ? 'person is' : 'people are'} waiting for activation.
        </p>
      )}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <div className="space-y-2" aria-busy="true">
          <span className="sr-only" role="status">
            Loading staff…
          </span>
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-16" />
          ))}
        </div>
      ) : (
        <ul className={`divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${loading ? 'opacity-60' : ''}`}>
          {data.map((person) => (
            <li key={person.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {person.fullName}
                  {person.id === profile.id && <span className="font-normal text-slate-500"> (you)</span>}
                </p>
                <p className="truncate text-xs text-slate-600">{person.email}</p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone={person.role === 'admin' ? 'dark' : 'slate'}>{person.role === 'admin' ? 'Owner' : 'Staff'}</Badge>
                  {person.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Waiting for activation</Badge>}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {person.lastSignInAt ? `Last login ${formatDateTime(person.lastSignInAt)}` : 'Never logged in'}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setEditing(person)} className="shrink-0">
                Manage
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <StaffEditModal
          person={editing}
          isSelf={editing.id === profile.id}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
