import { KeyRound } from 'lucide-react'

export default function ConfigErrorPage({ unsafeKey = false }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <span className="flex size-12 items-center justify-center rounded-xl bg-red-100 text-red-700">
          <KeyRound className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-bold">
          {unsafeKey ? 'Unsafe key detected' : 'Supabase is not configured'}
        </h1>
        {unsafeKey ? (
          <p className="mt-2 text-sm text-slate-700">
            The key in your <code className="rounded bg-slate-100 px-1">.env</code> file is a <b>secret / service_role</b>{' '}
            key. It must never be used in the browser. Replace it with the <b>publishable</b> key (Supabase → Project
            Settings → API), then restart the app. Because that secret key was shown on your screen, consider rotating
            it in Supabase.
          </p>
        ) : (
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            <p>
              Create a file named <code className="rounded bg-slate-100 px-1">.env</code> in the project folder (copy{' '}
              <code className="rounded bg-slate-100 px-1">.env.example</code>) and fill in:
            </p>
            <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
            </pre>
            <p>Then stop the app (Ctrl + C) and run it again so it reads the file.</p>
          </div>
        )}
      </div>
    </div>
  )
}
