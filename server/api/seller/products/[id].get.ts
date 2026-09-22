import { apiError } from '../../../utils/api-error'
import { requireSeller } from '../../../utils/require-seller'
import { getOwnedProduct } from '../../../repositories/product.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const productId = getRouterParam(event, 'id')!
  const { data, error } = await getOwnedProduct(event, seller.id, productId)
  if (error?.code === 'PGRST116') throw apiError(404, 'PRODUCT_NOT_FOUND', 'Product not found')
  if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load product')
  if (!data) throw apiError(404, 'PRODUCT_NOT_FOUND', 'Product not found')
  return { product: data }
})
