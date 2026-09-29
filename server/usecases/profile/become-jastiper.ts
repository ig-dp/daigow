import { timingSafeEqual, createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { getProfile, setRole } from '../../repositories/profile.repository'
import { apiError } from '../../utils/api-error'
import { consumeInviteAttempt } from '../../utils/invite-rate-limit'

function inviteMatches(input: string, expected: string): boolean {
  const inputHash = createHash('sha256').update(input).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(inputHash, expectedHash)
}

export async function becomeJastiper(event: H3Event, userId: string, code: string) {
  const { data: profile, error: profileError } = await getProfile(event, userId)
  if (profileError?.code === 'PGRST116') throw apiError(404, 'PROFILE_NOT_FOUND', 'Profile not found')
  if (profileError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load profile')
  if (!profile) throw apiError(404, 'PROFILE_NOT_FOUND', 'Profile not found')
  if (profile.role === 'jastiper' || profile.role === 'admin') {
    throw apiError(409, 'INVALID_STATE', 'Profile is already a jastiper')
  }

  const expected = process.env.JASTIPER_INVITE_CODE
  if (!expected) throw apiError(500, 'INTERNAL_ERROR', 'Invite code is not configured')

  if (!consumeInviteAttempt(userId)) throw apiError(429, 'RATE_LIMITED', 'Too many invite attempts')

  if (!inviteMatches(code, expected)) throw apiError(403, 'INVALID_INVITE_CODE', 'Invalid invite code')

  const { data, error } = await setRole(event, userId, 'jastiper')
  if (error || !data) {
    console.error('setRole failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to update profile')
  }
  return data
}
