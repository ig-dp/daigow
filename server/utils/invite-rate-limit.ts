// ponytail: in-memory limiter resets on deploy; use shared storage when multiple instances matter

const MAX_ATTEMPTS = 5
const WINDOW_MS = 60 * 60 * 1000

const attempts = new Map<string, number[]>()

/** Records an attempt and returns true if the user is within their rate limit. */
export function consumeInviteAttempt(userId: string): boolean {
  const now = Date.now()
  const timestamps = (attempts.get(userId) ?? []).filter((t) => now - t < WINDOW_MS)

  if (timestamps.length >= MAX_ATTEMPTS) {
    attempts.set(userId, timestamps)
    return false
  }

  timestamps.push(now)
  attempts.set(userId, timestamps)
  return true
}
