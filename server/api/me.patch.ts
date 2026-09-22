import { readBody } from 'h3'
import { apiError } from '../utils/api-error'
import { requireUser } from '../utils/auth'
import { updateProfile } from '../repositories/profile.repository'

const ALLOWED_KEYS = new Set(['name', 'phone'])

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) throw apiError(400, 'INVALID_INPUT', `Unknown field: ${key}`)
  }

  const values: { name?: string; phone?: string | null } = {}

  if ('name' in body) {
    if (typeof body.name !== 'string' || body.name.length === 0) {
      throw apiError(400, 'INVALID_INPUT', 'name must be a non-empty string')
    }
    values.name = body.name
  }

  if ('phone' in body) {
    if (body.phone !== null && typeof body.phone !== 'string') {
      throw apiError(400, 'INVALID_INPUT', 'phone must be a string or null')
    }
    values.phone = body.phone
  }

  if (Object.keys(values).length === 0) {
    throw apiError(400, 'INVALID_INPUT', 'At least one of name or phone is required')
  }

  const { data, error } = await updateProfile(event, user.id, values)
  if (error?.code === 'PGRST116') throw apiError(404, 'PROFILE_NOT_FOUND', 'Profile not found')
  if (error) {
    console.error('updateProfile failed:', error.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to update profile')
  }
  if (!data) throw apiError(404, 'PROFILE_NOT_FOUND', 'Profile not found')
  return { profile: data }
})
