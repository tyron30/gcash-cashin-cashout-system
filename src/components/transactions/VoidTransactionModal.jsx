import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import Button from '../common/Button'
import Modal from '../common/Modal'
import FormField, { fieldProps } from '../forms/FormField'
import { inputClass } from '../forms/inputStyles'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { voidTransaction } from '../../services/transactionService'
import { formatPeso } from '../../utils/currency'
import { validateReason } from '../../utils/validation'

export default function VoidTransactionModal({ transaction, onClose, onDone }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const problem = validateReason(reason)
    setError(problem)
    if (problem) return

    setSubmitting(true)
    setSubmitError('')
    try {
      await voidTransaction(transaction.id, reason, profile)
      toast.success('Transaction voided. It is no longer counted in totals.')
      onDone()
    } catch (caught) {
      setSubmitError(caught.message || 'Could not void the transaction.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Void this transaction?"
      onClose={onClose}
      dismissible={!submitting}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting} className="min-h-12">
            Keep it
          </Button>
          <Button variant="danger" type="submit" form="void-form" loading={submitting} className="min-h-12">
            Void transaction
          </Button>
        </div>
      }
    >
      <form id="void-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            {formatPeso(transaction.amount)} ({transaction.referenceNumber}) will be marked as voided and removed from
            all totals. The record stays in the history and cannot be un-voided.
          </p>
        </div>

        <FormField id="void-reason" label="Reason for voiding" error={error} hint="Required. This is saved in the history.">
          <textarea
            {...fieldProps('void-reason', error, true)}
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setError('')
            }}
            className={`${inputClass(Boolean(error))} min-h-24 py-3`}
            placeholder="Example: Wrong amount entered"
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
