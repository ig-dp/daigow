import { readBody } from 'h3'
import { apiError } from '../../../utils/api-error'
import { requireSeller } from '../../../utils/require-seller'
import { getOwnedTrip, updateTrip } from '../../../repositories/trip.repository'

const ALLOWED_KEYS = new Set(['title', 'destination', 'thumbnail_url', 'order_open_at', 'order_close_at', 'description'])

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const tripId = getRouterParam(event, 'id')!
  const body = await readBody(event)

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  }

  const keys = Object.keys(body)
  if (keys.length === 0) throw apiError(400, 'INVALID_INPUT', 'At least one field is required')

  for (const key of keys) {
    if (!ALLOWED_KEYS.has(key)) throw apiError(400, 'INVALID_INPUT', `Unknown field: ${key}`)
    if (key === 'description') {
      if (typeof body[key] !== 'string') throw apiError(400, 'INVALID_INPUT', 'description must be a string')
      continue
    }
    if (typeof body[key] !== 'string' || body[key].length === 0) {
      throw apiError(400, 'INVALID_INPUT', `${key} must be a non-empty string`)
    }
  }

  if ('destination' in body && !isCountryCode(body.destination)) {
    throw apiError(400, 'INVALID_INPUT', 'destination must be an ISO 3166-1 alpha-2 country code')
  }

  const { data: existing, error: findError } = await getOwnedTrip(event, seller.id, tripId)
  if (findError?.code === 'PGRST116') throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (findError) {
    console.error('getOwnedTrip failed:', findError.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  }
  if (!existing) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (existing.status === 'closed') throw apiError(409, 'INVALID_STATE', 'Closed trips cannot be edited')

  const { data, error } = await updateTrip(event, seller.id, tripId, body)
  if (error || !data) {
    console.error('updateTrip failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to update trip')
  }

  return { trip: data }
})
