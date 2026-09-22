import { readBody } from 'h3'
import { apiError } from '../../../utils/api-error'
import { getTripStatus, insertSubscriber } from '../../../repositories/trip-public.repository'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id')!
  const body = await readBody(event)

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  }

  if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email)) {
    throw apiError(400, 'INVALID_INPUT', 'email must be a valid email address')
  }

  const { data: trip, error: tripError } = await getTripStatus(event, tripId)
  if (tripError?.code === 'PGRST116') throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (tripError) {
    console.error('getTripStatus failed:', tripError.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  }
  if (!trip) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (trip.status !== 'coming_soon') throw apiError(409, 'INVALID_STATE', 'Trip is not accepting subscribers')

  const { data, error } = await insertSubscriber(event, tripId, body.email)
  if (error || !data) {
    console.error('insertSubscriber failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to subscribe')
  }

  return { subscriber: data }
})
