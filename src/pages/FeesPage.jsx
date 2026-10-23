import { useEffect, useMemo, useState } from 'react'
import { Info, Plus, Trash2 } from 'lucide-react'
import Button from '../components/common/Button'
import ErrorState from '../components/common/ErrorState'
import PageHeader from '../components/common/PageHeader'
import Skeleton from '../components/common/Skeleton'
import FormField, { fieldProps } from '../components/forms/FormField'
import { inputClass } from '../components/forms/inputStyles'
import { useAsyncData } from '../hooks/useAsyncData'
import { useToast } from '../hooks/useToast'
import { listFeeTiers, saveFeeTiers } from '../services/feeService'
import { formatPeso } from '../utils/currency'
import { calculateFee, describeTiers, MAX_TIERS, totalWithFee, validateTierRows } from '../utils/fees'
import { parseMoney } from '../utils/validation'
import { createUuid } from '../utils/uuid'

const newRow = () => ({ key: createUuid(), maxAmount: '', feeAmount: '' })
const rowsFrom = (tiers) =>
  tiers.map((tier) => ({ key: createUuid(), maxAmount: String(tier.maxAmount), feeAmount: String(tier.feeAmount) }))
const signature = (rows) => JSON.stringify(rows.map((row) => [row.maxAmount.trim(), row.feeAmount.trim()]))
const peso = (value) => (Number.isInteger(value) ? `₱${value.toLocaleString('en-PH')}` : formatPeso(value))

function MoneyInput({ id, label, value, onChange, error, hint }) {
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center font-bold text-slate-500"
        >
          ₱
        </span>
        <input
          {...fieldProps(id, error, Boolean(hint))}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ''))}
          className={`${inputClass(Boolean(error))} pl-10 font-semibold tabular-nums`}
          placeholder="0"
        />
      </div>
    </FormField>
  )
}

