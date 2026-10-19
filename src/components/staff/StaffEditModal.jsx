import { useState } from 'react'
import Button from '../common/Button'
import Modal from '../common/Modal'
import FormField, { fieldProps } from '../forms/FormField'
import { inputClass } from '../forms/inputStyles'
import { useToast } from '../../hooks/useToast'
import { updateStaff } from '../../services/staffService'
import { cleanText } from '../../utils/validation'

export default function StaffEditModal({ person, isSelf, onClose, onDone }) {
  const toast = useToast()
  const [fullName, setFullName] = useState(person.fullName)
  const [role, setRole] = useState(person.role)
  const [isActive, setIsActive] = useState(person.isActive)
  const [nameError, setNameError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const name = cleanText(fullName)
    if (!name) {
      setNameError('Enter a name.')
      return
    }
    if (name.length > 80) {
      setNameError('Keep the name under 80 characters.')
      return
    }

    const changes = {}
    if (name !== person.fullName) changes.fullName = name
    if (role !== person.role) changes.role = role
    if (isActive !== person.isActive) changes.isActive = isActive
    if (Object.keys(changes).length === 0) {
      setSubmitError('Nothing was changed.')
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      await updateStaff(person.id, changes)
      toast.success(`${name} was updated.`)
      onDone()
    } catch (error) {
      setSubmitError(error.message || 'Could not save the changes.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Manage access"
      onClose={onClose}
      dismissible={!submitting}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting} className="min-h-12">
            Cancel
          </Button>
          <Button type="submit" form="staff-form" loading={submitting} className="min-h-12">
            Save
          </Button>
        </div>
      }
    >
      <form id="staff-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-sm text-slate-600">{person.email}</p>

        <FormField id="staff-name" label="Name" error={nameError}>
          <input
            {...fieldProps('staff-name', nameError)}
            type="text"
            autoComplete="off"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value)
              setNameError('')
              setSubmitError('')
            }}
            className={inputClass(Boolean(nameError))}
          />
        </FormField>

        <FormField
          id="staff-role"
          label="Role"
          hint="Owners can see everything and manage the store. Staff can only record and view today."
        >
          <select
            id="staff-role"
            value={role}
            disabled={isSelf}
            onChange={(event) => {
              setRole(event.target.value)
              setSubmitError('')
            }}
            className={inputClass(false)}
          >
            <option value="staff">Staff</option>
            <option value="admin">Owner (admin)</option>
          </select>
        </FormField>

        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-300 px-3.5">
          <input
            type="checkbox"
            checked={isActive}
            disabled={isSelf}
            onChange={(event) => {
              setIsActive(event.target.checked)
              setSubmitError('')
            }}
            className="size-5 accent-emerald-700"
          />
          <span className="text-sm font-semibold">Account is active</span>
        </label>

        {isSelf && (
          <p className="text-sm text-slate-600">
            You cannot change your own role or deactivate your own account. This prevents locking yourself out.
          </p>
        )}

        {submitError && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {submitError}
          </p>
        )}
      </form>
    </Modal>
  )
}
