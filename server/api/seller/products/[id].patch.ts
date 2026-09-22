import { readBody } from 'h3'
import { apiError } from '../../../utils/api-error'
import { requireSeller } from '../../../utils/require-seller'
import { getOwnedProduct, updateProduct, replaceProductPhotos, replaceProductVariants } from '../../../repositories/product.repository'

const ALLOWED_KEYS = new Set(['name', 'category', 'description', 'description_source', 'price', 'photos', 'variants'])
const DESCRIPTION_SOURCES = new Set(['manual', 'ai', 'ai_edited'])
const isPrice = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0
const isPhoto = (value: any) => value && typeof value === 'object' && !Array.isArray(value) && typeof value.photo_url === 'string' && value.photo_url.length > 0 && Number.isInteger(value.sort_order)
const isVariant = (value: any) => value && typeof value === 'object' && !Array.isArray(value) && typeof value.name === 'string' && value.name.length > 0 && isPrice(value.price) && (!('id' in value) || typeof value.id === 'string') && (!('photo_url' in value) || typeof value.photo_url === 'string')

export default defineEventHandler(async (event) => {
  const seller = await requireSeller(event)
  const productId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  const keys = Object.keys(body)
  if (!keys.length) throw apiError(400, 'INVALID_INPUT', 'At least one field is required')

  const scalarValues: Record<string, unknown> = {}
  for (const key of keys) {
    if (!ALLOWED_KEYS.has(key)) throw apiError(400, 'INVALID_INPUT', `Unknown field: ${key}`)
    if (key === 'name') {
      if (typeof body.name !== 'string' || !body.name) throw apiError(400, 'INVALID_INPUT', 'name must be a non-empty string')
      scalarValues.name = body.name
    } else if (key === 'category') {
      if (typeof body.category !== 'string') throw apiError(400, 'INVALID_INPUT', 'category must be a string')
      scalarValues.category = body.category
    } else if (key === 'description') {
      if (typeof body.description !== 'string') throw apiError(400, 'INVALID_INPUT', 'description must be a string')
      scalarValues.description = body.description
    } else if (key === 'description_source') {
      if (!DESCRIPTION_SOURCES.has(body.description_source)) throw apiError(400, 'INVALID_INPUT', 'description_source must be manual, ai, or ai_edited')
      scalarValues.description_source = body.description_source
    } else if (key === 'price') {
      if (!isPrice(body.price)) throw apiError(400, 'INVALID_INPUT', 'price must be a non-negative integer')
      scalarValues.price = body.price
    } else if (key === 'photos') {
      if (!Array.isArray(body.photos) || !body.photos.length || !body.photos.every(isPhoto)) throw apiError(400, 'INVALID_INPUT', 'photos must be a non-empty array of { photo_url, sort_order }')
    } else if (key === 'variants') {
      if (!Array.isArray(body.variants) || !body.variants.every(isVariant)) throw apiError(400, 'INVALID_INPUT', 'variants must be an array of { name, price, photo_url? }')
    }
  }

  const { data: existing, error: findError } = await getOwnedProduct(event, seller.id, productId)
  if (findError?.code === 'PGRST116' || !existing) throw apiError(404, 'PRODUCT_NOT_FOUND', 'Product not found')
  if (findError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load product')

  if ('variants' in body) {
    const existingIds = new Set((existing.product_variants ?? []).map((variant: { id: string }) => variant.id))
    const suppliedIds = body.variants.flatMap((variant: { id?: string }) => variant.id ? [variant.id] : [])
    if (new Set(suppliedIds).size !== suppliedIds.length || suppliedIds.some((id: string) => !existingIds.has(id))) {
      throw apiError(400, 'INVALID_INPUT', 'Variant IDs must belong to this product and be unique')
    }
  }

  if ('variants' in body) {
    const { error } = await replaceProductVariants(event, productId, body.variants, (existing.product_variants ?? []).map((variant: { id: string }) => variant.id))
    if (error?.code === 'VARIANT_IN_USE') throw apiError(409, 'VARIANT_IN_USE', 'Varian yang sudah dipesan tidak dapat dihapus')
    if (error) { console.error('replaceProductVariants failed:', error.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to update product variants') }
  }
  if (Object.keys(scalarValues).length) {
    const { error } = await updateProduct(event, productId, scalarValues)
    if (error) { console.error('updateProduct failed:', error.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to update product') }
  }
  if ('photos' in body) {
    const { error } = await replaceProductPhotos(event, productId, body.photos)
    if (error) { console.error('replaceProductPhotos failed:', error.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to update product photos') }
  }

  const { data, error } = await getOwnedProduct(event, seller.id, productId)
  if (error || !data) { console.error('getOwnedProduct re-fetch failed:', error?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to load updated product') }
  return { product: data }
})
