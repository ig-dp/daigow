import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { getOwnedTrip, openTrip } from '../../../../repositories/trip.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const tripId = getRouterParam(event, 'id')!

  const { data: existing, error: findError } = await getOwnedTrip(event, seller.id, tripId)
  if (findError?.code === 'PGRST116') throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (findError) {
    console.error('getOwnedTrip failed:', findError.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  }
  if (!existing) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (existing.status !== 'coming_soon') throw apiError(409, 'INVALID_STATE', 'Trip cannot be opened')

  const { data, error } = await openTrip(event, seller.id, tripId)
  if (error || !data) {
    console.error('openTrip failed:', error?.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to open trip')
  }

  return { trip: data }
})
