import { useEffect, useState } from 'react'
import Button from '../components/common/Button'
import ErrorState from '../components/common/ErrorState'
import PageHeader from '../components/common/PageHeader'
import Skeleton from '../components/common/Skeleton'
import FormField, { fieldProps } from '../components/forms/FormField'
import { inputClass } from '../components/forms/inputStyles'
import { useAsyncData } from '../hooks/useAsyncData'
import { useStore } from '../hooks/useStore'
import { useToast } from '../hooks/useToast'
import { getStoreSettings, updateStoreSettings } from '../services/storeService'
import { cleanText } from '../utils/validation'

const HISTORY_OPTIONS = [
  { value: 0, label: "Today only (recommended)" },
  { value: 1, label: 'Today and yesterday' },
  { value: 2, label: 'Last 3 days' },
  { value: 6, label: 'Last 7 days' },
]

export default function SettingsPage() {
  const toast = useToast()
  const store = useStore()
  const { data, error, reload } = useAsyncData(() => getStoreSettings(), [])

  const [storeName, setStoreName] = useState('')
  const [historyDays, setHistoryDays] = useState(0)
  const [nameError, setNameError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (data) {
      setStoreName(data.storeName)
      setHistoryDays(data.staffHistoryDays)
    }
  }, [data])

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const name = cleanText(storeName)
    if (!name) return setNameError('Enter the store name.')
    if (name.length > 80) return setNameError('Keep the name under 80 characters.')

    setSubmitting(true)
    setSubmitError('')
    try {
      await updateStoreSettings({ storeName: name, staffHistoryDays: Number(historyDays) })
      await store.refresh()
      toast.success('Settings saved.')
      reload()
    } catch (caught) {
      setSubmitError(caught.message || 'Could not save the settings.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="Store settings" description="Shown on reports and in the app header." />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <div aria-busy="true">
          <span className="sr-only" role="status">
            Loading settings…
          </span>
          <Skeleton className="h-72" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <FormField id="store-name" label="Store name" error={nameError}>
            <input
              {...fieldProps('store-name', nameError)}
              type="text"
              value={storeName}
              onChange={(event) => {
                setStoreName(event.target.value)
                setNameError('')
                setSubmitError('')
              }}
              className={inputClass(Boolean(nameError))}
            />
          </FormField>

          <FormField id="history-days" label="What staff can see in History" hint="Staff always see today. The owner always sees everything.">
            <select
              id="history-days"
              value={historyDays}
              onChange={(event) => {
                setHistoryDays(event.target.value)
                setSubmitError('')
              }}
              className={inputClass(false)}
            >
              {HISTORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-800">Time zone</p>
            <p className="rounded-xl bg-slate-100 px-3.5 py-3 text-sm text-slate-700">
              {data.timezone}. Business dates change at midnight in this time zone.
            </p>
          </div>

          {submitError && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {submitError}
            </p>
          )}

          <Button type="submit" loading={submitting} className="min-h-12 w-full">
            Save settings
          </Button>
        </form>
      )}
    </div>
  )
}
