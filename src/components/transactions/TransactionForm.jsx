import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, CircleCheck, Clock, TriangleAlert } from 'lucide-react'
import { buttonClass } from '../common/Button'
import FormField, { fieldProps } from '../forms/FormField'
import { inputClass } from '../forms/inputStyles'
import { useAuth } from '../../hooks/useAuth'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useToast } from '../../hooks/useToast'
import { createTransaction, findDuplicateReference } from '../../services/transactionService'
import { formatPeso } from '../../utils/currency'
import { createUuid } from '../../utils/uuid'
import { formatDateTime, getManilaNowParts, toManilaTimestamp } from '../../utils/date'
import {
  normalizeReference,
  parseMoney,
  validateAmount,
  validateDateTime,
  validateName,
  validateNotes,
  validateReference,
} from '../../utils/validation'
import StatusBadge from './StatusBadge'
import { LoaderCircle } from 'lucide-react'

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 3000, 5000]

const TYPE_STYLES = {
  cash_in: {
    label: 'Cash In',
    Icon: ArrowDownLeft,
    iconBox: 'bg-emerald-100 text-emerald-700',
    save: 'bg-emerald-700 hover:bg-emerald-800',
    chipOn: 'border-emerald-600 bg-emerald-50 text-emerald-800',
  },
  cash_out: {
    label: 'Cash Out',
    Icon: ArrowUpRight,
    iconBox: 'bg-sky-100 text-sky-700',
    save: 'bg-sky-700 hover:bg-sky-800',
    chipOn: 'border-sky-600 bg-sky-50 text-sky-800',
  },
}

const EMPTY = { reference: '', amount: '', name: '', notes: '' }

const createSubmissionKey = createUuid

