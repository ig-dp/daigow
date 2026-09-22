import { apiError } from '../../../utils/api-error'
import { requireOrderAccess } from '../../../utils/order-access'
import { completeOrder } from '../../../repositories/order.repository'
import { createPayoutForOrder } from '../../../repositories/payout.repository'

export default defineEventHandler(async (event) => {
  const order = await requireOrderAccess(event, getRouterParam(event, 'id')!)
  if (order.status !== 'delivered' || (order.issue_reported_at && !order.issue_resolved_at)) throw apiError(409, 'INVALID_STATE', 'Order cannot be confirmed')
  const { data, error } = await completeOrder(event, order.id, 'buyer')
  if (error || !data) throw apiError(409, 'INVALID_STATE', 'Order cannot be confirmed')
  try {
    await createPayoutForOrder(event, order.id)
  } catch (err) {
    console.error('create payout failed:', (err as Error).message)
    throw apiError(500, 'PAYOUT_ERROR', 'Order completed but payout could not be initialized')
  }
  return { order: data }
})
