import { apiError } from '../../../utils/api-error'
import { requireOrderAccess } from '../../../utils/order-access'
import { updateOrderStatus } from '../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const order = await requireOrderAccess(event, getRouterParam(event, 'id')!)
  if (order.status !== 'shipped') throw apiError(409, 'INVALID_STATE', 'Order is not shipped')
  const now = new Date()
  const { data, error } = await updateOrderStatus(event, order.id, { status: 'delivered', delivered_by: 'buyer', delivered_at: now.toISOString(), auto_complete_at: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString() })
  if (error || !data) throw apiError(500, 'INTERNAL_ERROR', 'Failed to mark order delivered')
  return { order: data }
})
