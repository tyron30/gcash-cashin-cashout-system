import { formatPeso } from './currency'
import { getManilaNowParts } from './date'

export const MAX_AMOUNT = 999999.99
export const MAX_NAME_LENGTH = 60
export const MAX_NOTES_LENGTH = 200
export const MAX_CLOSING_NOTES_LENGTH = 500

// Letters (any language), asterisks, spaces, and a few name punctuation marks.
const NAME_PATTERN = /^[\p{L}\p{M}*.,'’\- ]+$/u

// Trim and collapse repeated spaces.
export function cleanText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

// Keeps the reference as TEXT (leading zeros are never lost).
// A plain 13-digit number is shown in GCash style: 0143 872 590316
export function normalizeReference(value) {
  const text = cleanText(value)
  if (/^\d{13}$/.test(text)) {
    return `${text.slice(0, 4)} ${text.slice(4, 7)} ${text.slice(7)}`
  }
  return text
}

// Used for comparing/searching: no spaces, upper case.
export function referenceKey(value) {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase()
}

// Returns an error message, or '' when valid.
export function validateReference(value) {
  const text = normalizeReference(value)
  if (!text) return 'Enter the reference number.'
  const key = referenceKey(text)
  if (!/^[A-Z0-9]+$/.test(key)) return 'Use only numbers, letters, and spaces.'
  if (key.length < 8 || key.length > 20) {
    return 'Reference numbers are usually 13 digits. Check for missing or extra digits.'
  }
  return ''
}

export function cleanMoneyInput(value) {
  return String(value ?? '').replace(/[₱,\s]/g, '')
}

// "1,500.50" -> 1500.5. Returns NaN when it is not a valid peso amount.
export function parseMoney(value) {
  const cleaned = cleanMoneyInput(value)
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN
  return Number(cleaned)
}

export function validateAmount(value) {
  const cleaned = cleanMoneyInput(value)
  if (!cleaned) return 'Enter the amount.'
  if (cleaned.startsWith('-')) return 'Amount cannot be negative.'
  const amount = parseMoney(value)
  if (Number.isNaN(amount)) {
    return 'Enter a valid peso amount, such as 1500 or 1,500.50 (up to 2 decimals).'
  }
  if (amount <= 0) return 'Amount must be greater than zero.'
  if (amount > MAX_AMOUNT) {
    return `Amount is too large. The maximum is ${formatPeso(MAX_AMOUNT)}.`
  }
  return ''
}

// For optional peso fields (zero is allowed).
export function validateOptionalMoney(value, label) {
  const cleaned = cleanMoneyInput(value)
  if (!cleaned) return ''
  if (cleaned.startsWith('-')) return `${label} cannot be negative.`
  const amount = parseMoney(value)
  if (Number.isNaN(amount)) return `Enter a valid peso amount for ${label.toLowerCase()}.`
  if (amount > MAX_AMOUNT) return `${label} is too large.`
  return ''
}

export function validateName(value) {
  const text = cleanText(value)
  if (!text) return ''
  if (text.length > MAX_NAME_LENGTH) {
    return `Keep the name under ${MAX_NAME_LENGTH} characters.`
  }
  if (!NAME_PATTERN.test(text)) {
    return 'Use letters and asterisks only, like JU**** DE**.'
  }
  return ''
}

export function validateNotes(value, max = MAX_NOTES_LENGTH) {
  if (String(value ?? '').trim().length > max) {
    return `Keep notes under ${max} characters.`
  }
  return ''
}

// Date and time in Manila time. Cannot be in the future.
export function validateDateTime(date, time) {
  if (!date || !time) return 'Choose both a date and a time.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return 'Enter a valid date and time.'
  }
  const now = getManilaNowParts()
  if (date > now.date || (date === now.date && time > now.time)) {
    return 'Date and time cannot be in the future.'
  }
  return ''
}

// A required explanation for edits, voids, and reopening a closed day.
export function validateReason(value) {
  const text = cleanText(value)
  if (text.length < 5) return 'Enter a reason (at least 5 characters).'
  if (text.length > 200) return 'Keep the reason under 200 characters.'
  return ''
}
