import { readBody } from 'h3'
import { apiError } from '../../utils/api-error'
import { requireSeller } from '../../utils/require-seller'
import { insertTrip } from '../../repositories/trip.repository'

const REQUIRED_KEYS = ['title', 'destination', 'thumbnail_url', 'order_open_at', 'order_close_at'] as const
const ALLOWED_KEYS = new Set<string>([...REQUIRED_KEYS, 'description'])

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const body = await readBody(event)

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) throw apiError(400, 'INVALID_INPUT', `Unknown field: ${key}`)
  }

  for (const key of REQUIRED_KEYS) {
    if (typeof body[key] !== 'string' || body[key].length === 0) {
      throw apiError(400, 'INVALID_INPUT', `${key} must be a non-empty string`)
    }
  }

  if ('description' in body && typeof body.description !== 'string') {
    throw apiError(400, 'INVALID_INPUT', 'description must be a string')
  }

  const { data, error } = await insertTrip(event, seller.id, {
    title: body.title,
    destination: body.destination,
    description: body.description,
    thumbnail_url: body.thumbnail_url,
    order_open_at: body.order_open_at,
    order_close_at: body.order_close_at
  })

  if (error || !data) {
    console.error('insertTrip failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to create trip')
  }

  return { trip: data }
})
