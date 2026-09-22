import { apiError } from '../../../utils/api-error'
import { requireSeller } from '../../../utils/require-seller'
import { getOwnedProduct, productHasOrderItems, deleteProduct } from '../../../repositories/product.repository'

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const productId = getRouterParam(event, 'id')!
  const { data: existing, error: findError } = await getOwnedProduct(event, seller.id, productId)
  if (findError?.code === 'PGRST116' || !existing) throw apiError(404, 'PRODUCT_NOT_FOUND', 'Product not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load product')

  const { data: referenced, error: refError } = await productHasOrderItems(event, productId)
  if (refError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to check product references')
  if (referenced) throw apiError(409, 'INVALID_STATE', 'Product is referenced by an order and cannot be deleted')

  const { error } = await deleteProduct(event, productId)
  if (error) { console.error('deleteProduct failed:', error.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to delete product') }
  return { success: true }
})
