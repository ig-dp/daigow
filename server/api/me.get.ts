import { apiError } from '../utils/api-error'
import { requireUser } from '../utils/auth'
import { getProfile } from '../repositories/profile.repository'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { data, error } = await getProfile(event, user.id)
  if (error?.code === 'PGRST116') throw apiError(404, 'PROFILE_NOT_FOUND', 'Profile not found')
  if (error) {
    console.error('getProfile failed:', error.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load profile')
  }
  if (!data) throw apiError(404, 'PROFILE_NOT_FOUND', 'Profile not found')
  return { profile: data }
})
