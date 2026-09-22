import { getQuery } from 'h3'
import { apiError } from '../../../utils/api-error'
import { requireSeller } from '../../../utils/require-seller'
import { listSellerProducts } from '../../../repositories/product.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const query = getQuery(event)
  const trip_id = typeof query.trip_id === 'string' ? query.trip_id : undefined
  const { data, error } = await listSellerProducts(event, seller.id, { trip_id })
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load products')
  return { products: data ?? [] }
})