export default function FeesPage() {
  const toast = useToast()
  const { data, error, reload } = useAsyncData(() => listFeeTiers(), [])

  const [rows, setRows] = useState([])
  const [baseline, setBaseline] = useState('[]')
  const [showErrors, setShowErrors] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [testAmount, setTestAmount] = useState('')

  useEffect(() => {
    if (data) {
      const loaded = rowsFrom(data)
      setRows(loaded)
      setBaseline(signature(loaded))
      setShowErrors(false)
    }
  }, [data])

  const dirty = signature(rows) !== baseline
  const validation = useMemo(() => validateTierRows(rows), [rows])

  // Tiers that are complete enough to preview (even before the whole table is valid).
  const usable = useMemo(
    () =>
      rows
        .map((row) => ({ maxAmount: parseMoney(row.maxAmount), feeAmount: parseMoney(row.feeAmount) }))
        .filter((tier) => !Number.isNaN(tier.maxAmount) && !Number.isNaN(tier.feeAmount) && tier.maxAmount > 0),
    [rows],
  )
  const labels = useMemo(() => {
    const map = new Map()
    describeTiers(usable).forEach((range) => map.set(Math.round(range.to * 100), range))
    return map
  }, [usable])

  const probe = parseMoney(testAmount)
  const probeInfo = !Number.isNaN(probe) && probe > 0 ? calculateFee(usable, probe) : null
  const highest = usable.length > 0 ? Math.max(...usable.map((tier) => tier.maxAmount)) : null

  function updateRow(key, patch) {
    setRows((previous) => previous.map((row) => (row.key === key ? { ...row, ...patch } : row)))
    setSubmitError('')
  }

  async function handleSave(event) {
    event.preventDefault()
    if (submitting) return
    setShowErrors(true)
    if (!validation.ok) {
      setSubmitError(validation.formError || 'Fix the highlighted fields, then save.')
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      await saveFeeTiers(validation.parsed)
      toast.success('Fee table saved. It applies to new transactions from now on.')
      reload()
    } catch (caught) {
      setSubmitError(caught.message || 'Could not save the fee table.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Fees & charges" description="The fee added to every cash-in and cash-out." />

      <div className="flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-700">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
        <div className="space-y-1">
          <p>
            Each tier covers amounts <b>up to</b> the limit you type, starting just above the previous tier. Example:
            <b> up to ₱100 → ₱10</b> and <b>up to ₱500 → ₱15</b> means ₱1–₱100 pays ₱10 and ₱101–₱500 pays ₱15.
          </p>
          <p>
            The customer pays the amount <b>plus</b> the fee (₱500 + ₱15 = ₱515). The same table is used for cash-in and
            cash-out. Changing it only affects <b>new</b> transactions; old records keep the fee they were charged.
          </p>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <div aria-busy="true">
          <span className="sr-only" role="status">
            Loading fees…
          </span>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <form onSubmit={handleSave} noValidate className="space-y-4">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
              <p className="font-semibold">No fees set up</p>
              <p className="mt-1 text-sm text-slate-600">Customers are charged the amount only. Add a tier to start charging fees.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((row, index) => {
                const errors = showErrors ? validation.errors[index] : {}
                const range = labels.get(Math.round(parseMoney(row.maxAmount) * 100))
                return (
                  <li key={row.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-800">
                        {range ? `${peso(range.from)} – ${peso(range.to)}` : `Tier ${index + 1}`}
                      </p>
                      <button
                        type="button"
                        onClick={() => setRows((previous) => previous.filter((item) => item.key !== row.key))}
                        aria-label={`Remove tier ${index + 1}`}
                        className="flex size-11 items-center justify-center rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="size-5" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <MoneyInput
                        id={`tier-${row.key}-max`}
                        label="Up to"
                        value={row.maxAmount}
                        onChange={(value) => updateRow(row.key, { maxAmount: value })}
                        error={errors.maxAmount}
                      />
                      <MoneyInput
                        id={`tier-${row.key}-fee`}
                        label="Fee"
                        value={row.feeAmount}
                        onChange={(value) => updateRow(row.key, { feeAmount: value })}
                        error={errors.feeAmount}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <Button
            variant="secondary"
            disabled={rows.length >= MAX_TIERS}
            onClick={() => setRows((previous) => [...previous, newRow()])}
            className="min-h-12 w-full"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a tier
          </Button>

          {highest !== null && (
            <p className="text-sm text-slate-600">
              Amounts above <b>{peso(highest)}</b> have no fee. Add a higher tier if you want to charge for them.
            </p>
          )}

          <section aria-label="Try an amount" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold">Try an amount</p>
            <p className="text-xs text-slate-600">Uses the table above, even before you save.</p>
            <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-3">
              <MoneyInput id="fee-test" label="Amount" value={testAmount} onChange={setTestAmount} />
              <p className="pb-3 text-right text-sm tabular-nums" aria-live="polite">
                {probeInfo ? (
                  probeInfo.hasTiers ? (
                    <>
                      Fee <b>{formatPeso(probeInfo.fee)}</b>
                      <br />
                      Customer pays <b>{formatPeso(totalWithFee(probe, probeInfo.fee))}</b>
                    </>
                  ) : (
                    'No fees set'
                  )
                ) : (
                  ''
                )}
              </p>
            </div>
            {probeInfo && probeInfo.hasTiers && !probeInfo.matched && (
              <p className="mt-1 text-sm font-medium text-amber-900">No tier covers this amount, so no fee would be added.</p>
            )}
          </section>

          {rows.length === 0 && baseline !== '[]' && (
            <p className="text-sm font-medium text-amber-900">Saving an empty table removes all fees.</p>
          )}

          {submitError && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {submitError}
            </p>
          )}

          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
            <Button type="submit" loading={submitting} disabled={!dirty} className="min-h-12 w-full text-base">
              {dirty ? 'Save fee table' : 'No changes to save'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
