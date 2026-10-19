// Turns database / network errors into short messages a store worker can understand.

let sessionExpiredHandler = null

// AuthContext registers here so any failed request can log the user out cleanly.
export function onSessionExpired(handler) {
  sessionExpiredHandler = handler
  return () => {
    if (sessionExpiredHandler === handler) sessionExpiredHandler = null
  }
}

export class AppError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
  }
}

export function toAppError(error) {
  if (error instanceof AppError) return error

  const message = String(error?.message ?? '')

  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  if (
    offline ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message)
  ) {
    return new AppError('Could not reach the server. Check your internet connection and try again.', 'NETWORK')
  }

  if (error?.code === 'PGRST301' || /jwt expired|invalid jwt/i.test(message)) {
    if (sessionExpiredHandler) sessionExpiredHandler()
    return new AppError('Your session has expired. Please log in again.', 'SESSION_EXPIRED')
  }

  // Raw Postgres permission errors (our own rule messages are already friendly).
  if (/permission denied|row-level security/i.test(message)) {
    return new AppError('You do not have permission to do that.', 'FORBIDDEN')
  }

  return new AppError(message || 'Something went wrong. Please try again.', error?.code)
}

// Awaits a Supabase request and throws a friendly AppError on any failure.
export async function call(request) {
  let result
  try {
    result = await request
  } catch (error) {
    throw toAppError(error)
  }
  if (result.error) throw toAppError(result.error)
  return result
}
