import { Clock, TriangleAlert } from 'lucide-react'
import Button from '../components/common/Button'
import { useAuth } from '../hooks/useAuth'

// Shown when someone is logged in but cannot use the app yet.
export default function AccountStatusPage({ kind, message }) {
  const { profile, signOut, retryProfile } = useAuth()
  const inactive = kind === 'inactive'
  const Icon = inactive ? Clock : TriangleAlert

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <span
          className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${
            inactive ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}
        >
          <Icon className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-bold">{inactive ? 'Waiting for activation' : 'Could not load your account'}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {inactive
            ? `${profile?.fullName ?? 'Your account'} is not active yet. Ask the store owner to activate it, then log in again.`
            : message}
        </p>
        <div className="mt-6 grid gap-3">
          {!inactive && <Button onClick={retryProfile}>Try again</Button>}
          <Button variant="secondary" onClick={signOut}>
            Log out
          </Button>
        </div>
      </div>
    </div>
  )
}
