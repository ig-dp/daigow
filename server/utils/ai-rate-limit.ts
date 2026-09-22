// ponytail: in-memory limiter resets on deploy; use shared storage when multiple instances matter
const WINDOW_MS = 60 * 60 * 1000
const MAX_REQUESTS = 10
const requests = new Map<string, number[]>()

export function consumeAiRequest(userId: string) {
  const now = Date.now()
  const recent = (requests.get(userId) ?? []).filter((time) => now - time < WINDOW_MS)
  if (recent.length >= MAX_REQUESTS) {
    requests.set(userId, recent)
    return false
  }
  recent.push(now)
  requests.set(userId, recent)
  return true
}
