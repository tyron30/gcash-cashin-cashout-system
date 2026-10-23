import { useState } from 'react'
import Button from '../common/Button'
import Modal from '../common/Modal'
import FormField, { fieldProps } from '../forms/FormField'
import { inputClass } from '../forms/inputStyles'
import { useAuth } from '../../hooks/useAuth'
import { useFeeTiers } from '../../hooks/useFeeTiers'
import { useToast } from '../../hooks/useToast'
import { updateTransaction } from '../../services/transactionService'
import { calculateFee } from '../../utils/fees'
import { getManilaNowParts, getTimestampParts, toManilaTimestamp } from '../../utils/date'
import {
  needsReference,
  normalizeReference,
  parseMoney,
  validateAmount,
  validateDateTime,
  validateFee,
  validateName,
  validateNotes,
  validateReason,
  validateReference,
} from '../../utils/validation'

export default function EditTransactionModal({ transaction, onClose, onDone }) {
  const { profile } = useAuth()
  const toast = useToast()
  const initial = getTimestampParts(transaction.transactionTimestamp)
  const withReference = needsReference(transaction.type)
  const { tiers, ready: feesReady } = useFeeTiers()

  const [values, setValues] = useState({
    reference: transaction.referenceNumber ?? '',
    amount: String(transaction.amount),
    fee: String(transaction.feeAmount ?? 0),
    name: transaction.name ?? '',
    notes: transaction.notes ?? '',
    date: initial.date,
    time: initial.time,
    reason: '',
  })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function setField(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const next = {}
    const checks = {
      reference: withReference ? validateReference(values.reference) : '',
      amount: validateAmount(values.amount),
      fee: validateFee(values.fee),
      name: validateName(values.name),
      notes: validateNotes(values.notes),
      datetime: validateDateTime(values.date, values.time),
      reason: validateReason(values.reason),
    }
    Object.entries(checks).forEach(([key, message]) => {
      if (message) next[key] = message
    })
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    setSubmitError('')
    try {
      await updateTransaction(
        transaction.id,
        {
          referenceNumber: withReference ? values.reference : null,
          amount: parseMoney(values.amount),
          feeAmount: parseMoney(values.fee),
          name: values.name,
          notes: values.notes,
          // Untouched date/time keeps the ORIGINAL timestamp (with its seconds), so a
          // simple amount fix never rewrites the time or logs a fake time change.
          transactionTimestamp:
            values.date === initial.date && values.time === initial.time
              ? transaction.transactionTimestamp
              : toManilaTimestamp(values.date, values.time),
        },
        values.reason,
        profile,
      )
      toast.success('Changes saved. Totals were updated.')
      onDone()
    } catch (caught) {
      setSubmitError(caught.message || 'Could not save the changes.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Edit transaction"
      onClose={onClose}
      dismissible={!submitting}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting} className="min-h-12">
            Cancel
          </Button>
          <Button type="submit" form="edit-form" loading={submitting} className="min-h-12">
            Save changes
          </Button>
        </div>
      }
    >
      <form id="edit-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
          To change Cash In / Cash Out, void this record and enter a new one.
        </p>

        {withReference && (
        <FormField id="edit-reference" label="Reference number" error={errors.reference}>
          <input
            {...fieldProps('edit-reference', errors.reference)}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={values.reference}
            onChange={(event) => setField('reference', event.target.value)}
            onBlur={() => setField('reference', normalizeReference(values.reference))}
            className={`${inputClass(Boolean(errors.reference))} font-mono`}
          />
        </FormField>
        )}

        <FormField id="edit-amount" label="Amount (₱)" error={errors.amount}>
          <input
            {...fieldProps('edit-amount', errors.amount)}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={values.amount}
            onChange={(event) => setField('amount', event.target.value.replace(/[^\d.,]/g, ''))}
            className={`${inputClass(Boolean(errors.amount))} font-semibold tabular-nums`}
          />
        </FormField>

        <FormField
          id="edit-fee"
          label="Fee (₱)"
          error={errors.fee}
          hint="Charged on top of the amount. Changing the amount? Tap 'Use fee table' to recalculate."
        >
          <div className="flex gap-2">
            <input
              {...fieldProps('edit-fee', errors.fee, true)}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.fee}
              onChange={(event) => setField('fee', event.target.value.replace(/[^\d.,]/g, ''))}
              className={`${inputClass(Boolean(errors.fee))} font-semibold tabular-nums`}
            />
            {feesReady && tiers.length > 0 && (
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => {
                  const amount = parseMoney(values.amount)
                  if (!Number.isNaN(amount) && amount > 0) setField('fee', String(calculateFee(tiers, amount).fee))
                }}
              >
                Use fee table
              </Button>
            )}
          </div>
        </FormField>

        <FormField id="edit-name" label="Sender / receiver name" optional error={errors.name}>
          <input
            {...fieldProps('edit-name', errors.name)}
            type="text"
            autoComplete="off"
            value={values.name}
            onChange={(event) => setField('name', event.target.value)}
            className={inputClass(Boolean(errors.name))}
          />
        </FormField>

        <FormField id="edit-notes" label="Notes" optional error={errors.notes}>
          <textarea
            {...fieldProps('edit-notes', errors.notes)}
            rows={2}
            value={values.notes}
            onChange={(event) => setField('notes', event.target.value)}
            className={`${inputClass(Boolean(errors.notes))} min-h-20 py-3`}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField id="edit-date" label="Date" error={errors.datetime}>
            <input
              {...fieldProps('edit-date', errors.datetime)}
              type="date"
              max={getManilaNowParts().date}
              value={values.date}
              onChange={(event) => setField('date', event.target.value)}
              className={inputClass(Boolean(errors.datetime))}
            />
          </FormField>
          <FormField id="edit-time" label="Time">
            <input
              id="edit-time"
              type="time"
              value={values.time}
              onChange={(event) => setField('time', event.target.value)}
              className={inputClass(Boolean(errors.datetime))}
            />
          </FormField>
        </div>

        <FormField
          id="edit-reason"
          label="Reason for this change"
          error={errors.reason}
          hint="Required. This is saved in the history."
        >
          <textarea
            {...fieldProps('edit-reason', errors.reason, true)}
            rows={2}
            value={values.reason}
            onChange={(event) => setField('reason', event.target.value)}
            className={`${inputClass(Boolean(errors.reason))} min-h-20 py-3`}
            placeholder="Example: Typo in the amount"
          />
        </FormField>

        {submitError && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {submitError}
          </p>
        )}
      </form>
    </Modal>
  )
}
