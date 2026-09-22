import { apiError } from '../../../utils/api-error'
import { getTripBySlug } from '../../../repositories/trip-public.repository'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const { data, error } = await getTripBySlug(event, slug)

  if (error?.code === 'PGRST116') throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (error) {
    console.error('getTripBySlug failed:', error.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  }
  if (!data) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')

  return { trip: data.status === 'coming_soon' ? { ...data, products: [] } : data }
})
