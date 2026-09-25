import { apiError } from '../../utils/api-error'
import { requireSeller } from '../../utils/require-seller'
import { listTrips } from '../../repositories/trip.repository'
import { countAwaitingConfirmationByTrip } from '../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const { data, error } = await listTrips(event, seller.id)

  if (error) {
    console.error('listTrips failed:', error.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trips')
  }

  const trips = data ?? []
  const { counts, error: countError } = await countAwaitingConfirmationByTrip(event, trips.map(trip => trip.id))
  if (countError) {
    console.error('countAwaitingConfirmationByTrip failed:', countError.message)
    throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trips')
  }

  return { trips: trips.map(trip => ({ ...trip, awaiting_confirmation_count: counts.get(trip.id) ?? 0 })) }
})
