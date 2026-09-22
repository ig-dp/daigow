import { apiError } from '../../../../utils/api-error'
import { requireSeller } from '../../../../utils/require-seller'
import { sendEmail } from '../../../../utils/mailer'
import { getOwnedOrderItem, updateOrderItemStatus, countActiveOrderItems, updateOrderStatus, insertRefund } from '../../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const itemId = getRouterParam(event, 'id')!

  const { data: item, error: findError } = await getOwnedOrderItem(event, seller.id, itemId)
  if (findError?.code === 'PGRST116' || !item) throw apiError(404, 'ORDER_ITEM_NOT_FOUND', 'Order item not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order item')
  const order = (item as any).orders
  if (order.status !== 'processing') throw apiError(409, 'INVALID_STATE', 'Order is not processing')
  if (order.issue_reported_at && !order.issue_resolved_at) throw apiError(409, 'ORDER_ON_HOLD', 'Order is on hold while an issue is reviewed')
  if (item.item_status === 'cancelled') throw apiError(409, 'INVALID_STATE', 'Item already cancelled')

  const { error: cancelError } = await updateOrderItemStatus(event, itemId, { item_status: 'cancelled', cancelled_at: new Date().toISOString() })
  if (cancelError?.code === 'PGRST116') throw apiError(409, 'INVALID_STATE', 'Item status changed')
  if (cancelError) { console.error('cancel item failed:', cancelError.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to cancel item') }

  const { data: remainingActive, error: countError } = await countActiveOrderItems(event, item.order_id, itemId)
  if (countError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to check remaining items')

  if (remainingActive > 0) {
    const { error: refundError } = await insertRefund(event, { order_id: item.order_id, order_item_id: itemId, refund_type: 'partial_item', item_amount_refunded: item.line_total, platform_fee_refunded: 0, total_refund_amount: item.line_total })
    if (refundError) { console.error('insert partial refund failed:', refundError.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to create refund') }
  } else {
    const total_refund_amount = item.line_total + order.platform_fee_amount
    const { error: refundError } = await insertRefund(event, { order_id: item.order_id, order_item_id: itemId, refund_type: 'full_order', item_amount_refunded: item.line_total, platform_fee_refunded: order.platform_fee_amount, total_refund_amount })
    if (refundError) { console.error('insert full-order refund failed:', refundError.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to create refund') }

    const { error: orderError } = await updateOrderStatus(event, item.order_id, { status: 'cancelled', cancelled_by: 'jastiper', settled_at: new Date().toISOString() }, 'processing', true)
    if (orderError) { console.error('cancel order failed:', orderError.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to cancel order') }
  }

  sendEmail(order.buyer_email, 'Item pesanan dibatalkan', `Item ${itemId} dibatalkan, refund akan diproses.`)
  return { success: true }
})
