import { apiError } from '../../utils/api-error'
import { requireUser } from '../../utils/auth'
import { listOrdersForBuyer } from '../../repositories/order.repository'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { data, error } = await listOrdersForBuyer(event, user.id)
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load orders')
  return { orders: data ?? [] }
})
