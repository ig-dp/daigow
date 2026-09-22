import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { sendEmail } from '../../../../utils/mailer'
import { getOwnedOrder, updateOrderStatus } from '../../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const orderId = getRouterParam(event, 'id')!
  const { data: order, error: findError } = await getOwnedOrder(event, seller.id, orderId)
  if (findError?.code === 'PGRST116' || !order) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  if (order.status !== 'awaiting_confirmation') throw apiError(409, 'INVALID_STATE', 'Order is not awaiting confirmation')
  if (new Date(order.confirmation_deadline).getTime() <= Date.now()) throw apiError(409, 'DEADLINE_PASSED', 'Confirmation deadline has passed')

  const now = new Date()
  const { data, error } = await updateOrderStatus(event, orderId, { status: 'awaiting_payment', confirmed_at: now.toISOString(), payment_deadline: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString() }, 'awaiting_confirmation')
  if (error?.code === 'PGRST116') throw apiError(409, 'INVALID_STATE', 'Order status changed')
  if (error || !data) { console.error('confirm order failed:', error?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to confirm order') }
  sendEmail(order.buyer_email, 'Pesanan dikonfirmasi', 'Silakan lakukan pembayaran.')
  return { order: data }
})
