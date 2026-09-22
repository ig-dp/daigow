import { getRouterParam } from 'h3'
import { apiError } from '../../../utils/api-error'
import { requireSeller } from '../../../utils/require-seller'
import { getOwnedTrip } from '../../../repositories/trip.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const tripId = getRouterParam(event, 'id')!
  const { data, error } = await getOwnedTrip(event, seller.id, tripId)

  if (error?.code === 'PGRST116') throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  if (!data) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')

  return { trip: data }
})
