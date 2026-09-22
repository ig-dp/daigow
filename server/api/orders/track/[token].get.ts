import { apiError } from '../../../utils/api-error'
import { getOrderByTrackingToken } from '../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')!
  const { data, error } = await getOrderByTrackingToken(event, token)
  if (error?.code === 'PGRST116' || !data) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  return { order: data }
})
