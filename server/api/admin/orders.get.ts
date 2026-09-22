import { getQuery } from 'h3'
import { apiError } from '../../utils/api-error'
import { requireAdmin } from '../../utils/require-admin'
import { listAdminOrders } from '../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const onHold = getQuery(event).on_hold === 'true'
  const { data, error } = await listAdminOrders(event, onHold)
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load orders')
  return { orders: data ?? [] }
})
