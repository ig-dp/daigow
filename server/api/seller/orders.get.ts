import { getQuery } from 'h3'
import { apiError } from '../../utils/api-error'
import { requireSeller } from '../../utils/require-seller'
import { listSellerOrders } from '../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const query = getQuery(event)
  const trip_id = typeof query.trip_id === 'string' ? query.trip_id : undefined
  const status = typeof query.status === 'string' ? query.status : undefined
  const { data, error } = await listSellerOrders(event, seller.id, { trip_id, status })
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load orders')
  return { orders: data ?? [] }
})
