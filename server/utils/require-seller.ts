import type { H3Event } from 'h3'
import { apiError } from './api-error'
import { requireUser } from './auth'
import { getProfile } from '../repositories/profile.repository'

export async function requireSeller(event: H3Event): Promise<{ id: string; role: 'jastiper' | 'admin' }> {
  const user = await requireUser(event)
  const { data: profile, error } = await getProfile(event, user.id)

  if (error?.code === 'PGRST116') throw apiError(404, 'PROFILE_NOT_FOUND', 'Profile not found')
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load profile')
  if (!profile) throw apiError(404, 'PROFILE_NOT_FOUND', 'Profile not found')
  if (profile.role !== 'jastiper' && profile.role !== 'admin') {
    throw apiError(403, 'FORBIDDEN', 'Seller access required')
  }

  return { id: user.id, role: profile.role }
}
