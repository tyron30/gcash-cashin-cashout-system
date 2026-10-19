export const STORE_TIME_ZONE = 'Asia/Manila'

// Today's business date in Manila, e.g. "2026-10-13"
export function getTodayInManila() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// addDays("2026-10-13", -1) -> "2026-10-12"
export function addDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

// "2026-10-13" -> "Tuesday, October 13, 2026"
export function formatBusinessDate(dateString) {
  const date = new Date(`${dateString}T12:00:00+08:00`)
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: STORE_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

// ISO timestamp -> "9:12 am" (Manila time)
export function formatTime(isoString) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: STORE_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString))
}

// ("2026-10-13", "09:12") -> "2026-10-13T09:12:00+08:00"
export function toManilaTimestamp(dateString, timeString) {
  return `${dateString}T${timeString}:00+08:00`
}

// ---------- Added in Phase 2 ----------

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// Any ISO timestamp -> Manila business date ("YYYY-MM-DD").
// A transaction at 11:30 pm Manila time belongs to THAT Manila day,
// even though the UTC date is different. This is the midnight-boundary rule.
export function getBusinessDateFromTimestamp(isoString) {
  return businessDateFormatter.format(new Date(isoString))
}

function getManilaParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type).value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

// { date: "2026-10-13", time: "14:05" } in Manila time
export function getManilaNowParts() {
  return getManilaParts(new Date())
}

// Splits an ISO timestamp into Manila { date, time } for form inputs.
export function getTimestampParts(isoString) {
  return getManilaParts(new Date(isoString))
}

// "2026-10-13" -> "Oct 13"
export function formatShortDate(dateString) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: STORE_TIME_ZONE,
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateString}T12:00:00+08:00`))
}

// ISO timestamp -> "Oct 13, 2026, 9:12 am"
export function formatDateTime(isoString) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: STORE_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString))
}

// eachDate("2026-10-01", "2026-10-03") -> ["2026-10-01", "2026-10-02", "2026-10-03"]
export function eachDate(from, to) {
  const days = []
  let current = from
  while (current <= to && days.length < 400) {
    days.push(current)
    current = addDays(current, 1)
  }
  return days
}

// "2026-10-13" -> "2026-10-01"
export function getMonthStart(dateString) {
  return `${dateString.slice(0, 8)}01`
}