export default function TransactionForm({ type }) {
  const style = TYPE_STYLES[type]
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const online = useOnlineStatus()

  const referenceRef = useRef(null)
  const submittingRef = useRef(false) // blocks double taps instantly
  const submissionKeyRef = useRef(createSubmissionKey()) // blocks duplicate records

  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [duplicates, setDuplicates] = useState(null)
  const [lastSaved, setLastSaved] = useState(null)
  const [adjustTime, setAdjustTime] = useState(false)
  const [dateValue, setDateValue] = useState('')
  const [timeValue, setTimeValue] = useState('')

  const id = (name) => `${type}-${name}`

  // Ready to type as soon as the page opens.
  useEffect(() => {
    referenceRef.current?.focus()
  }, [])

  function setField(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
    setSubmitError('')
    if (name === 'reference') setDuplicates(null)
  }

  function toggleAdjustTime() {
    if (!adjustTime) {
      const now = getManilaNowParts()
      setDateValue(now.date)
      setTimeValue(now.time)
    }
    setAdjustTime((open) => !open)
    setErrors((previous) => ({ ...previous, datetime: undefined }))
  }

  function validateAll() {
    const next = {}
    const reference = validateReference(values.reference)
    const amount = validateAmount(values.amount)
    const name = validateName(values.name)
    const notes = validateNotes(values.notes)
    if (reference) next.reference = reference
    if (amount) next.amount = amount
    if (name) next.name = name
    if (notes) next.notes = notes
    if (adjustTime) {
      const datetime = validateDateTime(dateValue, timeValue)
      if (datetime) next.datetime = datetime
    }
    return next
  }

  function resetForm() {
    setValues(EMPTY)
    setErrors({})
    setDuplicates(null)
    setAdjustTime(false)
    submissionKeyRef.current = createSubmissionKey() // next record = new key
    referenceRef.current?.focus()
  }

  async function saveTransaction({ skipDuplicateCheck = false } = {}) {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError('')

    try {
      if (!skipDuplicateCheck) {
        const matches = await findDuplicateReference(values.reference)
        if (matches.length > 0) {
          setDuplicates(matches)
          return
        }
      }

      const { transaction } = await createTransaction(
        {
          type,
          referenceNumber: values.reference,
          amount: parseMoney(values.amount),
          name: values.name,
          notes: values.notes,
          transactionTimestamp: adjustTime ? toManilaTimestamp(dateValue, timeValue) : null,
          submissionKey: submissionKeyRef.current,
        },
        profile,
      )

      // Only reached after the save is confirmed.
      setLastSaved(transaction)
      toast.success(`${style.label} saved: ${formatPeso(transaction.amount)}`)
      resetForm()
    } catch (error) {
      const message = error.message || 'Could not save the transaction. Please try again.'
      setSubmitError(message)
      toast.error(message) // the form keeps everything you typed
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (submittingRef.current) return

    const nextErrors = validateAll()
    setErrors(nextErrors)

    const firstInvalid = ['reference', 'amount', 'name', 'notes'].find((field) => nextErrors[field])
    if (firstInvalid) {
      document.getElementById(id(firstInvalid))?.focus()
      return
    }
    if (nextErrors.datetime) return

    saveTransaction()
  }

  const parsedAmount = parseMoney(values.amount)
  const showPreview = !Number.isNaN(parsedAmount) && parsedAmount > 0
  const { Icon } = style

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {lastSaved && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900"
        >
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0">
            <span className="font-semibold">Saved:</span> {formatPeso(lastSaved.amount)} ·{' '}
            {lastSaved.referenceNumber}.{' '}
            <Link to={`/transactions/${lastSaved.id}`} className="font-semibold underline">
              View
            </Link>
          </p>
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{submitError} Your entries are still here.</p>
        </div>
      )}

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <span className={`flex size-11 items-center justify-center rounded-xl ${style.iconBox}`}>
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-bold">{style.label}</p>
            <p className="text-sm text-slate-600">Recorded by {profile.fullName}</p>
          </div>
        </div>

        <FormField
          id={id('reference')}
          label="Reference number"
          hint="Copy it from the GCash receipt. Leading zeros are kept."
          error={errors.reference}
        >
          <input
            {...fieldProps(id('reference'), errors.reference, true)}
            ref={referenceRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={values.reference}
            onChange={(event) => setField('reference', event.target.value)}
            onBlur={() => {
              if (values.reference.trim()) setField('reference', normalizeReference(values.reference))
            }}
            className={`${inputClass(Boolean(errors.reference))} font-mono tracking-wide`}
            placeholder="0000 000 000000"
          />
        </FormField>

        {duplicates && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="flex items-start gap-2 font-semibold">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              This reference number was already recorded.
            </p>
            <ul className="mt-2 space-y-1.5">
              {duplicates.map((match) => (
                <li key={match.id} className="rounded-lg bg-white/70 px-2.5 py-2">
                  <p className="font-medium">
                    {match.type === 'cash_in' ? 'Cash In' : 'Cash Out'} · {formatPeso(match.amount)}
                  </p>
                  <p className="text-xs">
                    {formatDateTime(match.transactionTimestamp)} · {match.staffName}{' '}
                    {match.id && (
                      <Link to={`/transactions/${match.id}`} className="font-semibold underline">
                        View
                      </Link>
                    )}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2">Check the receipt. If this is a different transaction, you can still save it.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDuplicates(null)
                  referenceRef.current?.focus()
                }}
                className={buttonClass('secondary')}
              >
                Fix reference
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setDuplicates(null)
                  saveTransaction({ skipDuplicateCheck: true })
                }}
                className={buttonClass('primary', style.save)}
              >
                Save anyway
              </button>
            </div>
          </div>
        )}

        <FormField id={id('amount')} label="Amount" error={errors.amount}>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-xl font-bold text-slate-500"
            >
              ₱
            </span>
            <input
              {...fieldProps(id('amount'), errors.amount)}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.amount}
              onChange={(event) => setField('amount', event.target.value.replace(/[^\d.,]/g, ''))}
              className={`${inputClass(Boolean(errors.amount))} min-h-14 pl-11 text-2xl font-bold tabular-nums`}
              placeholder="0.00"
            />
          </div>
          <p className="mt-1.5 min-h-5 text-sm font-semibold text-slate-700" aria-live="polite">
            {showPreview ? formatPeso(parsedAmount) : ''}
          </p>
          <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
            {QUICK_AMOUNTS.map((quick) => {
              const selected = parsedAmount === quick
              return (
                <button
                  key={quick}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setField('amount', String(quick))}
                  className={`min-h-10 rounded-full border px-3.5 text-sm font-semibold tabular-nums transition ${
                    selected ? style.chipOn : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  ₱{quick.toLocaleString('en-PH')}
                </button>
              )
            })}
          </div>
        </FormField>

        <FormField
          id={id('name')}
          label="Sender / receiver name"
          optional
          hint="Masked names are fine, like JU**** DE**."
          error={errors.name}
        >
          <input
            {...fieldProps(id('name'), errors.name, true)}
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            value={values.name}
            onChange={(event) => setField('name', event.target.value)}
            className={inputClass(Boolean(errors.name))}
          />
        </FormField>

        <FormField id={id('notes')} label="Notes" optional error={errors.notes}>
          <textarea
            {...fieldProps(id('notes'), errors.notes)}
            rows={2}
            value={values.notes}
            onChange={(event) => setField('notes', event.target.value)}
            className={`${inputClass(Boolean(errors.notes))} min-h-20 py-3`}
            placeholder="Short remark, if needed"
          />
        </FormField>

        {isAdmin && (
          <div>
            <button
              type="button"
              onClick={toggleAdjustTime}
              aria-expanded={adjustTime}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-slate-700 hover:text-slate-900"
            >
              <Clock className="size-4" aria-hidden="true" />
              {adjustTime ? 'Use the current date and time' : 'Change date or time'}
            </button>
            {adjustTime && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <FormField id={id('date')} label="Date" error={errors.datetime}>
                  <input
                    {...fieldProps(id('date'), errors.datetime)}
                    type="date"
                    max={getManilaNowParts().date}
                    value={dateValue}
                    onChange={(event) => setDateValue(event.target.value)}
                    className={inputClass(Boolean(errors.datetime))}
                  />
                </FormField>
                <FormField id={id('time')} label="Time">
                  <input
                    type="time"
                    id={id('time')}
                    value={timeValue}
                    onChange={(event) => setTimeValue(event.target.value)}
                    className={inputClass(Boolean(errors.datetime))}
                  />
                </FormField>
              </div>
            )}
            {adjustTime && (
              <p className="mt-1.5 text-xs text-slate-600">
                Only the owner can set another date or time. The original save time is kept for the audit trail.
              </p>
            )}
          </div>
        )}
      </div>

      {!online && (
        <p role="alert" className="text-sm font-medium text-amber-800">
          You are offline. Saving is paused until the connection returns.
        </p>
      )}

      {/* Stays above the phone's bottom bar so one thumb can always reach Save. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-[auto_1fr] gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <Link to="/" className={buttonClass('secondary', 'min-h-12 px-5')}>
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || !online}
          aria-busy={submitting || undefined}
          className={buttonClass('primary', `min-h-12 text-base ${style.save}`)}
        >
          {submitting && (
            <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          )}
          {submitting ? 'Saving…' : `Save ${style.label}`}
        </button>
      </div>

      <p className="text-xs text-slate-600">
        <StatusBadge status="completed" /> New records are saved as completed. An owner can void a mistake later.
      </p>
    </form>
  )
}
