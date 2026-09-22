import type { H3Event } from 'h3'
import { apiError } from './api-error'
import { requireUser } from './auth'
import { getProfile } from '../repositories/profile.repository'

export async function requireAdmin(event: H3Event) {
  const user = await requireUser(event)
  const { data, error } = await getProfile(event, user.id)
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load profile')
  if (!data || data.role !== 'admin') throw apiError(403, 'FORBIDDEN', 'Admin access required')
  return user
}
