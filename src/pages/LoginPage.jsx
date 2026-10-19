import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { CircleAlert, Eye, EyeOff, Info, Wallet } from 'lucide-react'
import Button from '../components/common/Button'
import FormField, { fieldProps } from '../components/forms/FormField'
import { inputClass } from '../components/forms/inputStyles'
import { useAuth } from '../hooks/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export default function LoginPage() {
  const { isAuthenticated, signIn, notice, clearNotice } = useAuth()
  const location = useLocation()
  const online = useOnlineStatus()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const destination = location.state?.from?.pathname ?? '/'
  if (isAuthenticated) return <Navigate to={destination} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const nextErrors = {}
    if (!email.trim()) nextErrors.email = 'Enter your email address.'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = 'Enter a valid email address.'
    if (!password) nextErrors.password = 'Enter your password.'
    setErrors(nextErrors)
    setFormError('')
    if (Object.keys(nextErrors).length > 0) return

    if (!online) {
      setFormError('No internet connection. Connect and try again.')
      return
    }

    setSubmitting(true)
    clearNotice()
    try {
      await signIn(email, password)
      // On success AuthContext updates and this page redirects automatically.
    } catch (error) {
      setFormError(error.message || 'Could not sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
            <Wallet className="size-7" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">GCash Monitor</h1>
          <p className="mt-1 text-sm text-slate-600">Sign in to continue</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          {notice && !formError && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm font-medium text-sky-900"
            >
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {notice}
            </div>
          )}

          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {formError}
            </div>
          )}

          <FormField id="login-email" label="Email" error={errors.email}>
            <input
              {...fieldProps('login-email', errors.email)}
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass(Boolean(errors.email))}
              placeholder="you@store.com"
            />
          </FormField>

          <FormField id="login-password" label="Password" error={errors.password}>
            <div className="relative">
              <input
                {...fieldProps('login-password', errors.password)}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${inputClass(Boolean(errors.password))} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-800"
              >
                {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
              </button>
            </div>
          </FormField>

          <Button type="submit" loading={submitting} className="min-h-12 w-full text-base">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-600">
          Forgot your password? Ask the store owner to reset it.
        </p>
      </div>
    </div>
  )
}
