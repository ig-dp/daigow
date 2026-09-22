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
  if (order.status !== 'shipped') throw apiError(409, 'INVALID_STATE', 'Order is not shipped')
  if (order.issue_reported_at && !order.issue_resolved_at) throw apiError(409, 'ORDER_ON_HOLD', 'Order is on hold while an issue is reviewed')
  const now = new Date()
  const { data, error } = await updateOrderStatus(event, orderId, { status: 'delivered', delivered_by: 'jastiper', delivered_at: now.toISOString(), auto_complete_at: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString() }, 'shipped', true)
  if (error?.code === 'PGRST116') throw apiError(409, 'INVALID_STATE', 'Order status changed or is on hold')
  if (error || !data) { console.error('mark-delivered failed:', error?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to mark order delivered') }
  sendEmail(order.buyer_email, 'Pesanan terkirim', 'Konfirmasi penerimaan atau laporkan masalah.')
  return { order: data }
})
