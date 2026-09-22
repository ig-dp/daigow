import { apiError } from '../../utils/api-error'
import { requireSeller } from '../../utils/require-seller'
import { listTrips } from '../../repositories/trip.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const { data, error } = await listTrips(event, seller.id)

  if (error) {
    console.error('listTrips failed:', error.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trips')
  }

  return { trips: data ?? [] }
})
