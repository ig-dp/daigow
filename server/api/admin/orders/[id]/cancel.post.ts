import { readBody } from 'h3'
import { apiError } from '../../../../utils/api-error'
import { requireAdmin } from '../../../../utils/require-admin'
import { sendEmail } from '../../../../utils/mailer'
import { adminCancelRefund } from '#shared/utils/refund-amount.mjs'
import { getAdminOrder, resolveAdminOrder, cancelActiveOrderItems, insertRefund } from '../../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  if (!body || typeof body.reason !== 'string' || !body.reason.trim()) throw apiError(400, 'INVALID_INPUT', 'reason must be a non-empty string')
  const orderId = getRouterParam(event, 'id')!
  const { data: order, error: findError } = await getAdminOrder(event, orderId)
  if (findError?.code === 'PGRST116' || !order) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  if (!order.issue_reported_at || order.issue_resolved_at) throw apiError(409, 'INVALID_STATE', 'Order is not on hold')

  // On-hold orders are always paid (issues are only reportable from processing on), so a refund is always owed.
  // Items can't change while on hold, so computing from the loaded order is safe.
  const amount = adminCancelRefund(order)

  const now = new Date().toISOString()
  const { data, error } = await resolveAdminOrder(event, orderId, ['processing', 'shipped', 'delivered'], {
    status: 'cancelled',
    cancellation_reason: body.reason.trim(),
    cancelled_by: 'admin',
    settled_at: now,
    issue_resolved_at: now,
    issue_resolution: 'cancelled',
    issue_resolved_by: admin.id,
  })
  if (error?.code === 'PGRST116') throw apiError(409, 'INVALID_STATE', 'Order was already resolved')
  if (error || !data) throw apiError(500, 'INTERNAL_ERROR', 'Failed to cancel order')

  // ponytail: order cancel, item cancel and refund insert aren't one transaction; move into a Postgres function if REFUND_ERROR ever shows up.
  const { error: itemsError } = await cancelActiveOrderItems(event, orderId)
  if (itemsError) console.error('cancel items after admin cancel failed:', itemsError.message)
  const { data: refund, error: refundError } = await insertRefund(event, { order_id: orderId, order_item_id: null, refund_type: 'admin_cancel', ...amount })
  if (refundError || !refund) {
    console.error(`admin_cancel refund insert failed for order ${orderId}:`, refundError?.message)
    throw apiError(500, 'REFUND_ERROR', 'Order cancelled but refund could not be recorded')
  }

  sendEmail(order.buyer_email, 'Pesanan dibatalkan', `Pesanan ${order.order_number} dibatalkan oleh admin. Refund sebesar ${amount.total_refund_amount} akan diproses.`)
  return { order: data, refund }
})
