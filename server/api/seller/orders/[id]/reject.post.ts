import { readBody } from 'h3'
import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { sendEmail } from '../../../../utils/mailer'
import { getOwnedOrder, updateOrderStatus } from '../../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const orderId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.reason !== 'string' || !body.reason) throw apiError(400, 'INVALID_INPUT', 'reason must be a non-empty string')
  const { data: order, error: findError } = await getOwnedOrder(event, seller.id, orderId)
  if (findError?.code === 'PGRST116' || !order) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  if (order.status !== 'awaiting_confirmation') throw apiError(409, 'INVALID_STATE', 'Order is not awaiting confirmation')
  if (new Date(order.confirmation_deadline).getTime() <= Date.now()) throw apiError(409, 'DEADLINE_PASSED', 'Confirmation deadline has passed')
  const { data, error } = await updateOrderStatus(event, orderId, { status: 'cancelled', cancellation_reason: body.reason, cancelled_by: 'jastiper', settled_at: new Date().toISOString() }, 'awaiting_confirmation')
  if (error?.code === 'PGRST116') throw apiError(409, 'INVALID_STATE', 'Order status changed')
  if (error || !data) { console.error('reject order failed:', error?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to reject order') }
  sendEmail(order.buyer_email, 'Pesanan ditolak', `Alasan: ${body.reason}`)
  return { order: data }
})
