import { readBody } from 'h3'
import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { getOwnedTrip } from '../../../../repositories/trip.repository'
import { insertProduct } from '../../../../repositories/product.repository'

const ALLOWED_KEYS = new Set(['name', 'category', 'description', 'description_source', 'price', 'photos', 'variants'])
const DESCRIPTION_SOURCES = new Set(['manual', 'ai', 'ai_edited'])
const isPrice = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0
const isPhoto = (value: any) => value && typeof value === 'object' && !Array.isArray(value) && typeof value.photo_url === 'string' && value.photo_url.length > 0 && Number.isInteger(value.sort_order)
const isVariant = (value: any) => value && typeof value === 'object' && !Array.isArray(value) && typeof value.name === 'string' && value.name.length > 0 && isPrice(value.price) && (!('photo_url' in value) || typeof value.photo_url === 'string')

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const tripId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  for (const key of Object.keys(body)) if (!ALLOWED_KEYS.has(key)) throw apiError(400, 'INVALID_INPUT', `Unknown field: ${key}`)
  if (typeof body.name !== 'string' || !body.name) throw apiError(400, 'INVALID_INPUT', 'name must be a non-empty string')
  if (!DESCRIPTION_SOURCES.has(body.description_source)) throw apiError(400, 'INVALID_INPUT', 'description_source must be manual, ai, or ai_edited')
  if (!isPrice(body.price)) throw apiError(400, 'INVALID_INPUT', 'price must be a non-negative integer')
  if ('category' in body && typeof body.category !== 'string') throw apiError(400, 'INVALID_INPUT', 'category must be a string')
  if ('description' in body && typeof body.description !== 'string') throw apiError(400, 'INVALID_INPUT', 'description must be a string')
  if (!Array.isArray(body.photos) || !body.photos.length || !body.photos.every(isPhoto)) throw apiError(400, 'INVALID_INPUT', 'photos must be a non-empty array of { photo_url, sort_order }')
  if ('variants' in body && (!Array.isArray(body.variants) || !body.variants.every(isVariant))) throw apiError(400, 'INVALID_INPUT', 'variants must be an array of { name, price, photo_url? }')

  const { data: trip, error: tripError } = await getOwnedTrip(event, seller.id, tripId)
  if (tripError?.code === 'PGRST116' || !trip) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (tripError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')

  const { data, error } = await insertProduct(event, tripId, body)
  if (error || !data) { console.error('insertProduct failed:', error?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to create product') }
  return { product: data }
})
