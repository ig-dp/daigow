import { apiError } from '../../../utils/api-error'
import { requireAdmin } from '../../../utils/require-admin'
import { getAdminOrder } from '../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { data, error } = await getAdminOrder(event, getRouterParam(event, 'id')!)
  if (error?.code === 'PGRST116' || !data) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  return { order: data }
})
