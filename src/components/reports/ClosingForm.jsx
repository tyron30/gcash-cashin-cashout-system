import { useState } from 'react'
import { Info, Lock, RotateCcw } from 'lucide-react'
import Button from '../common/Button'
import Modal from '../common/Modal'
import FormField, { fieldProps } from '../forms/FormField'
import { inputClass } from '../forms/inputStyles'
import { calculateShortageOverage } from '../../utils/calculations'
import { formatPeso } from '../../utils/currency'
import { formatBusinessDate, formatDateTime } from '../../utils/date'
import {
  MAX_CLOSING_NOTES_LENGTH,
  parseMoney,
  validateNotes,
  validateOptionalMoney,
  validateReason,
} from '../../utils/validation'

const toText = (value) => (value === null || value === undefined ? '' : String(value))

function MoneyInput({ id, label, value, onChange, error, disabled, hint }) {
  return (
    <FormField id={id} label={label} optional error={error} hint={hint}>
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
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ''))}
          className={`${inputClass(Boolean(error))} pl-10 tabular-nums`}
          placeholder="0.00"
        />
      </div>
    </FormField>
  )
}

// Remount this component (change its key) whenever the saved closing changes.
export default function ClosingForm({ closing, saving, onSaveDraft, onCloseDay, onReopen }) {
  const isClosed = closing.status === 'closed'
  const [counted, setCounted] = useState(toText(closing.cashCounted))
  const [recorded, setRecorded] = useState(toText(closing.recordedCashBalance))
  const [notes, setNotes] = useState(closing.closingNotes ?? '')
  const [errors, setErrors] = useState({})
  const [confirmClose, setConfirmClose] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [reopenError, setReopenError] = useState('')

  const countedNumber = parseMoney(counted)
  const recordedNumber = parseMoney(recorded)
  const difference =
    Number.isNaN(countedNumber) || Number.isNaN(recordedNumber)
      ? null
      : calculateShortageOverage(countedNumber, recordedNumber)

  function validate() {
    const next = {}
    const a = validateOptionalMoney(counted, 'Cash counted')
    const b = validateOptionalMoney(recorded, 'Recorded cash balance')
    const c = validateNotes(notes, MAX_CLOSING_NOTES_LENGTH)
    if (a) next.counted = a
    if (b) next.recorded = b
    if (c) next.notes = c
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const values = { cashCounted: counted, recordedCashBalance: recorded, closingNotes: notes }

  function submitReopen() {
    const problem = validateReason(reopenReason)
    setReopenError(problem)
    if (!problem) onReopen(reopenReason).then((ok) => ok && setReopening(false))
  }

  return (
    <section aria-labelledby="closing-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="closing-heading" className="text-base font-bold">
          Closing summary
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isClosed ? 'bg-slate-800 text-white' : 'bg-amber-100 text-amber-900'
          }`}
        >
          {isClosed ? 'Closed' : 'Open'}
        </span>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-700">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
        <p>
          Count the physical cash and enter it here. The difference between cash in and cash out is{' '}
          <span className="font-semibold">not</span> your cash on hand. Opening balance, fees, deposits, and withdrawals
          also change it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput
          id="cash-counted"
          label="Actual cash counted"
          value={counted}
          onChange={(value) => {
            setCounted(value)
            setErrors((e) => ({ ...e, counted: undefined }))
          }}
          error={errors.counted}
          disabled={isClosed}
        />
        <MoneyInput
          id="cash-recorded"
          label="Recorded cash balance"
          value={recorded}
          onChange={(value) => {
            setRecorded(value)
            setErrors((e) => ({ ...e, recorded: undefined }))
          }}
          error={errors.recorded}
          disabled={isClosed}
          hint="From your own notebook or records, if you keep one."
        />
      </div>

      <div
        aria-live="polite"
        className={`mt-4 rounded-xl px-3 py-3 text-sm font-semibold ${
          difference === null
            ? 'bg-slate-100 text-slate-600'
            : difference === 0
              ? 'bg-emerald-50 text-emerald-800'
              : difference > 0
                ? 'bg-sky-50 text-sky-800'
                : 'bg-red-50 text-red-800'
        }`}
      >
        {difference === null && 'Enter both amounts to see any shortage or overage.'}
        {difference === 0 && 'Balanced. Counted cash matches the recorded balance.'}
        {difference > 0 && `Overage of ${formatPeso(difference)} (counted is more than recorded).`}
        {difference < 0 && `Shortage of ${formatPeso(Math.abs(difference))} (counted is less than recorded).`}
      </div>

      <div className="mt-4">
        <FormField id="closing-notes" label="Closing notes" optional error={errors.notes}>
          <textarea
            {...fieldProps('closing-notes', errors.notes)}
            rows={3}
            disabled={isClosed}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value)
              setErrors((e) => ({ ...e, notes: undefined }))
            }}
            className={`${inputClass(Boolean(errors.notes))} min-h-24 py-3`}
          />
        </FormField>
      </div>

      {isClosed ? (
        <div className="mt-4 space-y-3">
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Closed by {closing.closedBy} on {formatDateTime(closing.closedAt)}. Transactions on this date cannot be edited
            or voided unless the day is reopened.
          </p>
          <Button variant="secondary" onClick={() => setReopening(true)} className="no-print min-h-12 w-full sm:w-auto">
            <RotateCcw className="size-4" aria-hidden="true" />
            Reopen day
          </Button>
        </div>
      ) : (
        <div className="no-print mt-5 grid gap-3 sm:grid-cols-2">
          <Button
            variant="secondary"
            loading={saving}
            onClick={() => validate() && onSaveDraft(values)}
            className="min-h-12"
          >
            Save draft
          </Button>
          <Button loading={saving} onClick={() => validate() && setConfirmClose(true)} className="min-h-12">
            Close day
          </Button>
        </div>
      )}

      {closing.reopenedAt && !isClosed && (
        <p className="mt-3 text-sm text-amber-900">
          Reopened by {closing.reopenedBy} on {formatDateTime(closing.reopenedAt)}: {closing.reopenReason}
        </p>
      )}

      {confirmClose && (
        <Modal
          title={`Close ${formatBusinessDate(closing.businessDate)}?`}
          onClose={() => setConfirmClose(false)}
          dismissible={!saving}
          footer={
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setConfirmClose(false)} disabled={saving} className="min-h-12">
                Not yet
              </Button>
              <Button
                loading={saving}
                className="min-h-12"
                onClick={() => onCloseDay(values).then(() => setConfirmClose(false))}
              >
                Close day
              </Button>
            </div>
          }
        >
          <p className="text-sm text-slate-700">
            After closing, transactions on this date cannot be recorded, edited, or voided until you reopen the day.
            Reopening is saved in the history.
          </p>
        </Modal>
      )}

      {reopening && (
        <Modal
          title="Reopen this day?"
          onClose={() => setReopening(false)}
          dismissible={!saving}
          footer={
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setReopening(false)} disabled={saving} className="min-h-12">
                Cancel
              </Button>
              <Button loading={saving} onClick={submitReopen} className="min-h-12">
                Reopen day
              </Button>
            </div>
          }
        >
          <FormField id="reopen-reason" label="Reason for reopening" error={reopenError} hint="Required. Saved in the history.">
            <textarea
              {...fieldProps('reopen-reason', reopenError, true)}
              rows={3}
              value={reopenReason}
              onChange={(event) => {
                setReopenReason(event.target.value)
                setReopenError('')
              }}
              className={`${inputClass(Boolean(reopenError))} min-h-24 py-3`}
            />
          </FormField>
        </Modal>
      )}
    </section>
  )
}
