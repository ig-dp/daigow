import { apiError } from '../../../utils/api-error'
import { requireSeller } from '../../../utils/require-seller'
import { getOwnedOrder, getOrderSettlement } from '../../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const orderId = getRouterParam(event, 'id')!
  const { data, error } = await getOwnedOrder(event, seller.id, orderId)
  if (error?.code === 'PGRST116') throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order')
  if (!data) throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found')
  const settlement = await getOrderSettlement(event, orderId)
  if (settlement.error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load order settlement')
  return { order: data, payout: settlement.payout, refunds: settlement.refunds }
})
