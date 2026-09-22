import { readBody } from 'h3'
import { apiError } from '../../../../utils/api-error'
import { requireAdmin } from '../../../../utils/require-admin'
import { getAdminOrder, updateAdminOrder } from '../../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  if (!body || typeof body.reason !== 'string' || !body.reason.trim()) throw apiError(400, 'INVALID_INPUT', 'reason must be a non-empty string')
  const orderId = getRouterParam(event, 'id')!
  const { data: order, error: findError } = await getAdminOrder(event, orderId)
  if (findError?.code === 'PGRST116' || !order) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  if (!order.issue_reported_at || order.issue_resolved_at) throw apiError(409, 'INVALID_STATE', 'Order is not on hold')

  const now = new Date().toISOString()
  const { data, error } = await updateAdminOrder(event, orderId, {
    status: 'cancelled',
    cancellation_reason: body.reason.trim(),
    cancelled_by: 'admin',
    settled_at: now,
    issue_resolved_at: now,
    issue_resolution: 'cancelled',
    issue_resolved_by: admin.id,
  })
  if (error || !data) throw apiError(500, 'INTERNAL_ERROR', 'Failed to cancel order')
  return { order: data, refund: null }
})
