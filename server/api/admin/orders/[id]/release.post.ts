import { apiError } from '../../../../utils/api-error'
import { requireAdmin } from '../../../../utils/require-admin'
import { getAdminOrder, resolveAdminOrder } from '../../../../repositories/order.repository'
import { createPayoutForOrder } from '../../../../repositories/payout.repository'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const orderId = getRouterParam(event, 'id')!
  const { data: order, error: findError } = await getAdminOrder(event, orderId)
  if (findError?.code === 'PGRST116' || !order) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  if (!order.issue_reported_at || order.issue_resolved_at) throw apiError(409, 'INVALID_STATE', 'Order is not on hold')
  if (!['shipped', 'delivered'].includes(order.status)) throw apiError(409, 'INVALID_STATE', 'Order is not shipped or delivered')

  const now = new Date().toISOString()
  const { data, error } = await resolveAdminOrder(event, orderId, ['shipped', 'delivered'], {
    status: 'completed',
    completed_by: 'admin',
    completed_at: now,
    settled_at: now,
    issue_resolved_at: now,
    issue_resolution: 'released',
    issue_resolved_by: admin.id,
  })
  if (error?.code === 'PGRST116') throw apiError(409, 'INVALID_STATE', 'Order was already resolved')
  if (error || !data) throw apiError(500, 'INTERNAL_ERROR', 'Failed to release order')

  try {
    await createPayoutForOrder(event, orderId)
  } catch (err) {
    console.error('create payout failed:', (err as Error).message)
    throw apiError(500, 'PAYOUT_ERROR', 'Order released but payout could not be initialized')
  }
  return { order: data }
})
