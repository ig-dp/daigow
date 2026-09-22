import { readBody } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import { apiError } from '../../utils/api-error'
import { sendEmail } from '../../utils/mailer'
import { getOpenTrip, getProductsForOrder, insertOrder } from '../../repositories/order.repository'

const REQUIRED_KEYS = ['trip_id', 'items', 'buyer_name', 'buyer_email', 'buyer_phone', 'shipping_address']
const ALLOWED_KEYS = new Set(REQUIRED_KEYS)
const isEmail = (value: unknown) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const isItem = (value: any) =>
  value && typeof value === 'object' && !Array.isArray(value) &&
  typeof value.product_id === 'string' && value.product_id.length > 0 &&
  (!('variant_id' in value) || typeof value.variant_id === 'string') &&
  typeof value.quantity === 'number' && Number.isInteger(value.quantity) && value.quantity >= 1

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  for (const key of Object.keys(body)) if (!ALLOWED_KEYS.has(key)) throw apiError(400, 'INVALID_INPUT', `Unknown field: ${key}`)
  for (const key of REQUIRED_KEYS) if (!(key in body)) throw apiError(400, 'INVALID_INPUT', `Missing field: ${key}`)
  if (typeof body.trip_id !== 'string' || !body.trip_id) throw apiError(400, 'INVALID_INPUT', 'trip_id must be a non-empty string')
  if (!Array.isArray(body.items) || !body.items.length || !body.items.every(isItem)) throw apiError(400, 'INVALID_INPUT', 'items must be a non-empty array of { product_id, variant_id?, quantity }')
  if (typeof body.buyer_name !== 'string' || !body.buyer_name) throw apiError(400, 'INVALID_INPUT', 'buyer_name must be a non-empty string')
  if (!isEmail(body.buyer_email)) throw apiError(400, 'INVALID_INPUT', 'buyer_email must be a valid email')
  if (typeof body.buyer_phone !== 'string' || !body.buyer_phone) throw apiError(400, 'INVALID_INPUT', 'buyer_phone must be a non-empty string')
  if (typeof body.shipping_address !== 'string' || !body.shipping_address) throw apiError(400, 'INVALID_INPUT', 'shipping_address must be a non-empty string')

  const { data: trip, error: tripError } = await getOpenTrip(event, body.trip_id)
  if (tripError?.code === 'PGRST116' || !trip) throw apiError(404, 'TRIP_NOT_FOUND', 'Trip not found')
  if (tripError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load trip')
  const now = new Date().toISOString()
  if (trip.status !== 'open' || now < trip.order_open_at || now > trip.order_close_at) {
    throw apiError(409, 'INVALID_STATE', 'Trip is not open for orders')
  }

  const productIds = [...new Set(body.items.map((item: any) => item.product_id))]
  const { data: products, error: productsError } = await getProductsForOrder(event, body.trip_id, productIds as string[])
  if (productsError) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load products')
  const productMap = new Map((products ?? []).map((p: any) => [p.id, p]))

  const orderItems = []
  for (const item of body.items) {
    const product = productMap.get(item.product_id)
    if (!product) throw apiError(404, 'PRODUCT_NOT_FOUND', `Product ${item.product_id} not found`)
    const variants = product.product_variants ?? []
    if (variants.length > 0 && !item.variant_id) throw apiError(400, 'INVALID_INPUT', `variant_id required for product ${item.product_id}`)
    let variant = null
    if (item.variant_id) {
      variant = variants.find((v: any) => v.id === item.variant_id)
      if (!variant) throw apiError(400, 'INVALID_INPUT', `variant_id ${item.variant_id} not found for product ${item.product_id}`)
    }
    const unit_price = variant ? variant.price : product.price
    const photos = [...(product.product_photos ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order)
    const snapshot_photo_url = variant?.photo_url || photos[0]?.photo_url || ''
    orderItems.push({
      product_id: product.id,
      variant_id: variant?.id ?? null,
      quantity: item.quantity,
      unit_price,
      line_total: unit_price * item.quantity,
      product_name_snapshot: product.name,
      category_snapshot: product.category ?? null,
      variant_name_snapshot: variant?.name ?? null,
      snapshot_photo_url,
    })
  }

  const user = await serverSupabaseUser(event).catch(() => null)
  const { data, error } = await insertOrder(event, {
    trip_id: body.trip_id,
    buyer_id: user?.sub ?? null,
    buyer_name: body.buyer_name,
    buyer_email: body.buyer_email,
    buyer_phone: body.buyer_phone,
    shipping_address: body.shipping_address,
    items: orderItems,
  })
  if (error || !data) { console.error('insertOrder failed:', error?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to create order') }

  sendEmail(body.buyer_email, 'Pesanan diterima', `Lacak pesanan Anda: /orders/track/${data.tracking_token}`)

  return { order_id: data.id, tracking_token: data.tracking_token }
})
