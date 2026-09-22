import { readBody } from 'h3'
import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { sendEmail } from '../../../../utils/mailer'
import { getOwnedOrder, updateOrderStatus } from '../../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const orderId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  const hasEvidence = typeof body.shipping_evidence_url === 'string' && body.shipping_evidence_url.length > 0
  const hasTracking = typeof body.tracking_number === 'string' && body.tracking_number.length > 0
  if (!hasEvidence && !hasTracking) throw apiError(400, 'INVALID_INPUT', 'shipping_evidence_url or tracking_number is required')
  const { data: order, error: findError } = await getOwnedOrder(event, seller.id, orderId)
  if (findError?.code === 'PGRST116' || !order) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  if (order.status !== 'processing') throw apiError(409, 'INVALID_STATE', 'Order is not processing')
  if (order.issue_reported_at && !order.issue_resolved_at) throw apiError(409, 'ORDER_ON_HOLD', 'Order is on hold while an issue is reviewed')
  const { data, error } = await updateOrderStatus(event, orderId, { status: 'shipped', shipping_evidence_url: hasEvidence ? body.shipping_evidence_url : null, tracking_number: hasTracking ? body.tracking_number : null, shipped_at: new Date().toISOString() }, 'processing', true)
  if (error?.code === 'PGRST116') throw apiError(409, 'INVALID_STATE', 'Order status changed or is on hold')
  if (error || !data) { console.error('ship order failed:', error?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to ship order') }
  sendEmail(order.buyer_email, 'Pesanan dikirim', 'Pesanan Anda sedang dalam perjalanan.')
  return { order: data }
})
